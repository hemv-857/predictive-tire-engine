'use client'

import { useEffect, useState } from 'react'
import { DegradationCurve } from '@/components/charts/degradation-curve'
import { Swords, Clock, Gauge, Trophy, TrendingUp, TrendingDown, Zap, Thermometer } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  raceId: string | null
  drivers: any[]
}

export function HeadToHead({ raceId, drivers }: Props) {
  const [driverA, setDriverA] = useState('TSU')
  const [driverB, setDriverB] = useState('VER')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!raceId || !driverA || !driverB) return
    let active = true
    fetch(`/api/head-to-head?raceId=${raceId}&driverA=${driverA}&driverB=${driverB}`)
      .then(r => r.json())
      .then(d => { if (active) { setData(d); setLoading(false) } })
      .catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [raceId, driverA, driverB])

  const swap = () => {
    setDriverA(driverB)
    setDriverB(driverA)
  }

  return (
    <div className="space-y-4">
      {/* Driver selectors */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-white/10 bg-card/40">
        <div className="flex items-center gap-2">
          <Swords className="h-4 w-4 text-red-400" />
          <span className="text-xs font-mono font-bold">HEAD-TO-HEAD</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <DriverSelect label="A" value={driverA} onChange={setDriverA} drivers={drivers} color="#ef4444" />
          <button
            onClick={swap}
            className="rb-lift rounded-lg bg-background/60 hover:bg-background/80 border border-white/10 p-2 transition-colors"
            aria-label="Swap drivers"
          >
            <Swords className="h-3.5 w-3.5 text-amber-400" />
          </button>
          <DriverSelect label="B" value={driverB} onChange={setDriverB} drivers={drivers} color="#a855f7" />
        </div>
      </div>

      {loading && (
        <div className="rounded-xl border border-white/10 bg-card/40 p-8 text-center">
          <Swords className="h-6 w-6 text-muted-foreground animate-pulse mx-auto mb-2" />
          <p className="text-xs font-mono text-muted-foreground">Analyzing head-to-head…</p>
        </div>
      )}

      {data && !loading && (
        <>
          {/* Summary comparison cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DriverSummaryCard
              driver={data.driverA}
              opponent={data.driverB}
              color={data.driverA.team === 'Apex Racing' ? '#ef4444' : '#06b6d4'}
              isWinner={data.summary.winner === driverA}
              wins={data.summary.aWins}
              totalLaps={data.summary.totalLaps}
            />
            <DriverSummaryCard
              driver={data.driverB}
              opponent={data.driverA}
              color={data.driverB.team === 'Apex Racing' ? '#ef4444' : '#a855f7'}
              isWinner={data.summary.winner === driverB}
              wins={data.summary.bWins}
              totalLaps={data.summary.totalLaps}
            />
          </div>

          {/* Cumulative delta chart */}
          <div className="rounded-xl border border-white/10 bg-card/40 p-4">
            <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-amber-400" />
              CUMULATIVE TIME DELTA
              <span className="text-[10px] font-mono text-muted-foreground ml-2">
                ({driverA} ahead when below 0)
              </span>
            </h3>
            <DegradationCurve
              series={[data.deltaSeries]}
              xLabel="Lap"
              yLabel={`Δ ${driverA} - ${driverB} (s)`}
              width={900}
              height={240}
              yDomain={[
                Math.min(...data.deltaSeries.points.map((p: any) => p.y)) - 0.5,
                Math.max(...data.deltaSeries.points.map((p: any) => p.y)) + 0.5,
              ]}
              thresholds={[{ value: 0, label: 'Level', color: '#64748b' }]}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Lap time comparison */}
            <div className="rounded-xl border border-white/10 bg-card/40 p-4">
              <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-cyan-400" />
                LAP TIME COMPARISON
              </h3>
              <DegradationCurve
                series={data.lapTimeSeries}
                xLabel="Lap"
                yLabel="Lap Time (s)"
                yDomain={[
                  Math.min(...data.lapTimeSeries.flatMap((s: any) => s.points.map((p: any) => p.y))) - 0.3,
                  Math.max(...data.lapTimeSeries.flatMap((s: any) => s.points.map((p: any) => p.y))) + 0.3,
                ]}
                width={560}
                height={280}
              />
            </div>

            {/* Tire performance comparison */}
            <div className="rounded-xl border border-white/10 bg-card/40 p-4">
              <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
                <Gauge className="h-4 w-4 text-green-400" />
                TIRE PERFORMANCE COMPARISON
              </h3>
              <DegradationCurve
                series={data.perfSeries}
                xLabel="Lap"
                yLabel="Tire Performance"
                yDomain={[0.6, 1.0]}
                width={560}
                height={280}
                thresholds={[
                  { value: 0.90, label: '90%', color: '#f59e0b' },
                  { value: 0.85, label: '85%', color: '#f97316' },
                ]}
              />
            </div>
          </div>

          {/* Lap-by-lap delta table */}
          <div className="rounded-xl border border-white/10 bg-card/40 p-4">
            <h3 className="text-sm font-bold font-mono mb-3">LAP-BY-LAP DELTA</h3>
            <div className="overflow-x-auto rb-scroll max-h-[280px]">
              <table className="w-full text-[10px] font-mono">
                <thead className="sticky top-0 bg-card">
                  <tr className="text-left text-muted-foreground border-b border-white/10">
                    <th className="pb-2 pr-3">LAP</th>
                    <th className="pb-2 pr-3">{driverA} TIME</th>
                    <th className="pb-2 pr-3">{driverB} TIME</th>
                    <th className="pb-2 pr-3">Δ LAP</th>
                    <th className="pb-2 pr-3">Δ CUM</th>
                    <th className="pb-2">FASTER</th>
                  </tr>
                </thead>
                <tbody>
                  {data.laps.filter((l: any) => l.driverA && l.driverB).map((l: any) => (
                    <tr key={l.lap} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="py-1 pr-3 text-muted-foreground">L{l.lap}</td>
                      <td className="py-1 pr-3">{l.driverA.lapTime.toFixed(3)}</td>
                      <td className="py-1 pr-3">{l.driverB.lapTime.toFixed(3)}</td>
                      <td className={cn('py-1 pr-3 font-bold', l.deltaLap < 0 ? 'text-green-400' : l.deltaLap > 0 ? 'text-red-400' : 'text-muted-foreground')}>
                        {l.deltaLap >= 0 ? '+' : ''}{l.deltaLap?.toFixed(3)}
                      </td>
                      <td className={cn('py-1 pr-3 font-bold', l.deltaCum < 0 ? 'text-green-400' : 'text-red-400')}>
                        {l.deltaCum >= 0 ? '+' : ''}{l.deltaCum.toFixed(3)}
                      </td>
                      <td className="py-1">
                        {l.deltaLap < 0 ? (
                          <span className="text-green-400">{driverA}</span>
                        ) : l.deltaLap > 0 ? (
                          <span className="text-purple-400">{driverB}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function DriverSelect({ label, value, onChange, drivers, color }: { label: string; value: string; onChange: (v: string) => void; drivers: any[]; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-mono font-bold" style={{ background: `${color}30`, color }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-background/60 border border-white/10 rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-red-500/50"
      >
        {drivers.map((d) => <option key={d.code} value={d.code}>{d.code} · {d.name}</option>)}
      </select>
    </div>
  )
}

function DriverSummaryCard({ driver, opponent, color, isWinner, wins, totalLaps }: { driver: any; opponent: any; color: string; isWinner: boolean; wins: number; totalLaps: number }) {
  const winPct = totalLaps > 0 ? (wins / totalLaps) * 100 : 0
  return (
    <div className={cn('relative rounded-xl border p-4 overflow-hidden', isWinner ? 'border-green-500/40 bg-green-500/[0.06] rb-glow-green' : 'border-white/10 bg-card/40')}>
      {isWinner && <div className="absolute top-2 right-2 rb-chip bg-green-500/20 text-green-300 border border-green-500/30"><Trophy className="h-2.5 w-2.5" /> WINNER</div>}
      <div className="flex items-center gap-3 mb-3">
        <div className="h-10 w-1 rounded-full" style={{ background: color }} />
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg font-bold">{driver.code}</span>
            <span className="rb-chip bg-background/40 text-muted-foreground">{driver.team}</span>
          </div>
          <p className="text-[10px] font-mono text-muted-foreground">{driver.name} · #{driver.number}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
        <div className="rounded bg-background/40 p-2">
          <div className="flex items-center gap-1 text-[9px] text-muted-foreground uppercase"><Clock className="h-2.5 w-2.5" />AVG LAP</div>
          <div className="font-bold text-cyan-400">{driver.avgLapTime.toFixed(3)}</div>
        </div>
        <div className="rounded bg-background/40 p-2">
          <div className="flex items-center gap-1 text-[9px] text-muted-foreground uppercase"><Zap className="h-2.5 w-2.5" />BEST</div>
          <div className="font-bold text-amber-400">{driver.bestLap.toFixed(3)}</div>
        </div>
        <div className="rounded bg-background/40 p-2">
          <div className="flex items-center gap-1 text-[9px] text-muted-foreground uppercase"><Gauge className="h-2.5 w-2.5" />AVG PERF</div>
          <div className="font-bold text-green-400">{(driver.avgPerf * 100).toFixed(1)}%</div>
        </div>
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-mono text-muted-foreground">LAPS WON vs {opponent.code}</span>
          <span className="text-[10px] font-mono font-bold">{wins}/{totalLaps} ({winPct.toFixed(0)}%)</span>
        </div>
        <div className="h-2 rounded-full bg-background/60 overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${winPct}%`, background: color }} />
        </div>
      </div>
    </div>
  )
}
