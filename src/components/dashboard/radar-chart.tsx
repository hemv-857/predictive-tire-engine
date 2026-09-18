'use client'

import { useEffect, useState, useRef } from 'react'
import * as d3 from 'd3'
import { Radar, Users, Trophy, Target, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  raceId: string | null
  drivers: any[]
}

export function RadarChart({ raceId, drivers }: Props) {
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>(['TSU', 'VER'])
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const radarRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!raceId) return
    let active = true
    const driverParam = selectedDrivers.join(',')
    fetch(`/api/radar?raceId=${raceId}&drivers=${driverParam}`)
      .then(r => r.json())
      .then(d => { if (active) { setData(d); setLoading(false) } })
      .catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [raceId, selectedDrivers])

  // Render radar chart
  useEffect(() => {
    if (!radarRef.current || !data?.drivers) return
    const svg = d3.select(radarRef.current)
    svg.selectAll('*').remove()

    const size = 420
    const margin = 40
    const radius = (size - margin * 2) / 2
    const cx = size / 2
    const cy = size / 2
    const dimensions = data.dimensions
    const numDim = dimensions.length

    const angle = (i: number) => (i / numDim) * 2 * Math.PI - Math.PI / 2
    const rScale = d3.scaleLinear().domain([0, 100]).range([0, radius])

    const g = svg.append('g').attr('transform', `translate(${cx},${cy})`)

    // Grid circles
    for (let i = 1; i <= 5; i++) {
      const r = (radius / 5) * i
      g.append('circle')
        .attr('cx', 0).attr('cy', 0).attr('r', r)
        .attr('fill', 'none')
        .attr('stroke', 'oklch(1 0 0 / 0.08)')
        .attr('stroke-width', 1)
      g.append('text')
        .attr('x', 4).attr('y', -r)
        .attr('fill', 'oklch(0.6 0.01 264)')
        .attr('font-size', '8px')
        .attr('font-family', 'monospace')
        .text(i * 20)
    }

    // Axes
    dimensions.forEach((dim: any, i: number) => {
      const a = angle(i)
      const x = Math.cos(a) * radius
      const y = Math.sin(a) * radius
      g.append('line')
        .attr('x1', 0).attr('y1', 0)
        .attr('x2', x).attr('y2', y)
        .attr('stroke', 'oklch(1 0 0 / 0.1)')
        .attr('stroke-width', 1)
      // Label
      const lx = Math.cos(a) * (radius + 20)
      const ly = Math.sin(a) * (radius + 20)
      g.append('text')
        .attr('x', lx).attr('y', ly)
        .attr('text-anchor', Math.abs(lx) < 5 ? 'middle' : lx > 0 ? 'start' : 'end')
        .attr('dy', '0.32em')
        .attr('fill', 'oklch(0.85 0.01 264)')
        .attr('font-size', '10px')
        .attr('font-family', 'var(--font-geist-mono), monospace')
        .attr('font-weight', '700')
        .text(dim.label)
    })

    // Draw each driver
    data.drivers.forEach((driver: any) => {
      const points = dimensions.map((dim: any, i: number) => {
        const val = driver.normalized[dim.id]
        const a = angle(i)
        const r = rScale(val)
        return { x: Math.cos(a) * r, y: Math.sin(a) * r, val, dim: dim.label }
      })

      // Polygon
      const lineGen = d3.line<any>().x(d => d.x).y(d => d.y).curve(d3.curveCardinalClosed)
      g.append('path')
        .datum([...points, points[0]])
        .attr('fill', driver.color)
        .attr('opacity', 0.15)
        .attr('stroke', driver.color)
        .attr('stroke-width', 2)
        .attr('d', lineGen)

      // Points
      points.forEach((p) => {
        g.append('circle')
          .attr('cx', p.x).attr('cy', p.y)
          .attr('r', 3)
          .attr('fill', driver.color)
          .attr('stroke', '#0a0a0f')
          .attr('stroke-width', 1)
      })
    })
  }, [data])

  const toggleDriver = (code: string) => {
    setSelectedDrivers(prev => {
      if (prev.includes(code)) {
        return prev.length > 1 ? prev.filter(c => c !== code) : prev
      }
      return prev.length < 4 ? [...prev, code] : [...prev.slice(1), code]
    })
  }

  if (loading || !data) {
    return (
      <div className="rounded-xl border border-white/10 bg-card/40 p-8 text-center">
        <Radar className="h-6 w-6 text-muted-foreground animate-pulse mx-auto mb-2" />
        <p className="text-xs font-mono text-muted-foreground">Computing multi-dimensional comparison…</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-white/10 bg-card/40 rb-card-glass">
        <div className="flex items-center gap-2">
          <Radar className="h-4 w-4 text-red-400" />
          <span className="text-xs font-mono font-bold">DRIVER PERFORMANCE RADAR</span>
        </div>
        <div className="flex-1" />
        <span className="rb-chip bg-green-500/15 text-green-300 border border-green-500/30">
          <Trophy className="h-2.5 w-2.5" /> Top: {data.summary.topDriver} ({data.summary.topScore})
        </span>
      </div>

      {/* Driver selector */}
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl border border-white/10 bg-card/40">
        <span className="text-[10px] font-mono text-muted-foreground uppercase mr-2">SELECT DRIVERS (max 4):</span>
        {drivers.map((d) => (
          <button
            key={d.code}
            onClick={() => toggleDriver(d.code)}
            className={cn(
              'rb-sweep rounded-lg px-2.5 py-1 text-[10px] font-mono font-bold transition-all border',
              selectedDrivers.includes(d.code)
                ? d.team === 'Apex Racing' ? 'bg-red-500/20 border-red-500/40 text-red-300' : 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                : 'bg-background/40 border-white/5 text-muted-foreground hover:text-foreground'
            )}
          >
            {d.code}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-4">
        {/* Radar chart */}
        <div className="rounded-xl border border-white/10 bg-card/40 p-4">
          <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
            <Target className="h-4 w-4 text-amber-400" />
            6-DIMENSION COMPARISON
          </h3>
          <svg ref={radarRef} viewBox="0 0 420 420" style={{ width: '100%', height: 'auto' }} />
          {/* Legend */}
          <div className="mt-3 space-y-1.5">
            {data.drivers.map((d: any) => (
              <div key={d.driverCode} className="flex items-center gap-2 text-[10px] font-mono">
                <span className="h-3 w-3 rounded" style={{ background: d.color }} />
                <span className="font-bold flex-1">{d.driverCode} · {d.driverName}</span>
                <span className="text-muted-foreground">Overall: <span className="font-bold" style={{ color: d.color }}>{d.overall}</span></span>
              </div>
            ))}
          </div>
        </div>

        {/* Dimension breakdown */}
        <div className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-card/40 p-4">
            <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-cyan-400" />
              DIMENSION BREAKDOWN
            </h3>
            <div className="overflow-x-auto rb-scroll">
              <table className="w-full text-[10px] font-mono">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-white/10">
                    <th className="pb-2 pr-3">DRIVER</th>
                    {data.dimensions.map((dim: any) => (
                      <th key={dim.id} className="pb-2 pr-3 text-center">{dim.label}</th>
                    ))}
                    <th className="pb-2 text-center">OVERALL</th>
                  </tr>
                </thead>
                <tbody>
                  {data.drivers.map((d: any) => (
                    <tr key={d.driverCode} className={cn('border-b border-white/5', d.isRB && 'bg-red-500/[0.04]')}>
                      <td className="py-1.5 pr-3 font-bold">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                          {d.driverCode}
                        </span>
                      </td>
                      {data.dimensions.map((dim: any) => {
                        const val = d.normalized[dim.id]
                        return (
                          <td key={dim.id} className="py-1.5 pr-3 text-center">
                            <span className={cn('font-bold', val >= 75 ? 'text-green-400' : val >= 50 ? 'text-amber-400' : 'text-red-400')}>
                              {val}
                            </span>
                          </td>
                        )
                      })}
                      <td className="py-1.5 text-center">
                        <span className="font-bold text-lg" style={{ color: d.color }}>{d.overall}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Dimension descriptions */}
          <div className="rounded-xl border border-white/10 bg-card/40 p-4">
            <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-cyan-400" />
              DIMENSION DEFINITIONS
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {data.dimensions.map((dim: any) => (
                <div key={dim.id} className="rounded-lg bg-background/30 p-2 border border-white/5">
                  <div className="font-mono text-[11px] font-bold text-amber-400">{dim.label}</div>
                  <div className="text-[9px] font-mono text-muted-foreground">{dim.description}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Raw stats */}
          <div className="rounded-xl border border-white/10 bg-card/40 p-4">
            <h3 className="text-sm font-bold font-mono mb-3">RAW PERFORMANCE STATS</h3>
            <div className="overflow-x-auto rb-scroll">
              <table className="w-full text-[10px] font-mono">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-white/10">
                    <th className="pb-2 pr-3">DRIVER</th>
                    <th className="pb-2 pr-3">AVG LAP</th>
                    <th className="pb-2 pr-3">BEST</th>
                    <th className="pb-2 pr-3">σ CONS</th>
                    <th className="pb-2 pr-3">AVG PERF</th>
                    <th className="pb-2 pr-3">AVG TEMP</th>
                    <th className="pb-2 pr-3">AVG SLIP</th>
                    <th className="pb-2 pr-3">TOP SPEED</th>
                    <th className="pb-2">STINTS</th>
                  </tr>
                </thead>
                <tbody>
                  {data.drivers.map((d: any) => (
                    <tr key={d.driverCode} className={cn('border-b border-white/5', d.isRB && 'bg-red-500/[0.04]')}>
                      <td className="py-1.5 pr-3 font-bold">{d.driverCode}</td>
                      <td className="py-1.5 pr-3 text-cyan-400">{d.raw.avgLap}</td>
                      <td className="py-1.5 pr-3 text-green-400">{d.raw.bestLap}</td>
                      <td className="py-1.5 pr-3 text-amber-400">{d.raw.consistency}</td>
                      <td className="py-1.5 pr-3 text-green-400">{(d.raw.avgPerf * 100).toFixed(1)}%</td>
                      <td className="py-1.5 pr-3 text-red-400">{d.raw.avgTemp}°</td>
                      <td className="py-1.5 pr-3 text-purple-400">{d.raw.avgSlip}°</td>
                      <td className="py-1.5 pr-3 text-cyan-400">{d.raw.avgSpeed}</td>
                      <td className="py-1.5">{d.raw.stintCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
