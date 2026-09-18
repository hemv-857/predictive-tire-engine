'use client'

import { useEffect, useState } from 'react'
import { DegradationCurve } from '@/components/charts/degradation-curve'
import { TeamBarChart } from '@/components/charts/team-bar-chart'
import { CloudRain, Thermometer, Sun, Droplets, Wind, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function WeatherImpact() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetch('/api/weather-impact').then(r => r.json()).then(d => {
      if (active) { setData(d); setLoading(false) }
    }).catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 bg-card/40 p-8 text-center">
        <CloudRain className="h-6 w-6 text-muted-foreground animate-pulse mx-auto mb-2" />
        <p className="text-xs font-mono text-muted-foreground">Analyzing weather impact…</p>
      </div>
    )
  }

  if (!data) return null

  const tempSeries = [{
    id: 'perf',
    name: 'Avg Tire Performance',
    color: '#22c55e',
    points: data.tempImpact.map((t: any) => ({ x: t.trackTempBucket, y: t.avgPerf })),
  }]
  const lapTimeSeries = [{
    id: 'laptime',
    name: 'Avg Lap Time',
    color: '#f59e0b',
    points: data.tempImpact.map((t: any) => ({ x: t.trackTempBucket, y: t.avgLapTime })),
  }]
  const tireTempSeries = [{
    id: 'tiretemp',
    name: 'Avg Tire Temp',
    color: '#ef4444',
    points: data.tempImpact.map((t: any) => ({ x: t.trackTempBucket, y: t.avgTireTemp })),
  }]

  const driftColor = data.summary.driftStatus === 'stable' ? '#22c55e' : data.summary.driftStatus === 'elevated' ? '#f59e0b' : '#ef4444'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-white/10 bg-card/40">
        <div className="flex items-center gap-2">
          <CloudRain className="h-4 w-4 text-cyan-400" />
          <span className="text-xs font-mono font-bold">WEATHER IMPACT ANALYZER</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-3 text-[10px] font-mono">
          <span className="rb-chip bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
            <Droplets className="h-2.5 w-2.5" /> {data.summary.totalDataPoints} data points
          </span>
          <span className="rb-chip bg-green-500/15 text-green-300 border border-green-500/30">
            <CheckCircle2 className="h-2.5 w-2.5" /> Optimal: {data.summary.optimalTrackTempRange}
          </span>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-white/10 bg-card/40 p-3 rb-lift">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground uppercase mb-1">
            <Sun className="h-3 w-3 text-amber-400" />BEST TRACK TEMP
          </div>
          <div className="font-mono text-xl font-bold text-green-400">{data.summary.bestTrackTemp}°C</div>
          <div className="text-[9px] font-mono text-muted-foreground">Peak performance window</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-card/40 p-3 rb-lift">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground uppercase mb-1">
            <AlertTriangle className="h-3 w-3 text-red-400" />WORST TRACK TEMP
          </div>
          <div className="font-mono text-xl font-bold text-red-400">{data.summary.worstTrackTemp}°C</div>
          <div className="text-[9px] font-mono text-muted-foreground">Lowest performance</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-card/40 p-3 rb-lift">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground uppercase mb-1">
            <TrendingUp className="h-3 w-3 text-green-400" />OPTIMAL AVG PERF
          </div>
          <div className="font-mono text-xl font-bold text-green-400">{(data.summary.optimalAvgPerf * 100).toFixed(1)}%</div>
          <div className="text-[9px] font-mono text-muted-foreground">At optimal track temp</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-card/40 p-3 rb-lift">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground uppercase mb-1">
            <Thermometer className="h-3 w-3 text-cyan-400" />DATA POINTS
          </div>
          <div className="font-mono text-xl font-bold text-cyan-400">{data.summary.totalDataPoints}</div>
          <div className="text-[9px] font-mono text-muted-foreground">Across all races</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Track temp vs performance */}
        <div className="rounded-xl border border-white/10 bg-card/40 p-4">
          <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
            <Thermometer className="h-4 w-4 text-red-400" />
            TRACK TEMP → TIRE PERFORMANCE
          </h3>
          <DegradationCurve
            series={tempSeries}
            xLabel="Track Temperature (°C)"
            yLabel="Tire Performance"
            yDomain={[0.7, 1.0]}
            width={560}
            height={280}
            markers={[
              { x: 90, label: '90°', color: '#22c55e' },
              { x: 110, label: '110°', color: '#f59e0b' },
            ]}
          />
        </div>

        {/* Track temp vs tire temp */}
        <div className="rounded-xl border border-white/10 bg-card/40 p-4">
          <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
            <Sun className="h-4 w-4 text-amber-400" />
            TRACK TEMP → TIRE TEMP RESPONSE
          </h3>
          <DegradationCurve
            series={tireTempSeries}
            xLabel="Track Temperature (°C)"
            yLabel="Avg Tire Temp (°C)"
            width={560}
            height={280}
            markers={[
              { x: 90, label: '92° opt', color: '#22c55e' },
              { x: 110, label: '105° warn', color: '#f59e0b' },
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Humidity impact */}
        <div className="rounded-xl border border-white/10 bg-card/40 p-4">
          <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
            <Droplets className="h-4 w-4 text-cyan-400" />
            HUMIDITY IMPACT
          </h3>
          <TeamBarChart
            data={data.humidityImpact.map((h: any) => ({ label: h.label, value: h.avgPerf * 100 }))}
            yLabel="Avg Performance %"
            unit="%"
            width={560}
            height={240}
            horizontal
          />
        </div>

        {/* Lap time vs track temp */}
        <div className="rounded-xl border border-white/10 bg-card/40 p-4">
          <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
            <Wind className="h-4 w-4 text-amber-400" />
            TRACK TEMP → LAP TIME
          </h3>
          <DegradationCurve
            series={lapTimeSeries}
            xLabel="Track Temperature (°C)"
            yLabel="Avg Lap Time (s)"
            width={560}
            height={240}
          />
        </div>
      </div>

      {/* Per-circuit weather table */}
      <div className="rounded-xl border border-white/10 bg-card/40 p-4">
        <h3 className="text-sm font-bold font-mono mb-3 flex items-center gap-2">
          <CloudRain className="h-4 w-4 text-cyan-400" />
          CIRCUIT WEATHER CONDITIONS
        </h3>
        <div className="overflow-x-auto rb-scroll">
          <table className="w-full text-[10px] font-mono">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-white/10">
                <th className="pb-2 pr-3">CIRCUIT</th>
                <th className="pb-2 pr-3">TRACK °C</th>
                <th className="pb-2 pr-3">AIR °C</th>
                <th className="pb-2 pr-3">HUMIDITY</th>
                <th className="pb-2 pr-3">TIRE TEMP</th>
                <th className="pb-2 pr-3">AVG PERF</th>
                <th className="pb-2">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {data.circuitWeather.map((c: any) => (
                <tr key={c.circuit} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="py-1.5 pr-3 font-bold">{c.raceName?.replace(' Grand Prix', ' GP')}</td>
                  <td className="py-1.5 pr-3 text-amber-400">{c.trackTemp}°</td>
                  <td className="py-1.5 pr-3">{c.airTemp}°</td>
                  <td className="py-1.5 pr-3 text-cyan-400">{c.humidity}%</td>
                  <td className={cn('py-1.5 pr-3 font-bold', c.avgTireTemp > 110 ? 'text-red-400' : c.avgTireTemp > 100 ? 'text-amber-400' : 'text-green-400')}>
                    {c.avgTireTemp.toFixed(1)}°
                  </td>
                  <td className="py-1.5 pr-3 text-green-400">{(c.avgPerf * 100).toFixed(1)}%</td>
                  <td className="py-1.5">
                    {c.optimal ? (
                      <span className="rb-chip bg-green-500/15 text-green-300 border border-green-500/30">OPTIMAL</span>
                    ) : (
                      <span className="rb-chip bg-amber-500/15 text-amber-300 border border-amber-500/30">DEGRADED</span>
                    )}
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
