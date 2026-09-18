'use client'

import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface KpiCardProps {
  label: string
  value: string | number
  unit?: string
  delta?: string
  deltaPositive?: boolean
  icon?: LucideIcon
  accent?: 'red' | 'amber' | 'green' | 'cyan' | 'default'
  sub?: string
  className?: string
}

const accentMap = {
  red: {
    ring: 'border-red-500/30',
    glow: 'hover:shadow-[0_0_32px_-8px_rgba(239,68,68,0.45)]',
    text: 'text-red-400',
    bar: 'bg-red-500',
    bg: 'from-red-500/[0.08]',
    iconBg: 'bg-red-500/15 border-red-500/30',
  },
  amber: {
    ring: 'border-amber-500/30',
    glow: 'hover:shadow-[0_0_32px_-8px_rgba(245,158,11,0.45)]',
    text: 'text-amber-400',
    bar: 'bg-amber-500',
    bg: 'from-amber-500/[0.08]',
    iconBg: 'bg-amber-500/15 border-amber-500/30',
  },
  green: {
    ring: 'border-green-500/30',
    glow: 'hover:shadow-[0_0_32px_-8px_rgba(34,197,94,0.45)]',
    text: 'text-green-400',
    bar: 'bg-green-500',
    bg: 'from-green-500/[0.08]',
    iconBg: 'bg-green-500/15 border-green-500/30',
  },
  cyan: {
    ring: 'border-cyan-500/30',
    glow: 'hover:shadow-[0_0_32px_-8px_rgba(6,182,212,0.45)]',
    text: 'text-cyan-400',
    bar: 'bg-cyan-500',
    bg: 'from-cyan-500/[0.08]',
    iconBg: 'bg-cyan-500/15 border-cyan-500/30',
  },
  default: {
    ring: 'border-white/10',
    glow: 'hover:shadow-[0_0_32px_-8px_rgba(255,255,255,0.15)]',
    text: 'text-foreground',
    bar: 'bg-primary',
    bg: 'from-white/[0.04]',
    iconBg: 'bg-white/10 border-white/10',
  },
}

export function KpiCard({ label, value, unit, delta, deltaPositive, icon: Icon, accent = 'default', sub, className }: KpiCardProps) {
  const a = accentMap[accent]
  return (
    <div className={cn(
      'rb-lift group relative overflow-hidden rounded-xl border bg-card/60 backdrop-blur-sm p-4 transition-all',
      a.ring, a.glow, className
    )}>
      {/* Top accent bar with gradient */}
      <div className={cn('absolute top-0 left-0 h-0.5 w-full transition-all group-hover:h-1', a.bar)} />
      {/* Subtle background gradient */}
      <div className={cn('absolute inset-0 bg-gradient-to-br to-transparent opacity-50', a.bg)} />
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground font-mono">{label}</p>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-2xl font-bold font-mono tracking-tight transition-transform group-hover:scale-105 origin-left">{value}</span>
            {unit && <span className="text-xs text-muted-foreground font-mono">{unit}</span>}
          </div>
          {sub && <p className="mt-0.5 text-[10px] text-muted-foreground font-mono">{sub}</p>}
          {delta && (
            <p className={cn(
              'mt-1 text-[10px] font-mono font-medium inline-flex items-center gap-1 rounded px-1.5 py-0.5',
              deltaPositive ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'
            )}>
              {deltaPositive ? '▲' : '▼'} {delta}
            </p>
          )}
        </div>
        {Icon && (
          <div className={cn('shrink-0 rounded-lg p-2 border transition-transform group-hover:scale-110', a.iconBg, a.text)}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
    </div>
  )
}
