import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const raceId = searchParams.get('raceId')

  const where: any = {}
  if (raceId) where.raceId = raceId

  const predictions = await db.predictionLog.findMany({
    where,
    orderBy: { timestamp: 'desc' },
    include: { driver: true, race: true, model: true },
    take: 200,
  })

  const withActual = predictions.filter(p => p.actualPerf !== null)
  const mae = withActual.length
    ? withActual.reduce((sum, p) => sum + Math.abs(p.predictedPerf - (p.actualPerf || 0)), 0) / withActual.length
    : 0
  const avgLatency = predictions.length
    ? predictions.reduce((sum, p) => sum + p.inferenceMs, 0) / predictions.length
    : 0

  return NextResponse.json({
    predictions,
    stats: {
      total: predictions.length,
      withActual: withActual.length,
      mae: Math.round(mae * 10000) / 10000,
      avgLatencyMs: Math.round(avgLatency * 10) / 10,
    },
  })
}
