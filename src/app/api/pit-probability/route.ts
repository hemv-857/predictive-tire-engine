import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Pit Window Probability Calculator — computes the probability distribution
// of the optimal pit lap based on tire degradation model + track conditions
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const raceId = searchParams.get('raceId')
  const driverCode = searchParams.get('driverCode')

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
  if (!driver) return NextResponse.json({ error: 'No driver found' }, { status: 404 })

  // Get driver's telemetry
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

  // Compute current performance
  const lapsFactor = Math.pow(tireAge / cd.life, 1.4)
  const basePerf = 1 - cd.deg * lapsFactor
  const tempPenalty = Math.abs(97 - avgTemp) / 100 * 0.08
  const slipPenalty = Math.max(0, avgSlip - 3) * 0.012
  const fuelPenalty = (latest.fuelLoad / 110) * 0.03
  const currentPerf = Math.max(0.45, basePerf - tempPenalty - slipPenalty - fuelPenalty)

  // Monte Carlo: vary conditions to get probability distribution of pit lap
  const numSims = 500
  const pitLapCounts: Record<number, number> = {}
  const totalLaps = race.lapsTotal

  for (let sim = 0; sim < numSims; sim++) {
    // Randomize conditions
    const tempVar = avgTemp + (Math.random() - 0.5) * 6
    const slipVar = avgSlip + (Math.random() - 0.5) * 1
    const fuelVar = latest.fuelLoad + (Math.random() - 0.5) * 10
    const degVar = cd.deg * (0.9 + Math.random() * 0.2)
    const lifeVar = cd.life * (0.9 + Math.random() * 0.2)

    // Project forward: find lap where perf drops below 0.90
    let projectedPitLap = latest.lap
    const tPenalty = Math.abs(97 - tempVar) / 100 * 0.08
    const sPenalty = Math.max(0, slipVar - 3) * 0.012
    const fPenalty = (fuelVar / 110) * 0.03
    const totalPenalty = tPenalty + sPenalty + fPenalty

    for (let futureAge = tireAge + 1; futureAge <= lifeVar + tireAge; futureAge++) {
      const futureLapsFactor = Math.pow(futureAge / lifeVar, 1.4)
      const futurePerf = Math.max(0.45, 1 - degVar * futureLapsFactor - totalPenalty)
      if (futurePerf < 0.90) {
        projectedPitLap = latest.lap + (futureAge - tireAge)
        break
      }
    }

    // Clamp to race length
    projectedPitLap = Math.min(projectedPitLap, totalLaps)
    pitLapCounts[projectedPitLap] = (pitLapCounts[projectedPitLap] || 0) + 1
  }

  // Convert to probability distribution
  const distribution = Object.entries(pitLapCounts)
    .map(([lap, count]) => ({
      lap: parseInt(lap),
      count,
      probability: Math.round((count / numSims) * 1000) / 10,
    }))
    .sort((a, b) => a.lap - b.lap)

  // Compute window statistics
  const laps = distribution.map(d => d.lap)
  const minLap = Math.min(...laps)
  const maxLap = Math.max(...laps)
  const weightedSum = distribution.reduce((s, d) => s + d.lap * d.count, 0)
  const totalCount = distribution.reduce((s, d) => s + d.count, 0)
  const meanLap = Math.round((weightedSum / totalCount) * 10) / 10

  // 80% confidence interval (10th to 90th percentile)
  const sortedLaps = distribution.flatMap(d => Array(d.count).fill(d.lap)).sort((a, b) => a - b)
  const p10 = sortedLaps[Math.floor(sortedLaps.length * 0.1)]
  const p50 = sortedLaps[Math.floor(sortedLaps.length * 0.5)]
  const p90 = sortedLaps[Math.floor(sortedLaps.length * 0.9)]

  // Most likely pit lap (highest probability)
  const mostLikely = distribution.reduce((max, d) => d.count > max.count ? d : max, distribution[0])

  // Urgency assessment
  const lapsToMostLikely = mostLikely.lap - latest.lap
  let urgency: string
  let urgencyColor: string
  if (lapsToMostLikely <= 0) {
    urgency = 'PIT NOW'
    urgencyColor = '#ef4444'
  } else if (lapsToMostLikely <= 2) {
    urgency = 'PREPARE'
    urgencyColor = '#f97316'
  } else if (lapsToMostLikely <= 5) {
    urgency = 'MONITOR'
    urgencyColor = '#f59e0b'
  } else {
    urgency = 'STABLE'
    urgencyColor = '#22c55e'
  }

  // Factors influencing the decision
  const factors = [
    {
      factor: 'Tire Temperature',
      value: `${avgTemp.toFixed(1)}°C`,
      impact: avgTemp > 110 ? 'negative' : avgTemp > 100 ? 'warning' : 'positive',
      description: avgTemp > 110 ? 'Overheating — accelerates degradation' : avgTemp > 100 ? 'Above optimal — monitor closely' : 'Within optimal window',
    },
    {
      factor: 'Slip Angle',
      value: `${avgSlip.toFixed(2)}°`,
      impact: avgSlip > 5 ? 'negative' : avgSlip > 3.5 ? 'warning' : 'positive',
      description: avgSlip > 5 ? 'High slip — grip loss imminent' : avgSlip > 3.5 ? 'Elevated — approaching threshold' : 'Healthy grip levels',
    },
    {
      factor: 'Fuel Load',
      value: `${latest.fuelLoad}kg`,
      impact: latest.fuelLoad > 90 ? 'warning' : 'positive',
      description: latest.fuelLoad > 90 ? 'Heavy fuel — more wear per lap' : 'Lighter car — less stress on tires',
    },
    {
      factor: 'Tire Age',
      value: `L${tireAge}`,
      impact: tireAge > cd.life * 0.7 ? 'negative' : tireAge > cd.life * 0.5 ? 'warning' : 'positive',
      description: tireAge > cd.life * 0.7 ? 'Past 70% of life — critical zone' : tireAge > cd.life * 0.5 ? 'Past 50% — monitor closely' : 'Fresh tire — plenty of life',
    },
    {
      factor: 'Track Temp',
      value: `${race.trackTemp}°C`,
      impact: race.trackTemp > 45 ? 'negative' : race.trackTemp > 35 ? 'warning' : 'positive',
      description: race.trackTemp > 45 ? 'Very hot track — high degradation' : race.trackTemp > 35 ? 'Warm track — moderate degradation' : 'Cool track — lower degradation',
    },
  ]

  return NextResponse.json({
    driver: { code: driver.code, name: driver.name, team: driver.team },
    race: { name: race.name, circuit: race.circuit, totalLaps },
    current: {
      lap: latest.lap,
      compound: currentStint?.compound,
      tireAge,
      avgTemp: Math.round(avgTemp * 10) / 10,
      avgSlip: Math.round(avgSlip * 100) / 100,
      fuelLoad: latest.fuelLoad,
      currentPerf: Math.round(currentPerf * 1000) / 1000,
    },
    distribution,
    window: {
      meanLap,
      medianLap: p50,
      p10,
      p90,
      range: `${minLap}-${maxLap}`,
      mostLikelyLap: mostLikely.lap,
      mostLikelyProb: mostLikely.probability,
      confidence80: `${p10}-${p90}`,
    },
    urgency: { level: urgency, color: urgencyColor, lapsToPit: lapsToMostLikely },
    factors,
    summary: {
      totalSimulations: numSims,
      recommendation: lapsToMostLikely <= 0
        ? `PIT NOW — tire past 90% threshold`
        : lapsToMostLikely <= 2
        ? `Prepare to pit at L${mostLikely.lap} (${mostLikely.probability}% probability)`
        : `Optimal pit window: L${p10}-L${p90} (most likely L${mostLikely.lap})`,
    },
  })
}
