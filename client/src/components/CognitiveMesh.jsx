import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { Search, Maximize2, RotateCcw, Eye, EyeOff } from 'lucide-react';

const STATE_COLORS = {
  idle: '#6b7280', flow: '#10b981', blocked: '#ef4444',
  mentoring: '#8b5cf6', analyzing: '#f59e0b', fraude: '#b91c1c', teacher: '#3b82f6',
};

const STATE_LABELS = {
  flow: 'Avanzando Bien', blocked: 'Requiere Asistencia',
  mentoring: 'Ayudando a Compañero', idle: 'Sin Actividad',
  analyzing: 'Analizando', fraude: 'Alerta de Copia', teacher: 'Docente',
};

const NODE_R = 13;

/**
 * CognitiveMesh — Obsidian-inspired force-directed graph with particles.
 *
 * The simulation and SVG scaffolding are created ONCE and updated via D3 data
 * joins, so live `session:nodeMap` updates animate in place (positions/physics
 * are preserved) instead of tearing the whole graph down and re-settling it.
 */
export default function CognitiveMesh({ nodeMap, width = 800, height = 520, onNodeClick, connected = true }) {
  const svgRef = useRef(null);
  const simulationRef = useRef(null);
  const zoomRef = useRef(null);

  // Persistent scaffolding / selections kept across renders.
  const groupsRef = useRef(null);          // { link, glow, particle, node }
  const nodesByIdRef = useRef(new Map());  // id -> datum (preserves x/y/vx/vy)
  const nodeSelRef = useRef(null);
  const linkMainSelRef = useRef(null);
  const linkGlowSelRef = useRef(null);
  const particleSelRef = useRef(null);
  const mentorLinksRef = useRef([]);

  // Latest values read inside the persistent tick/handlers via refs.
  const animationsOnRef = useRef(true);
  const searchRef = useRef('');
  const dimsRef = useRef({ width, height });
  const onNodeClickRef = useRef(onNodeClick);

  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // all | blocked | mentoring | fraude
  const [animationsOn, setAnimationsOn] = useState(true);

  useEffect(() => { onNodeClickRef.current = onNodeClick; }, [onNodeClick]);
  useEffect(() => { animationsOnRef.current = animationsOn; }, [animationsOn]);
  useEffect(() => { searchRef.current = searchTerm; }, [searchTerm]);

  const hasNodes = Boolean(nodeMap?.nodes?.length);

  // Accessible textual summary of the graph for screen readers.
  const ariaSummary = useMemo(() => {
    const ns = (nodeMap?.nodes || []).filter((n) => !n.isRoot);
    const count = (s) => ns.filter((n) => n.state === s).length;
    return `Red cognitiva del aula: ${ns.length} estudiantes — ${count('flow')} avanzando, ` +
      `${count('blocked')} requieren asistencia, ${count('mentoring')} colaborando.`;
  }, [nodeMap]);

  // ── ONE-TIME scaffolding: defs, zoom, groups, simulation, tick, tooltip ──
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const defs = svg.append('defs');
    Object.entries(STATE_COLORS).forEach(([state, color]) => {
      const filter = defs.append('filter').attr('id', `glow-${state}`)
        .attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
      filter.append('feGaussianBlur').attr('stdDeviation', state === 'teacher' ? 7 : 4).attr('result', 'blur');
      const merge = filter.append('feMerge');
      merge.append('feMergeNode').attr('in', 'blur');
      merge.append('feMergeNode').attr('in', 'SourceGraphic');
    });
    const radGrad = defs.append('radialGradient').attr('id', 'mesh-bg');
    radGrad.append('stop').attr('offset', '0%').attr('stop-color', 'rgba(99,102,241,0.04)');
    radGrad.append('stop').attr('offset', '100%').attr('stop-color', 'transparent');

    svg.append('style').text(`
      @keyframes energyFlow { from { stroke-dashoffset: 20; } to { stroke-dashoffset: 0; } }
      .link-energy { animation: energyFlow 1s linear infinite; }
      @keyframes breathe { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
      .node-breathe { animation: breathe 3s ease-in-out infinite; }
    `);

    svg.append('rect').attr('class', 'bg').attr('width', dimsRef.current.width).attr('height', dimsRef.current.height).attr('fill', 'url(#mesh-bg)');

    const g = svg.append('g');
    groupsRef.current = {
      glow: g.append('g').attr('class', 'glow-links'),
      link: g.append('g').attr('class', 'links'),
      particle: g.append('g').attr('class', 'particles'),
      node: g.append('g').attr('class', 'nodes'),
    };

    const zoom = d3.zoom().scaleExtent([0.2, 5]).on('zoom', (e) => g.attr('transform', e.transform));
    svg.call(zoom);
    zoomRef.current = zoom;
    svg.on('click', () => onNodeClickRef.current && onNodeClickRef.current(null));

    const { width: w, height: h } = dimsRef.current;
    const simulation = d3.forceSimulation([])
      .force('link', d3.forceLink([]).id((d) => d.id).distance((d) => {
        if (d.type === 'gravity') {
          if (d.source.state === 'flow') return 100;
          if (d.source.state === 'blocked' || d.source.state === 'fraude') return 260;
          return 160;
        }
        return 70;
      }).strength((d) => (d.type === 'gravity' ? 0.04 : 0.9)))
      .force('charge', d3.forceManyBody().strength((d) => (d.isRoot ? -700 : -200)))
      .force('center', d3.forceCenter(w / 2, h / 2))
      .force('collide', d3.forceCollide((d) => (d.isRoot ? 45 : NODE_R + 22)).iterations(2))
      .alphaDecay(0.02);
    simulationRef.current = simulation;

    // Tooltip (singleton)
    let tooltip = d3.select('#synaptic-tooltip');
    if (tooltip.empty()) {
      tooltip = d3.select('body').append('div').attr('id', 'synaptic-tooltip')
        .style('position', 'fixed').style('background', 'rgba(8,10,16,0.96)')
        .style('border', '1px solid rgba(255,255,255,0.12)').style('border-radius', '10px')
        .style('padding', '12px 16px').style('font-family', 'Inter, sans-serif').style('font-size', '13px')
        .style('color', '#f3f4f6').style('pointer-events', 'none').style('opacity', 0).style('z-index', 9999)
        .style('box-shadow', '0 12px 30px -6px rgba(0,0,0,0.6)').style('max-width', '280px').style('backdrop-filter', 'blur(12px)');
    }

    simulation.on('tick', () => {
      const { width: cw, height: ch } = dimsRef.current;
      const clampX = (x) => Math.max(NODE_R, Math.min(cw - NODE_R, x));
      const clampY = (y) => Math.max(NODE_R, Math.min(ch - NODE_R, y));

      const setEnds = (sel) => sel
        .attr('x1', (d) => d.source?.x).attr('y1', (d) => d.source?.y)
        .attr('x2', (d) => d.target?.x).attr('y2', (d) => d.target?.y);
      if (linkGlowSelRef.current) setEnds(linkGlowSelRef.current);
      if (linkMainSelRef.current) setEnds(linkMainSelRef.current);

      if (animationsOnRef.current && particleSelRef.current) {
        const mentorLinks = mentorLinksRef.current;
        particleSelRef.current.each(function (p) {
          p.t += p.speed;
          if (p.t >= 1) p.t = 0;
          const link = mentorLinks[p.linkIndex];
          if (link?.source?.x != null && link?.target?.x != null) {
            const x = link.source.x + (link.target.x - link.source.x) * p.t;
            const y = link.source.y + (link.target.y - link.source.y) * p.t;
            d3.select(this).attr('cx', x).attr('cy', y);
          }
        });
      }

      if (nodeSelRef.current) {
        nodeSelRef.current.attr('transform', (d) => {
          d.x = clampX(d.x); d.y = clampY(d.y);
          return `translate(${d.x},${d.y})`;
        });
      }
    });

    return () => {
      simulation.stop();
      d3.select('#synaptic-tooltip').remove();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── DATA UPDATE: join nodes/links, preserve positions, gentle restart ──
  useEffect(() => {
    const simulation = simulationRef.current;
    const groups = groupsRef.current;
    if (!simulation || !groups || !hasNodes) {
      if (simulation && !hasNodes) { simulation.nodes([]); nodeSelRef.current = null; }
      return;
    }

    const incoming = nodeMap.nodes
      .map((n) => ({
        id: n.studentId, label: n.displayName, state: n.state || 'idle',
        confidence: n.confidence || 0, connections: n.connections || [],
        isRoot: n.isRoot || false, blockagePoint: n.blockagePoint || null, timeInState: n.timeInState || 0,
      }))
      .filter((n) => (activeFilter === 'all' ? true : n.isRoot || n.state === activeFilter));

    // Reuse existing datum objects to keep x/y/vx/vy; create fresh for new ids.
    const prevById = nodesByIdRef.current;
    const nodes = incoming.map((n) => {
      const existing = prevById.get(n.id);
      if (existing) { Object.assign(existing, n); return existing; }
      return { ...n };
    });
    nodesByIdRef.current = new Map(nodes.map((d) => [d.id, d]));

    // Build links (mentorship pairs + gentle gravity toward teacher root).
    const present = new Set(nodes.map((n) => n.id));
    const rootNode = nodes.find((n) => n.isRoot);
    const links = [];
    const seen = new Set();
    nodes.forEach((node) => {
      if (node.connections.length) {
        nodes.forEach((other) => {
          if (other.id !== node.id && other.connections.some((c) => node.connections.includes(c))) {
            const key = [node.id, other.id].sort().join('-');
            if (!seen.has(key)) { seen.add(key); links.push({ source: node.id, target: other.id, type: 'mentorship' }); }
          }
        });
      }
      if (rootNode && !node.isRoot) links.push({ source: node.id, target: rootNode.id, type: 'gravity' });
    });
    const mentorLinks = links.filter((l) => l.type === 'mentorship' && present.has(l.source) && present.has(l.target));

    const drag = d3.drag()
      .on('start', (e, d) => { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
      .on('end', (e, d) => { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; });

    // NODE join
    const nodeSel = groups.node.selectAll('g.node')
      .data(nodes, (d) => d.id)
      .join(
        (enter) => {
          const gE = enter.append('g').attr('class', 'node').style('cursor', 'pointer').call(drag);
          gE.append('circle').attr('class', 'glow-ring').attr('fill', 'none');
          gE.append('circle').attr('class', 'core').attr('stroke', '#080a10').attr('stroke-width', 2);
          gE.filter((d) => d.isRoot).append('text').attr('class', 'emoji')
            .attr('text-anchor', 'middle').attr('dy', '6px').attr('font-size', '18px').text('🍎');
          gE.append('text').attr('class', 'label').attr('text-anchor', 'middle')
            .attr('font-family', 'Inter, sans-serif');
          gE.on('click', (event, d) => { event.stopPropagation(); onNodeClickRef.current && onNodeClickRef.current(d); })
            .on('mouseover', showTooltip)
            .on('mousemove', (e) => d3.select('#synaptic-tooltip').style('left', (e.clientX + 16) + 'px').style('top', (e.clientY - 16) + 'px'))
            .on('mouseleave', () => d3.select('#synaptic-tooltip').style('opacity', 0));
          return gE;
        },
        (update) => update,
        (exit) => exit.remove()
      );
    nodeSelRef.current = nodeSel;

    // Update visual attrs on enter+update
    nodeSel.select('circle.glow-ring')
      .attr('r', (d) => (d.isRoot ? NODE_R * 2.5 : NODE_R + 7))
      .attr('stroke', (d) => STATE_COLORS[d.state] || '#6b7280')
      .attr('stroke-width', (d) => (d.isRoot ? 2 : 1)).attr('stroke-opacity', 0.4)
      .attr('filter', (d) => `url(#glow-${d.state})`);
    nodeSel.select('circle.core')
      .attr('r', (d) => (d.isRoot ? NODE_R * 2 : NODE_R))
      .attr('fill', (d) => STATE_COLORS[d.state] || '#6b7280')
      .attr('filter', (d) => `url(#glow-${d.state})`);
    nodeSel.select('text.label')
      .attr('dy', (d) => (d.isRoot ? `${NODE_R * 2 + 20}px` : `${NODE_R + 20}px`))
      .attr('font-size', (d) => (d.isRoot ? '12px' : '10px'))
      .attr('font-weight', (d) => (d.isRoot ? '700' : '500'))
      .text((d) => d.label);

    // LINK joins (glow + main)
    const linkKey = (d) => `${typeof d.source === 'object' ? d.source.id : d.source}-${typeof d.target === 'object' ? d.target.id : d.target}`;
    linkGlowSelRef.current = groups.glow.selectAll('line').data(mentorLinks, linkKey)
      .join('line').attr('stroke', 'rgba(139,92,246,0.15)').attr('stroke-width', 8);
    linkMainSelRef.current = groups.link.selectAll('line').data(mentorLinks, linkKey)
      .join('line').attr('stroke', 'rgba(139,92,246,0.5)').attr('stroke-width', 2).attr('stroke-dasharray', '6 6');
    mentorLinksRef.current = mentorLinks;

    // PARTICLES (rebuilt when mentorship set changes)
    const particles = [];
    mentorLinks.forEach((_, i) => { for (let p = 0; p < 3; p++) particles.push({ linkIndex: i, t: p / 3, speed: 0.008 + (i + p) % 5 * 0.001 }); });
    particleSelRef.current = groups.particle.selectAll('circle').data(particles)
      .join('circle').attr('r', 2.5).attr('fill', '#a78bfa').attr('opacity', 0.85).attr('filter', 'url(#glow-mentoring)');

    // Feed the simulation and nudge it (no full restart → no jitter).
    simulation.nodes(nodes);
    simulation.force('link').links(links);
    simulation.alpha(Math.min(0.5, simulation.alpha() + 0.3)).restart();

    applyDecorations();
  }, [nodeMap, activeFilter, hasNodes]); // eslint-disable-line react-hooks/exhaustive-deps

  // Decorations that must not trigger a physics rebuild.
  function applyDecorations() {
    const nodeSel = nodeSelRef.current;
    if (!nodeSel) return;
    const q = searchRef.current.toLowerCase();
    nodeSel.select('circle.glow-ring').classed('node-breathe', () => animationsOnRef.current);
    nodeSel.select('circle.core')
      .attr('stroke', (d) => (q && !d.isRoot && d.label.toLowerCase().includes(q) ? '#fbbf24' : '#080a10'))
      .attr('stroke-width', (d) => (q && !d.isRoot && d.label.toLowerCase().includes(q) ? 3 : 2));
    nodeSel.select('text.label').attr('fill', (d) => {
      if (q && d.label.toLowerCase().includes(q)) return '#fbbf24';
      return d.isRoot ? '#fff' : '#d1d5db';
    });
    if (linkMainSelRef.current) linkMainSelRef.current.classed('link-energy', () => animationsOnRef.current);
  }

  // Search + animations toggle → cheap restyle only.
  useEffect(() => { applyDecorations(); }, [searchTerm, animationsOn]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resize → update bg + center force.
  useEffect(() => {
    dimsRef.current = { width, height };
    if (svgRef.current) d3.select(svgRef.current).select('rect.bg').attr('width', width).attr('height', height);
    const sim = simulationRef.current;
    if (sim) { sim.force('center', d3.forceCenter(width / 2, height / 2)); sim.alpha(0.2).restart(); }
  }, [width, height]);

  function showTooltip(_event, d) {
    const tooltip = d3.select('#synaptic-tooltip');
    const stateLabel = STATE_LABELS[d.state] || d.state;
    const color = STATE_COLORS[d.state] || '#6b7280';
    const timeSecs = Math.floor((d.timeInState || 0) / 1000);
    const timeStr = timeSecs > 60 ? `${Math.floor(timeSecs / 60)}m ${timeSecs % 60}s` : `${timeSecs}s`;
    let html = `<div style="font-weight:800; font-size:14px; margin-bottom:5px">${d.label}</div>
      <div style="color:${color}; font-weight:600; display:flex; align-items:center; gap:6px; margin-bottom:4px">
        <span style="width:8px; height:8px; border-radius:50%; background:${color}; box-shadow:0 0 8px ${color}"></span>${stateLabel}</div>`;
    if (!d.isRoot) {
      html += `<div style="color:#9ca3af; font-size:11px">En este estado: ${timeStr}</div>`;
      if (d.confidence > 0) html += `<div style="color:#6b7280; font-size:11px">Certeza IA: ${Math.round(d.confidence * 100)}%</div>`;
    }
    if (d.blockagePoint) {
      html += `<div style="margin-top:8px; background:rgba(0,0,0,0.5); padding:8px 10px; border-radius:6px; font-size:12px; border-left:3px solid #ef4444; line-height:1.4">
        <strong style="color:#ef4444; display:block; margin-bottom:3px; font-size:10px; text-transform:uppercase">Diagnóstico IA</strong>${d.blockagePoint}</div>`;
    }
    tooltip.style('opacity', 1).html(html);
  }

  const centerGraph = () => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current).transition().duration(500).call(zoomRef.current.transform, d3.zoomIdentity);
    }
  };
  const restartSimulation = () => { if (simulationRef.current) simulationRef.current.alpha(0.8).restart(); };

  const filters = [
    { key: 'all', label: 'Todos' }, { key: 'blocked', label: 'Asistencia' },
    { key: 'mentoring', label: 'Colaborando' }, { key: 'fraude', label: 'Alertas' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
      {/* Toolbar */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-sm)', padding: '5px 10px', border: '1px solid var(--border-color)', flex: '1 1 140px', maxWidth: '220px' }}>
          <Search size={13} color="var(--text-muted)" />
          <input type="text" placeholder="Buscar alumno..." aria-label="Buscar alumno en la red"
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '0.78rem', width: '100%' }} />
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {filters.map((f) => (
            <button key={f.key} onClick={() => setActiveFilter(f.key)} aria-pressed={activeFilter === f.key} style={{
              padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontSize: '0.72rem', fontWeight: '600',
              background: activeFilter === f.key ? 'rgba(99,102,241,0.15)' : 'transparent',
              border: activeFilter === f.key ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
              color: activeFilter === f.key ? '#818cf8' : 'var(--text-muted)', cursor: 'pointer', transition: 'all var(--transition-fast)',
            }}>{f.label}</button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
          <ToolbarBtn icon={<Maximize2 size={13} />} title="Centrar" onClick={centerGraph} />
          <ToolbarBtn icon={<RotateCcw size={13} />} title="Redistribuir" onClick={restartSimulation} />
          <ToolbarBtn icon={animationsOn ? <Eye size={13} /> : <EyeOff size={13} />} title={animationsOn ? 'Desactivar animaciones' : 'Activar animaciones'} onClick={() => setAnimationsOn((v) => !v)} />
        </div>
      </div>

      {/* Legend */}
      <div style={{ padding: '6px 14px', display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '0.7rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
        {[{ c: '#10b981', l: 'Bien' }, { c: '#ef4444', l: 'Asistencia' }, { c: '#8b5cf6', l: 'Ayudando' }, { c: '#6b7280', l: 'Inactivo' }, { c: '#b91c1c', l: 'Copia' }, { c: '#3b82f6', l: 'Docente' }].map((i) => (
          <span key={i.l} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: i.c, boxShadow: `0 0 5px ${i.c}` }} />{i.l}
          </span>
        ))}
      </div>

      {/* SVG Canvas — always mounted so the simulation persists; overlay states on top */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <svg ref={svgRef} width={width} height={height} role="img" aria-label={ariaSummary} style={{
          width: '100%', height: '100%', cursor: 'grab',
          background: 'radial-gradient(ellipse at center, rgba(99,102,241,0.02) 0%, transparent 70%)',
          opacity: hasNodes ? 1 : 0,
        }} />
        {!hasNodes && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', color: 'var(--text-muted)' }}>
            {!connected ? (
              <>
                <div style={{ fontSize: '2.4rem' }}>🔌</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: '600' }}>Conectando al aula…</div>
                <div style={{ fontSize: '0.82rem' }}>Estableciendo conexión en tiempo real</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '3rem' }}>🏫</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: '600' }}>El salón está vacío</div>
                <div style={{ fontSize: '0.82rem', textAlign: 'center', maxWidth: '280px', lineHeight: 1.5 }}>
                  Pide a tus alumnos que ingresen la clave <strong>{nodeMap?.sessionId || '—'}</strong>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ToolbarBtn({ icon, title, onClick }) {
  return (
    <button onClick={onClick} title={title} aria-label={title} style={{
      padding: '5px', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.04)',
      border: '1px solid var(--border-color)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', transition: 'all var(--transition-fast)',
    }}>{icon}</button>
  );
}
