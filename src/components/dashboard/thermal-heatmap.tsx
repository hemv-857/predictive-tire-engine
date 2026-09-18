'use client'

import { useEffect, useState, useRef } from 'react'
import * as d3 from 'd3'
import { Thermometer, Grid3x3, Flame, Snowflake, Gauge } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  raceId: string | null
  drivers: any[]
}

export function ThermalHeatmap({ raceId, drivers }: Props) {
  const [selectedDriver, setSelectedDriver] = useState('TSU')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [hoveredCell, setHoveredCell] = useState<{ lap: number; corner: string; temp: number } | null>(null)
  const heatmapRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!raceId) return
    let active = true
    fetch(`/api/thermal-profile?raceId=${raceId}&driverCode=${selectedDriver}`)
      .then(r => r.json())
      .then(d => { if (active) { setData(d); setLoading(false) } })
      .catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [raceId, selectedDriver])

  const validDriver = drivers.some((d) => d.code === selectedDriver) ? selectedDriver : (drivers[0]?.code || '')

  // Render heatmap
  useEffect(() => {
    if (!heatmapRef.current || !data?.lapData) return
    const svg = d3.select(heatmapRef.current)
    svg.selectAll('*').remove()

    const lapData = data.lapData
    const corners = ['FL', 'FR', 'RL', 'RR']
    const cellW = 44
    const cellH = 34
    const margin = { top: 28, right: 20, bottom: 36, left: 44 }
    const width = lapData.length * cellW + margin.left + margin.right
    const height = corners.length * cellH + margin.top + margin.bottom

    svg.attr('viewBox', `0 0 ${width} ${height}`)

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    // Color scale: blue (cold) → green (optimal) → amber → red (hot)
    const tempMin = 70, tempMax = 130
    const color = d3.scaleLinear<string>()
      .domain([tempMin, 85, 92, 97, 105, 115, tempMax])
      .range(['#3b82f6', '#06b6d4', '#22c55e', '#84cc16', '#f59e0b', '#f97316', '#ef4444'])
      .clamp(true)

    // Draw cells
    for (let li = 0; li < lapData.length; li++) {
      const lap = lapData[li]
      for (let ci = 0; ci < corners.length; ci++) {
        const corner = corners[ci]
        const temp = lap.corners[corner]
        g.append('rect')
          .attr('x', li * cellW)
          .attr('y', ci * cellH)
          .attr('width', cellW - 1)
          .attr('height', cellH - 1)
          .attr('fill', color(temp))
          .attr('rx', 2)
          .attr('opacity', 0.9)
          .style('cursor', 'pointer')
          .on('mouseenter', () => setHoveredCell({ lap: lap.lap, corner, temp }))
          .on('mouseleave', () => setHoveredCell(null))
        // Temp value text
        g.append('text')
          .attr('x', li * cellW + cellW / 2)
          .attr('y', ci * cellH + cellH / 2)
          .attr('text-anchor', 'middle')
          .attr('dy', '0.32em')
          .attr('fill', temp > 110 || temp < 80 ? '#f8fafc' : '#0a0a0f')
          .attr('font-size', '9px')
          .attr('font-family', 'var(--font-geist-mono), monospace')
          .attr('font-weight', '600')
          .text(`${temp.toFixed(0)}`)
      }
    }

    // Corner labels (Y axis)
    for (let ci = 0; ci < corners.length; ci++) {
      g.append('text')
        .attr('x', -8)
        .attr('y', ci * cellH + cellH / 2)
        .attr('text-anchor', 'end')
        .attr('dy', '0.32em')
        .attr('fill', 'oklch(0.75 0.012 264)')
        .attr('font-size', '11px')
        .attr('font-family', 'var(--font-geist-mono), monospace')
        .attr('font-weight', '700')
        .text(corners[ci])
    }

    // Lap labels (X axis) — every 5 laps
    for (let li = 0; li < lapData.length; li += 5) {
      g.append('text')
        .attr('x', li * cellW + cellW / 2)
        .attr('y', corners.length * cellH + 14)
        .attr('text-anchor', 'middle')
        .attr('fill', 'oklch(0.75 0.012 264)')
        .attr('font-size', '9px')
        .attr('font-family', 'var(--font-geist-mono), monospace')
        .text(`L${li + 1}`)
    }

    // Title
    g.append('text')
      .attr('x', lapData.length * cellW / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .attr('fill', 'oklch(0.75 0.012 264)')
      .attr('font-size', '11px')
      .attr('font-family', 'var(--font-geist-mono), monospace')
      .text(`Tire Temperature Matrix · ${selectedDriver} · ${lapData.length} laps`)
  }, [data, selectedDriver])

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-white/10 bg-card/40">
        <div className="flex items-center gap-2">
          <Thermometer className="h-4 w-4 text-amber-400" />
          <span className="text-xs font-mono font-bold">THERMAL HEATMAP</span>
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
        {/* Legend */}
        <div className="flex items-center gap-1.5 text-[9px] font-mono">
          <Snowflake className="h-3 w-3 text-blue-400" />
          <span className="h-3 w-12 rounded" style={{ background: 'linear-gradient(90deg, #3b82f6, #06b6d4, #22c55e, #84cc16, #f59e0b, #f97316, #ef4444)' }} />
          <Flame className="h-3 w-3 text-red-400" />
          <span className="text-muted-foreground">70°-130°C</span>
        </div>
      </div>

      {loading && (
        <div className="rounded-xl border border-white/10 bg-card/40 p-8 text-center">
          <Thermometer className="h-6 w-6 text-muted-foreground animate-pulse mx-auto mb-2" />
          <p className="text-xs font-mono text-muted-foreground">Building thermal matrix…</p>
        </div>
      )}

      {data && !loading && (
        <>
          {/* Corner stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {data.cornerStats.map((c: any) => {
              const status = c.overheatingPct > 30 ? 'critical' : c.tooColdPct > 30 ? 'cold' : c.optimalPct > 60 ? 'optimal' : 'warning'
              const statusColor = status === 'critical' ? '#ef4444' : status === 'cold' ? '#3b82f6' : status === 'optimal' ? '#22c55e' : '#f59e0b'
              return (
                <div key={c.corner} className="rounded-lg border border-white/10 bg-card/40 p-3 rb-lift">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-sm font-bold">{c.corner}</span>
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: statusColor }} />
                  </div>
                  <div className="space-y-1 text-[10px] font-mono">
                    <div className="flex justify-between"><span className="text-muted-foreground">Avg</span><span className="font-bold">{c.avg}°C</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Range</span><span className="font-bold">{c.range}°C</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Min/Max</span><span className="font-bold">{c.min}/{c.max}°</span></div>
                    <div className="mt-1.5 pt-1.5 border-t border-white/10">
                      <div className="flex justify-between"><span className="text-green-400">● Optimal</span><span className="font-bold">{c.optimalPct}%</span></div>
                      <div className="flex justify-between"><span className="text-amber-400">● Over</span><span className="font-bold">{c.overheatingPct}%</span></div>
                      <div className="flex justify-between"><span className="text-blue-400">● Cold</span><span className="font-bold">{c.tooColdPct}%</span></div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Heatmap */}
          <div className="rounded-xl border border-white/10 bg-card/40 p-4 overflow-x-auto rb-scroll">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold font-mono flex items-center gap-2">
                <Grid3x3 className="h-4 w-4 text-cyan-400" />
                4-CORNER TEMPERATURE MATRIX
              </h3>
              {hoveredCell && (
                <div className="rb-chip bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  Lap {hoveredCell.lap} · {hoveredCell.corner} · {hoveredCell.temp.toFixed(1)}°C
                </div>
              )}
            </div>
            <svg ref={heatmapRef} style={{ width: '100%', height: 'auto', minWidth: '600px' }} />
          </div>

          {/* Temperature distribution histogram */}
          <div className="rounded-xl border border-white/10 bg-card/40 p-4">
            <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
              <Gauge className="h-4 w-4 text-green-400" />
              TEMPERATURE DISTRIBUTION
            </h3>
            <div className="flex items-end gap-1 h-32 border-b border-white/10">
              {data.tempHistogram.map((b: any, i: number) => {
                const max = Math.max(...data.tempHistogram.map((x: any) => x.count))
                const h = max > 0 ? (b.count / max) * 100 : 0
                const isOptimal = b.temp >= 92 && b.temp <= 105
                return (
                  <div key={i} className="flex-1 h-full flex flex-col justify-end items-center gap-0.5 group relative">
                    <div className="text-[8px] font-mono text-foreground opacity-0 group-hover:opacity-100 transition-opacity absolute -top-4">{b.count}</div>
                    <div
                      className={cn('w-full rounded-t transition-all hover:opacity-80 group-hover:opacity-100', isOptimal ? 'bg-green-500' : b.temp > 105 ? 'bg-red-500' : b.temp > 100 ? 'bg-amber-500' : 'bg-blue-500')}
                      style={{ height: `${h}%`, minHeight: b.count > 0 ? '3px' : '0' }}
                    />
                  </div>
                )
              })}
            </div>
            <div className="mt-2 flex items-center justify-between text-[9px] font-mono text-muted-foreground">
              {data.tempHistogram.map((b: any, i: number) => (
                <span key={i} className="text-[7px]">{b.temp}°</span>
              ))}
            </div>
            <div className="mt-1 flex items-center justify-between text-[9px] font-mono text-muted-foreground">
              <span><span className="text-blue-400">●</span> Cold (&lt;85°)</span>
              <span><span className="text-green-400">●</span> Optimal (92-105°)</span>
              <span><span className="text-red-400">●</span> Overheating (&gt;110°)</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
