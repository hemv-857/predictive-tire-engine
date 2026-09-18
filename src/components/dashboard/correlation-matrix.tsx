'use client'

import { useEffect, useState, useRef } from 'react'
import * as d3 from 'd3'
import { GitCompare, TrendingUp, TrendingDown, Activity, Grid3x3 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  raceId: string | null
  drivers: any[]
}

export function CorrelationMatrix({ raceId, drivers }: Props) {
  const [selectedDriver, setSelectedDriver] = useState('TSU')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [hovered, setHovered] = useState<{ i: number; j: number; value: number; label1: string; label2: string } | null>(null)
  const matrixRef = useRef<SVGSVGElement>(null)

  const validDriver = drivers.some((d) => d.code === selectedDriver) ? selectedDriver : (drivers[0]?.code || '')

  useEffect(() => {
    if (!raceId) return
    let active = true
    fetch(`/api/correlation?raceId=${raceId}&driverCode=${validDriver}`)
      .then(r => r.json())
      .then(d => { if (active) { setData(d); setLoading(false) } })
      .catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [raceId, validDriver])

  // Render heatmap
  useEffect(() => {
    if (!matrixRef.current || !data?.matrix) return
    const svg = d3.select(matrixRef.current)
    svg.selectAll('*').remove()

    const channels = data.channels
    const cellSize = 32
    const margin = { top: 20, right: 20, bottom: 80, left: 80 }
    const size = channels.length * cellSize
    const width = size + margin.left + margin.right
    const height = size + margin.top + margin.bottom

    svg.attr('viewBox', `0 0 ${width} ${height}`)
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    // Color scale: -1 (red) → 0 (dark) → +1 (green)
    const color = d3.scaleLinear<string>()
      .domain([-1, -0.5, 0, 0.5, 1])
      .range(['#ef4444', '#f97316', '#1a1a2e', '#22c55e', '#22c55e'])

    // Cells
    for (let i = 0; i < channels.length; i++) {
      for (let j = 0; j < channels.length; j++) {
        const val = data.matrix[i][j]
        g.append('rect')
          .attr('x', j * cellSize)
          .attr('y', i * cellSize)
          .attr('width', cellSize - 1)
          .attr('height', cellSize - 1)
          .attr('fill', color(val))
          .attr('opacity', i === j ? 0.3 : 0.85)
          .attr('rx', 2)
          .style('cursor', 'pointer')
          .on('mouseenter', () => setHovered({ i, j, value: val, label1: channels[i].label, label2: channels[j].label }))
          .on('mouseleave', () => setHovered(null))

        // Value text for strong correlations
        if (Math.abs(val) > 0.5 && i !== j) {
          g.append('text')
            .attr('x', j * cellSize + cellSize / 2)
            .attr('y', i * cellSize + cellSize / 2)
            .attr('text-anchor', 'middle')
            .attr('dy', '0.32em')
            .attr('fill', val > 0 ? '#22c55e' : '#ef4444')
            .attr('font-size', '8px')
            .attr('font-family', 'var(--font-geist-mono), monospace')
            .attr('font-weight', '700')
            .text(val.toFixed(2))
        }
      }
    }

    // Row labels (Y axis)
    for (let i = 0; i < channels.length; i++) {
      g.append('text')
        .attr('x', -6)
        .attr('y', i * cellSize + cellSize / 2)
        .attr('text-anchor', 'end')
        .attr('dy', '0.32em')
        .attr('fill', 'oklch(0.85 0.01 264)')
        .attr('font-size', '9px')
        .attr('font-family', 'var(--font-geist-mono), monospace')
        .attr('font-weight', '600')
        .text(channels[i].label)
    }

    // Column labels (X axis, rotated)
    for (let j = 0; j < channels.length; j++) {
      g.append('text')
        .attr('transform', `translate(${j * cellSize + cellSize / 2}, ${size + 6}) rotate(-45)`)
        .attr('text-anchor', 'end')
        .attr('fill', 'oklch(0.85 0.01 264)')
        .attr('font-size', '9px')
        .attr('font-family', 'var(--font-geist-mono), monospace')
        .attr('font-weight', '600')
        .text(channels[j].label)
    }
  }, [data])

  if (loading || !data) {
    return (
      <div className="rounded-xl border border-white/10 bg-card/40 p-8 text-center">
        <Grid3x3 className="h-6 w-6 text-muted-foreground animate-pulse mx-auto mb-2" />
        <p className="text-xs font-mono text-muted-foreground">Computing correlation matrix…</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-white/10 bg-card/40 rb-card-glass">
        <div className="flex items-center gap-2">
          <GitCompare className="h-4 w-4 text-red-400" />
          <span className="text-xs font-mono font-bold">CHANNEL CORRELATION MATRIX</span>
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
        <div className="flex items-center gap-1.5 text-[9px] font-mono">
          <span className="text-red-400">−1</span>
          <span className="h-3 w-24 rounded" style={{ background: 'linear-gradient(90deg, #ef4444, #f97316, #1a1a2e, #22c55e)' }} />
          <span className="text-green-400">+1</span>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rb-card-glass rounded-xl border border-white/10 p-3 rb-lift rb-stagger rb-delay-1">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground uppercase mb-1">
            <Grid3x3 className="h-3 w-3 text-cyan-400" />CHANNELS
          </div>
          <div className="font-mono text-xl font-bold text-cyan-400">{data.summary.totalChannels}</div>
          <div className="text-[9px] font-mono text-muted-foreground">{data.summary.totalPairs} pairs</div>
        </div>
        <div className="rb-card-glass rounded-xl border border-green-500/30 bg-green-500/[0.06] p-3 rb-lift rb-stagger rb-delay-2">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground uppercase mb-1">
            <TrendingUp className="h-3 w-3 text-green-400" />STRONG POSITIVE
          </div>
          <div className="font-mono text-xl font-bold text-green-400">{data.summary.strongPositiveCount}</div>
          <div className="text-[9px] font-mono text-muted-foreground">correlations &gt;0.7</div>
        </div>
        <div className="rb-card-glass rounded-xl border border-red-500/30 bg-red-500/[0.06] p-3 rb-lift rb-stagger rb-delay-3">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground uppercase mb-1">
            <TrendingDown className="h-3 w-3 text-red-400" />STRONG NEGATIVE
          </div>
          <div className="font-mono text-xl font-bold text-red-400">{data.summary.strongNegativeCount}</div>
          <div className="text-[9px] font-mono text-muted-foreground">correlations &lt;-0.7</div>
        </div>
        <div className="rb-card-glass rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3 rb-lift rb-stagger rb-delay-4">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground uppercase mb-1">
            <Activity className="h-3 w-3 text-amber-400" />TOP CORRELATION
          </div>
          <div className="font-mono text-xs font-bold text-amber-400">{data.summary.topCorrelation?.label1} ↔ {data.summary.topCorrelation?.label2}</div>
          <div className="text-[9px] font-mono text-muted-foreground">r = {data.summary.topCorrelation?.correlation}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* Correlation heatmap */}
        <div className="rounded-xl border border-white/10 bg-card/40 p-4 overflow-x-auto rb-scroll">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold font-mono flex items-center gap-2">
              <Grid3x3 className="h-4 w-4 text-amber-400" />
              {data.summary.totalChannels}×{data.summary.totalChannels} CORRELATION HEATMAP
            </h3>
            {hovered && (
              <div className="rb-chip bg-amber-500/15 text-amber-300 border border-amber-500/30 rb-bounce-in">
                {hovered.label1} ↔ {hovered.label2}: r = {hovered.value.toFixed(3)}
              </div>
            )}
          </div>
          <svg ref={matrixRef} style={{ width: '100%', height: 'auto', minWidth: '500px' }} />
        </div>

        {/* Top correlations list */}
        <div className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-card/40 p-4">
            <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-400" />
              TOP CORRELATIONS
            </h3>
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto rb-scroll">
              {data.correlations.slice(0, 15).map((c: any, i: number) => (
                <div key={i} className="rounded-lg bg-background/30 p-2 border border-white/5 rb-lift">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono font-bold">{c.label1} ↔ {c.label2}</span>
                    <span className={cn('font-mono text-xs font-bold', c.correlation > 0 ? 'text-green-400' : 'text-red-400')}>
                      {c.correlation > 0 ? '+' : ''}{c.correlation.toFixed(3)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-background/60 overflow-hidden relative">
                    <div
                      className={cn('h-full rounded-full rb-fill', c.correlation > 0 ? 'bg-green-500' : 'bg-red-500')}
                      style={{ width: `${c.absCorr * 100}%`, marginLeft: c.correlation < 0 ? '0' : '50%', transform: c.correlation < 0 ? 'translateX(-100%)' : 'none' }}
                    />
                    <div className="absolute left-1/2 top-0 h-full w-px bg-white/20" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Strong positive & negative insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-green-500/20 bg-green-500/[0.04] p-4">
          <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-400" />
            STRONG POSITIVE CORRELATIONS (r &gt; 0.7)
          </h3>
          <div className="space-y-1.5">
            {data.strongPositive.length === 0 ? (
              <p className="text-xs font-mono text-muted-foreground">No strong positive correlations found</p>
            ) : data.strongPositive.map((c: any, i: number) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-background/30 p-2 border border-green-500/10">
                <span className="text-[10px] font-mono">{c.label1} ↔ {c.label2}</span>
                <span className="font-mono text-xs font-bold text-green-400">+{c.correlation.toFixed(3)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-4">
          <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-red-400" />
            STRONG NEGATIVE CORRELATIONS (r &lt; -0.7)
          </h3>
          <div className="space-y-1.5">
            {data.strongNegative.length === 0 ? (
              <p className="text-xs font-mono text-muted-foreground">No strong negative correlations found</p>
            ) : data.strongNegative.map((c: any, i: number) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-background/30 p-2 border border-red-500/10">
                <span className="text-[10px] font-mono">{c.label1} ↔ {c.label2}</span>
                <span className="font-mono text-xs font-bold text-red-400">{c.correlation.toFixed(3)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
