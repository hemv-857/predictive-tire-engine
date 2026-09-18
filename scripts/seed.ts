// Seed script - generates realistic F1 tire strategy data for Apex Racing
import { db } from '../src/lib/db'

const TIRES = [
  { name: 'Soft', shortName: 'S', color: '#ef4444', expectedLife: 18, gripRating: 1.0, degradation: 0.045 },
  { name: 'Medium', shortName: 'M', color: '#fbbf24', expectedLife: 28, gripRating: 0.93, degradation: 0.028 },
  { name: 'Hard', shortName: 'H', color: '#f1f5f9', expectedLife: 40, gripRating: 0.86, degradation: 0.017 },
  { name: 'Intermediate', shortName: 'I', color: '#22d3ee', expectedLife: 22, gripRating: 0.88, degradation: 0.05 },
  { name: 'Wet', shortName: 'W', color: '#3b82f6', expectedLife: 16, gripRating: 0.82, degradation: 0.06 },
]

const RACES = [
  { name: 'Bahrain Grand Prix', circuit: 'Bahrain International Circuit', country: 'Bahrain', round: 1, lapsTotal: 57, airTemp: 28, trackTemp: 42, humidity: 35, weather: 'dry' },
  { name: 'Saudi Arabian Grand Prix', circuit: 'Jeddah Corniche Circuit', country: 'Saudi Arabia', round: 2, lapsTotal: 50, airTemp: 26, trackTemp: 38, humidity: 55, weather: 'dry' },
  { name: 'Australian Grand Prix', circuit: 'Albert Park', country: 'Australia', round: 3, lapsTotal: 58, airTemp: 19, trackTemp: 28, humidity: 50, weather: 'dry' },
  { name: 'Japanese Grand Prix', circuit: 'Suzuka Circuit', country: 'Japan', round: 4, lapsTotal: 53, airTemp: 17, trackTemp: 30, humidity: 65, weather: 'dry' },
  { name: 'Chinese Grand Prix', circuit: 'Shanghai International Circuit', country: 'China', round: 5, lapsTotal: 56, airTemp: 22, trackTemp: 35, humidity: 60, weather: 'dry' },
  { name: 'Monaco Grand Prix', circuit: 'Circuit de Monaco', country: 'Monaco', round: 8, lapsTotal: 78, airTemp: 21, trackTemp: 32, humidity: 65, weather: 'dry' },
]

const DRIVERS = [
  { name: 'Yuki Tsunoda', code: 'TSU', team: 'Apex Racing', number: 22 },
  { name: 'Liam Lawson', code: 'LAW', team: 'Apex Racing', number: 30 },
  { name: 'Max Verstappen', code: 'VER', team: 'Red Bull Racing', number: 1 },
  { name: 'Lando Norris', code: 'NOR', team: 'McLaren', number: 4 },
  { name: 'Charles Leclerc', code: 'LEC', team: 'Ferrari', number: 16 },
  { name: 'Lewis Hamilton', code: 'HAM', team: 'Mercedes', number: 44 },
  { name: 'Oscar Piastri', code: 'PIA', team: 'McLaren', number: 81 },
  { name: 'Carlos Sainz', code: 'SAI', team: 'Ferrari', number: 55 },
  { name: 'George Russell', code: 'RUS', team: 'Mercedes', number: 63 },
  { name: 'Sergio Perez', code: 'PER', team: 'Red Bull Racing', number: 11 },
]

const TEAMS_FOR_STRATEGY = [
  'Red Bull Racing', 'Ferrari', 'Mercedes', 'McLaren', 'Apex Racing',
  'Aston Martin', 'Alpine', 'Williams', 'Kick Sauber', 'Haas'
]

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function gaussianNoise(mean: number, std: number) {
  const u1 = Math.random()
  const u2 = Math.random()
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2)
  return mean + z * std
}

function computeTirePerformance(
  lap: number,
  compoundDeg: number,
  expectedLife: number,
  tireTemp: number,
  trackTemp: number,
  slipAngle: number,
  fuelLoad: number,
  weather: string,
): number {
  const lapsFactor = Math.pow(lap / expectedLife, 1.4)
  let perf = 1 - compoundDeg * lapsFactor
  const optimalTemp = weather === 'dry' ? 97 : 70
  const tempPenalty = Math.abs(tireTemp - optimalTemp) / 100
  perf -= tempPenalty * 0.08
  perf -= Math.max(0, slipAngle - 3) * 0.012
  perf -= (fuelLoad / 110) * 0.03
  if (trackTemp > 45) perf -= 0.04
  return clamp(perf, 0.45, 1.0)
}

function lapTimeFor(perf: number, baseLap: number, fuelLoad: number): number {
  const perfDelta = (1 - perf) * 3.2
  const fuelDelta = (fuelLoad / 110) * 1.5
  return baseLap + perfDelta + fuelDelta - 0.8
}

async function main() {
  console.log('🌱 Seeding Predictive Tire Strategy Engine database...')

  await db.telemetry.deleteMany()
  await db.pitDecision.deleteMany()
  await db.predictionLog.deleteMany()
  await db.tireModel.deleteMany()
  await db.competitorStrategy.deleteMany()
  await db.weeklyBrief.deleteMany()
  await db.tireCompound.deleteMany()
  await db.driver.deleteMany()
  await db.race.deleteMany()

  const tireMap: Record<string, any> = {}
  for (const t of TIRES) {
    tireMap[t.shortName] = await db.tireCompound.create({ data: t })
  }

  const driverMap: Record<string, any> = {}
  for (const d of DRIVERS) {
    driverMap[d.code] = await db.driver.create({ data: d })
  }

  const baseLapTimes: Record<string, number> = {
    'Bahrain Grand Prix': 93.5,
    'Saudi Arabian Grand Prix': 91.2,
    'Australian Grand Prix': 82.5,
    'Japanese Grand Prix': 90.3,
    'Chinese Grand Prix': 97.8,
    'Monaco Grand Prix': 75.4,
  }

  const raceMap: Record<string, any> = {}
  const now = new Date()
  let weekOffset = -5
  for (const r of RACES) {
    const date = new Date(now)
    date.setDate(date.getDate() + weekOffset * 7)
    const prevOffset = weekOffset
    weekOffset += 1
    const status = prevOffset < 0 ? 'completed' : (prevOffset === 0 ? 'ongoing' : 'scheduled')
    raceMap[r.name] = await db.race.create({ data: { ...r, date, status } })
  }

  let telemetryCount = 0
  const driverCodes = ['TSU', 'LAW', 'VER', 'NOR', 'LEC', 'HAM', 'PIA', 'SAI', 'RUS', 'PER']

  for (const race of RACES) {
    const raceRow = raceMap[race.name]
    if (raceRow.status === 'scheduled') continue

    const baseLap = baseLapTimes[race.name]
    const isOngoing = raceRow.status === 'ongoing'

    for (const code of driverCodes) {
      const driver = driverMap[code]
      const tireChoice = ['S', 'M', 'M']
      const stintEnds = isOngoing ? [Math.floor(race.lapsTotal * 0.45)] : [Math.floor(race.lapsTotal * 0.38), Math.floor(race.lapsTotal * 0.72)]

      let currentLap = 1
      let stintIdx = 0
      const lapsInRace = isOngoing ? Math.floor(race.lapsTotal * 0.55) : race.lapsTotal

      while (currentLap <= lapsInRace && stintIdx < tireChoice.length) {
        const compound = tireMap[tireChoice[stintIdx]]
        const stintStart = currentLap
        const stintEnd = stintIdx < stintEnds.length ? stintEnds[stintIdx] : lapsInRace
        const stintLength = stintEnd - stintStart + 1
        const initialFuel = isOngoing ? 60 + Math.random() * 20 : 105 + Math.random() * 5

        for (let sl = 0; sl < stintLength; sl++) {
          const lap = currentLap
          const fuelLoad = Math.max(2, initialFuel - (lap - 1) * 1.85)
          const tireAge = sl + 1
          const baseTemp = 90 + gaussianNoise(0, 4)
          const tireTemp = clamp(baseTemp + tireAge * 0.3 + (race.trackTemp - 40) * 0.15, 75, 130)
          const tirePressure = clamp(22 + gaussianNoise(0, 0.3) + tireAge * 0.04, 19, 26)
          const slipAngle = clamp(2.5 + gaussianNoise(0, 0.6) + tireAge * 0.08, 1, 8)
          const brakeTemp = clamp(480 + gaussianNoise(0, 25) + tireAge * 4, 350, 620)
          const perf = computeTirePerformance(
            tireAge, compound.degradation, compound.expectedLife,
            tireTemp, race.trackTemp, slipAngle, fuelLoad, race.weather
          )
          const lapTime = lapTimeFor(perf, baseLap, fuelLoad) + gaussianNoise(0, 0.18)
          const s1 = lapTime / 3 + gaussianNoise(0, 0.08)
          const s2 = lapTime / 3 + gaussianNoise(0, 0.08)
          const s3 = lapTime - s1 - s2
          const speedTrap = clamp(310 - fuelLoad * 0.15 + gaussianNoise(0, 3), 280, 340)

          await db.telemetry.create({
            data: {
              raceId: raceRow.id,
              driverId: driver.id,
              compoundId: compound.id,
              lap,
              tireTempFL: tireTemp + gaussianNoise(0, 1.5),
              tireTempFR: tireTemp + gaussianNoise(0, 1.5),
              tireTempRL: tireTemp + gaussianNoise(0, 1.5),
              tireTempRR: tireTemp + gaussianNoise(0, 1.5),
              tirePressureFL: tirePressure + gaussianNoise(0, 0.1),
              tirePressureFR: tirePressure + gaussianNoise(0, 0.1),
              tirePressureRL: tirePressure + gaussianNoise(0, 0.1),
              tirePressureRR: tirePressure + gaussianNoise(0, 0.1),
              slipAngleFL: slipAngle + gaussianNoise(0, 0.2),
              slipAngleFR: slipAngle + gaussianNoise(0, 0.2),
              brakeTempFL: brakeTemp + gaussianNoise(0, 8),
              brakeTempFR: brakeTemp + gaussianNoise(0, 8),
              fuelLoad: Math.round(fuelLoad * 10) / 10,
              tirePerformance: Math.round(perf * 1000) / 1000,
              lapTime: Math.round(lapTime * 1000) / 1000,
              sector1Time: Math.round(s1 * 1000) / 1000,
              sector2Time: Math.round(s2 * 1000) / 1000,
              sector3Time: Math.round(s3 * 1000) / 1000,
              speedTrap: Math.round(speedTrap * 10) / 10,
            }
          })
          telemetryCount++
          currentLap++
        }
        stintIdx++
      }
    }
  }
  console.log(`  ✓ Generated ${telemetryCount} telemetry records`)

  const modelVersions = ['v2.4.1', 'v2.4.0', 'v2.3.9', 'v2.3.8', 'v2.3.7']
  const accuracyTrend = [0.892, 0.871, 0.856, 0.843, 0.821]
  const modelMap: any[] = []
  for (let i = 0; i < modelVersions.length; i++) {
    const trainedAt = new Date(now)
    trainedAt.setDate(trainedAt.getDate() - (4 - i) * 7)
    const m = await db.tireModel.create({
      data: {
        version: modelVersions[i],
        status: i === 0 ? 'active' : 'archived',
        accuracy: accuracyTrend[i],
        precision: accuracyTrend[i] - 0.02 + Math.random() * 0.04,
        recall: accuracyTrend[i] - 0.03 + Math.random() * 0.05,
        f1Score: accuracyTrend[i] - 0.01 + Math.random() * 0.03,
        avgLatencyMs: 85 + Math.random() * 30,
        trainingSamples: 12400 + i * 800 + Math.floor(Math.random() * 500),
        features: JSON.stringify(['tireTempFL','tireTempFR','tireTempRL','tireTempRR','tirePressureFL','tirePressureFR','tirePressureRL','tirePressureRR','slipAngleFL','slipAngleFR','brakeTempFL','brakeTempFR','fuelLoad','tireAge','compoundDeg','trackTemp','airTemp']),
        thresholds: JSON.stringify({ optimal: 0.95, warning95: 0.95, warning90: 0.90, warning85: 0.85, critical: 0.80 }),
        trainedAt,
      }
    })
    modelMap.push(m)
  }
  console.log(`  ✓ Created ${modelVersions.length} tire model versions`)

  let pitCount = 0
  for (const race of RACES) {
    const raceRow = raceMap[race.name]
    if (raceRow.status !== 'completed') continue
    for (const code of driverCodes) {
      const driver = driverMap[code]
      const recommendedLap = 18 + Math.floor(Math.random() * 8)
      const actualLap = recommendedLap + Math.floor(gaussianNoise(0, 2.5))
      const timingError = Math.abs(recommendedLap - actualLap)
      const confidence = clamp(0.78 + Math.random() * 0.2, 0, 1)
      const status = timingError <= 1 ? 'optimal' : (timingError <= 3 ? 'executed' : 'missed')
      await db.pitDecision.create({
        data: {
          raceId: raceRow.id,
          driverId: driver.id,
          recommendedLap,
          actualLap,
          confidence,
          pitWindowLow: recommendedLap - 2,
          pitWindowHigh: recommendedLap + 2,
          compoundFrom: 'Soft',
          compoundTo: 'Medium',
          reasoning: JSON.stringify([
            `Tire temp trending ${90 + Math.random()*15}°C`,
            `Slip angle increase detected at lap ${recommendedLap - 3}`,
            `Fuel burn allows undercut window`,
            `Performance delta crossing 90% threshold`,
          ]),
          status,
          timingErrorLaps: timingError,
        }
      })
      pitCount++
    }
  }
  console.log(`  ✓ Generated ${pitCount} pit decisions`)

  let predCount = 0
  const activeModel = modelMap[0]
  for (const race of RACES) {
    const raceRow = raceMap[race.name]
    if (raceRow.status === 'scheduled') continue
    const lapsToLog = raceRow.status === 'ongoing' ? 20 : 30
    for (const code of ['TSU', 'LAW', 'VER', 'NOR', 'LEC']) {
      const driver = driverMap[code]
      for (let lap = 5; lap < lapsToLog; lap += 3) {
        const predictedPerf = clamp(0.95 - lap * 0.012 + gaussianNoise(0, 0.02), 0.5, 1)
        const actualPerf = raceRow.status === 'completed' ? predictedPerf + gaussianNoise(0, 0.015) : null
        const predictedClass = predictedPerf >= 0.95 ? 'optimal' : predictedPerf >= 0.9 ? 'warning95' : predictedPerf >= 0.85 ? 'warning90' : predictedPerf >= 0.80 ? 'warning85' : 'critical'
        await db.predictionLog.create({
          data: {
            raceId: raceRow.id,
            modelId: activeModel.id,
            driverId: driver.id,
            lap,
            predictedPerf: Math.round(predictedPerf * 1000) / 1000,
            actualPerf: actualPerf ? Math.round(actualPerf * 1000) / 1000 : null,
            predictedClass,
            confidenceLow: Math.round((predictedPerf - 0.02) * 1000) / 1000,
            confidenceHigh: Math.round((predictedPerf + 0.02) * 1000) / 1000,
            inferenceMs: Math.round(60 + Math.random() * 80),
          }
        })
        predCount++
      }
    }
  }
  console.log(`  ✓ Generated ${predCount} prediction logs`)

  const strategies = ['one-stop', 'two-stop', 'three-stop']
  let stratCount = 0
  for (const race of RACES) {
    const raceRow = raceMap[race.name]
    if (raceRow.status === 'scheduled') continue
    for (const team of TEAMS_FOR_STRATEGY) {
      if (team === 'Apex Racing') continue
      const strat = strategies[Math.floor(Math.random() * strategies.length)]
      const avgPitLap = strat === 'one-stop' ? 28 + Math.floor(Math.random() * 6) : strat === 'two-stop' ? 22 + Math.floor(Math.random() * 8) : 18 + Math.floor(Math.random() * 6)
      const stintLength = strat === 'one-stop' ? 30 : strat === 'two-stop' ? 20 : 15
      const compounds = ['Soft', 'Medium', 'Hard']
      await db.competitorStrategy.create({
        data: {
          team,
          circuit: race.circuit,
          raceName: race.name,
          driver: team === 'Ferrari' ? 'Leclerc' : team === 'Mercedes' ? 'Hamilton' : team === 'Red Bull Racing' ? 'Verstappen' : team === 'McLaren' ? 'Norris' : 'Driver',
          compound: compounds[Math.floor(Math.random() * compounds.length)],
          avgPitLap,
          stintLength,
          tireStrategy: strat,
          degResistance: Math.round((0.5 + Math.random() * 0.45) * 100) / 100,
          pitStopAvg: Math.round((2.2 + Math.random() * 0.8) * 100) / 100,
          pointsScored: Math.floor(Math.random() * 26),
          finishPosition: Math.floor(Math.random() * 20) + 1,
          weekOf: raceRow.date,
          notes: strat === 'one-stop' ? 'Conservative strategy on high-deg circuit' : strat === 'two-stop' ? 'Balanced approach, optimal tire management' : 'Aggressive, undercut focused',
        }
      })
      stratCount++
    }
  }
  console.log(`  ✓ Generated ${stratCount} competitor strategy records`)

  await db.weeklyBrief.create({
    data: {
      title: 'Week 8 Strategic Brief - Mid-Season Tire Analysis',
      weekOf: now,
      summary: 'Ferrari consistently pits 2-3 laps earlier than the field on high-degradation circuits. Mercedes extends stints by an average of 4 laps. Red Bull maintains highest deg-resistance (0.87). Recommendation: deploy two-stop strategy targeting laps 18-22 and 42-46 at upcoming high-deg circuits.',
      keyFindings: JSON.stringify([
        'Ferrari avg pit lap = 19.4 on high-deg circuits (field avg 22.1)',
        'Mercedes stint length avg = 24.2 laps (longest in field)',
        'Red Bull deg-resistance index = 0.87 (highest)',
        'McLaren shows 12% better tire temp management in sector 2',
        'Optimal pit window confidence improved to 89.2% with v2.4.1',
      ]),
      recommendations: JSON.stringify([
        'Target undercut against Ferrari at lap 17-19 on soft compound',
        'Extend stint option viable if tire temp stays < 105°C',
        'Consider medium-to-hard strategy for Suzuka given deg profile',
        'Monitor Mercedes pit window for counter-strategy',
      ]),
      preparedFor: 'Performance Director',
    }
  })
  console.log(`  ✓ Created weekly strategic brief`)

  console.log('✅ Seed complete!')
  await db.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
