import React from 'react';
import { Brain } from 'lucide-react';

/**
 * AISummary — Resumen inteligente auto-generado.
 * Calcula un texto descriptivo desde los datos en vivo sin llamar a ninguna API.
 */
export default function AISummary({ stats, eventLog }) {
  const mentorshipStarts = eventLog.filter(e => e.type === 'mentoring' || e.type === 'mentorship_start').length;
  const blockedEvents = eventLog.filter(e => e.type === 'blocked').length;
  const fraudEvents = eventLog.filter(e => e.type === 'fraude').length;
  const resolvedPeerCount = Math.min(mentorshipStarts, blockedEvents);

  // Build contextual sentences
  const sentences = [];

  if (stats.total === 0) {
    sentences.push('Esperando a que los alumnos se conecten.');
  } else {
    if (blockedEvents > 0) {
      sentences.push(`Se detectaron **${blockedEvents}** bloqueos conceptuales.`);
      if (resolvedPeerCount > 0) {
        sentences.push(`**${resolvedPeerCount}** fueron asistidos mediante colaboración entre compañeros.`);
      }
    }

    if (stats.flow > 0) {
      sentences.push(`**${stats.flow}** alumno${stats.flow > 1 ? 's' : ''} avanza${stats.flow > 1 ? 'n' : ''} sin dificultades.`);
    }

    if (stats.fraude > 0) {
      sentences.push(`⚠️ Se detectaron **${stats.fraude}** alerta${stats.fraude > 1 ? 's' : ''} de posible copia.`);
    }

    const isolatedCount = (stats.nodeMap?.nodes || []).filter(
      n => !n.isRoot && n.state === 'idle' && (n.timeInState || 0) > 120000
    ).length;
    if (isolatedCount > 0) {
      sentences.push(`**${isolatedCount}** alumno${isolatedCount > 1 ? 's' : ''} lleva${isolatedCount > 1 ? 'n' : ''} más de 2 min sin actividad.`);
    }

    if (sentences.length === 0) {
      sentences.push('La clase está transcurriendo sin incidentes.');
    }
  }

  const summaryText = sentences.join(' ');

  return (
    <div style={{
      padding: '14px 16px',
      background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.06) 100%)',
      border: '1px solid rgba(99,102,241,0.15)',
      borderRadius: '10px',
      display: 'flex',
      gap: '10px',
      alignItems: 'flex-start',
    }}>
      <div style={{
        width: '28px', height: '28px', borderRadius: '8px',
        background: 'rgba(99,102,241,0.15)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Brain size={15} color="#6366f1" />
      </div>
      <div>
        <div style={{ fontSize: '0.72rem', color: '#6366f1', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
          Resumen de la IA
        </div>
        <div
          style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}
          dangerouslySetInnerHTML={{ __html: summaryText.replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--text-primary)">$1</strong>') }}
        />
      </div>
    </div>
  );
}
