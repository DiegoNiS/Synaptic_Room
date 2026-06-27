import React from 'react';
import { X, Brain, Clock, TrendingUp, AlertTriangle, Handshake, ShieldAlert } from 'lucide-react';

const STATE_LABELS = {
  flow: 'Avanzando Bien', blocked: 'Requiere Asistencia',
  mentoring: 'Ayudando a Compañero', idle: 'Sin Actividad',
  analyzing: 'Analizando', fraude: 'Alerta de Copia', teacher: 'Docente',
};

const STATE_COLORS = {
  flow: '#10b981', blocked: '#ef4444', mentoring: '#8b5cf6',
  idle: '#6b7280', analyzing: '#f59e0b', fraude: '#b91c1c', teacher: '#3b82f6',
};

/**
 * StudentDetailPanel — Slide-in panel showing detailed student info.
 * Opens when a node is clicked in the CognitiveMesh.
 */
export default function StudentDetailPanel({ student, eventLog, onClose }) {
  if (!student) return null;

  const color = STATE_COLORS[student.state] || '#6b7280';
  const label = STATE_LABELS[student.state] || student.state;
  const timeSecs = Math.floor((student.timeInState || 0) / 1000);
  const timeStr = timeSecs > 60 ? `${Math.floor(timeSecs / 60)}m ${timeSecs % 60}s` : `${timeSecs}s`;
  const initials = student.label
    ? student.label.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  // Derive stats from eventLog
  const studentEvents = eventLog.filter(e => e.studentName === student.label);
  const helpGiven = studentEvents.filter(e => e.type === 'mentoring' && e.message?.includes('ayudando')).length;
  const helpReceived = studentEvents.filter(e => e.type === 'blocked').length;

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, bottom: 0,
      width: '320px', background: 'rgba(8,10,16,0.97)',
      borderLeft: '1px solid var(--border-color)',
      backdropFilter: 'blur(16px)', zIndex: 20,
      display: 'flex', flexDirection: 'column',
      animation: 'slideInRight 0.25s ease',
      overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px', borderBottom: '1px solid var(--border-color)',
        display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        {/* Avatar */}
        <div style={{
          width: '42px', height: '42px', borderRadius: '50%',
          background: `${color}20`, border: `2px solid ${color}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.9rem', fontWeight: '800', color, flexShrink: 0,
        }}>
          {student.isRoot ? '🍎' : initials}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--text-primary)' }}>{student.label}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />
            <span style={{ fontSize: '0.78rem', fontWeight: '600', color }}>{label}</span>
          </div>
        </div>
        <button onClick={onClose} style={{
          background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)',
          borderRadius: '8px', padding: '6px', cursor: 'pointer', color: 'var(--text-muted)',
          display: 'flex',
        }}>
          <X size={16} />
        </button>
      </div>

      {/* Stats Grid */}
      <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <StatCard icon={<Clock size={14} />} label="En este estado" value={timeStr} color="var(--text-secondary)" />
        <StatCard icon={<Brain size={14} />} label="Certeza IA" value={student.confidence > 0 ? `${Math.round(student.confidence * 100)}%` : '—'} color="#6366f1" />
        <StatCard icon={<Handshake size={14} />} label="Ayudas dadas" value={helpGiven} color="#8b5cf6" />
        <StatCard icon={<TrendingUp size={14} />} label="Veces asistido" value={helpReceived} color="#ef4444" />
      </div>

      {/* AI Diagnosis */}
      {student.blockagePoint && (
        <div style={{ padding: '0 16px 16px' }}>
          <div style={{
            padding: '12px', borderRadius: '10px',
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          }}>
            <div style={{ fontSize: '0.7rem', fontWeight: '700', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <AlertTriangle size={12} /> Diagnóstico de la IA
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
              {student.blockagePoint}
            </div>
          </div>
        </div>
      )}

      {/* Fraud alert */}
      {student.state === 'fraude' && (
        <div style={{ padding: '0 16px 16px' }}>
          <div style={{
            padding: '12px', borderRadius: '10px',
            background: 'rgba(185,28,28,0.12)', border: '1px solid rgba(185,28,28,0.3)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#b91c1c', fontWeight: '700', fontSize: '0.82rem' }}>
              <ShieldAlert size={14} /> Posible Copia Detectada
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.4 }}>
              Se detectó que el alumno pegó contenido externo en su espacio de trabajo.
            </div>
          </div>
        </div>
      )}

      {/* Recent Events */}
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Eventos Recientes
        </div>
        {studentEvents.length === 0 ? (
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', padding: '8px 0' }}>
            Sin eventos registrados aún.
          </div>
        ) : (
          studentEvents.slice(0, 8).map(ev => (
            <div key={ev.id} style={{
              padding: '6px 8px', marginBottom: '4px', borderRadius: '6px',
              background: 'rgba(255,255,255,0.02)', fontSize: '0.78rem',
              color: 'var(--text-secondary)', display: 'flex', gap: '6px',
            }}>
              <span style={{ flexShrink: 0 }}>{ev.timestamp.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</span>
              <span style={{ wordBreak: 'break-word' }}>{ev.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div style={{
      padding: '10px 12px', borderRadius: '10px',
      background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', marginBottom: '4px' }}>
        {icon}
        <span style={{ fontSize: '0.68rem' }}>{label}</span>
      </div>
      <div style={{ fontSize: '1.1rem', fontWeight: '700', color }}>{value}</div>
    </div>
  );
}
