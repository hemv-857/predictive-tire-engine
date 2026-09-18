import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Race Strategy Gantt — timeline visualization of all drivers' stints and pit stops
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const raceId = searchParams.get('raceId')

  if (!raceId) {
    return NextResponse.json({ error: 'raceId required' }, { status: 400 })
  }

  const race = await db.race.findUnique({ where: { id: raceId } })
  if (!race) return NextResponse.json({ error: 'Race not found' }, { status: 404 })

  const telemetry = await db.telemetry.findMany({
    where: { raceId },
    orderBy: { lap: 'asc' },
    include: { driver: true, compound: true },
  })

  if (telemetry.length === 0) {
    return NextResponse.json({ error: 'No telemetry' }, { status: 404 })
  }

  // Group by driver, detect stints
  const driverMap = new Map<string, { driver: any; stints: any[]; laps: any[] }>()
  for (const t of telemetry) {
    if (!driverMap.has(t.driver.code)) {
      driverMap.set(t.driver.code, { driver: t.driver, stints: [], laps: [] })
    }
    driverMap.get(t.driver.code)!.laps.push(t)
  }

  const drivers = Array.from(driverMap.values()).map((d) => {
    // Detect stints
    const stints: { compound: string; compoundColor: string; startLap: number; endLap: number; laps: any[] }[] = []
    let current: any = null
    for (const t of d.laps) {
      const comp = t.compound?.name || 'Unknown'
      const color = t.compound?.color || '#888'
      if (!current || current.compound !== comp) {
        current = { compound: comp, compoundColor: color, startLap: t.lap, endLap: t.lap, laps: [] }
        stints.push(current)
      }
      current.endLap = t.lap
      current.laps.push(t)
    }

    const totalTime = d.laps.reduce((s, l) => s + l.lapTime, 0)
    const avgPerf = d.laps.reduce((s, l) => s + l.tirePerformance, 0) / d.laps.length
    const bestLap = Math.min(...d.laps.map((l: any) => l.lapTime))
    const lastLap = d.laps[d.laps.length - 1].lap

    return {
      driverCode: d.driver.code,
      driverName: d.driver.name,
      team: d.driver.team,
      number: d.driver.number,
      isRB: d.driver.team === 'Apex Racing',
      totalLaps: d.laps.length,
      lastLap,
      totalTime: Math.round(totalTime * 1000) / 1000,
      avgPerf: Math.round(avgPerf * 1000) / 1000,
      bestLap: Math.round(bestLap * 1000) / 1000,
      stintCount: stints.length,
      stints: stints.map((s, i) => ({
        stintNumber: i + 1,
        compound: s.compound,
        compoundColor: s.compoundColor,
        startLap: s.startLap,
        endLap: s.endLap,
        duration: s.endLap - s.startLap + 1,
        avgPerf: Math.round((s.laps.reduce((sum, l) => sum + l.tirePerformance, 0) / s.laps.length) * 1000) / 1000,
        avgLapTime: Math.round((s.laps.reduce((sum, l) => sum + l.lapTime, 0) / s.laps.length) * 1000) / 1000,
      })),
    }
  }).sort((a, b) => a.totalTime - b.totalTime)

  // Pit stop timeline events
  const pitEvents: { driverCode: string; lap: number; fromCompound: string; toCompound: string; stintIdx: number }[] = []
  for (const driver of drivers) {
    for (let i = 0; i < driver.stints.length - 1; i++) {
      pitEvents.push({
        driverCode: driver.driverCode,
        lap: driver.stints[i].endLap,
        fromCompound: driver.stints[i].compound,
        toCompound: driver.stints[i + 1].compound,
        stintIdx: i,
      })
    }
  }

  return NextResponse.json({
    race: { name: race.name, circuit: race.circuit, totalLaps: race.lapsTotal },
    drivers,
    pitEvents,
    totalLaps: race.lapsTotal,
    totalDrivers: drivers.length,
    summary: {
      totalStints: drivers.reduce((s, d) => s + d.stintCount, 0),
      totalPitStops: pitEvents.length,
      avgStintsPerDriver: Math.round((drivers.reduce((s, d) => s + d.stintCount, 0) / drivers.length) * 10) / 10,
      fastestDriver: drivers[0]?.driverCode,
      fastestTime: drivers[0]?.totalTime,
      mostStops: drivers.reduce((most, d) => d.stintCount > most.stintCount ? d : most, drivers[0]),
    },
  })
}
