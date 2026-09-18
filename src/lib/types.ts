// Shared types for the Tire Strategy Engine

export interface Race {
  id: string
  name: string
  circuit: string
  country: string
  round: number
  date: string
  airTemp: number
  trackTemp: number
  humidity: number
  weather: string
  status: 'scheduled' | 'ongoing' | 'completed'
  lapsTotal: number
  createdAt: string
  _count?: { telemetry: number }
}

export interface Driver {
  id: string
  name: string
  code: string
  team: string
  number: number
}

export interface TireCompound {
  id: string
  name: string
  shortName: string
  color: string
  expectedLife: number
  gripRating: number
  degradation: number
}

export interface Telemetry {
  id: string
  raceId: string
  driverId: string
  compoundId: string
  lap: number
  tireTempFL: number
  tireTempFR: number
  tireTempRL: number
  tireTempRR: number
  tirePressureFL: number
  tirePressureFR: number
  tirePressureRL: number
  tirePressureRR: number
  slipAngleFL: number
  slipAngleFR: number
  brakeTempFL: number
  brakeTempFR: number
  fuelLoad: number
  tirePerformance: number
  lapTime: number
  sector1Time: number
  sector2Time: number
  sector3Time: number
  speedTrap: number
  timestamp: string
  driver?: Driver
  compound?: TireCompound
  race?: Race
}

export interface TireModel {
  id: string
  version: string
  status: string
  accuracy: number
  precision: number
  recall: number
  f1Score: number
  avgLatencyMs: number
  trainingSamples: number
  features: string
  thresholds: string
  trainedAt: string
  createdAt: string
  _count?: { predictions: number }
}

export interface PitDecision {
  id: string
  raceId: string
  driverId: string
  recommendedLap: number
  actualLap: number | null
  confidence: number
  pitWindowLow: number
  pitWindowHigh: number
  compoundFrom: string
  compoundTo: string
  reasoning: string
  status: 'pending' | 'executed' | 'missed' | 'optimal'
  timingErrorLaps: number | null
  createdAt: string
  driver?: Driver
  race?: Race
}

export interface PredictionLog {
  id: string
  raceId: string
  modelId: string
  driverId: string
  lap: number
  predictedPerf: number
  actualPerf: number | null
  predictedClass: string
  confidenceLow: number
  confidenceHigh: number
  inferenceMs: number
  timestamp: string
  driver?: Driver
  race?: Race
  model?: TireModel
}

export interface CompetitorStrategy {
  id: string
  team: string
  circuit: string
  raceName: string
  driver: string
  compound: string
  avgPitLap: number
  stintLength: number
  tireStrategy: string
  degResistance: number
  pitStopAvg: number
  pointsScored: number
  finishPosition: number
  weekOf: string
  notes: string
}

export interface LiveTelemetry {
  driverCode: string
  driverName: string
  team: string
  carNumber: number
  lap: number
  tireCompound: string
  tireAge: number
  tireTempFL: number
  tireTempFR: number
  tireTempRL: number
  tireTempRR: number
  tirePressureFL: number
  tirePressureFR: number
  tirePressureRL: number
  tirePressureRR: number
  slipAngleFL: number
  slipAngleFR: number
  brakeTempFL: number
  brakeTempFR: number
  fuelLoad: number
  tirePerformance: number
  lapTime: number
  speedTrap: number
  position: number
  gapToLeader: number
  timestamp: string
}

export interface PredictionResult {
  predictedPerf: number
  performanceClass: string
  confidenceLow: number
  confidenceHigh: number
  lapsToThreshold90: number
  recommendation: string
  inferenceMs: number
  modelVersion: string
  timestamp: string
}

export interface PitWindowResult {
  recommendedLap: number
  windowLow: number
  windowHigh: number
  confidence: number
  strategy: string
  reasoning: string[]
}

export interface DashboardOverview {
  totalRaces: number
  completedRaces: number
  ongoingRace: Race | null
  upcomingRaces: Race[]
  totalDrivers: number
  totalTelemetryPoints: number
  totalModelVersions: number
  activeModelVersion: string | null
  activeModelAccuracy: number
  totalPitDecisions: number
  avgTimingError: number
  optimalPitRate: number
  predictionMAE: number
  avgInferenceMs: number
  competitorRecords: number
}

// Color helpers for performance classes
export const PERF_COLORS: Record<string, string> = {
  optimal: '#22c55e',
  warning_95: '#84cc16',
  warning_95_old: '#a3e635',
  warning90: '#f59e0b',
  warning_90: '#f59e0b',
  warning_85: '#f97316',
  warning85: '#f97316',
  critical: '#ef4444',
}

export const COMPOUND_COLORS: Record<string, string> = {
  Soft: '#ef4444',
  Medium: '#f59e0b',
  Hard: '#e2e8f0',
  Intermediate: '#06b6d4',
  Wet: '#3b82f6',
}

export function classColor(cls: string): string {
  const c = PERF_COLORS[cls]
  if (c) return c
  if (cls.startsWith('warning_95')) return '#a3e635'
  if (cls.startsWith('warning_90')) return '#f59e0b'
  if (cls.startsWith('warning_85')) return '#f97316'
  if (cls === 'critical') return '#ef4444'
  return '#22c55e'
}

export function classLabel(cls: string): string {
  const map: Record<string, string> = {
    optimal: 'Optimal',
    warning_95: '95% Threshold',
    warning_90: '90% Threshold',
    warning_85: '85% Threshold',
    critical: 'Critical',
    warning95: '95% Threshold',
    warning90: '90% Threshold',
    warning85: '85% Threshold',
  }
  return map[cls] || cls
}
