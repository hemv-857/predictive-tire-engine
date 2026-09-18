'use client'

import { useEffect, useState, useRef } from 'react'
import * as d3 from 'd3'
import { Gauge, Clock, Zap, TrendingUp, TrendingDown, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  raceId: string | null
}

export function SectorAnalysis({ raceId }: Props) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [selectedDriver, setSelectedDriver] = useState('TSU')
  const sectorBarRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!raceId) return
    let active = true
    fetch(`/api/sector-analysis?raceId=${raceId}`)
      .then(r => r.json())
      .then(d => { if (active) { setData(d); setLoading(false) } })
      .catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [raceId])

  // Render sector comparison bar chart
  useEffect(() => {
    if (!sectorBarRef.current || !data?.drivers) return
    const svg = d3.select(sectorBarRef.current)
    svg.selectAll('*').remove()

    const drivers = data.drivers.slice(0, 8)
    const width = 700
    const height = 280
    const margin = { top: 20, right: 20, bottom: 40, left: 50 }
    const w = width - margin.left - margin.right
    const h = height - margin.top - margin.bottom

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    // Data: 3 bars per driver (S1, S2, S3)
    const sectors = ['s1', 's2', 's3']
    const sectorColors: Record<string, string> = { s1: '#ef4444', s2: '#f59e0b', s3: '#22c55e' }
    const sectorLabels: Record<string, string> = { s1: 'S1', s2: 'S2', s3: 'S3' }

    const x0 = d3.scaleBand().domain(drivers.map((d: any) => d.code)).range([0, w]).padding(0.2)
    const x1 = d3.scaleBand().domain(sectors).range([0, x0.bandwidth()]).padding(0.1)

    const allTimes = drivers.flatMap((d: any) => [d.sectors.s1.avg, d.sectors.s2.avg, d.sectors.s3.avg])
    const minTime = Math.min(...allTimes) * 0.98
    const maxTime = Math.max(...allTimes) * 1.02
    const y = d3.scaleLinear().domain([minTime, maxTime]).range([h, 0])

    // Grid
    g.append('g').attr('class', 'd3-grid').call(d3.axisLeft(y).tickSize(-w).tickFormat(() => '').ticks(5))

    // Bars
    drivers.forEach((d: any) => {
      const groupG = g.append('g').attr('transform', `translate(${x0(d.code)},0)`)
      sectors.forEach((s) => {
        const val = d.sectors[s].avg
        const isFastest = val === data.fastestSectors[s]
        groupG.append('rect')
          .attr('x', x1(s)!)
          .attr('y', y(val))
          .attr('width', x1.bandwidth())
          .attr('height', h - y(val))
          .attr('fill', sectorColors[s])
          .attr('opacity', d.isRB ? 1 : 0.6)
          .attr('rx', 2)
        if (isFastest) {
          groupG.append('text')
            .attr('x', x1(s)! + x1.bandwidth() / 2)
            .attr('y', y(val) - 4)
            .attr('text-anchor', 'middle')
            .attr('fill', '#fbbf24')
            .attr('font-size', '8px')
            .attr('font-family', 'monospace')
            .text('★')
        }
      })
    })

    // X axis
    g.append('g').attr('class', 'd3-axis').attr('transform', `translate(0,${h})`)
      .call(d3.axisBottom(x0).tickSize(0))

    // Y axis
    g.append('g').attr('class', 'd3-axis').call(d3.axisLeft(y).ticks(5).tickFormat((d) => `${(+d).toFixed(1)}`))

    // Legend
    const legend = svg.append('g').attr('transform', `translate(${width - 120}, 10)`)
    sectors.forEach((s, i) => {
      const lx = 0
      const ly = i * 16
      legend.append('rect').attr('x', lx).attr('y', ly).attr('width', 10).attr('height', 10).attr('fill', sectorColors[s]).attr('rx', 1)
      legend.append('text').attr('x', lx + 14).attr('y', ly + 9).attr('fill', 'oklch(0.75 0.012 264)').attr('font-size', '9px').attr('font-family', 'monospace').text(sectorLabels[s])
    })
  }, [data])

  if (loading || !data) {
    return (
      <div className="rounded-xl border border-white/10 bg-card/40 p-8 text-center">
        <Gauge className="h-6 w-6 text-muted-foreground animate-pulse mx-auto mb-2" />
        <p className="text-xs font-mono text-muted-foreground">Analyzing sector times…</p>
      </div>
    )
  }

  const driver = data.drivers.find((d: any) => d.code === selectedDriver) || data.drivers[0]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-white/10 bg-card/40 rb-card-glass">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-red-400" />
          <span className="text-xs font-mono font-bold">SECTOR ANALYSIS</span>
        </div>
        <div className="flex-1" />
        <span className="rb-chip bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
          <Clock className="h-2.5 w-2.5" /> {data.totalLaps} laps · {data.totalDrivers} drivers
        </span>
      </div>

      {/* Fastest sectors banner */}
      <div className="grid grid-cols-3 gap-3">
        {['s1', 's2', 's3'].map((s) => {
          const fastest = data.fastestSectors[s]
          const leader = data.lapLeaders[0]?.[`${s}Leader`]
          const colors: Record<string, string> = { s1: '#ef4444', s2: '#f59e0b', s3: '#22c55e' }
          return (
            <div key={s} className="rb-card-glass rounded-xl border p-3 text-center" style={{ borderColor: `${colors[s]}40` }}>
              <div className="text-[9px] font-mono font-bold uppercase" style={{ color: colors[s] }}>FASTEST {s.toUpperCase()}</div>
              <div className="font-mono text-2xl font-bold mt-1" style={{ color: colors[s] }}>{fastest?.toFixed(3)}</div>
              <div className="text-[9px] font-mono text-muted-foreground mt-0.5">★ {leader?.code} · {leader?.time?.toFixed(3)}s</div>
            </div>
          )
        })}
      </div>

      {/* Sector comparison bar chart */}
      <div className="rounded-xl border border-white/10 bg-card/40 p-4">
        <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-400" />
          SECTOR TIME COMPARISON
          <span className="text-[10px] font-mono text-muted-foreground ml-2">★ = fastest overall</span>
        </h3>
        <svg ref={sectorBarRef} viewBox="0 0 700 280" style={{ width: '100%', height: 'auto' }} />
      </div>

      {/* Driver detail */}
      <div className="rounded-xl border border-white/10 bg-card/40 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold font-mono flex items-center gap-2">
            <Gauge className="h-4 w-4 text-cyan-400" />
            DRIVER SECTOR BREAKDOWN
          </h3>
          <select
            value={selectedDriver}
            onChange={(e) => setSelectedDriver(e.target.value)}
            className="bg-background/60 border border-white/10 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-red-500/50"
          >
            {data.drivers.map((d: any) => <option key={d.code} value={d.code}>{d.code} · {d.name}</option>)}
          </select>
        </div>

        {driver && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {['s1', 's2', 's3'].map((s) => {
              const sector = driver.sectors[s]
              const strength = data.sectorStrengths.find((ss: any) => ss.code === driver.code)
              const rank = strength?.[`${s}Rank`]
              const isBest = strength?.bestSector === s.toUpperCase()
              const isWorst = strength?.worstSector === s.toUpperCase()
              const colors: Record<string, string> = { s1: '#ef4444', s2: '#f59e0b', s3: '#22c55e' }
              return (
                <div key={s} className={cn(
                  'rounded-lg p-3 border',
                  isBest ? 'bg-green-500/[0.06] border-green-500/30' : isWorst ? 'bg-red-500/[0.06] border-red-500/30' : 'bg-background/30 border-white/5'
                )}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-sm font-bold" style={{ color: colors[s] }}>SECTOR {s.toUpperCase()}</span>
                    {isBest && <span className="rb-chip bg-green-500/15 text-green-300 border border-green-500/30 text-[8px]"><TrendingUp className="h-2.5 w-2.5" /> BEST</span>}
                    {isWorst && <span className="rb-chip bg-red-500/15 text-red-300 border border-red-500/30 text-[8px]"><TrendingDown className="h-2.5 w-2.5" /> WORST</span>}
                  </div>
                  <div className="space-y-1.5 text-[10px] font-mono">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">AVG</span>
                      <span className="font-bold text-cyan-400">{sector.avg.toFixed(3)}s</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">BEST</span>
                      <span className="font-bold text-green-400">{sector.best.toFixed(3)}s</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">σ CONSISTENCY</span>
                      <span className="font-bold text-amber-400">{sector.consistency.toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">% OF LAP</span>
                      <span className="font-bold">{sector.pctOfLap}%</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-white/5">
                      <span className="text-muted-foreground">FIELD RANK</span>
                      <span className={cn('font-bold', rank <= 3 ? 'text-green-400' : rank <= 6 ? 'text-amber-400' : 'text-red-400')}>P{rank}/{data.totalDrivers}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Lap-by-lap sector leaders */}
      <div className="rounded-xl border border-white/10 bg-card/40 p-4">
        <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-400" />
          LAP-BY-LAP SECTOR LEADERS
        </h3>
        <div className="overflow-x-auto rb-scroll max-h-[300px]">
          <table className="w-full text-[10px] font-mono">
            <thead className="sticky top-0 bg-card">
              <tr className="text-left text-muted-foreground border-b border-white/10">
                <th className="pb-2 pr-3">LAP</th>
                <th className="pb-2 pr-3">S1 LEADER</th>
                <th className="pb-2 pr-3">S2 LEADER</th>
                <th className="pb-2 pr-3">S3 LEADER</th>
                <th className="pb-2">FASTEST LAP</th>
              </tr>
            </thead>
            <tbody>
              {data.lapLeaders.map((l: any) => (
                <tr key={l.lap} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="py-1 pr-3 text-muted-foreground">L{l.lap}</td>
                  <td className="py-1 pr-3">
                    <span className="font-bold text-red-400">{l.s1Leader.code}</span>
                    <span className="text-muted-500 ml-1">{l.s1Leader.time.toFixed(3)}</span>
                  </td>
                  <td className="py-1 pr-3">
                    <span className="font-bold text-amber-400">{l.s2Leader.code}</span>
                    <span className="text-muted-500 ml-1">{l.s2Leader.time.toFixed(3)}</span>
                  </td>
                  <td className="py-1 pr-3">
                    <span className="font-bold text-green-400">{l.s3Leader.code}</span>
                    <span className="text-muted-500 ml-1">{l.s3Leader.time.toFixed(3)}</span>
                  </td>
                  <td className="py-1">
                    <span className="font-bold text-cyan-400">{l.fastest.code}</span>
                    <span className="text-muted-500 ml-1">{l.fastest.time.toFixed(3)}</span>
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
