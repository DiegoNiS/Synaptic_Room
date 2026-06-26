import React, { useCallback } from 'react';
import Canvas from '../components/Canvas';
import StatusBadge from '../components/StatusBadge';
import MentorPanel from '../components/MentorPanel';
import { useSocket } from '../hooks/useSocket';
import { Wifi, WifiOff, Brain, Zap } from 'lucide-react';

/**
 * StudentView — The main workspace for a student.
 * Shows the Canvas + tracker, current cognitive state, and overlays MentorPanel during mentorships.
 *
 * @param {Object} props
 * @param {string} props.studentId
 * @param {string} props.sessionId
 * @param {string} props.displayName
 */
export default function StudentView({ studentId, sessionId, displayName }) {
  const auth = { studentId, sessionId, role: 'student', displayName };
  const {
    connected,
    socketError,
    cognitiveState,
    activeMentorship,
    chatMessages,
    sendTrace,
    sendChatMessage,
    closeMentorship,
  } = useSocket(auth);

  // Trace callback passed to the Canvas/Tracker combo
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
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.4rem' }}>🧠</span>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontWeight: '700',
            fontSize: '1.1rem',
            background: 'var(--grad-primary)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            Synaptic Room
          </span>
        </div>

        <div style={{ width: '1px', height: '28px', background: 'var(--border-color)' }} />

        {/* Student Identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'var(--grad-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.85rem',
            fontWeight: '700',
            color: '#fff',
          }}>
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-primary)' }}>{displayName}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sesión: {sessionId}</div>
          </div>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* AI Cognitive State */}
          {cognitiveState.state !== 'idle' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: 'var(--radius-full)',
              background: `${stateColors[cognitiveState.state]}15`,
              border: `1px solid ${stateColors[cognitiveState.state]}40`,
            }}>
              <Brain size={14} color={stateColors[cognitiveState.state]} />
              <span style={{ fontSize: '0.8rem', fontWeight: '600', color: stateColors[cognitiveState.state] }}>
                IA: {Math.round(cognitiveState.confidence * 100)}%
              </span>
            </div>
          )}

          {/* Status Badge */}
          <StatusBadge state={cognitiveState.state} />

          {/* Connection indicator */}
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
              {connected ? 'En vivo' : 'Desconectado'}
            </span>
          </div>
        </div>
      </header>

      {/* Socket Error Banner */}
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

      {/* Cognitive Blockage Alert Banner */}
      {cognitiveState.state === 'blocked' && !activeMentorship && (
        <div style={{
          padding: '12px 24px',
          background: 'rgba(239,68,68,0.12)',
          borderBottom: '1px solid rgba(239,68,68,0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          animation: 'pulse-blocked 2s infinite ease-in-out',
        }}>
          <Zap size={18} color="var(--color-blocked)" />
          <div>
            <strong style={{ color: 'var(--color-blocked)', fontSize: '0.9rem' }}>
              Bloqueo detectado por IA
            </strong>
            {cognitiveState.blockagePoint && (
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginLeft: '8px' }}>
                — {cognitiveState.blockagePoint}
              </span>
            )}
          </div>
          <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Buscando mentor disponible...
          </span>
        </div>
      )}

      {/* Flow State Positive Banner */}
      {cognitiveState.state === 'flow' && (
        <div style={{
          padding: '10px 24px',
          background: 'rgba(16,185,129,0.08)',
          borderBottom: '1px solid rgba(16,185,129,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <Zap size={16} color="var(--color-flow)" />
          <span style={{ color: 'var(--color-flow)', fontSize: '0.85rem', fontWeight: '600' }}>
            ¡Excelente ritmo! La IA detecta que estás en estado de flujo cognitivo.
          </span>
        </div>
      )}

      {/* Main Workspace */}
      <main style={{
        flex: 1,
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        minHeight: 0,
      }}>
        <Canvas
          onTrace={handleTrace}
          disabled={false}
        />
      </main>

      {/* Mentorship Overlay — shown when active */}
      {activeMentorship && (
        <MentorPanel
          mentorship={activeMentorship}
          chatMessages={chatMessages}
          onSendMessage={sendChatMessage}
          onClose={closeMentorship}
          studentId={studentId}
          displayName={displayName}
          workspaceContent={
            <Canvas
              onTrace={activeMentorship.role === 'mentee' ? handleTrace : () => {}}
              disabled={activeMentorship.role === 'mentor'}
              initialText={''}
            />
          }
        />
      )}
    </div>
  );
}
