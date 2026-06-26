import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Monitor, Users, ArrowRight, Zap, Brain, Network } from 'lucide-react';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [role, setRole] = useState('student'); // 'student' | 'teacher'
  const [displayName, setDisplayName] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [nameError, setNameError] = useState('');
  const [sessionError, setSessionError] = useState('');

  const handleJoin = (e) => {
    e.preventDefault();
    let valid = true;

    if (!displayName.trim()) {
      setNameError('Ingresa tu nombre');
      valid = false;
    } else {
      setNameError('');
    }

    if (!sessionId.trim()) {
      setSessionError('Ingresa el código de sesión');
      valid = false;
    } else {
      setSessionError('');
    }

    if (!valid) return;

    const studentId = generateId();
    const cleanSession = sessionId.trim().toLowerCase().replace(/\s+/g, '-');

    if (role === 'teacher') {
      navigate(`/teacher?session=${encodeURIComponent(cleanSession)}&name=${encodeURIComponent(displayName.trim())}`);
    } else {
      navigate(`/student/${studentId}?session=${encodeURIComponent(cleanSession)}&name=${encodeURIComponent(displayName.trim())}`);
    }
  };

  const features = [
    {
      icon: <Brain size={22} color="#6366f1" />,
      title: 'Process Trace AI',
      desc: 'Detecta bloqueos cognitivos analizando ritmo de escritura, pausas y borrados en tiempo real.',
      color: '#6366f1',
    },
    {
      icon: <Network size={22} color="#10b981" />,
      title: 'Cognitive Mesh',
      desc: 'Conecta automáticamente al estudiante bloqueado con el mejor mentor disponible en el salón.',
      color: '#10b981',
    },
    {
      icon: <Monitor size={22} color="#8b5cf6" />,
      title: 'Tablero del Docente',
      desc: 'Mapa de red D3.js en vivo donde cada alumno es un nodo que cambia de color según su estado cognitivo.',
      color: '#8b5cf6',
    },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Animated background orbs */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: `
          radial-gradient(circle at 15% 30%, rgba(99,102,241,0.12) 0%, transparent 40%),
          radial-gradient(circle at 85% 70%, rgba(139,92,246,0.10) 0%, transparent 40%),
          radial-gradient(circle at 50% 10%, rgba(16,185,129,0.06) 0%, transparent 35%)
        `,
      }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '1000px' }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '16px' }}>🧠</div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(2.2rem, 5vw, 3.5rem)',
            fontWeight: '800',
            lineHeight: '1.1',
            marginBottom: '16px',
            background: 'linear-gradient(135deg, #f3f4f6 0%, #6366f1 50%, #a855f7 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            Synaptic Room
          </h1>
          <p style={{
            fontSize: '1.15rem',
            color: 'var(--text-secondary)',
            maxWidth: '580px',
            margin: '0 auto 8px',
            lineHeight: '1.6',
          }}>
            El Sistema Operativo de la Inteligencia Colectiva
          </p>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Transforma tu aula en una red cognitiva viva con IA — NEXIA Build with AI 2026
          </p>
        </div>

        {/* Main layout */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '32px',
          alignItems: 'start',
        }}>
          {/* Join Form */}
          <div className="glass-panel" style={{ padding: '32px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', marginBottom: '24px' }}>
              Unirse a la sesión
            </h2>

            {/* Role selector */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: '500' }}>
                Tu rol
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {[
                  { id: 'student', label: 'Estudiante', icon: <BookOpen size={18} />, desc: 'Resolver y aprender' },
                  { id: 'teacher', label: 'Docente', icon: <Users size={18} />, desc: 'Ver el tablero en vivo' },
                ].map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRole(r.id)}
                    style={{
                      padding: '14px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: `2px solid ${role === r.id ? '#6366f1' : 'var(--border-color)'}`,
                      background: role === r.id ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.03)',
                      color: role === r.id ? '#818cf8' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '6px',
                      textAlign: 'center',
                    }}
                  >
                    {r.icon}
                    <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>{r.label}</span>
                    <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>{r.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Name */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: '500' }}>
                  Tu nombre
                </label>
                <input
                  className="input-field"
                  style={{ width: '100%' }}
                  type="text"
                  placeholder={role === 'teacher' ? 'Prof. García' : 'María López'}
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  maxLength={40}
                  autoFocus
                />
                {nameError && <div style={{ color: 'var(--color-blocked)', fontSize: '0.8rem', marginTop: '4px' }}>{nameError}</div>}
              </div>

              {/* Session Code */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: '500' }}>
                  Código de sesión
                </label>
                <input
                  className="input-field"
                  style={{ width: '100%', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}
                  type="text"
                  placeholder="hackathon-2026"
                  value={sessionId}
                  onChange={e => setSessionId(e.target.value)}
                  maxLength={50}
                />
                {sessionError && <div style={{ color: 'var(--color-blocked)', fontSize: '0.8rem', marginTop: '4px' }}>{sessionError}</div>}
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Todos los participantes deben usar el mismo código para estar en la misma sala.
                </div>
              </div>

              <button
                type="submit"
                className="btn-primary"
                style={{ width: '100%', marginTop: '8px', gap: '10px', padding: '14px' }}
              >
                <Zap size={18} />
                {role === 'teacher' ? 'Abrir Tablero del Docente' : 'Entrar al Aula'}
                <ArrowRight size={16} />
              </button>
            </form>
          </div>

          {/* Features Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {features.map((f, i) => (
              <div
                key={i}
                className="glass-panel"
                style={{
                  padding: '20px',
                  display: 'flex',
                  gap: '16px',
                  alignItems: 'flex-start',
                  borderColor: `${f.color}20`,
                }}
              >
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: 'var(--radius-md)',
                  background: `${f.color}12`,
                  border: `1px solid ${f.color}30`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {f.icon}
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '0.95rem', marginBottom: '4px', color: f.color }}>
                    {f.title}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    {f.desc}
                  </div>
                </div>
              </div>
            ))}

            {/* NEXIA Badge */}
            <div style={{
              padding: '16px 20px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(99,102,241,0.06)',
              border: '1px solid rgba(99,102,241,0.2)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Presentado en</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '0.95rem', color: '#818cf8' }}>
                🏆 NEXIA Build with AI 2026
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Propuesta Libre — IA + Educación
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 700px) {
          div[style*="grid-template-columns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
