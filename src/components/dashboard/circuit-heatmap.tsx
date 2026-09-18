'use client'

import { useEffect, useState, useRef } from 'react'
import * as d3 from 'd3'
import { Grid3x3, MapPin, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export function CircuitHeatmap() {
  const [data, setData] = useState<any>(null)
  const [metric, setMetric] = useState<'avgPitLap' | 'avgStint' | 'avgDeg'>('avgPitLap')
  const [loading, setLoading] = useState(true)
  const [hoveredCell, setHoveredCell] = useState<any>(null)
  const heatmapRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    let active = true
    fetch('/api/circuit-heatmap').then(r => r.json()).then(d => {
      if (active) { setData(d); setLoading(false) }
    }).catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  // Render heatmap grid
  useEffect(() => {
    if (!heatmapRef.current || !data?.heatmap) return
    const svg = d3.select(heatmapRef.current)
    svg.selectAll('*').remove()

    const circuits = data.circuits
    const teams = data.teams
    const cellW = 100
    const cellH = 36
    const margin = { top: 40, right: 16, bottom: 24, left: 180 }
    const width = circuits.length * cellW + margin.left + margin.right
    const height = teams.length * cellH + margin.top + margin.bottom

    svg.attr('viewBox', `0 0 ${width} ${height}`)
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    // Get values for color scale
    const values = data.heatmap.map((h: any) => h[metric])
    const minV = Math.min(...values)
    const maxV = Math.max(...values)

    // Color scale based on metric
    let colorScale: any
    if (metric === 'avgDeg') {
      // Higher = greener (better deg resistance)
      colorScale = d3.scaleLinear<string>()
        .domain([minV, (minV + maxV) / 2, maxV])
        .range(['#ef4444', '#f59e0b', '#22c55e'])
    } else if (metric === 'avgPitLap') {
      // Earlier = red, later = green (more conservative)
      colorScale = d3.scaleLinear<string>()
        .domain([minV, (minV + maxV) / 2, maxV])
        .range(['#ef4444', '#f59e0b', '#22c55e'])
    } else {
      // avgStint: longer = greener
      colorScale = d3.scaleLinear<string>()
        .domain([minV, (minV + maxV) / 2, maxV])
        .range(['#ef4444', '#f59e0b', '#22c55e'])
    }

    // Cells
    for (let ti = 0; ti < teams.length; ti++) {
      for (let ci = 0; ci < circuits.length; ci++) {
        const cell = data.heatmap.find((h: any) => h.team === teams[ti] && h.circuit === circuits[ci])
        const x = ci * cellW
        const y = ti * cellH
        if (cell) {
          g.append('rect')
            .attr('x', x).attr('y', y)
            .attr('width', cellW - 2).attr('height', cellH - 2)
            .attr('fill', colorScale(cell[metric]))
            .attr('opacity', 0.85)
            .attr('rx', 3)
            .style('cursor', 'pointer')
            .on('mouseenter', () => setHoveredCell({ ...cell, teamLabel: teams[ti], circuitLabel: circuits[ci] }))
            .on('mouseleave', () => setHoveredCell(null))
          g.append('text')
            .attr('x', x + cellW / 2)
            .attr('y', y + cellH / 2)
            .attr('text-anchor', 'middle')
            .attr('dy', '0.32em')
            .attr('fill', '#0a0a0f')
            .attr('font-size', '11px')
            .attr('font-family', 'var(--font-geist-mono), monospace')
            .attr('font-weight', '700')
            .text(cell[metric].toFixed(1))
        } else {
          g.append('rect')
            .attr('x', x).attr('y', y)
            .attr('width', cellW - 2).attr('height', cellH - 2)
            .attr('fill', '#1a1a2e')
            .attr('opacity', 0.3)
            .attr('rx', 3)
          g.append('text')
            .attr('x', x + cellW / 2)
            .attr('y', y + cellH / 2)
            .attr('text-anchor', 'middle')
            .attr('dy', '0.32em')
            .attr('fill', '#475569')
            .attr('font-size', '10px')
            .text('—')
        }
      }
    }

    // Team labels (Y)
    for (let ti = 0; ti < teams.length; ti++) {
      g.append('text')
        .attr('x', -8).attr('y', ti * cellH + cellH / 2)
        .attr('text-anchor', 'end')
        .attr('dy', '0.32em')
        .attr('fill', 'oklch(0.85 0.01 264)')
        .attr('font-size', '10px')
        .attr('font-family', 'var(--font-geist-mono), monospace')
        .attr('font-weight', '600')
        .text(teams[ti])
    }

    // Circuit labels (X, rotated)
    for (let ci = 0; ci < circuits.length; ci++) {
      const label = circuits[ci].replace(' Circuit', '').replace(' International', ' Int\'l').replace(' Corniche', '')
      g.append('text')
        .attr('transform', `translate(${ci * cellW + cellW / 2}, -8) rotate(-35)`)
        .attr('text-anchor', 'end')
        .attr('fill', 'oklch(0.85 0.01 264)')
        .attr('font-size', '9px')
        .attr('font-family', 'var(--font-geist-mono), monospace')
        .text(label)
    }
  }, [data, metric])

  const metricLabel: Record<string, string> = {
    avgPitLap: 'Avg Pit Lap',
    avgStint: 'Avg Stint Length',
    avgDeg: 'Deg Resistance',
  }

  return (
    <div className="rounded-xl border border-white/10 bg-card/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-bold font-mono flex items-center gap-2">
            <Grid3x3 className="h-4 w-4 text-red-400" />
            CIRCUIT × TEAM STRATEGY HEATMAP
          </h3>
          <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
            Reverse-engineered competitor patterns from FIA data feeds
          </p>
        </div>
        <div className="flex items-center gap-1">
          {Object.keys(metricLabel).map((k) => (
            <button
              key={k}
              onClick={() => setMetric(k as any)}
              className={cn(
                'rounded px-2 py-1 text-[10px] font-mono transition-colors',
                metric === k ? 'bg-red-500/20 border border-red-500/40 text-red-300' : 'bg-background/40 border border-white/5 text-muted-foreground hover:text-foreground'
              )}
            >
              {metricLabel[k]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-[300px] flex items-center justify-center">
          <Grid3x3 className="h-6 w-6 text-muted-foreground animate-pulse" />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rb-scroll">
            <svg ref={heatmapRef} style={{ width: '100%', height: 'auto', minWidth: '700px' }} />
          </div>

          {/* Hovered cell detail */}
          {hoveredCell && (
            <div className="mt-3 rounded-lg bg-background/40 p-3 border border-white/10 rb-fade-up">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="h-3 w-3 text-amber-400" />
                <span className="text-xs font-mono font-bold">{hoveredCell.teamLabel}</span>
                <span className="text-[10px] font-mono text-muted-foreground">@ {hoveredCell.circuitLabel}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] font-mono">
                <div><span className="text-muted-foreground">Pit Lap:</span> <span className="font-bold text-amber-400">L{hoveredCell.avgPitLap}</span></div>
                <div><span className="text-muted-foreground">Stint:</span> <span className="font-bold">{hoveredCell.avgStint} laps</span></div>
                <div><span className="text-muted-foreground">Deg Res:</span> <span className="font-bold text-green-400">{hoveredCell.avgDeg}</span></div>
                <div><span className="text-muted-foreground">Strategy:</span> <span className="font-bold text-cyan-400">{hoveredCell.dominantStrategy}</span></div>
              </div>
            </div>
          )}

          {/* Circuit summary cards */}
          {data?.circuitSummary && (
            <div className="mt-4 pt-3 border-t border-white/10">
              <p className="text-[10px] font-mono font-bold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
                <TrendingUp className="h-3 w-3" /> Circuit Strategy Profile
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {data.circuitSummary.map((c: any) => (
                  <div key={c.circuit} className="rounded-lg bg-background/30 p-2.5 border border-white/5 rb-lift">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono font-bold truncate">{c.raceName?.replace(' Grand Prix', ' GP') || c.circuit}</span>
                      <span className={cn('rb-chip border', c.dominantStrategy === 'one-stop' ? 'bg-green-500/15 text-green-300 border-green-500/30' : c.dominantStrategy === 'two-stop' ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' : 'bg-red-500/15 text-red-300 border-red-500/30')}>
                        {c.dominantStrategy}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[9px] font-mono text-muted-foreground">
                      <span>Avg Pit: <span className="font-bold text-foreground">L{c.avgPitLap}</span></span>
                      <span>·</span>
                      <span>1:{c.strategyMix.oneStop} 2:{c.strategyMix.twoStop} 3:{c.strategyMix.threeStop}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
