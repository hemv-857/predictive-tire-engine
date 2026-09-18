'use client'

import { useEffect, useState, useRef } from 'react'
import * as d3 from 'd3'
import { Radio, Zap, Target, Clock, AlertTriangle, CheckCircle2, ChevronRight, Users, Gauge } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLiveTelemetry } from '@/lib/use-live-telemetry'

interface Props {
  raceId: string | null
}

export function LiveRecommender({ raceId }: Props) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const { telemetry: liveTelemetry, connected, raceStatus } = useLiveTelemetry()
  const timelineRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!raceId) return
    let active = true
    const load = () => {
      fetch(`/api/live-recommender?raceId=${raceId}`)
        .then(r => r.json())
        .then(d => { if (active) { setData(d); setLoading(false) } })
        .catch(() => { if (active) setLoading(false) })
    }
    load()
    const interval = setInterval(load, 5000) // refresh every 5s
    return () => { active = false; clearInterval(interval) }
  }, [raceId])

  // Render timeline for a recommendation
  const renderTimeline = (rec: any, svgRef: any) => {
    if (!svgRef?.current || !rec?.timeline) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const width = 500
    const height = 80
    const margin = { top: 8, right: 60, bottom: 20, left: 44 }
    const w = width - margin.left - margin.right
    const h = height - margin.top - margin.bottom

    const timeline = rec.timeline
    const allYs = timeline.map((t: any) => t.actual || t.projected || 0)
    const xMin = timeline[0]?.lap || 1
    const xMax = timeline[timeline.length - 1]?.lap || 50

    const x = d3.scaleLinear().domain([xMin, xMax]).range([0, w])
    const y = d3.scaleLinear().domain([0.6, 1.0]).range([h, 0])

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    // Grid
    g.append('g').attr('class', 'd3-grid').call(d3.axisLeft(y).tickSize(-w).tickFormat(() => '').ticks(4))

    // Thresholds
    const thresholds = [
      { value: 0.95, color: '#a3e635' },
      { value: 0.90, color: '#f59e0b' },
      { value: 0.85, color: '#f97316' },
    ]
    for (const t of thresholds) {
      g.append('line')
        .attr('x1', 0).attr('x2', w)
        .attr('y1', y(t.value)).attr('y2', y(t.value))
        .attr('stroke', t.color).attr('stroke-width', 0.5)
        .attr('stroke-dasharray', '2,2').attr('opacity', 0.4)
    }

    // Actual line
    const actualPoints = timeline.filter((t: any) => t.actual)
    if (actualPoints.length > 0) {
      const line = d3.line<any>().x(d => x(d.lap)).y(d => y(d.actual)).curve(d3.curveMonotoneX)
      g.append('path').datum(actualPoints).attr('fill', 'none')
        .attr('stroke', rec.color).attr('stroke-width', 2).attr('d', line)
    }

    // Projected line (dashed)
    const projectedPoints = timeline.filter((t: any) => t.projected)
    if (projectedPoints.length > 0) {
      const startLap = actualPoints[actualPoints.length - 1]?.lap
      const connPoint = actualPoints[actualPoints.length - 1]
      const allProjected = connPoint ? [{ lap: startLap, projected: connPoint.actual }, ...projectedPoints] : projectedPoints
      const line = d3.line<any>().x(d => x(d.lap)).y(d => y(d.projected)).curve(d3.curveMonotoneX)
      g.append('path').datum(allProjected).attr('fill', 'none')
        .attr('stroke', rec.color).attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '3,3').attr('opacity', 0.6).attr('d', line)
    }

    // Current lap marker
    g.append('line')
      .attr('x1', x(rec.currentLap)).attr('x2', x(rec.currentLap))
      .attr('y1', 0).attr('y2', h)
      .attr('stroke', '#f8fafc').attr('stroke-width', 1).attr('opacity', 0.3)
    g.append('text')
      .attr('x', x(rec.currentLap)).attr('y', -2)
      .attr('text-anchor', 'middle').attr('fill', '#f8fafc')
      .attr('font-size', '8px').attr('font-family', 'monospace')
      .text(`L${rec.currentLap}`)

    // Pit window zone
    const pwLow = x(rec.pitWindow.low)
    const pwHigh = x(rec.pitWindow.high)
    g.append('rect')
      .attr('x', pwLow).attr('y', 0)
      .attr('width', pwHigh - pwLow).attr('height', h)
      .attr('fill', '#f59e0b').attr('opacity', 0.15).attr('rx', 2)
    g.append('text')
      .attr('x', (pwLow + pwHigh) / 2).attr('y', h + 14)
      .attr('text-anchor', 'middle').attr('fill', '#f59e0b')
      .attr('font-size', '7px').attr('font-family', 'monospace').attr('font-weight', '700')
      .text(`PIT L${rec.pitWindow.recommended}`)

    // Axes
    g.append('g').attr('class', 'd3-axis').attr('transform', `translate(0,${h})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat((d) => `L${d}`))
    g.append('g').attr('class', 'd3-axis').call(d3.axisLeft(y).ticks(3).tickFormat((d) => `${(+d).toFixed(2)}`))
  }

  if (loading || !data) {
    return (
      <div className="rounded-xl border border-white/10 bg-card/40 p-8 text-center">
        <Radio className="h-6 w-6 text-muted-foreground animate-pulse mx-auto mb-2" />
        <p className="text-xs font-mono text-muted-foreground">Generating live recommendations…</p>
      </div>
    )
  }

  const raceStateColor = data.summary.raceState === 'CRITICAL' ? '#ef4444' : data.summary.raceState === 'ACTIVE' ? '#f59e0b' : '#22c55e'

  return (
    <div className="space-y-4">
      {/* Race state banner */}
      <div className={cn('rb-card-glass rounded-xl border p-4 rb-bounce-in')} style={{ borderColor: `${raceStateColor}40`, background: `${raceStateColor}10` }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border" style={{ background: `${raceStateColor}20`, borderColor: `${raceStateColor}40` }}>
                <Radio className={cn('h-6 w-6', connected && 'rb-live-dot')} style={{ color: raceStateColor }} />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider" style={{ color: raceStateColor }}>
                  RACE STATE: {data.summary.raceState}
                </span>
                {connected && <span className="rb-chip bg-green-500/15 text-green-300 border border-green-500/30">● LIVE</span>}
              </div>
              <div className="font-mono text-sm font-bold mt-0.5">
                {data.recommendations.length} drivers monitored
                {data.summary.urgentCount > 0 && <span className="text-red-400"> · {data.summary.urgentCount} URGENT</span>}
                {data.summary.prepareCount > 0 && <span className="text-amber-400"> · {data.summary.prepareCount} PREPARING</span>}
              </div>
            </div>
          </div>
          {raceStatus && (
            <div className="text-right">
              <div className="text-[9px] font-mono text-muted-foreground uppercase">LIVE LAP</div>
              <div className="font-mono text-xl font-bold" style={{ color: raceStateColor }}>
                L{raceStatus.lap}/{raceStatus.totalLaps}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Driver recommendation cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {data.recommendations.map((rec: any) => (
          <div key={rec.driverCode} className={cn(
            'rb-card-glass rounded-xl border p-4 rb-stagger',
            rec.urgency === 'critical' && 'rb-border-pulse'
          )} style={{ borderColor: `${rec.color}40` }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg font-mono text-xs font-bold" style={{ background: `${rec.color}20`, color: rec.color }}>
                  {rec.driverCode}
                </span>
                <div>
                  <div className="font-mono text-sm font-bold">{rec.driverName}</div>
                  <div className="text-[9px] font-mono text-muted-foreground">#{rec.carNumber} · {rec.compound} L{rec.tireAge}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[9px] font-mono text-muted-foreground uppercase">PERFORMANCE</div>
                <div className="font-mono text-lg font-bold" style={{ color: rec.color }}>
                  {(rec.currentPerf * 100).toFixed(1)}%
                </div>
              </div>
            </div>

            {/* Action banner */}
            <div className={cn('rounded-lg p-2.5 mb-3 border')} style={{ background: `${rec.color}10`, borderColor: `${rec.color}30` }}>
              <div className="flex items-center gap-2">
                {rec.urgency === 'normal' ? <CheckCircle2 className="h-4 w-4" style={{ color: rec.color }} /> : <AlertTriangle className={cn('h-4 w-4', rec.urgency !== 'normal' && 'rb-live-dot')} style={{ color: rec.color }} />}
                <span className="text-xs font-mono font-bold" style={{ color: rec.color }}>{rec.action}</span>
              </div>
            </div>

            {/* Timeline chart */}
            <div className="mb-3">
              <TimelineChart rec={rec} />
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-4 gap-2 text-[10px] font-mono mb-3">
              <div className="rounded bg-background/40 p-1.5">
                <div className="text-[8px] text-muted-foreground uppercase">TIRE AGE</div>
                <div className="font-bold text-amber-400">L{rec.tireAge}</div>
              </div>
              <div className="rounded bg-background/40 p-1.5">
                <div className="text-[8px] text-muted-foreground uppercase">TEMP</div>
                <div className="font-bold text-red-400">{rec.avgTemp}°</div>
              </div>
              <div className="rounded bg-background/40 p-1.5">
                <div className="text-[8px] text-muted-foreground uppercase">FUEL</div>
                <div className="font-bold text-green-400">{rec.fuelLoad}kg</div>
              </div>
              <div className="rounded bg-background/40 p-1.5">
                <div className="text-[8px] text-muted-foreground uppercase">→ 90%</div>
                <div className="font-bold" style={{ color: rec.color }}>{rec.lapsTo90} laps</div>
              </div>
            </div>

            {/* Pit window */}
            <div className="rounded-lg bg-background/30 p-2.5 border border-white/5 mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] font-mono font-bold text-muted-foreground uppercase flex items-center gap-1">
                  <Target className="h-2.5 w-2.5" /> PIT WINDOW
                </span>
                <span className="text-[9px] font-mono font-bold" style={{ color: rec.color }}>
                  CONFIDENCE: {(rec.confidence * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-muted-foreground">L{rec.pitWindow.low}</span>
                <div className="flex-1 h-6 rounded relative overflow-hidden bg-background/60">
                  <div className="absolute inset-0 flex items-center justify-center gap-0.5">
                    {Array.from({ length: rec.pitWindow.high - rec.pitWindow.low + 1 }).map((_, i) => {
                      const lap = rec.pitWindow.low + i
                      const isRec = lap === rec.pitWindow.recommended
                      return (
                        <div key={i} className="flex-1 h-full flex items-center justify-center text-[8px] font-mono"
                          style={{ background: isRec ? rec.color : `${rec.color}30`, color: isRec ? '#000' : rec.color }}>
                          {lap}
                        </div>
                      )
                    })}
                  </div>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground">L{rec.pitWindow.high}</span>
              </div>
            </div>

            {/* Rivals */}
            {rec.rivals && rec.rivals.length > 0 && (
              <div>
                <span className="text-[9px] font-mono font-bold text-muted-foreground uppercase mb-1 flex items-center gap-1">
                  <Users className="h-2.5 w-2.5" /> NEAREST RIVALS
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {rec.rivals.map((r: any) => (
                    <div key={r.driverCode} className="rb-chip bg-background/40 border border-white/10">
                      {r.driverCode} <span className={r.ahead ? 'text-green-400' : 'text-red-400'}>
                        {r.ahead ? '+' : ''}{Math.abs(r.gap).toFixed(1)}s
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// Inline timeline chart component
function TimelineChart({ rec }: { rec: any }) {
  const ref = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!ref.current || !rec?.timeline) return
    const svg = d3.select(ref.current)
    svg.selectAll('*').remove()

    const width = 500
    const height = 90
    const margin = { top: 10, right: 50, bottom: 24, left: 40 }
    const w = width - margin.left - margin.right
    const h = height - margin.top - margin.bottom

    const timeline = rec.timeline
    const xMin = timeline[0]?.lap || 1
    const xMax = timeline[timeline.length - 1]?.lap || 50

    const x = d3.scaleLinear().domain([xMin, xMax]).range([0, w])
    const y = d3.scaleLinear().domain([0.6, 1.0]).range([h, 0])

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    g.append('g').attr('class', 'd3-grid').call(d3.axisLeft(y).tickSize(-w).tickFormat(() => '').ticks(4))

    // Thresholds
    for (const [val, color] of [[0.95, '#a3e635'], [0.90, '#f59e0b'], [0.85, '#f97316']] as any) {
      g.append('line')
        .attr('x1', 0).attr('x2', w)
        .attr('y1', y(val)).attr('y2', y(val))
        .attr('stroke', color).attr('stroke-width', 0.5)
        .attr('stroke-dasharray', '2,2').attr('opacity', 0.4)
    }

    // Actual line
    const actualPoints = timeline.filter((t: any) => t.actual)
    if (actualPoints.length > 0) {
      const line = d3.line<any>().x(d => x(d.lap)).y(d => y(d.actual)).curve(d3.curveMonotoneX)
      // Area
      const area = d3.area<any>().x(d => x(d.lap)).y0(h).y1(d => y(d.actual)).curve(d3.curveMonotoneX)
      g.append('path').datum(actualPoints).attr('fill', rec.color).attr('opacity', 0.1).attr('d', area)
      g.append('path').datum(actualPoints).attr('fill', 'none')
        .attr('stroke', rec.color).attr('stroke-width', 2).attr('d', line)
    }

    // Projected line
    const projectedPoints = timeline.filter((t: any) => t.projected)
    if (projectedPoints.length > 0) {
      const connPoint = actualPoints[actualPoints.length - 1]
      const allProjected = connPoint ? [{ lap: connPoint.lap, projected: connPoint.actual }, ...projectedPoints] : projectedPoints
      const line = d3.line<any>().x(d => x(d.lap)).y(d => y(d.projected)).curve(d3.curveMonotoneX)
      g.append('path').datum(allProjected).attr('fill', 'none')
        .attr('stroke', rec.color).attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '3,3').attr('opacity', 0.5).attr('d', line)
    }

    // Current lap marker
    g.append('line')
      .attr('x1', x(rec.currentLap)).attr('x2', x(rec.currentLap))
      .attr('y1', 0).attr('y2', h)
      .attr('stroke', '#f8fafc').attr('stroke-width', 1).attr('opacity', 0.4)
    g.append('text')
      .attr('x', x(rec.currentLap)).attr('y', -2)
      .attr('text-anchor', 'middle').attr('fill', '#f8fafc')
      .attr('font-size', '7px').attr('font-family', 'monospace')
      .text(`L${rec.currentLap}`)

    // Pit window zone
    const pwLow = x(Math.max(rec.pitWindow.low, xMin))
    const pwHigh = x(Math.min(rec.pitWindow.high, xMax))
    if (pwHigh > pwLow) {
      g.append('rect')
        .attr('x', pwLow).attr('y', 0)
        .attr('width', pwHigh - pwLow).attr('height', h)
        .attr('fill', '#f59e0b').attr('opacity', 0.12).attr('rx', 2)
      g.append('text')
        .attr('x', (pwLow + pwHigh) / 2).attr('y', h + 14)
        .attr('text-anchor', 'middle').attr('fill', '#f59e0b')
        .attr('font-size', '7px').attr('font-family', 'monospace').attr('font-weight', '700')
        .text(`PIT L${rec.pitWindow.recommended}`)
    }

    g.append('g').attr('class', 'd3-axis').attr('transform', `translate(0,${h})`)
      .call(d3.axisBottom(x).ticks(4).tickFormat((d) => `L${d}`))
    g.append('g').attr('class', 'd3-axis').call(d3.axisLeft(y).ticks(3).tickFormat((d) => `${(+d).toFixed(2)}`))
  }, [rec])

  return <svg ref={ref} viewBox="0 0 500 90" style={{ width: '100%', height: 'auto' }} />
}
