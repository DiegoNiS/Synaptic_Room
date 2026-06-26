import React, { useRef, useState, useEffect } from 'react';
import { useTracker } from '../hooks/useTracker';
import { Square, Edit2, Eraser, Trash2, Lightbulb } from 'lucide-react';

const CHALLENGES = [
  {
    id: 'math',
    title: 'Desafío 1: Límites Infinitos',
    description: 'Demuestra matemáticamente y explica paso a paso por qué el límite de (2x^2 + 5) / (x^2 - 3) cuando x tiende a infinito es igual a 2. Detalla tu lógica de división de términos.',
  },
  {
    id: 'algo',
    title: 'Desafío 2: Algoritmos Eficientes',
    description: 'Escribe un pseudocódigo o explica en tus palabras la lógica para detectar si un número entero es primo en un tiempo de complejidad O(√N). ¿Por qué no necesitamos probar hasta N?',
  },
  {
    id: 'logic',
    title: 'Desafío 3: Paradojas de IA',
    description: 'Resuelve: Tres misioneros y tres caníbales deben cruzar un río en un bote que solo lleva a dos personas. Si los caníbales superan en número a los misioneros en cualquier orilla, se los comerán. ¿Cómo cruzan todos a salvo?',
  }
];

export default function Canvas({ onTrace, disabled = false, initialText = '' }) {
  const [selectedChallenge, setSelectedChallenge] = useState(CHALLENGES[0]);
  const [text, setText] = useState(initialText);

  // Hook for trace tracking
  const tracker = useTracker(onTrace, 2000);

  // HTML5 Sketchpad refs & state
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#6366f1');
  const [tool, setTool] = useState('pencil'); // 'pencil' | 'eraser'
  const [brushSize, setBrushSize] = useState(3);

  // Synchronize initialText if updated by parent (e.g. mentee's text synced to mentor)
  useEffect(() => {
    if (initialText !== undefined) {
      setText(initialText);
      tracker.textRef.current = initialText;
    }
  }, [initialText]);

  // Set up whiteboard canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Support responsive sizing
    canvas.width = canvas.parentElement.offsetWidth || 500;
    canvas.height = canvas.parentElement.offsetHeight || 600;

    const context = canvas.getContext('2d');
    context.lineCap = 'round';
    context.strokeStyle = color;
    context.lineWidth = brushSize;
    contextRef.current = context;

    // Fill background black/gray
    context.fillStyle = '#0d0f15';
    context.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  // Update canvas options
  useEffect(() => {
    if (!contextRef.current) return;
    contextRef.current.strokeStyle = tool === 'eraser' ? '#0d0f15' : color;
    contextRef.current.lineWidth = tool === 'eraser' ? brushSize * 4 : brushSize;
  }, [color, tool, brushSize]);

  const startDrawing = ({ nativeEvent }) => {
    if (disabled) return;
    const { offsetX, offsetY } = nativeEvent;
    contextRef.current.beginPath();
    contextRef.current.moveTo(offsetX, offsetY);
    setIsDrawing(true);
  };

  const draw = ({ nativeEvent }) => {
    if (!isDrawing || disabled) return;
    const { offsetX, offsetY } = nativeEvent;
    contextRef.current.lineTo(offsetX, offsetY);
    contextRef.current.stroke();
  };

  const stopDrawing = () => {
    contextRef.current.closePath();
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    if (disabled) return;
    const canvas = canvasRef.current;
    const context = contextRef.current;
    context.fillStyle = '#0d0f15';
    context.fillRect(0, 0, canvas.width, canvas.height);
  };

  const handleTextAreaChange = (e) => {
    setText(e.target.value);
    tracker.handleChange(e);
  };

  return (
    <div className="workspace-container" style={{ height: '100%', gridTemplateRows: 'auto 1fr', padding: 0 }}>
      {/* Top Header Selector */}
      <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', height: '50%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
            <Lightbulb size={20} color="#f59e0b" />
            <span>Resolución de Problemas Cognitivos</span>
          </h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            {CHALLENGES.map((ch) => (
              <button
                key={ch.id}
                onClick={() => setSelectedChallenge(ch)}
                disabled={disabled}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  background: selectedChallenge.id === ch.id ? 'var(--grad-primary)' : 'rgba(255,255,255,0.03)',
                  color: '#fff',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: '500',
                  transition: 'all var(--transition-fast)'
                }}
              >
                {ch.id.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.4' }}>
          <strong>{selectedChallenge.title}:</strong> {selectedChallenge.description}
        </p>
      </div>

      {/* Main Workspace Layout Split (Text Reasoning & Sketch whiteboard) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr',
        //gridTemplateRows: '4fr 6fr',
        gap: '20px',
        marginTop: '20px'
      }} className="desktop-split">
        {/* Text Reasoning Editor */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%' }}>
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-color)',
            background: 'rgba(255,255,255,0.02)',
            display: 'flex',
            justifyContent: 'between',
            alignItems: 'center'
          }}>
            <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
              Área de Razonamiento Escrito (Process Trace AI)
            </span>
            {disabled && <span style={{ fontSize: '0.8rem', color: 'var(--color-blocked)', marginLeft: 'auto' }}>Vista Mentor (Lectura)</span>}
          </div>
          <textarea
            className="canvas-textarea"
            placeholder="Comienza a escribir tu solución paso a paso. Recuerda explicar tu lógica, no solo la respuesta final..."
            value={text}
            onChange={handleTextAreaChange}
            onKeyDown={tracker.handleKeyDown}
            disabled={disabled}
            style={{
              flexGrow: 1,
              border: 'none',
              borderRadius: 0,
              background: 'transparent',
              fontSize: '1.05rem',
              color: disabled ? 'var(--text-secondary)' : 'var(--text-primary)'
            }}
          />
        </div>

        {/* Live Whiteboard Sketchpad */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', }}>
          {/* Drawing Controls */}
          <div style={{
            padding: '10px 16px',
            borderBottom: '1px solid var(--border-color)',
            background: 'rgba(255,255,255,0.02)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap'
          }}>
            <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-secondary)', marginRight: 'auto' }}>
              Pizarra Gráfica Colaborativa
            </span>

            {/* Drawing Tools */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={() => setTool('pencil')}
                className="btn-secondary"
                style={{
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  background: tool === 'pencil' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                  borderColor: tool === 'pencil' ? '#6366f1' : 'var(--border-color)'
                }}
                title="Pincel"
                disabled={disabled}
              >
                <Edit2 size={16} />
              </button>
              <button
                onClick={() => setTool('eraser')}
                className="btn-secondary"
                style={{
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  background: tool === 'eraser' ? 'rgba(255,255,255,0.1)' : 'transparent',
                  borderColor: tool === 'eraser' ? '#fff' : 'var(--border-color)'
                }}
                title="Borrador"
                disabled={disabled}
              >
                <Eraser size={16} />
              </button>
              <button
                onClick={clearCanvas}
                className="btn-secondary"
                style={{
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-blocked)'
                }}
                title="Limpiar pizarra"
                disabled={disabled}
              >
                <Trash2 size={16} />
              </button>
            </div>

            {/* Color Selectors */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {['#6366f1', '#10b981', '#ef4444', '#f59e0b', '#ec4899', '#ffffff'].map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setColor(c);
                    setTool('pencil');
                  }}
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    backgroundColor: c,
                    border: color === c && tool === 'pencil' ? '2px solid #fff' : 'none',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    boxShadow: color === c ? `0 0 8px ${c}` : 'none'
                  }}
                  disabled={disabled}
                />
              ))}
            </div>

            {/* Brush Size */}
            <input
              type="range"
              min="1"
              max="15"
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
              style={{ width: '60px', accentColor: '#6366f1', cursor: disabled ? 'not-allowed' : 'pointer' }}
              disabled={disabled}
            />
          </div>

          {/* Canvas Draw Space */}
          <div style={{ flexGrow: 1, position: 'relative', width: '100%' }}>
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              style={{
                display: 'block',
                width: '100%',
                height: '100%',
                cursor: disabled ? 'not-allowed' : tool === 'eraser' ? 'cell' : 'crosshair'
              }}
            />
          </div>
        </div>
      </div>
      
      {/* CSS overrides for responsive layout */}
      <style>{`
        @media (min-width: 900px) {
          .desktop-split {
            grid-template-columns: 4fr 6fr !important;
            grid-template-rows: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
