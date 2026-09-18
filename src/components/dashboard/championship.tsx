'use client'

import { useEffect, useState } from 'react'
import { Trophy, Medal, Users, TrendingUp, Flag, Crown, Award } from 'lucide-react'
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

export function Championship() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetch('/api/championship').then(r => r.json()).then(d => {
      if (active) { setData(d); setLoading(false) }
    }).catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  if (loading || !data) {
    return (
      <div className="rounded-xl border border-white/10 bg-card/40 p-8 text-center">
        <Trophy className="h-6 w-6 text-muted-foreground animate-pulse mx-auto mb-2" />
        <p className="text-xs font-mono text-muted-foreground">Loading championship standings…</p>
      </div>
    )
  }

  const maxPoints = Math.max(...data.driversChampionship.map((d: any) => d.points))
  const maxConstructorPoints = Math.max(...data.constructorsChampionship.map((c: any) => c.points))

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-white/10 bg-card/40 rb-card-glass">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-400" />
          <span className="text-xs font-mono font-bold">CHAMPIONSHIP STANDINGS</span>
        </div>
        <div className="flex-1" />
        <span className="rb-chip bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
          <Flag className="h-2.5 w-2.5" /> {data.summary.totalRaces} races
        </span>
        <span className="rb-chip bg-green-500/15 text-green-300 border border-green-500/30">
          <Users className="h-2.5 w-2.5" /> {data.summary.totalDrivers} drivers
        </span>
      </div>

      {/* Leader banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rb-card-glass rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-4 rb-glow-amber rb-bounce-in">
          <div className="flex items-center gap-2 mb-2">
            <Crown className="h-4 w-4 text-amber-400" />
            <span className="text-[10px] font-mono font-bold text-amber-400 uppercase">DRIVERS' CHAMPION</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono text-2xl font-bold text-amber-400 rb-neon-amber">{data.summary.leader?.code}</div>
              <div className="text-[10px] font-mono text-muted-foreground">{data.driversChampionship[0]?.name} · {data.driversChampionship[0]?.team}</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-3xl font-bold text-amber-400">{data.summary.leader?.points}</div>
              <div className="text-[9px] font-mono text-muted-foreground">points</div>
            </div>
          </div>
          {data.summary.gapToSecond > 0 && (
            <div className="mt-2 pt-2 border-t border-amber-500/20 text-[10px] font-mono text-muted-foreground">
              Lead: <span className="font-bold text-amber-400">+{data.summary.gapToSecond}</span> pts
            </div>
          )}
        </div>

        <div className="rb-card-glass rounded-xl border border-cyan-500/30 bg-cyan-500/[0.06] p-4 rb-glow-cyan rb-bounce-in rb-delay-2">
          <div className="flex items-center gap-2 mb-2">
            <Award className="h-4 w-4 text-cyan-400" />
            <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase">CONSTRUCTORS' CHAMPION</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono text-2xl font-bold text-cyan-400 rb-neon-cyan">{data.summary.constructorLeader?.team}</div>
              <div className="text-[10px] font-mono text-muted-foreground">{data.summary.constructorLeader?.points} total points</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-3xl font-bold text-cyan-400">{data.summary.constructorLeader?.points}</div>
              <div className="text-[9px] font-mono text-muted-foreground">points</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Drivers Championship */}
        <div className="rounded-xl border border-white/10 bg-card/40 p-4">
          <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-400" />
            DRIVERS' STANDINGS
          </h3>
          <div className="space-y-1.5 max-h-[500px] overflow-y-auto rb-scroll">
            {data.driversChampionship.map((d: any, i: number) => {
              const pct = maxPoints > 0 ? (d.points / maxPoints) * 100 : 0
              const isRB = d.team === 'Apex Racing'
              return (
                <div key={d.code} className={cn(
                  'rounded-lg p-2 border transition-colors hover:bg-white/[0.03]',
                  i === 0 ? 'bg-amber-500/[0.08] border-amber-500/30' : isRB ? 'bg-red-500/[0.06] border-red-500/20' : 'bg-background/30 border-white/5'
                )}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn(
                      'flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold',
                      i === 0 ? 'bg-amber-400 text-black' : i === 1 ? 'bg-slate-300 text-black' : i === 2 ? 'bg-amber-700 text-white' : 'bg-white/10'
                    )}>{i + 1}</span>
                    <span className="h-2 w-2 rounded-full" style={{ background: TEAM_COLORS[d.team] || '#888' }} />
                    <span className="font-mono text-xs font-bold flex-1">{d.code}</span>
                    {isRB && <span className="rb-chip bg-red-500/20 text-red-300 border border-red-500/30 text-[8px]">RB</span>}
                    <span className="font-mono text-sm font-bold text-amber-400">{d.points}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-background/60 overflow-hidden">
                      <div className="h-full rounded-full rb-fill" style={{ width: `${pct}%`, background: TEAM_COLORS[d.team] || '#888' }} />
                    </div>
                    <span className="text-[9px] font-mono text-muted-foreground w-20 text-right">
                      {d.races} races · P{d.bestFinish} best
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Constructors Championship */}
        <div className="rounded-xl border border-white/10 bg-card/40 p-4">
          <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
            <Medal className="h-4 w-4 text-cyan-400" />
            CONSTRUCTORS' STANDINGS
          </h3>
          <div className="space-y-1.5">
            {data.constructorsChampionship.map((c: any, i: number) => {
              const pct = maxConstructorPoints > 0 ? (c.points / maxConstructorPoints) * 100 : 0
              const isRB = c.team === 'Apex Racing'
              return (
                <div key={c.team} className={cn(
                  'rounded-lg p-2 border transition-colors hover:bg-white/[0.03]',
                  i === 0 ? 'bg-cyan-500/[0.08] border-cyan-500/30' : isRB ? 'bg-red-500/[0.06] border-red-500/20' : 'bg-background/30 border-white/5'
                )}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn(
                      'flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold',
                      i === 0 ? 'bg-cyan-400 text-black' : i === 1 ? 'bg-slate-300 text-black' : i === 2 ? 'bg-amber-700 text-white' : 'bg-white/10'
                    )}>{i + 1}</span>
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: TEAM_COLORS[c.team] || '#888' }} />
                    <span className="font-mono text-xs font-bold flex-1 truncate">{c.team}</span>
                    {isRB && <span className="rb-chip bg-red-500/20 text-red-300 border border-red-500/30 text-[8px]">OURS</span>}
                    <span className="font-mono text-sm font-bold text-cyan-400">{c.points}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-background/60 overflow-hidden">
                      <div className="h-full rounded-full rb-fill" style={{ width: `${pct}%`, background: TEAM_COLORS[c.team] || '#888' }} />
                    </div>
                    <span className="text-[9px] font-mono text-muted-foreground w-20 text-right">
                      {c.podiums} podiums
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Race results summary */}
      <div className="rounded-xl border border-white/10 bg-card/40 p-4">
        <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
          <Flag className="h-4 w-4 text-green-400" />
          SEASON RACE RESULTS
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {data.raceResults.map((r: any) => (
            <div key={r.raceName} className="rounded-lg bg-background/30 p-2.5 border border-white/5 rb-lift">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono font-bold truncate">{r.raceName?.replace(' Grand Prix', ' GP')}</span>
                <span className="text-[9px] font-mono text-muted-foreground">{new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Trophy className="h-3 w-3 text-amber-400" />
                <span className="text-[10px] font-mono">
                  <span className="font-bold text-amber-400">{r.winner?.driver}</span>
                  <span className="text-muted-foreground"> · {r.winner?.team?.split(' ').slice(-1)[0]}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
