'use client'

import { useEffect, useState } from 'react'
import { CommandCenter } from '@/components/dashboard/command-center'
import { TireDegradation } from '@/components/dashboard/tire-degradation'
import { PitStrategy } from '@/components/dashboard/pit-strategy'
import { CompetitorIntel } from '@/components/dashboard/competitor-intel'
import { ModelOps } from '@/components/dashboard/model-ops'
import { LiveTelemetryPanel } from '@/components/dashboard/live-telemetry-panel'
import { StrategySimulator } from '@/components/dashboard/strategy-simulator'
import { PositionChart } from '@/components/dashboard/position-chart'
import { AlertsPanel } from '@/components/dashboard/alerts-panel'
import { HeadToHead } from '@/components/dashboard/head-to-head'
import { ThermalHeatmap } from '@/components/dashboard/thermal-heatmap'
import { CircuitHeatmap } from '@/components/dashboard/circuit-heatmap'
import { WeatherImpact } from '@/components/dashboard/weather-impact'
import { TireLifecycle } from '@/components/dashboard/tire-lifecycle'
import { ModelDrift } from '@/components/dashboard/model-drift'
import { StrategyComparison } from '@/components/dashboard/strategy-comparison'
import { DeltaMatrix } from '@/components/dashboard/delta-matrix'
import { Championship } from '@/components/dashboard/championship'
import { LiveRecommender } from '@/components/dashboard/live-recommender'
import { SectorAnalysis } from '@/components/dashboard/sector-analysis'
import { TelemetryExplorer } from '@/components/dashboard/telemetry-explorer'
import { PitPerformance } from '@/components/dashboard/pit-performance'
import { Insights } from '@/components/dashboard/insights'
import { GanttView } from '@/components/dashboard/gantt-view'
import { RadarChart } from '@/components/dashboard/radar-chart'
import { RaceSimulation } from '@/components/dashboard/race-simulation'
import { CorrelationMatrix } from '@/components/dashboard/correlation-matrix'
import { PitProbability } from '@/components/dashboard/pit-probability'
import { Distributions } from '@/components/dashboard/distributions'
import { PerformanceForecast } from '@/components/dashboard/performance-forecast'
import {
  LayoutDashboard, Activity, Target, Users, Cpu, Circle, Radio, Zap, Sliders, Bell, Swords, Thermometer, CloudRain, History, TrendingDown, GitCompare, Grid3x3, Trophy, RadioTower, Gauge, LineChart, Timer, Brain, GanttChartSquare, Radar, Dices, Percent, BarChart3
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DashboardOverview, Race, Driver, TireModel, WeeklyBrief, PitDecision, Telemetry } from '@/lib/types'

type Tab = 'command' | 'degradation' | 'thermal' | 'pit' | 'live' | 'simulator' | 'h2h' | 'comparison' | 'delta' | 'sector' | 'explorer' | 'insights' | 'radar' | 'correlation' | 'distributions' | 'pitprob' | 'forecast' | 'simulation' | 'gantt' | 'pitperf' | 'competitor' | 'weather' | 'lifecycle' | 'drift' | 'championship' | 'model'

const TABS: { id: Tab; label: string; icon: any; desc: string }[] = [
  { id: 'command', label: 'Command', icon: LayoutDashboard, desc: 'Overview' },
  { id: 'live', label: 'Live', icon: RadioTower, desc: 'Recommender' },
  { id: 'degradation', label: 'Degradation', icon: Activity, desc: 'Tire wear' },
  { id: 'thermal', label: 'Thermal', icon: Thermometer, desc: 'Heatmap' },
  { id: 'pit', label: 'Pit', icon: Target, desc: 'Decisions' },
  { id: 'pitperf', label: 'Pit Perf', icon: Timer, desc: 'Stop analysis' },
  { id: 'simulator', label: 'Simulator', icon: Sliders, desc: 'What-if' },
  { id: 'h2h', label: 'H2H', icon: Swords, desc: 'Driver duel' },
  { id: 'comparison', label: 'Compare', icon: GitCompare, desc: 'Strategy' },
  { id: 'delta', label: 'Delta', icon: Grid3x3, desc: 'Lap matrix' },
  { id: 'sector', label: 'Sector', icon: Gauge, desc: 'S1/S2/S3' },
  { id: 'explorer', label: 'Explorer', icon: LineChart, desc: 'Telemetry' },
  { id: 'insights', label: 'Insights', icon: Brain, desc: 'Anomalies' },
  { id: 'radar', label: 'Radar', icon: Radar, desc: 'Multi-dim' },
  { id: 'correlation', label: 'Correlation', icon: GitCompare, desc: 'Channel matrix' },
  { id: 'distributions', label: 'Distrib', icon: BarChart3, desc: 'Histograms' },
  { id: 'pitprob', label: 'Pit Prob', icon: Percent, desc: 'Window probability' },
  { id: 'forecast', label: 'Forecast', icon: TrendingDown, desc: 'Confidence bands' },
  { id: 'simulation', label: 'Sim', icon: Dices, desc: 'Monte Carlo' },
  { id: 'gantt', label: 'Gantt', icon: GanttChartSquare, desc: 'Strategy timeline' },
  { id: 'lifecycle', label: 'Lifecycle', icon: History, desc: 'Tire timeline' },
  { id: 'weather', label: 'Weather', icon: CloudRain, desc: 'Temp impact' },
  { id: 'competitor', label: 'Competitors', icon: Users, desc: 'Benchmarking' },
  { id: 'drift', label: 'Drift', icon: TrendingDown, desc: 'Model drift' },
  { id: 'championship', label: 'Standings', icon: Trophy, desc: 'Points' },
  { id: 'model', label: 'Model Ops', icon: Cpu, desc: 'Retraining' },
]

export default function Home() {
  const [tab, setTab] = useState<Tab>('command')
  const [dashboard, setDashboard] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedRaceId, setSelectedRaceId] = useState<string | null>(null)
  const [telemetry, setTelemetry] = useState<Telemetry[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [pitDecisions, setPitDecisions] = useState<PitDecision[]>([])
  const [pitStats, setPitStats] = useState<any>(null)
  const [competitors, setCompetitors] = useState<any>(null)
  const [tireModels, setTireModels] = useState<TireModel[]>([])
  const [now, setNow] = useState(new Date())
  const [alertCount, setAlertCount] = useState(0)
  const [showAlerts, setShowAlerts] = useState(false)

  // Clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Poll alert count for header badge
  useEffect(() => {
    const load = () => {
      fetch('/api/alerts').then(r => r.json()).then((d) => {
        setAlertCount(d.stats?.critical || 0)
      }).catch(() => {})
    }
    load()
    const interval = setInterval(load, 20000)
    return () => clearInterval(interval)
  }, [])

  // Load dashboard aggregate
  useEffect(() => {
    fetch('/api/dashboard').then(r => r.json()).then((d) => {
      setDashboard(d)
      setDrivers(d.drivers || [])
      const ongoing = d.overview.ongoingRace
      const firstCompleted = d.races?.find((r: Race) => r.status === 'completed')
      setSelectedRaceId(ongoing?.id || firstCompleted?.id || d.races?.[0]?.id || null)
      setLoading(false)
    })
  }, [])

  // Load telemetry + drivers when race changes
  useEffect(() => {
    if (!selectedRaceId) return
    let active = true
    Promise.all([
      fetch(`/api/telemetry?raceId=${selectedRaceId}`).then(r => r.json()),
      fetch(`/api/drivers?raceId=${selectedRaceId}`).then(r => r.json()),
    ]).then(([telRes, drvRes]) => {
      if (!active) return
      setTelemetry(telRes.telemetry || [])
      setDrivers(drvRes.drivers || [])
    })
    return () => { active = false }
  }, [selectedRaceId])

  // Load pit decisions + competitors + models
  useEffect(() => {
    fetch('/api/pit-decisions').then(r => r.json()).then((d) => {
      setPitDecisions(d.decisions || [])
      setPitStats(d.stats)
    })
    fetch('/api/competitors').then(r => r.json()).then(setCompetitors)
    fetch('/api/tire-models').then(r => r.json()).then((d) => setTireModels(d.models || []))
  }, [])

  const handleSelectRace = (raceId: string) => {
    setSelectedRaceId(raceId)
    setTab('degradation')
  }

  if (loading || !dashboard) {
    return (
      <div className="min-h-screen flex items-center justify-center carbon-bg">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/15 border border-red-500/30 mb-4">
            <Radio className="h-6 w-6 text-red-500 rb-live-dot" />
          </div>
          <p className="font-mono text-sm text-muted-foreground">Initializing Tire Strategy Engine…</p>
          <div className="mt-3 flex justify-center gap-1">
            {[0, 1, 2].map(i => (
              <span key={i} className="h-1.5 w-1.5 rounded-full bg-red-500 rb-live-dot" style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  const ov: DashboardOverview = dashboard.overview
  const ongoingRace = ov.ongoingRace
  const totalLaps = ongoingRace?.lapsTotal || 58

  return (
    <div className="min-h-screen flex flex-col carbon-bg">
      {/* Top header bar */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-background/80 backdrop-blur-md">
        <div className="h-1 rb-stripe" />
        <div className="px-4 lg:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/15 border border-red-500/30 rb-lift">
              <Zap className="h-5 w-5 text-red-500" fill="currentColor" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-mono text-sm font-bold tracking-wide">RACING BULLS</h1>
                <span className="hidden sm:inline rounded bg-red-500/15 px-1.5 py-0.5 text-[9px] font-mono font-bold text-red-400 uppercase">Tire Strategy Engine</span>
              </div>
              <p className="text-[10px] font-mono text-muted-foreground hidden sm:block">Predictive Performance &amp; Pit Decision System</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Alerts bell */}
            <button
              onClick={() => setShowAlerts(!showAlerts)}
              className="relative rounded-lg bg-background/60 hover:bg-background/80 border border-white/10 px-2.5 py-1.5 transition-colors rb-lift"
              aria-label="Alerts"
            >
              <Bell className="h-4 w-4 text-foreground/80" />
              {alertCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-mono font-bold text-white rb-live-dot">
                  {alertCount}
                </span>
              )}
            </button>

            <div className="hidden md:flex items-center gap-4">
              <div className="text-right">
                <div className="text-[9px] font-mono text-muted-foreground uppercase">Model</div>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 rb-live-dot" />
                  <span className="font-mono text-xs font-bold text-green-400">{ov.activeModelVersion}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">· {(ov.activeModelAccuracy * 100).toFixed(1)}%</span>
                </div>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div className="text-right">
                <div className="text-[9px] font-mono text-muted-foreground uppercase">UTC</div>
                <div className="font-mono text-xs font-bold">{now.toLocaleTimeString('en-GB', { hour12: false })}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab navigation */}
        <nav className="px-4 lg:px-6 pb-2 flex items-center gap-1 overflow-x-auto rb-scroll">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'group flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-mono transition-all whitespace-nowrap',
                tab === t.id
                  ? 'bg-red-500/15 border border-red-500/40 text-red-300'
                  : 'border border-transparent text-muted-foreground hover:text-foreground hover:bg-white/5'
              )}
            >
              <t.icon className={cn('h-3.5 w-3.5', tab === t.id && 'text-red-400')} />
              <span className="font-bold">{t.label}</span>
              <span className="hidden xl:inline text-[9px] text-muted-foreground/70">· {t.desc}</span>
            </button>
          ))}
        </nav>
      </header>

      {/* Main content */}
      <main className="flex-1 px-4 lg:px-6 py-4">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
          {/* Main section */}
          <div className="min-w-0 space-y-4">
            {tab === 'command' && (
              <>
                <CommandCenter
                  overview={ov}
                  races={dashboard.races}
                  accuracyTrend={dashboard.accuracyTrend}
                  activeModel={dashboard.activeModel}
                  weeklyBrief={dashboard.weeklyBrief}
                  onSelectRace={handleSelectRace}
                />
                {selectedRaceId && (
                  <PositionChart raceId={selectedRaceId} totalLaps={totalLaps} />
                )}
              </>
            )}
            {tab === 'degradation' && (
              <TireDegradation
                telemetry={telemetry}
                drivers={drivers}
                raceId={selectedRaceId}
              />
            )}
            {tab === 'thermal' && (
              <ThermalHeatmap raceId={selectedRaceId} drivers={drivers} />
            )}
            {tab === 'live' && (
              <LiveRecommender raceId={selectedRaceId} />
            )}
            {tab === 'sector' && (
              <SectorAnalysis raceId={selectedRaceId} />
            )}
            {tab === 'explorer' && (
              <TelemetryExplorer raceId={selectedRaceId} drivers={drivers} />
            )}
            {tab === 'insights' && (
              <Insights raceId={selectedRaceId} />
            )}
            {tab === 'radar' && (
              <RadarChart raceId={selectedRaceId} drivers={drivers} />
            )}
            {tab === 'correlation' && (
              <CorrelationMatrix raceId={selectedRaceId} drivers={drivers} />
            )}
            {tab === 'distributions' && (
              <Distributions raceId={selectedRaceId} drivers={drivers} />
            )}
            {tab === 'pitprob' && (
              <PitProbability raceId={selectedRaceId} drivers={drivers} />
            )}
            {tab === 'forecast' && (
              <PerformanceForecast raceId={selectedRaceId} drivers={drivers} />
            )}
            {tab === 'simulation' && (
              <RaceSimulation raceId={selectedRaceId} />
            )}
            {tab === 'gantt' && (
              <GanttView raceId={selectedRaceId} />
            )}
            {tab === 'pitperf' && (
              <PitPerformance />
            )}
            {tab === 'pit' && (
              <PitStrategy
                decisions={pitDecisions}
                stats={pitStats}
                drivers={drivers}
                telemetry={telemetry}
              />
            )}
            {tab === 'simulator' && (
              <StrategySimulator totalLaps={totalLaps} />
            )}
            {tab === 'h2h' && (
              <HeadToHead raceId={selectedRaceId} drivers={drivers} />
            )}
            {tab === 'comparison' && (
              <StrategyComparison raceId={selectedRaceId} />
            )}
            {tab === 'delta' && (
              <DeltaMatrix raceId={selectedRaceId} drivers={drivers} />
            )}
            {tab === 'lifecycle' && (
              <TireLifecycle raceId={selectedRaceId} drivers={drivers} />
            )}
            {tab === 'weather' && (
              <WeatherImpact />
            )}
            {tab === 'drift' && (
              <ModelDrift />
            )}
            {tab === 'championship' && (
              <Championship />
            )}
            {tab === 'competitor' && competitors && (
              <div className="space-y-4">
                <CompetitorIntel
                  teamSummary={competitors.teamSummary}
                  strategyDistribution={competitors.strategyDistribution}
                  strategies={competitors.strategies}
                />
                <CircuitHeatmap />
              </div>
            )}
            {tab === 'model' && (
              <ModelOps models={tireModels} />
            )}
          </div>

          {/* Live telemetry sidebar */}
          <aside className="hidden xl:block sticky top-[140px] self-start space-y-3">
            {showAlerts && (
              <AlertsPanel compact />
            )}
            <div className="rounded-xl border border-white/10 bg-card/40 p-3">
              <LiveTelemetryPanel />
            </div>
          </aside>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-8 border-t border-white/10 bg-background/80 backdrop-blur-md">
        <div className="px-4 lg:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Circle className="h-2 w-2 fill-green-500 text-green-500 rb-live-dot" />
              <span>TELEMETRY</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Circle className="h-2 w-2 fill-green-500 text-green-500 rb-live-dot" />
              <span>ML PREDICTION</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Circle className="h-2 w-2 fill-green-500 text-green-500 rb-live-dot" />
              <span>FIA FEED</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Circle className="h-2 w-2 fill-green-500 text-green-500 rb-live-dot" />
              <span>ALERTS</span>
            </span>
          </div>
          <div className="text-[10px] font-mono text-muted-foreground">
            Apex Racing Performance Engineering · {new Date().getFullYear()} · v2.4.1 · Confidential
          </div>
        </div>
      </footer>
    </div>
  )
}
