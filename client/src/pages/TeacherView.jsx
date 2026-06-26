import React, { useState, useEffect, useRef } from 'react';
import NodeMap from '../components/NodeMap';
import { useSocket } from '../hooks/useSocket';
import { Wifi, WifiOff, Users, Zap, AlertTriangle, Heart, Activity } from 'lucide-react';

const EVENT_ICONS = {
  flow:       '⚡',
  blocked:    '🆘',
  mentoring:  '🤝',
  idle:       '💤',
  join:       '👋',
  leave:      '🚶',
  mentorship_start: '🧠',
  mentorship_end:   '✅',
};

/**
 * TeacherView — The teacher's command center dashboard.
 * Shows live D3.js network map, class statistics, and a real-time synapse event log.
 *
 * @param {Object} props
 * @param {string} props.sessionId
 * @param {string} props.teacherName
 */
export default function TeacherView({ sessionId, teacherName }) {
  const auth = {
    studentId: `teacher-${sessionId}`,
    sessionId,
    role: 'teacher',
    displayName: teacherName,
  };

  const { connected, socketError, nodeMap } = useSocket(auth);
  const [eventLog, setEventLog] = useState([]);
  const [mapSize, setMapSize] = useState({ width: 800, height: 520 });
  const mapContainerRef = useRef(null);
  const prevNodeMapRef = useRef(null);
  const logEndRef = useRef(null);

  // Detect node state changes and auto-log them
  useEffect(() => {
    if (!nodeMap?.nodes?.length) return;

    const prev = prevNodeMapRef.current;
    if (prev) {
      nodeMap.nodes.forEach(node => {
        const prevNode = prev.nodes?.find(n => n.studentId === node.studentId);
        if (!prevNode) {
          // New student joined
          addEvent({
            type: 'join',
            studentName: node.displayName,
            message: `${node.displayName} se unió a la sesión`,
          });
        } else if (prevNode.state !== node.state) {
          // State changed
          const msgs = {
            flow:      `${node.displayName} entró en estado de FLUJO ⚡`,
            blocked:   `${node.displayName} está BLOQUEADO — buscando mentor`,
            mentoring: `${node.displayName} está en MENTORÍA activa 🤝`,
            idle:      `${node.displayName} volvió al estado inactivo`,
            analyzing: `${node.displayName} siendo analizado por IA...`,
          };
          addEvent({
            type: node.state,
            studentName: node.displayName,
            message: msgs[node.state] || `${node.displayName}: ${node.state}`,
          });
        }
      });

      // Detect students who left
      prev.nodes?.forEach(prevNode => {
        if (!nodeMap.nodes.find(n => n.studentId === prevNode.studentId)) {
          addEvent({
            type: 'leave',
            studentName: prevNode.displayName,
            message: `${prevNode.displayName} abandonó la sesión`,
          });
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
    }, ...prev].slice(0, 80)); // keep last 80 events
  };

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [eventLog]);

  // Responsive map sizing
  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setMapSize({ width: Math.floor(width), height: Math.floor(height) });
      }
    });
    if (mapContainerRef.current) observer.observe(mapContainerRef.current);
    return () => observer.disconnect();
  }, []);

  // Compute class stats from nodeMap
  const stats = React.useMemo(() => {
    const nodes = nodeMap?.nodes || [];
    return {
      total:     nodes.length,
      flow:      nodes.filter(n => n.state === 'flow').length,
      blocked:   nodes.filter(n => n.state === 'blocked').length,
      mentoring: nodes.filter(n => n.state === 'mentoring').length,
      idle:      nodes.filter(n => n.state === 'idle' || n.state === 'analyzing').length,
    };
  }, [nodeMap]);

  const statCards = [
    { label: 'Estudiantes',    value: stats.total,     icon: <Users size={20} />,        color: '#6366f1' },
    { label: 'En Flujo',       value: stats.flow,      icon: <Zap size={20} />,          color: '#10b981' },
    { label: 'Bloqueados',     value: stats.blocked,   icon: <AlertTriangle size={20} />, color: '#ef4444' },
    { label: 'Mentorías',      value: stats.mentoring, icon: <Heart size={20} />,         color: '#8b5cf6' },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Topbar */}
      <header style={{
        height: '64px',
        padding: '0 24px',
        borderBottom: '1px solid var(--border-color)',
        background: 'rgba(8,10,16,0.95)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.4rem' }}>🧠</span>
          <div>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontWeight: '700',
              fontSize: '1.1rem',
              background: 'var(--grad-primary)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              Synaptic Room
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '-2px' }}>Tablero del Docente</div>
          </div>
        </div>

        <div style={{ width: '1px', height: '28px', background: 'var(--border-color)' }} />

        <div>
          <div style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-primary)' }}>{teacherName}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sesión: <strong>{sessionId}</strong></div>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Live indicator */}
          {connected && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
            }}>
              <span style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: '#ef4444',
                display: 'inline-block',
                animation: 'pulse-blocked 1.5s infinite',
              }} />
              <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#ef4444' }}>EN VIVO</span>
            </div>
          )}

          {/* Connection */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '5px 10px',
            borderRadius: 'var(--radius-full)',
            background: connected ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${connected ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
          }}>
            {connected
              ? <Wifi size={13} color="var(--color-flow)" />
              : <WifiOff size={13} color="var(--color-blocked)" />}
            <span style={{
              fontSize: '0.75rem',
              fontWeight: '600',
              color: connected ? 'var(--color-flow)' : 'var(--color-blocked)',
            }}>
              {connected ? 'Conectado' : 'Sin conexión'}
            </span>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {socketError && (
        <div style={{
          padding: '10px 24px',
          background: 'rgba(239,68,68,0.15)',
          borderBottom: '1px solid rgba(239,68,68,0.3)',
          color: 'var(--color-blocked)',
          fontSize: '0.85rem',
        }}>
          ⚠️ <strong>Error:</strong> {socketError}
        </div>
      )}

      {/* Stats Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
        padding: '20px 24px 0',
      }}>
        {statCards.map(card => (
          <div key={card.label} className="glass-panel" style={{
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: 'var(--radius-md)',
              background: `${card.color}15`,
              border: `1px solid ${card.color}30`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: card.color,
              flexShrink: 0,
            }}>
              {card.icon}
            </div>
            <div>
              <div style={{ fontSize: '1.8rem', fontWeight: '800', fontFamily: 'var(--font-display)', color: card.color, lineHeight: '1' }}>
                {card.value}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content: Network Map + Event Log */}
      <main style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 340px',
        gap: '20px',
        padding: '20px 24px 24px',
        minHeight: 0,
        overflow: 'hidden',
      }}>
        {/* Network Map */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={18} color="#6366f1" />
              <span style={{ fontWeight: '600', fontSize: '0.95rem' }}>Red Cognitiva en Vivo</span>
            </div>
            <div style={{ display: 'flex', gap: '14px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {[
                { color: '#10b981', label: 'Flujo' },
                { color: '#ef4444', label: 'Bloqueado' },
                { color: '#8b5cf6', label: 'Mentoría' },
                { color: '#6b7280', label: 'Inactivo' },
              ].map(l => (
                <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: l.color, display: 'inline-block', boxShadow: `0 0 6px ${l.color}` }} />
                  {l.label}
                </span>
              ))}
            </div>
          </div>

          {/* D3 Map Container */}
          <div
            ref={mapContainerRef}
            style={{ flex: 1, position: 'relative', overflow: 'hidden' }}
          >
            {!nodeMap?.nodes?.length ? (
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
                color: 'var(--text-muted)',
              }}>
                <div style={{ fontSize: '3rem' }}>🧠</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: '600' }}>
                  Esperando estudiantes...
                </div>
                <div style={{ fontSize: '0.85rem', textAlign: 'center', maxWidth: '280px', lineHeight: '1.5' }}>
                  Los nodos aparecerán aquí cuando los alumnos se unan a la sesión <strong>{sessionId}</strong>
                </div>
              </div>
            ) : (
              <NodeMap
                nodeMap={nodeMap}
                width={mapSize.width}
                height={mapSize.height}
              />
            )}
          </div>
        </div>

        {/* Event Log */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span style={{ fontSize: '1rem' }}>📡</span>
            <span style={{ fontWeight: '600', fontSize: '0.95rem' }}>Registro de Sinapsis</span>
          </div>
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}>
            {eventLog.length === 0 ? (
              <div style={{
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '0.85rem',
                paddingTop: '30px',
                lineHeight: '1.6',
              }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>📡</div>
                Sin eventos aún.<br />
                Los cambios de estado aparecerán aquí en tiempo real.
              </div>
            ) : (
              eventLog.map(event => (
                <div key={event.id} style={{
                  display: 'flex',
                  gap: '10px',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border-color)',
                  alignItems: 'flex-start',
                  animation: 'fadeIn 0.3s ease',
                }}>
                  <span style={{ fontSize: '1rem', flexShrink: 0 }}>
                    {EVENT_ICONS[event.type] || '🔵'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: '1.3', wordBreak: 'break-word' }}>
                      {event.message}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                      {event.timestamp.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        </div>
      </main>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 900px) {
          main { grid-template-columns: 1fr !important; grid-template-rows: 1fr auto !important; }
        }
        @media (max-width: 640px) {
          main > div:first-child { grid-column: 1; }
        }
      `}</style>
    </div>
  );
}
