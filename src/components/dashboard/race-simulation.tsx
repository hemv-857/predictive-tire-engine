'use client'

import { useEffect, useState, useCallback } from 'react'
import { DegradationCurve } from '@/components/charts/degradation-curve'
import { Dices, Play, Trophy, Target, Users, Zap, Activity, RefreshCw, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  raceId: string | null
}

const TEAM_COLORS: Record<string, string> = {
  'Apex Racing': '#ef4444',
  'Red Bull Racing': '#1e3a8a',
  'Ferrari': '#dc2626',
  'Mercedes': '#22c55e',
  'McLaren': '#f97316',
}

export function RaceSimulation({ raceId }: Props) {
  const [simCount, setSimCount] = useState(1000)
  const [result, setResult] = useState<any>(null)
  const [simulating, setSimulating] = useState(false)
  const [defaults, setDefaults] = useState<any>(null)

  useEffect(() => {
    fetch('/api/race-simulation').then(r => r.json()).then(setDefaults).catch(() => {})
  }, [])

  const runSimulation = useCallback(async () => {
    if (!raceId || !defaults) return
    setSimulating(true)
    try {
      const res = await fetch('/api/race-simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raceId,
          simulations: simCount,
          strategies: defaults.defaults.strategies,
        }),
      })
      const data = await res.json()
      setResult(data)
    } catch (e) {
      console.error('Simulation failed', e)
    } finally {
      setSimulating(false)
    }
  }, [raceId, simCount, defaults])

  useEffect(() => {
    if (raceId && defaults) {
      const t = setTimeout(() => runSimulation(), 300)
      return () => clearTimeout(t)
    }
  }, [raceId, defaults, runSimulation])

  // Build position probability series for RB drivers
  const probSeries = result?.rbDistribution?.map((rd: any) => ({
    id: rd.driverCode,
    name: rd.driverCode,
    color: TEAM_COLORS['Apex Racing'],
    points: rd.distribution.map((d: any) => ({ x: d.position, y: d.probability })),
  })) || []

  // Bar chart data for win/podium probability
  const winProbData = result?.driverStats?.slice(0, 10).map((d: any) => ({
    label: d.driverCode,
    value: d.winProbability,
    color: d.isRB ? '#ef4444' : d.winProbability > 20 ? '#22c55e' : d.winProbability > 5 ? '#f59e0b' : '#64748b',
  })) || []

  if (!result) {
    return (
      <div className="rounded-xl border border-white/10 bg-card/40 p-8 text-center">
        <Dices className="h-6 w-6 text-muted-foreground animate-pulse mx-auto mb-2" />
        <p className="text-xs font-mono text-muted-foreground">Running Monte Carlo simulation…</p>
      </div>
    )
  }

  const s = result.summary

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-white/10 bg-card/40 rb-card-glass">
        <div className="flex items-center gap-2">
          <Dices className="h-4 w-4 text-red-400" />
          <span className="text-xs font-mono font-bold">RACE SIMULATION ENGINE</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-muted-foreground">SIMULATIONS:</span>
          <select
            value={simCount}
            onChange={(e) => setSimCount(parseInt(e.target.value))}
            className="bg-background/60 border border-white/10 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-red-500/50"
          >
            <option value={500}>500</option>
            <option value={1000}>1,000</option>
            <option value={2500}>2,500</option>
            <option value={5000}>5,000</option>
          </select>
        </div>
        <button
          onClick={runSimulation}
          disabled={simulating}
          className={cn(
            'rb-lift rounded-lg border px-3 py-1.5 text-[11px] font-mono font-bold transition-colors flex items-center gap-1.5',
            simulating ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'bg-red-500/20 border-red-500/40 text-red-300 hover:bg-red-500/30'
          )}
        >
          {simulating ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
          {simulating ? 'SIMULATING…' : 'RUN SIMULATION'}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rb-card-glass rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3 rb-lift rb-stagger rb-delay-1">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground uppercase mb-1">
            <Trophy className="h-3 w-3 text-amber-400" />MOST LIKELY WINNER
          </div>
          <div className="font-mono text-xl font-bold text-amber-400 rb-neon-amber">{s.mostLikelyWinner}</div>
          <div className="text-[9px] font-mono text-muted-foreground">{s.mostLikelyWinnerProb}% probability</div>
        </div>
        <div className="rb-card-glass rounded-xl border border-red-500/30 bg-red-500/[0.06] p-3 rb-lift rb-stagger rb-delay-2">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground uppercase mb-1">
            <Target className="h-3 w-3 text-red-400" />RB WIN PROBABILITY
          </div>
          <div className="font-mono text-xl font-bold text-red-400 rb-neon-red">{s.rbWinProbability.toFixed(1)}%</div>
          <div className="text-[9px] font-mono text-muted-foreground">combined RB drivers</div>
        </div>
        <div className="rb-card-glass rounded-xl border border-green-500/30 bg-green-500/[0.06] p-3 rb-lift rb-stagger rb-delay-3">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground uppercase mb-1">
            <TrendingUp className="h-3 w-3 text-green-400" />RB PODIUM PROB
          </div>
          <div className="font-mono text-xl font-bold text-green-400">{s.rbPodiumProbability.toFixed(1)}%</div>
          <div className="text-[9px] font-mono text-muted-foreground">at least one RB on podium</div>
        </div>
        <div className="rb-card-glass rounded-xl border border-cyan-500/30 bg-cyan-500/[0.06] p-3 rb-lift rb-stagger rb-delay-4">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground uppercase mb-1">
            <Activity className="h-3 w-3 text-cyan-400" />SIMULATIONS RUN
          </div>
          <div className="font-mono text-xl font-bold text-cyan-400">{result.simulations.toLocaleString()}</div>
          <div className="text-[9px] font-mono text-muted-foreground">{result.totalLaps} laps each</div>
        </div>
      </div>

      {/* Win probability bar chart */}
      <div className="rounded-xl border border-white/10 bg-card/40 p-4">
        <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-400" />
          WIN PROBABILITY BY DRIVER (% across {result.simulations.toLocaleString()} simulations)
        </h3>
        <div className="space-y-2">
          {winProbData.map((d: any) => {
            const driver = result.driverStats.find((ds: any) => ds.driverCode === d.label)
            return (
              <div key={d.label} className="flex items-center gap-3">
                <span className="w-10 text-[10px] font-mono font-bold text-right">{d.label}</span>
                <div className="flex-1 h-6 rounded bg-background/60 overflow-hidden relative">
                  <div
                    className={cn('h-full rounded transition-all rb-fill flex items-center justify-end pr-2', d.value > 0 && 'rb-sweep')}
                    style={{ width: `${Math.max(d.value, d.value > 0 ? 3 : 0)}%`, background: d.color }}
                  >
                    {d.value > 5 && <span className="text-[9px] font-mono font-bold text-black">{d.value}%</span>}
                  </div>
                </div>
                <span className="w-16 text-[10px] font-mono text-right">
                  <span className="text-muted-foreground">P</span>
                  <span className={cn('font-bold ml-1', driver?.avgPosition <= 3 ? 'text-green-400' : driver?.avgPosition <= 6 ? 'text-amber-400' : 'text-red-400')}>
                    {driver?.avgPosition}
                  </span>
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Position probability distribution for RB drivers */}
        <div className="rounded-xl border border-white/10 bg-card/40 p-4">
          <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
            <Target className="h-4 w-4 text-red-400" />
            RB POSITION DISTRIBUTION
          </h3>
          <DegradationCurve
            series={probSeries}
            xLabel="Finish Position"
            yLabel="Probability (%)"
            xDomain={[1, 10]}
            width={560}
            height={280}
          />
        </div>

        {/* Driver stats table */}
        <div className="rounded-xl border border-white/10 bg-card/40 p-4">
          <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-cyan-400" />
            SIMULATION STATISTICS
          </h3>
          <div className="overflow-y-auto rb-scroll max-h-[300px]">
            <table className="w-full text-[10px] font-mono">
              <thead className="sticky top-0 bg-card">
                <tr className="text-left text-muted-foreground border-b border-white/10">
                  <th className="pb-2 pr-2">DRIVER</th>
                  <th className="pb-2 pr-2">AVG POS</th>
                  <th className="pb-2 pr-2">MEDIAN</th>
                  <th className="pb-2 pr-2">BEST</th>
                  <th className="pb-2 pr-2">WORST</th>
                  <th className="pb-2 pr-2">σ</th>
                  <th className="pb-2 pr-2">WIN%</th>
                  <th className="pb-2">PODIUM%</th>
                </tr>
              </thead>
              <tbody>
                {result.driverStats.map((d: any) => (
                  <tr key={d.driverCode} className={cn('border-b border-white/5', d.isRB && 'bg-red-500/[0.04]')}>
                    <td className="py-1 pr-2 font-bold">
                      <span className="flex items-center gap-1">
                        {d.isRB && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
                        {d.driverCode}
                      </span>
                    </td>
                    <td className="py-1 pr-2 text-cyan-400 font-bold">{d.avgPosition}</td>
                    <td className="py-1 pr-2">{d.medianPosition}</td>
                    <td className="py-1 pr-2 text-green-400">{d.bestPosition}</td>
                    <td className="py-1 pr-2 text-red-400">{d.worstPosition}</td>
                    <td className="py-1 pr-2 text-amber-400">{d.posStd}</td>
                    <td className={cn('py-1 pr-2 font-bold', d.winProbability > 20 ? 'text-green-400' : d.winProbability > 5 ? 'text-amber-400' : 'text-muted-foreground')}>
                      {d.winProbability}%
                    </td>
                    <td className={cn('py-1 font-bold', d.podiumProbability > 50 ? 'text-green-400' : d.podiumProbability > 20 ? 'text-amber-400' : 'text-muted-foreground')}>
                      {d.podiumProbability}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Sample race results */}
      <div className="rounded-xl border border-white/10 bg-card/40 p-4">
        <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-400" />
          SAMPLE RACE OUTCOMES (first 10 simulations)
        </h3>
        <div className="overflow-x-auto rb-scroll">
          <table className="w-full text-[9px] font-mono">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-white/10">
                <th className="pb-1.5 pr-2">SIM</th>
                {result.sampleResults[0]?.map((_: any, i: number) => (
                  <th key={i} className="pb-1.5 pr-2 text-center">P{i + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.sampleResults.slice(0, 10).map((sim: any, i: number) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="py-1 pr-2 text-muted-500">#{i + 1}</td>
                  {sim.map((r: any, j: number) => (
                    <td key={j} className={cn('py-1 pr-2 text-center font-bold', r.isRB && 'text-red-400')}>
                      {r.driverCode}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
