'use client'

import { useEffect, useState, useRef } from 'react'
import * as d3 from 'd3'
import { GanttChartSquare, Clock, Users, Zap, Trophy, Flag } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  raceId: string | null
}

export function GanttView({ raceId }: Props) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [hoveredStint, setHoveredStint] = useState<any>(null)
  const ganttRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!raceId) return
    let active = true
    fetch(`/api/gantt?raceId=${raceId}`)
      .then(r => r.json())
      .then(d => { if (active) { setData(d); setLoading(false) } })
      .catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [raceId])

  // Render Gantt chart
  useEffect(() => {
    if (!ganttRef.current || !data?.drivers) return
    const svg = d3.select(ganttRef.current)
    svg.selectAll('*').remove()

    const drivers = data.drivers
    const totalLaps = data.totalLaps
    const rowHeight = 36
    const barHeight = 24
    const margin = { top: 40, right: 100, bottom: 40, left: 60 }
    const width = Math.max(700, totalLaps * 14) + margin.left + margin.right
    const height = drivers.length * rowHeight + margin.top + margin.bottom

    svg.attr('viewBox', `0 0 ${width} ${height}`)
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    const x = d3.scaleLinear().domain([1, totalLaps]).range([0, width - margin.left - margin.right])
    const y = d3.scaleBand().domain(drivers.map((d: any) => d.driverCode)).range([0, drivers.length * rowHeight]).padding(0.15)

    // Grid (vertical lines every 5 laps)
    for (let lap = 1; lap <= totalLaps; lap += 5) {
      g.append('line')
        .attr('x1', x(lap)).attr('x2', x(lap))
        .attr('y1', 0).attr('y2', drivers.length * rowHeight)
        .attr('stroke', 'oklch(1 0 0 / 0.05)')
        .attr('stroke-width', 1)
    }

    // Driver rows
    drivers.forEach((d: any) => {
      const yPos = y(d.driverCode)!
      // Row background
      g.append('rect')
        .attr('x', 0).attr('y', yPos - 4)
        .attr('width', width - margin.left - margin.right)
        .attr('height', rowHeight - 4)
        .attr('fill', d.isRB ? 'oklch(0.62 0.22 25 / 0.04)' : 'oklch(1 0 0 / 0.015)')
        .attr('rx', 3)

      // Stints
      d.stints.forEach((s: any) => {
        const startX = x(s.startLap)
        const endX = x(s.endLap + 1)
        const barW = endX - startX

        // Stint bar
        g.append('rect')
          .attr('x', startX)
          .attr('y', yPos)
          .attr('width', barW)
          .attr('height', barHeight)
          .attr('fill', s.compoundColor)
          .attr('opacity', 0.85)
          .attr('rx', 3)
          .style('cursor', 'pointer')
          .on('mouseenter', () => setHoveredStint({ ...s, driverCode: d.driverCode }))
          .on('mouseleave', () => setHoveredStint(null))

        // Compound label inside bar
        if (barW > 30) {
          g.append('text')
            .attr('x', startX + barW / 2)
            .attr('y', yPos + barHeight / 2)
            .attr('text-anchor', 'middle')
            .attr('dy', '0.32em')
            .attr('fill', s.compound === 'Hard' ? '#0a0a0f' : '#f8fafc')
            .attr('font-size', '9px')
            .attr('font-family', 'var(--font-geist-mono), monospace')
            .attr('font-weight', '700')
            .text(`${s.compound[0]}${s.duration}`)
        }

        // Performance indicator (small bar below)
        const perfWidth = barW * s.avgPerf
        g.append('rect')
          .attr('x', startX)
          .attr('y', yPos + barHeight + 2)
          .attr('width', perfWidth)
          .attr('height', 2)
          .attr('fill', s.avgPerf > 0.9 ? '#22c55e' : s.avgPerf > 0.85 ? '#f59e0b' : '#ef4444')
          .attr('opacity', 0.6)
          .attr('rx', 1)
      })
    })

    // Pit stop markers (vertical lines between stints)
    data.pitEvents.forEach((p: any) => {
      const yPos = y(p.driverCode)!
      g.append('line')
        .attr('x1', x(p.lap + 1)).attr('x2', x(p.lap + 1))
        .attr('y1', yPos - 2).attr('y2', yPos + barHeight + 4)
        .attr('stroke', '#fbbf24')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '2,2')
        .attr('opacity', 0.6)
    })

    // X axis (laps)
    g.append('g')
      .attr('class', 'd3-axis')
      .attr('transform', `translate(0,${drivers.length * rowHeight})`)
      .call(d3.axisBottom(x).ticks(Math.min(20, totalLaps)).tickFormat((d) => `L${d}`))

    // Y axis (drivers)
    g.append('g')
      .attr('class', 'd3-axis')
      .call(d3.axisLeft(y).tickSize(0).tickFormat((d: any) => {
        const driver = drivers.find((dr: any) => dr.driverCode === d)
        return driver?.isRB ? `${d} ●` : d
      }))

    // Axis labels
    g.append('text')
      .attr('x', (width - margin.left - margin.right) / 2)
      .attr('y', drivers.length * rowHeight + 32)
      .attr('text-anchor', 'middle')
      .attr('fill', 'oklch(0.75 0.012 264)')
      .attr('font-size', '10px')
      .attr('font-family', 'var(--font-geist-mono), monospace')
      .text('Lap')
  }, [data])

  if (loading || !data) {
    return (
      <div className="rounded-xl border border-white/10 bg-card/40 p-8 text-center">
        <GanttChartSquare className="h-6 w-6 text-muted-foreground animate-pulse mx-auto mb-2" />
        <p className="text-xs font-mono text-muted-foreground">Building strategy timeline…</p>
      </div>
    )
  }

  const s = data.summary

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-white/10 bg-card/40 rb-card-glass">
        <div className="flex items-center gap-2">
          <GanttChartSquare className="h-4 w-4 text-red-400" />
          <span className="text-xs font-mono font-bold">RACE STRATEGY TIMELINE</span>
        </div>
        <div className="flex-1" />
        <span className="rb-chip bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
          <Flag className="h-2.5 w-2.5" /> {data.race.name.replace(' Grand Prix', ' GP')}
        </span>
        <span className="rb-chip bg-amber-500/15 text-amber-300 border border-amber-500/30">
          {data.totalLaps} laps
        </span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rb-card-glass rounded-xl border border-white/10 p-3 rb-lift rb-stagger rb-delay-1">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground uppercase mb-1">
            <Users className="h-3 w-3 text-cyan-400" />DRIVERS
          </div>
          <div className="font-mono text-xl font-bold text-cyan-400">{data.totalDrivers}</div>
        </div>
        <div className="rb-card-glass rounded-xl border border-white/10 p-3 rb-lift rb-stagger rb-delay-2">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground uppercase mb-1">
            <Zap className="h-3 w-3 text-amber-400" />TOTAL STOPS
          </div>
          <div className="font-mono text-xl font-bold text-amber-400">{s.totalPitStops}</div>
          <div className="text-[9px] font-mono text-muted-foreground">{s.avgStintsPerDriver} avg/driver</div>
        </div>
        <div className="rb-card-glass rounded-xl border border-white/10 p-3 rb-lift rb-stagger rb-delay-3">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground uppercase mb-1">
            <Trophy className="h-3 w-3 text-green-400" />FASTEST
          </div>
          <div className="font-mono text-xl font-bold text-green-400">{s.fastestDriver}</div>
          <div className="text-[9px] font-mono text-muted-foreground">{Math.floor(s.fastestTime / 60)}'{(s.fastestTime % 60).toFixed(1)}"</div>
        </div>
        <div className="rb-card-glass rounded-xl border border-white/10 p-3 rb-lift rb-stagger rb-delay-4">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground uppercase mb-1">
            <Clock className="h-3 w-3 text-red-400" />MOST STOPS
          </div>
          <div className="font-mono text-xl font-bold text-red-400">{s.mostStops?.driverCode}</div>
          <div className="text-[9px] font-mono text-muted-foreground">{s.mostStops?.stintCount} stints</div>
        </div>
      </div>

      {/* Gantt chart */}
      <div className="rounded-xl border border-white/10 bg-card/40 p-4 overflow-x-auto rb-scroll">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold font-mono flex items-center gap-2">
            <GanttChartSquare className="h-4 w-4 text-amber-400" />
            STRATEGY GANTT · ALL DRIVERS
          </h3>
          {hoveredStint && (
            <div className="rb-chip bg-amber-500/15 text-amber-300 border border-amber-500/30 rb-bounce-in">
              {hoveredStint.driverCode} · Stint {hoveredStint.stintNumber} · {hoveredStint.compound} · L{hoveredStint.startLap}-L{hoveredStint.endLap} · {(hoveredStint.avgPerf * 100).toFixed(1)}%
            </div>
          )}
        </div>
        <svg ref={ganttRef} style={{ width: '100%', height: 'auto', minWidth: '700px' }} />
        {/* Legend */}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[9px] font-mono">
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded" style={{ background: '#ef4444' }} />Soft</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded" style={{ background: '#f59e0b' }} />Medium</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded" style={{ background: '#e2e8f0' }} />Hard</span>
          <span className="flex items-center gap-1.5"><span className="h-1 w-4 rounded bg-amber-400" style={{ borderLeft: '2px dashed #fbbf24' }} />Pit stop</span>
          <span className="flex items-center gap-1.5"><span className="text-amber-400">●</span>Apex Racing</span>
        </div>
      </div>

      {/* Driver strategy detail */}
      <div className="rounded-xl border border-white/10 bg-card/40 p-4">
        <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-cyan-400" />
          STRATEGY BREAKDOWN BY DRIVER
        </h3>
        <div className="overflow-x-auto rb-scroll">
          <table className="w-full text-[10px] font-mono">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-white/10">
                <th className="pb-2 pr-3">POS</th>
                <th className="pb-2 pr-3">DRIVER</th>
                <th className="pb-2 pr-3">STOPS</th>
                <th className="pb-2 pr-3">STRATEGY</th>
                <th className="pb-2 pr-3">TOTAL TIME</th>
                <th className="pb-2 pr-3">AVG PERF</th>
                <th className="pb-2 pr-3">BEST LAP</th>
                <th className="pb-2">STINT DETAILS</th>
              </tr>
            </thead>
            <tbody>
              {data.drivers.map((d: any, i: number) => (
                <tr key={d.driverCode} className={cn(
                  'border-b border-white/5 hover:bg-white/[0.03] transition-colors',
                  d.isRB && 'bg-red-500/[0.04]'
                )}>
                  <td className="py-1.5 pr-3">
                    <span className={cn(
                      'inline-flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold',
                      i === 0 ? 'bg-amber-400 text-black' : i === 1 ? 'bg-slate-300 text-black' : i === 2 ? 'bg-amber-700 text-white' : 'bg-white/10'
                    )}>{i + 1}</span>
                  </td>
                  <td className="py-1.5 pr-3 font-bold">
                    <span className="flex items-center gap-1.5">
                      {d.isRB && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
                      {d.driverCode}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 text-amber-400 font-bold">{d.stintCount}</td>
                  <td className="py-1.5 pr-3 text-cyan-400">{d.stints.map((s: any) => s.compound[0]).join('→')}</td>
                  <td className="py-1.5 pr-3 font-bold text-cyan-400">{Math.floor(d.totalTime / 60)}'{(d.totalTime % 60).toFixed(1)}"</td>
                  <td className="py-1.5 pr-3 text-green-400">{(d.avgPerf * 100).toFixed(1)}%</td>
                  <td className="py-1.5 pr-3 text-green-400 font-bold">{d.bestLap}</td>
                  <td className="py-1.5">
                    <div className="flex flex-wrap gap-1">
                      {d.stints.map((s: any) => (
                        <span key={s.stintNumber} className="rb-chip border" style={{ background: `${s.compoundColor}20`, color: s.compoundColor, borderColor: `${s.compoundColor}40` }}>
                          {s.compound[0]}·{s.duration}L
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
