'use client'

import { useEffect, useState } from 'react'
import { Bell, AlertTriangle, AlertCircle, Info, X, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Alert {
  id: string
  severity: 'critical' | 'warning' | 'info'
  category: string
  title: string
  message: string
  timestamp: string
  driverCode?: string
  raceName?: string
  action: string
}

interface Props {
  compact?: boolean
  className?: string
}

const SEV_CONFIG = {
  critical: {
    color: '#ef4444',
    bg: 'bg-red-500/10',
    border: 'border-red-500/40',
    icon: AlertCircle,
    label: 'CRITICAL',
  },
  warning: {
    color: '#f59e0b',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/40',
    icon: AlertTriangle,
    label: 'WARNING',
  },
  info: {
    color: '#06b6d4',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/40',
    icon: Info,
    label: 'INFO',
  },
}

export function AlertsPanel({ compact = false, className }: Props) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [stats, setStats] = useState({ total: 0, critical: 0, warning: 0, info: 0 })
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const load = () => {
      fetch('/api/alerts').then(r => r.json()).then((d) => {
        if (!active) return
        setAlerts(d.alerts || [])
        setStats(d.stats || { total: 0, critical: 0, warning: 0, info: 0 })
        setLoading(false)
      }).catch(() => { if (active) setLoading(false) })
    }
    load()
    const interval = setInterval(load, 15000) // refresh every 15s
    return () => { active = false; clearInterval(interval) }
  }, [])

  const visible = alerts.filter((a) => !dismissed.has(a.id))

  return (
    <div className={cn('rounded-xl border border-white/10 bg-card/40 overflow-hidden rb-glass', className)}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Bell className="h-4 w-4 text-red-400" />
            {stats.critical > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-2 w-2 rounded-full bg-red-500 rb-live-dot" />
            )}
          </div>
          <h3 className="text-sm font-bold font-mono">ALERTS &amp; NOTIFICATIONS</h3>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-mono">
          {stats.critical > 0 && (
            <span className="rb-chip bg-red-500/20 text-red-300 border border-red-500/30">{stats.critical} CRIT</span>
          )}
          {stats.warning > 0 && (
            <span className="rb-chip bg-amber-500/20 text-amber-300 border border-amber-500/30">{stats.warning} WARN</span>
          )}
          {stats.info > 0 && (
            <span className="rb-chip bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">{stats.info} INFO</span>
          )}
        </div>
      </div>

      <div className={cn('rb-scroll', compact ? 'max-h-[280px]' : 'max-h-[400px]')}>
        {loading ? (
          <div className="p-6 text-center">
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-background/40 mb-2">
              <Bell className="h-4 w-4 text-muted-foreground animate-pulse" />
            </div>
            <p className="text-xs font-mono text-muted-foreground">Scanning for alerts…</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="p-6 text-center">
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10 border border-green-500/30 mb-2">
              <Info className="h-4 w-4 text-green-400" />
            </div>
            <p className="text-xs font-mono text-green-400">All systems nominal</p>
            <p className="text-[10px] font-mono text-muted-foreground mt-1">No active alerts</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {visible.map((a) => {
              const cfg = SEV_CONFIG[a.severity]
              const Icon = cfg.icon
              const isExpanded = expanded === a.id
              return (
                <div
                  key={a.id}
                  className={cn('rb-fade-up relative px-4 py-3 transition-colors hover:bg-white/[0.02]', cfg.bg)}
                >
                  <div className={cn('absolute left-0 top-0 h-full w-0.5')} style={{ background: cfg.color }} />
                  <div className="flex items-start gap-3">
                    <div
                      className={cn('shrink-0 rounded-md p-1.5 mt-0.5', cfg.bg, `border ${cfg.border}`)}
                      style={{ color: cfg.color }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[9px] font-mono font-bold uppercase tracking-wider" style={{ color: cfg.color }}>
                          {cfg.label}
                        </span>
                        {a.driverCode && (
                          <span className="rb-chip bg-background/60 text-foreground/80">{a.driverCode}</span>
                        )}
                        <span className="text-[9px] font-mono text-muted-foreground">
                          {new Date(a.timestamp).toLocaleString('en-GB', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs font-mono font-bold text-foreground leading-tight">{a.title}</p>
                      {isExpanded && (
                        <p className="mt-1 text-[11px] font-mono text-muted-foreground leading-relaxed rb-fade-up">{a.message}</p>
                      )}
                      <div className="mt-1.5 flex items-center gap-2">
                        <button
                          className="rb-chip border transition-colors hover:opacity-80"
                          style={{ background: `${cfg.color}20`, color: cfg.color, borderColor: `${cfg.color}40` }}
                        >
                          {a.action} <ChevronRight className="h-2.5 w-2.5" />
                        </button>
                        <button
                          onClick={() => setExpanded(isExpanded ? null : a.id)}
                          className="text-[9px] font-mono text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {isExpanded ? '− LESS' : '+ MORE'}
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={() => setDismissed((prev) => new Set([...prev, a.id]))}
                      className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {visible.length > 0 && (
        <div className="px-4 py-2 border-t border-white/10 flex items-center justify-between">
          <span className="text-[9px] font-mono text-muted-foreground">
            Auto-refresh: 15s · {visible.length} active
          </span>
          <button
            onClick={() => setDismissed(new Set(alerts.map((a) => a.id)))}
            className="text-[9px] font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            DISMISS ALL
          </button>
        </div>
      )}
    </div>
  )
}
