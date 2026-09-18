import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const brief = await db.weeklyBrief.findFirst({
    orderBy: { weekOf: 'desc' },
  })
  return NextResponse.json({ brief })
}
