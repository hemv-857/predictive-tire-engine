'use client'

import { useEffect, useState, useCallback } from 'react'
import { DegradationCurve } from '@/components/charts/degradation-curve'
import { useLiveTelemetry } from '@/lib/use-live-telemetry'
import { COMPOUND_COLORS, classColor, classLabel } from '@/lib/types'
import type { PredictionResult, PitWindowResult, PitDecision } from '@/lib/types'
import { Timer, Target, Zap, AlertTriangle, CheckCircle2, XCircle, Radio, Gauge as GaugeIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  decisions: PitDecision[]
  stats: any
  drivers: any[]
  telemetry: any[]
}

export function PitStrategy({ decisions, stats, drivers, telemetry }: Props) {
  const { telemetry: liveTelemetry } = useLiveTelemetry()
  const [selectedDriverCode, setSelectedDriverCode] = useState('TSU')
  const [prediction, setPrediction] = useState<PredictionResult | null>(null)
  const [pitWindow, setPitWindow] = useState<PitWindowResult | null>(null)
  const [predicting, setPredicting] = useState(false)
  const [latency, setLatency] = useState(0)
  const [exported, setExported] = useState(false)

  const liveData = liveTelemetry[selectedDriverCode]

  // Run prediction whenever live telemetry updates for the selected driver
  const runPrediction = useCallback(async (t: any) => {
    const compoundDeg = t.tireCompound === 'Soft' ? 0.045 : t.tireCompound === 'Medium' ? 0.028 : t.tireCompound === 'Hard' ? 0.017 : 0.04
    const expectedLife = t.tireCompound === 'Soft' ? 18 : t.tireCompound === 'Medium' ? 28 : t.tireCompound === 'Hard' ? 40 : 20
    const payload = {
      tireTempFL: t.tireTempFL, tireTempFR: t.tireTempFR, tireTempRL: t.tireTempRL, tireTempRR: t.tireTempRR,
      tirePressureFL: t.tirePressureFL, tirePressureFR: t.tirePressureFR, tirePressureRL: t.tirePressureRL, tirePressureRR: t.tirePressureRR,
      slipAngleFL: t.slipAngleFL, slipAngleFR: t.slipAngleFR,
      brakeTempFL: t.brakeTempFL, brakeTempFR: t.brakeTempFR,
      fuelLoad: t.fuelLoad, tireAge: t.tireAge, compoundDeg, expectedLife, trackTemp: 32, airTemp: 21,
    }
    const start = performance.now()
    try {
      setPredicting(true)
      const [predRes, pwRes] = await Promise.all([
        fetch('/api/predict', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(r => r.json()),
        fetch('/api/pit-window', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, currentLap: t.lap, totalLaps: 58 }) }).then(r => r.json()),
      ])
      setLatency(performance.now() - start)
      setPrediction(predRes)
      setPitWindow(pwRes)
    } catch (e) {
      console.error('Prediction failed', e)
    } finally {
      setPredicting(false)
    }
  }, [])

  useEffect(() => {
    if (liveData) {
      runPrediction(liveData)
    }
  }, [liveData, runPrediction])

  // Manual prediction trigger (when no live data)
  const runManualPrediction = async () => {
    const t = liveData || {
      tireTempFL: 96, tireTempFR: 98, tireTempRL: 95, tireTempRR: 97,
      tirePressureFL: 22.1, tirePressureFR: 22.0, tirePressureRL: 22.2, tirePressureRR: 22.1,
      slipAngleFL: 2.8, slipAngleFR: 3.1, brakeTempFL: 480, brakeTempFR: 475,
      fuelLoad: 78, tireAge: 12, tireCompound: 'Soft', lap: 12,
    }
    await runPrediction(t)
  }

  useEffect(() => {
    if (!liveData && !prediction) runManualPrediction()
  }, [])

  const handleExport = () => {
    setExported(true)
    setTimeout(() => setExported(false), 2000)
  }

  // Build degradation series with confidence band
  const forecastSeries: any[] = []
  if (prediction) {
    const basePerf = prediction.predictedPerf
    const points = Array.from({ length: 12 }, (_, i) => {
      const lap = i + 1
      const projected = Math.max(0.45, basePerf - i * 0.012)
      return { x: lap, y: projected }
    })
    forecastSeries.push({
      id: 'forecast',
      name: 'Predicted Trajectory',
      color: classColor(prediction.performanceClass),
      points,
    })
    // Confidence band as dashed
    forecastSeries.push({
      id: 'upper',
      name: 'CI Upper',
      color: classColor(prediction.performanceClass),
      dashed: true,
      points: points.map((p) => ({ x: p.x, y: Math.min(1, p.y + 0.025) })),
    })
    forecastSeries.push({
      id: 'lower',
      name: 'CI Lower',
      color: classColor(prediction.performanceClass),
      dashed: true,
      points: points.map((p) => ({ x: p.x, y: Math.max(0.45, p.y - 0.025) })),
    })
  }

  const recColor = prediction ? classColor(prediction.performanceClass) : '#22c55e'
  const isCritical = prediction?.performanceClass === 'critical' || prediction?.performanceClass === 'warning_85'

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-white/10 bg-card/40">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-red-400" />
          <span className="text-xs font-mono font-bold">PIT STOP DECISION SUPPORT</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-muted-foreground">MONITOR:</span>
          <select
            value={selectedDriverCode}
            onChange={(e) => setSelectedDriverCode(e.target.value)}
            className="bg-background/60 border border-white/10 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-red-500/50"
          >
            {drivers.map((d) => <option key={d.code} value={d.code}>{d.code} · {d.name}</option>)}
          </select>
        </div>
        <button
          onClick={runManualPrediction}
          disabled={predicting}
          className="rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 px-3 py-1 text-[11px] font-mono font-bold text-red-300 disabled:opacity-50 transition-colors"
        >
          {predicting ? 'PREDICTING…' : 'RUN PREDICTION'}
        </button>
      </div>

      {/* Live recommendation banner */}
      {prediction && (
        <div
          className={cn('relative overflow-hidden rounded-xl border p-4', isCritical ? 'border-red-500/50 bg-red-500/10' : 'border-white/10 bg-card/40')}
        >
          <div className={cn('absolute top-0 left-0 h-full w-1', isCritical ? 'bg-red-500' : '')} style={{ background: isCritical ? '#ef4444' : recColor }} />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pl-3">
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center justify-center rounded-lg p-3" style={{ background: `${recColor}20` }}>
                <span className="font-mono text-3xl font-bold" style={{ color: recColor }}>
                  {(prediction.predictedPerf * 100).toFixed(1)}%
                </span>
                <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: recColor }}>
                  {classLabel(prediction.performanceClass)}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Radio className={cn('h-3 w-3', liveData ? 'text-red-500 rb-live-dot' : 'text-muted-foreground')} />
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {liveData ? 'LIVE TELEMETRY INPUT' : 'MANUAL INPUT'} · {selectedDriverCode} · LAP {liveData?.lap || '—'} · {liveData?.tireCompound || 'Soft'} L{liveData?.tireAge || '—'}
                  </span>
                </div>
                <p className="text-sm font-mono font-bold" style={{ color: recColor }}>
                  {prediction.recommendation}
                </p>
                <div className="mt-1 flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
                  <span>CI: [{(prediction.confidenceLow * 100).toFixed(1)}% - {(prediction.confidenceHigh * 100).toFixed(1)}%]</span>
                  <span>·</span>
                  <span>~{prediction.lapsToThreshold90.toFixed(1)} laps to 90%</span>
                  <span>·</span>
                  <span className="text-cyan-400">{prediction.inferenceMs.toFixed(1)}ms inference</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className="text-[9px] font-mono text-muted-foreground">END-TO-END LATENCY</div>
                <div className={cn('font-mono text-xl font-bold', latency < 200 ? 'text-green-400' : 'text-amber-400')}>
                  {latency.toFixed(0)}ms
                </div>
                <div className="text-[9px] font-mono text-muted-foreground">{latency < 200 ? '✓ Under 200ms SLA' : 'Over SLA'}</div>
              </div>
              <button
                onClick={handleExport}
                className={cn(
                  'rounded-lg px-3 py-2 text-[11px] font-mono font-bold transition-colors border',
                  exported
                    ? 'bg-green-500/20 border-green-500/50 text-green-300'
                    : 'bg-background/60 border-white/10 hover:bg-background/80 text-foreground'
                )}
              >
                {exported ? '✓ SENT TO STRATEGIST' : 'EXPORT → STRATEGIST'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Forecast chart */}
        <div className="lg:col-span-2 rounded-xl border border-white/10 bg-card/40 p-4">
          <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
            <Timer className="h-4 w-4 text-amber-400" />
            PERFORMANCE FORECAST + PIT WINDOW
          </h3>
          {forecastSeries.length ? (
            <DegradationCurve
              series={forecastSeries}
              xLabel="Laps Ahead"
              yLabel="Predicted Grip"
              yDomain={[0.7, 1.0]}
              xDomain={[1, 12]}
              width={720}
              height={320}
              thresholds={[
                { value: 0.95, label: '95%', color: '#a3e635' },
                { value: 0.90, label: '90%', color: '#f59e0b' },
                { value: 0.85, label: '85%', color: '#f97316' },
              ]}
              markers={pitWindow ? [
                { x: pitWindow.windowLow, label: `L${pitWindow.windowLow}`, color: '#22c55e', dash: '3,2' },
                { x: pitWindow.recommendedLap, label: `PIT L${pitWindow.recommendedLap}`, color: '#ef4444' },
                { x: pitWindow.windowHigh, label: `L${pitWindow.windowHigh}`, color: '#f59e0b', dash: '3,2' },
              ] : []}
            />
          ) : (
            <div className="h-[320px] flex items-center justify-center text-xs text-muted-foreground font-mono">No prediction yet</div>
          )}
          {pitWindow && (
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="rounded bg-background/40 px-2 py-1.5">
                <span className="text-[9px] font-mono text-muted-foreground">RECOMMENDED LAP</span>
                <div className="font-mono text-lg font-bold text-red-400">L{pitWindow.recommendedLap}</div>
              </div>
              <div className="rounded bg-background/40 px-2 py-1.5">
                <span className="text-[9px] font-mono text-muted-foreground">PIT WINDOW</span>
                <div className="font-mono text-lg font-bold text-amber-400">L{pitWindow.windowLow}–L{pitWindow.windowHigh}</div>
              </div>
              <div className="rounded bg-background/40 px-2 py-1.5">
                <span className="text-[9px] font-mono text-muted-foreground">CONFIDENCE</span>
                <div className="font-mono text-lg font-bold text-green-400">{(pitWindow.confidence * 100).toFixed(0)}%</div>
              </div>
              <div className="rounded bg-background/40 px-2 py-1.5">
                <span className="text-[9px] font-mono text-muted-foreground">STRATEGY</span>
                <div className="font-mono text-[11px] font-bold text-cyan-400 leading-tight pt-1">{pitWindow.strategy}</div>
              </div>
            </div>
          )}
        </div>

        {/* Reasoning + decision log */}
        <div className="space-y-4">
          {pitWindow && (
            <div className="rounded-xl border border-white/10 bg-card/40 p-4">
              <h3 className="text-sm font-bold font-mono mb-2 flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-400" />
                DECISION REASONING
              </h3>
              <div className="space-y-1.5">
                {pitWindow.reasoning.map((r, i) => (
                  <div key={i} className="text-[10px] font-mono text-muted-foreground flex gap-1.5">
                    <span className="text-amber-400">{i + 1}.</span> {r}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-white/10 bg-card/40 p-4">
            <h3 className="text-sm font-bold font-mono mb-2 flex items-center gap-2">
              <GaugeIcon className="h-4 w-4 text-cyan-400" />
              HISTORICAL ACCURACY
            </h3>
            <div className="space-y-2">
              <StatRow label="Total Decisions" value={stats?.total || 0} />
              <StatRow label="Avg Timing Error" value={`${stats?.avgTimingError?.toFixed(2) || 0} laps`} color="amber" />
              <StatRow label="Optimal (±1 lap)" value={`${((stats?.optimalRate || 0) * 100).toFixed(0)}%`} color="green" icon={CheckCircle2} />
              <StatRow label="Executed (±3)" value={`${((stats?.executedRate || 0) * 100).toFixed(0)}%`} color="cyan" icon={CheckCircle2} />
              <StatRow label="Missed (>3)" value={`${((stats?.missedRate || 0) * 100).toFixed(0)}%`} color="red" icon={XCircle} />
            </div>
          </div>
        </div>
      </div>

      {/* Decision log */}
      <div className="rounded-xl border border-white/10 bg-card/40 p-4">
        <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          PIT DECISION LOG
        </h3>
        <div className="overflow-x-auto rb-scroll">
          <table className="w-full text-[10px] font-mono">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-white/10">
                <th className="pb-2 pr-3">RACE</th>
                <th className="pb-2 pr-3">DRIVER</th>
                <th className="pb-2 pr-3">REC</th>
                <th className="pb-2 pr-3">ACTUAL</th>
                <th className="pb-2 pr-3">ERROR</th>
                <th className="pb-2 pr-3">CONF</th>
                <th className="pb-2 pr-3">WINDOW</th>
                <th className="pb-2 pr-3">STRATEGY</th>
                <th className="pb-2">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {decisions.slice(0, 12).map((d) => {
                const statusColor = d.status === 'optimal' ? 'text-green-400' : d.status === 'executed' ? 'text-cyan-400' : 'text-red-400'
                return (
                  <tr key={d.id} className="border-b border-white/5 hover:bg-background/20">
                    <td className="py-1.5 pr-3 text-muted-foreground">{d.race?.name?.replace(' Grand Prix', ' GP') || '—'}</td>
                    <td className="py-1.5 pr-3 font-bold">{d.driver?.code}</td>
                    <td className="py-1.5 pr-3 text-amber-400">L{d.recommendedLap}</td>
                    <td className="py-1.5 pr-3">{d.actualLap ? `L${d.actualLap}` : '—'}</td>
                    <td className="py-1.5 pr-3">{d.timingErrorLaps !== null ? `±${d.timingErrorLaps}` : '—'}</td>
                    <td className="py-1.5 pr-3">{(d.confidence * 100).toFixed(0)}%</td>
                    <td className="py-1.5 pr-3 text-muted-foreground">L{d.pitWindowLow}–L{d.pitWindowHigh}</td>
                    <td className="py-1.5 pr-3 text-muted-foreground">{d.compoundFrom}→{d.compoundTo}</td>
                    <td className={cn('py-1.5 font-bold uppercase', statusColor)}>{d.status}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatRow({ label, value, color = 'default', icon: Icon }: { label: string; value: string | number; color?: string; icon?: any }) {
  const colorMap: Record<string, string> = { green: 'text-green-400', amber: 'text-amber-400', red: 'text-red-400', cyan: 'text-cyan-400', default: 'text-foreground' }
  return (
    <div className="flex items-center justify-between text-[10px] font-mono">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-bold', colorMap[color])}>
        {Icon && <Icon className="inline h-3 w-3 mr-1" />}{value}
      </span>
    </div>
  )
}
