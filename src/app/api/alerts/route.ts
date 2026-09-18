import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Alerts system — evaluates current system state and returns active alerts
export async function GET() {
  const alerts: any[] = []

  // 1. Check for critical tire states in recent predictions
  const recentCritical = await db.predictionLog.findMany({
    where: { predictedClass: 'critical', actualPerf: null },
    include: { driver: true, race: true },
    orderBy: { timestamp: 'desc' },
    take: 5,
  })
  for (const p of recentCritical) {
    alerts.push({
      id: `critical-${p.id}`,
      severity: 'critical',
      category: 'tire',
      title: `CRITICAL: ${p.driver?.code} tire below 80%`,
      message: `${p.driver?.name} predicted performance ${(p.predictedPerf * 100).toFixed(1)}% at lap ${p.lap}. Immediate pit stop recommended.`,
      timestamp: p.timestamp,
      driverCode: p.driver?.code,
      raceName: p.race?.name,
      action: 'PIT NOW',
    })
  }

  // 2. Check for warning states (85-90%)
  const recentWarnings = await db.predictionLog.findMany({
    where: { predictedClass: { in: ['warning_85', 'warning_90'] }, actualPerf: null },
    include: { driver: true, race: true },
    orderBy: { timestamp: 'desc' },
    take: 4,
  })
  for (const p of recentWarnings) {
    alerts.push({
      id: `warning-${p.id}`,
      severity: 'warning',
      category: 'tire',
      title: `${p.driver?.code} approaching pit window`,
      message: `${p.driver?.name} at ${(p.predictedPerf * 100).toFixed(1)}% (lap ${p.lap}). Performance delta crossing threshold.`,
      timestamp: p.timestamp,
      driverCode: p.driver?.code,
      raceName: p.race?.name,
      action: 'PREPARE PIT',
    })
  }

  // 3. Model drift detection — compare recent MAE to historical baseline
  const recentPreds = await db.predictionLog.findMany({
    where: { actualPerf: { not: null } },
    orderBy: { timestamp: 'desc' },
    take: 50,
  })
  if (recentPreds.length > 10) {
    const recentMAE = recentPreds.reduce((s, p) => s + Math.abs(p.predictedPerf - (p.actualPerf || 0)), 0) / recentPreds.length
    const baselineMAE = 0.015
    const driftRatio = recentMAE / baselineMAE
    if (driftRatio > 1.5) {
      alerts.push({
        id: 'drift-high',
        severity: 'critical',
        category: 'model',
        title: 'Model drift detected',
        message: `Recent MAE ${(recentMAE * 100).toFixed(2)}% is ${driftRatio.toFixed(1)}x the baseline (${(baselineMAE * 100).toFixed(2)}%). Retraining recommended.`,
        timestamp: new Date().toISOString(),
        action: 'RETRAIN MODEL',
      })
    } else if (driftRatio > 1.2) {
      alerts.push({
        id: 'drift-warn',
        severity: 'warning',
        category: 'model',
        title: 'Elevated prediction error',
        message: `Recent MAE ${(recentMAE * 100).toFixed(2)}% is ${driftRatio.toFixed(1)}x baseline. Monitor closely.`,
        timestamp: new Date().toISOString(),
        action: 'MONITOR',
      })
    }
  }

  // 4. Pit timing error anomalies
  const recentPitDecisions = await db.pitDecision.findMany({
    where: { status: 'missed' },
    include: { driver: true, race: true },
    orderBy: { createdAt: 'desc' },
    take: 3,
  })
  for (const d of recentPitDecisions) {
    alerts.push({
      id: `pit-missed-${d.id}`,
      severity: 'warning',
      category: 'strategy',
      title: `Missed pit window: ${d.driver?.code}`,
      message: `${d.driver?.name} pitted L${d.actualLap} vs recommended L${d.recommendedLap} (error ${d.timingErrorLaps} laps) at ${d.race?.name}.`,
      timestamp: d.createdAt,
      driverCode: d.driver?.code,
      raceName: d.race?.name,
      action: 'REVIEW',
    })
  }

  // 5. Service health checks
  try {
    const telemRes = await fetch('http://localhost:3003/health')
    if (!telemRes.ok) throw new Error('bad')
  } catch {
    alerts.push({
      id: 'svc-telem-down',
      severity: 'critical',
      category: 'system',
      title: 'Telemetry service unreachable',
      message: 'WebSocket telemetry service on port 3003 is not responding. Live data unavailable.',
      timestamp: new Date().toISOString(),
      action: 'RESTART SERVICE',
    })
  }
  try {
    const mlRes = await fetch('http://localhost:3004/health')
    if (!mlRes.ok) throw new Error('bad')
  } catch {
    alerts.push({
      id: 'svc-ml-down',
      severity: 'critical',
      category: 'system',
      title: 'ML prediction service unreachable',
      message: 'Prediction service on port 3004 is not responding. Inference unavailable.',
      timestamp: new Date().toISOString(),
      action: 'RESTART SERVICE',
    })
  }

  // 6. Competitor threat — rival pitting earlier than expected
  const competitorStrats = await db.competitorStrategy.findMany({
    where: { tireStrategy: 'three-stop' },
    orderBy: { weekOf: 'desc' },
    take: 2,
  })
  for (const c of competitorStrats) {
    alerts.push({
      id: `rival-aggressive-${c.id}`,
      severity: 'info',
      category: 'competitor',
      title: `${c.team} running aggressive strategy`,
      message: `${c.team} deployed three-stop at ${c.raceName}. Avg pit lap L${c.avgPitLap}. Consider counter-strategy.`,
      timestamp: c.weekOf,
      action: 'ANALYZE',
    })
  }

  const sevOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 }
  alerts.sort((a, b) => {
    const sa = sevOrder[a.severity] ?? 3
    const sb = sevOrder[b.severity] ?? 3
    if (sa !== sb) return sa - sb
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  })

  return NextResponse.json({
    alerts,
    stats: {
      total: alerts.length,
      critical: alerts.filter(a => a.severity === 'critical').length,
      warning: alerts.filter(a => a.severity === 'warning').length,
      info: alerts.filter(a => a.severity === 'info').length,
    },
  })
}
