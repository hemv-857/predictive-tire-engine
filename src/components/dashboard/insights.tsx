'use client'

import { useEffect, useState } from 'react'
import { TeamBarChart } from '@/components/charts/team-bar-chart'
import { Brain, AlertTriangle, AlertCircle, Info, TrendingUp, Gauge, Zap, Thermometer, Activity, Award, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  raceId: string | null
}

const SEV_CONFIG = {
  critical: { color: '#ef4444', bg: 'bg-red-500/10', border: 'border-red-500/40', icon: AlertCircle, label: 'CRITICAL' },
  warning: { color: '#f59e0b', bg: 'bg-amber-500/10', border: 'border-amber-500/40', icon: AlertTriangle, label: 'WARNING' },
  info: { color: '#06b6d4', bg: 'bg-cyan-500/10', border: 'border-cyan-500/40', icon: Info, label: 'INFO' },
}

const TYPE_ICONS: Record<string, any> = {
  lap_spike: Clock,
  perf_critical: Activity,
  overheating: Thermometer,
  high_slip: Gauge,
}

const RATING_COLORS: Record<string, string> = {
  excellent: '#22c55e',
  good: '#a3e635',
  fair: '#f59e0b',
  poor: '#ef4444',
}

function Clock({ className }: { className?: string }) {
  return <Activity className={className} />
}

export function Insights({ raceId }: Props) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<string>('all')
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!raceId) return
    let active = true
    fetch(`/api/insights?raceId=${raceId}`)
      .then(r => r.json())
      .then(d => { if (active) { setData(d); setLoading(false) } })
      .catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [raceId])

  if (loading || !data) {
    return (
      <div className="rounded-xl border border-white/10 bg-card/40 p-8 text-center">
        <Brain className="h-6 w-6 text-muted-foreground animate-pulse mx-auto mb-2" />
        <p className="text-xs font-mono text-muted-foreground">Detecting anomalies and patterns…</p>
      </div>
    )
  }

  const visibleAnomalies = data.anomalies.filter((a: any) => !dismissed.has(`${a.driverCode}-${a.lap}-${a.type}`) && (filter === 'all' || a.severity === filter))

  const driverRatingData = data.insights.slice(0, 10).map((d: any) => ({
    label: d.driverCode,
    value: d.consistency * 100,
    color: d.isRB ? '#ef4444' : RATING_COLORS[d.rating] || '#888',
  }))

  const compoundData = data.compoundStats.map((c: any) => ({
    label: c.compound,
    value: c.avgPerf * 100,
    color: c.compound === 'Soft' ? '#ef4444' : c.compound === 'Medium' ? '#f59e0b' : '#e2e8f0',
  }))

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-white/10 bg-card/40 rb-card-glass">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-red-400" />
          <span className="text-xs font-mono font-bold">PERFORMANCE INSIGHTS</span>
        </div>
        <div className="flex-1" />
        <span className="rb-chip bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
          <Activity className="h-2.5 w-2.5" /> {data.summary.totalDrivers} drivers · {data.summary.totalLaps} laps
        </span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rb-card-glass rounded-xl border border-red-500/30 bg-red-500/[0.06] p-3 rb-lift rb-stagger rb-delay-1">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground uppercase mb-1">
            <AlertCircle className="h-3 w-3 text-red-400" />CRITICAL ANOMALIES
          </div>
          <div className="font-mono text-xl font-bold text-red-400 rb-neon-red">{data.summary.criticalCount}</div>
        </div>
        <div className="rb-card-glass rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3 rb-lift rb-stagger rb-delay-2">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground uppercase mb-1">
            <AlertTriangle className="h-3 w-3 text-amber-400" />WARNINGS
          </div>
          <div className="font-mono text-xl font-bold text-amber-400">{data.summary.warningCount}</div>
        </div>
        <div className="rb-card-glass rounded-xl border border-green-500/30 bg-green-500/[0.06] p-3 rb-lift rb-stagger rb-delay-3">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground uppercase mb-1">
            <Award className="h-3 w-3 text-green-400" />BEST DRIVER
          </div>
          <div className="font-mono text-xl font-bold text-green-400">{data.summary.bestDriver}</div>
          <div className="text-[9px] font-mono text-muted-foreground">most consistent</div>
        </div>
        <div className="rb-card-glass rounded-xl border border-cyan-500/30 bg-cyan-500/[0.06] p-3 rb-lift rb-stagger rb-delay-4">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground uppercase mb-1">
            <TrendingUp className="h-3 w-3 text-cyan-400" />FIELD AVG LAP
          </div>
          <div className="font-mono text-xl font-bold text-cyan-400">{data.summary.fieldAvgLap}</div>
          <div className="text-[9px] font-mono text-muted-foreground">seconds</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Anomaly feed */}
        <div className="rounded-xl border border-white/10 bg-card/40 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold font-mono flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              ANOMALY FEED
            </h3>
            <div className="flex items-center gap-1">
              {['all', 'critical', 'warning'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'rounded px-2 py-0.5 text-[9px] font-mono font-bold uppercase transition-colors',
                    filter === f ? 'bg-red-500/20 border border-red-500/40 text-red-300' : 'bg-background/40 border border-white/5 text-muted-foreground'
                  )}
                >{f}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5 max-h-[400px] overflow-y-auto rb-scroll">
            {visibleAnomalies.length === 0 ? (
              <div className="text-center py-8">
                <Info className="h-6 w-6 text-green-400 mx-auto mb-2" />
                <p className="text-xs font-mono text-green-400">No anomalies detected</p>
              </div>
            ) : visibleAnomalies.map((a: any, i: number) => {
              const cfg = SEV_CONFIG[a.severity as keyof typeof SEV_CONFIG] || SEV_CONFIG.warning
              const Icon = cfg.icon
              const TypeIcon = TYPE_ICONS[a.type] || Activity
              return (
                <div key={i} className={cn('rb-fade-up relative rounded-lg p-2.5 border', cfg.bg, cfg.border)}>
                  <div className="absolute left-0 top-0 h-full w-0.5" style={{ background: cfg.color }} />
                  <div className="flex items-start gap-2">
                    <TypeIcon className={cn('h-3.5 w-3.5 shrink-0 mt-0.5', a.severity === 'critical' && 'rb-live-dot')} style={{ color: cfg.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[9px] font-mono font-bold" style={{ color: cfg.color }}>{cfg.label}</span>
                        <span className="rb-chip bg-background/40 text-foreground">{a.driverCode}</span>
                        <span className="text-[9px] font-mono text-muted-foreground">L{a.lap}</span>
                      </div>
                      <p className="text-[10px] font-mono text-muted-foreground leading-tight">{a.message}</p>
                    </div>
                    <button
                      onClick={() => setDismissed(prev => new Set([...prev, `${a.driverCode}-${a.lap}-${a.type}`]))}
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Driver insights table */}
        <div className="rounded-xl border border-white/10 bg-card/40 p-4">
          <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
            <Gauge className="h-4 w-4 text-cyan-400" />
            DRIVER PERFORMANCE INSIGHTS
          </h3>
          <div className="space-y-1.5 max-h-[400px] overflow-y-auto rb-scroll">
            {data.insights.map((d: any, i: number) => (
              <div key={d.driverCode} className={cn(
                'rounded-lg p-2.5 border transition-colors',
                d.isRB ? 'bg-red-500/[0.06] border-red-500/20' : 'bg-background/30 border-white/5'
              )}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold',
                      i === 0 ? 'bg-green-400 text-black' : 'bg-white/10'
                    )}>{i + 1}</span>
                    <span className="font-mono text-xs font-bold">{d.driverCode}</span>
                    {d.isRB && <span className="rb-chip bg-red-500/20 text-red-300 border border-red-500/30 text-[8px]">RB</span>}
                  </div>
                  <span className="rb-chip border" style={{ background: `${RATING_COLORS[d.rating]}15`, color: RATING_COLORS[d.rating], borderColor: `${RATING_COLORS[d.rating]}40` }}>
                    {d.rating.toUpperCase()}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1 text-[9px] font-mono">
                  <div><span className="text-muted-foreground">AVG LAP</span><div className="font-bold text-cyan-400">{d.avgLap}</div></div>
                  <div><span className="text-muted-foreground">BEST</span><div className="font-bold text-green-400">{d.bestLap}</div></div>
                  <div><span className="text-muted-foreground">σ CONS</span><div className="font-bold text-amber-400">{d.consistency}</div></div>
                  <div><span className="text-muted-foreground">ANOM</span><div className={cn('font-bold', d.anomalyCount > 3 ? 'text-red-400' : d.anomalyCount > 0 ? 'text-amber-400' : 'text-green-400')}>{d.anomalyCount}</div></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Consistency comparison */}
        <div className="rounded-xl border border-white/10 bg-card/40 p-4">
          <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
            <Gauge className="h-4 w-4 text-green-400" />
            CONSISTENCY RANKING (σ × 100)
          </h3>
          <TeamBarChart
            data={driverRatingData}
            yLabel="Consistency σ × 100"
            width={560}
            height={260}
            horizontal
          />
        </div>

        {/* Compound performance */}
        <div className="rounded-xl border border-white/10 bg-card/40 p-4">
          <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-400" />
            COMPOUND PERFORMANCE COMPARISON
          </h3>
          <TeamBarChart
            data={compoundData}
            yLabel="Avg Performance %"
            unit="%"
            width={560}
            height={260}
          />
        </div>
      </div>
    </div>
  )
}
