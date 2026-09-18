import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const [races, drivers, models, pitDecisions, predictions, competitors, brief] = await Promise.all([
    db.race.findMany({ orderBy: { date: 'asc' }, include: { _count: { select: { telemetry: true } } } }),
    db.driver.findMany(),
    db.tireModel.findMany({ orderBy: { trainedAt: 'desc' } }),
    db.pitDecision.findMany(),
    db.predictionLog.findMany({ where: { actualPerf: { not: null } } }),
    db.competitorStrategy.findMany(),
    db.weeklyBrief.findFirst({ orderBy: { weekOf: 'desc' } }),
  ])

  const activeModel = models.find(m => m.status === 'active') || models[0]
  const telemetryCount = races.reduce((sum, r) => sum + r._count.telemetry, 0)

  // Pit decision accuracy stats
  const timingErrors = pitDecisions.filter(d => d.timingErrorLaps !== null).map(d => d.timingErrorLaps!)
  const avgTimingError = timingErrors.length ? timingErrors.reduce((a, b) => a + b, 0) / timingErrors.length : 0
  const optimalRate = pitDecisions.length ? pitDecisions.filter(d => d.status === 'optimal').length / pitDecisions.length : 0

  // Prediction accuracy
  const mae = predictions.length
    ? predictions.reduce((sum, p) => sum + Math.abs(p.predictedPerf - (p.actualPerf || 0)), 0) / predictions.length
    : 0
  const avgInferenceMs = predictions.length
    ? predictions.reduce((sum, p) => sum + p.inferenceMs, 0) / predictions.length
    : 0

  // Model accuracy trend (last 5 versions)
  const accuracyTrend = models.slice(0, 5).reverse().map(m => ({
    version: m.version,
    accuracy: m.accuracy,
    f1Score: m.f1Score,
    trainedAt: m.trainedAt,
  }))

  return NextResponse.json({
    overview: {
      totalRaces: races.length,
      completedRaces: races.filter(r => r.status === 'completed').length,
      ongoingRace: races.find(r => r.status === 'ongoing') || null,
      upcomingRaces: races.filter(r => r.status === 'scheduled'),
      totalDrivers: drivers.length,
      totalTelemetryPoints: telemetryCount,
      totalModelVersions: models.length,
      activeModelVersion: activeModel?.version || null,
      activeModelAccuracy: activeModel?.accuracy || 0,
      totalPitDecisions: pitDecisions.length,
      avgTimingError: Math.round(avgTimingError * 100) / 100,
      optimalPitRate: Math.round(optimalRate * 1000) / 10,
      predictionMAE: Math.round(mae * 10000) / 10000,
      avgInferenceMs: Math.round(avgInferenceMs * 10) / 10,
      competitorRecords: competitors.length,
    },
    accuracyTrend,
    races,
    drivers,
    activeModel,
    weeklyBrief: brief,
  })
}
