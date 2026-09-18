'use client'

import { useState } from 'react'
import { DegradationCurve } from '@/components/charts/degradation-curve'
import { TeamBarChart } from '@/components/charts/team-bar-chart'
import { COMPOUND_COLORS } from '@/lib/types'
import { Thermometer, Gauge, Activity, Layers, Flame, Snowflake } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  telemetry: any[]
  drivers: any[]
  raceId: string | null
}

const COMPOUND_DEG = {
  Soft: { deg: 0.045, life: 18, color: '#ef4444' },
  Medium: { deg: 0.028, life: 28, color: '#f59e0b' },
  Hard: { deg: 0.017, life: 40, color: '#e2e8f0' },
}

export function TireDegradation({ telemetry, drivers, raceId }: Props) {
  const [selectedDriver, setSelectedDriver] = useState<string>('')
  const [selectedCompound, setSelectedCompound] = useState<string>('all')

  // Derive the effective driver: user's selection if valid, otherwise the first available
  const validDriver = drivers.some((d) => d.code === selectedDriver) ? selectedDriver : (drivers[0]?.code || '')

  // Build degradation curve series for the selected driver
  const driver = drivers.find((d) => d.code === validDriver)
  const driverTelemetry = driver
    ? telemetry.filter((t) => t.driverId === driver.id).sort((a, b) => a.lap - b.lap)
    : []

  // Group into stints (compound changes)
  const stints: { compound: string; laps: any[] }[] = []
  let currentStint: { compound: string; laps: any[] } | null = null
  for (const t of driverTelemetry) {
    const c = t.compound?.name || 'Unknown'
    if (!currentStint || currentStint.compound !== c) {
      currentStint = { compound: c, laps: [] }
      stints.push(currentStint)
    }
    currentStint.laps.push({ ...t, stintLap: currentStint.laps.length + 1 })
  }

  // For the degradation curve, plot performance vs stint lap for each stint
  const series = stints
    .filter((s) => selectedCompound === 'all' || s.compound === selectedCompound)
    .map((s, i) => ({
      id: `stint-${i}`,
      name: `${s.compound} Stint ${i + 1}`,
      color: COMPOUND_COLORS[s.compound] || '#888',
      points: s.laps.map((l) => ({ x: l.stintLap, y: l.tirePerformance })),
    }))

  // Theoretical degradation curves (model predictions) for each compound
  const theoreticalSeries = Object.entries(COMPOUND_DEG).map(([name, d]) => ({
    id: `theory-${name}`,
    name: `${name} (model)`,
    color: d.color,
    dashed: true,
    points: Array.from({ length: d.life + 5 }, (_, k) => {
      const lapsFactor = Math.pow((k + 1) / d.life, 1.4)
      return { x: k + 1, y: Math.max(0.45, 1 - d.deg * lapsFactor) }
    }),
  }))

  // Temperature vs performance scatter data (aggregate)
  const tempBuckets: Record<string, { temp: number; perf: number; count: number }[]> = {}
  for (const t of driverTelemetry) {
    const avgTemp = (t.tireTempFL + t.tireTempFR + t.tireTempRL + t.tireTempRR) / 4
    const bucket = Math.floor(avgTemp / 5) * 5
    if (!tempBuckets[t.compound?.name]) tempBuckets[t.compound?.name] = []
    const existing = tempBuckets[t.compound?.name].find((b) => b.temp === bucket)
    if (existing) {
      existing.perf += t.tirePerformance
      existing.count++
    } else {
      tempBuckets[t.compound?.name].push({ temp: bucket, perf: t.tirePerformance, count: 1 })
    }
  }
  const tempSeries = Object.entries(tempBuckets).map(([name, arr]) => ({
    id: `temp-${name}`,
    name: `${name} temp-perf`,
    color: COMPOUND_COLORS[name] || '#888',
    points: arr.map((b) => ({ x: b.temp, y: b.perf / b.count })).sort((a, b) => a.x - b.x),
  }))

  // Compound comparison: avg performance at lap 10, 15, 20
  const compoundComparison = Object.entries(COMPOUND_DEG).map(([name, d]) => ({
    label: name,
    value: Math.max(0.45, 1 - d.deg * Math.pow(15 / d.life, 1.4)) * 100,
    color: d.color,
  }))

  // Current tire state for selected driver (latest telemetry)
  const latest = driverTelemetry[driverTelemetry.length - 1]
  const avgTemp = latest ? (latest.tireTempFL + latest.tireTempFR + latest.tireTempRL + latest.tireTempRR) / 4 : 0
  const avgPressure = latest ? (latest.tirePressureFL + latest.tirePressureFR + latest.tirePressureRL + latest.tirePressureRR) / 4 : 0

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-white/10 bg-card/40">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-red-400" />
          <span className="text-xs font-mono font-bold">DEGRADATION ANALYSIS</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-muted-foreground">DRIVER:</span>
          <select
            value={validDriver}
            onChange={(e) => setSelectedDriver(e.target.value)}
            className="bg-background/60 border border-white/10 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-red-500/50"
          >
            {drivers.map((d) => (
              <option key={d.code} value={d.code}>{d.code} · {d.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-muted-foreground">COMPOUND:</span>
          <select
            value={selectedCompound}
            onChange={(e) => setSelectedCompound(e.target.value)}
            className="bg-background/60 border border-white/10 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-red-500/50"
          >
            <option value="all">All Stints</option>
            {Object.keys(COMPOUND_DEG).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Current tire state */}
      {latest && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <TireCornerCard corner="FL" temp={latest.tireTempFL} pressure={latest.tirePressureFL} slip={latest.slipAngleFL} brake={latest.brakeTempFL} perf={latest.tirePerformance} />
          <TireCornerCard corner="FR" temp={latest.tireTempFR} pressure={latest.tirePressureFR} slip={latest.slipAngleFR} brake={latest.brakeTempFR} perf={latest.tirePerformance} />
          <TireCornerCard corner="RL" temp={latest.tireTempRL} pressure={latest.tirePressureRL} slip={latest.slipAngleFL} brake={latest.brakeTempFL} perf={latest.tirePerformance} />
          <TireCornerCard corner="RR" temp={latest.tireTempRR} pressure={latest.tirePressureRR} slip={latest.slipAngleFR} brake={latest.brakeTempFR} perf={latest.tirePerformance} />
        </div>
      )}

      {/* Main degradation chart */}
      <div className="rounded-xl border border-white/10 bg-card/40 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold font-mono flex items-center gap-2">
              <Activity className="h-4 w-4 text-red-400" />
              TIRE PERFORMANCE TRAJECTORY · {validDriver}
            </h3>
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
              {driver?.name} · {stints.length} stints · {driverTelemetry.length} laps analyzed
            </p>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-mono">
            {Object.entries(COMPOUND_COLORS).slice(0, 3).map(([n, c]) => (
              <span key={n} className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ background: c }} />{n}
              </span>
            ))}
          </div>
        </div>
        <DegradationCurve
          series={series}
          xLabel="Lap in Stint (tire age)"
          yLabel="Grip Retention (1.0 = new)"
          yDomain={[0.6, 1.0]}
          width={900}
          height={340}
          thresholds={[
            { value: 0.95, label: '95%', color: '#a3e635' },
            { value: 0.90, label: '90% (pit trigger)', color: '#f59e0b' },
            { value: 0.85, label: '85%', color: '#f97316' },
            { value: 0.80, label: 'CRITICAL', color: '#ef4444' },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Theoretical model curves */}
        <div className="rounded-xl border border-white/10 bg-card/40 p-4">
          <h3 className="text-sm font-bold font-mono flex items-center gap-2 mb-3">
            <Layers className="h-4 w-4 text-cyan-400" />
            MODEL DEGRADATION CURVES
          </h3>
          <p className="text-[10px] text-muted-foreground font-mono mb-2">Physics-informed model: perf = 1 - deg·(age/life)^1.4</p>
          <DegradationCurve
            series={theoreticalSeries}
            xLabel="Tire Age (laps)"
            yLabel="Predicted Performance"
            yDomain={[0.6, 1.0]}
            xDomain={[1, 45]}
            width={560}
            height={300}
            thresholds={[
              { value: 0.90, label: '90% threshold', color: '#f59e0b' },
              { value: 0.80, label: 'critical', color: '#ef4444' },
            ]}
          />
        </div>

        {/* Temperature correlation */}
        <div className="rounded-xl border border-white/10 bg-card/40 p-4">
          <h3 className="text-sm font-bold font-mono flex items-center gap-2 mb-3">
            <Thermometer className="h-4 w-4 text-amber-400" />
            TEMP → PERFORMANCE CORRELATION
          </h3>
          <p className="text-[10px] text-muted-foreground font-mono mb-2">Optimal window: 92–105°C · deviation = grip loss</p>
          {tempSeries.length ? (
            <DegradationCurve
              series={tempSeries}
              xLabel="Avg Tire Temperature (°C)"
              yLabel="Performance"
              yDomain={[0.7, 1.0]}
              xDomain={[70, 125]}
              width={560}
              height={300}
              markers={[
                { x: 92, label: '92°', color: '#22c55e' },
                { x: 105, label: '105°', color: '#f59e0b' },
              ]}
            />
          ) : (
            <div className="h-[300px] flex items-center justify-center text-xs text-muted-foreground font-mono">No data</div>
          )}
        </div>
      </div>

      {/* Compound comparison + stint summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-white/10 bg-card/40 p-4">
          <h3 className="text-sm font-bold font-mono mb-3">COMPOUND @ LAP 15</h3>
          <TeamBarChart
            data={compoundComparison}
            yLabel="Performance %"
            unit="%"
            width={400}
            height={280}
          />
        </div>

        <div className="lg:col-span-2 rounded-xl border border-white/10 bg-card/40 p-4">
          <h3 className="text-sm font-bold font-mono mb-3">STINT BREAKDOWN · {validDriver}</h3>
          <div className="space-y-2 max-h-[300px] overflow-y-auto rb-scroll">
            {stints.map((s, i) => {
              const avgPerf = s.laps.reduce((a, b) => a + b.tirePerformance, 0) / s.laps.length
              const startPerf = s.laps[0]?.tirePerformance || 0
              const endPerf = s.laps[s.laps.length - 1]?.tirePerformance || 0
              const drop = ((startPerf - endPerf) * 100).toFixed(1)
              const avgT = s.laps.reduce((a, b) => a + (b.tireTempFL + b.tireTempFR + b.tireTempRL + b.tireTempRR) / 4, 0) / s.laps.length
              return (
                <div key={i} className="flex items-center gap-3 rounded-lg bg-background/30 p-2.5">
                  <span className="h-8 w-1 rounded-full" style={{ background: COMPOUND_COLORS[s.compound] || '#888' }} />
                  <div className="flex-1 grid grid-cols-5 gap-2 text-[10px] font-mono">
                    <div><span className="text-muted-500">STINT</span><div className="font-bold">#{i + 1}</div></div>
                    <div><span className="text-muted-500">COMPOUND</span><div className="font-bold" style={{ color: COMPOUND_COLORS[s.compound] }}>{s.compound}</div></div>
                    <div><span className="text-muted-500">LAPS</span><div className="font-bold">{s.laps.length}</div></div>
                    <div><span className="text-muted-500">AVG PERF</span><div className="font-bold text-green-400">{(avgPerf * 100).toFixed(1)}%</div></div>
                    <div><span className="text-muted-500">DROP</span><div className="font-bold text-red-400">-{drop}%</div></div>
                  </div>
                  <div className="text-right text-[10px] font-mono">
                    <div className="text-muted-500">AVG TEMP</div>
                    <div className="font-bold text-amber-400">{avgT.toFixed(0)}°C</div>
                  </div>
                </div>
              )
            })}
            {stints.length === 0 && <div className="text-center text-xs text-muted-foreground font-mono py-8">No telemetry for this driver</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

function TireCornerCard({ corner, temp, pressure, slip, brake, perf }: { corner: string; temp: number; pressure: number; slip: number; brake: number; perf: number }) {
  const tempColor = temp > 115 ? '#ef4444' : temp > 105 ? '#f59e0b' : temp < 85 ? '#06b6d4' : '#22c55e'
  return (
    <div className="rounded-lg border border-white/10 bg-card/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-mono font-bold">{corner}</span>
        <span className="h-2 w-2 rounded-full rb-live-dot" style={{ background: tempColor }} />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px] font-mono">
          <span className="flex items-center gap-1 text-muted-foreground"><Thermometer className="h-3 w-3" />TEMP</span>
          <span className="font-bold" style={{ color: tempColor }}>{temp.toFixed(1)}°C</span>
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono">
          <span className="flex items-center gap-1 text-muted-foreground"><Gauge className="h-3 w-3" />PSI</span>
          <span className="font-bold">{pressure.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono">
          <span className="flex items-center gap-1 text-muted-foreground"><Flame className="h-3 w-3" />BRAKE</span>
          <span className="font-bold">{brake.toFixed(0)}°C</span>
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono">
          <span className="flex items-center gap-1 text-muted-foreground"><Activity className="h-3 w-3" />SLIP</span>
          <span className="font-bold">{slip.toFixed(1)}°</span>
        </div>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-background/60 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${perf * 100}%`, background: perf >= 0.9 ? '#22c55e' : perf >= 0.85 ? '#f59e0b' : '#ef4444' }} />
      </div>
    </div>
  )
}
