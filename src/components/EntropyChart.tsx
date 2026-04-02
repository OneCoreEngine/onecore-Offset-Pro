import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { Activity } from 'lucide-react';

interface EntropyChartProps {
  data: { offset: number; entropy: number }[];
}

export const EntropyChart: React.FC<EntropyChartProps> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth;
    const height = 300;
    const margin = { top: 20, right: 20, bottom: 40, left: 40 };

    const x = d3.scaleLinear()
      .domain([0, d3.max(data, (d: { offset: number }) => d.offset) || 0])
      .range([margin.left, width - margin.right]);

    const y = d3.scaleLinear()
      .domain([0, 8]) // Max entropy is 8 bits
      .range([height - margin.bottom, margin.top]);

    const line = d3.line<{ offset: number; entropy: number }>()
      .x(d => x(d.offset))
      .y(d => y(d.entropy))
      .curve(d3.curveMonotoneX);

    svg.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', 'var(--accent-color)')
      .attr('stroke-width', 2)
      .attr('d', line as any);

    // Add axes
    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat((d) => `0x${Number(d).toString(16).toUpperCase()}`))
      .attr('color', 'var(--muted-color)');

    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(4))
      .attr('color', 'var(--muted-color)');

    // Add labels
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', height - 5)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--muted-color)')
      .attr('font-size', '10px')
      .text('File Offset');

    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2)
      .attr('y', 15)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--muted-color)')
      .attr('font-size', '10px')
      .text('Entropy (bits)');

  }, [data]);

  return (
    <div className="w-full bg-surface border border-color rounded-lg p-4">
      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-color mb-4 flex items-center gap-2">
        <Activity className="w-3 h-3" />
        Entropy Distribution (Shannon Entropy)
      </h3>
      <svg ref={svgRef} className="w-full h-[300px]" />
      <p className="mt-4 text-[10px] text-muted-color leading-relaxed">
        Higher entropy (closer to 8.0) suggests compressed or encrypted data. Lower entropy suggests repetitive data or code.
      </p>
    </div>
  );
};
