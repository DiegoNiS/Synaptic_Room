import React, { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';

const STATE_COLORS = {
  idle:      '#6b7280',
  flow:      '#10b981',
  blocked:   '#ef4444',
  mentoring: '#8b5cf6',
  analyzing: '#f59e0b',
};

const STATE_GLOW = {
  idle:      'rgba(107,114,128,0.5)',
  flow:      'rgba(16,185,129,0.7)',
  blocked:   'rgba(239,68,68,0.7)',
  mentoring: 'rgba(139,92,246,0.7)',
  analyzing: 'rgba(245,158,11,0.7)',
};

const NODE_RADIUS = 10;

/**
 * NodeMap — D3.js force-directed graph for the teacher's real-time classroom view.
 * Nodes represent students, colored by cognitive state.
 * Links represent active mentorships (animated dashed lines).
 *
 * @param {Object} props
 * @param {Object} props.nodeMap - { sessionId, nodes: [{studentId, displayName, state, confidence, connections}] }
 * @param {number} props.width
 * @param {number} props.height
 */
export default function NodeMap({ nodeMap, width = 800, height = 520 }) {
  const svgRef = useRef(null);
  const simulationRef = useRef(null);

  const buildGraph = useCallback(() => {
    if (!svgRef.current || !nodeMap?.nodes?.length) return;

    const nodes = nodeMap.nodes.map(n => ({
      id: n.studentId,
      label: n.displayName,
      state: n.state || 'idle',
      confidence: n.confidence || 0,
      connections: n.connections || [],
    }));

    // Build links from active mentorships
    const mentorshipLinks = [];
    const seenPairs = new Set();
    nodes.forEach(node => {
      if (node.connections.length > 0) {
        nodes.forEach(other => {
          if (other.id !== node.id && other.connections.some(c => node.connections.includes(c))) {
            const key = [node.id, other.id].sort().join('-');
            if (!seenPairs.has(key)) {
              seenPairs.add(key);
              mentorshipLinks.push({ source: node.id, target: other.id });
            }
          }
        });
      }
    });

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Defs for glow filter
    const defs = svg.append('defs');
    Object.entries(STATE_GLOW).forEach(([state, color]) => {
      const filter = defs.append('filter').attr('id', `glow-${state}`).attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
      filter.append('feGaussianBlur').attr('stdDeviation', 4).attr('result', 'blur');
      const merge = filter.append('feMerge');
      merge.append('feMergeNode').attr('in', 'blur');
      merge.append('feMergeNode').attr('in', 'SourceGraphic');
    });

    // Arrow marker for mentorship direction
    defs.append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -4 8 8')
      .attr('refX', NODE_RADIUS + 6)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-4L8,0L0,4')
      .attr('fill', 'rgba(139,92,246,0.8)');

    const g = svg.append('g');

    // Zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    svg.call(zoom);

    // D3 Force Simulation
    if (simulationRef.current) simulationRef.current.stop();
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(mentorshipLinks).id(d => d.id).distance(140).strength(0.5))
      .force('charge', d3.forceManyBody().strength(-350)) // Stronger repulsion to space nodes out like Obsidian
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide(NODE_RADIUS + 25)); // Spaced collisions
    simulationRef.current = simulation;

    // Draw mentorship links
    const linkGroup = g.append('g').attr('class', 'links');
    const links = linkGroup.selectAll('line')
      .data(mentorshipLinks)
      .enter()
      .append('line')
      .attr('stroke', 'rgba(139,92,246,0.6)')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '6 4')
      .attr('marker-end', 'url(#arrow)')
      .style('animation', 'dash 2s linear infinite');

    // Draw node groups
    const nodeGroup = g.append('g').attr('class', 'nodes');
    const nodeGs = nodeGroup.selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .call(d3.drag()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null; d.fy = null;
        })
      );

    // Outer glow ring
    nodeGs.append('circle')
      .attr('r', NODE_RADIUS + 6)
      .attr('fill', 'none')
      .attr('stroke', d => STATE_COLORS[d.state] || STATE_COLORS.idle)
      .attr('stroke-width', 1.2)
      .attr('stroke-opacity', 0.5)
      .attr('filter', d => `url(#glow-${d.state})`);

    // Main node circle
    nodeGs.append('circle')
      .attr('r', NODE_RADIUS)
      .attr('fill', d => STATE_COLORS[d.state] || STATE_COLORS.idle)
      .attr('stroke', '#0c1020') // clean dark border
      .attr('stroke-width', 1.5)
      .attr('filter', d => `url(#glow-${d.state})`);

    // Name label (Obsidian style - clean, small text below node)
    nodeGs.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', `${NODE_RADIUS + 15}px`)
      .attr('font-family', 'Inter, sans-serif')
      .attr('font-size', '9px')
      .attr('font-weight', '500')
      .attr('fill', '#e5e7eb')
      .text(d => d.label);

    // Tooltip on hover
    const tooltip = d3.select('body').select('#synaptic-tooltip');
    if (tooltip.empty()) {
      d3.select('body').append('div')
        .attr('id', 'synaptic-tooltip')
        .style('position', 'fixed')
        .style('background', 'rgba(17,22,34,0.95)')
        .style('border', '1px solid rgba(255,255,255,0.1)')
        .style('border-radius', '8px')
        .style('padding', '10px 14px')
        .style('font-family', 'Inter, sans-serif')
        .style('font-size', '13px')
        .style('color', '#f3f4f6')
        .style('pointer-events', 'none')
        .style('opacity', 0)
        .style('z-index', 9999)
        .style('max-width', '220px');
    }

    nodeGs
      .on('mouseover', (event, d) => {
        const stateLabels = { flow: 'En Flujo', blocked: 'Bloqueado', mentoring: 'En Mentoría', idle: 'Inactivo', analyzing: 'Analizando' };
        d3.select('#synaptic-tooltip')
          .style('opacity', 1)
          .html(`
            <div style="font-weight:700;margin-bottom:4px">${d.label}</div>
            <div style="color:${STATE_COLORS[d.state]};font-weight:600">${stateLabels[d.state] || d.state}</div>
            ${d.confidence > 0 ? `<div style="color:#9ca3af;margin-top:4px">Confianza IA: ${Math.round(d.confidence * 100)}%</div>` : ''}
          `);
      })
      .on('mousemove', (event) => {
        d3.select('#synaptic-tooltip')
          .style('left', (event.clientX + 14) + 'px')
          .style('top', (event.clientY - 10) + 'px');
      })
      .on('mouseleave', () => {
        d3.select('#synaptic-tooltip').style('opacity', 0);
      });

    // Simulation tick
    simulation.on('tick', () => {
      links
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      nodeGs.attr('transform', d => `translate(${d.x},${d.y})`);
    });
  }, [nodeMap, width, height]);

  useEffect(() => {
    buildGraph();
    return () => {
      if (simulationRef.current) simulationRef.current.stop();
      d3.select('#synaptic-tooltip').remove();
    };
  }, [buildGraph]);

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 'var(--radius-lg)',
        background: 'radial-gradient(ellipse at center, rgba(99,102,241,0.03) 0%, transparent 70%)',
      }}
    />
  );
}
