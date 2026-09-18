'use client'

import { useEffect, useState, useRef } from 'react'
import * as d3 from 'd3'
import { TrendingUp, AlertTriangle, Activity, Target, Gauge, Zap, Clock, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  raceId: string | null
  drivers: any[]
}

export function PerformanceForecast({ raceId, drivers }: Props) {
  const [selectedDriver, setSelectedDriver] = useState('TSU')
  const [forecastLaps, setForecastLaps] = useState(15)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const chartRef = useRef<SVGSVGElement>(null)

  const validDriver = drivers.some((d) => d.code === selectedDriver) ? selectedDriver : (drivers[0]?.code || '')

  useEffect(() => {
    if (!raceId) return
    let active = true
    fetch(`/api/forecast?raceId=${raceId}&driverCode=${validDriver}&laps=${forecastLaps}`)
      .then(r => r.json())
      .then(d => { if (active) { setData(d); setLoading(false) } })
      .catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [raceId, validDriver, forecastLaps])

  // Render forecast chart with confidence bands
  useEffect(() => {
    if (!chartRef.current || !data?.series) return
    const svg = d3.select(chartRef.current)
    svg.selectAll('*').remove()

    const width = 900
    const height = 340
    const margin = { top: 20, right: 60, bottom: 40, left: 50 }
    const w = width - margin.left - margin.right
    const h = height - margin.top - margin.bottom

    const hist = data.series.historical
    const p50 = data.series.p50
    const p5 = data.series.p5
    const p95 = data.series.p95

    // Combine all points for domain
    const allXs = [...hist.points.map((p: any) => p.x), ...p50.points.map((p: any) => p.x)]
    const allYs = [...hist.points.map((p: any) => p.y), ...p50.points.map((p: any) => p.y), ...p5.points.map((p: any) => p.y), ...p95.points.map((p: any) => p.y)]
    const xMin = Math.min(...allXs)
    const xMax = Math.max(...allXs)
    const yMin = Math.min(...allYs) - 0.03
    const yMax = Math.max(...allYs) + 0.03

    const x = d3.scaleLinear().domain([xMin, xMax]).range([0, w])
    const y = d3.scaleLinear().domain([yMin, yMax]).range([h, 0])

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    // Grid
    g.append('g').attr('class', 'd3-grid').call(d3.axisLeft(y).tickSize(-w).tickFormat(() => '').ticks(5))

    // Thresholds
    const thresholds = [
      { value: 0.95, label: '95%', color: '#a3e635' },
      { value: 0.90, label: '90%', color: '#f59e0b' },
      { value: 0.85, label: '85%', color: '#f97316' },
      { value: 0.80, label: '80%', color: '#ef4444' },
    ]
    for (const t of thresholds) {
      g.append('line')
        .attr('x1', 0).attr('x2', w)
        .attr('y1', y(t.value)).attr('y2', y(t.value))
        .attr('stroke', t.color).attr('stroke-width', 0.5)
        .attr('stroke-dasharray', '3,3').attr('opacity', 0.4)
      g.append('text')
        .attr('x', w - 4).attr('y', y(t.value) - 3)
        .attr('text-anchor', 'end')
        .attr('fill', t.color).attr('font-size', '8px')
        .attr('font-family', 'var(--font-geist-mono), monospace')
        .text(t.label)
    }

    // Confidence band (area between P5 and P95)
    const lastHistX = hist.points[hist.points.length - 1]?.x
    const connP5 = lastHistX ? [{ x: lastHistX, y: hist.points[hist.points.length - 1].y }, ...p5.points] : p5.points
    const connP95 = lastHistX ? [{ x: lastHistX, y: hist.points[hist.points.length - 1].y }, ...p95.points] : p95.points

    const bandData = [...connP95, ...connP5.reverse()]
    const bandPath = d3.line<any>().x(d => x(d.x)).y(d => y(d.y))
    g.append('path')
      .datum(bandData)
      .attr('fill', '#f59e0b')
      .attr('opacity', 0.12)
      .attr('d', bandPath)

    // Historical line
    const histLine = d3.line<any>().x(d => x(d.x)).y(d => y(d.y)).curve(d3.curveMonotoneX)
    g.append('path').datum(hist.points).attr('fill', 'none')
      .attr('stroke', '#22c55e').attr('stroke-width', 2.5).attr('d', histLine)

    // Forecast P50 line
    const forecastLine = d3.line<any>().x(d => x(d.x)).y(d => y(d.y)).curve(d3.curveMonotoneX)
    g.append('path').datum(p50.points).attr('fill', 'none')
      .attr('stroke', '#f59e0b').attr('stroke-width', 2.5).attr('d', forecastLine)

    // P5 and P95 dashed lines
    g.append('path').datum(connP5).attr('fill', 'none')
      .attr('stroke', '#ef4444').attr('stroke-width', 1).attr('stroke-dasharray', '4,3').attr('opacity', 0.5).attr('d', forecastLine)
    g.append('path').datum(connP95).attr('fill', 'none')
      .attr('stroke', '#22c55e').attr('stroke-width', 1).attr('stroke-dasharray', '4,3').attr('opacity', 0.5).attr('d', forecastLine)

    // Current lap marker
    g.append('line')
      .attr('x1', x(lastHistX || xMin)).attr('x2', x(lastHistX || xMin))
      .attr('y1', 0).attr('y2', h)
      .attr('stroke', '#f8fafc').attr('stroke-width', 1).attr('opacity', 0.4)
    g.append('text')
      .attr('x', x(lastHistX || xMin)).attr('y', -2)
      .attr('text-anchor', 'middle').attr('fill', '#f8fafc')
      .attr('font-size', '9px').attr('font-family', 'var(--font-geist-mono), monospace')
      .attr('font-weight', '700')
      .text(`NOW L${lastHistX}`)

    // Threshold crossing markers
    for (const tc of data.thresholdCrossings) {
      if (tc.lap !== null) {
        g.append('line')
          .attr('x1', x(tc.lap)).attr('x2', x(tc.lap))
          .attr('y1', y(tc.level)).attr('y2', h)
          .attr('stroke', tc.color).attr('stroke-width', 1.5)
          .attr('stroke-dasharray', '5,3').attr('opacity', 0.6)
        g.append('circle')
          .attr('cx', x(tc.lap)).attr('cy', y(tc.level))
          .attr('r', 4)
          .attr('fill', tc.color)
          .attr('stroke', '#0a0a0f').attr('stroke-width', 1.5)
        g.append('text')
          .attr('x', x(tc.lap) + 4).attr('y', y(tc.level) - 6)
          .attr('fill', tc.color).attr('font-size', '8px')
          .attr('font-family', 'var(--font-geist-mono), monospace')
          .attr('font-weight', '700')
          .text(`L${tc.lap}`)
      }
    }

    // Axes
    g.append('g').attr('class', 'd3-axis').attr('transform', `translate(0,${h})`)
      .call(d3.axisBottom(x).ticks(10).tickFormat((d) => `L${d}`))
    g.append('g').attr('class', 'd3-axis').call(d3.axisLeft(y).ticks(5).tickFormat((d) => `${(+d).toFixed(2)}`))

    // Labels
    g.append('text')
      .attr('x', w / 2).attr('y', h + 32)
      .attr('text-anchor', 'middle')
      .attr('fill', 'oklch(0.75 0.012 264)')
      .attr('font-size', '10px')
      .attr('font-family', 'var(--font-geist-mono), monospace')
      .text('Lap')
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -h / 2).attr('y', -38)
      .attr('text-anchor', 'middle')
      .attr('fill', 'oklch(0.75 0.012 264)')
      .attr('font-size', '10px')
      .attr('font-family', 'var(--font-geist-mono), monospace')
      .text('Tire Performance')

    // Legend
    const legend = svg.append('g').attr('transform', `translate(${width - 130}, 20)`)
    const items = [
      { color: '#22c55e', label: 'Historical', line: true },
      { color: '#f59e0b', label: 'P50 Forecast', line: true },
      { color: '#ef4444', label: 'P5 (worst)', line: true, dashed: true },
      { color: '#22c55e', label: 'P95 (best)', line: true, dashed: true },
    ]
    items.forEach((item, i) => {
      const ly = i * 16
      if (item.dashed) {
        legend.append('line').attr('x1', 0).attr('x2', 12).attr('y1', ly + 5).attr('y2', ly + 5)
          .attr('stroke', item.color).attr('stroke-width', 1.5).attr('stroke-dasharray', '3,2')
      } else {
        legend.append('line').attr('x1', 0).attr('x2', 12).attr('y1', ly + 5).attr('y2', ly + 5)
          .attr('stroke', item.color).attr('stroke-width', 2)
      }
      legend.append('text').attr('x', 16).attr('y', ly + 9).attr('fill', 'oklch(0.85 0.01 264)')
        .attr('font-size', '9px').attr('font-family', 'var(--font-geist-mono), monospace').text(item.label)
    })
  }, [data])

  if (loading || !data) {
    return (
      <div className="rounded-xl border border-white/10 bg-card/40 p-8 text-center">
        <TrendingUp className="h-6 w-6 text-muted-foreground animate-pulse mx-auto mb-2" />
        <p className="text-xs font-mono text-muted-foreground">Running 200 Monte Carlo forecasts…</p>
      </div>
    )
  }

  const r = data.risk
  const c = data.current

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-white/10 bg-card/40 rb-card-glass">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-red-400" />
          <span className="text-xs font-mono font-bold">PERFORMANCE FORECAST</span>
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
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-muted-foreground">FORECAST:</span>
          <select
            value={forecastLaps}
            onChange={(e) => setForecastLaps(parseInt(e.target.value))}
            className="bg-background/60 border border-white/10 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-red-500/50"
          >
            <option value={10}>10 laps</option>
            <option value={15}>15 laps</option>
            <option value={20}>20 laps</option>
            <option value={25}>25 laps</option>
          </select>
        </div>
      </div>

      {/* Risk banner */}
      <div className={cn('rb-card-glass rounded-xl border p-4 rb-bounce-in')} style={{ borderColor: `${r.color}40`, background: `${r.color}10` }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border" style={{ background: `${r.color}20`, borderColor: `${r.color}40` }}>
              {r.level === 'LOW' ? <CheckCircle2 className="h-6 w-6" style={{ color: r.color }} /> : <AlertTriangle className={cn('h-6 w-6', r.level !== 'LOW' && 'rb-live-dot')} style={{ color: r.color }} />}
            </div>
            <div>
              <div className="text-[10px] font-mono font-bold uppercase tracking-wider" style={{ color: r.color }}>
                RISK LEVEL: {r.level}
              </div>
              <div className="font-mono text-sm font-bold mt-0.5">
                Current perf: <span style={{ color: r.color }}>{(c.currentPerf * 100).toFixed(1)}%</span>
                {data.summary.nextThreshold90 && (
                  <span className="text-muted-foreground"> · 90% threshold in +{data.summary.nextThreshold90.lapsAhead} laps (L{data.summary.nextThreshold90.lap})</span>
                )}
              </div>
              <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                Uncertainty range: ±{((data.summary.uncertaintyRange || 0) / 2).toFixed(1)}% · {data.summary.simulations} Monte Carlo sims
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[9px] font-mono text-muted-foreground uppercase">Forecast Laps</div>
            <div className="font-mono text-2xl font-bold text-cyan-400">{data.summary.forecastLaps}</div>
          </div>
        </div>
      </div>

      {/* Current state cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rb-card-glass rounded-xl border border-white/10 p-3 rb-lift rb-stagger rb-delay-1">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground uppercase mb-1">
            <Clock className="h-3 w-3 text-cyan-400" />CURRENT LAP
          </div>
          <div className="font-mono text-xl font-bold text-cyan-400">L{c.lap}</div>
        </div>
        <div className="rb-card-glass rounded-xl border border-white/10 p-3 rb-lift rb-stagger rb-delay-2">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground uppercase mb-1">
            <Activity className="h-3 w-3 text-red-400" />TIRE AGE
          </div>
          <div className="font-mono text-xl font-bold text-amber-400">L{c.tireAge}</div>
          <div className="text-[9px] font-mono text-muted-foreground">{c.compound}</div>
        </div>
        <div className="rb-card-glass rounded-xl border border-white/10 p-3 rb-lift rb-stagger rb-delay-3">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground uppercase mb-1">
            <Zap className="h-3 w-3 text-green-400" />PERFORMANCE
          </div>
          <div className="font-mono text-xl font-bold text-green-400">{(c.currentPerf * 100).toFixed(1)}%</div>
        </div>
        <div className="rb-card-glass rounded-xl border border-white/10 p-3 rb-lift rb-stagger rb-delay-4">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground uppercase mb-1">
            <Gauge className="h-3 w-3 text-red-400" />TEMP / SLIP
          </div>
          <div className="font-mono text-sm font-bold">
            <span className="text-red-400">{c.avgTemp}°</span>
            <span className="text-muted-500"> / </span>
            <span className="text-purple-400">{c.avgSlip}°</span>
          </div>
        </div>
        <div className="rb-card-glass rounded-xl border border-white/10 p-3 rb-lift rb-stagger rb-delay-5">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground uppercase mb-1">
            <TrendingUp className="h-3 w-3 text-amber-400" />σ VARIANCE
          </div>
          <div className="font-mono text-xl font-bold text-amber-400">{c.histStd}</div>
          <div className="text-[9px] font-mono text-muted-foreground">historical</div>
        </div>
      </div>

      {/* Forecast chart */}
      <div className="rounded-xl border border-white/10 bg-card/40 p-4">
        <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
          <Target className="h-4 w-4 text-amber-400" />
          PERFORMANCE FORECAST WITH CONFIDENCE BANDS
          <span className="text-[10px] font-mono text-muted-foreground ml-2">· {data.driver.code}</span>
        </h3>
        <svg ref={chartRef} viewBox="0 0 900 340" style={{ width: '100%', height: 'auto' }} />
      </div>

      {/* Threshold crossing timeline */}
      <div className="rounded-xl border border-white/10 bg-card/40 p-4">
        <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          THRESHOLD CROSSING FORECAST
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {data.thresholdCrossings.map((tc: any, i: number) => (
            <div key={i} className="rounded-lg bg-background/30 p-3 border border-white/5 rb-lift" style={{ borderLeftColor: tc.color, borderLeftWidth: 3 }}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: tc.color }} />
                <span className="text-[10px] font-mono font-bold" style={{ color: tc.color }}>{tc.label}</span>
              </div>
              <div className="font-mono text-lg font-bold" style={{ color: tc.color }}>
                {tc.lap ? `L${tc.lap}` : 'N/A'}
              </div>
              <div className="text-[9px] font-mono text-muted-foreground">
                {tc.lapsAhead !== null ? `+${tc.lapsAhead} laps` : 'not in forecast'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Forecast detail table */}
      <div className="rounded-xl border border-white/10 bg-card/40 p-4">
        <h3 className="text-sm font-bold font-mono mb-3">FORECAST DETAIL (P5 / P50 / P95)</h3>
        <div className="overflow-x-auto rb-scroll max-h-[240px]">
          <table className="w-full text-[10px] font-mono">
            <thead className="sticky top-0 bg-card">
              <tr className="text-left text-muted-foreground border-b border-white/10">
                <th className="pb-2 pr-3">LAP</th>
                <th className="pb-2 pr-3">P5 (WORST)</th>
                <th className="pb-2 pr-3">P50 (MEDIAN)</th>
                <th className="pb-2 pr-3">P95 (BEST)</th>
                <th className="pb-2 pr-3">MEAN</th>
                <th className="pb-2">UNCERTAINTY</th>
              </tr>
            </thead>
            <tbody>
              {data.forecast.map((f: any) => {
                const uncertainty = f.p95 - f.p5
                return (
                  <tr key={f.lap} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="py-1 pr-3 text-muted-foreground">L{f.lap}</td>
                    <td className="py-1 pr-3 text-red-400 font-bold">{(f.p5 * 100).toFixed(1)}%</td>
                    <td className="py-1 pr-3 text-amber-400 font-bold">{(f.p50 * 100).toFixed(1)}%</td>
                    <td className="py-1 pr-3 text-green-400 font-bold">{(f.p95 * 100).toFixed(1)}%</td>
                    <td className="py-1 pr-3 text-cyan-400">{(f.mean * 100).toFixed(1)}%</td>
                    <td className="py-1">
                      <span className={cn('font-bold', uncertainty > 0.05 ? 'text-red-400' : uncertainty > 0.03 ? 'text-amber-400' : 'text-green-400')}>
                        ±{(uncertainty * 100 / 2).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
