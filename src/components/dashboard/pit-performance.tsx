'use client'

import { useEffect, useState } from 'react'
import { DegradationCurve } from '@/components/charts/degradation-curve'
import { TeamBarChart } from '@/components/charts/team-bar-chart'
import { Clock, Gauge, Trophy, TrendingDown, TrendingUp, AlertTriangle, CheckCircle2, XCircle, Target, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

export function PitPerformance() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetch('/api/pit-performance').then(r => r.json()).then(d => {
      if (active) { setData(d); setLoading(false) }
    }).catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  if (loading || !data) {
    return (
      <div className="rounded-xl border border-white/10 bg-card/40 p-8 text-center">
        <Clock className="h-6 w-6 text-muted-foreground animate-pulse mx-auto mb-2" />
        <p className="text-xs font-mono text-muted-foreground">Analyzing pit stop performance…</p>
      </div>
    )
  }

  const s = data.summary

  // Build series for error trend over races
  const errorTrendSeries = [{
    id: 'error',
    name: 'Avg Timing Error',
    color: '#f59e0b',
    points: data.racePerformance.map((r: any, i: number) => ({ x: i + 1, y: r.avgError })),
  }]
  const optimalRateSeries = [{
    id: 'optimal',
    name: 'Optimal Rate %',
    color: '#22c55e',
    points: data.racePerformance.map((r: any, i: number) => ({ x: i + 1, y: r.optimalRate })),
  }]

  // Driver error bar chart data
  const driverErrorData = data.driverPerformance.slice(0, 10).map((d: any) => ({
    label: d.code,
    value: d.avgError,
    color: d.isRB ? '#ef4444' : d.avgError < 1 ? '#22c55e' : d.avgError < 2 ? '#f59e0b' : '#f97316',
  }))

  // Error distribution bar chart
  const errorDistData = data.errorBuckets.map((b: any) => ({
    label: b.range,
    value: b.count,
    color: b.color,
  }))

  return (
    <div className="space-y-4">
      {/* Summary KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rb-card-glass rounded-xl border border-white/10 p-3 rb-lift rb-stagger rb-delay-1">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground uppercase mb-1">
            <Clock className="h-3 w-3 text-cyan-400" />TOTAL STOPS
          </div>
          <div className="font-mono text-xl font-bold text-cyan-400">{s.totalStops}</div>
        </div>
        <div className="rb-card-glass rounded-xl border border-white/10 p-3 rb-lift rb-stagger rb-delay-2">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground uppercase mb-1">
            <Gauge className="h-3 w-3 text-amber-400" />AVG ERROR
          </div>
          <div className="font-mono text-xl font-bold text-amber-400">{s.avgTimingError}</div>
          <div className="text-[9px] font-mono text-muted-foreground">laps</div>
        </div>
        <div className="rb-card-glass rounded-xl border border-white/10 p-3 rb-lift rb-stagger rb-delay-3">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground uppercase mb-1">
            <Trophy className="h-3 w-3 text-green-400" />OPTIMAL
          </div>
          <div className="font-mono text-xl font-bold text-green-400">{s.optimalRate}%</div>
          <div className="text-[9px] font-mono text-muted-foreground">{s.optimalCount} stops</div>
        </div>
        <div className="rb-card-glass rounded-xl border border-white/10 p-3 rb-lift rb-stagger rb-delay-4">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground uppercase mb-1">
            <CheckCircle2 className="h-3 w-3 text-cyan-400" />EXECUTED
          </div>
          <div className="font-mono text-xl font-bold text-cyan-400">{s.executedCount}</div>
        </div>
        <div className="rb-card-glass rounded-xl border border-white/10 p-3 rb-lift rb-stagger rb-delay-5">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground uppercase mb-1">
            <XCircle className="h-3 w-3 text-red-400" />MISSED
          </div>
          <div className="font-mono text-xl font-bold text-red-400">{s.missedCount}</div>
        </div>
        <div className="rb-card-glass rounded-xl border border-white/10 p-3 rb-lift rb-stagger rb-delay-6">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground uppercase mb-1">
            <TrendingDown className="h-3 w-3 text-red-400" />TIME LOST
          </div>
          <div className="font-mono text-xl font-bold text-red-400">{s.totalTimeLost}s</div>
          <div className="text-[9px] font-mono text-muted-foreground">est. total</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Error trend over races */}
        <div className="rounded-xl border border-white/10 bg-card/40 p-4">
          <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-amber-400" />
            TIMING ERROR TREND (BY RACE)
          </h3>
          <DegradationCurve
            series={errorTrendSeries}
            xLabel="Race"
            yLabel="Avg Error (laps)"
            width={560}
            height={260}
            thresholds={[{ value: 1, label: '±1 target', color: '#22c55e' }, { value: 2, label: '±2 warn', color: '#f59e0b' }]}
          />
        </div>

        {/* Optimal rate trend */}
        <div className="rounded-xl border border-white/10 bg-card/40 p-4">
          <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-400" />
            OPTIMAL RATE TREND (BY RACE)
          </h3>
          <DegradationCurve
            series={optimalRateSeries}
            xLabel="Race"
            yLabel="Optimal Rate (%)"
            yDomain={[0, 100]}
            width={560}
            height={260}
            thresholds={[{ value: 60, label: '60% target', color: '#f59e0b' }]}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Per-driver error bar chart */}
        <div className="rounded-xl border border-white/10 bg-card/40 p-4">
          <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
            <Gauge className="h-4 w-4 text-amber-400" />
            AVG ERROR BY DRIVER
          </h3>
          <TeamBarChart
            data={driverErrorData}
            yLabel="Avg Error (laps)"
            width={560}
            height={280}
            horizontal
          />
        </div>

        {/* Error distribution */}
        <div className="rounded-xl border border-white/10 bg-card/40 p-4">
          <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            ERROR DISTRIBUTION
          </h3>
          <TeamBarChart
            data={errorDistData}
            yLabel="Count"
            width={560}
            height={280}
          />
        </div>
      </div>

      {/* Driver performance table */}
      <div className="rounded-xl border border-white/10 bg-card/40 p-4">
        <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
          <Target className="h-4 w-4 text-red-400" />
          DRIVER PIT PERFORMANCE BREAKDOWN
        </h3>
        <div className="overflow-x-auto rb-scroll">
          <table className="w-full text-[10px] font-mono">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-white/10">
                <th className="pb-2 pr-3">RANK</th>
                <th className="pb-2 pr-3">DRIVER</th>
                <th className="pb-2 pr-3">TEAM</th>
                <th className="pb-2 pr-3">STOPS</th>
                <th className="pb-2 pr-3">AVG ERROR</th>
                <th className="pb-2 pr-3">OPTIMAL</th>
                <th className="pb-2 pr-3">EXECUTED</th>
                <th className="pb-2 pr-3">MISSED</th>
                <th className="pb-2 pr-3">OPT RATE</th>
                <th className="pb-2 pr-3">CONF</th>
                <th className="pb-2">BEST/WORST</th>
              </tr>
            </thead>
            <tbody>
              {data.driverPerformance.map((d: any, i: number) => (
                <tr key={d.code} className={cn(
                  'border-b border-white/5 hover:bg-white/[0.03] transition-colors',
                  d.isRB && 'bg-red-500/[0.04]'
                )}>
                  <td className="py-1.5 pr-3">
                    <span className={cn(
                      'inline-flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold',
                      i === 0 ? 'bg-green-400 text-black' : i === 1 ? 'bg-slate-300 text-black' : 'bg-white/10'
                    )}>{i + 1}</span>
                  </td>
                  <td className="py-1.5 pr-3 font-bold">
                    <span className="flex items-center gap-1.5">
                      {d.isRB && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
                      {d.code}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 text-muted-foreground">{d.team.split(' ').slice(-1)[0]}</td>
                  <td className="py-1.5 pr-3">{d.totalStops}</td>
                  <td className={cn('py-1.5 pr-3 font-bold', d.avgError < 1 ? 'text-green-400' : d.avgError < 2 ? 'text-amber-400' : 'text-red-400')}>
                    ±{d.avgError}
                  </td>
                  <td className="py-1.5 pr-3 text-green-400">{d.optimalCount}</td>
                  <td className="py-1.5 pr-3 text-cyan-400">{d.executedCount}</td>
                  <td className="py-1.5 pr-3 text-red-400">{d.missedCount}</td>
                  <td className="py-1.5 pr-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-background/60 overflow-hidden">
                        <div className="h-full rounded-full rb-fill" style={{ width: `${d.optimalRate}%`, background: d.optimalRate >= 60 ? '#22c55e' : '#f59e0b' }} />
                      </div>
                      <span className="font-bold">{d.optimalRate}%</span>
                    </div>
                  </td>
                  <td className="py-1.5 pr-3 text-cyan-400">{(d.avgConfidence * 100).toFixed(0)}%</td>
                  <td className="py-1.5">
                    <span className="text-green-400">{d.bestStop}</span>
                    <span className="text-muted-500">/</span>
                    <span className="text-red-400">{d.worstStop}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-race performance */}
      <div className="rounded-xl border border-white/10 bg-card/40 p-4">
        <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-400" />
          PER-RACE PIT PERFORMANCE
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {data.racePerformance.map((r: any) => (
            <div key={r.raceName} className="rounded-lg bg-background/30 p-3 border border-white/5 rb-lift">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono font-bold truncate">{r.raceName?.replace(' Grand Prix', ' GP')}</span>
                <span className="text-[9px] font-mono text-muted-foreground">{new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[9px] font-mono">
                <div>
                  <span className="text-muted-foreground">AVG ERR:</span>
                  <span className={cn('font-bold ml-1', r.avgError < 1 ? 'text-green-400' : 'text-amber-400')}>±{r.avgError}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">STOPS:</span>
                  <span className="font-bold ml-1">{r.totalStops}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">OPTIMAL:</span>
                  <span className="font-bold text-green-400 ml-1">{r.optimalCount} ({r.optimalRate}%)</span>
                </div>
                <div>
                  <span className="text-muted-foreground">MISSED:</span>
                  <span className="font-bold text-red-400 ml-1">{r.missedCount}</span>
                </div>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-background/60 overflow-hidden">
                <div className="h-full rounded-full rb-fill" style={{ width: `${r.optimalRate}%`, background: r.optimalRate >= 50 ? '#22c55e' : '#f59e0b' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
