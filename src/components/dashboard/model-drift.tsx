'use client'

import { useEffect, useState } from 'react'
import { DegradationCurve } from '@/components/charts/degradation-curve'
import { TeamBarChart } from '@/components/charts/team-bar-chart'
import { AlertTriangle, Activity, TrendingDown, Gauge, Database, CheckCircle2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const DRIFT_COLORS: Record<string, string> = {
  stable: '#22c55e',
  elevated: '#f59e0b',
  warning: '#f97316',
  critical: '#ef4444',
}

export function ModelDrift() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetch('/api/model-drift').then(r => r.json()).then(d => {
      if (active) { setData(d); setLoading(false) }
    }).catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 bg-card/40 p-8 text-center">
        <Activity className="h-6 w-6 text-muted-foreground animate-pulse mx-auto mb-2" />
        <p className="text-xs font-mono text-muted-foreground">Monitoring model drift…</p>
      </div>
    )
  }

  if (!data) return null

  const driftColor = DRIFT_COLORS[data.summary.driftStatus] || '#22c55e'

  const maeSeries = [{
    id: 'mae',
    name: 'MAE (binned)',
    color: driftColor,
    points: data.maeTimeline.map((t: any) => ({ x: t.bin, y: t.mae })),
  }]

  const baselineSeries = [{
    id: 'baseline',
    name: 'Baseline MAE',
    color: '#64748b',
    dashed: true,
    points: data.maeTimeline.map((t: any) => ({ x: t.bin, y: data.summary.baselineMAE })),
  }]

  const driverErrorData = data.driverErrors.slice(0, 8).map((d: any) => ({
    label: d.driverCode,
    value: d.mae * 1000,
    color: d.mae > 0.02 ? '#ef4444' : d.mae > 0.015 ? '#f59e0b' : '#22c55e',
  }))

  const errorHistData = data.errorBuckets.map((b: any) => ({
    label: b.range,
    value: b.count,
  }))

  return (
    <div className="space-y-4">
      {/* Drift status banner */}
      <div
        className="rounded-xl border p-4 rb-fade-up"
        style={{ borderColor: `${driftColor}40`, background: `${driftColor}10` }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl border"
              style={{ background: `${driftColor}20`, borderColor: `${driftColor}40` }}
            >
              {data.summary.driftStatus === 'stable' ? (
                <CheckCircle2 className="h-6 w-6" style={{ color: driftColor }} />
              ) : (
                <AlertCircle className="h-6 w-6 rb-live-dot" style={{ color: driftColor }} />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider" style={{ color: driftColor }}>
                  DRIFT STATUS: {data.summary.driftStatus.toUpperCase()}
                </span>
              </div>
              <div className="font-mono text-sm font-bold mt-0.5">
                Recent MAE: <span style={{ color: driftColor }}>{(data.summary.recentMAE * 100).toFixed(2)}%</span>
                <span className="text-muted-foreground"> · Baseline: {(data.summary.baselineMAE * 100).toFixed(2)}%</span>
              </div>
              <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                Drift ratio: {data.summary.driftRatio}x baseline · {data.summary.totalPredictions} predictions analyzed
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-[10px] font-mono">
            <div className="text-center">
              <div className="text-muted-foreground uppercase">Overall MAE</div>
              <div className="font-bold text-2xl" style={{ color: driftColor }}>
                {(data.summary.overallMAE * 100).toFixed(2)}%
              </div>
            </div>
            <div className="text-center">
              <div className="text-muted-foreground uppercase">Drift Ratio</div>
              <div className="font-bold text-2xl" style={{ color: driftColor }}>
                {data.summary.driftRatio}x
              </div>
            </div>
            <div className="text-center">
              <div className="text-muted-foreground uppercase">Predictions</div>
              <div className="font-bold text-2xl text-cyan-400">
                {data.summary.totalPredictions}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MAE over time */}
      <div className="rounded-xl border border-white/10 bg-card/40 p-4">
        <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-amber-400" />
          MAE OVER TIME (PREDICTION ACCURACY TREND)
        </h3>
        <DegradationCurve
          series={[...maeSeries, ...baselineSeries]}
          xLabel="Prediction Batch (10 per bin)"
          yLabel="Mean Absolute Error"
          yDomain={[0, Math.max(...data.maeTimeline.map((t: any) => t.mae), data.summary.baselineMAE) * 1.3]}
          width={900}
          height={300}
          thresholds={[
            { value: data.summary.baselineMAE, label: 'Baseline', color: '#64748b' },
            { value: data.summary.baselineMAE * 1.5, label: '1.5x threshold', color: '#f59e0b' },
            { value: data.summary.baselineMAE * 2, label: '2x critical', color: '#ef4444' },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Per-model version drift */}
        <div className="rounded-xl border border-white/10 bg-card/40 p-4">
          <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
            <Database className="h-4 w-4 text-cyan-400" />
            PER-VERSION DRIFT
          </h3>
          <div className="space-y-2">
            {data.modelDrift.map((m: any) => {
              const isBest = m.mae === Math.min(...data.modelDrift.map((x: any) => x.mae))
              const isWorst = m.mae === Math.max(...data.modelDrift.map((x: any) => x.mae))
              return (
                <div key={m.version} className={cn(
                  'rounded-lg p-2.5 border',
                  isBest ? 'border-green-500/30 bg-green-500/[0.06]' : isWorst ? 'border-red-500/30 bg-red-500/[0.06]' : 'border-white/5 bg-background/30'
                )}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold">{m.version}</span>
                      {isBest && <span className="rb-chip bg-green-500/15 text-green-300 border border-green-500/30">BEST</span>}
                      {isWorst && <span className="rb-chip bg-red-500/15 text-red-300 border border-red-500/30">WORST</span>}
                    </div>
                    <span className="text-[9px] font-mono text-muted-foreground">{m.count} predictions</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-[9px] font-mono">
                    <div><span className="text-muted-foreground">MAE</span> <span className="font-bold text-amber-400">{(m.mae * 100).toFixed(2)}%</span></div>
                    <div><span className="text-muted-foreground">RMSE</span> <span className="font-bold">{(m.rmse * 100).toFixed(2)}%</span></div>
                    <div><span className="text-muted-foreground">Max</span> <span className="font-bold text-red-400">{(m.maxError * 100).toFixed(2)}%</span></div>
                    <div><span className="text-muted-foreground">±0.02</span> <span className="font-bold text-green-400">{m.accuracyWithin02}%</span></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Per-driver error */}
        <div className="rounded-xl border border-white/10 bg-card/40 p-4">
          <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
            <Gauge className="h-4 w-4 text-red-400" />
            PER-DRIVER PREDICTION ERROR
          </h3>
          <TeamBarChart
            data={driverErrorData}
            yLabel="MAE (×0.001)"
            width={560}
            height={280}
            horizontal
          />
        </div>
      </div>

      {/* Error distribution */}
      <div className="rounded-xl border border-white/10 bg-card/40 p-4">
        <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          ERROR DISTRIBUTION
        </h3>
        <TeamBarChart
          data={errorHistData}
          yLabel="Count"
          width={900}
          height={240}
        />
        <p className="mt-2 text-[10px] font-mono text-muted-foreground">
          Error buckets in absolute performance delta (0.00-0.01, 0.01-0.02, etc.)
        </p>
      </div>
    </div>
  )
}
