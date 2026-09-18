'use client'

import { useState } from 'react'
import { TeamBarChart } from '@/components/charts/team-bar-chart'
import { Trophy, Users, TrendingUp, GitCompare, FileText, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  teamSummary: any[]
  strategyDistribution: Record<string, number>
  strategies: any[]
}

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

export function CompetitorIntel({ teamSummary, strategyDistribution, strategies }: Props) {
  const [selectedTeam, setSelectedTeam] = useState<string>('')
  const [view, setView] = useState<'avgPitLap' | 'avgStintLength' | 'avgDegResistance' | 'avgPitStopTime'>('avgPitLap')

  // Derive effective team: user selection if valid, otherwise first available
  const validTeam = teamSummary.some((t) => t.team === selectedTeam) ? selectedTeam : (teamSummary[0]?.team || '')

  const metricLabel: Record<string, string> = {
    avgPitLap: 'Avg Pit Lap',
    avgStintLength: 'Avg Stint Length',
    avgDegResistance: 'Deg Resistance Index',
    avgPitStopTime: 'Avg Pit Stop (s)',
  }

  const TEAM_ABBR: Record<string, string> = {
    'Red Bull Racing': 'RBR',
    'Ferrari': 'FER',
    'Mercedes': 'MER',
    'McLaren': 'MCL',
    'Apex Racing': 'RB',
    'Aston Martin': 'AMR',
    'Alpine': 'ALP',
    'Williams': 'WIL',
    'Kick Sauber': 'SAU',
    'Haas': 'HAS',
  }

  const chartData = teamSummary.map((t) => ({
    label: TEAM_ABBR[t.team] || t.team.split(' ').slice(-1)[0],
    value: t[view],
    color: TEAM_COLORS[t.team] || '#888',
  }))

  // Ferrari vs Mercedes analysis
  const ferrari = teamSummary.find((t) => t.team === 'Ferrari')
  const mercedes = teamSummary.find((t) => t.team === 'Mercedes')
  const redBull = teamSummary.find((t) => t.team === 'Red Bull Racing')
  const fieldAvgPitLap = teamSummary.length ? teamSummary.reduce((s, t) => s + t.avgPitLap, 0) / teamSummary.length : 0

  const teamStrategies = strategies.filter((s) => s.team === validTeam).slice(0, 8)

  return (
    <div className="space-y-4">
      {/* Header controls */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-white/10 bg-card/40">
        <div className="flex items-center gap-2">
          <GitCompare className="h-4 w-4 text-red-400" />
          <span className="text-xs font-mono font-bold">COMPETITIVE BENCHMARKING</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5">
          {Object.keys(metricLabel).map((k) => (
            <button
              key={k}
              onClick={() => setView(k as any)}
              className={cn(
                'rounded px-2 py-1 text-[10px] font-mono transition-colors',
                view === k ? 'bg-red-500/20 border border-red-500/40 text-red-300' : 'bg-background/40 border border-white/5 text-muted-foreground hover:text-foreground'
              )}
            >
              {metricLabel[k]}
            </button>
          ))}
        </div>
      </div>

      {/* Key insight cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {ferrari && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/[0.06] p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="h-3 w-3 rounded-full bg-red-500" />
              <span className="text-xs font-mono font-bold text-red-400">FERRARI PATTERN</span>
            </div>
            <p className="text-2xl font-mono font-bold text-red-300">L{ferrari.avgPitLap.toFixed(1)}</p>
            <p className="text-[10px] font-mono text-muted-foreground mt-1">
              Avg first pit · pits {(fieldAvgPitLap - ferrari.avgPitLap).toFixed(1)} laps earlier than field on high-deg circuits
            </p>
          </div>
        )}
        {mercedes && (
          <div className="rounded-xl border border-green-500/30 bg-green-500/[0.06] p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="h-3 w-3 rounded-full bg-green-500" />
              <span className="text-xs font-mono font-bold text-green-400">MERCEDES PATTERN</span>
            </div>
            <p className="text-2xl font-mono font-bold text-green-300">{mercedes.avgStintLength.toFixed(1)} <span className="text-sm">laps</span></p>
            <p className="text-[10px] font-mono text-muted-foreground mt-1">
              Longest stints in field · extends runs by ~4 laps vs average
            </p>
          </div>
        )}
        {redBull && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="h-3 w-3 rounded-full bg-amber-500" />
              <span className="text-xs font-mono font-bold text-amber-400">RED BULL INDEX</span>
            </div>
            <p className="text-2xl font-mono font-bold text-amber-300">{redBull.avgDegResistance.toFixed(2)}</p>
            <p className="text-[10px] font-mono text-muted-foreground mt-1">
              Highest degradation resistance · best tire management in field
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Team comparison bar chart */}
        <div className="lg:col-span-2 rounded-xl border border-white/10 bg-card/40 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold font-mono flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-cyan-400" />
              {metricLabel[view].toUpperCase()} · BY TEAM
            </h3>
            <span className="text-[10px] font-mono text-muted-foreground">{teamSummary.length} teams analyzed</span>
          </div>
          <TeamBarChart
            data={chartData}
            yLabel={metricLabel[view]}
            width={720}
            height={340}
            horizontal
            highlightLabel="Bulls"
          />
        </div>

        {/* Strategy distribution */}
        <div className="rounded-xl border border-white/10 bg-card/40 p-4">
          <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-amber-400" />
            STRATEGY MIX
          </h3>
          <div className="space-y-3">
            {Object.entries(strategyDistribution).map(([strat, count]) => {
              const total = Object.values(strategyDistribution).reduce((a, b) => a + b, 0)
              const pct = (count / total) * 100
              const colors: Record<string, string> = { 'one-stop': '#22c55e', 'two-stop': '#f59e0b', 'three-stop': '#ef4444' }
              return (
                <div key={strat}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">{strat}</span>
                    <span className="text-[10px] font-mono font-bold" style={{ color: colors[strat] }}>{count} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-background/60 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: colors[strat] }} />
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-4 pt-3 border-t border-white/10">
            <p className="text-[10px] font-mono text-muted-foreground mb-2">PIPELINE STATUS</p>
            <div className="space-y-1.5 text-[10px] font-mono">
              <div className="flex items-center justify-between"><span className="text-muted-foreground">FIA Data Feed</span><span className="text-green-400">● ONLINE</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Records This Week</span><span className="font-bold">{strategies.length}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Spark/SQL Jobs</span><span className="text-green-400">● RUNNING</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Last Ingest</span><span className="font-bold">2m ago</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Team detail table */}
      <div className="rounded-xl border border-white/10 bg-card/40 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold font-mono flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-400" />
            TEAM STRATEGY DETAIL
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-muted-foreground">FOCUS:</span>
            <select
              value={validTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              className="bg-background/60 border border-white/10 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-red-500/50"
            >
              {teamSummary.map((t) => <option key={t.team} value={t.team}>{t.team}</option>)}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto rb-scroll">
          <table className="w-full text-[10px] font-mono">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-white/10">
                <th className="pb-2 pr-3">RACE</th>
                <th className="pb-2 pr-3">DRIVER</th>
                <th className="pb-2 pr-3">COMPOUND</th>
                <th className="pb-2 pr-3">PIT LAP</th>
                <th className="pb-2 pr-3">STINT</th>
                <th className="pb-2 pr-3">STRATEGY</th>
                <th className="pb-2 pr-3">DEG IDX</th>
                <th className="pb-2 pr-3">PIT TIME</th>
                <th className="pb-2 pr-3">POS</th>
                <th className="pb-2">PTS</th>
              </tr>
            </thead>
            <tbody>
              {teamStrategies.map((s, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-background/20">
                  <td className="py-1.5 pr-3 text-muted-foreground">{s.raceName?.replace(' Grand Prix', ' GP')}</td>
                  <td className="py-1.5 pr-3 font-bold">{s.driver}</td>
                  <td className="py-1.5 pr-3">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full" style={{ background: { Soft: '#ef4444', Medium: '#f59e0b', Hard: '#e2e8f0' }[s.compound] || '#888' }} />
                      {s.compound}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 text-amber-400">L{s.avgPitLap}</td>
                  <td className="py-1.5 pr-3">{s.stintLength} laps</td>
                  <td className="py-1.5 pr-3 text-cyan-400">{s.tireStrategy}</td>
                  <td className="py-1.5 pr-3 text-green-400">{s.degResistance.toFixed(2)}</td>
                  <td className="py-1.5 pr-3">{s.pitStopAvg.toFixed(2)}s</td>
                  <td className="py-1.5 pr-3">P{s.finishPosition}</td>
                  <td className="py-1.5 font-bold text-amber-400">{s.pointsScored}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
