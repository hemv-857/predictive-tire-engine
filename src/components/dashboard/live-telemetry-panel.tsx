'use client'

import { useLiveTelemetry } from '@/lib/use-live-telemetry'
import { COMPOUND_COLORS, classColor } from '@/lib/types'
import { Radio, Wifi, WifiOff, Gauge, Thermometer, Fuel, TrendingDown, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

function DriverCard({ t }: { t: any }) {
  const perfColor = t.tirePerformance >= 0.95 ? '#22c55e' : t.tirePerformance >= 0.9 ? '#a3e635' : t.tirePerformance >= 0.85 ? '#f59e0b' : t.tirePerformance >= 0.8 ? '#f97316' : '#ef4444'
  const isRB = t.team === 'Apex Racing'
  const avgTemp = (t.tireTempFL + t.tireTempFR + t.tireTempRL + t.tireTempRR) / 4
  const avgPressure = (t.tirePressureFL + t.tirePressureFR + t.tirePressureRL + t.tirePressureRR) / 4

  return (
    <div className={cn(
      'relative rounded-lg border p-3 transition-all overflow-hidden',
      isRB ? 'border-red-500/50 bg-card/60 rb-glow-red' : 'border-white/10 bg-card/40 hover:bg-card/60'
    )}>
      {isRB && <div className="absolute left-0 top-0 h-full w-0.5 bg-red-500" />}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={cn(
            'flex h-7 w-7 items-center justify-center rounded font-mono text-xs font-bold',
            t.position === 1 ? 'bg-amber-400 text-black' : 'bg-white/10 text-foreground'
          )}>{t.position}</span>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-sm font-bold tracking-wide">{t.driverCode}</span>
              {isRB && <span className="rounded bg-red-500/20 px-1 text-[9px] font-bold text-red-400 font-mono">RB</span>}
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">#{t.carNumber}</span>
          </div>
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">{t.gapToLeader >= 0 ? `+${t.gapToLeader.toFixed(1)}s` : 'LEADER'}</span>
      </div>

      <div className="grid grid-cols-3 gap-1.5 mb-2">
        <div className="rounded bg-background/40 px-1.5 py-1">
          <div className="flex items-center gap-1 text-[9px] text-muted-foreground font-mono"><Thermometer className="h-2.5 w-2.5" />TEMP</div>
          <div className="font-mono text-xs font-bold" style={{ color: avgTemp > 110 ? '#ef4444' : avgTemp > 100 ? '#f59e0b' : '#22c55e' }}>{avgTemp.toFixed(0)}°C</div>
        </div>
        <div className="rounded bg-background/40 px-1.5 py-1">
          <div className="flex items-center gap-1 text-[9px] text-muted-foreground font-mono"><Gauge className="h-2.5 w-2.5" />PSI</div>
          <div className="font-mono text-xs font-bold">{avgPressure.toFixed(1)}</div>
        </div>
        <div className="rounded bg-background/40 px-1.5 py-1">
          <div className="flex items-center gap-1 text-[9px] text-muted-foreground font-mono"><Fuel className="h-2.5 w-2.5" />FUEL</div>
          <div className="font-mono text-xs font-bold">{t.fuelLoad.toFixed(0)}kg</div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: COMPOUND_COLORS[t.tireCompound] || '#888' }} />
          <span className="text-[10px] font-mono text-muted-foreground">
            {t.tireCompound} · L{t.tireAge}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-1.5 w-16 rounded-full bg-background/60 overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${t.tirePerformance * 100}%`, background: perfColor }} />
          </div>
          <span className="font-mono text-[10px] font-bold" style={{ color: perfColor }}>{(t.tirePerformance * 100).toFixed(0)}%</span>
        </div>
      </div>

      <div className="mt-1.5 flex items-center justify-between text-[9px] font-mono text-muted-foreground">
        <span>LAP {t.lap}</span>
        <span className="flex items-center gap-1"><Zap className="h-2.5 w-2.5" />{t.lapTime.toFixed(3)}s</span>
        <span>{t.speedTrap.toFixed(0)} km/h</span>
      </div>
    </div>
  )
}

export function LiveTelemetryPanel() {
  const { telemetry, connected, raceStatus, pitEvents } = useLiveTelemetry()
  const drivers = Object.values(telemetry).sort((a: any, b: any) => a.position - b.position)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <Radio className={cn('h-4 w-4', connected ? 'text-red-500 rb-live-dot' : 'text-muted-foreground')} />
          <h3 className="text-sm font-bold tracking-wide font-mono">LIVE TELEMETRY</h3>
          {connected ? (
            <span className="flex items-center gap-1 text-[10px] font-mono text-green-400">
              <Wifi className="h-3 w-3" /> STREAMING
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-mono text-amber-400">
              <WifiOff className="h-3 w-3" /> RECONNECTING
            </span>
          )}
        </div>
        {raceStatus && (
          <div className="text-right">
            <div className="font-mono text-xs font-bold text-red-400">LAP {raceStatus.lap}/{raceStatus.totalLaps}</div>
            <div className="text-[9px] font-mono text-muted-foreground">Leader: {raceStatus.leader}</div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto rb-scroll space-y-2 pr-1 max-h-[calc(100vh-200px)]">
        {drivers.length === 0 && (
          <div className="rounded-lg border border-dashed border-white/10 p-8 text-center">
            <Radio className="mx-auto h-6 w-6 text-muted-foreground mb-2" />
            <p className="text-xs font-mono text-muted-foreground">Waiting for telemetry stream...</p>
          </div>
        )}
        {drivers.map((t: any) => <DriverCard key={t.driverCode} t={t} />)}
      </div>

      {pitEvents.length > 0 && (
        <div className="mt-3 border-t border-white/10 pt-2">
          <div className="flex items-center gap-1.5 mb-1.5">
            <TrendingDown className="h-3 w-3 text-amber-400" />
            <span className="text-[10px] font-mono font-bold text-amber-400">PIT ACTIVITY</span>
          </div>
          <div className="space-y-1 max-h-24 overflow-y-auto rb-scroll">
            {pitEvents.slice(0, 5).map((e: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-[10px] font-mono bg-background/30 rounded px-2 py-1">
                <span className="font-bold">{e.driverCode}</span>
                <span className="text-muted-foreground">L{e.lap}</span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: COMPOUND_COLORS[e.fromCompound] }} />
                  →
                  <span className="h-2 w-2 rounded-full" style={{ background: COMPOUND_COLORS[e.toCompound] }} />
                </span>
                <span className="text-amber-400">{e.pitDuration?.toFixed(1)}s</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
