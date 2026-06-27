# Synaptic Room — CLAUDE.md

> Este archivo le da contexto a Claude Code sobre el proyecto. Léelo antes de realizar cualquier cambio.

## ¿Qué es Synaptic Room?

Synaptic Room es una plataforma web en tiempo real para **NEXIA Build with AI 2026** (categoría: Propuesta Libre — IA + Educación). Transforma un aula tradicional en una **red cognitiva viva**: la IA detecta bloqueos conceptuales en estudiantes mientras trabajan y orquesta micro-mentorías automáticas entre ellos, conectando al alumno avanzado con el bloqueado para compartir lógica (no respuestas).

---

## Stack Tecnológico

| Capa | Tecnología | Puerto |
|---|---|---|
| **Cliente** | React 18 + Vite 5 + Socket.io-client + D3.js | `5173` |
| **Servidor** | Node.js 20 + Express + Socket.io | `3001` |
| **Agentes IA** | Python + Google ADK + FastAPI + Gemini 1.5 Pro | `8000` |
| **Base de datos** | Supabase (PostgreSQL) | cloud |

---

## Estructura del Repositorio

```
synaptic-room/
├── client/                    ← React + Vite (Frontend)
│   ├── src/
│   │   ├── App.jsx            ← Router: /, /student/:id, /teacher
│   │   ├── index.css          ← Design system (dark, glassmorphism, glows)
│   │   ├── socket.js          ← Socket.io client lifecycle
│   │   ├── hooks/
│   │   │   ├── useSocket.js   ← WebSocket state hook
│   │   │   └── useTracker.js  ← Keystroke metrics tracking hook
│   │   ├── components/
│   │   │   ├── Canvas.jsx     ← Pizarra interactiva HTML5 + cajas de texto trackeadas
│   │   │   ├── MentorPanel.jsx ← Split-screen mentoría con chat en tiempo real
│   │   │   ├── NodeMap.jsx    ← Grafo D3.js fuerza-dirigida del tablero docente
│   │   │   └── StatusBadge.jsx ← Badge de estado cognitivo con glow
│   │   └── pages/
│   │       ├── LandingPage.jsx ← Selector de rol + formulario de sesión
│   │       ├── StudentView.jsx ← Vista del estudiante (pizarra + tracker)
│   │       └── TeacherView.jsx ← Dashboard docente (stats + D3 + event log)
│   ├── package.json
│   └── vite.config.js
│
├── server/                    ← Node.js + Express + Socket.io
│   └── src/
│       ├── server.js          ← Entry point + DI composition root
│       ├── config/            ← env.js, cors.js
│       ├── domain/
│       │   ├── models/        ← Student.js, Session.js, Mentorship.js
│       │   └── events/        ← DomainEvents.js (SOCKET_INCOMING, SOCKET_OUTGOING)
│       ├── application/
│       │   ├── TraceAnalysisUseCase.js  ← trace → AI → state update → emit
│       │   └── MentorshipUseCase.js     ← match, create, close mentorships
│       ├── infrastructure/
│       │   ├── ai/            ← AgentClient.js (HTTP → FastAPI), CircuitBreaker.js
│       │   ├── db/            ← SessionRepository.js (Supabase)
│       │   └── queue/         ← TraceBuffer.js (sliding window, 5 events / 3s)
│       ├── interfaces/
│       │   ├── http/          ← Express app.js, health route
│       │   └── sockets/       ← SocketManager.js, handlers/, middlewares/
│       └── utils/             ← logger.js, retry.js
│
├── docs/
│   ├── architecture.md        ← Diagrama de carpetas y responsabilidades
│   ├── synaptic_arch_overview.png
│   └── synaptic_data_flow.png
│
└── README.md                  ← Descripción completa del proyecto
```

---

## Cómo Ejecutar en Desarrollo

```bash
# Terminal 1 — Servidor Node.js
cd server
cp .env.example .env        # Configurar variables de entorno
npm install
npm run dev                  # Arranca en :3001 con --watch

# Terminal 2 — Cliente React
cd client
npm install
npm run dev                  # Arranca en :5173

# Terminal 3 — Agentes IA (opcional, el servidor tiene fallback)
cd agents
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

---

## Variables de Entorno

### `server/.env`
```env
PORT=3001
NODE_ENV=development
AI_AGENT_BASE_URL=http://localhost:8000
AI_AGENT_TIMEOUT_MS=5000
AI_AGENT_MAX_RETRIES=2
TRACE_BUFFER_WINDOW_SIZE=5
TRACE_BUFFER_FLUSH_INTERVAL_MS=3000
CB_FAILURE_THRESHOLD=5
CB_RESET_TIMEOUT_MS=30000
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu_anon_key
```

### `client/.env` (crear si no existe)
```env
VITE_SERVER_URL=http://localhost:3001
```

---

## Contratos de API Críticos

### Socket.io — Handshake de Conexión
Cada cliente debe conectarse con estos campos en `socket.handshake.auth`:
```js
{
  studentId: string,    // ID único del estudiante
  sessionId: string,    // Código de sala (ej: "hackathon-2026")
  role: 'student' | 'teacher',
  displayName: string   // Nombre visible
}
```

### Socket.io — Eventos (Client → Server)
| Evento | Payload |
|---|---|
| `student:trace` | `{ timestamp: number, metrics: { wpm, pauseDurationMs, deletionCount, keystrokeCount, textSnapshot } }` |
| `mentorship:close` | `{ mentorshipId: string, reason: 'resolved' \| 'manual' \| 'timeout' }` |
| `mentorship:message` | `{ mentorshipId: string, message: string, targetStudentId: string }` |

### Socket.io — Eventos (Server → Client)
| Evento | Payload |
|---|---|
| `cognitive:state` | `{ studentId, state: 'idle'\|'flow'\|'blocked'\|'mentoring', confidence: 0-1, blockagePoint: string\|null }` |
| `mentorship:start` | `{ mentorshipId, mentor: {studentId, displayName}, mentee: {studentId, displayName}, topic, expiresAt }` |
| `mentorship:ended` | `{ mentorshipId, reason, closedBy }` |
| `mentorship:message` | `{ mentorshipId, from, fromName, message, timestamp }` |
| `session:nodeMap` | `{ sessionId, nodes: [{studentId, displayName, state, confidence, connections}], updatedAt }` |

### REST — AI Agent (Server → FastAPI)
```
POST /analyze  →  { sessionId, studentId, windowMetrics, historicalContext }
                  Response: { analysis: { state, confidence, blockagePoint } }
```

---

## Estados Cognitivos

| Estado | Significado | Color UI |
|---|---|---|
| `idle` | Sin actividad de escritura | Gris `#6b7280` |
| `analyzing` | IA procesando métricas | Ámbar `#f59e0b` |
| `flow` | Escritura fluida, comprensión alta | Verde `#10b981` |
| `blocked` | Pausa larga + borrado alto + WPM bajo | Rojo `#ef4444` |
| `mentoring` | Participando en micro-mentoría | Violeta `#8b5cf6` |

**Reglas de clasificación del agente IA:**
- `flow`: WPM > 10, pausas < 3s, backspace ratio < 0.15
- `blocked`: WPM < 5 **O** pausa > 8s, backspace ratio > 0.30
- `mentoring`: asignado por el servidor cuando `attemptMatch()` tiene éxito

---

## Arquitectura de Datos — TraceBuffer

El servidor **no llama a la IA por cada keystroke**. Usa un buffer deslizante:
- Ventana: **5 eventos** o **3 segundos** (lo que ocurra primero)
- Agrega métricas: promedio de WPM, max pausa, suma de borrados
- Si hay un análisis en vuelo, descarta nuevos eventos para ese estudiante
- Esto reduce carga de ~60 HTTP/s (30 alumnos × 2 eventos/s) a ~10 HTTP/s

---

## Convenciones de Código

### Cliente (React)
- Componentes en `PascalCase.jsx`
- Hooks en `camelCase.js` prefijados con `use`
- No usar librerías de CSS (ni Tailwind). Solo CSS custom con variables `--var`
- El Design System vive en `src/index.css`. No agregar estilos `inline` complejos fuera de componentes
- Los estilos inline en JSX solo para valores **dinámicos** (colores por estado, tamaños calculados)

### Servidor (Node.js ESM)
- Arquitectura en capas: `domain` → `application` → `infrastructure` → `interfaces`
- Las capas de arriba no importan las de abajo (el flujo de dependencia es hacia arriba)
- `server.js` es el único archivo que conoce todas las capas (Composition Root)
- Usar `createComponentLogger('nombre')` para logging estructurado con Pino

---

## Flujo Completo del Sistema

```
Estudiante tipea en Pizarra
        │
        ▼
useTracker.js captura métricas invisiblemente (cada 2s)
        │
        ▼  socket emit: 'student:trace'
        │
Servidor: traceHandler.js → TraceBuffer.push()
        │
        ▼  (cada 5 eventos o 3s)
TraceBuffer.flush() → TraceAnalysisUseCase.execute()
        │
        ▼  POST /analyze
AgentClient → FastAPI → Gemini 1.5 Pro
        │
        ▼  { state, confidence, blockagePoint }
Student domain model actualizado
        │
        ├──→ emit 'cognitive:state' al salón
        ├──→ emit 'session:nodeMap' al docente
        │
        └──→ si state === 'blocked':
              MentorshipUseCase.attemptMatch()
                    │
                    ▼
              emit 'mentorship:start' al salón
              (ambos estudiantes ven MentorPanel)
```

---

## Notas para Desarrollo

1. **El servidor tiene fallback automático**: si el agente IA no está disponible, el `AgentClient` retorna estado `idle` (nunca rompe el flujo).
2. **Las mentorías expiran en 5 minutos** automáticamente via `setInterval` en `MentorshipUseCase`.
3. **El campo `textSnapshot`** del tracker se limita a los últimos 200 caracteres antes de enviarse al servidor.
4. **El grafo D3.js** es totalmente interactivo: zoom, drag de nodos, tooltips con IA confidence.
5. **La autenticación socket es MVP**: valida presencia de campos, no JWT. Para producción agregar tokens.
6. **Supabase es fire-and-forget**: todos los writes a DB usan `.catch(log.error)` sin bloquear el flujo principal.
