'use client'

import { useEffect, useState, useCallback } from 'react'
import { DegradationCurve } from '@/components/charts/degradation-curve'
import { Sliders, Play, RotateCcw, Trophy, Clock, Gauge, TrendingUp, AlertTriangle, Zap, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StintConfig {
  compound: 'Soft' | 'Medium' | 'Hard'
  pitLap: number
}

interface SimResult {
  laps: any[]
  perfCurve: { x: number; y: number }[]
  lapTimeCurve: { x: number; y: number }[]
  stintBreakdown: any[]
  summary: {
    totalTime: number
    totalLaps: number
    pitStops: number
    totalPitTime: number
    avgPerformance: number
    minPerformance: number
    lapsUnder90: number
    lapsUnder85: number
    rating: string
    ratingScore: number
    deltaToBaseline: number
    baselineTime: number
  }
}

interface Preset {
  id: string
  name: string
  description: string
  stints: StintConfig[]
  color: string
}

const COMPOUND_COLORS: Record<string, string> = {
  Soft: '#ef4444',
  Medium: '#f59e0b',
  Hard: '#e2e8f0',
}

const RATING_COLORS: Record<string, string> = {
  OPTIMAL: '#22c55e',
  STRONG: '#a3e635',
  ACCEPTABLE: '#f59e0b',
  RISKY: '#ef4444',
}

export function StrategySimulator({ totalLaps }: { totalLaps: number }) {
  const [stints, setStints] = useState<StintConfig[]>([
    { compound: 'Soft', pitLap: 20 },
    { compound: 'Medium', pitLap: 42 },
    { compound: 'Medium', pitLap: totalLaps },
  ])
  const [trackTemp, setTrackTemp] = useState(32)
  const [fuelStart, setFuelStart] = useState(105)
  const [result, setResult] = useState<SimResult | null>(null)
  const [simulating, setSimulating] = useState(false)
  const [presets, setPresets] = useState<Preset[]>([])
  const [compareMode, setCompareMode] = useState(false)
  const [compareResults, setCompareResults] = useState<{ preset: Preset; result: SimResult }[]>([])

  useEffect(() => {
    fetch('/api/strategy-simulate').then(r => r.json()).then((d) => setPresets(d.presets || []))
  }, [])

  const runSimulation = useCallback(async (stintConfig: StintConfig[], temp: number, fuel: number) => {
    setSimulating(true)
    try {
      const res = await fetch('/api/strategy-simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalLaps,
          trackTemp: temp,
          airTemp: 21,
          fuelStart: fuel,
          stints: stintConfig,
        }),
      })
      const data = await res.json()
      setResult(data)
    } catch (e) {
      console.error('Simulation failed', e)
    } finally {
      setSimulating(false)
    }
  }, [totalLaps])

  // Run simulation on mount and when inputs change
  useEffect(() => {
    const t = setTimeout(() => runSimulation(stints, trackTemp, fuelStart), 300)
    return () => clearTimeout(t)
  }, [stints, trackTemp, fuelStart, runSimulation])

  const runComparison = async () => {
    setCompareMode(true)
    const results: { preset: Preset; result: SimResult }[] = []
    for (const p of presets) {
      try {
        const res = await fetch('/api/strategy-simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            totalLaps, trackTemp, airTemp: 21, fuelStart, stints: p.stints,
          }),
        })
        const data = await res.json()
        results.push({ preset: p, result: data })
      } catch (e) { console.error(e) }
    }
    setCompareResults(results.sort((a, b) => a.result.summary.totalTime - b.result.summary.totalTime))
  }

  const addStint = () => {
    if (stints.length >= 4) return
    const lastPit = stints[stints.length - 1].pitLap
    setStints([...stints, { compound: 'Medium', pitLap: Math.min(totalLaps, lastPit + 15) }])
  }

  const removeStint = (idx: number) => {
    if (stints.length <= 1) return
    setStints(stints.filter((_, i) => i !== idx))
  }

  const updateStint = (idx: number, field: keyof StintConfig, value: any) => {
    setStints(stints.map((s, i) => i === idx ? { ...s, [field]: value } : s))
  }

  const loadPreset = (preset: Preset) => {
    setStints(preset.stints.map((s) => ({ ...s })))
    setCompareMode(false)
  }

  const reset = () => {
    setStints([
      { compound: 'Soft', pitLap: 20 },
      { compound: 'Medium', pitLap: 42 },
      { compound: 'Medium', pitLap: totalLaps },
    ])
    setTrackTemp(32)
    setFuelStart(105)
    setCompareMode(false)
  }

  // Build chart series from result
  const perfSeries = result ? [{
    id: 'sim-perf',
    name: 'Simulated Performance',
    color: RATING_COLORS[result.summary.rating] || '#22c55e',
    points: result.perfCurve,
  }] : []

  // Pit markers
  const pitMarkers = stints.slice(0, -1).map((s, i) => ({
    x: s.pitLap,
    label: `PIT ${i + 1}`,
    color: '#f59e0b',
  }))

  const lapTimeSeries = result ? [{
    id: 'sim-laptime',
    name: 'Lap Time',
    color: '#06b6d4',
    points: result.lapTimeCurve,
  }] : []

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-white/10 bg-card/40">
        <div className="flex items-center gap-2">
          <Sliders className="h-4 w-4 text-red-400" />
          <span className="text-xs font-mono font-bold">STRATEGY SIMULATOR</span>
          <span className="text-[10px] font-mono text-muted-foreground hidden sm:inline">· What-if analysis engine</span>
        </div>
        <div className="flex-1" />
        <button
          onClick={runComparison}
          className="rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 px-3 py-1.5 text-[11px] font-mono font-bold text-cyan-300 transition-colors flex items-center gap-1.5"
        >
          <TrendingUp className="h-3 w-3" /> COMPARE PRESETS
        </button>
        <button
          onClick={reset}
          className="rounded-lg bg-background/60 hover:bg-background/80 border border-white/10 px-3 py-1.5 text-[11px] font-mono font-bold transition-colors flex items-center gap-1.5"
        >
          <RotateCcw className="h-3 w-3" /> RESET
        </button>
      </div>

      {/* Preset chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-mono text-muted-foreground uppercase">Presets:</span>
        {presets.map((p) => (
          <button
            key={p.id}
            onClick={() => loadPreset(p)}
            className="rb-sweep group flex items-center gap-1.5 rounded-lg border border-white/10 bg-card/40 hover:bg-card/60 px-2.5 py-1.5 text-[10px] font-mono transition-colors"
          >
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            <span className="font-bold">{p.name.split('(')[0].trim()}</span>
            <span className="text-muted-foreground group-hover:text-foreground hidden md:inline">· {p.stints.length} stops</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        {/* Controls panel */}
        <div className="space-y-3">
          {/* Stint builder */}
          <div className="rounded-xl border border-white/10 bg-card/40 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold font-mono flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-amber-400" /> STINT BUILDER
              </h3>
              <button
                onClick={addStint}
                disabled={stints.length >= 4}
                className="rounded bg-background/60 hover:bg-background/80 border border-white/10 px-2 py-0.5 text-[10px] font-mono disabled:opacity-40 transition-colors flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> ADD
              </button>
            </div>
            <div className="space-y-2">
              {stints.map((s, i) => (
                <div key={i} className="rounded-lg bg-background/40 p-2.5 border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono font-bold text-muted-foreground">STINT {i + 1}</span>
                    {stints.length > 1 && (
                      <button onClick={() => removeStint(i)} className="text-muted-foreground hover:text-red-400 transition-colors">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-mono text-muted-foreground uppercase">Compound</label>
                      <select
                        value={s.compound}
                        onChange={(e) => updateStint(i, 'compound', e.target.value)}
                        className="w-full bg-background/60 border border-white/10 rounded px-2 py-1 text-[11px] font-mono focus:outline-none focus:border-red-500/50"
                      >
                        <option value="Soft">Soft</option>
                        <option value="Medium">Medium</option>
                        <option value="Hard">Hard</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-mono text-muted-foreground uppercase">Pit at lap</label>
                      <input
                        type="number"
                        min={1}
                        max={totalLaps}
                        value={s.pitLap}
                        onChange={(e) => updateStint(i, 'pitLap', parseInt(e.target.value) || totalLaps)}
                        className="w-full bg-background/60 border border-white/10 rounded px-2 py-1 text-[11px] font-mono focus:outline-none focus:border-red-500/50"
                      />
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: COMPOUND_COLORS[s.compound] }} />
                    <span className="text-[9px] font-mono text-muted-foreground">
                      {i === stints.length - 1 ? 'To finish' : `${s.pitLap - (i === 0 ? 0 : stints[i - 1].pitLap)} laps`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Track conditions */}
          <div className="rounded-xl border border-white/10 bg-card/40 p-4">
            <h3 className="text-xs font-bold font-mono mb-3 flex items-center gap-2">
              <Gauge className="h-3.5 w-3.5 text-cyan-400" /> TRACK CONDITIONS
            </h3>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-mono text-muted-foreground uppercase">Track Temp</label>
                  <span className="text-xs font-mono font-bold text-amber-400">{trackTemp}°C</span>
                </div>
                <input
                  type="range" min={15} max={55} value={trackTemp}
                  onChange={(e) => setTrackTemp(parseInt(e.target.value))}
                  className="w-full accent-red-500"
                />
                <div className="flex justify-between text-[8px] font-mono text-muted-foreground mt-0.5">
                  <span>15°</span><span>COOL</span><span className="text-amber-400">OPTIMAL 97° tire</span><span>HOT</span><span>55°</span>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-mono text-muted-foreground uppercase">Fuel Start</label>
                  <span className="text-xs font-mono font-bold text-green-400">{fuelStart}kg</span>
                </div>
                <input
                  type="range" min={80} max={110} value={fuelStart}
                  onChange={(e) => setFuelStart(parseInt(e.target.value))}
                  className="w-full accent-red-500"
                />
              </div>
            </div>
          </div>

          {/* Summary card */}
          {result && (
            <div className="rounded-xl border border-white/10 bg-card/40 p-4 rb-border-flow">
              <h3 className="text-xs font-bold font-mono mb-3 flex items-center gap-2">
                <Trophy className="h-3.5 w-3.5 text-amber-400" /> SIMULATION RESULT
              </h3>
              <div className={cn('rounded-lg p-3 mb-3 text-center', `bg-${RATING_COLORS[result.summary.rating]}/10`)}
                style={{ background: `${RATING_COLORS[result.summary.rating]}15`, border: `1px solid ${RATING_COLORS[result.summary.rating]}40` }}
              >
                <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">Strategy Rating</div>
                <div className="text-2xl font-mono font-bold" style={{ color: RATING_COLORS[result.summary.rating] }}>
                  {result.summary.rating}
                </div>
                <div className="text-[10px] font-mono text-muted-foreground">{result.summary.ratingScore}/100</div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                <Stat icon={Clock} label="Total Time" value={`${Math.floor(result.summary.totalTime / 60)}'${(result.summary.totalTime % 60).toFixed(1)}"`} color="text-cyan-400" />
                <Stat icon={Zap} label="Pit Stops" value={result.summary.pitStops.toString()} color="text-amber-400" />
                <Stat icon={Gauge} label="Avg Perf" value={`${(result.summary.avgPerformance * 100).toFixed(1)}%`} color="text-green-400" />
                <Stat icon={AlertTriangle} label="Laps <90%" value={result.summary.lapsUnder90.toString()} color={result.summary.lapsUnder90 > 5 ? 'text-red-400' : 'text-amber-400'} />
              </div>
              <div className="mt-3 pt-3 border-t border-white/10">
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-muted-foreground">vs Baseline</span>
                  <span className={cn('font-bold', result.summary.deltaToBaseline < 0 ? 'text-green-400' : 'text-red-400')}>
                    {result.summary.deltaToBaseline < 0 ? '−' : '+'}{Math.abs(result.summary.deltaToBaseline).toFixed(1)}s
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Charts */}
        <div className="space-y-4">
          {/* Performance forecast */}
          <div className="rounded-xl border border-white/10 bg-card/40 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold font-mono flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-red-400" />
                PROJECTED TIRE PERFORMANCE
              </h3>
              {simulating && (
                <span className="rb-chip bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 rb-live-dot" /> SIMULATING…
                </span>
              )}
            </div>
            {perfSeries.length > 0 ? (
              <DegradationCurve
                series={perfSeries}
                xLabel="Lap"
                yLabel="Tire Performance"
                yDomain={[0.6, 1.0]}
                xDomain={[1, totalLaps]}
                width={800}
                height={300}
                thresholds={[
                  { value: 0.95, label: '95%', color: '#a3e635' },
                  { value: 0.90, label: '90%', color: '#f59e0b' },
                  { value: 0.85, label: '85%', color: '#f97316' },
                ]}
                markers={pitMarkers}
              />
            ) : (
              <div className="h-[300px] flex items-center justify-center text-xs text-muted-foreground font-mono">Run simulation…</div>
            )}
          </div>

          {/* Lap time projection */}
          <div className="rounded-xl border border-white/10 bg-card/40 p-4">
            <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-cyan-400" />
              PROJECTED LAP TIMES
            </h3>
            {lapTimeSeries.length > 0 ? (
              <DegradationCurve
                series={lapTimeSeries}
                xLabel="Lap"
                yLabel="Lap Time (s)"
                yDomain={[Math.min(...lapTimeSeries[0].points.map((p) => p.y)) - 0.5, Math.max(...lapTimeSeries[0].points.map((p) => p.y)) + 0.5]}
                xDomain={[1, totalLaps]}
                width={800}
                height={240}
                markers={pitMarkers}
              />
            ) : (
              <div className="h-[240px] flex items-center justify-center text-xs text-muted-foreground font-mono">No data</div>
            )}
          </div>

          {/* Comparison results */}
          {compareMode && compareResults.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-card/40 p-4">
              <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-400" />
                STRATEGY COMPARISON · RANKED
              </h3>
              <div className="space-y-2">
                {compareResults.map((cr, i) => (
                  <div
                    key={cr.preset.id}
                    className={cn(
                      'flex items-center gap-3 rounded-lg p-3 border transition-colors',
                      i === 0 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-background/30 border-white/5'
                    )}
                  >
                    <span className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg font-mono text-sm font-bold',
                      i === 0 ? 'bg-amber-400 text-black' : 'bg-white/10 text-foreground'
                    )}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: cr.preset.color }} />
                        <span className="text-xs font-mono font-bold">{cr.preset.name}</span>
                      </div>
                      <p className="text-[10px] font-mono text-muted-foreground truncate">{cr.preset.description}</p>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] font-mono">
                      <div className="text-center">
                        <div className="text-muted-foreground">TIME</div>
                        <div className="font-bold text-cyan-400">{Math.floor(cr.result.summary.totalTime / 60)}'{(cr.result.summary.totalTime % 60).toFixed(0)}"</div>
                      </div>
                      <div className="text-center">
                        <div className="text-muted-foreground">STOPS</div>
                        <div className="font-bold">{cr.result.summary.pitStops}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-muted-foreground">PERF</div>
                        <div className="font-bold text-green-400">{(cr.result.summary.avgPerformance * 100).toFixed(1)}%</div>
                      </div>
                      <div className="text-center">
                        <div className="text-muted-foreground">RATING</div>
                        <div className="font-bold" style={{ color: RATING_COLORS[cr.result.summary.rating] }}>{cr.result.summary.rating}</div>
                      </div>
                      <button
                        onClick={() => loadPreset(cr.preset)}
                        className="rounded bg-background/60 hover:bg-background/80 border border-white/10 px-2 py-1 text-[9px] font-mono font-bold transition-colors"
                      >
                        LOAD →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stint breakdown */}
          {result && (
            <div className="rounded-xl border border-white/10 bg-card/40 p-4">
              <h3 className="text-sm font-bold font-mono mb-3">STINT BREAKDOWN</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                {result.stintBreakdown.map((s) => (
                  <div key={s.stintNumber} className="rounded-lg bg-background/30 p-3 border border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="h-3 w-1 rounded-full" style={{ background: s.color }} />
                      <span className="text-[10px] font-mono font-bold">STINT {s.stintNumber}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">· {s.compound}</span>
                    </div>
                    <div className="space-y-1 text-[10px] font-mono">
                      <div className="flex justify-between"><span className="text-muted-foreground">Laps</span><span className="font-bold">L{s.startLap}–L{s.endLap}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Length</span><span className="font-bold">{s.length} laps</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Avg Perf</span><span className="font-bold text-green-400">{(s.avgPerformance * 100).toFixed(1)}%</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Drop</span><span className="font-bold text-red-400">-{(s.performanceDrop * 100).toFixed(1)}%</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className="rounded bg-background/40 p-2">
      <div className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground uppercase">
        <Icon className="h-2.5 w-2.5" />{label}
      </div>
      <div className={cn('font-mono text-sm font-bold', color)}>{value}</div>
    </div>
  )
}
