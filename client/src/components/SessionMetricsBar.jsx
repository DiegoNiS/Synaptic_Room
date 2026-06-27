import React from 'react';
import { Users, TrendingUp, AlertTriangle, Handshake, ShieldAlert, Clock, Activity } from 'lucide-react';

/**
 * SessionMetricsBar — Barra horizontal compacta de métricas clave.
 * Se actualiza en tiempo real sin recarga.
 */
export default function SessionMetricsBar({ stats, sessionStart }) {
  const elapsed = sessionStart ? Math.floor((Date.now() - sessionStart) / 1000) : 0;
  const hours = Math.floor(elapsed / 3600);
  const mins = Math.floor((elapsed % 3600) / 60);
  const secs = elapsed % 60;
  const timeStr = hours > 0
    ? `${hours}h ${mins}m`
    : `${mins}m ${secs.toString().padStart(2, '0')}s`;

  const metrics = [
    { icon: <Users size={15} />, label: 'Conectados', value: stats.total, color: '#6366f1' },
    { icon: <TrendingUp size={15} />, label: 'Avanzando', value: stats.flow, color: '#10b981', pct: stats.total ? Math.round((stats.flow / stats.total) * 100) : 0 },
    { icon: <AlertTriangle size={15} />, label: 'Asistencia', value: stats.blocked, color: '#ef4444', pct: stats.total ? Math.round((stats.blocked / stats.total) * 100) : 0 },
    { icon: <Handshake size={15} />, label: 'Colaborando', value: stats.mentoring, color: '#8b5cf6', pct: stats.total ? Math.round((stats.mentoring / stats.total) * 100) : 0 },
  ];

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '10px 20px',
      overflowX: 'auto',
      flexShrink: 0,
    }}>
      {metrics.map(m => (
        <div key={m.label} style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 14px',
          borderRadius: '10px',
          background: `${m.color}08`,
          border: `1px solid ${m.color}20`,
          flexShrink: 0,
          minWidth: '110px',
        }}>
          <div style={{ color: m.color, display: 'flex', alignItems: 'center' }}>{m.icon}</div>
          <div>
            <div style={{ fontSize: '1.15rem', fontWeight: '800', color: m.color, lineHeight: 1 }}>{m.value}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '1px' }}>{m.label}</div>
          </div>
          {m.pct !== undefined && m.pct > 0 && (
            <div style={{ fontSize: '0.7rem', color: m.color, fontWeight: '600', marginLeft: '4px' }}>{m.pct}%</div>
          )}
        </div>
      ))}

      {/* Fraud Alert */}
      {stats.fraude > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 14px',
          borderRadius: '10px',
          background: 'rgba(185,28,28,0.12)',
          border: '1px solid rgba(185,28,28,0.3)',
          flexShrink: 0,
          animation: 'pulse 2s infinite',
        }}>
          <ShieldAlert size={15} color="#b91c1c" />
          <div>
            <div style={{ fontSize: '1.15rem', fontWeight: '800', color: '#b91c1c', lineHeight: 1 }}>{stats.fraude}</div>
            <div style={{ fontSize: '0.68rem', color: '#ef4444' }}>Alertas</div>
          </div>
        </div>
      )}

      {/* Health */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 14px',
        borderRadius: '10px',
        background: stats.healthPercent >= 70 ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
        border: `1px solid ${stats.healthPercent >= 70 ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
        flexShrink: 0,
        marginLeft: 'auto',
      }}>
        <Activity size={15} color={stats.healthPercent >= 70 ? '#10b981' : '#f59e0b'} />
        <div>
          <div style={{ fontSize: '1.15rem', fontWeight: '800', color: stats.healthPercent >= 70 ? '#10b981' : '#f59e0b', lineHeight: 1 }}>{stats.healthPercent}%</div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Salud</div>
        </div>
      </div>

      {/* Duration */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 14px',
        borderRadius: '10px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--border-color)',
        flexShrink: 0,
      }}>
        <Clock size={14} color="var(--text-muted)" />
        <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono, monospace)' }}>{timeStr}</span>
      </div>
    </div>
  );
}
