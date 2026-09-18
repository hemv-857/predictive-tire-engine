import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Performance Forecast with Confidence Bands — projects tire performance
// forward with uncertainty quantification (P5/P50/P95 bands)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const raceId = searchParams.get('raceId')
  const driverCode = searchParams.get('driverCode')
  const forecastLaps = parseInt(searchParams.get('laps') || '15')

  if (!raceId) {
    return NextResponse.json({ error: 'raceId required' }, { status: 400 })
  }

  const race = await db.race.findUnique({ where: { id: raceId } })
  if (!race) return NextResponse.json({ error: 'Race not found' }, { status: 404 })

  let driver = null
  if (driverCode) {
    driver = await db.driver.findFirst({ where: { code: driverCode } })
  }
  if (!driver) {
    driver = await db.driver.findFirst({ where: { team: 'Apex Racing' } })
  }
  if (!driver) return NextResponse.json({ error: 'No driver' }, { status: 404 })

  const telemetry = await db.telemetry.findMany({
    where: { raceId, driverId: driver.id },
    orderBy: { lap: 'asc' },
    include: { compound: true },
  })

  if (telemetry.length === 0) {
    return NextResponse.json({ error: 'No telemetry' }, { status: 404 })
  }

  // Detect current stint
  const stints: { compound: string; laps: any[]; startLap: number }[] = []
  let current: any = null
  for (const t of telemetry) {
    const comp = t.compound?.name || 'Unknown'
    if (!current || current.compound !== comp) {
      current = { compound: comp, laps: [], startLap: t.lap }
      stints.push(current)
    }
    current.laps.push(t)
  }

  const currentStint = stints[stints.length - 1]
  const latest = telemetry[telemetry.length - 1]
  const tireAge = currentStint?.laps.length || 0

  const COMPOUND_DEG: Record<string, { deg: number; life: number }> = {
    Soft: { deg: 0.045, life: 18 },
    Medium: { deg: 0.028, life: 28 },
    Hard: { deg: 0.017, life: 40 },
  }
  const cd = COMPOUND_DEG[currentStint?.compound] || COMPOUND_DEG.Medium

  const avgTemp = (latest.tireTempFL + latest.tireTempFR + latest.tireTempRL + latest.tireTempRR) / 4
  const avgSlip = (latest.slipAngleFL + latest.slipAngleFR) / 2

  // Current performance
  const lapsFactor = Math.pow(tireAge / cd.life, 1.4)
  const basePerf = 1 - cd.deg * lapsFactor
  const tempPenalty = Math.abs(97 - avgTemp) / 100 * 0.08
  const slipPenalty = Math.max(0, avgSlip - 3) * 0.012
  const fuelPenalty = (latest.fuelLoad / 110) * 0.03
  const currentPerf = Math.max(0.45, basePerf - tempPenalty - slipPenalty - fuelPenalty)

  // Historical variance from past laps
  const historicalPerfs = currentStint.laps.map(l => l.tirePerformance)
  const histAvg = historicalPerfs.reduce((s, v) => s + v, 0) / historicalPerfs.length
  const histStd = Math.sqrt(historicalPerfs.reduce((s, v) => s + (v - histAvg) ** 2, 0) / historicalPerfs.length)

  // Monte Carlo forecast: project forward with uncertainty
  const numSims = 200
  const forecast: { lap: number; p5: number; p50: number; p95: number; mean: number }[] = []

  for (let lapAhead = 1; lapAhead <= forecastLaps; lapAhead++) {
    const futureAge = tireAge + lapAhead
    const futureFuel = Math.max(2, latest.fuelLoad - lapAhead * 1.85)
    const fFuelPenalty = (futureFuel / 110) * 0.03

    const perfs: number[] = []
    for (let sim = 0; sim < numSims; sim++) {
      // Randomized conditions
      const tempVar = avgTemp + (Math.random() - 0.5) * 8
      const slipVar = avgSlip + (Math.random() - 0.5) * 1.5
      const degVar = cd.deg * (0.9 + Math.random() * 0.2)
      const lifeVar = cd.life * (0.9 + Math.random() * 0.2)

      const futureLapsFactor = Math.pow(futureAge / lifeVar, 1.4)
      const fTempPenalty = Math.abs(97 - tempVar) / 100 * 0.08
      const fSlipPenalty = Math.max(0, slipVar - 3) * 0.012
      const noise = (Math.random() - 0.5) * 0.01

      const futurePerf = Math.max(0.45, 1 - degVar * futureLapsFactor - fTempPenalty - fSlipPenalty - fFuelPenalty + noise)
      perfs.push(futurePerf)
    }

    perfs.sort((a, b) => a - b)
    const p5 = perfs[Math.floor(numSims * 0.05)]
    const p50 = perfs[Math.floor(numSims * 0.5)]
    const p95 = perfs[Math.floor(numSims * 0.95)]
    const mean = perfs.reduce((s, v) => s + v, 0) / numSims

    forecast.push({
      lap: latest.lap + lapAhead,
      p5: Math.round(p5 * 1000) / 1000,
      p50: Math.round(p50 * 1000) / 1000,
      p95: Math.round(p95 * 1000) / 1000,
      mean: Math.round(mean * 1000) / 1000,
    })
  }

  // Find when each threshold is crossed (P50)
  const thresholds = [
    { level: 0.95, label: '95% Performance', color: '#a3e635' },
    { level: 0.90, label: '90% (pit trigger)', color: '#f59e0b' },
    { level: 0.85, label: '85% Warning', color: '#f97316' },
    { level: 0.80, label: '80% Critical', color: '#ef4444' },
  ]
  const thresholdCrossings = thresholds.map(t => {
    const crossing = forecast.find(f => f.p50 < t.level)
    return {
      ...t,
      lap: crossing ? crossing.lap : null,
      lapsAhead: crossing ? crossing.lap - latest.lap : null,
    }
  })

  // Historical series for the chart
  const historicalSeries = {
    id: 'historical',
    name: 'Historical Performance',
    color: '#22c55e',
    points: telemetry.map(t => ({ x: t.lap, y: t.tirePerformance })),
  }

  // Forecast bands for the chart
  const p50Series = {
    id: 'p50',
    name: 'Forecast (P50)',
    color: '#f59e0b',
    points: forecast.map(f => ({ x: f.lap, y: f.p50 })),
  }
  const p5Series = {
    id: 'p5',
    name: 'P5 (worst case)',
    color: '#ef4444',
    dashed: true,
    points: forecast.map(f => ({ x: f.lap, y: f.p5 })),
  }
  const p95Series = {
    id: 'p95',
    name: 'P95 (best case)',
    color: '#22c55e',
    dashed: true,
    points: forecast.map(f => ({ x: f.lap, y: f.p95 })),
  }

  // Risk assessment
  const p50At90 = forecast.find(f => f.p50 < 0.90)
  const p5At90 = forecast.find(f => f.p5 < 0.90)
  const p95At90 = forecast.find(f => f.p95 < 0.90)
  
  let riskLevel: string
  let riskColor: string
  if (currentPerf < 0.85) {
    riskLevel = 'CRITICAL'
    riskColor = '#ef4444'
  } else if (p5At90 && p5At90.lap - latest.lap <= 2) {
    riskLevel = 'HIGH'
    riskColor = '#f97316'
  } else if (p50At90 && p50At90.lap - latest.lap <= 5) {
    riskLevel = 'MODERATE'
    riskColor = '#f59e0b'
  } else {
    riskLevel = 'LOW'
    riskColor = '#22c55e'
  }

  return NextResponse.json({
    driver: { code: driver.code, name: driver.name, team: driver.team },
    race: { name: race.name, totalLaps: race.lapsTotal },
    current: {
      lap: latest.lap,
      compound: currentStint?.compound,
      tireAge,
      currentPerf: Math.round(currentPerf * 1000) / 1000,
      avgTemp: Math.round(avgTemp * 10) / 10,
      avgSlip: Math.round(avgSlip * 100) / 100,
      fuelLoad: latest.fuelLoad,
      histStd: Math.round(histStd * 1000) / 1000,
    },
    forecast,
    thresholdCrossings,
    series: {
      historical: historicalSeries,
      p50: p50Series,
      p5: p5Series,
      p95: p95Series,
    },
    risk: { level: riskLevel, color: riskColor },
    summary: {
      forecastLaps,
      simulations: numSims,
      nextThreshold90: p50At90 ? { lap: p50At90.lap, lapsAhead: p50At90.lap - latest.lap } : null,
      uncertaintyRange: forecast.length > 0 ? Math.round((forecast[0].p95 - forecast[0].p5) * 1000) : 0,
    },
  })
}
