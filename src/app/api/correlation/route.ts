import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Telemetry Channel Correlation Matrix — Pearson correlation between all telemetry channels
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
    include: { driver: true, compound: true },
    take: 300,
  })

  if (telemetry.length === 0) {
    return NextResponse.json({ error: 'No telemetry' }, { status: 404 })
  }

  // Define channels
  const channels = [
    { id: 'tireTempFL', label: 'Temp FL', unit: '°C', group: 'temp' },
    { id: 'tireTempFR', label: 'Temp FR', unit: '°C', group: 'temp' },
    { id: 'tireTempRL', label: 'Temp RL', unit: '°C', group: 'temp' },
    { id: 'tireTempRR', label: 'Temp RR', unit: '°C', group: 'temp' },
    { id: 'tirePressureFL', label: 'PSI FL', unit: 'psi', group: 'pressure' },
    { id: 'tirePressureFR', label: 'PSI FR', unit: 'psi', group: 'pressure' },
    { id: 'tirePressureRL', label: 'PSI RL', unit: 'psi', group: 'pressure' },
    { id: 'tirePressureRR', label: 'PSI RR', unit: 'psi', group: 'pressure' },
    { id: 'slipAngleFL', label: 'Slip FL', unit: '°', group: 'slip' },
    { id: 'slipAngleFR', label: 'Slip FR', unit: '°', group: 'slip' },
    { id: 'brakeTempFL', label: 'Brake FL', unit: '°C', group: 'brake' },
    { id: 'brakeTempFR', label: 'Brake FR', unit: '°C', group: 'brake' },
    { id: 'fuelLoad', label: 'Fuel', unit: 'kg', group: 'other' },
    { id: 'tirePerformance', label: 'Perf', unit: '%', group: 'other' },
    { id: 'lapTime', label: 'Lap Time', unit: 's', group: 'other' },
    { id: 'speedTrap', label: 'Speed', unit: 'km/h', group: 'other' },
  ]

  // Extract channel data
  const channelData: Record<string, number[]> = {}
  for (const ch of channels) {
    channelData[ch.id] = telemetry.map(t => (t as any)[ch.id])
  }

  // Pearson correlation function
  function pearson(x: number[], y: number[]): number {
    const n = x.length
    if (n === 0) return 0
    const sumX = x.reduce((s, v) => s + v, 0)
    const sumY = y.reduce((s, v) => s + v, 0)
    const sumXY = x.reduce((s, v, i) => s + v * y[i], 0)
    const sumX2 = x.reduce((s, v) => s + v * v, 0)
    const sumY2 = y.reduce((s, v) => s + v * v, 0)
    const numerator = n * sumXY - sumX * sumY
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))
    return denominator === 0 ? 0 : numerator / denominator
  }

  // Build correlation matrix
  const matrix: number[][] = []
  for (let i = 0; i < channels.length; i++) {
    const row: number[] = []
    for (let j = 0; j < channels.length; j++) {
      row.push(Math.round(pearson(channelData[channels[i].id], channelData[channels[j].id]) * 100) / 100)
    }
    matrix.push(row)
  }

  // Find strongest correlations (excluding self-correlation)
  const correlations: { ch1: string; ch2: string; label1: string; label2: string; correlation: number; absCorr: number }[] = []
  for (let i = 0; i < channels.length; i++) {
    for (let j = i + 1; j < channels.length; j++) {
      correlations.push({
        ch1: channels[i].id,
        ch2: channels[j].id,
        label1: channels[i].label,
        label2: channels[j].label,
        correlation: matrix[i][j],
        absCorr: Math.abs(matrix[i][j]),
      })
    }
  }
  correlations.sort((a, b) => b.absCorr - a.absCorr)

  // Key insights
  const strongPositive = correlations.filter(c => c.correlation > 0.7).slice(0, 5)
  const strongNegative = correlations.filter(c => c.correlation < -0.7).slice(0, 5)

  // Compute averages
  const avgPerf = channelData.tirePerformance.reduce((s, v) => s + v, 0) / channelData.tirePerformance.length
  const avgTemp = channelData.tireTempFL.reduce((s, v) => s + v, 0) / channelData.tireTempFL.length

  return NextResponse.json({
    channels,
    matrix,
    correlations: correlations.slice(0, 20),
    strongPositive,
    strongNegative,
    summary: {
      totalChannels: channels.length,
      totalPairs: correlations.length,
      strongPositiveCount: correlations.filter(c => c.correlation > 0.7).length,
      strongNegativeCount: correlations.filter(c => c.correlation < -0.7).length,
      topCorrelation: correlations[0],
      driverCode: driverCode || telemetry[0]?.driver?.code,
      totalLaps: telemetry.length,
      avgPerf: Math.round(avgPerf * 1000) / 1000,
      avgTemp: Math.round(avgTemp * 10) / 10,
    },
  })
}
