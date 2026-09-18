import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Head-to-head comparison between two drivers in a race
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const raceId = searchParams.get('raceId')
  const driverA = searchParams.get('driverA') // code
  const driverB = searchParams.get('driverB') // code

  if (!raceId || !driverA || !driverB) {
    return NextResponse.json({ error: 'raceId, driverA, driverB required' }, { status: 400 })
  }

  const [drvA, drvB] = await Promise.all([
    db.driver.findFirst({ where: { code: driverA } }),
    db.driver.findFirst({ where: { code: driverB } }),
  ])
  if (!drvA || !drvB) {
    return NextResponse.json({ error: 'Driver not found' }, { status: 404 })
  }

  const [telA, telB] = await Promise.all([
    db.telemetry.findMany({
      where: { raceId, driverId: drvA.id },
      orderBy: { lap: 'asc' },
      include: { compound: true },
    }),
    db.telemetry.findMany({
      where: { raceId, driverId: drvB.id },
      orderBy: { lap: 'asc' },
      include: { compound: true },
    }),
  ])

  // Build lap-by-lap comparison
  const maxLaps = Math.max(telA.length, telB.length)
  const laps = []
  let cumA = 0, cumB = 0
  for (let i = 0; i < maxLaps; i++) {
    const a = telA[i]
    const b = telB[i]
    if (a) cumA += a.lapTime
    if (b) cumB += b.lapTime
    laps.push({
      lap: i + 1,
      driverA: a ? {
        lapTime: a.lapTime,
        tirePerf: a.tirePerformance,
        tireAge: 0, // would need stint calc
        compound: a.compound?.name,
        tireTemp: (a.tireTempFL + a.tireTempFR + a.tireTempRL + a.tireTempRR) / 4,
        fuelLoad: a.fuelLoad,
        speedTrap: a.speedTrap,
      } : null,
      driverB: b ? {
        lapTime: b.lapTime,
        tirePerf: b.tirePerformance,
        compound: b.compound?.name,
        tireTemp: (b.tireTempFL + b.tireTempFR + b.tireTempRL + b.tireTempRR) / 4,
        fuelLoad: b.fuelLoad,
        speedTrap: b.speedTrap,
      } : null,
      deltaLap: (a && b) ? a.lapTime - b.lapTime : null,
      deltaCum: cumA - cumB,
    })
  }

  // Summary stats
  const aLapTimes = telA.map(t => t.lapTime)
  const bLapTimes = telB.map(t => t.lapTime)
  const aAvg = aLapTimes.reduce((s, v) => s + v, 0) / aLapTimes.length
  const bAvg = bLapTimes.reduce((s, v) => s + v, 0) / bLapTimes.length
  const aBest = Math.min(...aLapTimes)
  const bBest = Math.min(...bLapTimes)
  const aAvgPerf = telA.reduce((s, t) => s + t.tirePerformance, 0) / telA.length
  const bAvgPerf = telB.reduce((s, t) => s + t.tirePerformance, 0) / telB.length
  const aSpeed = telA.reduce((s, t) => s + t.speedTrap, 0) / telA.length
  const bSpeed = telB.reduce((s, t) => s + t.speedTrap, 0) / telB.length

  // Count wins per driver
  let aWins = 0, bWins = 0
  for (const l of laps) {
    if (l.deltaLap !== null && l.deltaLap < 0) aWins++
    else if (l.deltaLap !== null && l.deltaLap > 0) bWins++
  }

  // Performance curve series
  const perfSeriesA = {
    id: driverA,
    name: `${driverA} · ${drvA.name}`,
    color: drvA.team === 'Apex Racing' ? '#ef4444' : '#06b6d4',
    points: telA.map((t, i) => ({ x: i + 1, y: t.tirePerformance })),
  }
  const perfSeriesB = {
    id: driverB,
    name: `${driverB} · ${drvB.name}`,
    color: drvB.team === 'Apex Racing' ? '#ef4444' : '#a855f7',
    points: telB.map((t, i) => ({ x: i + 1, y: t.tirePerformance })),
  }
  const lapTimeSeriesA = {
    id: `lt-${driverA}`,
    name: driverA,
    color: perfSeriesA.color,
    points: telA.map((t, i) => ({ x: i + 1, y: t.lapTime })),
  }
  const lapTimeSeriesB = {
    id: `lt-${driverB}`,
    name: driverB,
    color: perfSeriesB.color,
    points: telB.map((t, i) => ({ x: i + 1, y: t.lapTime })),
  }

  // Delta chart (cumulative)
  const deltaSeries = {
    id: 'delta',
    name: `Δ ${driverA} vs ${driverB}`,
    color: '#f59e0b',
    points: laps.filter(l => l.driverA && l.driverB).map(l => ({ x: l.lap, y: l.deltaCum })),
  }

  return NextResponse.json({
    driverA: { ...drvA, avgLapTime: aAvg, bestLap: aBest, avgPerf: aAvgPerf, avgSpeed: aSpeed, lapsLed: aWins },
    driverB: { ...drvB, avgLapTime: bAvg, bestLap: bBest, avgPerf: bAvgPerf, avgSpeed: bSpeed, lapsLed: bWins },
    laps,
    perfSeries: [perfSeriesA, perfSeriesB],
    lapTimeSeries: [lapTimeSeriesA, lapTimeSeriesB],
    deltaSeries,
    summary: {
      totalLaps: maxLaps,
      avgDelta: aAvg - bAvg,
      bestDelta: aBest - bBest,
      aWins,
      bWins,
      winner: aWins > bWins ? driverA : bWins > aWins ? driverB : 'TIE',
    },
  })
}
