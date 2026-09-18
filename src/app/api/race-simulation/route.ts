import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Race Simulation Engine — Monte Carlo simulation of race outcomes
// Runs N simulations with randomized variables to predict finish probability
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { raceId, simulations = 1000, strategies } = body

    if (!raceId) {
      return NextResponse.json({ error: 'raceId required' }, { status: 400 })
    }

    const race = await db.race.findUnique({ where: { id: raceId } })
    if (!race) return NextResponse.json({ error: 'Race not found' }, { status: 404 })

    const totalLaps = race.lapsTotal
    const numSims = Math.min(Math.max(simulations, 100), 5000)

    // Get RB drivers
    const rbDrivers = await db.driver.findMany({ where: { team: 'Apex Racing' } })
    const rivalDrivers = await db.driver.findMany({ where: { team: { not: 'Apex Racing' } } })

    // Default strategies if not provided
    const defaultStrategies = [
      { driverCode: 'TSU', stints: [{ compound: 'Soft', pitLap: 20 }, { compound: 'Medium', pitLap: 42 }, { compound: 'Medium', pitLap: totalLaps }] },
      { driverCode: 'LAW', stints: [{ compound: 'Soft', pitLap: 18 }, { compound: 'Medium', pitLap: 40 }, { compound: 'Medium', pitLap: totalLaps }] },
    ]
    const driverStrategies = strategies || defaultStrategies

    const COMPOUND_DEG: Record<string, { deg: number; life: number; baseLap: number }> = {
      Soft: { deg: 0.045, life: 18, baseLap: 90.5 },
      Medium: { deg: 0.028, life: 28, baseLap: 91.2 },
      Hard: { deg: 0.017, life: 40, baseLap: 92.0 },
    }
    const PIT_LOSS = 22 // seconds lost in pit lane

    // Rival baseline performance (from historical data)
    const rivalBaseTimes: Record<string, number> = {}
    for (const r of rivalDrivers.slice(0, 8)) {
      rivalBaseTimes[r.code] = 91.0 + Math.random() * 2 // 91-93s baseline
    }

    // Run Monte Carlo simulations
    const simResults: any[] = []
    const finishPositions: Record<string, number[]> = {} // driverCode -> [positions across sims]
    const finishTimes: Record<string, number[]> = {}

    for (let sim = 0; sim < numSims; sim++) {
      const raceResults: { driverCode: string; totalTime: number; isRB: boolean }[] = []

      // Simulate RB drivers with given strategies
      for (const strat of driverStrategies) {
        let totalTime = 0
        let currentStintIdx = 0
        let tireAge = 0
        const trackTempVariation = race.trackTemp + (Math.random() - 0.5) * 4
        const fuelStart = 105 + Math.random() * 5

        for (let lap = 1; lap <= totalLaps; lap++) {
          const stint = strat.stints[currentStintIdx]
          if (!stint) break

          if (currentStintIdx < strat.stints.length - 1 && lap >= stint.pitLap) {
            totalTime += PIT_LOSS + Math.random() * 0.5 // pit stop variance
            currentStintIdx++
            tireAge = 0
          }

          const compound = stint.compound
          const cd = COMPOUND_DEG[compound]
          tireAge++
          const fuelLoad = Math.max(2, fuelStart - (lap - 1) * 1.85)

          // Performance with randomness
          const lapsFactor = Math.pow(tireAge / cd.life, 1.4)
          const basePerf = 1 - cd.deg * lapsFactor
          const tempPenalty = Math.abs(97 - trackTempVariation) / 100 * 0.08
          const perfNoise = (Math.random() - 0.5) * 0.02
          const perf = Math.max(0.45, basePerf - tempPenalty + perfNoise)

          const perfDelta = (1 - perf) * 3.2
          const fuelDelta = (fuelLoad / 110) * 1.5
          const lapNoise = (Math.random() - 0.5) * 0.3
          const lapTime = cd.baseLap + perfDelta + fuelDelta - 0.8 + lapNoise

          totalTime += lapTime
        }

        raceResults.push({ driverCode: strat.driverCode, totalTime: Math.round(totalTime * 1000) / 1000, isRB: true })
      }

      // Simulate rivals with baseline + noise
      for (const [code, baseTime] of Object.entries(rivalBaseTimes)) {
        let totalTime = 0
        const numStops = Math.random() > 0.3 ? 2 : 1
        const pitLaps = numStops === 2 ? [20 + Math.floor(Math.random() * 8), 40 + Math.floor(Math.random() * 8)] : [30 + Math.floor(Math.random() * 10)]
        let pitIdx = 0
        for (let lap = 1; lap <= totalLaps; lap++) {
          if (pitIdx < pitLaps.length && lap === pitLaps[pitIdx]) {
            totalTime += PIT_LOSS + Math.random() * 0.5
            pitIdx++
          }
          const lapNoise = (Math.random() - 0.5) * 0.4
          totalTime += baseTime + lapNoise
        }
        raceResults.push({ driverCode: code, totalTime: Math.round(totalTime * 1000) / 1000, isRB: false })
      }

      // Sort by time to get positions
      raceResults.sort((a, b) => a.totalTime - b.totalTime)
      raceResults.forEach((r, i) => {
        if (!finishPositions[r.driverCode]) finishPositions[r.driverCode] = []
        if (!finishTimes[r.driverCode]) finishTimes[r.driverCode] = []
        finishPositions[r.driverCode].push(i + 1)
        finishTimes[r.driverCode].push(r.totalTime)
      })

      if (sim < 100) simResults.push(raceResults)
    }

    // Compute statistics
    const driverStats = Object.entries(finishPositions).map(([code, positions]) => {
      const times = finishTimes[code]
      const avgPos = positions.reduce((s, v) => s + v, 0) / positions.length
      const sortedPos = [...positions].sort((a, b) => a - b)
      const medianPos = sortedPos[Math.floor(sortedPos.length / 2)]
      const wins = positions.filter((p) => p === 1).length
      const podiums = positions.filter((p) => p <= 3).length
      const pointsFinishes = positions.filter((p) => p <= 10).length
      const bestPos = Math.min(...positions)
      const worstPos = Math.max(...positions)
      const avgTime = times.reduce((s, v) => s + v, 0) / times.length
      const driver = [...rbDrivers, ...rivalDrivers].find((d) => d.code === code)
      return {
        driverCode: code,
        driverName: driver?.name || code,
        team: driver?.team || 'Unknown',
        isRB: driver?.team === 'Apex Racing',
        avgPosition: Math.round(avgPos * 100) / 100,
        medianPosition: medianPos,
        bestPosition: bestPos,
        worstPosition: worstPos,
        winProbability: Math.round((wins / numSims) * 1000) / 10,
        podiumProbability: Math.round((podiums / numSims) * 1000) / 10,
        pointsProbability: Math.round((pointsFinishes / numSims) * 1000) / 10,
        avgTime: Math.round(avgTime * 1000) / 1000,
        posStd: Math.round(Math.sqrt(positions.reduce((s, v) => s + (v - avgPos) ** 2, 0) / positions.length) * 100) / 100,
      }
    }).sort((a, b) => a.avgPosition - b.avgPosition)

    // Position distribution for RB drivers
    const rbDistribution = driverStats.filter((d) => d.isRB).map((d) => {
      const positions = finishPositions[d.driverCode]
      const dist: Record<number, number> = {}
      for (let p = 1; p <= 10; p++) {
        dist[p] = positions.filter((pos) => pos === p).length
      }
      return {
        driverCode: d.driverCode,
        distribution: Object.entries(dist).map(([pos, count]) => ({
          position: +pos,
          count,
          probability: Math.round((count / numSims) * 1000) / 10,
        })),
      }
    })

    return NextResponse.json({
      simulations: numSims,
      totalLaps,
      driverStats,
      rbDistribution,
      sampleResults: simResults.slice(0, 20),
      summary: {
        totalDrivers: driverStats.length,
        rbWinProbability: driverStats.filter((d) => d.isRB).reduce((s, d) => s + d.winProbability, 0),
        rbPodiumProbability: driverStats.filter((d) => d.isRB).reduce((s, d) => s + d.podiumProbability, 0),
        mostLikelyWinner: driverStats[0]?.driverCode,
        mostLikelyWinnerProb: driverStats[0]?.winProbability,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET returns available strategies and defaults
export async function GET() {
  return NextResponse.json({
    defaults: {
      simulations: 1000,
      strategies: [
        { driverCode: 'TSU', stints: [{ compound: 'Soft', pitLap: 20 }, { compound: 'Medium', pitLap: 42 }, { compound: 'Medium', pitLap: 58 }] },
        { driverCode: 'LAW', stints: [{ compound: 'Soft', pitLap: 18 }, { compound: 'Medium', pitLap: 40 }, { compound: 'Medium', pitLap: 58 }] },
      ],
    },
    compoundInfo: {
      Soft: { deg: 0.045, life: 18, baseLap: 90.5, color: '#ef4444' },
      Medium: { deg: 0.028, life: 28, baseLap: 91.2, color: '#f59e0b' },
      Hard: { deg: 0.017, life: 40, baseLap: 92.0, color: '#e2e8f0' },
    },
  })
}
