# Synaptic Room

### El sistema operativo de la inteligencia colectiva

> Plataforma web en tiempo real que transforma un aula tradicional en una red viva de aprendizaje colaborativo, donde la IA detecta bloqueos cognitivos y orquesta micro-mentorías automáticas entre estudiantes.

---

## Tabla de contenidos

- [El problema](#el-problema)
- [La solución](#la-solución)
- [Cómo funciona](#cómo-funciona)
- [Arquitectura del sistema](#arquitectura-del-sistema)
- [Stack tecnológico](#stack-tecnológico)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Instalación y ejecución](#instalación-y-ejecución)
- [Contratos de API](#contratos-de-api)
- [Agentes de IA](#agentes-de-ia)
- [Variables de entorno](#variables-de-entorno)
- [Equipo](#equipo)
- [Contexto del hackathon](#contexto-del-hackathon)

---

## El problema

En un salón de clases de 30 estudiantes, el docente tiene aproximadamente **90 segundos por alumno por hora de clase**. Eso no es suficiente.

Cuando un estudiante se bloquea en un ejercicio, las opciones actuales son:

- Levantar la mano y esperar (interrumpe el flujo de todos)
- Copiar la respuesta del compañero (sin aprender nada)
- Quedarse atascado en silencio hasta el final (el peor caso)

Al mismo tiempo, en ese mismo salón hay otros estudiantes que **ya dominaron el concepto** y están ociosos. El conocimiento existe en el aula, pero no hay ningún mecanismo para redistribuirlo de forma eficiente y en tiempo real.

El resultado: los estudiantes avanzados se aburren, los bloqueados se frustran, y el docente no puede atender a todos. **El conocimiento colectivo del aula se desperdicia.**

---

## La solución

**Synaptic Room** convierte el aula en una red cognitiva viva.

En lugar de actuar como un chatbot que da respuestas (que pueden ser copiadas), la IA actúa como un **puente inteligente entre estudiantes**:

1. Analiza de forma invisible el proceso de razonamiento de cada alumno mientras trabaja
2. Detecta con precisión el momento exacto en que un estudiante se bloquea
3. Identifica automáticamente al compañero mejor posicionado para ayudar
4. Conecta sus pantallas en una micro-mentoría donde el estudiante avanzado comparte su **lógica**, no la respuesta

El docente ve todo esto en un tablero en tiempo real: un mapa de red donde cada estudiante es un nodo que cambia de color según su estado cognitivo, y puede observar cómo el conocimiento fluye orgánicamente por el salón.

---

## Cómo funciona

### El flujo completo de una sesión

```
Estudiante escribe en el canvas
         │
         ▼
Tracker invisible captura métricas
(ritmo de escritura, pausas, borrados)
         │
         ▼ Socket.io evento: "trace"
         │
Servidor Node.js recibe el evento
         │
         ▼ POST /analyze
         │
Agente Process Trace AI (Google ADK)
analiza el patrón con Gemini 1.5 Pro
         │
    ┌────┴────┐
    │         │
  FLUJO    BLOQUEADO
    │         │
    │         ▼
    │  Agente Cognitive Mesh
    │  busca el mejor mentor disponible
    │         │
    │         ▼ Socket.io evento: "mentorship:start"
    │         │
    └────┬────┘
         │
Tablero del docente se actualiza
Nodos cambian de color en tiempo real
```

### Los tres pilares del sistema

**1. Process Trace AI** — El detector de bloqueos

No evalúa la respuesta final (que podría copiarse). En cambio, monitorea el proceso:

- Velocidad de escritura (palabras por minuto y variaciones)
- Duración y frecuencia de pausas
- Patrones de borrado y reescritura
- Tiempo total invertido vs. progreso logrado

Con estos datos, Gemini 1.5 Pro clasifica el estado cognitivo del estudiante:
`flujo` → `procesando` → `bloqueado`

**2. Cognitive Mesh** — El enrutador de conocimiento

Cuando detecta un bloqueo, no llama al docente. Busca dentro del mismo salón:

- Estudiantes en estado `flujo` que completaron el mismo ejercicio
- Disponibilidad para mentorear (no están en otra micro-mentoría activa)
- Historial de efectividad como mentor en sesiones anteriores

Crea una conexión directa entre las dos pantallas para la micro-mentoría.

**3. Tablero del docente** — La visión de red

El docente ve en tiempo real:

- Cada estudiante como un nodo en un grafo D3.js
- Colores que codifican el estado cognitivo (verde = flujo, rojo = bloqueado, morado = en mentoría)
- Líneas punteadas que aparecen cuando se activa una micro-mentoría
- Contadores globales de cuántos están en flujo, bloqueados o siendo mentoreados

---

## Arquitectura del sistema

```
┌─────────────────────────────────────────────────────────────┐
│                      CAPA CLIENTE                           │
│                   React + Socket.io-client                  │
│                                                             │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│   │  UI Estudiante│  │Panel mentoría│  │Tablero docente│   │
│   │Canvas + tracker│ │Pantalla divid│  │  D3.js graph  │   │
│   └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                        WebSocket
                              │
┌─────────────────────────────────────────────────────────────┐
│                    SERVIDOR CENTRAL                         │
│               Node.js + Express + Socket.io                 │
│                                                             │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│   │ Socket.io hub│  │  Supabase DB │  │  API Gateway │    │
│   │ Rooms/sesión │  │Sesiones/events│  │Proxy → FastAPI│   │
│   └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                          HTTP REST
                              │
┌─────────────────────────────────────────────────────────────┐
│                    CAPA DE AGENTES IA                       │
│                Python + Google ADK + FastAPI                │
│                                                             │
│   ┌──────────────────┐        ┌──────────────────┐        │
│   │ Process Trace AI │        │  Cognitive Mesh  │        │
│   │  Agent ADK v0.1  │        │  Agent ADK v0.1  │        │
│   └──────────┬───────┘        └────────┬─────────┘        │
│              └────────────┬────────────┘                   │
│                           │                                │
│                  ┌────────┴────────┐                       │
│                  │  Gemini 1.5 Pro │                       │
│                  │  Google AI API  │                       │
│                  └─────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Stack tecnológico

### Frontend

| Tecnología       | Versión | Uso                               |
| ---------------- | ------- | --------------------------------- |
| React            | ^18.2   | Framework UI principal            |
| Vite             | ^5.0    | Bundler y dev server              |
| Socket.io-client | ^4.7    | Comunicación en tiempo real       |
| D3.js            | ^7.8    | Visualización del tablero docente |
| React Router     | ^6.x    | Routing estudiante/docente        |

### Backend

| Tecnología  | Versión | Uso                      |
| ----------- | ------- | ------------------------ |
| Node.js     | ^20.x   | Runtime del servidor     |
| Express     | ^4.18   | Framework HTTP           |
| Socket.io   | ^4.7    | Hub WebSocket central    |
| Supabase JS | ^2.x    | Cliente de base de datos |
| node-fetch  | ^3.x    | Proxy hacia FastAPI      |

### Agentes IA

| Tecnología          | Versión | Uso                        |
| ------------------- | ------- | -------------------------- |
| Python              | ^3.11   | Runtime de agentes         |
| Google ADK          | ^0.1    | Framework de agentes de IA |
| FastAPI             | ^0.110  | API REST de los agentes    |
| Uvicorn             | ^0.27   | Servidor ASGI              |
| google-generativeai | ^0.5    | Cliente Gemini API         |

### Infraestructura

| Tecnología     | Uso                             |
| -------------- | ------------------------------- |
| Supabase       | Base de datos PostgreSQL + Auth |
| Docker Compose | Orquestación local de servicios |
| GitHub         | Control de versiones            |

---

## Estructura del repositorio

```
synaptic-room/
├── frontend/                         # Capa cliente (Maxs)
│   ├── public/
│   └── src/
│       ├── components/
│       │   ├── Canvas.jsx            # Pizarra compartida del estudiante
│       │   ├── KeystrokeTracker.jsx  # Tracker invisible de escritura
│       │   ├── MentorPanel.jsx       # UI de micro-mentoría (pantalla dividida)
│       │   ├── NodeMap.jsx           # Grafo D3.js del tablero docente
│       │   └── TeacherDashboard.jsx  # Componente padre del tablero
│       ├── hooks/
│       │   └── useSocket.js          # Hook para conexión WebSocket
│       ├── App.jsx                   # Routing principal
│       └── main.jsx
│
├── server/                           # Servidor central (Ower) - Clean Architecture (DDD)
│   ├── src/
│   │   ├── application/             # Casos de uso (MentorshipUseCase, TraceAnalysisUseCase)
│   │   ├── domain/                  # Entidades puras y eventos (Student, Session, Mentorship)
│   │   ├── infrastructure/          # Detalles (Supabase Repo, AgentClient, CircuitBreaker)
│   │   ├── interfaces/              # Puntos de entrada (Socket.io handlers, Express routes)
│   │   └── server.js                # Entry point y Composition Root (Inyección de dependencias)
│   ├── tests/                       # Pruebas unitarias nativas (node:test)
│   ├── db/                          # Esquemas SQL de Supabase (schema.sql)
│   └── package.json
│
├── agents/                           # Agentes IA (Diego)
│   ├── main.py                       # FastAPI entry point, define rutas
│   ├── agents/
│   │   ├── process_trace.py         # Agente ADK: detecta bloqueos
│   │   └── cognitive_mesh.py        # Agente ADK: selecciona mentor
│   ├── tools/
│   │   └── gemini_client.py         # Wrapper Gemini 1.5 Pro
│   ├── models/
│   │   └── schemas.py               # Modelos Pydantic (request/response)
│   └── requirements.txt
│
├── docs/
│   ├── architecture.md              # Diagramas de arquitectura
│   └── api_contracts.md             # Contratos entre servicios
│
├── docker-compose.yml               # Levanta frontend + server + agents
└── README.md                        # Este archivo
```

---

## Instalación y ejecución

### Prerequisitos

- Node.js >= 20.x
- Python >= 3.11
- Una cuenta en [Google AI Studio](https://aistudio.google.com) (para la API key de Gemini)
- Una cuenta en [Supabase](https://supabase.com) (plan gratuito es suficiente)

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-equipo/synaptic-room.git
cd synaptic-room
```

### 2. Configurar variables de entorno

```bash
# En la raíz del proyecto
cp .env.example .env
# Editar .env con tus claves (ver sección Variables de entorno)
```

### 3. Instalar dependencias

```bash
# Frontend
cd frontend && npm install

# Servidor
cd ../server && npm install

# Agentes
cd ../agents && pip install -r requirements.txt
```

### 4. Opción A — Levantar todo con Docker

```bash
# Desde la raíz del proyecto
docker-compose up --build
```

### 4. Opción B — Levantar cada servicio manualmente

```bash
# Terminal 1: Agentes IA
cd agents
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2: Servidor Node.js
cd server
node index.js

# Terminal 3: Frontend
cd frontend
npm run dev
```

### 5. Acceder a la aplicación

| Rol         | URL                                 |
| ----------- | ----------------------------------- |
| Estudiante  | `http://localhost:5173/student/:id` |
| Docente     | `http://localhost:5173/teacher`     |
| API agentes | `http://localhost:8000/docs`        |
| Servidor WS | `http://localhost:3001`             |

---

## Contratos de API

### Contrato crítico: Server → Agentes

Este es el contrato más importante del sistema. Si cambia, los tres servicios se rompen.

#### `POST /analyze` — Analizar estado cognitivo

**Request** (enviado por `server/src/infrastructure/ai/AgentClient.js` mediante `TraceAnalysisUseCase`):

```json
{
  "student_id": "string",
  "session_id": "string",
  "trace": {
    "wpm": 12.4,
    "pause_duration_ms": 8500,
    "backspace_ratio": 0.34,
    "elapsed_seconds": 120,
    "chars_written": 45
  }
}
```

**Response** (recibido del agente `process_trace.py`):

```json
{
  "student_id": "string",
  "estado": "flujo" | "procesando" | "bloqueado",
  "confianza": 0.87,
  "razon": "Pausa prolongada con alto ratio de borrado"
}
```

#### `POST /match-mentor` — Encontrar mentor

**Request** (enviado cuando `estado === "bloqueado"`):

```json
{
  "blocked_student_id": "string",
  "session_id": "string",
  "available_mentors": ["id1", "id2", "id3"]
}
```

**Response** (recibido del agente `cognitive_mesh.py`):

```json
{
  "mentor_id": "string",
  "blocked_id": "string",
  "match_score": 0.92
}
```

### Eventos Socket.io

| Evento             | Dirección          | Payload                | Descripción                     |
| ------------------ | ------------------ | ---------------------- | ------------------------------- |
| `trace`            | Cliente → Servidor | `{student_id, trace}`  | Datos del tracker de escritura  |
| `classroom:state`  | Servidor → Cliente | `{students: [...]}`    | Estado completo del salón       |
| `mentorship:start` | Servidor → Cliente | `{mentor, blocked}`    | Inicia una micro-mentoría       |
| `mentorship:end`   | Servidor → Cliente | `{mentor, blocked}`    | Termina una micro-mentoría      |
| `node:update`      | Servidor → Cliente | `{student_id, estado}` | Actualiza un nodo en el tablero |

---

## Agentes de IA

### Configuración de Google ADK

Los agentes están construidos con [Google Agent Development Kit (ADK)](https://google.github.io/adk-docs/), el framework oficial de Google para construir agentes de IA sobre Gemini.

```bash
pip install google-adk
```

### Process Trace AI (`agents/agents/process_trace.py`)

Agente ADK que recibe métricas de comportamiento de escritura y clasifica el estado cognitivo del estudiante.

**Lógica de clasificación:**

- `flujo`: WPM estable > 10, pausas < 3s, backspace ratio < 0.15
- `procesando`: WPM variable, pausas 3-8s, backspace ratio 0.15-0.30
- `bloqueado`: WPM < 5 o pausa > 8s, backspace ratio > 0.30

El agente usa Gemini para analizar el contexto completo y tomar la decisión final, superando las reglas simples de umbral.

### Cognitive Mesh (`agents/agents/cognitive_mesh.py`)

Agente ADK que selecciona el mejor mentor disponible para un estudiante bloqueado.

**Criterios de matching:**

1. El mentor debe estar en estado `flujo` (no procesando, no bloqueado, no en mentoría)
2. Preferencia por mentores que completaron el mismo tipo de ejercicio
3. Considera el historial de sesiones anteriores (efectividad como mentor)

---

## Variables de entorno

Crear un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
# Google Gemini API
GEMINI_API_KEY=tu_api_key_aqui

# Supabase
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu_anon_key_aqui

# Servidor
PORT=3001
AGENTS_URL=http://localhost:8000

# Frontend
VITE_SERVER_URL=http://localhost:3001
```

Obtener las claves:

- **Gemini API Key**: [Google AI Studio](https://aistudio.google.com/app/apikey)
- **Supabase URL y Key**: [Supabase Dashboard](https://app.supabase.com) → Settings → API

---

## Equipo

| Nombre | Rol                        | Responsabilidad                               |
| ------ | -------------------------- | --------------------------------------------- |
| Diego  | Líder técnico · Agentes IA | Google ADK, FastAPI, integración Gemini       |
| Maxs   | Frontend                   | React, Canvas, KeystrokeTracker, MentorPanel  |
| Ower   | Backend                    | Node.js, Socket.io, Supabase, Tablero docente |

---

## Contexto del hackathon

**Evento:** NEXIA Build with AI 2026

**Categoría:** Propuesta Libre (IA + Educación)

**Problema abordado:** Transformar procesos educativos usando IA para crear un aula más inteligente, colaborativa y eficiente.

**Por qué Synaptic Room gana el hackathon:**

La mayoría de soluciones de IA en educación reemplazan al docente con un chatbot. Synaptic Room hace algo diferente: **amplifica la inteligencia que ya existe en el aula**. El conocimiento no viene de afuera, viene de los propios estudiantes. La IA solo actúa como el sistema nervioso que conecta las neuronas correctas en el momento correcto.

Esto resuelve tres problemas a la vez:

- **Inclusión**: ningún estudiante se queda bloqueado en silencio
- **Evaluación inteligente**: el sistema evalúa el proceso de razonamiento, no la respuesta final (que puede copiarse)
- **Escalabilidad**: funciona con 10 o con 100 estudiantes sin requerir más docentes

**Diferenciadores técnicos:**

- Uso de Google ADK para construir agentes de IA reales (no solo llamadas a LLM)
- Análisis de proceso cognitivo en tiempo real (no solo resultados)
- Arquitectura full-stack con WebSockets para sincronización instantánea
- Visualización de red con D3.js que hace visible el conocimiento colectivo

---

_Synaptic Room — Hackathon NEXIA 2026_
