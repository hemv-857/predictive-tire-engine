'use client'

import { useEffect, useRef } from 'react'
import * as d3 from 'd3'

export interface SeriesPoint {
  x: number
  y: number
  label?: string
}

export interface Series {
  id: string
  name: string
  color: string
  points: SeriesPoint[]
  dashed?: boolean
}

interface Props {
  series: Series[]
  width?: number
  height?: number
  xLabel?: string
  yLabel?: string
  yDomain?: [number, number]
  xDomain?: [number, number]
  thresholds?: { value: number; label: string; color: string }[]
  className?: string
  markers?: { x: number; label: string; color: string; dash?: string }[]
}

export function DegradationCurve({
  series,
  width = 720,
  height = 360,
  xLabel = 'Lap',
  yLabel = 'Tire Performance',
  yDomain = [0.6, 1.0],
  xDomain,
  thresholds = [],
  className,
  markers = [],
}: Props) {
  const ref = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const svg = d3.select(ref.current)
    svg.selectAll('*').remove()

    const margin = { top: 24, right: 28, bottom: 48, left: 52 }
    const w = width - margin.left - margin.right
    const h = height - margin.top - margin.bottom

    const allXs = series.flatMap((s) => s.points.map((p) => p.x))
    const xMin = xDomain ? xDomain[0] : (d3.min(allXs) ?? 0)
    const xMax = xDomain ? xDomain[1] : (d3.max(allXs) ?? 1)
    const allYs = series.flatMap((s) => s.points.map((p) => p.y))
    // Auto-compute y domain with 10% padding to prevent edge clipping
    let yMinComputed = yDomain ? yDomain[0] : (d3.min(allYs) ?? 0)
    let yMaxComputed = yDomain ? yDomain[1] : (d3.max(allYs) ?? 1)
    if (!yDomain && yMinComputed !== yMaxComputed) {
      const padding = (yMaxComputed - yMinComputed) * 0.1
      yMinComputed -= padding
      yMaxComputed += padding
    } else if (!yDomain && yMinComputed === yMaxComputed) {
      // All same value — add artificial range
      yMinComputed -= 1
      yMaxComputed += 1
    }

    const x = d3.scaleLinear().domain([xMin, xMax]).range([0, w])
    const y = d3.scaleLinear().domain([yMinComputed, yMaxComputed]).range([h, 0])

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    // Grid
    g.append('g')
      .attr('class', 'd3-grid')
      .call(d3.axisLeft(y).tickSize(-w).tickFormat(() => ''))

    // Thresholds
    for (const t of thresholds) {
      g.append('line')
        .attr('x1', 0).attr('x2', w)
        .attr('y1', y(t.value)).attr('y2', y(t.value))
        .attr('stroke', t.color)
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '4,3')
        .attr('opacity', 0.5)
      g.append('text')
        .attr('x', w - 4).attr('y', y(t.value) - 4)
        .attr('text-anchor', 'end')
        .attr('fill', t.color)
        .attr('font-size', '10px')
        .attr('font-family', 'var(--font-geist-mono), monospace')
        .text(t.label)
    }

    // Markers (vertical lines e.g. pit window)
    for (const m of markers) {
      g.append('line')
        .attr('x1', x(m.x)).attr('x2', x(m.x))
        .attr('y1', 0).attr('y2', h)
        .attr('stroke', m.color)
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', m.dash || '5,3')
        .attr('opacity', 0.7)
      g.append('text')
        .attr('x', x(m.x) + 4).attr('y', 14)
        .attr('fill', m.color)
        .attr('font-size', '10px')
        .attr('font-family', 'var(--font-geist-mono), monospace')
        .text(m.label)
    }

    // Lines
    const line = d3.line<SeriesPoint>()
      .x((d) => x(d.x))
      .y((d) => y(d.y))
      .curve(d3.curveMonotoneX)

    for (const s of series) {
      // Area under curve for fill effect
      const area = d3.area<SeriesPoint>()
        .x((d) => x(d.x))
        .y0(h)
        .y1((d) => y(d.y))
        .curve(d3.curveMonotoneX)
      const gradientId = `grad-${s.id.replace(/[^a-z0-9]/gi, '')}`
      const defs = svg.append('defs')
      const grad = defs.append('linearGradient')
        .attr('id', gradientId)
        .attr('x1', '0%').attr('y1', '0%').attr('x2', '0%').attr('y2', '100%')
      grad.append('stop').attr('offset', '0%').attr('stop-color', s.color).attr('stop-opacity', 0.25)
      grad.append('stop').attr('offset', '100%').attr('stop-color', s.color).attr('stop-opacity', 0)

      if (!s.dashed) {
        g.append('path')
          .datum(s.points)
          .attr('fill', `url(#${gradientId})`)
          .attr('d', area)
      }

      const path = g.append('path')
        .datum(s.points)
        .attr('fill', 'none')
        .attr('stroke', s.color)
        .attr('stroke-width', s.dashed ? 1.5 : 2.5)
        .attr('d', line)
      if (s.dashed) path.attr('stroke-dasharray', '5,4')

      // Last point marker
      const last = s.points[s.points.length - 1]
      if (last) {
        g.append('circle')
          .attr('cx', x(last.x)).attr('cy', y(last.y))
          .attr('r', 4)
          .attr('fill', s.color)
          .attr('stroke', '#0a0a0f')
          .attr('stroke-width', 1.5)
      }
    }

    // Axes
    g.append('g')
      .attr('class', 'd3-axis')
      .attr('transform', `translate(0,${h})`)
      .call(d3.axisBottom(x).ticks(Math.min(10, xMax - xMin)).tickFormat((d) => `${d}`))
    g.append('g')
      .attr('class', 'd3-axis')
      .call(d3.axisLeft(y).ticks(6).tickFormat((d) => `${(+d).toFixed(2)}`))

    // Axis labels
    g.append('text')
      .attr('x', w / 2).attr('y', h + 38)
      .attr('text-anchor', 'middle')
      .attr('fill', 'oklch(0.68 0.01 264)')
      .attr('font-size', '11px')
      .attr('font-family', 'var(--font-geist-mono), monospace')
      .text(xLabel)
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -h / 2).attr('y', -38)
      .attr('text-anchor', 'middle')
      .attr('fill', 'oklch(0.68 0.01 264)')
      .attr('font-size', '11px')
      .attr('font-family', 'var(--font-geist-mono), monospace')
      .text(yLabel)
  }, [series, width, height, xLabel, yLabel, yDomain, xDomain, JSON.stringify(thresholds), JSON.stringify(markers)])

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={{ width: '100%', height: 'auto' }}
    />
  )
}
