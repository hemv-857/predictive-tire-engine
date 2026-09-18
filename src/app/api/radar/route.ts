import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Driver Performance Radar — multi-dimensional comparison across 6 metrics
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const raceId = searchParams.get('raceId')
  const driverCodes = searchParams.get('drivers')?.split(',').filter(Boolean) || []

  if (!raceId) {
    return NextResponse.json({ error: 'raceId required' }, { status: 400 })
  }

  const allDrivers = await db.driver.findMany()
  const targetDrivers = driverCodes.length
    ? allDrivers.filter((d) => driverCodes.includes(d.code))
    : allDrivers.slice(0, 6)

  // Get telemetry for all target drivers
  const telemetry = await db.telemetry.findMany({
    where: { raceId, driverId: { in: targetDrivers.map((d) => d.id) } },
    orderBy: { lap: 'asc' },
    include: { driver: true, compound: true },
  })

  if (telemetry.length === 0) {
    return NextResponse.json({ error: 'No telemetry' }, { status: 404 })
  }

  // Group by driver
  const driverMap = new Map<string, any[]>()
  for (const t of telemetry) {
    if (!driverMap.has(t.driver.code)) driverMap.set(t.driver.code, [])
    driverMap.get(t.driver.code)!.push(t)
  }

  // Compute 6 radar dimensions per driver (normalized 0-100)
  const radarData = targetDrivers.map((driver) => {
    const laps = driverMap.get(driver.code) || []
    if (laps.length === 0) return null

    const lapTimes = laps.map((l) => l.lapTime)
    const perfs = laps.map((l) => l.tirePerformance)
    const temps = laps.map((l) => (l.tireTempFL + l.tireTempFR + l.tireTempRL + l.tireTempRR) / 4)
    const slipAngles = laps.map((l) => (l.slipAngleFL + l.slipAngleFR) / 2)
    const speedTraps = laps.map((l) => l.speedTrap)

    // Detect stints for tire management score
    const stints: any[] = []
    let current: any = null
    for (const t of laps) {
      const comp = t.compound?.name || 'Unknown'
      if (!current || current.compound !== comp) {
        current = { compound: comp, laps: [] }
        stints.push(current)
      }
      current.laps.push(t)
    }

    // Raw metrics
    const avgLap = lapTimes.reduce((s, v) => s + v, 0) / lapTimes.length
    const bestLap = Math.min(...lapTimes)
    const avgPerf = perfs.reduce((s, v) => s + v, 0) / perfs.length
    const consistency = Math.sqrt(lapTimes.reduce((s, v) => s + (v - avgLap) ** 2, 0) / lapTimes.length)
    const avgTemp = temps.reduce((s, v) => s + v, 0) / temps.length
    const tempStability = Math.sqrt(temps.reduce((s, v) => s + (v - avgTemp) ** 2, 0) / temps.length)
    const avgSlip = slipAngles.reduce((s, v) => s + v, 0) / slipAngles.length
    const avgSpeed = speedTraps.reduce((s, v) => s + v, 0) / speedTraps.length
    const stintLengths = stints.map((s) => s.laps.length)
    const avgStintLength = stintLengths.reduce((s, v) => s + v, 0) / stintLengths.length

    // Normalize to 0-100 (higher = better)
    // Speed: based on avg lap time (faster = higher score)
    // Need field benchmarks for normalization
    return {
      driverCode: driver.code,
      driverName: driver.name,
      team: driver.team,
      isRB: driver.team === 'Apex Racing',
      color: driver.team === 'Apex Racing' ? '#ef4444' : driver.team === 'Red Bull Racing' ? '#1e3a8a' : driver.team === 'Ferrari' ? '#dc2626' : driver.team === 'Mercedes' ? '#22c55e' : driver.team === 'McLaren' ? '#f97316' : '#a855f7',
      // Raw values
      raw: {
        avgLap: Math.round(avgLap * 1000) / 1000,
        bestLap: Math.round(bestLap * 1000) / 1000,
        avgPerf: Math.round(avgPerf * 1000) / 1000,
        consistency: Math.round(consistency * 1000) / 1000,
        avgTemp: Math.round(avgTemp * 10) / 10,
        tempStability: Math.round(tempStability * 1000) / 1000,
        avgSlip: Math.round(avgSlip * 100) / 100,
        avgSpeed: Math.round(avgSpeed * 10) / 10,
        avgStintLength: Math.round(avgStintLength * 10) / 10,
        stintCount: stints.length,
        totalLaps: laps.length,
      },
    }
  }).filter(Boolean)

  // Compute field benchmarks for normalization
  const allAvgLaps = radarData.map((d) => d!.raw.avgLap)
  const allConsistency = radarData.map((d) => d!.raw.consistency)
  const allPerfs = radarData.map((d) => d!.raw.avgPerf)
  const allTempStability = radarData.map((d) => d!.raw.tempStability)
  const allSlip = radarData.map((d) => d!.raw.avgSlip)
  const allSpeed = radarData.map((d) => d!.raw.avgSpeed)

  const minLap = Math.min(...allAvgLaps)
  const maxLap = Math.max(...allAvgLaps)
  const maxCons = Math.max(...allConsistency)
  const minPerf = Math.min(...allPerfs)
  const maxPerf = Math.max(...allPerfs)
  const maxTempStab = Math.max(...allTempStability)
  const maxSlip = Math.max(...allSlip)
  const minSpeed = Math.min(...allSpeed)
  const maxSpeed = Math.max(...allSpeed)

  // Normalize each driver's metrics to 0-100
  const normalized = radarData.map((d) => {
    const r = d!.raw
    // Speed: lower lap time = higher score
    const speed = maxLap !== minLap ? 100 - ((r.avgLap - minLap) / (maxLap - minLap)) * 100 : 75
    // Consistency: lower σ = higher score
    const consistencyScore = maxCons > 0 ? 100 - (r.consistency / maxCons) * 100 : 75
    // Tire management: higher perf = higher score
    const tireMgmt = maxPerf !== minPerf ? ((r.avgPerf - minPerf) / (maxPerf - minPerf)) * 100 : 75
    // Temp control: lower temp stability σ = higher score
    const tempControl = maxTempStab > 0 ? 100 - (r.tempStability / maxTempStab) * 100 : 75
    // Grip (low slip): lower slip = higher score
    const grip = maxSlip > 0 ? 100 - (r.avgSlip / maxSlip) * 100 : 75
    // Top speed: higher speed trap = higher score
    const topSpeed = maxSpeed !== minSpeed ? ((r.avgSpeed - minSpeed) / (maxSpeed - minSpeed)) * 100 : 75

    return {
      ...d!,
      normalized: {
        speed: Math.round(speed),
        consistency: Math.round(consistencyScore),
        tireMgmt: Math.round(tireMgmt),
        tempControl: Math.round(tempControl),
        grip: Math.round(grip),
        topSpeed: Math.round(topSpeed),
      },
    }
  })

  // Overall score
  normalized.forEach((d) => {
    const n = d!.normalized
    d!.overall = Math.round((n.speed + n.consistency + n.tireMgmt + n.tempControl + n.grip + n.topSpeed) / 6)
  })

  // Sort by overall
  normalized.sort((a, b) => b!.overall - a!.overall)

  return NextResponse.json({
    drivers: normalized,
    dimensions: [
      { id: 'speed', label: 'Speed', description: 'Avg lap time relative to field' },
      { id: 'consistency', label: 'Consistency', description: 'Lap time stability (lower σ)' },
      { id: 'tireMgmt', label: 'Tire Management', description: 'Avg tire performance retention' },
      { id: 'tempControl', label: 'Temp Control', description: 'Tire temp stability' },
      { id: 'grip', label: 'Grip', description: 'Slip angle management (lower = better)' },
      { id: 'topSpeed', label: 'Top Speed', description: 'Speed trap performance' },
    ],
    summary: {
      totalDrivers: normalized.length,
      topDriver: normalized[0]?.driverCode,
      topScore: normalized[0]?.overall,
      fieldAvg: Math.round(normalized.reduce((s, d) => s + d!.overall, 0) / normalized.length),
    },
  })
}
