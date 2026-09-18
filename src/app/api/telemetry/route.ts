import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const raceId = searchParams.get('raceId')
  const driverId = searchParams.get('driverId')
  const driverCode = searchParams.get('driverCode')

  let driverFilter: any = {}
  if (driverId) driverFilter = { driverId }
  else if (driverCode) {
    const d = await db.driver.findFirst({ where: { code: driverCode } })
    if (d) driverFilter = { driverId: d.id }
  }

  const where: any = {}
  if (raceId) where.raceId = raceId
  if (Object.keys(driverFilter).length) where.AND = [driverFilter]

  const telemetry = await db.telemetry.findMany({
    where,
    orderBy: [{ lap: 'asc' }],
    include: { driver: true, compound: true, race: true },
    take: 500,
  })

  return NextResponse.json({ telemetry, count: telemetry.length })
}
