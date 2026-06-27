import React, { useState, useEffect, useRef, useMemo } from 'react';
import CognitiveMesh from '../components/CognitiveMesh';
import StudentDetailPanel from '../components/StudentDetailPanel';
import SessionMetricsBar from '../components/SessionMetricsBar';
import ActivityFeed from '../components/ActivityFeed';
import AISummary from '../components/AISummary';
import { useSocket } from '../hooks/useSocket';
import { Wifi, WifiOff } from 'lucide-react';

/**
 * TeacherView — Centro de Control del Docente (Synaptic Room)
 * Layout responsive de 1 sola página con:
 *   - Barra de métricas en vivo
 *   - Cognitive Mesh (D3.js con partículas)
 *   - Panel lateral de detalle de alumno
 *   - Feed de actividad + Resumen IA
 */
export default function TeacherView({ sessionId, teacherName }) {
  const auth = {
    studentId: `teacher-${sessionId}`,
    sessionId,
    role: 'teacher',
    displayName: teacherName,
  };

  const { connected, socketError, nodeMap, aiErrors } = useSocket(auth);
  const [eventLog, setEventLog] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [meshSize, setMeshSize] = useState({ width: 800, height: 520 });
  const [elapsedTick, setElapsedTick] = useState(0);
  const meshContainerRef = useRef(null);
  const prevNodeMapRef = useRef(null);

  // ── Detect state changes and log events ──
  useEffect(() => {
    if (!nodeMap?.nodes?.length) return;
    const prev = prevNodeMapRef.current;
    if (prev) {
      nodeMap.nodes.forEach(node => {
        if (node.isRoot) return; // Skip teacher node
        const prevNode = prev.nodes?.find(n => n.studentId === node.studentId);
        if (!prevNode) {
          addEvent({ type: 'join', studentName: node.displayName, message: `${node.displayName} se unió a la clase` });
        } else if (prevNode.state !== node.state) {
          const msgs = {
            flow:      `${node.displayName} está avanzando sin problemas 🚀`,
            blocked:   `${node.displayName} requiere asistencia — buscando compañero 🆘`,
            mentoring: `${node.displayName} está ayudando a un compañero 🤝`,
            idle:      `${node.displayName} se ha quedado sin actividad 💤`,
            analyzing: `IA analizando el trabajo de ${node.displayName}...`,
            fraude:    `¡ALERTA! Posible copia detectada en ${node.displayName} 🚨`,
          };
          addEvent({
            type: node.state,
            studentName: node.displayName,
            message: msgs[node.state] || `${node.displayName}: cambio de estado`,
          });
        }
      });
      prev.nodes?.forEach(prevNode => {
        if (prevNode.isRoot) return;
        if (!nodeMap.nodes.find(n => n.studentId === prevNode.studentId)) {
          addEvent({ type: 'leave', studentName: prevNode.displayName, message: `${prevNode.displayName} abandonó la sesión` });
        }
      });
    }
    prevNodeMapRef.current = nodeMap;
  }, [nodeMap]);

  const addEvent = (event) => {
    setEventLog(prev => [{
      ...event,
      id: Date.now() + Math.random(),
      timestamp: new Date(),
    }, ...prev].slice(0, 120));
  };

  // Responsive mesh sizing
  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setMeshSize({ width: Math.floor(width), height: Math.floor(height) });
      }
    });
    if (meshContainerRef.current) observer.observe(meshContainerRef.current);
    return () => observer.disconnect();
  }, []);

  // Tick the elapsed time display every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => setElapsedTick(t => t + 1), 10000);
    return () => clearInterval(interval);
  }, []);

  // ── Compute Stats ──
  const stats = useMemo(() => {
    const nodes = (nodeMap?.nodes || []).filter(n => !n.isRoot);
    const total = nodes.length;
    const flow = nodes.filter(n => n.state === 'flow').length;
    const blocked = nodes.filter(n => n.state === 'blocked').length;
    const mentoring = nodes.filter(n => n.state === 'mentoring').length;
    const fraude = nodes.filter(n => n.state === 'fraude').length;
    const idle = nodes.filter(n => n.state === 'idle' || n.state === 'analyzing').length;
    const healthPercent = total === 0 ? 0 : Math.round(((flow + mentoring) / total) * 100);
    return { total, flow, blocked, mentoring, fraude, idle, healthPercent, nodeMap };
  }, [nodeMap]);

  const handleNodeClick = (node) => {
    setSelectedNode(node?.isRoot ? null : node || null);
  };

  return (
    <div style={{ minHeight: '100vh', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── HEADER ── */}
      <header style={{
        height: '56px', padding: '0 20px',
        borderBottom: '1px solid var(--border-color)',
        background: 'rgba(8,10,16,0.96)', backdropFilter: 'blur(14px)',
        display: 'flex', alignItems: 'center', gap: '14px',
        position: 'sticky', top: 0, zIndex: 50, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.3rem' }}>🍎</span>
          <div>
            <div style={{
              fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '1rem',
              background: 'var(--grad-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>Synaptic Room</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '-2px' }}>Panel de Control Escolar</div>
          </div>
        </div>

        <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }} />

        <div>
          <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>{teacherName}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Clave: <strong>{sessionId}</strong></div>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {connected && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
            }}>
              <span style={{
                width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444',
                animation: 'pulse-blocked 1.5s infinite',
              }} />
              <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#ef4444' }}>CLASE EN VIVO</span>
            </div>
          )}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px',
            borderRadius: 'var(--radius-full)',
            background: connected ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${connected ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
          }}>
            {connected ? <Wifi size={12} color="var(--color-flow)" /> : <WifiOff size={12} color="var(--color-blocked)" />}
            <span style={{ fontSize: '0.7rem', fontWeight: '600', color: connected ? 'var(--color-flow)' : 'var(--color-blocked)' }}>
              {connected ? 'Conectado' : 'Sin conexión'}
            </span>
          </div>
        </div>
      </header>

      {/* ── ERROR BANNERS ── */}
      {socketError && (
        <div style={{ padding: '8px 20px', background: 'rgba(239,68,68,0.12)', borderBottom: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', fontSize: '0.82rem', flexShrink: 0 }}>
          ⚠️ <strong>Error de Red:</strong> {socketError}
        </div>
      )}
      {aiErrors && Object.keys(aiErrors).length > 0 && (
        <div style={{ padding: '8px 20px', background: 'rgba(245,158,11,0.1)', borderBottom: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b', fontSize: '0.82rem', flexShrink: 0 }}>
          ⚠️ <strong>Asistente IA Ocupado:</strong> El análisis detallado de algunos alumnos está demorando.
        </div>
      )}

      {/* ── METRICS BAR ── */}
      <SessionMetricsBar stats={stats} sessionStart={nodeMap?.createdAt} key={elapsedTick} />

      {/* ── MAIN CONTENT ── */}
      <main style={{
        flex: 1, display: 'grid',
        gridTemplateColumns: '1fr 300px',
        minHeight: 0, overflow: 'hidden',
      }}>
        {/* LEFT: Cognitive Mesh */}
        <div className="glass-panel" style={{
          margin: '0 0 0 20px', display: 'flex', flexDirection: 'column',
          overflow: 'hidden', position: 'relative', borderRadius: '12px 0 0 12px',
        }}>
          <div ref={meshContainerRef} style={{ flex: 1, overflow: 'hidden' }}>
            <CognitiveMesh
              nodeMap={nodeMap}
              width={meshSize.width}
              height={meshSize.height}
              onNodeClick={handleNodeClick}
              connected={connected}
            />
          </div>

          {/* Student Detail Panel (overlay inside mesh) */}
          {selectedNode && (
            <StudentDetailPanel
              student={selectedNode}
              eventLog={eventLog}
              onClose={() => setSelectedNode(null)}
            />
          )}
        </div>

        {/* RIGHT: Activity Feed + AI Summary */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          borderLeft: '1px solid var(--border-color)',
          background: 'rgba(8,10,16,0.5)',
          overflow: 'hidden',
        }}>
          {/* AI Summary */}
          <div style={{ padding: '12px 12px 0', flexShrink: 0 }}>
            <AISummary stats={stats} eventLog={eventLog} />
          </div>

          {/* Activity Feed */}
          <div style={{ flex: 1, overflow: 'hidden', marginTop: '8px' }}>
            <ActivityFeed eventLog={eventLog} />
          </div>
        </div>
      </main>

      {/* ── RESPONSIVE STYLES ── */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.6; } }

        @media (max-width: 1024px) {
          main { grid-template-columns: 1fr 260px !important; }
        }
        @media (max-width: 768px) {
          main { grid-template-columns: 1fr !important; grid-template-rows: 1fr auto !important; }
          main > div:first-child { margin: 0 !important; border-radius: 0 !important; }
          main > div:last-child { max-height: 240px; border-left: none !important; border-top: 1px solid var(--border-color); }
        }
        @media (max-width: 480px) {
          header { padding: 0 12px !important; gap: 8px !important; }
          header > div:nth-child(3) { display: none; }
        }
      `}</style>
    </div>
  );
}
