'use client'

import { useEffect, useState } from 'react'
import { GitCompare, Trophy, Clock, Gauge, TrendingUp, Users, Zap, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'

const TEAM_COLORS: Record<string, string> = {
  'Red Bull Racing': '#1e3a8a',
  'Ferrari': '#dc2626',
  'Mercedes': '#22c55e',
  'McLaren': '#f97316',
  'Apex Racing': '#ef4444',
  'Aston Martin': '#16a34a',
  'Alpine': '#3b82f6',
  'Williams': '#0ea5e9',
  'Kick Sauber': '#22c55e',
  'Haas': '#e5e7eb',
}

interface Props {
  raceId: string | null
}

export function StrategyComparison({ raceId }: Props) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!raceId) return
    let active = true
    fetch(`/api/strategy-comparison?raceId=${raceId}`)
      .then(r => r.json())
      .then(d => { if (active) { setData(d); setLoading(false) } })
      .catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [raceId])

  if (loading || !data) {
    return (
      <div className="rounded-xl border border-white/10 bg-card/40 p-8 text-center">
        <GitCompare className="h-6 w-6 text-muted-foreground animate-pulse mx-auto mb-2" />
        <p className="text-xs font-mono text-muted-foreground">Loading strategy comparison…</p>
      </div>
    )
  }

  const maxTotalTime = Math.max(...data.drivers.map((d: any) => d.totalTime))
  const minTotalTime = Math.min(...data.drivers.map((d: any) => d.totalTime))

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-white/10 bg-card/40 rb-card-glass">
        <div className="flex items-center gap-2">
          <GitCompare className="h-4 w-4 text-red-400" />
          <span className="text-xs font-mono font-bold">RACE STRATEGY COMPARISON</span>
        </div>
        <div className="flex-1" />
        <span className="rb-chip bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
          <Users className="h-2.5 w-2.5" /> {data.summary.totalDrivers} drivers
        </span>
        <span className="rb-chip bg-amber-500/15 text-amber-300 border border-amber-500/30">
          <Trophy className="h-2.5 w-2.5" /> Fastest: {data.summary.fastestDriver}
        </span>
      </div>

      {/* Strategy distribution cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(data.summary.strategyDistribution).map(([strat, count]: any) => {
          const colors: Record<string, string> = { 'one-stop': '#22c55e', 'two-stop': '#f59e0b', 'three-stop': '#ef4444' }
          return (
            <div key={strat} className="rb-card-glass rounded-xl p-3 rb-lift rb-stagger" style={{ animationDelay: `${Math.random() * 0.2}s` }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono font-bold uppercase" style={{ color: colors[strat] }}>{strat}</span>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: colors[strat] }} />
              </div>
              <div className="font-mono text-2xl font-bold" style={{ color: colors[strat] }}>{count}</div>
              <div className="text-[9px] font-mono text-muted-foreground">drivers</div>
            </div>
          )
        })}
      </div>

      {/* Strategy comparison table */}
      <div className="rounded-xl border border-white/10 bg-card/40 p-4">
        <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
          <Layers className="h-4 w-4 text-amber-400" />
          DRIVER STRATEGY BREAKDOWN
        </h3>
        <div className="overflow-x-auto rb-scroll">
          <table className="w-full text-[10px] font-mono">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-white/10">
                <th className="pb-2 pr-3">POS</th>
                <th className="pb-2 pr-3">DRIVER</th>
                <th className="pb-2 pr-3">TEAM</th>
                <th className="pb-2 pr-3">STRATEGY</th>
                <th className="pb-2 pr-3">COMPOUND</th>
                <th className="pb-2 pr-3">STOPS</th>
                <th className="pb-2 pr-3">TOTAL TIME</th>
                <th className="pb-2 pr-3">AVG LAP</th>
                <th className="pb-2 pr-3">BEST</th>
                <th className="pb-2 pr-3">AVG PERF</th>
                <th className="pb-2 pr-3">AVG TEMP</th>
                <th className="pb-2">GAP</th>
              </tr>
            </thead>
            <tbody>
              {data.drivers.map((d: any, i: number) => {
                const gap = d.totalTime - minTotalTime
                const isRB = d.isRacingBulls
                return (
                  <tr key={d.driverCode} className={cn(
                    'border-b border-white/5 hover:bg-white/[0.03] transition-colors',
                    isRB && 'bg-red-500/[0.04]'
                  )}>
                    <td className="py-1.5 pr-3">
                      <span className={cn(
                        'inline-flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold',
                        i === 0 ? 'bg-amber-400 text-black' : i === 1 ? 'bg-slate-300 text-black' : i === 2 ? 'bg-amber-700 text-white' : 'bg-white/10'
                      )}>{i + 1}</span>
                    </td>
                    <td className="py-1.5 pr-3 font-bold">
                      <span className="flex items-center gap-1.5">
                        {isRB && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
                        {d.driverCode}
                      </span>
                    </td>
                    <td className="py-1.5 pr-3 text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full" style={{ background: TEAM_COLORS[d.team] || '#888' }} />
                        {d.team.split(' ').slice(-1)[0]}
                      </span>
                    </td>
                    <td className="py-1.5 pr-3">
                      <span className="rb-chip bg-background/40 text-cyan-300 border border-cyan-500/20">{d.strategyType}</span>
                    </td>
                    <td className="py-1.5 pr-3 font-bold text-amber-400">{d.compoundSequence}</td>
                    <td className="py-1.5 pr-3">{d.stintCount}</td>
                    <td className="py-1.5 pr-3 font-bold text-cyan-400">{Math.floor(d.totalTime / 60)}'{(d.totalTime % 60).toFixed(1)}"</td>
                    <td className="py-1.5 pr-3">{d.avgLapTime.toFixed(3)}</td>
                    <td className="py-1.5 pr-3 text-green-400 font-bold">{d.bestLap.toFixed(3)}</td>
                    <td className="py-1.5 pr-3 text-green-400">{(d.avgPerf * 100).toFixed(1)}%</td>
                    <td className="py-1.5 pr-3 text-amber-400">{d.avgTemp}°</td>
                    <td className={cn('py-1.5 font-bold', gap === 0 ? 'text-green-400' : 'text-red-400')}>
                      {gap === 0 ? 'LEADER' : `+${gap.toFixed(1)}s`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Compound usage + stint visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Compound usage */}
        <div className="rounded-xl border border-white/10 bg-card/40 p-4">
          <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-red-400" />
            COMPOUND USAGE (LAPS)
          </h3>
          <div className="space-y-2">
            {Object.entries(data.summary.compoundUsage).map(([compound, laps]: any) => {
              const colors: Record<string, string> = { Soft: '#ef4444', Medium: '#f59e0b', Hard: '#e2e8f0' }
              const total = Object.values(data.summary.compoundUsage).reduce((s: number, v: number) => s + v, 0)
              const pct = (laps / total) * 100
              return (
                <div key={compound}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono font-bold flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: colors[compound] }} />
                      {compound}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">{laps} laps ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-background/60 overflow-hidden">
                    <div className="h-full rounded-full rb-fill transition-all" style={{ width: `${pct}%`, background: colors[compound] }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Stint visualization timeline */}
        <div className="rounded-xl border border-white/10 bg-card/40 p-4">
          <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-cyan-400" />
            STINT TIMELINE (LAPS)
          </h3>
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto rb-scroll">
            {data.drivers.map((d: any) => {
              const totalLaps = d.totalLaps
              return (
                <div key={d.driverCode} className="flex items-center gap-2">
                  <span className="w-10 text-[10px] font-mono font-bold text-right">{d.driverCode}</span>
                  <div className="flex-1 h-5 rounded bg-background/40 overflow-hidden flex">
                    {d.stints.map((s: any) => {
                      const width = (s.length / totalLaps) * 100
                      const colors: Record<string, string> = { Soft: '#ef4444', Medium: '#f59e0b', Hard: '#e2e8f0' }
                      return (
                        <div
                          key={s.stintNumber}
                          className="h-full flex items-center justify-center text-[8px] font-mono font-bold text-black transition-all hover:opacity-80"
                          style={{ width: `${width}%`, background: colors[s.compound] || '#888' }}
                          title={`Stint ${s.stintNumber}: ${s.compound} L${s.startLap}-L${s.endLap} (${s.length} laps, ${(s.avgPerf * 100).toFixed(1)}%)`}
                        >
                          {s.length > 5 ? s.compound[0] : ''}
                        </div>
                      )
                    })}
                  </div>
                  <span className="w-8 text-[9px] font-mono text-muted-foreground">{d.stintCount}S</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
