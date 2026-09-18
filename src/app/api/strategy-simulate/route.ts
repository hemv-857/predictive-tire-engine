import { NextRequest, NextResponse } from 'next/server'

// Strategy Simulator — projects race outcome for a given strategy
// Inputs: compound sequence, pit laps, track temp, fuel, total laps
// Outputs: projected lap times, positions, total time, performance curve
interface SimRequest {
  totalLaps: number
  trackTemp: number
  airTemp: number
  fuelStart: number
  stints: { compound: string; pitLap: number }[] // pitLap = lap to switch FROM this compound
}

const COMPOUND_DEG: Record<string, { deg: number; life: number; color: string; baseLap: number }> = {
  Soft: { deg: 0.045, life: 18, color: '#ef4444', baseLap: 90.5 },
  Medium: { deg: 0.028, life: 28, color: '#f59e0b', baseLap: 91.2 },
  Hard: { deg: 0.017, life: 40, color: '#e2e8f0', baseLap: 92.0 },
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

export async function POST(request: NextRequest) {
  try {
    const body: SimRequest = await request.json()
    const { totalLaps, trackTemp, fuelStart, stints } = body

    if (!stints || stints.length === 0) {
      return NextResponse.json({ error: 'No stints provided' }, { status: 400 })
    }

    const L = Math.min(Math.max(Number(totalLaps) || 58, 1), 200)

    const laps: any[] = []
    let cumulativeTime = 0
    let currentStintIdx = 0
    let tireAge = 0
    let pitStops = 0
    let totalPitTime = 0
    const PIT_LOSS = 22 // seconds lost in pit lane

    for (let lap = 1; lap <= L; lap++) {
      const stint = stints[currentStintIdx]
      if (!stint) break

      // Check if we should pit at end of this lap
      if (currentStintIdx < stints.length - 1 && lap >= stint.pitLap) {
        pitStops++
        totalPitTime += PIT_LOSS
        cumulativeTime += PIT_LOSS
        currentStintIdx++
        tireAge = 0
      }

      const compound = stint.compound
      const cd = COMPOUND_DEG[compound]
      if (!cd) continue

      tireAge++
      const fuelLoad = Math.max(2, fuelStart - (lap - 1) * 1.85)

      // Performance model
      const lapsFactor = Math.pow(tireAge / cd.life, 1.4)
      const basePerf = 1 - cd.deg * lapsFactor
      const tempPenalty = Math.abs(97 - trackTemp) / 100 * 0.08
      const slipPenalty = Math.max(0, (tireAge * 0.08 + 2.5) - 3) * 0.012
      const fuelPenalty = (fuelLoad / 110) * 0.03
      const trackTempPenalty = trackTemp > 45 ? 0.04 : 0
      const perf = clamp(basePerf - tempPenalty - slipPenalty - fuelPenalty - trackTempPenalty, 0.45, 1.0)

      // Lap time: base + perf delta + fuel effect
      const perfDelta = (1 - perf) * 3.2
      const fuelDelta = (fuelLoad / 110) * 1.5
      const lapTime = cd.baseLap + perfDelta + fuelDelta - 0.8

      cumulativeTime += lapTime

      laps.push({
        lap,
        compound,
        tireAge,
        fuelLoad: Math.round(fuelLoad * 10) / 10,
        tirePerformance: Math.round(perf * 1000) / 1000,
        lapTime: Math.round(lapTime * 1000) / 1000,
        cumulativeTime: Math.round(cumulativeTime * 1000) / 1000,
        isPitLap: lap === stint.pitLap && currentStintIdx < stints.length - 1,
        pitStopsSoFar: pitStops,
      })
    }

    // Generate performance curve series
    const perfCurve = laps.map((l) => ({ x: l.lap, y: l.tirePerformance }))
    const lapTimeCurve = laps.map((l) => ({ x: l.lap, y: l.lapTime }))

    // Per-stint breakdown
    const stintBreakdown = stints.map((s, i) => {
      const stintLaps = laps.filter((l) => l.compound === s.compound && (i === 0 || l.lap > stints[i - 1].pitLap) && l.lap <= s.pitLap)
      const avgPerf = stintLaps.length ? stintLaps.reduce((sum, l) => sum + l.tirePerformance, 0) / stintLaps.length : 0
      const startPerf = stintLaps[0]?.tirePerformance || 0
      const endPerf = stintLaps[stintLaps.length - 1]?.tirePerformance || 0
      return {
        stintNumber: i + 1,
        compound: s.compound,
        startLap: i === 0 ? 1 : stints[i - 1].pitLap + 1,
        endLap: s.pitLap,
        length: stintLaps.length,
        avgPerformance: Math.round(avgPerf * 1000) / 1000,
        performanceDrop: Math.round((startPerf - endPerf) * 1000) / 1000,
        color: COMPOUND_DEG[s.compound]?.color || '#888',
      }
    })

    // Assessment
    const totalTime = cumulativeTime
    const avgPerf = laps.reduce((s, l) => s + l.tirePerformance, 0) / laps.length
    const minPerf = Math.min(...laps.map((l) => l.tirePerformance))
    const lapsUnder90 = laps.filter((l) => l.tirePerformance < 0.9).length
    const lapsUnder85 = laps.filter((l) => l.tirePerformance < 0.85).length

    // Strategy rating
    let rating: string
    let ratingScore: number
    if (lapsUnder85 === 0 && pitStops <= 2 && avgPerf > 0.88) {
      rating = 'OPTIMAL'
      ratingScore = 95
    } else if (lapsUnder85 <= 2 && avgPerf > 0.85) {
      rating = 'STRONG'
      ratingScore = 82
    } else if (lapsUnder85 <= 5) {
      rating = 'ACCEPTABLE'
      ratingScore = 68
    } else {
      rating = 'RISKY'
      ratingScore = 45
    }

    // Comparison to baseline (2-stop S-M-M)
    const baselineTime = totalLaps * 91.5 + 2 * PIT_LOSS
    const deltaToBaseline = totalTime - baselineTime

    return NextResponse.json({
      laps,
      perfCurve,
      lapTimeCurve,
      stintBreakdown,
      summary: {
        totalTime: Math.round(totalTime * 1000) / 1000,
        totalLaps: laps.length,
        pitStops,
        totalPitTime,
        avgPerformance: Math.round(avgPerf * 1000) / 1000,
        minPerformance: Math.round(minPerf * 1000) / 1000,
        lapsUnder90,
        lapsUnder85,
        rating,
        ratingScore,
        deltaToBaseline: Math.round(deltaToBaseline * 1000) / 1000,
        baselineTime: Math.round(baselineTime * 1000) / 1000,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET returns preset strategies for quick comparison
export async function GET() {
  const presets = [
    {
      id: 'baseline',
      name: 'Baseline 2-Stop (S→M→M)',
      description: 'Standard two-stop: Soft start, two Medium stints',
      stints: [
        { compound: 'Soft', pitLap: 20 },
        { compound: 'Medium', pitLap: 42 },
        { compound: 'Medium', pitLap: 58 },
      ],
      color: '#22c55e',
    },
    {
      id: 'aggressive',
      name: 'Aggressive 3-Stop (S→S→M→M)',
      description: 'Three-stop undercut strategy, two Soft stints',
      stints: [
        { compound: 'Soft', pitLap: 16 },
        { compound: 'Soft', pitLap: 32 },
        { compound: 'Medium', pitLap: 48 },
        { compound: 'Medium', pitLap: 58 },
      ],
      color: '#ef4444',
    },
    {
      id: 'conservative',
      name: 'Conservative 1-Stop (M→H)',
      description: 'One-stop, Medium to Hard, long stints',
      stints: [
        { compound: 'Medium', pitLap: 30 },
        { compound: 'Hard', pitLap: 58 },
      ],
      color: '#06b6d4',
    },
    {
      id: 'soft-heavy',
      name: 'Soft-Heavy 2-Stop (S→S→M)',
      description: 'Two Soft stints for max pace, Medium to finish',
      stints: [
        { compound: 'Soft', pitLap: 18 },
        { compound: 'Soft', pitLap: 35 },
        { compound: 'Medium', pitLap: 58 },
      ],
      color: '#f59e0b',
    },
  ]
  return NextResponse.json({ presets, defaults: { totalLaps: 58, trackTemp: 32, airTemp: 21, fuelStart: 105 } })
}
