'use client'

import { useEffect, useRef } from 'react'
import * as d3 from 'd3'

interface BarDatum {
  label: string
  value: number
  color?: string
  secondary?: number
}

interface Props {
  data: BarDatum[]
  width?: number
  height?: number
  yLabel?: string
  unit?: string
  highlightLabel?: string
  horizontal?: boolean
}

export function TeamBarChart({
  data,
  width = 720,
  height = 360,
  yLabel = '',
  unit = '',
  highlightLabel,
  horizontal = false,
}: Props) {
  const ref = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const svg = d3.select(ref.current)
    svg.selectAll('*').remove()

    const margin = horizontal
      ? { top: 16, right: 40, bottom: 36, left: 120 }
      : { top: 24, right: 24, bottom: 56, left: 52 }
    const w = width - margin.left - margin.right
    const h = height - margin.top - margin.bottom

    const maxVal = d3.max(data, (d) => Math.max(d.value, d.secondary || 0)) ?? 1

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    const palette = ['#ef4444', '#f59e0b', '#22c55e', '#06b6d4', '#a855f7', '#ec4899', '#84cc16', '#f97316']

    if (horizontal) {
      const y = d3.scaleBand().domain(data.map((d) => d.label)).range([0, h]).padding(0.3)
      const x = d3.scaleLinear().domain([0, maxVal * 1.1]).range([0, w])

      g.append('g').attr('class', 'd3-grid').call(d3.axisTop(x).tickSize(-w).tickFormat(() => ''))
      g.append('g').attr('class', 'd3-axis').call(d3.axisLeft(y).tickSize(0))
      g.append('g').attr('class', 'd3-axis').attr('transform', `translate(0,${h})`).call(d3.axisBottom(x).ticks(6))

      g.selectAll('.bar')
        .data(data)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', 0)
        .attr('y', (d) => y(d.label)!)
        .attr('width', (d) => x(d.value))
        .attr('height', y.bandwidth())
        .attr('fill', (d, i) => d.color || palette[i % palette.length])
        .attr('opacity', (d) => (highlightLabel && d.label !== highlightLabel ? 0.5 : 1))
        .attr('rx', 3)

      g.selectAll('.bar-label')
        .data(data)
        .enter()
        .append('text')
        .attr('class', 'bar-label')
        .attr('x', (d) => x(d.value) + 6)
        .attr('y', (d) => y(d.label)! + y.bandwidth() / 2 + 3)
        .attr('fill', 'oklch(0.97 0.003 264)')
        .attr('font-size', '11px')
        .attr('font-family', 'var(--font-geist-mono), monospace')
        .text((d) => `${d.value.toFixed(1)}${unit}`)
    } else {
      const x = d3.scaleBand().domain(data.map((d) => d.label)).range([0, w]).padding(0.35)
      const y = d3.scaleLinear().domain([0, maxVal * 1.15]).range([h, 0])

      g.append('g').attr('class', 'd3-grid').call(d3.axisLeft(y).tickSize(-w).tickFormat(() => ''))
      g.append('g').attr('class', 'd3-axis').attr('transform', `translate(0,${h})`).call(d3.axisBottom(x).tickSize(0))
      g.append('g').attr('class', 'd3-axis').call(d3.axisLeft(y).ticks(6))

      g.selectAll('.bar')
        .data(data)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', (d) => x(d.label)!)
        .attr('y', (d) => y(d.value))
        .attr('width', x.bandwidth())
        .attr('height', (d) => h - y(d.value))
        .attr('fill', (d, i) => d.color || palette[i % palette.length])
        .attr('opacity', (d) => (highlightLabel && d.label !== highlightLabel ? 0.45 : 1))
        .attr('rx', 3)

      // Value labels
      g.selectAll('.bar-label')
        .data(data)
        .enter()
        .append('text')
        .attr('class', 'bar-label')
        .attr('x', (d) => x(d.label)! + x.bandwidth() / 2)
        .attr('y', (d) => y(d.value) - 6)
        .attr('text-anchor', 'middle')
        .attr('fill', 'oklch(0.97 0.003 264)')
        .attr('font-size', '11px')
        .attr('font-weight', '600')
        .attr('font-family', 'var(--font-geist-mono), monospace')
        .text((d) => `${d.value.toFixed(1)}${unit}`)
    }

    if (yLabel) {
      g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -h / 2).attr('y', horizontal ? -90 : -38)
        .attr('text-anchor', 'middle')
        .attr('fill', 'oklch(0.68 0.01 264)')
        .attr('font-size', '11px')
        .attr('font-family', 'var(--font-geist-mono), monospace')
        .text(yLabel)
    }
  }, [data, width, height, yLabel, unit, highlightLabel, horizontal])

  return <svg ref={ref} viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }} />
}
