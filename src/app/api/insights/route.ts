import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Performance Insights — anomaly detection and pattern recognition across telemetry
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const raceId = searchParams.get('raceId')

  if (!raceId) {
    return NextResponse.json({ error: 'raceId required' }, { status: 400 })
  }

  const telemetry = await db.telemetry.findMany({
    where: { raceId },
    orderBy: { lap: 'asc' },
    include: { driver: true, compound: true },
  })

  if (telemetry.length === 0) {
    return NextResponse.json({ error: 'No telemetry' }, { status: 404 })
  }

  // Group by driver
  const driverMap = new Map<string, any[]>()
  for (const t of telemetry) {
    if (!driverMap.has(t.driver.code)) driverMap.set(t.driver.code, [])
    driverMap.get(t.driver.code)!.push(t)
  }

  const anomalies: any[] = []
  const insights: any[] = []

  for (const [code, laps] of driverMap.entries()) {
    const driver = laps[0].driver
    const lapTimes = laps.map(l => l.lapTime)
    const perfs = laps.map(l => l.tirePerformance)
    const temps = laps.map(l => (l.tireTempFL + l.tireTempFR + l.tireTempRL + l.tireTempRR) / 4)
    const slipFL = laps.map(l => l.slipAngleFL)
    const slipFR = laps.map(l => l.slipAngleFR)

    const avgLap = lapTimes.reduce((s, v) => s + v, 0) / lapTimes.length
    const avgPerf = perfs.reduce((s, v) => s + v, 0) / perfs.length
    const avgTemp = temps.reduce((s, v) => s + v, 0) / temps.length
    const stdLap = Math.sqrt(lapTimes.reduce((s, v) => s + (v - avgLap) ** 2, 0) / lapTimes.length)

    // Anomaly 1: Lap time spikes (> 2σ above avg)
    for (let i = 0; i < laps.length; i++) {
      if (lapTimes[i] > avgLap + 2 * stdLap) {
        anomalies.push({
          driverCode: code,
          lap: laps[i].lap,
          type: 'lap_spike',
          severity: 'warning',
          value: Math.round(lapTimes[i] * 1000) / 1000,
          expected: Math.round(avgLap * 1000) / 1000,
          delta: Math.round((lapTimes[i] - avgLap) * 1000) / 1000,
          message: `${code} lap ${laps[i].lap} time ${lapTimes[i].toFixed(3)}s is ${(lapTimes[i] - avgLap).toFixed(3)}s above average`,
        })
      }
    }

    // Anomaly 2: Performance drops below 85%
    for (let i = 0; i < laps.length; i++) {
      if (perfs[i] < 0.85) {
        anomalies.push({
          driverCode: code,
          lap: laps[i].lap,
          type: 'perf_critical',
          severity: 'critical',
          value: Math.round(perfs[i] * 1000) / 1000,
          message: `${code} performance dropped to ${(perfs[i] * 100).toFixed(1)}% at lap ${laps[i].lap}`,
        })
      }
    }

    // Anomaly 3: Tire temp overheating (>115°C)
    for (let i = 0; i < laps.length; i++) {
      if (temps[i] > 115) {
        anomalies.push({
          driverCode: code,
          lap: laps[i].lap,
          type: 'overheating',
          severity: 'critical',
          value: Math.round(temps[i] * 10) / 10,
          message: `${code} tire temp ${temps[i].toFixed(1)}°C exceeds 115°C at lap ${laps[i].lap}`,
        })
      }
    }

    // Anomaly 4: Slip angle spikes (>5°)
    for (let i = 0; i < laps.length; i++) {
      const avgSlip = (slipFL[i] + slipFR[i]) / 2
      if (avgSlip > 5) {
        anomalies.push({
          driverCode: code,
          lap: laps[i].lap,
          type: 'high_slip',
          severity: 'warning',
          value: Math.round(avgSlip * 100) / 100,
          message: `${code} slip angle ${avgSlip.toFixed(2)}° at lap ${laps[i].lap} — potential grip loss`,
        })
      }
    }

    // Insights per driver
    const bestLap = Math.min(...lapTimes)
    const worstLap = Math.max(...lapTimes)
    const consistency = stdLap
    const tempRange = Math.max(...temps) - Math.min(...temps)
    const perfDrop = perfs[0] - perfs[perfs.length - 1]

    insights.push({
      driverCode: code,
      driverName: driver.name,
      team: driver.team,
      isRB: driver.team === 'Apex Racing',
      laps: laps.length,
      avgLap: Math.round(avgLap * 1000) / 1000,
      bestLap: Math.round(bestLap * 1000) / 1000,
      worstLap: Math.round(worstLap * 1000) / 1000,
      consistency: Math.round(consistency * 1000) / 1000,
      avgPerf: Math.round(avgPerf * 1000) / 1000,
      avgTemp: Math.round(avgTemp * 10) / 10,
      tempRange: Math.round(tempRange * 10) / 10,
      perfDrop: Math.round(perfDrop * 1000) / 1000,
      anomalyCount: anomalies.filter(a => a.driverCode === code).length,
      rating: consistency < 0.3 && avgPerf > 0.88 ? 'excellent' : consistency < 0.5 ? 'good' : consistency < 0.8 ? 'fair' : 'poor',
    })
  }

  // Pattern detection across the field
  const fieldAvgLap = telemetry.reduce((s, t) => s + t.lapTime, 0) / telemetry.length
  const fieldAvgPerf = telemetry.reduce((s, t) => s + t.tirePerformance, 0) / telemetry.length

  // Compound performance summary
  const compoundMap = new Map<string, { laps: number[]; perfs: number[]; temps: number[] }>()
  for (const t of telemetry) {
    const comp = t.compound?.name || 'Unknown'
    if (!compoundMap.has(comp)) compoundMap.set(comp, { laps: [], perfs: [], temps: [] })
    compoundMap.get(comp)!.laps.push(t.lapTime)
    compoundMap.get(comp)!.perfs.push(t.tirePerformance)
    compoundMap.get(comp)!.temps.push((t.tireTempFL + t.tireTempFR + t.tireTempRL + t.tireTempRR) / 4)
  }

  const compoundStats = Array.from(compoundMap.entries()).map(([compound, data]) => ({
    compound,
    avgLap: Math.round((data.laps.reduce((s, v) => s + v, 0) / data.laps.length) * 1000) / 1000,
    avgPerf: Math.round((data.perfs.reduce((s, v) => s + v, 0) / data.perfs.length) * 1000) / 1000,
    avgTemp: Math.round((data.temps.reduce((s, v) => s + v, 0) / data.temps.length) * 10) / 10,
    sampleCount: data.laps.length,
  }))

  // Sort anomalies by severity then lap
  const sevOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 }
  anomalies.sort((a, b) => {
    const sa = sevOrder[a.severity] ?? 3
    const sb = sevOrder[b.severity] ?? 3
    if (sa !== sb) return sa - sb
    return a.lap - b.lap
  })

  return NextResponse.json({
    anomalies: anomalies.slice(0, 30),
    insights: insights.sort((a, b) => a.consistency - b.consistency),
    compoundStats,
    summary: {
      totalLaps: telemetry.length,
      totalDrivers: driverMap.size,
      totalAnomalies: anomalies.length,
      criticalCount: anomalies.filter(a => a.severity === 'critical').length,
      warningCount: anomalies.filter(a => a.severity === 'warning').length,
      fieldAvgLap: Math.round(fieldAvgLap * 1000) / 1000,
      fieldAvgPerf: Math.round(fieldAvgPerf * 1000) / 1000,
      bestDriver: insights.reduce((best, d) => d.consistency < best.consistency ? d : best, insights[0])?.driverCode,
      mostAnomalies: insights.reduce((most, d) => d.anomalyCount > most.anomalyCount ? d : most, insights[0])?.driverCode,
    },
  })
}
