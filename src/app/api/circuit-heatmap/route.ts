import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Per-circuit strategy heatmap — aggregates competitor strategies by circuit
export async function GET() {
  const strategies = await db.competitorStrategy.findMany({
    orderBy: { weekOf: 'desc' },
  })

  // Get unique circuits
  const circuits = Array.from(new Set(strategies.map(s => s.circuit))).sort()

  // Get unique teams (exclude Apex Racing)
  const teams = Array.from(new Set(strategies.map(s => s.team))).filter(t => t !== 'Apex Racing').sort()

  // Build heatmap matrix: [circuit][team] = { avgPitLap, avgStint, count, dominantStrategy }
  const heatmap: { circuit: string; team: string; avgPitLap: number; avgStint: number; count: number; dominantStrategy: string; avgDeg: number }[] = []
  for (const circuit of circuits) {
    for (const team of teams) {
      const teamStrats = strategies.filter(s => s.circuit === circuit && s.team === team)
      if (teamStrats.length === 0) continue
      const avgPitLap = teamStrats.reduce((s, x) => s + x.avgPitLap, 0) / teamStrats.length
      const avgStint = teamStrats.reduce((s, x) => s + x.stintLength, 0) / teamStrats.length
      const avgDeg = teamStrats.reduce((s, x) => s + x.degResistance, 0) / teamStrats.length
      // Dominant strategy
      const stratCounts: Record<string, number> = {}
      for (const s of teamStrats) stratCounts[s.tireStrategy] = (stratCounts[s.tireStrategy] || 0) + 1
      const dominant = Object.entries(stratCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown'
      heatmap.push({
        circuit,
        team,
        avgPitLap: Math.round(avgPitLap * 10) / 10,
        avgStint: Math.round(avgStint * 10) / 10,
        count: teamStrats.length,
        dominantStrategy: dominant,
        avgDeg: Math.round(avgDeg * 100) / 100,
      })
    }
  }

  // Per-circuit summary
  const circuitSummary = circuits.map(circuit => {
    const cStrats = strategies.filter(s => s.circuit === circuit)
    const oneStop = cStrats.filter(s => s.tireStrategy === 'one-stop').length
    const twoStop = cStrats.filter(s => s.tireStrategy === 'two-stop').length
    const threeStop = cStrats.filter(s => s.tireStrategy === 'three-stop').length
    const avgPit = cStrats.reduce((s, x) => s + x.avgPitLap, 0) / cStrats.length
    return {
      circuit,
      raceName: cStrats[0]?.raceName || '',
      total: cStrats.length,
      avgPitLap: Math.round(avgPit * 10) / 10,
      strategyMix: { oneStop, twoStop, threeStop },
      dominantStrategy: oneStop >= twoStop && oneStop >= threeStop ? 'one-stop' : twoStop >= threeStop ? 'two-stop' : 'three-stop',
    }
  })

  return NextResponse.json({
    circuits,
    teams,
    heatmap,
    circuitSummary,
    metric: 'avgPitLap', // default metric
  })
}
