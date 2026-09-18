'use client'

import { useEffect, useState } from 'react'
import { KpiCard } from './kpi-card'
import { DegradationCurve } from '@/components/charts/degradation-curve'
import {
  Activity, Target, Timer, Cpu, TrendingUp, Flag, CircleDot, Database, Trophy, AlertTriangle, CheckCircle2, Radio, Gauge
} from 'lucide-react'
import type { DashboardOverview, Race, TireModel, WeeklyBrief } from '@/lib/types'
import { useLiveTelemetry } from '@/lib/use-live-telemetry'
import { COMPOUND_COLORS } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  overview: DashboardOverview
  races: Race[]
  accuracyTrend: { version: string; accuracy: number; f1Score: number; trainedAt: string }[]
  activeModel: TireModel | null
  weeklyBrief: WeeklyBrief | null
  onSelectRace: (raceId: string) => void
}

export function CommandCenter({ overview, races, accuracyTrend, activeModel, weeklyBrief, onSelectRace }: Props) {
  const [now, setNow] = useState(new Date())
  const { telemetry: liveTelemetry, connected, raceStatus } = useLiveTelemetry()
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const accuracyDelta = accuracyTrend.length >= 2
    ? ((accuracyTrend[accuracyTrend.length - 1].accuracy - accuracyTrend[accuracyTrend.length - 2].accuracy) * 100).toFixed(1)
    : '0'

  const completed = races.filter((r) => r.status === 'completed')
  const ongoing = races.find((r) => r.status === 'ongoing')

  // Accuracy series with version-based x labels — use index so chart shows sequential progression
  const accuracySeries = [{
    id: 'accuracy',
    name: 'Accuracy',
    color: '#22c55e',
    points: accuracyTrend.map((t, i) => ({ x: i + 1, y: t.accuracy, label: t.version })),
  }]
  const f1Series = [{
    id: 'f1',
    name: 'F1 Score',
    color: '#06b6d4',
    points: accuracyTrend.map((t, i) => ({ x: i + 1, y: t.f1Score, label: t.version })),
  }]

  // Live telemetry summary for command center
  const liveDrivers = Object.values(liveTelemetry).sort((a: any, b: any) => a.position - b.position).slice(0, 5)
  const rbLiveDriver = liveDrivers.find((d: any) => d.team === 'Apex Racing') as any

  return (
    <div className="space-y-4">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        <KpiCard
          label="Model Accuracy"
          value={`${(overview.activeModelAccuracy * 100).toFixed(1)}%`}
          accent="green"
          icon={Target}
          delta={`${accuracyDelta}% vs prev`}
          deltaPositive={Number(accuracyDelta) >= 0}
          sub={`Target: >85% ✓`}
        />
        <KpiCard
          label="Avg Pit Timing Error"
          value={overview.avgTimingError.toFixed(2)}
          unit="laps"
          accent="amber"
          icon={Timer}
          delta="Target: -40%"
          deltaPositive={false}
          sub={`${overview.optimalPitRate}% optimal rate`}
        />
        <KpiCard
          label="Inference Latency"
          value={overview.avgInferenceMs.toFixed(0)}
          unit="ms"
          accent="cyan"
          icon={Cpu}
          delta="<200ms target ✓"
          deltaPositive
          sub={`P99: ${(overview.avgInferenceMs * 1.4).toFixed(0)}ms`}
        />
        <KpiCard
          label="Prediction MAE"
          value={overview.predictionMAE.toFixed(4)}
          accent="red"
          icon={Activity}
          delta="±0.02 perf band"
          deltaPositive
          sub="Mean Abs Error"
        />
        <KpiCard
          label="Telemetry Points"
          value={overview.totalTelemetryPoints.toLocaleString()}
          accent="default"
          icon={Database}
          sub={`${overview.totalRaces} races · ${overview.totalDrivers} drivers`}
        />
      </div>

      {/* Live race snapshot banner */}
      {connected && raceStatus && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/[0.06] p-3 rb-glow-red rb-fade-up">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/20 border border-red-500/40">
                <Radio className="h-5 w-5 text-red-500 rb-live-dot" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold text-red-400 uppercase tracking-wider">LIVE RACE</span>
                  <span className="rb-chip bg-red-500/20 text-red-300 border border-red-500/30">LAP {raceStatus.lap}/{raceStatus.totalLaps}</span>
                </div>
                <div className="text-xs font-mono text-foreground mt-0.5">
                  Leader: <span className="font-bold text-amber-400">{raceStatus.leader}</span>
                  {raceStatus.fastestDriver && (
                    <span className="text-muted-foreground"> · Fastest: <span className="text-cyan-400">{raceStatus.fastestDriver} ({raceStatus.fastestLap?.toFixed(3)}s)</span></span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {liveDrivers.slice(0, 4).map((d: any) => (
                <div key={d.driverCode} className={cn(
                  'flex items-center gap-1.5 rounded-md px-2 py-1 border',
                  d.team === 'Apex Racing' ? 'bg-red-500/15 border-red-500/30' : 'bg-background/40 border-white/5'
                )}>
                  <span className={cn(
                    'flex h-4 w-4 items-center justify-center rounded text-[9px] font-mono font-bold',
                    d.position === 1 ? 'bg-amber-400 text-black' : 'bg-white/10'
                  )}>{d.position}</span>
                  <span className="text-[10px] font-mono font-bold">{d.driverCode}</span>
                  <span className="h-2 w-2 rounded-full" style={{ background: COMPOUND_COLORS[d.tireCompound] }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Active model + accuracy trend */}
        <div className="lg:col-span-2 rounded-xl border border-white/10 bg-card/40 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold font-mono flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-400" />
                MODEL ACCURACY TREND
              </h3>
              <p className="text-[10px] text-muted-foreground font-mono mt-0.5">Weekly retraining performance · {activeModel?.version}</p>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono">
              <span className="rounded bg-green-500/15 px-2 py-0.5 text-green-400">
                <CheckCircle2 className="inline h-3 w-3 mr-1" />ACTIVE
              </span>
            </div>
          </div>
          <DegradationCurve
            series={[...accuracySeries, ...f1Series]}
            xLabel="Model Version"
            yLabel="Score"
            yDomain={[0.78, 0.92]}
            xDomain={[0.5, accuracyTrend.length + 0.5]}
            width={720}
            height={260}
            thresholds={[{ value: 0.85, label: '>85% Target', color: '#22c55e' }]}
          />
          {/* Version labels under chart */}
          <div className="mt-1 flex justify-between px-2 text-[9px] font-mono text-muted-foreground">
            {accuracyTrend.map((t) => (
              <span key={t.version} className={cn('font-bold', t.version === activeModel?.version && 'text-green-400')}>
                {t.version}
              </span>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] font-mono">
            <div className="rounded bg-background/40 px-2 py-1.5">
              <span className="text-muted-foreground">VERSION</span>
              <div className="font-bold text-green-400">{activeModel?.version}</div>
            </div>
            <div className="rounded bg-background/40 px-2 py-1.5">
              <span className="text-muted-foreground">F1 SCORE</span>
              <div className="font-bold">{(activeModel?.f1Score * 100).toFixed(1)}%</div>
            </div>
            <div className="rounded bg-background/40 px-2 py-1.5">
              <span className="text-muted-foreground">TRAIN SAMPLES</span>
              <div className="font-bold">{activeModel?.trainingSamples.toLocaleString()}</div>
            </div>
            <div className="rounded bg-background/40 px-2 py-1.5">
              <span className="text-muted-foreground">LATENCY</span>
              <div className="font-bold">{activeModel?.avgLatencyMs.toFixed(0)}ms</div>
            </div>
          </div>
        </div>

        {/* Current race status */}
        <div className="rounded-xl border border-white/10 bg-card/40 p-4">
          <h3 className="text-sm font-bold font-mono flex items-center gap-2 mb-3">
            <Flag className="h-4 w-4 text-red-500" />
            RACE WEEKEND STATUS
          </h3>
          {ongoing ? (
            <div className="space-y-3">
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <CircleDot className="h-3 w-3 text-red-500 rb-live-dot" />
                  <span className="text-[10px] font-mono font-bold text-red-400">LIVE · ONGOING</span>
                </div>
                <div className="font-mono text-sm font-bold">{ongoing.name}</div>
                <div className="text-[10px] text-muted-foreground font-mono">{ongoing.circuit}, {ongoing.country}</div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                <div className="rounded bg-background/40 px-2 py-1.5">
                  <span className="text-muted-foreground">TRACK TEMP</span>
                  <div className="font-bold text-amber-400">{ongoing.trackTemp}°C</div>
                </div>
                <div className="rounded bg-background/40 px-2 py-1.5">
                  <span className="text-muted-foreground">AIR TEMP</span>
                  <div className="font-bold">{ongoing.airTemp}°C</div>
                </div>
                <div className="rounded bg-background/40 px-2 py-1.5">
                  <span className="text-muted-foreground">HUMIDITY</span>
                  <div className="font-bold">{ongoing.humidity}%</div>
                </div>
                <div className="rounded bg-background/40 px-2 py-1.5">
                  <span className="text-muted-foreground">TOTAL LAPS</span>
                  <div className="font-bold">{ongoing.lapsTotal}</div>
                </div>
              </div>
              <button
                onClick={() => onSelectRace(ongoing.id)}
                className="w-full rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 px-3 py-2 text-[11px] font-mono font-bold text-red-300 transition-colors"
              >
                VIEW LIVE STRATEGY →
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="rounded bg-background/40 px-3 py-2 text-[10px] font-mono text-muted-foreground">No live race. Recent results:</div>
              {completed.slice(-3).reverse().map((r) => (
                <button
                  key={r.id}
                  onClick={() => onSelectRace(r.id)}
                  className="w-full text-left rounded-lg border border-white/10 bg-background/30 hover:bg-background/50 p-2 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono font-bold">{r.name}</span>
                    <span className="text-[9px] font-mono text-green-400">DONE</span>
                  </div>
                  <div className="text-[9px] text-muted-foreground font-mono">{r.circuit}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Success metrics dashboard */}
        <div className="rounded-xl border border-white/10 bg-card/40 p-4">
          <h3 className="text-sm font-bold font-mono flex items-center gap-2 mb-3">
            <Trophy className="h-4 w-4 text-amber-400" />
            SUCCESS METRICS
          </h3>
          <div className="space-y-3">
            <MetricBar label="Pit Timing Error Reduction" current={40} target={40} unit="%" color="#f59e0b" note="Sim validated" />
            <MetricBar label="Model Accuracy (>85%)" current={overview.activeModelAccuracy * 100} target={85} unit="%" color="#22c55e" note={`${overview.activeModelVersion}`} />
            <MetricBar label="Inference <200ms" current={Math.max(0, 100 - (overview.avgInferenceMs / 200) * 100)} target={90} unit="% headroom" color="#06b6d4" note={`${overview.avgInferenceMs.toFixed(0)}ms avg`} />
            <MetricBar label="Optimal Pit Rate" current={overview.optimalPitRate} target={60} unit="%" color="#ef4444" note={`${overview.totalPitDecisions} decisions`} />
          </div>
        </div>

        {/* Weekly brief */}
        <div className="lg:col-span-2 rounded-xl border border-white/10 bg-card/40 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold font-mono flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              WEEKLY STRATEGIC BRIEF
            </h3>
            <span className="text-[10px] font-mono text-muted-foreground">
              {now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {now.toLocaleTimeString('en-US', { hour12: false })}
            </span>
          </div>
          {weeklyBrief ? (
            <div className="space-y-3">
              <p className="text-xs leading-relaxed text-foreground/90">{weeklyBrief.summary}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-mono font-bold text-amber-400 mb-1.5">KEY FINDINGS</p>
                  <ul className="space-y-1">
                    {JSON.parse(weeklyBrief.keyFindings).map((f: string, i: number) => (
                      <li key={i} className="text-[10px] font-mono text-muted-foreground flex gap-1.5">
                        <span className="text-amber-400">▸</span> {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[10px] font-mono font-bold text-green-400 mb-1.5">RECOMMENDATIONS</p>
                  <ul className="space-y-1">
                    {JSON.parse(weeklyBrief.recommendations).map((r: string, i: number) => (
                      <li key={i} className="text-[10px] font-mono text-muted-foreground flex gap-1.5">
                        <span className="text-green-400">▸</span> {r}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground font-mono">No brief available.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function MetricBar({ label, current, target, unit, color, note }: { label: string; current: number; target: number; unit: string; color: string; note: string }) {
  const pct = Math.min(100, (current / target) * 100)
  const achieved = current >= target
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-mono text-muted-foreground">{label}</span>
        <span className="text-[10px] font-mono font-bold" style={{ color }}>{current.toFixed(0)}{unit} / {target}{unit}</span>
      </div>
      <div className="h-2 rounded-full bg-background/60 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="text-[9px] font-mono text-muted-foreground mt-0.5">{note} {achieved && '✓'}</div>
    </div>
  )
}
