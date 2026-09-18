import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Sector Analysis — breaks down sector times per driver showing where they gain/lose time
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const raceId = searchParams.get('raceId')

  if (!raceId) {
    return NextResponse.json({ error: 'raceId required' }, { status: 400 })
  }

  const telemetry = await db.telemetry.findMany({
    where: { raceId },
    orderBy: { lap: 'asc' },
    include: { driver: true },
  })

  if (telemetry.length === 0) {
    return NextResponse.json({ error: 'No telemetry' }, { status: 404 })
  }

  // Group by driver
  const driverMap = new Map<string, any>()
  for (const t of telemetry) {
    if (!driverMap.has(t.driver.code)) {
      driverMap.set(t.driver.code, {
        code: t.driver.code,
        name: t.driver.name,
        team: t.driver.team,
        isRB: t.driver.team === 'Apex Racing',
        laps: [],
      })
    }
    driverMap.get(t.driver.code)!.laps.push({
      lap: t.lap,
      s1: t.sector1Time,
      s2: t.sector2Time,
      s3: t.sector3Time,
      total: t.lapTime,
      perf: t.tirePerformance,
      compound: t.compoundId,
    })
  }

  // Compute sector stats per driver
  const drivers = Array.from(driverMap.values()).map((d) => {
    const s1Times = d.laps.map((l: any) => l.s1)
    const s2Times = d.laps.map((l: any) => l.s2)
    const s3Times = d.laps.map((l: any) => l.s3)
    const totals = d.laps.map((l: any) => l.total)

    const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length
    const best = (arr: number[]) => Math.min(...arr)
    const consistency = (arr: number[], avgVal: number) => Math.sqrt(arr.reduce((s, v) => s + (v - avgVal) ** 2, 0) / arr.length)

    const s1Avg = avg(s1Times)
    const s2Avg = avg(s2Times)
    const s3Avg = avg(s3Times)
    const totalAvg = avg(totals)

    return {
      code: d.code,
      name: d.name,
      team: d.team,
      isRB: d.isRB,
      lapCount: d.laps.length,
      sectors: {
        s1: {
          avg: Math.round(s1Avg * 1000) / 1000,
          best: Math.round(best(s1Times) * 1000) / 1000,
          consistency: Math.round(consistency(s1Times, s1Avg) * 1000) / 1000,
          pctOfLap: Math.round((s1Avg / totalAvg) * 1000) / 10,
        },
        s2: {
          avg: Math.round(s2Avg * 1000) / 1000,
          best: Math.round(best(s2Times) * 1000) / 1000,
          consistency: Math.round(consistency(s2Times, s2Avg) * 1000) / 1000,
          pctOfLap: Math.round((s2Avg / totalAvg) * 1000) / 10,
        },
        s3: {
          avg: Math.round(s3Avg * 1000) / 1000,
          best: Math.round(best(s3Times) * 1000) / 1000,
          consistency: Math.round(consistency(s3Times, s3Avg) * 1000) / 1000,
          pctOfLap: Math.round((s3Avg / totalAvg) * 1000) / 10,
        },
      },
      totalAvg: Math.round(totalAvg * 1000) / 1000,
      totalBest: Math.round(best(totals) * 1000) / 1000,
      laps: d.laps,
    }
  })

  // Find fastest sector times overall (purple sectors)
  const allS1 = telemetry.map(t => t.sector1Time)
  const allS2 = telemetry.map(t => t.sector2Time)
  const allS3 = telemetry.map(t => t.sector3Time)
  const fastestS1 = Math.min(...allS1)
  const fastestS2 = Math.min(...allS2)
  const fastestS3 = Math.min(...allS3)

  // Per-lap sector leaders
  const laps = Array.from(new Set(telemetry.map(t => t.lap))).sort((a, b) => a - b)
  const lapLeaders = laps.map(lap => {
    const lapTelem = telemetry.filter(t => t.lap === lap)
    const s1Leader = lapTelem.reduce((best, t) => t.sector1Time < best.sector1Time ? t : best, lapTelem[0])
    const s2Leader = lapTelem.reduce((best, t) => t.sector2Time < best.sector2Time ? t : best, lapTelem[0])
    const s3Leader = lapTelem.reduce((best, t) => t.sector3Time < best.sector3Time ? t : best, lapTelem[0])
    const fastestLap = lapTelem.reduce((best, t) => t.lapTime < best.lapTime ? t : best, lapTelem[0])
    return {
      lap,
      s1Leader: { code: s1Leader.driver.code, time: Math.round(s1Leader.sector1Time * 1000) / 1000 },
      s2Leader: { code: s2Leader.driver.code, time: Math.round(s2Leader.sector2Time * 1000) / 1000 },
      s3Leader: { code: s3Leader.driver.code, time: Math.round(s3Leader.sector3Time * 1000) / 1000 },
      fastest: { code: fastestLap.driver.code, time: Math.round(fastestLap.lapTime * 1000) / 1000 },
    }
  })

  // Driver strengths — which sector each driver is best at relative to field
  const sectorStrengths = drivers.map(d => {
    const s1Rank = drivers.filter(d2 => d2.sectors.s1.avg < d.sectors.s1.avg).length + 1
    const s2Rank = drivers.filter(d2 => d2.sectors.s2.avg < d.sectors.s2.avg).length + 1
    const s3Rank = drivers.filter(d2 => d2.sectors.s3.avg < d.sectors.s3.avg).length + 1
    const bestSector = s1Rank <= s2Rank && s1Rank <= s3Rank ? 'S1' : s2Rank <= s3Rank ? 'S2' : 'S3'
    const worstSector = s1Rank >= s2Rank && s1Rank >= s3Rank ? 'S1' : s2Rank >= s3Rank ? 'S2' : 'S3'
    return {
      code: d.code,
      isRB: d.isRB,
      s1Rank,
      s2Rank,
      s3Rank,
      bestSector,
      worstSector,
    }
  })

  return NextResponse.json({
    drivers: drivers.sort((a, b) => a.totalAvg - b.totalAvg),
    lapLeaders,
    sectorStrengths,
    fastestSectors: {
      s1: Math.round(fastestS1 * 1000) / 1000,
      s2: Math.round(fastestS2 * 1000) / 1000,
      s3: Math.round(fastestS3 * 1000) / 1000,
    },
    totalLaps: laps.length,
    totalDrivers: drivers.length,
  })
}
