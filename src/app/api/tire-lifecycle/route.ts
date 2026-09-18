import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Tire Lifecycle Timeline — tracks a single driver's tire usage through the race
// Shows stint boundaries, compound transitions, and performance degradation over time
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
    include: { compound: true },
  })

  if (telemetry.length === 0) {
    return NextResponse.json({ error: 'No telemetry' }, { status: 404 })
  }

  // Detect stint boundaries (compound changes)
  const stints: { startLap: number; endLap: number; compound: string; compoundColor: string; laps: any[] }[] = []
  let currentStint: any = null
  for (const t of telemetry) {
    const compoundName = t.compound?.name || 'Unknown'
    if (!currentStint || currentStint.compound !== compoundName) {
      currentStint = {
        startLap: t.lap,
        endLap: t.lap,
        compound: compoundName,
        compoundColor: t.compound?.color || '#888',
        laps: [],
      }
      stints.push(currentStint)
    }
    currentStint.endLap = t.lap
    currentStint.laps.push({
      lap: t.lap,
      tireAge: currentStint.laps.length + 1,
      tirePerformance: t.tirePerformance,
      lapTime: t.lapTime,
      avgTireTemp: (t.tireTempFL + t.tireTempFR + t.tireTempRL + t.tireTempRR) / 4,
      avgPressure: (t.tirePressureFL + t.tirePressureFR + t.tirePressureRL + t.tirePressureRR) / 4,
      fuelLoad: t.fuelLoad,
      slipAngle: (t.slipAngleFL + t.slipAngleFR) / 2,
      brakeTemp: (t.brakeTempFL + t.brakeTempFR) / 2,
    })
  }

  // Build timeline data with tire age
  const timeline = stints.map((s, si) => {
    const startPerf = s.laps[0]?.tirePerformance || 0
    const endPerf = s.laps[s.laps.length - 1]?.tirePerformance || 0
    const drop = startPerf - endPerf
    const avgPerf = s.laps.reduce((sum, l) => sum + l.tirePerformance, 0) / s.laps.length
    const peakLap = s.laps.reduce((best, l) => l.tirePerformance > best.tirePerformance ? l : best, s.laps[0])
    const worstLap = s.laps.reduce((worst, l) => l.tirePerformance < worst.tirePerformance ? l : worst, s.laps[0])
    return {
      stintNumber: si + 1,
      compound: s.compound,
      compoundColor: s.compoundColor,
      startLap: s.startLap,
      endLap: s.endLap,
      length: s.laps.length,
      startPerf,
      endPerf,
      drop: Math.round(drop * 1000) / 1000,
      dropPct: Math.round(drop * 1000) / 10,
      avgPerf: Math.round(avgPerf * 1000) / 1000,
      peakLap: peakLap?.lap,
      peakPerf: peakLap?.tirePerformance,
      worstLap: worstLap?.lap,
      worstPerf: worstLap?.tirePerformance,
      avgTireTemp: s.laps.reduce((s, l) => s + l.avgTireTemp, 0) / s.laps.length,
      laps: s.laps,
    }
  })

  // Performance curve series (tire age on x, performance on y)
  const perfSeries = timeline.map((s) => ({
    id: `stint-${s.stintNumber}`,
    name: `${s.compound} Stint ${s.stintNumber}`,
    color: s.compoundColor,
    points: s.laps.map((l) => ({ x: l.tireAge, y: l.tirePerformance })),
  }))

  // Lap time vs tire age
  const lapTimeSeries = timeline.map((s) => ({
    id: `lt-stint-${s.stintNumber}`,
    name: `${s.compound} Stint ${s.stintNumber}`,
    color: s.compoundColor,
    points: s.laps.map((l) => ({ x: l.tireAge, y: l.lapTime })),
  }))

  // Temperature vs tire age
  const tempSeries = timeline.map((s) => ({
    id: `temp-stint-${s.stintNumber}`,
    name: `${s.compound} Stint ${s.stintNumber}`,
    color: s.compoundColor,
    points: s.laps.map((l) => ({ x: l.tireAge, y: l.avgTireTemp })),
  }))

  // Overall summary
  const totalLaps = telemetry.length
  const totalDrop = timeline.reduce((s, st) => s + st.drop, 0)
  const avgStintLength = timeline.length ? totalLaps / timeline.length : 0

  return NextResponse.json({
    driver: { code: driver.code, name: driver.name, team: driver.team, number: driver.number },
    timeline,
    perfSeries,
    lapTimeSeries,
    tempSeries,
    summary: {
      totalLaps,
      totalStints: timeline.length,
      totalDrop: Math.round(totalDrop * 1000) / 1000,
      totalDropPct: Math.round(totalDrop * 1000) / 10,
      avgStintLength: Math.round(avgStintLength * 10) / 10,
      strategy: timeline.length === 1 ? 'one-stop' : timeline.length === 2 ? 'two-stop' : 'three-stop',
      compoundSequence: timeline.map(t => t.compound).join(' → '),
    },
  })
}
