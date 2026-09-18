'use client'

import { useEffect, useState, useRef } from 'react'
import * as d3 from 'd3'
import { Activity, Thermometer, Gauge, Zap, Clock, Play, Pause, ChevronLeft, ChevronRight, Sliders } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  raceId: string | null
  drivers: any[]
}

const CHANNEL_ICONS: Record<string, any> = {
  temps: Thermometer,
  pressures: Gauge,
  slip: Activity,
  brake: Zap,
  performance: Activity,
  laptime: Clock,
}

export function TelemetryExplorer({ raceId, drivers }: Props) {
  const [selectedDriver, setSelectedDriver] = useState('TSU')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [activeGroup, setActiveGroup] = useState('temps')
  const [scrubLap, setScrubLap] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const chartRef = useRef<SVGSVGElement>(null)

  const validDriver = drivers.some((d) => d.code === selectedDriver) ? selectedDriver : (drivers[0]?.code || '')

  useEffect(() => {
    if (!raceId) return
    let active = true
    fetch(`/api/telemetry-explorer?raceId=${raceId}&driverCode=${validDriver}`)
      .then(r => r.json())
      .then(d => { if (active) { setData(d); setLoading(false); setScrubLap(null) } })
      .catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [raceId, validDriver])

  // Playback
  useEffect(() => {
    if (!playing || !data?.channels) return
    const maxLap = data.channels.length
    let current = scrubLap ?? 1
    const interval = setInterval(() => {
      current++
      if (current > maxLap) { setPlaying(false); return }
      setScrubLap(current)
    }, 300)
    return () => clearInterval(interval)
  }, [playing, data, scrubLap])

  // Render chart
  useEffect(() => {
    if (!chartRef.current || !data?.channels) return
    const svg = d3.select(chartRef.current)
    svg.selectAll('*').remove()

    const group = data.channelGroups.find((g: any) => g.id === activeGroup)
    if (!group) return

    const width = 900
    const height = 280
    const margin = { top: 20, right: 80, bottom: 40, left: 50 }
    const w = width - margin.left - margin.right
    const h = height - margin.top - margin.bottom

    const laps = data.channels.map((c: any) => c.lap)
    const allValues = data.channels.flatMap((c: any) => group.channels.map((ch: any) => c[ch.id]))
    const minVal = Math.min(...allValues)
    const maxVal = Math.max(...allValues)
    const padding = (maxVal - minVal) * 0.1 || 1

    const x = d3.scaleLinear().domain([1, laps.length]).range([0, w])
    const y = d3.scaleLinear().domain([minVal - padding, maxVal + padding]).range([h, 0])

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    // Grid
    g.append('g').attr('class', 'd3-grid').call(d3.axisLeft(y).tickSize(-w).tickFormat(() => '').ticks(5))

    // Stint boundary markers
    for (const s of data.stints) {
      g.append('line')
        .attr('x1', x(s.startLap)).attr('x2', x(s.startLap))
        .attr('y1', 0).attr('y2', h)
        .attr('stroke', s.compound === 'Soft' ? '#ef4444' : s.compound === 'Medium' ? '#f59e0b' : '#e2e8f0')
        .attr('stroke-width', 1).attr('stroke-dasharray', '3,3').attr('opacity', 0.3)
    }

    // Lines per channel
    const line = d3.line<any>()
      .x((d) => x(d.lap))
      .y((d) => y(d[chId]))
      .curve(d3.curveMonotoneX)

    for (const ch of group.channels) {
      const chId = ch.id
      const lineGen = d3.line<any>()
        .x((d) => x(d.lap))
        .y((d) => y(d[chId]))
        .curve(d3.curveMonotoneX)

      // Area
      const areaGen = d3.area<any>()
        .x((d) => x(d.lap))
        .y0(h)
        .y1((d) => y(d[chId]))
        .curve(d3.curveMonotoneX)

      g.append('path')
        .datum(data.channels)
        .attr('fill', ch.color)
        .attr('opacity', 0.06)
        .attr('d', areaGen)

      g.append('path')
        .datum(data.channels)
        .attr('fill', 'none')
        .attr('stroke', ch.color)
        .attr('stroke-width', 2)
        .attr('d', lineGen)

      // Points
      g.selectAll(`.pt-${chId}`)
        .data(data.channels)
        .enter()
        .append('circle')
        .attr('class', `pt-${chId}`)
        .attr('cx', (d) => x(d.lap))
        .attr('cy', (d) => y(d[chId]))
        .attr('r', 2)
        .attr('fill', ch.color)
        .attr('opacity', 0.6)
    }

    // Scrub cursor
    if (scrubLap !== null) {
      g.append('line')
        .attr('x1', x(scrubLap)).attr('x2', x(scrubLap))
        .attr('y1', 0).attr('y2', h)
        .attr('stroke', '#f8fafc')
        .attr('stroke-width', 1.5)
        .attr('opacity', 0.5)
      g.append('text')
        .attr('x', x(scrubLap))
        .attr('y', -4)
        .attr('text-anchor', 'middle')
        .attr('fill', '#f8fafc')
        .attr('font-size', '9px')
        .attr('font-family', 'monospace')
        .attr('font-weight', '700')
        .text(`L${scrubLap}`)
    }

    // Axes
    g.append('g').attr('class', 'd3-axis').attr('transform', `translate(0,${h})`)
      .call(d3.axisBottom(x).ticks(Math.min(15, laps.length)).tickFormat((d) => `L${d}`))
    g.append('g').attr('class', 'd3-axis').call(d3.axisLeft(y).ticks(5).tickFormat((d) => `${(+d).toFixed(1)}`))

    // Labels
    g.append('text')
      .attr('x', w / 2).attr('y', h + 34)
      .attr('text-anchor', 'middle')
      .attr('fill', 'oklch(0.75 0.012 264)')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace')
      .text('Lap')
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -h / 2).attr('y', -38)
      .attr('text-anchor', 'middle')
      .attr('fill', 'oklch(0.75 0.012 264)')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace')
      .text(`${group.label} (${group.unit})`)

    // Legend on right
    const legend = svg.append('g').attr('transform', `translate(${width - 70}, ${margin.top})`)
    group.channels.forEach((ch: any, i: number) => {
      const ly = i * 18
      legend.append('rect').attr('x', 0).attr('y', ly).attr('width', 10).attr('height', 10).attr('fill', ch.color).attr('rx', 1)
      legend.append('text').attr('x', 14).attr('y', ly + 9).attr('fill', 'oklch(0.85 0.01 264)').attr('font-size', '10px').attr('font-family', 'monospace').text(ch.label)
    })
  }, [data, activeGroup, scrubLap])

  if (loading || !data) {
    return (
      <div className="rounded-xl border border-white/10 bg-card/40 p-8 text-center">
        <Activity className="h-6 w-6 text-muted-foreground animate-pulse mx-auto mb-2" />
        <p className="text-xs font-mono text-muted-foreground">Loading telemetry channels…</p>
      </div>
    )
  }

  const currentLapData = scrubLap !== null ? data.channels.find((c: any) => c.lap === scrubLap) : data.channels[data.channels.length - 1]
  const group = data.channelGroups.find((g: any) => g.id === activeGroup)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-white/10 bg-card/40 rb-card-glass">
        <div className="flex items-center gap-2">
          <Sliders className="h-4 w-4 text-red-400" />
          <span className="text-xs font-mono font-bold">TELEMETRY EXPLORER</span>
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

      {/* Channel group selector */}
      <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl border border-white/10 bg-card/40">
        {data.channelGroups.map((g: any) => {
          const Icon = CHANNEL_ICONS[g.id] || Activity
          return (
            <button
              key={g.id}
              onClick={() => setActiveGroup(g.id)}
              className={cn(
                'rb-sweep flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-mono font-bold transition-all',
                activeGroup === g.id ? 'bg-red-500/15 border border-red-500/40 text-red-300' : 'bg-background/40 border border-white/5 text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-3 w-3" style={{ color: activeGroup === g.id ? g.color : undefined }} />
              {g.label}
              <span className="text-[8px] text-muted-foreground">{g.unit}</span>
            </button>
          )
        })}
      </div>

      {/* Current lap readout */}
      <div className="rb-card-glass rounded-xl border border-white/10 p-4 rb-bounce-in">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className="text-[9px] font-mono text-muted-foreground uppercase">LAP</div>
              <div className="font-mono text-2xl font-bold text-amber-400">{currentLapData?.lap || '—'}</div>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="text-center">
              <div className="text-[9px] font-mono text-muted-foreground uppercase">COMPOUND</div>
              <div className="flex items-center gap-1.5 justify-center">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: currentLapData?.compoundColor || '#888' }} />
                <span className="font-mono text-sm font-bold">{currentLapData?.compound || '—'}</span>
              </div>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="text-center">
              <div className="text-[9px] font-mono text-muted-foreground uppercase">TIRE AGE</div>
              <div className="font-mono text-sm font-bold text-amber-400">L{currentLapData?.tireAge || '—'}</div>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="text-center">
              <div className="text-[9px] font-mono text-muted-foreground uppercase">PERF</div>
              <div className="font-mono text-sm font-bold text-green-400">{((currentLapData?.tirePerformance || 0) * 100).toFixed(1)}%</div>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="text-center">
              <div className="text-[9px] font-mono text-muted-foreground uppercase">LAP TIME</div>
              <div className="font-mono text-sm font-bold text-cyan-400">{currentLapData?.lapTime?.toFixed(3) || '—'}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setScrubLap(Math.max(1, (scrubLap ?? data.channels.length) - 1))}
              className="rounded-lg bg-background/60 hover:bg-background/80 border border-white/10 p-1.5 transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => {
                if (playing) { setPlaying(false) }
                else { setScrubLap(1); setPlaying(true) }
              }}
              className={cn(
                'rb-lift rounded-lg border px-3 py-1.5 text-[10px] font-mono font-bold transition-colors flex items-center gap-1',
                playing ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'bg-red-500/15 border-red-500/40 text-red-300'
              )}
            >
              {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              {playing ? 'PAUSE' : 'PLAY'}
            </button>
            <button
              onClick={() => setScrubLap(Math.min(data.channels.length, (scrubLap ?? 1) + 1))}
              className="rounded-lg bg-background/60 hover:bg-background/80 border border-white/10 p-1.5 transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Scrub slider */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-muted-foreground">L1</span>
          <input
            type="range"
            min={1}
            max={data.channels.length}
            value={scrubLap ?? data.channels.length}
            onChange={(e) => { setPlaying(false); setScrubLap(parseInt(e.target.value)) }}
            className="flex-1 accent-red-500"
          />
          <span className="text-[10px] font-mono text-muted-foreground">L{data.channels.length}</span>
        </div>
      </div>

      {/* Channel chart */}
      <div className="rounded-xl border border-white/10 bg-card/40 p-4">
        <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ background: group?.color }} />
          {group?.label?.toUpperCase()} · {data.driver.code}
        </h3>
        <svg ref={chartRef} viewBox="0 0 900 280" style={{ width: '100%', height: 'auto' }} />
      </div>

      {/* Current lap channel values */}
      {currentLapData && (
        <div className="rounded-xl border border-white/10 bg-card/40 p-4">
          <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-cyan-400" />
            LAP {currentLapData.lap} CHANNEL VALUES
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {group?.channels.map((ch: any) => (
              <div key={ch.id} className="rounded-lg bg-background/30 p-2 border border-white/5">
                <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground uppercase">
                  <span className="h-2 w-2 rounded-full" style={{ background: ch.color }} />
                  {ch.label}
                </div>
                <div className="font-mono text-lg font-bold" style={{ color: ch.color }}>
                  {typeof currentLapData[ch.id] === 'number' ? currentLapData[ch.id].toFixed(1) : '—'}
                  <span className="text-[10px] text-muted-foreground ml-1">{group.unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
