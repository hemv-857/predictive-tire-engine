'use client'

import { useEffect, useState } from 'react'
import { DegradationCurve } from '@/components/charts/degradation-curve'
import { History, Clock, Gauge, Thermometer, Activity, GitBranch, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  raceId: string | null
  drivers: any[]
}

export function TireLifecycle({ raceId, drivers }: Props) {
  const [selectedDriver, setSelectedDriver] = useState('TSU')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!raceId) return
    let active = true
    fetch(`/api/tire-lifecycle?raceId=${raceId}&driverCode=${selectedDriver}`)
      .then(r => r.json())
      .then(d => { if (active) { setData(d); setLoading(false) } })
      .catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [raceId, selectedDriver])

  const validDriver = drivers.some((d) => d.code === selectedDriver) ? selectedDriver : (drivers[0]?.code || '')

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-white/10 bg-card/40">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-red-400" />
          <span className="text-xs font-mono font-bold">TIRE LIFECYCLE TIMELINE</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-muted-foreground">DRIVER:</span>
          <select
            value={validDriver}
            onChange={(e) => setSelectedDriver(e.target.value)}
            className="bg-background/60 border border-white/10 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-red-500/50"
          >
            {drivers.map((d) => <option key={d.code} value={d.code}>{d.code} · {d.name}</option>)}
          </select>
        </div>
      </div>

      {loading && (
        <div className="rounded-xl border border-white/10 bg-card/40 p-8 text-center">
          <History className="h-6 w-6 text-muted-foreground animate-pulse mx-auto mb-2" />
          <p className="text-xs font-mono text-muted-foreground">Building tire lifecycle…</p>
        </div>
      )}

      {data && !loading && (
        <>
          {/* Strategy summary banner */}
          <div className="rounded-xl border border-white/10 bg-card/40 p-4 rb-border-flow">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/15 border border-red-500/30">
                  <GitBranch className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold">{data.driver.code}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{data.driver.name}</span>
                  </div>
                  <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                    {data.summary.strategy.toUpperCase()} · {data.summary.compoundSequence} · {data.summary.totalStints} stints · {data.summary.totalLaps} laps
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-[10px] font-mono">
                <div className="text-center">
                  <div className="text-muted-foreground uppercase">Total Drop</div>
                  <div className="font-bold text-red-400">-{data.summary.totalDropPct}%</div>
                </div>
                <div className="text-center">
                  <div className="text-muted-foreground uppercase">Avg Stint</div>
                  <div className="font-bold text-cyan-400">{data.summary.avgStintLength} laps</div>
                </div>
                <div className="text-center">
                  <div className="text-muted-foreground uppercase">Stints</div>
                  <div className="font-bold text-amber-400">{data.summary.totalStints}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Stint timeline visualization */}
          <div className="rounded-xl border border-white/10 bg-card/40 p-4">
            <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
              <History className="h-4 w-4 text-amber-400" />
              STINT TIMELINE
            </h3>
            <div className="space-y-2">
              {data.timeline.map((s: any) => {
                const perfWidth = s.avgPerf * 100
                const dropWidth = s.dropPct
                return (
                  <div key={s.stintNumber} className="rounded-lg bg-background/30 p-3 border-l-2" style={{ borderLeftColor: s.compoundColor }}>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded bg-white/10 font-mono text-[10px] font-bold">{s.stintNumber}</span>
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ background: s.compoundColor }} />
                        <span className="text-xs font-mono font-bold">{s.compound}</span>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground">L{s.startLap}–L{s.endLap}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">· {s.length} laps</span>
                      <div className="flex-1" />
                      <div className="flex items-center gap-4 text-[10px] font-mono">
                        <span className="text-green-400">Avg: {(s.avgPerf * 100).toFixed(1)}%</span>
                        <span className="text-red-400">Drop: -{s.dropPct}%</span>
                        <span className="text-amber-400">Peak: L{s.peakLap} ({(s.peakPerf * 100).toFixed(1)}%)</span>
                      </div>
                    </div>
                    {/* Performance bar */}
                    <div className="relative h-3 rounded-full bg-background/60 overflow-hidden">
                      <div
                        className="absolute left-0 top-0 h-full rounded-full transition-all"
                        style={{ width: `${perfWidth}%`, background: `linear-gradient(90deg, ${s.compoundColor}, ${s.compoundColor}88)` }}
                      />
                      {/* Drop indicator */}
                      <div
                        className="absolute right-0 top-0 h-full bg-red-500/40"
                        style={{ width: `${dropWidth}%` }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-[9px] font-mono text-muted-foreground">
                      <span>Start: {(s.startPerf * 100).toFixed(1)}%</span>
                      <span>End: {(s.endPerf * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Performance vs tire age */}
            <div className="rounded-xl border border-white/10 bg-card/40 p-4">
              <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
                <Gauge className="h-4 w-4 text-green-400" />
                PERFORMANCE vs TIRE AGE
              </h3>
              <DegradationCurve
                series={data.perfSeries}
                xLabel="Tire Age (laps)"
                yLabel="Tire Performance"
                yDomain={[0.6, 1.0]}
                width={560}
                height={280}
                thresholds={[
                  { value: 0.95, label: '95%', color: '#a3e635' },
                  { value: 0.90, label: '90%', color: '#f59e0b' },
                  { value: 0.85, label: '85%', color: '#f97316' },
                ]}
              />
            </div>

            {/* Lap time vs tire age */}
            <div className="rounded-xl border border-white/10 bg-card/40 p-4">
              <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-cyan-400" />
                LAP TIME vs TIRE AGE
              </h3>
              <DegradationCurve
                series={data.lapTimeSeries}
                xLabel="Tire Age (laps)"
                yLabel="Lap Time (s)"
                width={560}
                height={280}
              />
            </div>
          </div>

          {/* Temperature vs tire age */}
          <div className="rounded-xl border border-white/10 bg-card/40 p-4">
            <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
              <Thermometer className="h-4 w-4 text-red-400" />
              TIRE TEMPERATURE vs TIRE AGE
            </h3>
            <DegradationCurve
              series={data.tempSeries}
              xLabel="Tire Age (laps)"
              yLabel="Avg Tire Temp (°C)"
              width={900}
              height={240}
              thresholds={[
                { value: 92, label: '92° optimal low', color: '#22c55e' },
                { value: 105, label: '105° optimal high', color: '#f59e0b' },
                { value: 115, label: '115° overheating', color: '#ef4444' },
              ]}
            />
          </div>
        </>
      )}
    </div>
  )
}
