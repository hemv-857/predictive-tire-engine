import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Live Strategy Recommender — combines live telemetry state with ML predictions
// to give real-time pit window recommendations for all Apex Racing drivers
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const raceId = searchParams.get('raceId')

  if (!raceId) {
    return NextResponse.json({ error: 'raceId required' }, { status: 400 })
  }

  const race = await db.race.findUnique({ where: { id: raceId } })
  if (!race) return NextResponse.json({ error: 'Race not found' }, { status: 404 })

  // Get all RB drivers' telemetry
  const rbDrivers = await db.driver.findMany({ where: { team: 'Apex Racing' } })
  const rivalDrivers = await db.driver.findMany({ where: { team: { not: 'Apex Racing' } } })

  const recommendations: any[] = []

  for (const driver of rbDrivers) {
    const telemetry = await db.telemetry.findMany({
      where: { raceId, driverId: driver.id },
      orderBy: { lap: 'asc' },
      include: { compound: true },
    })

    if (telemetry.length === 0) continue

    // Detect stints
    const stints: { compound: string; laps: any[]; startLap: number; endLap: number }[] = []
    let current: any = null
    for (const t of telemetry) {
      const comp = t.compound?.name || 'Unknown'
      if (!current || current.compound !== comp) {
        current = { compound: comp, laps: [], startLap: t.lap, endLap: t.lap }
        stints.push(current)
      }
      current.laps.push(t)
      current.endLap = t.lap
    }

    const currentStint = stints[stints.length - 1]
    const tireAge = currentStint?.laps.length || 0
    const latest = telemetry[telemetry.length - 1]
    const avgTemp = (latest.tireTempFL + latest.tireTempFR + latest.tireTempRL + latest.tireTempRR) / 4

    const compoundDeg: Record<string, number> = { Soft: 0.045, Medium: 0.028, Hard: 0.017 }
    const expectedLife: Record<string, number> = { Soft: 18, Medium: 28, Hard: 40 }
    const deg = compoundDeg[currentStint?.compound] || 0.04
    const life = expectedLife[currentStint?.compound] || 20

    // Project performance forward
    const lapsFactor = Math.pow(tireAge / life, 1.4)
    const currentPerf = Math.max(0.45, 1 - deg * lapsFactor)
    const tempPenalty = Math.abs(avgTemp - 97) / 100 * 0.08
    const slipPenalty = Math.max(0, (latest.slipAngleFL + latest.slipAngleFR) / 2 - 3) * 0.012
    const fuelPenalty = (latest.fuelLoad / 110) * 0.03
    const projectedPerf = Math.max(0.45, currentPerf - tempPenalty - slipPenalty - fuelPenalty)

    // Calculate laps until 90% threshold
    const penalties = tempPenalty + slipPenalty + fuelPenalty
    let lapsTo90: number
    if (projectedPerf < 0.90) {
      lapsTo90 = 0
    } else {
      const remaining = 1 - 0.90 - penalties
      lapsTo90 = remaining > 0 ? life * Math.pow(remaining / deg, 1 / 1.4) - tireAge : 0
      lapsTo90 = Math.max(0, lapsTo90)
    }

    // Determine recommendation
    let action: string
    let urgency: 'normal' | 'monitor' | 'prepare' | 'urgent' | 'critical'
    let color: string
    if (projectedPerf >= 0.95) {
      action = 'Continue stint — tire in peak window'
      urgency = 'normal'
      color = '#22c55e'
    } else if (projectedPerf >= 0.90) {
      action = 'Monitor — approaching pit window'
      urgency = 'monitor'
      color = '#a3e635'
    } else if (projectedPerf >= 0.85) {
      action = 'PREPARE PIT — 90% threshold crossed'
      urgency = 'prepare'
      color = '#f59e0b'
    } else if (projectedPerf >= 0.80) {
      action = 'PIT NOW — performance dropping rapidly'
      urgency = 'urgent'
      color = '#f97316'
    } else {
      action = 'PIT IMMEDIATELY — critical degradation'
      urgency = 'critical'
      color = '#ef4444'
    }

    // Pit window
    const currentLap = latest.lap
    const recommendedLap = currentLap + Math.max(1, Math.round(lapsTo90))
    const windowLow = Math.max(1, recommendedLap - 2)
    const windowHigh = recommendedLap + 2

    // Rival analysis — who's near us
    const rivalPositions: any[] = []
    for (const rival of rivalDrivers.slice(0, 5)) {
      const rivalTelem = await db.telemetry.findMany({
        where: { raceId, driverId: rival.id },
        orderBy: { lap: 'asc' },
      })
      if (rivalTelem.length > 0) {
        const rivalLatest = rivalTelem[rivalTelem.length - 1]
        const rivalCumTime = rivalTelem.reduce((s, t) => s + t.lapTime, 0)
        const driverCumTime = telemetry.reduce((s, t) => s + t.lapTime, 0)
        const gap = driverCumTime - rivalCumTime
        rivalPositions.push({
          driverCode: rival.code,
          team: rival.team,
          gap: Math.round(gap * 1000) / 1000,
          ahead: gap < 0,
          tireCompound: rivalLatest.compoundId,
        })
      }
    }

    // Build timeline data (past + projected performance)
    const timeline: { lap: number; actual?: number; projected?: number }[] = []
    for (const t of telemetry) {
      timeline.push({ lap: t.lap, actual: t.tirePerformance })
    }
    // Project forward 10 laps
    for (let i = 1; i <= 10; i++) {
      const futureAge = tireAge + i
      const futureLapsFactor = Math.pow(futureAge / life, 1.4)
      const futurePerf = Math.max(0.45, 1 - deg * futureLapsFactor - penalties)
      timeline.push({ lap: latest.lap + i, projected: futurePerf })
    }

    recommendations.push({
      driverCode: driver.code,
      driverName: driver.name,
      carNumber: driver.number,
      currentLap,
      tireAge,
      compound: currentStint?.compound,
      avgTemp: Math.round(avgTemp * 10) / 10,
      fuelLoad: latest.fuelLoad,
      currentPerf: Math.round(projectedPerf * 1000) / 1000,
      lapsTo90: Math.round(lapsTo90 * 10) / 10,
      action,
      urgency,
      color,
      pitWindow: { low: windowLow, recommended: recommendedLap, high: windowHigh },
      confidence: Math.round((0.85 + (1 - lapsTo90 / life) * 0.15) * 100) / 100,
      rivals: rivalPositions.sort((a, b) => Math.abs(a.gap) - Math.abs(b.gap)).slice(0, 3),
      timeline,
      stintCount: stints.length,
      stintHistory: stints.map((s, i) => ({
        stintNumber: i + 1,
        compound: s.compound,
        startLap: s.startLap,
        endLap: s.endLap,
        length: s.laps.length,
      })),
    })
  }

  // Race-level recommendation
  const urgentCount = recommendations.filter(r => r.urgency === 'urgent' || r.urgency === 'critical').length
  const prepareCount = recommendations.filter(r => r.urgency === 'prepare').length

  return NextResponse.json({
    race,
    recommendations,
    summary: {
      totalDrivers: recommendations.length,
      urgentCount,
      prepareCount,
      raceState: urgentCount > 0 ? 'CRITICAL' : prepareCount > 0 ? 'ACTIVE' : 'STABLE',
      nextPitWindow: recommendations
        .filter(r => r.lapsTo90 < 5)
        .sort((a, b) => a.lapsTo90 - b.lapsTo90)[0] || null,
    },
  })
}
