import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const raceId = searchParams.get('raceId')
  const driverCode = searchParams.get('driverCode')

  const drivers = await db.driver.findMany({
    where: driverCode ? { code: driverCode } : {},
    orderBy: { number: 'asc' },
  })

  let result = drivers
  if (raceId) {
    const withTelemetry = await Promise.all(
      drivers.map(async (d) => {
        const count = await db.telemetry.count({ where: { raceId, driverId: d.id } })
        return count > 0 ? { ...d, telemetryCount: count } : null
      })
    )
    result = withTelemetry.filter(Boolean) as typeof drivers
  }

  return NextResponse.json({ drivers: result })
}
