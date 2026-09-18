import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const team = searchParams.get('team')
  const circuit = searchParams.get('circuit')

  const where: any = {}
  if (team) where.team = team
  if (circuit) where.circuit = { contains: circuit }

  const strategies = await db.competitorStrategy.findMany({
    where,
    orderBy: { weekOf: 'desc' },
    take: 200,
  })

  const byTeam = new Map<string, any>()
  for (const s of strategies) {
    if (!byTeam.has(s.team)) {
      byTeam.set(s.team, { team: s.team, count: 0, totalPitLap: 0, totalStint: 0, totalDeg: 0, totalPitStop: 0, totalPoints: 0 })
    }
    const t = byTeam.get(s.team)!
    t.count++
    t.totalPitLap += s.avgPitLap
    t.totalStint += s.stintLength
    t.totalDeg += s.degResistance
    t.totalPitStop += s.pitStopAvg
    t.totalPoints += s.pointsScored
  }
  const teamSummary = Array.from(byTeam.values()).map(t => ({
    team: t.team,
    count: t.count,
    avgPitLap: Math.round((t.totalPitLap / t.count) * 10) / 10,
    avgStintLength: Math.round((t.totalStint / t.count) * 10) / 10,
    avgDegResistance: Math.round((t.totalDeg / t.count) * 100) / 100,
    avgPitStopTime: Math.round((t.totalPitStop / t.count) * 100) / 100,
    totalPoints: t.totalPoints,
  })).sort((a, b) => b.totalPoints - a.totalPoints)

  const strategyCounts = strategies.reduce((acc, s) => {
    acc[s.tireStrategy] = (acc[s.tireStrategy] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return NextResponse.json({
    strategies,
    teamSummary,
    strategyDistribution: strategyCounts,
    total: strategies.length,
  })
}
