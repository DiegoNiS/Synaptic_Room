import React from 'react';

/**
 * Catches render-time errors in the routed views so a malformed payload (e.g. a
 * bad nodeMap reaching the D3 graph) shows a recoverable fallback instead of a
 * blank white screen mid-class.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] UI crashed:', error, info?.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    if (typeof window !== 'undefined') window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '16px',
        padding: '40px', textAlign: 'center', background: 'var(--bg-deep)',
      }}>
        <div style={{ fontSize: '3rem' }}>🧠💥</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', color: 'var(--text-primary)' }}>
          Algo se rompió en la interfaz
        </h1>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '420px', lineHeight: 1.5 }}>
          La vista encontró un error inesperado. Tu sesión sigue activa en el servidor —
          recarga para volver a conectarte.
        </p>
        <button className="btn-primary" onClick={this.handleReload} style={{ padding: '10px 20px' }}>
          Recargar
        </button>
      </div>
    );
  }
}
