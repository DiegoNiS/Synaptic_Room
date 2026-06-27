import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Clock, CheckCircle, Brain, Users, Lightbulb } from 'lucide-react';

/**
 * MentorPanel — The micro-mentorship split-screen panel.
 * Shown to both mentor and mentee when a mentorship session is active.
 *
 * @param {Object} props
 * @param {Object} props.mentorship - Active mentorship data from useSocket
 * @param {Array}  props.chatMessages - Chat messages
 * @param {Function} props.onSendMessage - Callback to send a chat message
 * @param {Function} props.onClose - Callback to close the mentorship
 * @param {string}  props.studentId - Current student's ID
 * @param {string}  props.displayName - Current student's name
 * @param {React.ReactNode} props.workspaceContent - Student's Canvas component to embed
 */
export default function MentorPanel({
  mentorship,
  chatMessages,
  onSendMessage,
  onClose,
  studentId,
  displayName,
  workspaceContent,
}) {
  const [message, setMessage] = useState('');
  const [timeLeft, setTimeLeft] = useState(null);
  const [showPasteWarning, setShowPasteWarning] = useState(false);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  const isMentor = mentorship?.role === 'mentor';
  const partnerName = mentorship?.partnerName || 'Compañero';
  const topic = mentorship?.topic || 'Bloqueo conceptual detectado';

  // Countdown timer
  useEffect(() => {
    if (!mentorship?.expiresAt) return;
    const tick = () => {
      const remaining = Math.max(0, Math.floor((mentorship.expiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [mentorship?.expiresAt]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSend = () => {
    if (!message.trim()) return;
    onSendMessage(message.trim());
    setMessage('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePaste = (e) => {
    if (isMentor) {
      e.preventDefault();
      setShowPasteWarning(true);
      setTimeout(() => setShowPasteWarning(false), 4000);
    }
  };

  const formatTime = (seconds) => {
    if (seconds === null) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const timerColor = timeLeft !== null && timeLeft < 60 ? 'var(--color-blocked)' : 'var(--color-flow)';

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 100,
      background: 'rgba(8, 10, 16, 0.97)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header Bar */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid var(--border-color)',
        background: 'rgba(17, 22, 34, 0.9)',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        flexWrap: 'wrap',
      }}>
        {/* Role Badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px',
          borderRadius: 'var(--radius-full)',
          background: isMentor ? 'rgba(16,185,129,0.15)' : 'rgba(139,92,246,0.15)',
          border: `1px solid ${isMentor ? 'rgba(16,185,129,0.4)' : 'rgba(139,92,246,0.4)'}`,
        }}>
          {isMentor ? <Brain size={16} color="var(--color-flow)" /> : <Lightbulb size={16} color="var(--color-mentorship)" />}
          <span style={{
            fontSize: '0.85rem',
            fontWeight: '700',
            color: isMentor ? 'var(--color-flow)' : 'var(--color-mentorship)',
            fontFamily: 'var(--font-display)',
          }}>
            {isMentor ? '🧠 Eres el Mentor' : '🤝 Recibiendo Mentoría'}
          </span>
        </div>

        {/* Topic */}
        <div style={{ flex: 1, minWidth: '200px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Bloqueo detectado por IA:</div>
          <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: '500' }}>{topic}</div>
        </div>

        {/* Connected Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={16} color="var(--text-secondary)" />
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Conectado con <strong style={{ color: 'var(--text-primary)' }}>{partnerName}</strong>
          </span>
        </div>

        {/* Timer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 14px',
          borderRadius: 'var(--radius-full)',
          background: 'rgba(0,0,0,0.3)',
          border: `1px solid ${timerColor}40`,
        }}>
          <Clock size={14} color={timerColor} />
          <span style={{ fontSize: '1rem', fontWeight: '700', color: timerColor, fontFamily: 'var(--font-mono)' }}>
            {formatTime(timeLeft)}
          </span>
        </div>

        {/* Close / Resolve Button */}
        <button
          onClick={() => onClose(isMentor ? 'resolved' : 'manual')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: 'var(--radius-md)',
            background: isMentor ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${isMentor ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.3)'}`,
            color: isMentor ? 'var(--color-flow)' : 'var(--color-blocked)',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '0.9rem',
          }}
        >
          {isMentor ? <><CheckCircle size={14} /> Marcar Resuelto</> : <><X size={14} /> Salir</>}
        </button>
      </div>

      {/* Main Split Content */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 380px',
        gap: 0,
        overflow: 'hidden',
      }}>
        {/* Left Panel: Workspace */}
        <div style={{
          borderRight: '1px solid var(--border-color)',
          overflow: 'hidden',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}>
          {/* Workspace label */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border-color)',
          }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {isMentor
                ? `📖 Área de trabajo de ${partnerName} (solo lectura)`
                : `✍️ Tu área de trabajo — ${displayName}`}
            </span>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {workspaceContent}
          </div>
        </div>

        {/* Right Panel: Chat */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(0,0,0,0.2)',
          overflow: 'hidden',
        }}>
          {/* Chat Header */}
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)',
            background: 'rgba(255,255,255,0.02)',
          }}>
            <div style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>
              💬 Canal de Mentoría
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {isMentor
                ? 'Comparte tu lógica, no la respuesta directa'
                : 'Pide ayuda sobre conceptos que no entiendes'}
            </div>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}>
            {/* Welcome message */}
            <div style={{
              textAlign: 'center',
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(139,92,246,0.08)',
              border: '1px solid rgba(139,92,246,0.2)',
              marginBottom: '8px',
            }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>🧠</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                {isMentor
                  ? <span><strong>Instrucciones de la IA: </strong> {mentorship?.mentorInstructions || `Guía a ${partnerName} con preguntas que activen su razonamiento.`}</span>
                  : `La IA conectó a ${partnerName} contigo. Pídele que te explique cómo piensa el problema.`}
              </div>
            </div>

            {chatMessages.map((msg, i) => {
              const isOwn = msg.from === studentId;
              return (
                <div key={i} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isOwn ? 'flex-end' : 'flex-start',
                }}>
                  <div style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    marginBottom: '4px',
                    paddingLeft: isOwn ? 0 : '4px',
                    paddingRight: isOwn ? '4px' : 0,
                  }}>
                    {isOwn ? 'Tú' : msg.fromName}
                  </div>
                  <div style={{
                    maxWidth: '85%',
                    padding: '10px 14px',
                    borderRadius: isOwn ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    background: isOwn
                      ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                      : 'rgba(255,255,255,0.08)',
                    border: isOwn ? 'none' : '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    lineHeight: '1.4',
                    wordBreak: 'break-word',
                  }}>
                    {msg.message}
                  </div>
                  <div style={{
                    fontSize: '0.7rem',
                    color: 'var(--text-muted)',
                    marginTop: '4px',
                    paddingLeft: isOwn ? 0 : '4px',
                    paddingRight: isOwn ? '4px' : 0,
                  }}>
                    {new Date(msg.timestamp).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              );
            })}

            {chatMessages.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', paddingTop: '20px' }}>
                Aún no hay mensajes. ¡Comienza la conversación!
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Message Input */}
          <div style={{
            padding: '16px',
            borderTop: '1px solid var(--border-color)',
            background: 'rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}>
            {showPasteWarning && (
              <div style={{
                color: 'var(--color-blocked)',
                fontSize: '0.8rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                animation: 'pulse 2s infinite',
              }}>
                <X size={14} /> 
                Para que el aprendizaje sea real, debes explicar tu razonamiento, no copiar y pegar código.
              </div>
            )}
            
            <div style={{
              display: 'flex',
              gap: '10px',
              alignItems: 'flex-end',
            }}>
              <textarea
                ref={inputRef}
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 500))}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
              placeholder={isMentor ? 'Comparte una pista o pregunta guía...' : 'Escribe tu duda aquí...'}
              rows={2}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: '0.9rem',
                resize: 'none',
                outline: 'none',
                lineHeight: '1.4',
              }}
            />
            <button
              onClick={handleSend}
              disabled={!message.trim()}
              style={{
                padding: '10px 16px',
                borderRadius: 'var(--radius-md)',
                background: message.trim() ? 'var(--grad-primary)' : 'rgba(255,255,255,0.05)',
                border: 'none',
                color: message.trim() ? '#fff' : 'var(--text-muted)',
                cursor: message.trim() ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all var(--transition-fast)',
                flexShrink: 0,
              }}
            >
              <Send size={18} />
            </button>
            </div>
          </div>
          {/* Character counter */}
          <div style={{ textAlign: 'right', padding: '4px 16px 12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {message.length}/500
          </div>
        </div>
      </div>
    </div>
  );
}
