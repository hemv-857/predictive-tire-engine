/**
 * Telemetry Service — Predictive Tire Performance & Strategy Engine
 * Apex Racing F1 Team (Task 2-a)
 *
 * Bun + socket.io mini-service that simulates a LIVE F1 race telemetry stream.
 *
 * - HTTP + Socket.io server on port 3003 (socket.io path: "/" for Caddy forwarding).
 * - Pushes one lap of telemetry per driver every ~2.5s via `telemetry:update`.
 * - Emits `pit:stop` events when drivers reach their stint-end pit windows.
 * - Emits `race:status` every 5 laps with leader + fastest lap info.
 * - Exposes a plain HTTP `GET /health` endpoint.
 *
 * Run:  bun --hot index.ts
 */

import { createServer, IncomingMessage, ServerResponse } from 'node:http'
import { Server, Socket } from 'socket.io'

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

type Compound = 'S' | 'M' | 'H'

interface DriverConfig {
  code: string
  name: string
  team: string
  carNumber: number
  baseLapTime: number // seconds (dry Monaco pace)
  baseSpeedTrap: number // km/h
  strategy: Compound[] // stint compounds (length = stints = pitStops + 1)
}

interface DriverState {
  totalTime: number // cumulative race time (s), includes pit-stop time
  tireAge: number // laps completed on current set of tires
  stintIndex: number // 0-based stint index into strategy[]
  compound: Compound // current compound
  lastLapTime: number
  fuelLoad: number // kg
}

interface TelemetryPayload {
  driverCode: string
  driverName: string
  team: string
  carNumber: number
  lap: number
  tireCompound: Compound
  tireAge: number
  tireTempFL: number
  tireTempFR: number
  tireTempRL: number
  tireTempRR: number
  tirePressureFL: number
  tirePressureFR: number
  tirePressureRL: number
  tirePressureRR: number
  slipAngleFL: number
  slipAngleFR: number
  brakeTempFL: number
  brakeTempFR: number
  fuelLoad: number
  tirePerformance: number
  lapTime: number
  speedTrap: number
  position: number
  gapToLeader: number
  timestamp: string
}

interface PitStopPayload {
  driverCode: string
  lap: number
  fromCompound: Compound
  toCompound: Compound
  pitDuration: number
}

interface RaceStatusPayload {
  lap: number
  totalLaps: number
  leader: string
  fastestLap: number
  fastestDriver: string
  timestamp: string
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const PORT = 3003
const TOTAL_LAPS = 58 // Monaco GP live sim (real Monaco is 78, we use 58 and loop)
const TICK_MS = 2500 // ~2.5s per lap

const FUEL_START_KG = 105
const FUEL_BURN_PER_LAP = 1.85
const FUEL_MIN_KG = 3

const TIRE_TEMP_BASE = 92 // °C
const TIRE_TEMP_OPTIMUM = 97 // °C
const TIRE_PRESSURE_BASE = 22 // psi
const SLIP_ANGLE_BASE = 2.5 // deg
const BRAKE_TEMP_BASE = 480 // °C

// Compound degradation parameters: expectedLife (laps), deg (per-unit exponent coeff)
const COMPOUND_PARAMS: Record<Compound, { expectedLife: number; deg: number }> = {
  S: { expectedLife: 18, deg: 0.045 },
  M: { expectedLife: 28, deg: 0.028 },
  H: { expectedLife: 40, deg: 0.017 },
}

// Two-stop strategy: pit at the END of these laps (i.e. after completing the lap)
const PIT_WINDOWS = [20, 42]

// Driver grid — Apex Racing cars + key rivals
const DRIVERS: DriverConfig[] = [
  { code: 'VER', name: 'Max Verstappen', team: 'Red Bull Racing', carNumber: 1, baseLapTime: 75.4, baseSpeedTrap: 312, strategy: ['S', 'M', 'M'] },
  { code: 'LEC', name: 'Charles Leclerc', team: 'Ferrari', carNumber: 16, baseLapTime: 75.7, baseSpeedTrap: 308, strategy: ['S', 'M', 'M'] },
  { code: 'NOR', name: 'Lando Norris', team: 'McLaren', carNumber: 4, baseLapTime: 75.6, baseSpeedTrap: 310, strategy: ['S', 'M', 'M'] },
  { code: 'TSU', name: 'Yuki Tsunoda', team: 'Apex Racing', carNumber: 22, baseLapTime: 76.2, baseSpeedTrap: 305, strategy: ['S', 'M', 'M'] },
  { code: 'LAW', name: 'Liam Lawson', team: 'Apex Racing', carNumber: 30, baseLapTime: 76.4, baseSpeedTrap: 304, strategy: ['S', 'M', 'M'] },
]

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

/** Box–Muller transform: returns a gaussian-distributed sample N(mean, stdDev^2). */
function gaussian(stdDev: number = 1, mean: number = 0): number {
  const u1 = Math.max(1e-12, Math.random()) // avoid log(0)
  const u2 = Math.random()
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return mean + z * stdDev
}

const round = (n: number): number => Math.round(n)
const round2 = (n: number): number => Math.round(n * 100) / 100
const round3 = (n: number): number => Math.round(n * 1000) / 1000

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n))

// ----------------------------------------------------------------------------
// Race state
// ----------------------------------------------------------------------------

const driverState = new Map<string, DriverState>()
let currentLap = 0
let fastestLap = Infinity
let fastestDriver = ''

function initRace(): void {
  driverState.clear()
  for (const d of DRIVERS) {
    driverState.set(d.code, {
      totalTime: 0,
      tireAge: 0,
      stintIndex: 0,
      compound: d.strategy[0],
      lastLapTime: 0,
      fuelLoad: FUEL_START_KG,
    })
  }
  currentLap = 0
  fastestLap = Infinity
  fastestDriver = ''
}

initRace()

// ----------------------------------------------------------------------------
// Telemetry computation (per driver, per lap)
// ----------------------------------------------------------------------------

function computeDriverTelemetry(
  driver: DriverConfig,
  lap: number,
  s: DriverState,
): { payload: TelemetryPayload; lapTime: number } {
  const params = COMPOUND_PARAMS[s.compound]

  // Tire temps: rise with age (more friction on worn rubber), plus noise.
  const ageHeat = s.tireAge * 0.35
  const tireTempFL = TIRE_TEMP_BASE + ageHeat + gaussian(1.8)
  const tireTempFR = TIRE_TEMP_BASE + ageHeat + gaussian(1.8)
  const tireTempRL = TIRE_TEMP_BASE + ageHeat * 0.9 + gaussian(1.6)
  const tireTempRR = TIRE_TEMP_BASE + ageHeat * 0.9 + gaussian(1.6)

  // Tire pressures: drift upward with age/heat, plus small noise.
  const pressureDrift = s.tireAge * 0.045
  const tirePressureFL = TIRE_PRESSURE_BASE + pressureDrift + gaussian(0.08)
  const tirePressureFR = TIRE_PRESSURE_BASE + pressureDrift + gaussian(0.08)
  const tirePressureRL = TIRE_PRESSURE_BASE + pressureDrift + gaussian(0.08)
  const tirePressureRR = TIRE_PRESSURE_BASE + pressureDrift + gaussian(0.08)

  // Slip angles: creep up as tires degrade.
  const slipBase = SLIP_ANGLE_BASE + s.tireAge * 0.04
  const slipAngleFL = Math.max(0, slipBase + gaussian(0.4))
  const slipAngleFR = Math.max(0, slipBase + gaussian(0.4))

  // Brake temps: hotter with more laps (heat soak), plus noise.
  const brakeTempFL = BRAKE_TEMP_BASE + s.tireAge * 0.5 + gaussian(15)
  const brakeTempFR = BRAKE_TEMP_BASE + s.tireAge * 0.5 + gaussian(15)

  // Fuel load: decreases ~1.85 kg/lap from 105 kg (clamped to a small floor).
  const fuelLoad = Math.max(FUEL_MIN_KG, FUEL_START_KG - FUEL_BURN_PER_LAP * (lap - 1))

  // ----- Tire performance model -----
  // perf = 1 - compoundDeg * (tireAge / expectedLife)^1.4 - tempPenalty - slipPenalty
  const ageRatio = s.tireAge / params.expectedLife
  const degTerm = params.deg * Math.pow(ageRatio, 1.4)
  const avgTireTemp = (tireTempFL + tireTempFR + tireTempRL + tireTempRR) / 4
  const tempPenalty = Math.max(0, Math.abs(avgTireTemp - TIRE_TEMP_OPTIMUM) - 5) / 50
  const avgSlip = (slipAngleFL + slipAngleFR) / 2
  const slipPenalty = Math.max(0, avgSlip - 3) / 10
  const tirePerformance = clamp(1 - degTerm - tempPenalty - slipPenalty, 0.1, 1.0)

  // ----- Lap time model -----
  // base + fuel weight penalty + tire degradation penalty + noise
  const fuelFactor = fuelLoad * 0.03 // ~3.15s when full, near 0 when empty
  const tireDegFactor = (1 - tirePerformance) * 6.5
  const lapTime = driver.baseLapTime + fuelFactor + tireDegFactor + gaussian(0.25)

  // ----- Speed trap -----
  const speedTrap =
    driver.baseSpeedTrap - fuelLoad * 0.08 - (1 - tirePerformance) * 2 + gaussian(1.5)

  const payload: TelemetryPayload = {
    driverCode: driver.code,
    driverName: driver.name,
    team: driver.team,
    carNumber: driver.carNumber,
    lap,
    tireCompound: s.compound,
    tireAge: s.tireAge,
    tireTempFL: round(tireTempFL),
    tireTempFR: round(tireTempFR),
    tireTempRL: round(tireTempRL),
    tireTempRR: round(tireTempRR),
    tirePressureFL: round3(tirePressureFL),
    tirePressureFR: round3(tirePressureFR),
    tirePressureRL: round3(tirePressureRL),
    tirePressureRR: round3(tirePressureRR),
    slipAngleFL: round2(slipAngleFL),
    slipAngleFR: round2(slipAngleFR),
    brakeTempFL: round(brakeTempFL),
    brakeTempFR: round(brakeTempFR),
    fuelLoad: round2(fuelLoad),
    tirePerformance: round3(tirePerformance),
    lapTime: round3(lapTime),
    speedTrap: round(speedTrap),
    position: 0, // filled in after the whole field is resolved
    gapToLeader: 0,
    timestamp: new Date().toISOString(),
  }

  return { payload, lapTime }
}

// ----------------------------------------------------------------------------
// Per-tick simulation step (one lap for the whole field)
// ----------------------------------------------------------------------------

function tick(): void {
  currentLap++
  if (currentLap > TOTAL_LAPS) {
    // Loop the race
    console.log(`[RACE] Lap ${TOTAL_LAPS} complete — restarting live race sim.`)
    initRace()
    currentLap = 1
    io.emit('race:restart', {
      message: 'Live race restarting',
      totalLaps: TOTAL_LAPS,
      timestamp: new Date().toISOString(),
    })
  }

  const payloads: TelemetryPayload[] = []
  const pitEvents: PitStopPayload[] = []

  // --- First pass: compute telemetry, accumulate time, detect pit stops ---
  for (const driver of DRIVERS) {
    const s = driverState.get(driver.code)!
    s.tireAge += 1 // they just completed another lap on this set

    const { payload, lapTime } = computeDriverTelemetry(driver, currentLap, s)

    s.totalTime += lapTime
    s.lastLapTime = lapTime
    s.fuelLoad = payload.fuelLoad

    // Track fastest lap
    if (lapTime < fastestLap) {
      fastestLap = lapTime
      fastestDriver = driver.code
    }

    payloads.push(payload)

    // Pit stop at the end of the configured stint window
    if (
      s.stintIndex < PIT_WINDOWS.length &&
      currentLap === PIT_WINDOWS[s.stintIndex]
    ) {
      const fromCompound = s.compound
      const toCompound = driver.strategy[s.stintIndex + 1]
      const pitDuration = 22 + gaussian(1.5) // realistic ~22s stop

      pitEvents.push({
        driverCode: driver.code,
        lap: currentLap,
        fromCompound,
        toCompound,
        pitDuration: round2(pitDuration),
      })

      // Apply the pit stop: change tires, reset age, advance stint, add stop time
      s.tireAge = 0
      s.compound = toCompound
      s.stintIndex += 1
      s.totalTime += pitDuration // stationary time in the box
    }
  }

  // --- Second pass: positions & gaps based on cumulative race time ---
  const standings = DRIVERS.map((d) => ({
    code: d.code,
    total: driverState.get(d.code)!.totalTime,
  })).sort((a, b) => a.total - b.total)

  const leaderTotal = standings[0].total
  const positionMap = new Map<string, { position: number; gap: number }>()
  standings.forEach((entry, idx) => {
    positionMap.set(entry.code, {
      position: idx + 1,
      gap: entry.total - leaderTotal,
    })
  })

  for (const p of payloads) {
    const pos = positionMap.get(p.driverCode)!
    p.position = pos.position
    p.gapToLeader = round3(pos.gap)
  }

  // --- Emit telemetry updates (one event per driver per lap) ---
  for (const p of payloads) {
    io.emit('telemetry:update', p)
  }

  // --- Emit pit stops ---
  for (const ps of pitEvents) {
    io.emit('pit:stop', ps)
    console.log(
      `[PIT] L${ps.lap} ${ps.driverCode}: ${ps.fromCompound} -> ${ps.toCompound} (${ps.pitDuration}s)`,
    )
  }

  // --- Emit race status every 5 laps ---
  if (currentLap % 5 === 0) {
    const status: RaceStatusPayload = {
      lap: currentLap,
      totalLaps: TOTAL_LAPS,
      leader: standings[0].code,
      fastestLap: round3(fastestLap),
      fastestDriver: fastestDriver || '—',
      timestamp: new Date().toISOString(),
    }
    io.emit('race:status', status)
    console.log(
      `[STATUS] Lap ${currentLap}/${TOTAL_LAPS} | Leader: ${status.leader} | Fastest: ${status.fastestDriver} ${status.fastestLap}s`,
    )
  }

  console.log(
    `[LAP ${String(currentLap).padStart(2, '0')}] emitted ${payloads.length} telemetry updates` +
      (pitEvents.length ? `, ${pitEvents.length} pit stops` : ''),
  )
}

// ----------------------------------------------------------------------------
// HTTP + Socket.io server setup
// ----------------------------------------------------------------------------

const httpServer = createServer()

const io = new Server(httpServer, {
  // DO NOT change the path — Caddy forwards via XTransformPort based on this.
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// Intercept HTTP requests so we can serve GET /health WITHOUT socket.io's
// engine trying to handle (and error on) the already-ended response.
// All non-health requests are delegated back to socket.io's listener.
const ioRequestListeners = httpServer.listeners('request').slice(0)
httpServer.removeAllListeners('request')
httpServer.on('request', (req: IncomingMessage, res: ServerResponse) => {
  const pathname = new URL(req.url || '/', 'http://localhost').pathname
  if (req.method === 'GET' && pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        status: 'ok',
        connections: io.engine.clientsCount,
        lap: currentLap,
        totalLaps: TOTAL_LAPS,
      }),
    )
    return
  }
  // Delegate to socket.io's original request handlers
  for (const listener of ioRequestListeners) {
    listener.call(httpServer, req, res)
  }
})

io.on('connection', (socket: Socket) => {
  console.log(
    `[IO] Client connected: ${socket.id} (total: ${io.engine.clientsCount})`,
  )
  // Send new clients a snapshot so the dashboard hydrates immediately
  socket.emit('telemetry:snapshot', {
    lap: currentLap,
    totalLaps: TOTAL_LAPS,
    drivers: DRIVERS.map((d) => ({
      driverCode: d.code,
      driverName: d.name,
      team: d.team,
      carNumber: d.carNumber,
    })),
    fastestLap: fastestLap === Infinity ? null : round3(fastestLap),
    fastestDriver: fastestDriver || null,
  })

  socket.on('disconnect', (reason) => {
    console.log(`[IO] Client disconnected: ${socket.id} (${reason})`)
  })

  socket.on('error', (err) => {
    console.error(`[IO] Socket error (${socket.id}):`, err)
  })
})

// ----------------------------------------------------------------------------
// Start
// ----------------------------------------------------------------------------

httpServer.listen(PORT, () => {
  console.log('============================================================')
  console.log(` Telemetry Service — Apex Racing F1`)
  console.log(` HTTP + Socket.io listening on port ${PORT}`)
  console.log(` Health check : http://localhost:${PORT}/health`)
  console.log(` Socket.io    : path="/"  cors="*"`)
  console.log(` Live race    : ${TOTAL_LAPS} laps, tick = ${TICK_MS}ms`)
  console.log(` Drivers      : ${DRIVERS.map((d) => d.code).join(', ')}`)
  console.log(` Strategy     : S -> M -> M  (two-stop, pits at laps ${PIT_WINDOWS.join(', ')})`)
  console.log('============================================================')
})

// Kick the first lap shortly after boot, then keep ticking every TICK_MS.
setTimeout(tick, 1000)
const tickInterval = setInterval(tick, TICK_MS)

// Graceful shutdown
function shutdown(signal: string): void {
  console.log(`[Telemetry Service] ${signal} received, shutting down...`)
  clearInterval(tickInterval)
  io.close(() => {
    httpServer.close(() => {
      console.log('[Telemetry Service] closed.')
      process.exit(0)
    })
  })
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
