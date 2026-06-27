import React, { useCallback } from 'react';
import Canvas from '../components/Canvas';
import StatusBadge from '../components/StatusBadge';
import MentorPanel from '../components/MentorPanel';
import { useSocket } from '../hooks/useSocket';
import { Wifi, WifiOff, Brain, Zap } from 'lucide-react';

/**
 * StudentView — Workspace del estudiante.
 * Panel de problemas + pizarra interactiva con cajas de texto para métricas.
 */
export default function StudentView({ studentId, sessionId, displayName }) {
  const auth = { studentId, sessionId, role: 'student', displayName };
  const {
    connected,
    socketError,
    cognitiveState,
    activeMentorship,
    chatMessages,
    incomingStrokes,
    aiError,
    sendTrace,
    sendChatMessage,
    sendDraw,
    closeMentorship,
  } = useSocket(auth);

  const handleTrace = useCallback((metrics) => {
    sendTrace(metrics);
  }, [sendTrace]);

  const stateColors = {
    flow:      'var(--color-flow)',
    blocked:   'var(--color-blocked)',
    mentoring: 'var(--color-mentorship)',
    idle:      'var(--text-muted)',
    analyzing: '#f59e0b',
  };

  const initials = displayName
    ? displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-deep)' }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header style={{
        height: '58px',
        padding: '0 20px',
        borderBottom: '1px solid var(--border-color)',
        background: 'rgba(8,10,16,0.97)',
        backdropFilter: 'blur(14px)',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        flexShrink: 0,
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <span style={{ fontSize: '1.25rem' }}>🧠</span>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontWeight: '800',
            fontSize: '1rem',
            background: 'var(--grad-primary)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.01em',
          }}>
            Synaptic Room
          </span>
        </div>

        <div style={{ width: '1px', height: '24px', background: 'var(--border-color)', flexShrink: 0 }} />

        {/* Avatar + identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flexShrink: 0 }}>
          <div style={{
            width: '30px',
            height: '30px',
            borderRadius: '50%',
            background: 'var(--grad-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.75rem',
            fontWeight: '700',
            color: '#fff',
            flexShrink: 0,
            boxShadow: 'var(--shadow-glow)',
          }}>
            {initials}
          </div>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>{displayName}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Sesión {sessionId}</div>
          </div>
        </div>

        {/* Right side */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>

          {/* AI state chip */}
          {cognitiveState.state !== 'idle' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 10px',
              borderRadius: 'var(--radius-full)',
              background: `${stateColors[cognitiveState.state]}12`,
              border: `1px solid ${stateColors[cognitiveState.state]}35`,
            }}>
              <Brain size={12} color={stateColors[cognitiveState.state]} />
              <span style={{ fontSize: '0.75rem', fontWeight: '700', color: stateColors[cognitiveState.state] }}>
                IA {Math.round(cognitiveState.confidence * 100)}%
              </span>
            </div>
          )}

          <StatusBadge state={cognitiveState.state} />

          {/* Connection */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '4px 10px',
            borderRadius: 'var(--radius-full)',
            background: connected ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${connected ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
          }}>
            {connected
              ? <Wifi size={12} color="var(--color-flow)" />
              : <WifiOff size={12} color="var(--color-blocked)" />}
            <span style={{
              fontSize: '0.72rem',
              fontWeight: '600',
              color: connected ? 'var(--color-flow)' : 'var(--color-blocked)',
            }}>
              {connected ? 'En vivo' : 'Sin conexión'}
            </span>
          </div>
        </div>
      </header>

      {/* ── Banners ── */}
      {socketError && (
        <div style={{
          padding: '10px 24px',
          background: 'rgba(239,68,68,0.15)',
          borderBottom: '1px solid rgba(239,68,68,0.3)',
          color: 'var(--color-blocked)',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span>⚠️</span>
          <span><strong>Error de conexión:</strong> {socketError}. Reintentando...</span>
        </div>
      )}

      {/* AI Error Warning Card */}
      {aiError && (
        <div style={{
          margin: '12px 24px 0',
          padding: '12px 16px',
          background: 'rgba(245,158,11,0.12)',
          border: '1px solid rgba(245,158,11,0.35)',
          borderRadius: 'var(--radius-md)',
          color: '#f59e0b',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          animation: 'fadeIn 0.3s ease',
        }}>
          <span style={{ fontSize: '1.2rem' }}>⚠️</span>
          <div>
            <strong>Aviso del Servidor de IA:</strong> {aiError}. El análisis en tiempo real está degradado y tu estado permanecerá inactivo temporalmente.
          </div>
        </div>
      )}

      {cognitiveState.state === 'blocked' && !activeMentorship && (
        <div style={{
          padding: '10px 20px',
          background: 'rgba(239,68,68,0.1)',
          borderBottom: '1px solid rgba(239,68,68,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          animation: 'pulse-blocked 2s infinite ease-in-out',
          flexShrink: 0,
        }}>
          <Zap size={16} color="var(--color-blocked)" />
          <div>
            <strong style={{ color: 'var(--color-blocked)', fontSize: '0.88rem' }}>
              Bloqueo detectado por IA
            </strong>
            {cognitiveState.blockagePoint && (
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginLeft: '8px' }}>
                — {cognitiveState.blockagePoint}
              </span>
            )}
          </div>
          <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Buscando mentor disponible...
          </span>
        </div>
      )}

      {cognitiveState.state === 'flow' && (
        <div style={{
          padding: '9px 20px',
          background: 'rgba(16,185,129,0.07)',
          borderBottom: '1px solid rgba(16,185,129,0.18)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexShrink: 0,
        }}>
          <Zap size={14} color="var(--color-flow)" />
          <span style={{ color: 'var(--color-flow)', fontSize: '0.82rem', fontWeight: '600' }}>
            ¡Excelente ritmo! La IA detecta que estás en estado de flujo cognitivo.
          </span>
        </div>
      )}

      {/* ── Main workspace ───────────────────────────────────────────────── */}
      {/* Rendered only when NOT mentoring, so exactly one Canvas (and one
          keystroke tracker) is ever mounted at a time. */}
      {!activeMentorship && (
        <main style={{
          flex: 1,
          padding: '16px 20px 20px',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
        }}>
          <Canvas onTrace={handleTrace} disabled={false} />
        </main>
      )}

      {/* ── Mentorship overlay ───────────────────────────────────────────── */}
      {activeMentorship && (
        <MentorPanel
          mentorship={activeMentorship}
          chatMessages={chatMessages}
          onSendMessage={sendChatMessage}
          onClose={closeMentorship}
          studentId={auth.studentId}
          displayName={displayName}
          workspaceContent={
            <Canvas
              onTrace={activeMentorship.role === 'mentee' ? handleTrace : () => {}}
              disabled={activeMentorship.role === 'mentor'}
              onDrawEvent={sendDraw}
              incomingStrokes={incomingStrokes}
            />
          }
        />
      )}
    </div>
  );
}
