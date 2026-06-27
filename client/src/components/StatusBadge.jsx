import React from 'react';

/**
 * A beautiful pill badge representing a student's cognitive state.
 * Includes custom glow effects corresponding to the state.
 * 
 * @param {Object} props
 * @param {string} props.state - 'idle' | 'flow' | 'blocked' | 'mentoring'
 */
export default function StatusBadge({ state }) {
  const getBadgeConfig = () => {
    switch (state) {
      case 'flow':
        return { label: 'En Flujo ⚡', className: 'flow' };
      case 'blocked':
        return { label: 'Bloqueado ⚠️', className: 'blocked' };
      case 'mentoring':
        return { label: 'Mentoreando 🤝', className: 'mentoring' };
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
