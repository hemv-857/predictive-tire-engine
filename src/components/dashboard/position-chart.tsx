'use client'

import { useEffect, useState, useRef } from 'react'
import * as d3 from 'd3'
import { TrendingUp, Flag, FastForward, Pause, Play } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DriverPoint {
  x: number
  y: number
  lapTime?: number
  tirePerf?: number
}

interface DriverSeries {
  id: string
  name: string
  color: string
  points: DriverPoint[]
}

interface Props {
  raceId: string | null
  totalLaps: number
}

export function PositionChart({ raceId, totalLaps }: Props) {
  const [series, setSeries] = useState<DriverSeries[]>([])
  const [finalOrder, setFinalOrder] = useState<any[]>([])
  const [race, setRace] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [replayLap, setReplayLap] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [hoveredDriver, setHoveredDriver] = useState<string | null>(null)
  const ref = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!raceId) return
    let active = true
    setLoading(true)
    fetch(`/api/positions?raceId=${raceId}`).then(r => r.json()).then((d) => {
      if (!active) return
      setSeries(d.positionSeries || [])
      setFinalOrder(d.finalOrder || [])
      setRace(d.race)
      setReplayLap(null)
      setLoading(false)
    }).catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [raceId])

  // Replay playback
  useEffect(() => {
    if (!playing || !series.length) return
    const maxLap = Math.max(...series.flatMap((s) => s.points.map((p) => p.x)))
    let current = replayLap ?? 1
    const interval = setInterval(() => {
      current++
      if (current > maxLap) {
        setPlaying(false)
        return
      }
      setReplayLap(current)
    }, 400)
    return () => clearInterval(interval)
  }, [playing, series, replayLap])

  // Render the chart
  useEffect(() => {
    if (!ref.current || series.length === 0) return
    const svg = d3.select(ref.current)
    svg.selectAll('*').remove()

    const width = 900
    const height = 360
    const margin = { top: 20, right: 100, bottom: 40, left: 50 }
    const w = width - margin.left - margin.right
    const h = height - margin.top - margin.bottom

    const allXs = series.flatMap((s) => s.points.map((p) => p.x))
    const xMax = d3.max(allXs) ?? totalLaps
    const numDrivers = series.length

    const x = d3.scaleLinear().domain([1, xMax]).range([0, w])
    // Invert Y so P1 is at top
    const y = d3.scaleLinear().domain([numDrivers + 0.5, 0.5]).range([h, 0])

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    // Grid
    g.append('g')
      .attr('class', 'd3-grid')
      .call(d3.axisLeft(y).tickSize(-w).tickFormat(() => '').ticks(numDrivers))

    // Driver labels on right
    const labelGroups = g.append('g').attr('class', 'driver-labels')

    // Lines
    const line = d3.line<DriverPoint>()
      .x((d) => x(d.x))
      .y((d) => y(d.y))
      .curve(d3.curveMonotoneX)

    for (const s of series) {
      const visiblePoints = replayLap !== null ? s.points.filter((p) => p.x <= replayLap) : s.points
      if (visiblePoints.length === 0) continue

      const isDimmed = hoveredDriver !== null && hoveredDriver !== s.id
      const isHighlighted = hoveredDriver === s.id

      // Line
      g.append('path')
        .datum(visiblePoints)
        .attr('fill', 'none')
        .attr('stroke', s.color)
        .attr('stroke-width', isHighlighted ? 3.5 : 2)
        .attr('opacity', isDimmed ? 0.15 : isHighlighted ? 1 : 0.85)
        .attr('d', line)
        .style('cursor', 'pointer')
        .on('mouseenter', () => setHoveredDriver(s.id))
        .on('mouseleave', () => setHoveredDriver(null))

      // Points
      g.selectAll(`.pt-${s.id}`)
        .data(visiblePoints)
        .enter()
        .append('circle')
        .attr('class', `pt-${s.id}`)
        .attr('cx', (d) => x(d.x))
        .attr('cy', (d) => y(d.y))
        .attr('r', isHighlighted ? 4 : 2.5)
        .attr('fill', s.color)
        .attr('opacity', isDimmed ? 0.1 : isHighlighted ? 1 : 0.7)

      // Latest position marker + label
      const latest = visiblePoints[visiblePoints.length - 1]
      if (latest) {
        g.append('circle')
          .attr('cx', x(latest.x))
          .attr('cy', y(latest.y))
          .attr('r', isHighlighted ? 6 : 5)
          .attr('fill', s.color)
          .attr('stroke', '#0a0a0f')
          .attr('stroke-width', 2)
          .attr('opacity', isDimmed ? 0.2 : 1)

        // Label
        labelGroups.append('text')
          .attr('x', w + 6)
          .attr('y', y(latest.y))
          .attr('dy', '0.32em')
          .attr('fill', s.color)
          .attr('font-size', '11px')
          .attr('font-family', 'var(--font-geist-mono), monospace')
          .attr('font-weight', '700')
          .attr('opacity', isDimmed ? 0.2 : 1)
          .text(`P${latest.y} ${s.id}`)
      }
    }

    // Replay cursor
    if (replayLap !== null) {
      g.append('line')
        .attr('x1', x(replayLap)).attr('x2', x(replayLap))
        .attr('y1', 0).attr('y2', h)
        .attr('stroke', '#ef4444')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4,3')
        .attr('opacity', 0.7)
      g.append('text')
        .attr('x', x(replayLap))
        .attr('y', 12)
        .attr('text-anchor', 'middle')
        .attr('fill', '#ef4444')
        .attr('font-size', '10px')
        .attr('font-family', 'var(--font-geist-mono), monospace')
        .attr('font-weight', '700')
        .text(`LAP ${replayLap}`)
    }

    // Axes
    g.append('g')
      .attr('class', 'd3-axis')
      .attr('transform', `translate(0,${h})`)
      .call(d3.axisBottom(x).ticks(Math.min(15, xMax)).tickFormat((d) => `L${d}`))
    g.append('g')
      .attr('class', 'd3-axis')
      .call(d3.axisLeft(y).ticks(numDrivers).tickFormat((d) => `P${d}`))

    // Axis labels
    g.append('text')
      .attr('x', w / 2).attr('y', h + 32)
      .attr('text-anchor', 'middle')
      .attr('fill', 'oklch(0.75 0.012 264)')
      .attr('font-size', '11px')
      .attr('font-family', 'var(--font-geist-mono), monospace')
      .text('Lap')
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -h / 2).attr('y', -36)
      .attr('text-anchor', 'middle')
      .attr('fill', 'oklch(0.75 0.012 264)')
      .attr('font-size', '11px')
      .attr('font-family', 'var(--font-geist-mono), monospace')
      .text('Position')
  }, [series, replayLap, totalLaps, hoveredDriver])

  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 bg-card/40 p-4">
        <div className="h-[360px] flex items-center justify-center">
          <div className="text-center">
            <TrendingUp className="h-6 w-6 text-muted-foreground animate-pulse mx-auto mb-2" />
            <p className="text-xs font-mono text-muted-foreground">Loading race positions…</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-white/10 bg-card/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold font-mono flex items-center gap-2">
            <Flag className="h-4 w-4 text-amber-400" />
            RACE POSITION TRAJECTORY
            {hoveredDriver && (
              <span className="rb-chip bg-amber-500/15 text-amber-300 border border-amber-500/30 rb-fade-up">
                ● {hoveredDriver} highlighted
              </span>
            )}
          </h3>
          <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
            {race?.name} · {finalOrder.length} drivers · {series[0]?.points.length || 0} laps · <span className="text-cyan-400">hover a line to isolate</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (playing) { setPlaying(false) }
              else {
                const maxLap = Math.max(...series.flatMap((s) => s.points.map((p) => p.x)))
                if (replayLap === null || replayLap >= maxLap) setReplayLap(1)
                setPlaying(true)
              }
            }}
            className="rb-sweep rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 px-2.5 py-1 text-[10px] font-mono font-bold text-red-300 transition-colors flex items-center gap-1"
          >
            {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            {playing ? 'PAUSE' : 'REPLAY'}
          </button>
          {replayLap !== null && (
            <button
              onClick={() => { setPlaying(false); setReplayLap(null) }}
              className="rounded-lg bg-background/60 hover:bg-background/80 border border-white/10 px-2.5 py-1 text-[10px] font-mono font-bold transition-colors flex items-center gap-1"
            >
              <FastForward className="h-3 w-3" /> LIVE
            </button>
          )}
        </div>
      </div>

      {/* Replay scrubber */}
      {replayLap !== null && (
        <div className="mb-3 flex items-center gap-3">
          <span className="text-[10px] font-mono text-muted-foreground">L1</span>
          <input
            type="range"
            min={1}
            max={Math.max(...series.flatMap((s) => s.points.map((p) => p.x)))}
            value={replayLap}
            onChange={(e) => setReplayLap(parseInt(e.target.value))}
            className="flex-1 accent-red-500"
          />
          <span className="text-[10px] font-mono text-muted-foreground">L{Math.max(...series.flatMap((s) => s.points.map((p) => p.x)))}</span>
          <span className="rb-chip bg-red-500/20 text-red-300 border border-red-500/30">LAP {replayLap}</span>
        </div>
      )}

      <svg ref={ref} viewBox={`0 0 900 360`} style={{ width: '100%', height: 'auto' }} />

      {/* Final classification */}
      <div className="mt-3 pt-3 border-t border-white/10">
        <p className="text-[10px] font-mono font-bold text-muted-foreground uppercase mb-2">Final Classification</p>
        <div className="flex flex-wrap gap-1.5">
          {finalOrder.map((d, i) => (
            <div
              key={d.driverCode}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-mono border',
                i === 0 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-background/30 border-white/5'
              )}
            >
              <span className={cn(
                'flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold',
                i === 0 ? 'bg-amber-400 text-black' : 'bg-white/10 text-foreground'
              )}>{i + 1}</span>
              <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
              <span className="font-bold">{d.driverCode}</span>
              <span className="text-muted-foreground">{Math.floor(d.totalTime / 60)}'{(d.totalTime % 60).toFixed(1)}"</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
