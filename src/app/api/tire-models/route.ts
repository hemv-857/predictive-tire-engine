import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const activeOnly = searchParams.get('active') === 'true'

  const models = await db.tireModel.findMany({
    where: activeOnly ? { status: 'active' } : {},
    orderBy: { trainedAt: 'desc' },
    include: { _count: { select: { predictions: true } } },
  })

  return NextResponse.json({ models })
}
