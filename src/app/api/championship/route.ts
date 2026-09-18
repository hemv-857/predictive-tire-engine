import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Championship Standings — aggregates points across all races
export async function GET() {
  const races = await db.race.findMany({
    where: { status: 'completed' },
    orderBy: { date: 'asc' },
    include: { pitDecisions: { include: { driver: true } } },
  })

  // Get all competitor strategies for points aggregation
  const strategies = await db.competitorStrategy.findMany({
    orderBy: { weekOf: 'desc' },
  })

  // Build driver championship
  const driverPoints = new Map<string, { code: string; name: string; team: string; points: number; races: number; bestFinish: number; avgFinish: number }>()
  
  for (const strat of strategies) {
    const key = strat.driver
    if (!driverPoints.has(key)) {
      driverPoints.set(key, { code: strat.driver, name: strat.driver, team: strat.team, points: 0, races: 0, bestFinish: 99, avgFinish: 0 })
    }
    const d = driverPoints.get(key)!
    d.points += strat.pointsScored
    d.races++
    d.bestFinish = Math.min(d.bestFinish, strat.finishPosition)
    d.avgFinish += strat.finishPosition
  }
  
  // Finalize avg finish
  for (const d of driverPoints.values()) {
    d.avgFinish = d.races > 0 ? d.avgFinish / d.races : 0
  }

  const driversChampionship = Array.from(driverPoints.values())
    .sort((a, b) => b.points - a.points)
    .map((d, i) => ({ position: i + 1, ...d, avgFinish: Math.round(d.avgFinish * 10) / 10 }))

  // Build constructor championship
  const constructorPoints = new Map<string, { team: string; points: number; races: number; bestFinish: number; podiums: number }>()
  
  for (const strat of strategies) {
    if (!constructorPoints.has(strat.team)) {
      constructorPoints.set(strat.team, { team: strat.team, points: 0, races: 0, bestFinish: 99, podiums: 0 })
    }
    const c = constructorPoints.get(strat.team)!
    c.points += strat.pointsScored
    c.races++
    c.bestFinish = Math.min(c.bestFinish, strat.finishPosition)
    if (strat.finishPosition <= 3) c.podiums++
  }

  const constructorsChampionship = Array.from(constructorPoints.values())
    .sort((a, b) => b.points - a.points)
    .map((c, i) => ({ position: i + 1, ...c }))

  // Per-race results summary
  const raceResults = races.map(race => {
    const raceStrats = strategies.filter(s => s.raceName === race.name)
    const winner = raceStrats.sort((a, b) => a.finishPosition - b.finishPosition)[0]
    return {
      raceName: race.name,
      circuit: race.circuit,
      date: race.date,
      winner: winner ? { team: winner.team, driver: winner.driver } : null,
      totalFinishers: raceStrats.length,
    }
  })

  // Season stats
  const totalPoints = driversChampionship.reduce((s, d) => s + d.points, 0)
  const totalRaces = races.length
  const leader = driversChampionship[0]
  const gapToSecond = driversChampionship.length > 1 ? driversChampionship[0].points - driversChampionship[1].points : 0

  return NextResponse.json({
    driversChampionship,
    constructorsChampionship,
    raceResults,
    summary: {
      totalRaces,
      totalDrivers: driversChampionship.length,
      totalConstructors: constructorsChampionship.length,
      totalPoints,
      leader: leader ? { code: leader.code, points: leader.points } : null,
      gapToSecond,
      constructorLeader: constructorsChampionship[0] ? { team: constructorsChampionship[0].team, points: constructorsChampionship[0].points } : null,
    },
  })
}
