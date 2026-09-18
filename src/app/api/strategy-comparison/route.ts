import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Race Strategy Comparison — compares all drivers' strategies in a race side-by-side
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

  // Group by driver
  const driverMap = new Map<string, any>()
  for (const t of telemetry) {
    if (!driverMap.has(t.driverId)) {
      driverMap.set(t.driverId, {
        driverId: t.driverId,
        driverCode: t.driver.code,
        driverName: t.driver.name,
        team: t.driver.team,
        number: t.driver.number,
        laps: [],
        stints: [],
      })
    }
    driverMap.get(t.driverId)!.laps.push(t)
  }

  // Build strategy comparison per driver
  const drivers = Array.from(driverMap.values()).map((d) => {
    // Detect stints
    const stints: { compound: string; startLap: number; endLap: number; laps: any[] }[] = []
    let current: any = null
    for (const t of d.laps) {
      const comp = t.compound?.name || 'Unknown'
      if (!current || current.compound !== comp) {
        current = { compound: comp, startLap: t.lap, endLap: t.lap, laps: [] }
        stints.push(current)
      }
      current.endLap = t.lap
      current.laps.push(t)
    }

    const totalLaps = d.laps.length
    const totalTime = d.laps.reduce((s, l) => s + l.lapTime, 0)
    const avgLapTime = totalTime / totalLaps
    const bestLap = Math.min(...d.laps.map((l: any) => l.lapTime))
    const avgPerf = d.laps.reduce((s, l) => s + l.tirePerformance, 0) / totalLaps
    const avgTemp = d.laps.reduce((s, l) => s + (l.tireTempFL + l.tireTempFR + l.tireTempRL + l.tireTempRR) / 4, 0) / totalLaps

    // Strategy type
    const strategyType = stints.length === 1 ? 'one-stop' : stints.length === 2 ? 'two-stop' : stints.length === 3 ? 'three-stop' : `${stints.length}-stop`
    const compoundSequence = stints.map(s => s.compound[0]).join('→') // S→M→M

    return {
      driverCode: d.driverCode,
      driverName: d.driverName,
      team: d.team,
      number: d.number,
      isRacingBulls: d.team === 'Apex Racing',
      totalLaps,
      totalTime: Math.round(totalTime * 1000) / 1000,
      avgLapTime: Math.round(avgLapTime * 1000) / 1000,
      bestLap: Math.round(bestLap * 1000) / 1000,
      avgPerf: Math.round(avgPerf * 1000) / 1000,
      avgTemp: Math.round(avgTemp * 10) / 10,
      stintCount: stints.length,
      strategyType,
      compoundSequence,
      stints: stints.map((s, i) => ({
        stintNumber: i + 1,
        compound: s.compound,
        startLap: s.startLap,
        endLap: s.endLap,
        length: s.laps.length,
        avgPerf: s.laps.reduce((sum, l) => sum + l.tirePerformance, 0) / s.laps.length,
      })),
    }
  }).sort((a, b) => a.totalTime - b.totalTime)

  // Strategy distribution
  const strategyCounts: Record<string, number> = {}
  for (const d of drivers) strategyCounts[d.strategyType] = (strategyCounts[d.strategyType] || 0) + 1

  // Compound usage stats
  const compoundUsage: Record<string, number> = {}
  for (const d of drivers) {
    for (const s of d.stints) {
      compoundUsage[s.compound] = (compoundUsage[s.compound] || 0) + s.length
    }
  }

  // Best strategies per metric
  const fastestDriver = drivers[0]
  const bestPerfDriver = [...drivers].sort((a, b) => b.avgPerf - a.avgPerf)[0]
  const mostEfficientDriver = [...drivers].sort((a, b) => a.avgLapTime - b.avgLapTime)[0]

  return NextResponse.json({
    race,
    drivers,
    summary: {
      totalDrivers: drivers.length,
      strategyDistribution: strategyCounts,
      compoundUsage,
      fastestDriver: fastestDriver?.driverCode,
      fastestTime: fastestDriver?.totalTime,
      bestPerfDriver: bestPerfDriver?.driverCode,
      bestPerf: bestPerfDriver?.avgPerf,
      mostEfficient: mostEfficientDriver?.driverCode,
    },
  })
}
