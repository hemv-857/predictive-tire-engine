import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Lap Time Delta Matrix — heatmap of lap time deltas between all drivers across all laps
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const raceId = searchParams.get('raceId')
  const driverCode = searchParams.get('driverCode') // reference driver

  if (!raceId) {
    return NextResponse.json({ error: 'raceId required' }, { status: 400 })
  }

  const telemetry = await db.telemetry.findMany({
    where: { raceId },
    orderBy: { lap: 'asc' },
    include: { driver: true },
  })

  if (telemetry.length === 0) {
    return NextResponse.json({ error: 'No telemetry' }, { status: 404 })
  }

  // Group by driver and lap
  const driverLaps = new Map<string, Map<number, number>>()
  const driverInfo = new Map<string, any>()
  for (const t of telemetry) {
    if (!driverLaps.has(t.driver.code)) {
      driverLaps.set(t.driver.code, new Map())
      driverInfo.set(t.driver.code, { code: t.driver.code, name: t.driver.name, team: t.driver.team })
    }
    driverLaps.get(t.driver.code)!.set(t.lap, t.lapTime)
  }

  const drivers = Array.from(driverLaps.keys())
  const refDriver = driverCode && drivers.includes(driverCode) ? driverCode : drivers[0]
  const refLaps = driverLaps.get(refDriver)!

  // Get all laps
  const allLaps = Array.from(new Set(telemetry.map(t => t.lap))).sort((a, b) => a - b)

  // Build delta matrix: [driver][lap] = delta vs reference driver
  const matrix: { driver: string; deltas: (number | null)[] }[] = []
  for (const driver of drivers) {
    const laps = driverLaps.get(driver)!
    const deltas: (number | null)[] = []
    for (const lap of allLaps) {
      const refTime = refLaps.get(lap)
      const driverTime = laps.get(lap)
      if (refTime && driverTime) {
        deltas.push(Math.round((driverTime - refTime) * 1000) / 1000)
      } else {
        deltas.push(null)
      }
    }
    matrix.push({ driver, deltas })
  }

  // Compute cumulative delta per driver
  const cumulative: { driver: string; cumDelta: number }[] = []
  for (const row of matrix) {
    let cum = 0
    for (const d of row.deltas) {
      if (d !== null) cum += d
    }
    cumulative.push({ driver: row.driver, cumDelta: Math.round(cum * 1000) / 1000 })
  }

  // Per-driver summary
  const driverSummary = drivers.map(driver => {
    const laps = driverLaps.get(driver)!
    const lapTimes = Array.from(laps.values())
    const avgLap = lapTimes.reduce((s, v) => s + v, 0) / lapTimes.length
    const bestLap = Math.min(...lapTimes)
    const consistency = Math.sqrt(lapTimes.reduce((s, v) => s + (v - avgLap) ** 2, 0) / lapTimes.length)
    const cum = cumulative.find(c => c.driver === driver)?.cumDelta || 0
    return {
      driver,
      name: driverInfo.get(driver)?.name,
      team: driverInfo.get(driver)?.team,
      isRB: driverInfo.get(driver)?.team === 'Apex Racing',
      avgLap: Math.round(avgLap * 1000) / 1000,
      bestLap: Math.round(bestLap * 1000) / 1000,
      consistency: Math.round(consistency * 1000) / 1000,
      cumDelta: cum,
      lapCount: lapTimes.length,
    }
  }).sort((a, b) => a.cumDelta - b.cumDelta)

  return NextResponse.json({
    refDriver,
    drivers: driverInfo,
    allLaps,
    matrix,
    cumulative,
    driverSummary,
    totalLaps: allLaps.length,
    totalDrivers: drivers.length,
  })
}
