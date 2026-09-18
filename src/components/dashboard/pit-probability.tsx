'use client'

import { useEffect, useState, useRef } from 'react'
import * as d3 from 'd3'
import { Target, Activity, Gauge, Zap, AlertTriangle, CheckCircle2, TrendingUp, Percent } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  raceId: string | null
  drivers: any[]
}

export function PitProbability({ raceId, drivers }: Props) {
  const [selectedDriver, setSelectedDriver] = useState('TSU')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const chartRef = useRef<SVGSVGElement>(null)

  const validDriver = drivers.some((d) => d.code === selectedDriver) ? selectedDriver : (drivers[0]?.code || '')

  useEffect(() => {
    if (!raceId) return
    let active = true
    fetch(`/api/pit-probability?raceId=${raceId}&driverCode=${validDriver}`)
      .then(r => r.json())
      .then(d => { if (active) { setData(d); setLoading(false) } })
      .catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [raceId, validDriver])

  // Render probability distribution chart
  useEffect(() => {
    if (!chartRef.current || !data?.distribution) return
    const svg = d3.select(chartRef.current)
    svg.selectAll('*').remove()

    const width = 700
    const height = 280
    const margin = { top: 20, right: 40, bottom: 40, left: 50 }
    const w = width - margin.left - margin.right
    const h = height - margin.top - margin.bottom

    const dist = data.distribution
    const x = d3.scaleBand().domain(dist.map((d: any) => d.lap)).range([0, w]).padding(0.2)
    const maxProb = Math.max(...dist.map((d: any) => d.probability))
    const y = d3.scaleLinear().domain([0, Math.max(maxProb * 1.1, 10)]).range([h, 0])

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    // Grid
    g.append('g').attr('class', 'd3-grid').call(d3.axisLeft(y).tickSize(-w).tickFormat(() => '').ticks(5))

    // Color scale based on probability
    const color = d3.scaleLinear<string>()
      .domain([0, maxProb * 0.3, maxProb * 0.7, maxProb])
      .range(['#1a1a2e', '#f59e0b', '#f97316', '#ef4444'])

    // Bars
    dist.forEach((d: any) => {
      const isMostLikely = d.lap === data.window.mostLikelyLap
      g.append('rect')
        .attr('x', x(d.lap)!)
        .attr('y', y(d.probability))
        .attr('width', x.bandwidth())
        .attr('height', h - y(d.probability))
        .attr('fill', isMostLikely ? '#ef4444' : color(d.probability))
        .attr('opacity', isMostLikely ? 1 : 0.7)
        .attr('rx', 2)
        .style('cursor', 'pointer')

      if (isMostLikely || d.probability > maxProb * 0.5) {
        g.append('text')
          .attr('x', x(d.lap)! + x.bandwidth() / 2)
          .attr('y', y(d.probability) - 4)
          .attr('text-anchor', 'middle')
          .attr('fill', isMostLikely ? '#ef4444' : 'oklch(0.85 0.01 264)')
          .attr('font-size', '9px')
          .attr('font-family', 'var(--font-geist-mono), monospace')
          .attr('font-weight', '700')
          .text(`${d.probability}%`)
      }
    })

    // 80% confidence interval markers
    const p10 = data.window.p10
    const p90 = data.window.p90
    g.append('rect')
      .attr('x', x(p10)!)
      .attr('y', 0)
      .attr('width', (x(p90)! || w) - (x(p10)! || 0) + x.bandwidth())
      .attr('height', h)
      .attr('fill', '#22c55e')
      .attr('opacity', 0.06)
      .attr('rx', 3)

    // Axes
    g.append('g').attr('class', 'd3-axis').attr('transform', `translate(0,${h})`)
      .call(d3.axisBottom(x).tickFormat((d) => `L${d}`))
    g.append('g').attr('class', 'd3-axis').call(d3.axisLeft(y).ticks(5).tickFormat((d) => `${d}%`))

    // Labels
    g.append('text')
      .attr('x', w / 2).attr('y', h + 34)
      .attr('text-anchor', 'middle')
      .attr('fill', 'oklch(0.75 0.012 264)')
      .attr('font-size', '10px')
      .attr('font-family', 'var(--font-geist-mono), monospace')
      .text('Pit Lap')
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -h / 2).attr('y', -38)
      .attr('text-anchor', 'middle')
      .attr('fill', 'oklch(0.75 0.012 264)')
      .attr('font-size', '10px')
      .attr('font-family', 'var(--font-geist-mono), monospace')
      .text('Probability (%)')
  }, [data])

  if (loading || !data) {
    return (
      <div className="rounded-xl border border-white/10 bg-card/40 p-8 text-center">
        <Target className="h-6 w-6 text-muted-foreground animate-pulse mx-auto mb-2" />
        <p className="text-xs font-mono text-muted-foreground">Running 500 Monte Carlo simulations…</p>
      </div>
    )
  }

  const u = data.urgency

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-white/10 bg-card/40 rb-card-glass">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-red-400" />
          <span className="text-xs font-mono font-bold">PIT WINDOW PROBABILITY</span>
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

      {/* Urgency banner */}
      <div className={cn('rb-card-glass rounded-xl border p-4 rb-bounce-in rb-border-pulse')} style={{ borderColor: `${u.color}40`, background: `${u.color}10` }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border" style={{ background: `${u.color}20`, borderColor: `${u.color}40` }}>
              {u.level === 'STABLE' ? <CheckCircle2 className="h-6 w-6" style={{ color: u.color }} /> : <AlertTriangle className="h-6 w-6 rb-live-dot" style={{ color: u.color }} />}
            </div>
            <div>
              <div className="text-[10px] font-mono font-bold uppercase tracking-wider" style={{ color: u.color }}>
                URGENCY: {u.level}
              </div>
              <div className="font-mono text-sm font-bold mt-0.5">
                Most likely pit: <span style={{ color: u.color }}>L{data.window.mostLikelyLap}</span>
                <span className="text-muted-foreground"> ({data.window.mostLikelyProb}% probability)</span>
              </div>
              <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{data.summary.recommendation}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-[10px] font-mono">
            <div className="text-center">
              <div className="text-muted-foreground uppercase">80% CI</div>
              <div className="font-bold text-lg" style={{ color: u.color }}>L{data.window.p10}-L{data.window.p90}</div>
            </div>
            <div className="text-center">
              <div className="text-muted-foreground uppercase">Mean</div>
              <div className="font-bold text-lg text-cyan-400">L{data.window.meanLap}</div>
            </div>
            <div className="text-center">
              <div className="text-muted-foreground uppercase">Laps to Pit</div>
              <div className="font-bold text-lg" style={{ color: u.color }}>{u.lapsToPit > 0 ? `+${u.lapsToPit}` : '0'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Current state cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rb-card-glass rounded-xl border border-white/10 p-3 rb-lift rb-stagger rb-delay-1">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground uppercase mb-1">
            <Gauge className="h-3 w-3 text-amber-400" />CURRENT LAP
          </div>
          <div className="font-mono text-xl font-bold text-cyan-400">L{data.current.lap}</div>
          <div className="text-[9px] font-mono text-muted-foreground">of {data.race.totalLaps}</div>
        </div>
        <div className="rb-card-glass rounded-xl border border-white/10 p-3 rb-lift rb-stagger rb-delay-2">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground uppercase mb-1">
            <Activity className="h-3 w-3 text-red-400" />TIRE AGE
          </div>
          <div className="font-mono text-xl font-bold text-amber-400">L{data.current.tireAge}</div>
          <div className="text-[9px] font-mono text-muted-foreground">{data.current.compound}</div>
        </div>
        <div className="rb-card-glass rounded-xl border border-white/10 p-3 rb-lift rb-stagger rb-delay-3">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground uppercase mb-1">
            <Zap className="h-3 w-3 text-green-400" />PERFORMANCE
          </div>
          <div className="font-mono text-xl font-bold text-green-400">{(data.current.currentPerf * 100).toFixed(1)}%</div>
        </div>
        <div className="rb-card-glass rounded-xl border border-white/10 p-3 rb-lift rb-stagger rb-delay-4">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground uppercase mb-1">
            <Gauge className="h-3 w-3 text-red-400" />TEMP
          </div>
          <div className="font-mono text-xl font-bold text-red-400">{data.current.avgTemp}°</div>
        </div>
        <div className="rb-card-glass rounded-xl border border-white/10 p-3 rb-lift rb-stagger rb-delay-5">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground uppercase mb-1">
            <TrendingUp className="h-3 w-3 text-cyan-400" />FUEL
          </div>
          <div className="font-mono text-xl font-bold text-cyan-400">{data.current.fuelLoad}kg</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* Probability distribution chart */}
        <div className="rounded-xl border border-white/10 bg-card/40 p-4">
          <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
            <Percent className="h-4 w-4 text-amber-400" />
            PIT LAP PROBABILITY DISTRIBUTION (500 simulations)
          </h3>
          <svg ref={chartRef} viewBox="0 0 700 280" style={{ width: '100%', height: 'auto' }} />
          <div className="mt-2 flex items-center justify-between text-[9px] font-mono text-muted-foreground">
            <span><span className="text-green-400">●</span> 80% confidence interval (L{data.window.p10}-L{data.window.p90})</span>
            <span><span className="text-red-400">●</span> Most likely: L{data.window.mostLikelyLap} ({data.window.mostLikelyProb}%)</span>
          </div>
        </div>

        {/* Decision factors */}
        <div className="rounded-xl border border-white/10 bg-card/40 p-4">
          <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            DECISION FACTORS
          </h3>
          <div className="space-y-2">
            {data.factors.map((f: any, i: number) => {
              const colors: Record<string, string> = { positive: '#22c55e', warning: '#f59e0b', negative: '#ef4444' }
              const c = colors[f.impact]
              return (
                <div key={i} className="rounded-lg bg-background/30 p-2.5 border border-white/5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase">{f.factor}</span>
                    <span className="font-mono text-xs font-bold" style={{ color: c }}>{f.value}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: c }} />
                    <p className="text-[9px] font-mono text-muted-foreground leading-tight">{f.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Window statistics */}
      <div className="rounded-xl border border-white/10 bg-card/40 p-4">
        <h3 className="text-sm font-bold font-mono mb-3">WINDOW STATISTICS</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[10px] font-mono">
          <div className="rounded-lg bg-background/30 p-3 border border-white/5">
            <div className="text-muted-foreground uppercase mb-1">Range</div>
            <div className="font-bold text-lg text-cyan-400">L{data.window.range.split('-')[0]} - L{data.window.range.split('-')[1]}</div>
          </div>
          <div className="rounded-lg bg-background/30 p-3 border border-white/5">
            <div className="text-muted-foreground uppercase mb-1">Median (P50)</div>
            <div className="font-bold text-lg text-amber-400">L{data.window.medianLap}</div>
          </div>
          <div className="rounded-lg bg-background/30 p-3 border border-white/5">
            <div className="text-muted-foreground uppercase mb-1">80% Confidence</div>
            <div className="font-bold text-lg text-green-400">L{data.window.p10} - L{data.window.p90}</div>
          </div>
          <div className="rounded-lg bg-background/30 p-3 border border-white/5">
            <div className="text-muted-foreground uppercase mb-1">Most Likely</div>
            <div className="font-bold text-lg text-red-400">L{data.window.mostLikelyLap}</div>
            <div className="text-[9px] text-muted-foreground">{data.window.mostLikelyProb}% probability</div>
          </div>
        </div>
      </div>
    </div>
  )
}
