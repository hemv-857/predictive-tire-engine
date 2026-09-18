'use client'

import { useEffect, useState, useRef } from 'react'
import * as d3 from 'd3'
import { BarChart3, Activity, Gauge, Zap, Thermometer, TrendingUp, Award } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  raceId: string | null
  drivers: any[]
}

const GROUP_ICONS: Record<string, any> = {
  temp: Thermometer,
  pressure: Gauge,
  slip: Activity,
  brake: Zap,
  other: BarChart3,
}

export function Distributions({ raceId, drivers }: Props) {
  const [selectedDriver, setSelectedDriver] = useState('TSU')
  const [activeGroup, setActiveGroup] = useState('temp')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const validDriver = drivers.some((d) => d.code === selectedDriver) ? selectedDriver : (drivers[0]?.code || '')

  useEffect(() => {
    if (!raceId) return
    let active = true
    fetch(`/api/distributions?raceId=${raceId}&driverCode=${validDriver}`)
      .then(r => r.json())
      .then(d => { if (active) { setData(d); setLoading(false) } })
      .catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [raceId, validDriver])

  if (loading || !data) {
    return (
      <div className="rounded-xl border border-white/10 bg-card/40 p-8 text-center">
        <BarChart3 className="h-6 w-6 text-muted-foreground animate-pulse mx-auto mb-2" />
        <p className="text-xs font-mono text-muted-foreground">Computing distributions…</p>
      </div>
    )
  }

  const activeChannels = data.distributions.filter((d: any) => d.group === activeGroup)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-white/10 bg-card/40 rb-card-glass">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-red-400" />
          <span className="text-xs font-mono font-bold">CHANNEL DISTRIBUTIONS</span>
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

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rb-card-glass rounded-xl border border-white/10 p-3 rb-lift rb-stagger rb-delay-1">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground uppercase mb-1">
            <Activity className="h-3 w-3 text-cyan-400" />CHANNELS
          </div>
          <div className="font-mono text-xl font-bold text-cyan-400">{data.summary.totalChannels}</div>
          <div className="text-[9px] font-mono text-muted-foreground">{data.summary.totalDataPoints} data points</div>
        </div>
        <div className="rb-card-glass rounded-xl border border-green-500/30 bg-green-500/[0.06] p-3 rb-lift rb-stagger rb-delay-2">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground uppercase mb-1">
            <Award className="h-3 w-3 text-green-400" />BEST CHANNEL
          </div>
          <div className="font-mono text-sm font-bold text-green-400">{data.summary.bestChannel?.label}</div>
          <div className="text-[9px] font-mono text-muted-foreground">{data.summary.bestChannel?.stats.optimalPct}% optimal</div>
        </div>
        <div className="rb-card-glass rounded-xl border border-red-500/30 bg-red-500/[0.06] p-3 rb-lift rb-stagger rb-delay-3">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground uppercase mb-1">
            <TrendingUp className="h-3 w-3 text-red-400" />WORST CHANNEL
          </div>
          <div className="font-mono text-sm font-bold text-red-400">{data.summary.worstChannel?.label}</div>
          <div className="text-[9px] font-mono text-muted-foreground">{data.summary.worstChannel?.stats.optimalPct}% optimal</div>
        </div>
        <div className="rb-card-glass rounded-xl border border-white/10 p-3 rb-lift rb-stagger rb-delay-4">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground uppercase mb-1">
            <Gauge className="h-3 w-3 text-amber-400" />AVG DATA POINTS
          </div>
          <div className="font-mono text-xl font-bold text-amber-400">{Math.round(data.summary.totalDataPoints / data.summary.totalChannels)}</div>
          <div className="text-[9px] font-mono text-muted-foreground">per channel</div>
        </div>
      </div>

      {/* Group selector */}
      <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl border border-white/10 bg-card/40">
        {data.groups.map((g: any) => {
          const Icon = GROUP_ICONS[g.id] || BarChart3
          return (
            <button
              key={g.id}
              onClick={() => setActiveGroup(g.id)}
              className={cn(
                'rb-sweep flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-mono font-bold transition-all',
                activeGroup === g.id ? 'bg-red-500/15 border border-red-500/40 text-red-300' : 'bg-background/40 border border-white/5 text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-3 w-3" />
              {g.label}
              <span className="text-[8px] text-muted-foreground">({g.channels.length})</span>
            </button>
          )
        })}
      </div>

      {/* Distribution histograms */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {activeChannels.map((ch: any) => (
          <HistogramCard key={ch.id} channel={ch} />
        ))}
      </div>
    </div>
  )
}

function HistogramCard({ channel }: { channel: any }) {
  const ref = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!ref.current || !channel?.buckets) return
    const svg = d3.select(ref.current)
    svg.selectAll('*').remove()

    const width = 360
    const height = 160
    const margin = { top: 16, right: 20, bottom: 32, left: 36 }
    const w = width - margin.left - margin.right
    const h = height - margin.top - margin.bottom

    const buckets = channel.buckets
    const maxCount = Math.max(...buckets.map((b: any) => b.count))
    const x = d3.scaleBand().domain(buckets.map((_: any, i: number) => i)).range([0, w]).padding(0.15)
    const y = d3.scaleLinear().domain([0, Math.max(maxCount, 1)]).range([h, 0])

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    // Grid
    g.append('g').attr('class', 'd3-grid').call(d3.axisLeft(y).tickSize(-w).tickFormat(() => '').ticks(3))

    // Bars
    buckets.forEach((bucket: any, i: number) => {
      const isInOptimal = bucket.rangeStart >= channel.optimal.min && bucket.rangeEnd <= channel.optimal.max + 0.01
      g.append('rect')
        .attr('x', x(i)!)
        .attr('y', y(bucket.count))
        .attr('width', x.bandwidth())
        .attr('height', h - y(bucket.count))
        .attr('fill', isInOptimal ? '#22c55e' : channel.color)
        .attr('opacity', isInOptimal ? 0.9 : 0.5)
        .attr('rx', 2)
    })

    // Optimal zone marker
    const optStartIdx = buckets.findIndex((b: any) => b.rangeStart >= channel.optimal.min)
    const optEndIdx = buckets.findIndex((b: any) => b.rangeStart > channel.optimal.max)
    if (optStartIdx >= 0) {
      const endIdx = optEndIdx >= 0 ? optEndIdx : buckets.length
      g.append('rect')
        .attr('x', x(optStartIdx)!)
        .attr('y', 0)
        .attr('width', (x(endIdx - 1)! || w) - (x(optStartIdx)! || 0) + x.bandwidth())
        .attr('height', h)
        .attr('fill', '#22c55e')
        .attr('opacity', 0.06)
        .attr('rx', 3)
    }

    // Axes
    const tickStep = Math.max(1, Math.floor(buckets.length / 6))
    g.append('g').attr('class', 'd3-axis').attr('transform', `translate(0,${h})`)
      .call(d3.axisBottom(x).tickValues(buckets.map((_: any, i: number) => i).filter((i: number) => i % tickStep === 0)).tickFormat((d) => buckets[d as number].rangeStart.toFixed(channel.bucketSize < 1 ? 1 : 0)))
    g.append('g').attr('class', 'd3-axis').call(d3.axisLeft(y).ticks(3).tickFormat((d) => `${d}`))

    // Labels
    g.append('text')
      .attr('x', w / 2).attr('y', h + 26)
      .attr('text-anchor', 'middle')
      .attr('fill', 'oklch(0.75 0.012 264)')
      .attr('font-size', '9px')
      .attr('font-family', 'var(--font-geist-mono), monospace')
      .text(`${channel.unit}`)
  }, [channel])

  return (
    <div className="rounded-xl border border-white/10 bg-card/40 p-4 rb-lift">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded" style={{ background: channel.color }} />
          <span className="text-xs font-mono font-bold">{channel.label}</span>
        </div>
        <span className={cn('rb-chip border', channel.stats.optimalPct > 70 ? 'bg-green-500/15 text-green-300 border-green-500/30' : channel.stats.optimalPct > 40 ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' : 'bg-red-500/15 text-red-300 border-red-500/30')}>
          {channel.stats.optimalPct}% optimal
        </span>
      </div>
      <svg ref={ref} viewBox="0 0 360 160" style={{ width: '100%', height: 'auto' }} />
      <div className="mt-2 grid grid-cols-4 gap-1 text-[9px] font-mono">
        <div><span className="text-muted-foreground">AVG</span><div className="font-bold text-cyan-400">{channel.stats.avg}</div></div>
        <div><span className="text-muted-foreground">MED</span><div className="font-bold">{channel.stats.median}</div></div>
        <div><span className="text-muted-foreground">σ</span><div className="font-bold text-amber-400">{channel.stats.std}</div></div>
        <div><span className="text-muted-foreground">RANGE</span><div className="font-bold text-xs">{channel.stats.min}-{channel.stats.max}</div></div>
      </div>
      <div className="mt-1.5 text-[9px] font-mono text-muted-foreground">
        <span className="text-green-400">●</span> {channel.optimal.label} · skewness: {channel.stats.skewness}
      </div>
    </div>
  )
}
