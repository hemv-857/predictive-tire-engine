'use client'

import { useEffect, useState, useRef } from 'react'
import * as d3 from 'd3'
import { Grid3x3, Clock, Gauge, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  raceId: string | null
  drivers: any[]
}

export function DeltaMatrix({ raceId, drivers }: Props) {
  const [refDriver, setRefDriver] = useState('TSU')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [hovered, setHovered] = useState<{ driver: string; lap: number; delta: number } | null>(null)
  const heatmapRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!raceId) return
    let active = true
    fetch(`/api/delta-matrix?raceId=${raceId}&driverCode=${refDriver}`)
      .then(r => r.json())
      .then(d => { if (active) { setData(d); setLoading(false) } })
      .catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [raceId, refDriver])

  const validDriver = drivers.some((d) => d.code === refDriver) ? refDriver : (drivers[0]?.code || '')

  // Render heatmap
  useEffect(() => {
    if (!heatmapRef.current || !data?.matrix) return
    const svg = d3.select(heatmapRef.current)
    svg.selectAll('*').remove()

    const cellW = 20
    const cellH = 32
    const margin = { top: 24, right: 60, bottom: 36, left: 50 }
    const width = data.allLaps.length * cellW + margin.left + margin.right
    const height = data.matrix.length * cellH + margin.top + margin.bottom

    svg.attr('viewBox', `0 0 ${width} ${height}`)
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    // Color scale: green (faster) → white (equal) → red (slower)
    const maxDelta = Math.max(...data.matrix.flatMap((r: any) => r.deltas.filter((d: any) => d !== null).map((d: any) => Math.abs(d))))
    const color = d3.scaleLinear<string>()
      .domain([-maxDelta, 0, maxDelta])
      .range(['#22c55e', '#1a1a2e', '#ef4444'])

    // Cells
    for (let di = 0; di < data.matrix.length; di++) {
      const row = data.matrix[di]
      for (let li = 0; li < row.deltas.length; li++) {
        const delta = row.deltas[li]
        const x = li * cellW
        const y = di * cellH
        if (delta !== null) {
          g.append('rect')
            .attr('x', x).attr('y', y)
            .attr('width', cellW - 1).attr('height', cellH - 1)
            .attr('fill', color(delta))
            .attr('opacity', 0.85)
            .attr('rx', 1.5)
            .style('cursor', 'pointer')
            .on('mouseenter', () => setHovered({ driver: row.driver, lap: data.allLaps[li], delta }))
            .on('mouseleave', () => setHovered(null))
          if (Math.abs(delta) > maxDelta * 0.4) {
            g.append('text')
              .attr('x', x + cellW / 2).attr('y', y + cellH / 2)
              .attr('text-anchor', 'middle').attr('dy', '0.32em')
              .attr('fill', delta > 0 ? '#fca5a5' : '#86efac')
              .attr('font-size', '7px')
              .attr('font-family', 'var(--font-geist-mono), monospace')
              .attr('font-weight', '700')
              .text(delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1))
          }
        } else {
          g.append('rect')
            .attr('x', x).attr('y', y)
            .attr('width', cellW - 1).attr('height', cellH - 1)
            .attr('fill', '#1a1a2e')
            .attr('opacity', 0.3)
            .attr('rx', 1.5)
        }
      }
    }

    // Driver labels (Y)
    for (let di = 0; di < data.matrix.length; di++) {
      g.append('text')
        .attr('x', -8).attr('y', di * cellH + cellH / 2)
        .attr('text-anchor', 'end').attr('dy', '0.32em')
        .attr('fill', data.matrix[di].driver === refDriver ? '#f59e0b' : 'oklch(0.85 0.01 264)')
        .attr('font-size', '10px')
        .attr('font-family', 'var(--font-geist-mono), monospace')
        .attr('font-weight', '700')
        .text(data.matrix[di].driver + (data.matrix[di].driver === refDriver ? ' ◆' : ''))
    }

    // Lap labels (X)
    for (let li = 0; li < data.allLaps.length; li += 5) {
      g.append('text')
        .attr('x', li * cellW + cellW / 2).attr('y', data.matrix.length * cellH + 14)
        .attr('text-anchor', 'middle')
        .attr('fill', 'oklch(0.75 0.012 264)')
        .attr('font-size', '8px')
        .attr('font-family', 'var(--font-geist-mono), monospace')
        .text(`L${data.allLaps[li]}`)
    }
  }, [data, refDriver])

  if (loading || !data) {
    return (
      <div className="rounded-xl border border-white/10 bg-card/40 p-8 text-center">
        <Grid3x3 className="h-6 w-6 text-muted-foreground animate-pulse mx-auto mb-2" />
        <p className="text-xs font-mono text-muted-foreground">Building delta matrix…</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-white/10 bg-card/40 rb-card-glass">
        <div className="flex items-center gap-2">
          <Grid3x3 className="h-4 w-4 text-red-400" />
          <span className="text-xs font-mono font-bold">LAP TIME DELTA MATRIX</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-muted-foreground">REF DRIVER:</span>
          <select
            value={validDriver}
            onChange={(e) => setRefDriver(e.target.value)}
            className="bg-background/60 border border-white/10 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-red-500/50"
          >
            {drivers.map((d) => <option key={d.code} value={d.code}>{d.code} · {d.name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1.5 text-[9px] font-mono">
          <span className="text-green-400">FASTER</span>
          <span className="h-3 w-16 rounded" style={{ background: 'linear-gradient(90deg, #22c55e, #1a1a2e, #ef4444)' }} />
          <span className="text-red-400">SLOWER</span>
        </div>
      </div>

      {/* Driver summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        {data.driverSummary.slice(0, 5).map((d: any, i: number) => (
          <div key={d.driver} className={cn(
            'rb-card-glass rounded-lg p-2.5 rb-lift',
            d.isRB && 'border-red-500/40'
          )}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono font-bold">{d.driver}</span>
              <span className={cn(
                'flex h-4 w-4 items-center justify-center rounded text-[8px] font-bold',
                i === 0 ? 'bg-amber-400 text-black' : 'bg-white/10'
              )}>{i + 1}</span>
            </div>
            <div className="space-y-0.5 text-[9px] font-mono">
              <div className="flex justify-between"><span className="text-muted-foreground">Δ CUM</span><span className={cn('font-bold', d.cumDelta < 0 ? 'text-green-400' : 'text-red-400')}>{d.cumDelta >= 0 ? '+' : ''}{d.cumDelta.toFixed(1)}s</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">AVG</span><span className="font-bold text-cyan-400">{d.avgLap.toFixed(3)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">BEST</span><span className="font-bold text-green-400">{d.bestLap.toFixed(3)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">σ</span><span className="font-bold text-amber-400">{d.consistency.toFixed(3)}</span></div>
            </div>
          </div>
        ))}
      </div>

      {/* Heatmap */}
      <div className="rounded-xl border border-white/10 bg-card/40 p-4 overflow-x-auto rb-scroll">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold font-mono flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-400" />
            DELTA HEATMAP · vs {data.refDriver} ◆
          </h3>
          {hovered && (
            <div className="rb-chip bg-amber-500/15 text-amber-300 border border-amber-500/30 rb-bounce-in">
              {hovered.driver} · L{hovered.lap} · {hovered.delta >= 0 ? '+' : ''}{hovered.delta.toFixed(3)}s
            </div>
          )}
        </div>
        <svg ref={heatmapRef} style={{ width: '100%', height: 'auto', minWidth: '600px' }} />
      </div>

      {/* Consistency ranking */}
      <div className="rounded-xl border border-white/10 bg-card/40 p-4">
        <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
          <Gauge className="h-4 w-4 text-green-400" />
          CONSISTENCY RANKING (LOWER = MORE CONSISTENT)
        </h3>
        <div className="space-y-1.5">
          {data.driverSummary.sort((a: any, b: any) => a.consistency - b.consistency).map((d: any, i: number) => {
            const maxCons = Math.max(...data.driverSummary.map((x: any) => x.consistency))
            const pct = (d.consistency / maxCons) * 100
            return (
              <div key={d.driver} className="flex items-center gap-3">
                <span className="w-5 text-[9px] font-mono text-muted-foreground">{i + 1}</span>
                <span className="w-10 text-[10px] font-mono font-bold">{d.driver}</span>
                <div className="flex-1 h-4 rounded bg-background/60 overflow-hidden">
                  <div
                    className="h-full rounded-full rb-fill transition-all"
                    style={{ width: `${pct}%`, background: i === 0 ? '#22c55e' : i < 3 ? '#a3e635' : '#f59e0b' }}
                  />
                </div>
                <span className="w-12 text-[10px] font-mono font-bold text-right">σ {d.consistency.toFixed(3)}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
