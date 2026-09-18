import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Telemetry Channel Distributions — histogram data for all channels
export async function GET(request: Request) {
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
    include: { driver: true },
    take: 300,
  })

  if (telemetry.length === 0) {
    return NextResponse.json({ error: 'No telemetry' }, { status: 404 })
  }

  // Define channels with their ranges
  const channelDefs = [
    { id: 'tireTempFL', label: 'Tire Temp FL', unit: '°C', min: 70, max: 130, bucketSize: 5, color: '#ef4444', group: 'temp' },
    { id: 'tireTempFR', label: 'Tire Temp FR', unit: '°C', min: 70, max: 130, bucketSize: 5, color: '#f97316', group: 'temp' },
    { id: 'tireTempRL', label: 'Tire Temp RL', unit: '°C', min: 70, max: 130, bucketSize: 5, color: '#f59e0b', group: 'temp' },
    { id: 'tireTempRR', label: 'Tire Temp RR', unit: '°C', min: 70, max: 130, bucketSize: 5, color: '#fbbf24', group: 'temp' },
    { id: 'tirePressureFL', label: 'Pressure FL', unit: 'psi', min: 19, max: 26, bucketSize: 0.5, color: '#06b6d4', group: 'pressure' },
    { id: 'tirePressureFR', label: 'Pressure FR', unit: 'psi', min: 19, max: 26, bucketSize: 0.5, color: '#0891b2', group: 'pressure' },
    { id: 'slipAngleFL', label: 'Slip FL', unit: '°', min: 0, max: 8, bucketSize: 0.5, color: '#a855f7', group: 'slip' },
    { id: 'slipAngleFR', label: 'Slip FR', unit: '°', min: 0, max: 8, bucketSize: 0.5, color: '#c084fc', group: 'slip' },
    { id: 'brakeTempFL', label: 'Brake FL', unit: '°C', min: 350, max: 650, bucketSize: 25, color: '#f97316', group: 'brake' },
    { id: 'brakeTempFR', label: 'Brake FR', unit: '°C', min: 350, max: 650, bucketSize: 25, color: '#fb923c', group: 'brake' },
    { id: 'fuelLoad', label: 'Fuel Load', unit: 'kg', min: 0, max: 110, bucketSize: 10, color: '#84cc16', group: 'other' },
    { id: 'tirePerformance', label: 'Tire Perf', unit: '%', min: 0.45, max: 1.0, bucketSize: 0.05, color: '#22c55e', group: 'other' },
    { id: 'lapTime', label: 'Lap Time', unit: 's', min: 0, max: 0, bucketSize: 0.5, color: '#06b6d4', group: 'other' },
    { id: 'speedTrap', label: 'Speed Trap', unit: 'km/h', min: 280, max: 340, bucketSize: 5, color: '#3b82f6', group: 'other' },
  ]

  // Compute distributions per channel
  const distributions = channelDefs.map((ch) => {
    const values = telemetry.map(t => (t as any)[ch.id])
    
    // For lapTime, compute range dynamically
    let min = ch.min
    let max = ch.max
    if (ch.id === 'lapTime') {
      min = Math.floor(Math.min(...values) * 2) / 2
      max = Math.ceil(Math.max(...values) * 2) / 2
    }
    
    const bucketSize = ch.bucketSize
    const numBuckets = Math.ceil((max - min) / bucketSize)
    const buckets = Array(numBuckets).fill(0).map((_, i) => ({
      rangeStart: min + i * bucketSize,
      rangeEnd: min + (i + 1) * bucketSize,
      count: 0,
    }))

    for (const v of values) {
      let idx = Math.floor((v - min) / bucketSize)
      idx = Math.max(0, Math.min(numBuckets - 1, idx))
      buckets[idx].count++
    }

    // Statistics
    const sorted = [...values].sort((a, b) => a - b)
    const avg = values.reduce((s, v) => s + v, 0) / values.length
    const median = sorted[Math.floor(sorted.length / 2)]
    const p5 = sorted[Math.floor(sorted.length * 0.05)]
    const p95 = sorted[Math.floor(sorted.length * 0.95)]
    const std = Math.sqrt(values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length)
    const skewness = std > 0 ? values.reduce((s, v) => s + ((v - avg) / std) ** 3, 0) / values.length : 0

    // Optimal range assessment
    let optimal: { min: number; max: number; label: string; inRange: number }
    if (ch.group === 'temp') {
      optimal = { min: 92, max: 105, label: 'Optimal (92-105°C)', inRange: values.filter(v => v >= 92 && v <= 105).length }
    } else if (ch.group === 'pressure') {
      optimal = { min: 21.5, max: 23, label: 'Optimal (21.5-23 psi)', inRange: values.filter(v => v >= 21.5 && v <= 23).length }
    } else if (ch.group === 'slip') {
      optimal = { min: 0, max: 3, label: 'Optimal (0-3°)', inRange: values.filter(v => v >= 0 && v <= 3).length }
    } else if (ch.group === 'brake') {
      optimal = { min: 400, max: 550, label: 'Optimal (400-550°C)', inRange: values.filter(v => v >= 400 && v <= 550).length }
    } else if (ch.id === 'tirePerformance') {
      optimal = { min: 0.9, max: 1.0, label: 'Optimal (90-100%)', inRange: values.filter(v => v >= 0.9).length }
    } else {
      optimal = { min: avg - std, max: avg + std, label: `Normal (±1σ)`, inRange: values.filter(v => v >= avg - std && v <= avg + std).length }
    }

    return {
      ...ch,
      buckets,
      stats: {
        avg: Math.round(avg * 100) / 100,
        median: Math.round(median * 100) / 100,
        p5: Math.round(p5 * 100) / 100,
        p95: Math.round(p95 * 100) / 100,
        min: Math.round(Math.min(...values) * 100) / 100,
        max: Math.round(Math.max(...values) * 100) / 100,
        std: Math.round(std * 100) / 100,
        skewness: Math.round(skewness * 1000) / 1000,
        count: values.length,
        optimalPct: Math.round((optimal.inRange / values.length) * 1000) / 10,
      },
      optimal,
    }
  })

  // Group by channel group
  const groups: Record<string, any[]> = {}
  for (const d of distributions) {
    if (!groups[d.group]) groups[d.group] = []
    groups[d.group].push(d)
  }

  return NextResponse.json({
    distributions,
    groups: Object.entries(groups).map(([key, items]) => ({
      id: key,
      label: key.charAt(0).toUpperCase() + key.slice(1),
      channels: items.map(i => i.id),
    })),
    summary: {
      totalChannels: distributions.length,
      totalDataPoints: telemetry.length,
      driverCode: driverCode || telemetry[0]?.driver?.code,
      bestChannel: distributions.reduce((best, d) => d.stats.optimalPct > best.stats.optimalPct ? d : best, distributions[0]),
      worstChannel: distributions.reduce((worst, d) => d.stats.optimalPct < worst.stats.optimalPct ? d : worst, distributions[0]),
    },
  })
}
