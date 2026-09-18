import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const raceId = searchParams.get('raceId')
  const status = searchParams.get('status')

  const where: any = {}
  if (raceId) where.raceId = raceId
  if (status) where.status = status

  const decisions = await db.pitDecision.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { driver: true, race: true },
    take: 100,
  })

  const timingErrors = decisions.filter(d => d.timingErrorLaps !== null).map(d => d.timingErrorLaps!)
  const avgError = timingErrors.length ? timingErrors.reduce((a, b) => a + b, 0) / timingErrors.length : 0
  const optimalCount = decisions.filter(d => d.status === 'optimal').length
  const executedCount = decisions.filter(d => d.status === 'executed').length
  const missedCount = decisions.filter(d => d.status === 'missed').length

  return NextResponse.json({
    decisions,
    stats: {
      total: decisions.length,
      avgTimingError: Math.round(avgError * 100) / 100,
      optimalRate: decisions.length ? optimalCount / decisions.length : 0,
      executedRate: decisions.length ? executedCount / decisions.length : 0,
      missedRate: decisions.length ? missedCount / decisions.length : 0,
    },
  })
}
