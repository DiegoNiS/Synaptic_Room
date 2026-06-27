import React from 'react';

/**
 * StatusBadge — Pill badge representing a student's cognitive state.
 * Uses teacher-friendly language.
 */
export default function StatusBadge({ state }) {
  const getBadgeConfig = () => {
    switch (state) {
      case 'flow':
        return { label: 'Avanzando 🚀', className: 'flow' };
      case 'blocked':
        return { label: 'Necesita Ayuda ⚠️', className: 'blocked' };
      case 'mentoring':
        return { label: 'Colaborando 🤝', className: 'mentoring' };
      case 'fraude':
        return { label: 'Alerta Copia 🚨', className: 'blocked' };
      case 'idle':
      default:
        return { label: 'Activo 🟢', className: 'idle' };
    }
  };

  const config = getBadgeConfig();

  return (
    <div className={`status-badge ${config.className}`}>
      <span className="status-dot" style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: `var(--color-${config.className})`,
        display: 'inline-block',
        boxShadow: `0 0 8px var(--color-${config.className})`
      }}></span>
      <span>{config.label}</span>
    </div>
  );
}
