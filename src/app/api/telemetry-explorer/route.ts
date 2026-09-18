import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Telemetry Explorer — multi-channel telemetry data for a driver across all laps
// Returns all telemetry channels for lap-by-lap visualization with scrubbing
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const raceId = searchParams.get('raceId')
  const driverCode = searchParams.get('driverCode')

  if (!raceId || !driverCode) {
    return NextResponse.json({ error: 'raceId and driverCode required' }, { status: 400 })
  }

  const driver = await db.driver.findFirst({ where: { code: driverCode } })
  if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 404 })

  const telemetry = await db.telemetry.findMany({
    where: { raceId, driverId: driver.id },
    orderBy: { lap: 'asc' },
    include: { compound: true, race: true },
  })

  if (telemetry.length === 0) {
    return NextResponse.json({ error: 'No telemetry' }, { status: 404 })
  }

  const race = telemetry[0].race

  // Detect stint boundaries
  const stints: { compound: string; startLap: number; endLap: number }[] = []
  let current: any = null
  for (const t of telemetry) {
    const comp = t.compound?.name || 'Unknown'
    if (!current || current.compound !== comp) {
      current = { compound: comp, startLap: t.lap, endLap: t.lap }
      stints.push(current)
    }
    current.endLap = t.lap
  }

  // Build multi-channel data per lap
  const channels = telemetry.map((t, i) => {
    const tireAge = (() => {
      let age = 0
      for (const s of stints) {
        if (t.lap >= s.startLap && t.lap <= s.endLap) {
          age = t.lap - s.startLap + 1
          break
        }
      }
      return age || i + 1
    })()
    return {
      lap: t.lap,
      // Temperature channels
      tireTempFL: t.tireTempFL,
      tireTempFR: t.tireTempFR,
      tireTempRL: t.tireTempRL,
      tireTempRR: t.tireTempRR,
      avgTireTemp: (t.tireTempFL + t.tireTempFR + t.tireTempRL + t.tireTempRR) / 4,
      // Pressure channels
      tirePressureFL: t.tirePressureFL,
      tirePressureFR: t.tirePressureFR,
      tirePressureRL: t.tirePressureRL,
      tirePressureRR: t.tirePressureRR,
      avgPressure: (t.tirePressureFL + t.tirePressureFR + t.tirePressureRL + t.tirePressureRR) / 4,
      // Slip angles
      slipAngleFL: t.slipAngleFL,
      slipAngleFR: t.slipAngleFR,
      avgSlip: (t.slipAngleFL + t.slipAngleFR) / 2,
      // Brake temps
      brakeTempFL: t.brakeTempFL,
      brakeTempFR: t.brakeTempFR,
      avgBrake: (t.brakeTempFL + t.brakeTempFR) / 2,
      // Other
      fuelLoad: t.fuelLoad,
      tirePerformance: t.tirePerformance,
      lapTime: t.lapTime,
      sector1: t.sector1Time,
      sector2: t.sector2Time,
      sector3: t.sector3Time,
      speedTrap: t.speedTrap,
      compound: t.compound?.name,
      compoundColor: t.compound?.color,
      tireAge,
    }
  })

  // Channel groups for the UI
  const channelGroups = [
    {
      id: 'temps',
      label: 'Tire Temperatures',
      unit: '°C',
      color: '#ef4444',
      channels: [
        { id: 'tireTempFL', label: 'FL', color: '#ef4444' },
        { id: 'tireTempFR', label: 'FR', color: '#f97316' },
        { id: 'tireTempRL', label: 'RL', color: '#f59e0b' },
        { id: 'tireTempRR', label: 'RR', color: '#fbbf24' },
      ],
    },
    {
      id: 'pressures',
      label: 'Tire Pressures',
      unit: 'psi',
      color: '#06b6d4',
      channels: [
        { id: 'tirePressureFL', label: 'FL', color: '#06b6d4' },
        { id: 'tirePressureFR', label: 'FR', color: '#0891b2' },
        { id: 'tirePressureRL', label: 'RL', color: '#0e7490' },
        { id: 'tirePressureRR', label: 'RR', color: '#155e75' },
      ],
    },
    {
      id: 'slip',
      label: 'Slip Angles',
      unit: '°',
      color: '#a855f7',
      channels: [
        { id: 'slipAngleFL', label: 'FL', color: '#a855f7' },
        { id: 'slipAngleFR', label: 'FR', color: '#c084fc' },
      ],
    },
    {
      id: 'brake',
      label: 'Brake Temps',
      unit: '°C',
      color: '#f97316',
      channels: [
        { id: 'brakeTempFL', label: 'FL', color: '#f97316' },
        { id: 'brakeTempFR', label: 'FR', color: '#fb923c' },
      ],
    },
    {
      id: 'performance',
      label: 'Performance',
      unit: '',
      color: '#22c55e',
      channels: [
        { id: 'tirePerformance', label: 'Grip %', color: '#22c55e' },
        { id: 'fuelLoad', label: 'Fuel kg', color: '#84cc16' },
      ],
    },
    {
      id: 'laptime',
      label: 'Lap Times',
      unit: 's',
      color: '#06b6d4',
      channels: [
        { id: 'lapTime', label: 'Lap', color: '#06b6d4' },
      ],
    },
  ]

  // Summary stats
  const avgLapTime = channels.reduce((s, c) => s + c.lapTime, 0) / channels.length
  const bestLap = Math.min(...channels.map(c => c.lapTime))
  const avgPerf = channels.reduce((s, c) => s + c.tirePerformance, 0) / channels.length
  const avgTemp = channels.reduce((s, c) => s + c.avgTireTemp, 0) / channels.length

  return NextResponse.json({
    driver: { code: driver.code, name: driver.name, team: driver.team, number: driver.number },
    race: { name: race.name, circuit: race.circuit, lapsTotal: race.lapsTotal },
    channels,
    channelGroups,
    stints,
    summary: {
      totalLaps: channels.length,
      avgLapTime: Math.round(avgLapTime * 1000) / 1000,
      bestLap: Math.round(bestLap * 1000) / 1000,
      avgPerf: Math.round(avgPerf * 1000) / 1000,
      avgTemp: Math.round(avgTemp * 10) / 10,
      stintCount: stints.length,
    },
  })
}
