import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Model Drift Monitor — tracks prediction accuracy over time and detects drift
export async function GET() {
  // Get all predictions with actual values
  const predictions = await db.predictionLog.findMany({
    where: { actualPerf: { not: null } },
    orderBy: { timestamp: 'asc' },
    take: 500,
    include: { model: true, driver: true },
  })

  if (predictions.length === 0) {
    return NextResponse.json({ error: 'No predictions with actual values' }, { status: 404 })
  }

  // Group predictions by model version
  const byModel = new Map<string, any[]>()
  for (const p of predictions) {
    const v = p.model?.version || 'unknown'
    if (!byModel.has(v)) byModel.set(v, [])
    byModel.get(v)!.push(p)
  }

  const modelDrift = Array.from(byModel.entries()).map(([version, preds]) => {
    const errors = preds.map(p => Math.abs(p.predictedPerf - (p.actualPerf || 0)))
    const mae = errors.reduce((s, e) => s + e, 0) / errors.length
    const mse = errors.reduce((s, e) => s + e * e, 0) / errors.length
    const rmse = Math.sqrt(mse)
    const maxError = Math.max(...errors)
    // Binned accuracy: how many predictions are within ±0.02
    const within02 = errors.filter(e => e <= 0.02).length
    const within01 = errors.filter(e => e <= 0.01).length
    return {
      version,
      count: preds.length,
      mae: Math.round(mae * 10000) / 10000,
      rmse: Math.round(rmse * 10000) / 10000,
      maxError: Math.round(maxError * 10000) / 10000,
      accuracyWithin02: Math.round((within02 / preds.length) * 1000) / 10,
      accuracyWithin01: Math.round((within01 / preds.length) * 1000) / 10,
    }
  }).sort((a, b) => a.version.localeCompare(b.version))

  // Time-series: MAE over time (binned by 10 predictions)
  const binSize = 10
  const maeTimeline: { bin: number; mae: number; count: number; timestamp: string }[] = []
  for (let i = 0; i < predictions.length; i += binSize) {
    const bin = predictions.slice(i, i + binSize)
    const errors = bin.map(p => Math.abs(p.predictedPerf - (p.actualPerf || 0)))
    const mae = errors.reduce((s, e) => s + e, 0) / errors.length
    maeTimeline.push({
      bin: i / binSize + 1,
      mae: Math.round(mae * 10000) / 10000,
      count: bin.length,
      timestamp: String(bin[bin.length - 1].timestamp),
    })
  }

  // Error distribution histogram
  const errorBuckets = Array.from({ length: 10 }, (_, i) => ({ range: `${(i * 0.01).toFixed(2)}-${((i + 1) * 0.01).toFixed(2)}`, count: 0 }))
  for (const p of predictions) {
    const error = Math.abs(p.predictedPerf - (p.actualPerf || 0))
    const bucket = Math.min(9, Math.floor(error / 0.01))
    errorBuckets[bucket].count++
  }

  // Drift detection
  const baselineMAE = 0.015
  const recentMAE = maeTimeline.slice(-5).reduce((s, t) => s + t.mae, 0) / Math.min(5, maeTimeline.length)
  const driftRatio = recentMAE / baselineMAE
  const driftStatus = driftRatio > 2 ? 'critical' : driftRatio > 1.5 ? 'warning' : driftRatio > 1.2 ? 'elevated' : 'stable'

  // Per-driver error breakdown
  const byDriver = new Map<string, { errors: number[]; count: number }>()
  for (const p of predictions) {
    const code = p.driver?.code || 'unknown'
    if (!byDriver.has(code)) byDriver.set(code, { errors: [], count: 0 })
    byDriver.get(code)!.errors.push(Math.abs(p.predictedPerf - (p.actualPerf || 0)))
    byDriver.get(code)!.count++
  }
  const driverErrors = Array.from(byDriver.entries()).map(([code, data]) => ({
    driverCode: code,
    mae: Math.round((data.errors.reduce((s, e) => s + e, 0) / data.errors.length) * 10000) / 10000,
    count: data.count,
  })).sort((a, b) => b.mae - a.mae)

  return NextResponse.json({
    modelDrift,
    maeTimeline,
    errorBuckets,
    driverErrors,
    summary: {
      totalPredictions: predictions.length,
      baselineMAE,
      recentMAE: Math.round(recentMAE * 10000) / 10000,
      driftRatio: Math.round(driftRatio * 100) / 100,
      driftStatus,
      overallMAE: Math.round((predictions.reduce((s, p) => s + Math.abs(p.predictedPerf - (p.actualPerf || 0)), 0) / predictions.length) * 10000) / 10000,
    },
  })
}
