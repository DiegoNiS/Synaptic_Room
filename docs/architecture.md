## Estructura de carpetas versionada

synaptic-room/                        ← raíz del monorepo
│
├── client/                           🟣 Maxs · React + Vite
│   ├── src/
│   │   ├── components/
│   │   │   ├── Canvas.jsx            ← pizarra colaborativa
│   │   │   ├── Tracker.jsx           ← captura keystrokes/pausas/borrados
│   │   │   ├── MentorRoom.jsx        ← pantalla dividida mentor↔bloqueado
│   │   │   └── StatusBadge.jsx       ← indicador visual de estado
│   │   ├── hooks/
│   │   │   ├── useSocket.js          ← conexión socket.io
│   │   │   └── useTracker.js         ← lógica de seguimiento
│   │   ├── pages/
│   │   │   ├── StudentView.jsx
│   │   │   └── TeacherView.jsx
│   │   └── socket.js                 ← instancia socket.io-client
│   ├── package.json
│   └── vite.config.js
│
├── server/                           🟢 Ower · Node.js + Socket.io
│   ├── src/
│   │   ├── index.js                  ← entry point Express
│   │   ├── sockets/
│   │   │   ├── sessionHandler.js     ← maneja salas y estudiantes
│   │   │   └── mentorshipHandler.js  ← activa pares de mentoría
│   │   ├── routes/
│   │   │   ├── session.js
│   │   │   └── events.js
│   │   ├── db/
│   │   │   ├── supabase.js
│   │   │   └── schema.sql            ← tablas: sesiones, eventos, pares
│   │   └── dashboard/
│   │       └── networkMap.js         ← datos del grafo para D3
│   └── package.json
│
├── agents/                           🟠 Diego · Python + Google ADK
│   ├── main.py                       ← FastAPI, expone /analyze y /match
│   ├── agents/
│   │   ├── process_trace_agent.py    ← v1: detecta bloqueos
│   │   ├── cognitive_mesh_agent.py   ← v1: asigna mentor
│   │   └── insight_narrator_agent.py ← v1: resumen para el profesor
│   ├── tools/
│   │   ├── scoring.py                ← fórmula de bloqueo (pausas+borrados)
│   │   └── session_state.py          ← estado en memoria por estudiante
│   ├── schemas/
│   │   └── events.py                 ← modelos Pydantic
│   ├── requirements.txt
│   └── .env.example                  ← GEMINI_API_KEY=...
│
├── README.md
├── .gitignore
└── docker-compose.yml                ← opcional para demo local