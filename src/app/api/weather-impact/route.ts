import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Weather Impact Analyzer — how track/air temp & humidity affect tire performance
export async function GET() {
  const races = await db.race.findMany({
    where: { status: 'completed' },
    include: {
      telemetry: {
        include: { compound: true, driver: true },
        take: 50,
      },
    },
  })

  // Aggregate telemetry by track temp bucket
  const tempBuckets: Record<number, { temps: number[]; perfs: number[]; lapTimes: number[]; count: number }> = {}
  for (const race of races) {
    const bucket = Math.floor(race.trackTemp / 5) * 5
    if (!tempBuckets[bucket]) tempBuckets[bucket] = { temps: [], perfs: [], lapTimes: [], count: 0 }
    for (const t of race.telemetry) {
      const avgTemp = (t.tireTempFL + t.tireTempFR + t.tireTempRL + t.tireTempRR) / 4
      tempBuckets[bucket].temps.push(avgTemp)
      tempBuckets[bucket].perfs.push(t.tirePerformance)
      tempBuckets[bucket].lapTimes.push(t.lapTime)
      tempBuckets[bucket].count++
    }
  }

  const tempImpact = Object.entries(tempBuckets).map(([bucket, data]) => ({
    trackTempBucket: +bucket,
    avgTireTemp: data.temps.reduce((s, v) => s + v, 0) / data.temps.length,
    avgPerf: data.perfs.reduce((s, v) => s + v, 0) / data.perfs.length,
    avgLapTime: data.lapTimes.reduce((s, v) => s + v, 0) / data.lapTimes.length,
    count: data.count,
  })).sort((a, b) => a.trackTempBucket - b.trackTempBucket)

  // Humidity impact
  const humidityBuckets: Record<string, { perfs: number[]; lapTimes: number[] }> = {}
  for (const race of races) {
    const bucket = race.humidity < 40 ? 'Dry (<40%)' : race.humidity < 60 ? 'Moderate (40-60%)' : 'Humid (>60%)'
    if (!humidityBuckets[bucket]) humidityBuckets[bucket] = { perfs: [], lapTimes: [] }
    for (const t of race.telemetry) {
      humidityBuckets[bucket].perfs.push(t.tirePerformance)
      humidityBuckets[bucket].lapTimes.push(t.lapTime)
    }
  }
  const humidityImpact = Object.entries(humidityBuckets).map(([label, data]) => ({
    label,
    avgPerf: data.perfs.reduce((s, v) => s + v, 0) / data.perfs.length,
    avgLapTime: data.lapTimes.reduce((s, v) => s + v, 0) / data.lapTimes.length,
    count: data.perfs.length,
  }))

  // Per-circuit weather summary
  const circuitWeather = races.map(r => {
    const avgPerf = r.telemetry.reduce((s, t) => s + t.tirePerformance, 0) / r.telemetry.length
    const avgTemp = r.telemetry.reduce((s, t) => s + (t.tireTempFL + t.tireTempFR + t.tireTempRL + t.tireTempRR) / 4, 0) / r.telemetry.length
    return {
      circuit: r.circuit,
      raceName: r.name,
      trackTemp: r.trackTemp,
      airTemp: r.airTemp,
      humidity: r.humidity,
      avgTireTemp: avgTemp,
      avgPerf,
      optimal: avgTemp >= 92 && avgTemp <= 105,
    }
  })

  // Optimal window analysis
  const optimalTemps = tempImpact.filter(t => t.trackTempBucket >= 90 && t.trackTempBucket <= 110)
  const optimalAvgPerf = optimalTemps.length ? optimalTemps.reduce((s, t) => s + t.avgPerf, 0) / optimalTemps.length : 0

  return NextResponse.json({
    tempImpact,
    humidityImpact,
    circuitWeather,
    summary: {
      totalDataPoints: tempImpact.reduce((s, t) => s + t.count, 0),
      optimalTrackTempRange: '90-110°C',
      optimalAvgPerf: Math.round(optimalAvgPerf * 1000) / 1000,
      bestTrackTemp: tempImpact.reduce((best, t) => t.avgPerf > (best?.avgPerf || 0) ? t : best, tempImpact[0])?.trackTempBucket,
      worstTrackTemp: tempImpact.reduce((worst, t) => t.avgPerf < (worst?.avgPerf || 1) ? t : worst, tempImpact[0])?.trackTempBucket,
    },
  })
}
