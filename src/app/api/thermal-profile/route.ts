import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Thermal profile — tire temperature distribution across the 4 corners over laps
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const raceId = searchParams.get('raceId')
  const driverCode = searchParams.get('driverCode')

  if (!raceId) {
    return NextResponse.json({ error: 'raceId required' }, { status: 400 })
  }

  let driverFilter: any = {}
  if (driverCode) {
    const d = await db.driver.findFirst({ where: { code: driverCode } })
    if (d) driverFilter = { driverId: d.id }
  }

  const telemetry = await db.telemetry.findMany({
    where: { raceId, ...driverFilter },
    orderBy: { lap: 'asc' },
    include: { driver: true, compound: true },
    take: 300,
  })

  if (telemetry.length === 0) {
    return NextResponse.json({ error: 'No telemetry found' }, { status: 404 })
  }

  // Build per-lap 4-corner temp data
  const lapData = telemetry.map(t => ({
    lap: t.lap,
    driverCode: t.driver?.code,
    compound: t.compound?.name,
    corners: {
      FL: t.tireTempFL,
      FR: t.tireTempFR,
      RL: t.tireTempRL,
      RR: t.tireTempRR,
    },
    pressures: {
      FL: t.tirePressureFL,
      FR: t.tirePressureFR,
      RL: t.tirePressureRL,
      RR: t.tirePressureRR,
    },
    avgTemp: (t.tireTempFL + t.tireTempFR + t.tireTempRL + t.tireTempRR) / 4,
    perf: t.tirePerformance,
    slipFL: t.slipAngleFL,
    slipFR: t.slipAngleFR,
    brakeFL: t.brakeTempFL,
    brakeFR: t.brakeTempFR,
  }))

  // Compute thermal stats per corner
  const corners = ['FL', 'FR', 'RL', 'RR'] as const
  const cornerStats = corners.map(corner => {
    const temps = telemetry.map(t => t[`tireTemp${corner}`])
    const min = Math.min(...temps)
    const max = Math.max(...temps)
    const avg = temps.reduce((s, v) => s + v, 0) / temps.length
    const optimal = temps.filter(t => t >= 92 && t <= 105).length
    const overheating = temps.filter(t => t > 110).length
    const tooCold = temps.filter(t => t < 85).length
    return {
      corner,
      min: Math.round(min * 10) / 10,
      max: Math.round(max * 10) / 10,
      avg: Math.round(avg * 10) / 10,
      range: Math.round((max - min) * 10) / 10,
      optimalPct: Math.round((optimal / temps.length) * 100),
      overheatingPct: Math.round((overheating / temps.length) * 100),
      tooColdPct: Math.round((tooCold / temps.length) * 100),
    }
  })

  // Temperature distribution buckets for histogram
  const tempBuckets = Array.from({ length: 13 }, (_, i) => ({ temp: 70 + i * 5, count: 0 }))
  for (const t of telemetry) {
    const avg = (t.tireTempFL + t.tireTempFR + t.tireTempRL + t.tireTempRR) / 4
    const bucket = Math.floor((avg - 70) / 5)
    if (bucket >= 0 && bucket < tempBuckets.length) tempBuckets[bucket].count++
  }

  return NextResponse.json({
    lapData,
    cornerStats,
    tempHistogram: tempBuckets,
    driverCode: driverCode || telemetry[0]?.driver?.code,
    totalLaps: telemetry.length,
  })
}
