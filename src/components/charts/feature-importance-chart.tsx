'use client'

import { useEffect, useRef } from 'react'
import * as d3 from 'd3'

interface Feature {
  feature: string
  importance: number
  direction: 'positive' | 'negative'
}

interface Props {
  data: Feature[]
  width?: number
  height?: number
}

export function FeatureImportanceChart({ data, width = 560, height = 360 }: Props) {
  const ref = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const svg = d3.select(ref.current)
    svg.selectAll('*').remove()

    const margin = { top: 16, right: 60, bottom: 30, left: 150 }
    const w = width - margin.left - margin.right
    const h = height - margin.top - margin.bottom

    const sorted = [...data].sort((a, b) => b.importance - a.importance)
    const y = d3.scaleBand().domain(sorted.map((d) => d.feature)).range([0, h]).padding(0.3)
    const x = d3.scaleLinear().domain([0, d3.max(sorted, (d) => d.importance)! * 1.1]).range([0, w])

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    g.append('g').attr('class', 'd3-grid').call(d3.axisTop(x).tickSize(-w).tickFormat(() => ''))
    g.append('g').attr('class', 'd3-axis').call(d3.axisLeft(y).tickSize(0))
    g.append('g').attr('class', 'd3-axis').attr('transform', `translate(0,${h})`).call(d3.axisBottom(x).ticks(5).tickFormat((d) => `${(+d).toFixed(2)}`))

    g.selectAll('.bar')
      .data(sorted)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', 0)
      .attr('y', (d) => y(d.feature)!)
      .attr('width', (d) => x(d.importance))
      .attr('height', y.bandwidth())
      .attr('fill', (d) => (d.direction === 'positive' ? '#ef4444' : '#22c55e'))
      .attr('opacity', 0.85)
      .attr('rx', 3)

    g.selectAll('.bar-label')
      .data(sorted)
      .enter()
      .append('text')
      .attr('class', 'bar-label')
      .attr('x', (d) => x(d.importance) + 6)
      .attr('y', (d) => y(d.feature)! + y.bandwidth() / 2 + 3)
      .attr('fill', 'oklch(0.97 0.003 264)')
      .attr('font-size', '11px')
      .attr('font-family', 'var(--font-geist-mono), monospace')
      .text((d) => d.importance.toFixed(3))

    g.append('text')
      .attr('x', w / 2).attr('y', h + 26)
      .attr('text-anchor', 'middle')
      .attr('fill', 'oklch(0.68 0.01 264)')
      .attr('font-size', '10px')
      .attr('font-family', 'var(--font-geist-mono), monospace')
      .text('Feature Importance (SHAP)')
  }, [data, width, height])

  return <svg ref={ref} viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }} />
}
