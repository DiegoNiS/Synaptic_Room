import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useTracker } from '../hooks/useTracker';
import { Edit2, Eraser, Trash2, Lightbulb, Type, X, GripHorizontal } from 'lucide-react';

const CHALLENGES = [
  {
    id: 'math',
    title: 'Desafío 1: Límites Infinitos',
    description:
      'Demuestra matemáticamente y explica paso a paso por qué el límite de (2x² + 5) / (x² - 3) cuando x tiende a infinito es igual a 2. Detalla tu lógica de división de términos.',
  },
  {
    id: 'algo',
    title: 'Desafío 2: Algoritmos Eficientes',
    description:
      'Escribe pseudocódigo o explica la lógica para detectar si un número entero es primo en O(√N). ¿Por qué no necesitamos probar hasta N?',
  },
  {
    id: 'logic',
    title: 'Desafío 3: Paradojas de IA',
    description:
      'Tres misioneros y tres caníbales deben cruzar un río en un bote de dos personas. Los caníbales nunca pueden superar a los misioneros en ninguna orilla. ¿Cómo cruzan todos a salvo?',
  },
];

const PALETTE = ['#6366f1', '#10b981', '#ef4444', '#f59e0b', '#ec4899', '#ffffff'];

let boxIdCounter = 1;

export default function Canvas({ onTrace, disabled = false }) {
  const [selectedChallenge, setSelectedChallenge] = useState(CHALLENGES[0]);

  // ── Drawing state ────────────────────────────────────────────────────────
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const containerRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState('pencil'); // 'pencil' | 'eraser' | 'text'
  const [color, setColor] = useState('#6366f1');
  const [brushSize, setBrushSize] = useState(3);

  // ── Text boxes ───────────────────────────────────────────────────────────
  const [textBoxes, setTextBoxes] = useState([]);
  const [activeBoxId, setActiveBoxId] = useState(null);
  const dragRef = useRef(null);

  // ── Metrics tracker ──────────────────────────────────────────────────────
  const { recordKeystroke, updateTextSnapshot } = useTracker(onTrace, 2000);

  // ── Canvas initialisation ────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const { width, height } = container.getBoundingClientRect();
    canvas.width = Math.floor(width);
    canvas.height = Math.floor(height);

    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize;
    contextRef.current = ctx;

    ctx.fillStyle = '#0d0f15';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!contextRef.current) return;
    contextRef.current.strokeStyle = tool === 'eraser' ? '#0d0f15' : color;
    contextRef.current.lineWidth = tool === 'eraser' ? brushSize * 4 : brushSize;
  }, [color, tool, brushSize]);

  // ── Sync combined text snapshot for metrics ──────────────────────────────
  useEffect(() => {
    const combined = textBoxes
      .map(b => b.text)
      .filter(Boolean)
      .join('\n\n');
    updateTextSnapshot(combined);
  }, [textBoxes, updateTextSnapshot]);

  // ── Drawing handlers ─────────────────────────────────────────────────────
  const startDrawing = useCallback(({ nativeEvent }) => {
    if (disabled || tool === 'text') return;
    const { offsetX, offsetY } = nativeEvent;
    contextRef.current.beginPath();
    contextRef.current.moveTo(offsetX, offsetY);
    setIsDrawing(true);
  }, [disabled, tool]);

  const draw = useCallback(({ nativeEvent }) => {
    if (!isDrawing || disabled || tool === 'text') return;
    const { offsetX, offsetY } = nativeEvent;
    contextRef.current.lineTo(offsetX, offsetY);
    contextRef.current.stroke();
  }, [isDrawing, disabled, tool]);

  const stopDrawing = useCallback(() => {
    if (!isDrawing) return;
    contextRef.current?.closePath();
    setIsDrawing(false);
  }, [isDrawing]);

  const handleCanvasClick = useCallback(({ nativeEvent }) => {
    if (tool !== 'text' || disabled) return;
    const { offsetX, offsetY } = nativeEvent;
    const id = boxIdCounter++;
    setTextBoxes(prev => [...prev, { id, x: offsetX, y: offsetY, text: '' }]);
    setActiveBoxId(id);
  }, [tool, disabled]);

  const clearCanvas = useCallback(() => {
    if (disabled) return;
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    ctx.fillStyle = '#0d0f15';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setTextBoxes([]);
    setActiveBoxId(null);
  }, [disabled]);

  // ── Text box handlers ────────────────────────────────────────────────────
  const updateBoxText = useCallback((id, text) => {
    setTextBoxes(prev => prev.map(b => b.id === id ? { ...b, text } : b));
  }, []);

  const deleteBox = useCallback((id) => {
    setTextBoxes(prev => prev.filter(b => b.id !== id));
    setActiveBoxId(prev => prev === id ? null : prev);
  }, []);

  const handleBoxDragStart = useCallback((e, id) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    const box = textBoxes.find(b => b.id === id);
    if (!box) return;
    dragRef.current = { id, startX: e.clientX, startY: e.clientY, origX: box.x, origY: box.y };
    setActiveBoxId(id);

    const onMove = (me) => {
      if (!dragRef.current) return;
      const { id: dId, startX, startY, origX, origY } = dragRef.current;
      const dx = me.clientX - startX;
      const dy = me.clientY - startY;
      setTextBoxes(prev => prev.map(b => b.id === dId ? { ...b, x: origX + dx, y: origY + dy } : b));
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [disabled, textBoxes]);

  // ── Cursor per tool ──────────────────────────────────────────────────────
  const canvasCursor = disabled
    ? 'not-allowed'
    : tool === 'eraser'
    ? 'cell'
    : tool === 'text'
    ? 'crosshair'
    : 'crosshair';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '12px' }}>

      {/* ── Challenge selector ──────────────────────────────────────────── */}
      <div className="glass-panel" style={{ padding: '14px 18px', flexShrink: 0 }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '12px',
          flexWrap: 'wrap',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Lightbulb size={17} color="#f59e0b" />
              <span style={{
                fontFamily: 'var(--font-display)',
                fontWeight: '700',
                fontSize: '0.95rem',
                color: 'var(--text-primary)',
              }}>
                {selectedChallenge.title}
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: '1.55', margin: 0 }}>
              {selectedChallenge.description}
            </p>
          </div>

          {/* Challenge tabs */}
          <div style={{
            display: 'flex',
            gap: '6px',
            background: 'rgba(0,0,0,0.3)',
            padding: '4px',
            borderRadius: 'var(--radius-md)',
            flexShrink: 0,
          }}>
            {CHALLENGES.map(ch => (
              <button
                key={ch.id}
                onClick={() => setSelectedChallenge(ch)}
                disabled={disabled}
                style={{
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  background: selectedChallenge.id === ch.id
                    ? 'var(--grad-primary)'
                    : 'transparent',
                  color: selectedChallenge.id === ch.id ? '#fff' : 'var(--text-muted)',
                  fontFamily: 'var(--font-display)',
                  fontWeight: '600',
                  fontSize: '0.78rem',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  transition: 'all var(--transition-fast)',
                  letterSpacing: '0.04em',
                }}
              >
                {ch.id.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Whiteboard ─────────────────────────────────────────────────────── */}
      <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>

        {/* Toolbar */}
        <div style={{
          padding: '8px 14px',
          borderBottom: '1px solid var(--border-color)',
          background: 'rgba(0,0,0,0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', flexShrink: 0 }}>
            Pizarra Colaborativa
          </span>

          <div style={{ flex: 1 }} />

          {/* Tool group */}
          <div style={{
            display: 'flex',
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 'var(--radius-md)',
            padding: '3px',
            gap: '2px',
            border: '1px solid var(--border-color)',
          }}>
            {[
              { id: 'pencil', icon: <Edit2 size={14} />, label: 'Dibujar' },
              { id: 'eraser', icon: <Eraser size={14} />, label: 'Borrador' },
              { id: 'text',   icon: <Type size={14} />,  label: 'Texto' },
            ].map(({ id, icon, label }) => (
              <button
                key={id}
                onClick={() => setTool(id)}
                disabled={disabled}
                title={label}
                style={{
                  padding: '5px 10px',
                  borderRadius: 'calc(var(--radius-md) - 3px)',
                  border: 'none',
                  background: tool === id ? 'rgba(99,102,241,0.25)' : 'transparent',
                  color: tool === id ? '#a5b4fc' : 'var(--text-muted)',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '0.78rem',
                  fontWeight: tool === id ? '600' : '400',
                  transition: 'all var(--transition-fast)',
                  boxShadow: tool === id ? 'inset 0 1px 2px rgba(0,0,0,0.3)' : 'none',
                }}
              >
                {icon}
                <span style={{ display: 'none', '@media(minWidth:700px)': { display: 'inline' } }}>{label}</span>
              </button>
            ))}
          </div>

          {/* Color palette — hidden when text tool active */}
          {tool !== 'text' && (
            <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
              {PALETTE.map(c => (
                <button
                  key={c}
                  onClick={() => { setColor(c); setTool('pencil'); }}
                  disabled={disabled || tool === 'eraser'}
                  title={c}
                  style={{
                    width: '17px',
                    height: '17px',
                    borderRadius: '50%',
                    background: c,
                    border: color === c && tool === 'pencil'
                      ? '2px solid #fff'
                      : '1px solid rgba(255,255,255,0.15)',
                    cursor: (disabled || tool === 'eraser') ? 'default' : 'pointer',
                    boxShadow: color === c && tool === 'pencil' ? `0 0 7px ${c}` : 'none',
                    flexShrink: 0,
                    transition: 'all var(--transition-fast)',
                  }}
                />
              ))}
            </div>
          )}

          {/* Brush size — hidden when text tool */}
          {tool !== 'text' && (
            <input
              type="range" min="1" max="15"
              value={brushSize}
              onChange={e => setBrushSize(parseInt(e.target.value))}
              disabled={disabled}
              style={{ width: '58px', accentColor: '#6366f1', cursor: disabled ? 'not-allowed' : 'pointer' }}
            />
          )}

          {/* Text box count badge */}
          {textBoxes.length > 0 && (
            <span style={{
              fontSize: '0.75rem',
              color: '#a5b4fc',
              background: 'rgba(99,102,241,0.15)',
              border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: 'var(--radius-full)',
              padding: '2px 8px',
              fontWeight: '600',
            }}>
              {textBoxes.length} {textBoxes.length === 1 ? 'nota' : 'notas'}
            </span>
          )}

          {/* Clear */}
          <button
            onClick={clearCanvas}
            disabled={disabled}
            title="Limpiar pizarra"
            style={{
              padding: '5px 10px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid rgba(239,68,68,0.25)',
              background: 'rgba(239,68,68,0.06)',
              color: '#ef4444',
              cursor: disabled ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.78rem',
              transition: 'all var(--transition-fast)',
            }}
          >
            <Trash2 size={13} />
          </button>
        </div>

        {/* Canvas + text box overlay */}
        <div
          ref={containerRef}
          style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}
        >
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onClick={handleCanvasClick}
            style={{
              display: 'block',
              width: '100%',
              height: '100%',
              cursor: canvasCursor,
              touchAction: 'none',
            }}
          />

          {/* Hint when text tool is active and canvas is empty */}
          {tool === 'text' && !disabled && textBoxes.length === 0 && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                pointerEvents: 'none',
              }}
            >
              <Type size={36} style={{ opacity: 0.15 }} />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', opacity: 0.6 }}>
                Haz clic en la pizarra para agregar una caja de texto
              </span>
            </div>
          )}

          {/* Hint when pencil tool and canvas is empty */}
          {tool === 'pencil' && !disabled && textBoxes.length === 0 && (
            <div
              style={{
                position: 'absolute',
                bottom: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                pointerEvents: 'none',
              }}
            >
              <span style={{
                fontSize: '0.78rem',
                color: 'var(--text-muted)',
                opacity: 0.45,
                background: 'rgba(0,0,0,0.4)',
                padding: '4px 12px',
                borderRadius: 'var(--radius-full)',
              }}>
                Dibuja tu solución — usa "Texto" para agregar razonamiento escrito
              </span>
            </div>
          )}

          {/* Text boxes */}
          {textBoxes.map(box => (
            <TextBox
              key={box.id}
              box={box}
              active={activeBoxId === box.id}
              disabled={disabled}
              onDragStart={handleBoxDragStart}
              onTextChange={updateBoxText}
              onKeyDown={recordKeystroke}
              onFocus={setActiveBoxId}
              onDelete={deleteBox}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── TextBox sub-component ─────────────────────────────────────────────────────
function TextBox({ box, active, disabled, onDragStart, onTextChange, onKeyDown, onFocus, onDelete }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: box.x,
        top: box.y,
        minWidth: '180px',
        maxWidth: '320px',
        borderRadius: 'var(--radius-md)',
        border: `1.5px solid ${active ? '#6366f1' : 'rgba(99,102,241,0.25)'}`,
        background: 'rgba(10,12,20,0.88)',
        backdropFilter: 'blur(6px)',
        boxShadow: active
          ? '0 0 0 2px rgba(99,102,241,0.15), 0 8px 24px rgba(0,0,0,0.6)'
          : '0 4px 16px rgba(0,0,0,0.5)',
        overflow: 'hidden',
        zIndex: active ? 20 : 10,
        transition: 'box-shadow var(--transition-fast), border-color var(--transition-fast)',
      }}
    >
      {/* Drag handle */}
      <div
        onMouseDown={e => onDragStart(e, box.id)}
        onClick={e => e.stopPropagation()}
        style={{
          padding: '4px 8px 3px',
          background: active ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.04)',
          borderBottom: `1px solid ${active ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.06)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: disabled ? 'default' : 'grab',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <GripHorizontal size={11} style={{ color: 'var(--text-muted)', opacity: 0.7 }} />
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '500' }}>
            Texto
          </span>
        </div>
        {!disabled && (
          <button
            onClick={e => { e.stopPropagation(); onDelete(box.id); }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '1px',
              display: 'flex',
              alignItems: 'center',
              borderRadius: '3px',
              transition: 'color var(--transition-fast)',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <X size={11} />
          </button>
        )}
      </div>

      {/* Text input */}
      <textarea
        value={box.text}
        onChange={e => onTextChange(box.id, e.target.value)}
        onKeyDown={e => {
          e.stopPropagation();
          onKeyDown(e.key === 'Backspace' || e.key === 'Delete');
        }}
        onClick={e => { e.stopPropagation(); onFocus(box.id); }}
        onFocus={() => onFocus(box.id)}
        disabled={disabled}
        placeholder="Escribe tu razonamiento aquí..."
        rows={3}
        style={{
          width: '100%',
          padding: '8px 10px',
          background: 'transparent',
          border: 'none',
          color: disabled ? 'var(--text-secondary)' : 'var(--text-primary)',
          fontFamily: 'var(--font-sans)',
          fontSize: '0.85rem',
          lineHeight: '1.55',
          resize: 'both',
          outline: 'none',
          minWidth: '160px',
          minHeight: '56px',
        }}
      />
    </div>
  );
}
