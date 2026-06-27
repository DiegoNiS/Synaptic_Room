import React, { useRef, useEffect } from 'react';

const EVENT_ICONS = {
  flow: '🚀', blocked: '🆘', mentoring: '🤝', idle: '💤', fraude: '🚨',
  join: '👋', leave: '🚶', mentorship_start: '🧠', mentorship_end: '✅',
  analyzing: '🔍', teacher: '🍎',
};

const SEVERITY_COLORS = {
  fraude: '#b91c1c', blocked: '#ef4444', mentoring: '#8b5cf6',
  flow: '#10b981', join: '#3b82f6', leave: '#6b7280',
};

/**
 * ActivityFeed — Live event stream for the teacher.
 * Each event has a colored left border indicating severity.
 */
export default function ActivityFeed({ eventLog }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [eventLog]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px', borderBottom: '1px solid var(--border-color)',
        display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0,
      }}>
        <span style={{ fontSize: '1rem' }}>📋</span>
        <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>Actividad en Vivo</span>
        {eventLog.length > 0 && (
          <span style={{
            marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-muted)',
            background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '10px',
          }}>
            {eventLog.length}
          </span>
        )}
      </div>

      {/* Events */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '10px 12px',
        display: 'flex', flexDirection: 'column', gap: '6px',
      }}>
        {eventLog.length === 0 ? (
          <div style={{
            textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem',
            paddingTop: '40px', lineHeight: 1.6,
          }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>⏳</div>
            Esperando eventos.<br />
            Aquí verás en vivo todo lo que sucede en la clase.
          </div>
        ) : (
          eventLog.map(event => {
            const borderColor = SEVERITY_COLORS[event.type] || 'transparent';
            return (
              <div key={event.id} style={{
                display: 'flex', gap: '8px', padding: '8px 10px',
                borderRadius: '8px', background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border-color)', alignItems: 'flex-start',
                borderLeft: `3px solid ${borderColor}`,
                animation: 'fadeIn 0.3s ease',
              }}>
                <span style={{ fontSize: '0.9rem', flexShrink: 0, marginTop: '1px' }}>
                  {EVENT_ICONS[event.type] || '🔵'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '0.8rem', color: 'var(--text-primary)', lineHeight: 1.3,
                    wordBreak: 'break-word',
                    fontWeight: event.type === 'fraude' ? '600' : '400',
                  }}>
                    {event.message}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {event.timestamp.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
