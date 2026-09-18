'use client'

import { useEffect, useRef } from 'react'
import * as d3 from 'd3'

interface Props {
  value: number // 0-1
  label?: string
  size?: number
  color?: string
  thresholds?: { value: number; color: string; label: string }[]
  unit?: string
}

export function GaugeChart({
  value,
  label = 'Tire Performance',
  size = 220,
  color,
  thresholds = [
    { value: 0.95, color: '#22c55e', label: 'Optimal' },
    { value: 0.90, color: '#a3e635', label: '95%' },
    { value: 0.85, color: '#f59e0b', label: '90%' },
    { value: 0.80, color: '#f97316', label: '85%' },
    { value: 0, color: '#ef4444', label: 'Critical' },
  ],
  unit = '',
}: Props) {
  const ref = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const svg = d3.select(ref.current)
    svg.selectAll('*').remove()

    const cx = size / 2
    const cy = size / 2 + 10
    const radius = size / 2 - 22
    const startAngle = -Math.PI * 0.75
    const endAngle = Math.PI * 0.75

    const arcGen = (a0: number, a1: number) =>
      d3.arc().innerRadius(radius - 14).outerRadius(radius).startAngle(a0).endAngle(a1)() as string

    const g = svg.append('g').attr('transform', `translate(${cx},${cy})`)

    // Threshold arcs (background segments)
    const sorted = [...thresholds].sort((a, b) => b.value - a.value)
    for (let i = 0; i < sorted.length; i++) {
      const t = sorted[i]
      const tNext = i < sorted.length - 1 ? sorted[i + 1].value : 0
      const a0 = startAngle + (endAngle - startAngle) * tNext
      const a1 = startAngle + (endAngle - startAngle) * t.value
      g.append('path')
        .attr('d', arcGen(a0, a1))
        .attr('fill', t.color)
        .attr('opacity', 0.18)
      // threshold label
      const labelAngle = a1
      const lx = Math.cos(labelAngle - Math.PI / 2) * (radius + 6)
      const ly = Math.sin(labelAngle - Math.PI / 2) * (radius + 6)
      g.append('text')
        .attr('x', lx).attr('y', ly)
        .attr('text-anchor', 'middle')
        .attr('alignment-baseline', 'middle')
        .attr('fill', t.color)
        .attr('font-size', '9px')
        .attr('font-family', 'var(--font-geist-mono), monospace')
        .text(t.label)
    }

    // Value arc
    const valAngle = startAngle + (endAngle - startAngle) * Math.max(0, Math.min(1, value))
    const activeColor = color || (() => {
      for (const t of sorted) if (value >= t.value) return t.color
      return '#ef4444'
    })()

    g.append('path')
      .attr('d', arcGen(startAngle, valAngle))
      .attr('fill', activeColor)
      .attr('opacity', 0.95)

    // Needle
    const needleLen = radius - 18
    const nx = Math.cos(valAngle - Math.PI / 2) * needleLen
    const ny = Math.sin(valAngle - Math.PI / 2) * needleLen
    g.append('line')
      .attr('x1', 0).attr('y1', 0)
      .attr('x2', nx).attr('y2', ny)
      .attr('stroke', '#f8fafc')
      .attr('stroke-width', 2.5)
      .attr('stroke-linecap', 'round')
    g.append('circle')
      .attr('cx', 0).attr('cy', 0).attr('r', 5)
      .attr('fill', '#f8fafc')

    // Center value text
    g.append('text')
      .attr('x', 0).attr('y', radius * 0.35)
      .attr('text-anchor', 'middle')
      .attr('fill', activeColor)
      .attr('font-size', '26px')
      .attr('font-weight', '700')
      .attr('font-family', 'var(--font-geist-mono), monospace')
      .text(`${(value * 100).toFixed(1)}%${unit}`)
    g.append('text')
      .attr('x', 0).attr('y', radius * 0.55)
      .attr('text-anchor', 'middle')
      .attr('fill', 'oklch(0.68 0.01 264)')
      .attr('font-size', '10px')
      .attr('font-family', 'var(--font-geist-mono), monospace')
      .text(label)
  }, [value, label, size, color, JSON.stringify(thresholds), unit])

  return (
    <svg ref={ref} viewBox={`0 0 ${size} ${size + 10}`} style={{ width: '100%', height: 'auto' }} />
  )
}
