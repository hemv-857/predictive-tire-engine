import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  const races = await db.race.findMany({
    where: status ? { status } : {},
    orderBy: { date: 'asc' },
    include: {
      _count: { select: { telemetry: true, pitDecisions: true } },
    },
  })

  return NextResponse.json({ races })
}
