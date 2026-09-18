import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Pit Stop Performance Analyzer — analyzes pit stop times and trends across races
export async function GET() {
  const pitDecisions = await db.pitDecision.findMany({
    include: { driver: true, race: true },
    orderBy: { createdAt: 'desc' },
  })

  // Overall stats
  const total = pitDecisions.length
  const timingErrors = pitDecisions.filter(d => d.timingErrorLaps !== null).map(d => d.timingErrorLaps!)
  const avgError = timingErrors.length ? timingErrors.reduce((s, e) => s + e, 0) / timingErrors.length : 0
  const optimal = pitDecisions.filter(d => d.status === 'optimal').length
  const executed = pitDecisions.filter(d => d.status === 'executed').length
  const missed = pitDecisions.filter(d => d.status === 'missed').length
  const optimalRate = total ? optimal / total : 0

  // Per-driver breakdown
  const driverMap = new Map<string, { code: string; name: string; team: string; decisions: any[] }>()
  for (const d of pitDecisions) {
    if (!driverMap.has(d.driver.code)) {
      driverMap.set(d.driver.code, { code: d.driver.code, name: d.driver.name, team: d.driver.team, decisions: [] })
    }
    driverMap.get(d.driver.code)!.decisions.push(d)
  }

  const driverPerformance = Array.from(driverMap.values()).map(d => {
    const errors = d.decisions.filter(x => x.timingErrorLaps !== null).map(x => x.timingErrorLaps!)
    const opt = d.decisions.filter(x => x.status === 'optimal').length
    const exe = d.decisions.filter(x => x.status === 'executed').length
    const mis = d.decisions.filter(x => x.status === 'missed').length
    const avgErr = errors.length ? errors.reduce((s, e) => s + e, 0) / errors.length : 0
    const avgConf = d.decisions.reduce((s, x) => s + x.confidence, 0) / d.decisions.length
    return {
      code: d.code,
      name: d.name,
      team: d.team,
      isRB: d.team === 'Apex Racing',
      totalStops: d.decisions.length,
      avgError: Math.round(avgErr * 100) / 100,
      optimalCount: opt,
      executedCount: exe,
      missedCount: mis,
      optimalRate: d.decisions.length ? Math.round((opt / d.decisions.length) * 100) : 0,
      avgConfidence: Math.round(avgConf * 100) / 100,
      bestStop: Math.min(...errors.map(Math.abs)),
      worstStop: Math.max(...errors.map(Math.abs)),
    }
  }).sort((a, b) => a.avgError - b.avgError)

  // Per-race breakdown
  const raceMap = new Map<string, { race: any; decisions: any[] }>()
  for (const d of pitDecisions) {
    if (!raceMap.has(d.race.id)) {
      raceMap.set(d.race.id, { race: d.race, decisions: [] })
    }
    raceMap.get(d.race.id)!.decisions.push(d)
  }

  const racePerformance = Array.from(raceMap.values()).map(r => {
    const errors = r.decisions.filter(x => x.timingErrorLaps !== null).map(x => x.timingErrorLaps!)
    const opt = r.decisions.filter(x => x.status === 'optimal').length
    return {
      raceName: r.race.name,
      circuit: r.race.circuit,
      date: r.race.date,
      totalStops: r.decisions.length,
      avgError: errors.length ? Math.round((errors.reduce((s, e) => s + e, 0) / errors.length) * 100) / 100 : 0,
      optimalRate: r.decisions.length ? Math.round((opt / r.decisions.length) * 100) : 0,
      optimalCount: opt,
      executedCount: r.decisions.filter(x => x.status === 'executed').length,
      missedCount: r.decisions.filter(x => x.status === 'missed').length,
    }
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // Error distribution
  const errorBuckets = [
    { range: '0 (optimal)', min: 0, max: 0, count: 0, color: '#22c55e' },
    { range: '±1', min: 0.01, max: 1, count: 0, color: '#a3e635' },
    { range: '±2', min: 1.01, max: 2, count: 0, color: '#f59e0b' },
    { range: '±3', min: 2.01, max: 3, count: 0, color: '#f97316' },
    { range: '>3', min: 3.01, max: 99, count: 0, color: '#ef4444' },
  ]
  for (const e of timingErrors.map(Math.abs)) {
    for (const b of errorBuckets) {
      if (e >= b.min && e <= b.max) { b.count++; break }
    }
  }

  // Time saved/lost calculation
  const totalTimeLost = timingErrors.reduce((s, e) => s + Math.abs(e) * 0.3, 0) // ~0.3s per lap of error

  return NextResponse.json({
    driverPerformance,
    racePerformance,
    errorBuckets,
    summary: {
      totalStops: total,
      avgTimingError: Math.round(avgError * 100) / 100,
      optimalRate: Math.round(optimalRate * 1000) / 10,
      optimalCount: optimal,
      executedCount: executed,
      missedCount: missed,
      totalTimeLost: Math.round(totalTimeLost * 10) / 10,
      bestDriver: driverPerformance[0]?.code,
      bestDriverError: driverPerformance[0]?.avgError,
    },
  })
}
