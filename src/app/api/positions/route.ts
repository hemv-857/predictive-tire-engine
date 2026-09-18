import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Returns lap-by-lap position data for all drivers in a race
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const raceId = searchParams.get('raceId')
  const driverCodes = searchParams.get('drivers')?.split(',').filter(Boolean) || []

  if (!raceId) {
    return NextResponse.json({ error: 'raceId required' }, { status: 400 })
  }

  const race = await db.race.findUnique({ where: { id: raceId } })
  if (!race) {
    return NextResponse.json({ error: 'Race not found' }, { status: 404 })
  }

  const allDrivers = await db.driver.findMany()
  const targetDrivers = driverCodes.length
    ? allDrivers.filter((d) => driverCodes.includes(d.code))
    : allDrivers.slice(0, 6) // top 6 by default

  // Get all telemetry for this race
  const telemetry = await db.telemetry.findMany({
    where: { raceId, driverId: { in: targetDrivers.map((d) => d.id) } },
    orderBy: { lap: 'asc' },
  })

  // Group by lap, compute positions
  const lapsMap = new Map<number, any[]>()
  for (const t of telemetry) {
    if (!lapsMap.has(t.lap)) lapsMap.set(t.lap, [])
    lapsMap.get(t.lap)!.push(t)
  }

  const laps = Array.from(lapsMap.keys()).sort((a, b) => a - b)
  const driverSeries = targetDrivers.map((d) => {
    const driverLaps = telemetry.filter((t) => t.driverId === d.id).sort((a, b) => a.lap - b.lap)
    // Compute cumulative time and position per lap
    let cumTime = 0
    return {
      driverCode: d.code,
      driverName: d.name,
      team: d.team,
      color: d.team === 'Apex Racing' ? '#ef4444' : d.team === 'Red Bull Racing' ? '#1e3a8a' : d.team === 'Ferrari' ? '#dc2626' : d.team === 'Mercedes' ? '#22c55e' : d.team === 'McLaren' ? '#f97316' : '#a855f7',
      points: driverLaps.map((t) => {
        cumTime += t.lapTime
        return { lap: t.lap, lapTime: t.lapTime, cumTime, tirePerf: t.tirePerformance, compound: t.compoundId }
      }),
    }
  })

  // Compute positions per lap based on cumulative time
  for (const lap of laps) {
    const lapDrivers = driverSeries
      .map((ds) => ({ code: ds.driverCode, cumTime: ds.points.find((p) => p.lap === lap)?.cumTime }))
      .filter((x) => x.cumTime !== undefined)
      .sort((a, b) => (a.cumTime! - b.cumTime!))
    lapDrivers.forEach((ld, i) => {
      const ds = driverSeries.find((d) => d.driverCode === ld.code)!
      const pt = ds.points.find((p) => p.lap === lap)!
      pt.position = i + 1
    })
  }

  // Format for chart: position series per driver
  const positionSeries = driverSeries.map((ds) => ({
    id: ds.driverCode,
    name: `${ds.driverCode} · ${ds.driverName}`,
    color: ds.color,
    points: ds.points.map((p) => ({ x: p.lap, y: p.position, lapTime: p.lapTime, tirePerf: p.tirePerf })),
  }))

  // Lap time series
  const lapTimeSeries = driverSeries.map((ds) => ({
    id: `lt-${ds.driverCode}`,
    name: `${ds.driverCode}`,
    color: ds.color,
    points: ds.points.map((p) => ({ x: p.lap, y: p.lapTime })),
  }))

  // Final classification
  const finalOrder = driverSeries
    .map((ds) => ({
      driverCode: ds.driverCode,
      driverName: ds.driverName,
      team: ds.team,
      totalTime: ds.points[ds.points.length - 1]?.cumTime || 0,
      finalPosition: ds.points[ds.points.length - 1]?.position || 0,
      color: ds.color,
    }))
    .sort((a, b) => a.finalPosition - b.finalPosition)

  return NextResponse.json({
    race,
    positionSeries,
    lapTimeSeries,
    finalOrder,
    totalLaps: laps.length,
  })
}
