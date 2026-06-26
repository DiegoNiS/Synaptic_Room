# Synaptic Room — API Contracts v1.0
## Contratos de Comunicación entre Frontend, Backend y Agentes IA

> **ENVÍA ESTE DOCUMENTO A MAXS Y DIEGO INMEDIATAMENTE**
> Estos son los contratos exactos que deben usar para programar. Si alguien los cambia, debe avisar a los otros dos.

---

## 1. Frontend → Backend (Socket.io Events)

### `student:join` — Al conectar (automático en el handshake)
```json
// Socket handshake auth (Maxs debe enviar esto al conectar)
{
  "auth": {
    "studentId": "uuid-del-alumno",
    "sessionId": "uuid-de-la-sesion",
    "role": "student",
    "displayName": "Juan Pérez"
  }
}
```

### `student:trace` — Cada ~500ms mientras el alumno escribe
```json
{
  "timestamp": 1719423600000,
  "metrics": {
    "wpm": 45,
    "pauseDurationMs": 1200,
    "deletionCount": 3,
    "keystrokeCount": 22,
    "textSnapshot": "últimos 200 caracteres del texto..."
  }
}
```

### `mentorship:close` — Cuando alguien cierra la mentoría
```json
{
  "mentorshipId": "uuid-de-la-mentoria",
  "reason": "resolved"
}
```
*Reasons válidos: `"resolved"` | `"timeout"` | `"manual"`*

---

## 2. Backend → Frontend (Socket.io Events)

### `cognitive:state` — Estado cognitivo actualizado (broadcast a toda la sala)
```json
{
  "studentId": "uuid-del-alumno",
  "state": "blocked",
  "confidence": 0.87,
  "blockagePoint": "No logra conectar la derivada con la integral"
}
```
*States válidos: `"flow"` | `"blocked"` | `"idle"` | `"analyzing"` | `"mentoring"`*

### `mentorship:start` — Se asignó una micro-mentoría
```json
{
  "mentorshipId": "uuid-generado",
  "mentor": {
    "studentId": "uuid-mentor",
    "displayName": "María López"
  },
  "mentee": {
    "studentId": "uuid-mentee",
    "displayName": "Carlos Ruiz"
  },
  "topic": "Bloqueo en concepto de derivadas",
  "expiresAt": 1719423900000
}
```

### `mentorship:ended` — Se cerró una mentoría
```json
{
  "mentorshipId": "uuid",
  "reason": "resolved",
  "closedBy": "uuid-de-quien-cerró"
}
```

### `session:nodeMap` — Mapa para el tablero del docente (solo al teacher)
```json
{
  "sessionId": "uuid-sesion",
  "nodes": [
    {
      "studentId": "uuid",
      "displayName": "Juan Pérez",
      "state": "flow",
      "confidence": 0.92,
      "connections": []
    },
    {
      "studentId": "uuid2",
      "displayName": "Ana García",
      "state": "mentoring",
      "confidence": 0.3,
      "connections": ["uuid-mentorship"]
    }
  ],
  "updatedAt": 1719423600000
}
```

---

## 3. Backend → Agentes IA (HTTP)

### `POST http://localhost:8000/analyze`

**Request Body (lo que Ower envía a Diego):**
```json
{
  "sessionId": "uuid-sesion",
  "studentId": "uuid-alumno",
  "windowMetrics": {
    "wpm": 42,
    "pauseDurationMs": 2300,
    "deletionCount": 8,
    "keystrokeCount": 105,
    "textSnapshot": "últimos 200 chars...",
    "windowSizeMs": 2500,
    "eventCount": 5
  },
  "historicalContext": {
    "lastState": "flow",
    "blockedForMs": 0
  }
}
```

**Response Body (lo que Diego debe devolver EXACTAMENTE):**
```json
{
  "studentId": "uuid-alumno",
  "analysis": {
    "state": "blocked",
    "confidence": 0.85,
    "blockagePoint": "El estudiante no logra formular la hipótesis correctamente",
    "suggestedMentorProfile": {
      "minWpm": 50,
      "topicKeywords": ["hipótesis", "método científico"]
    }
  },
  "processingMs": 340
}
```

### `GET http://localhost:8000/health`
**Response:** `200 OK` (cualquier body)

---

## 4. Puertos por Defecto

| Servicio | Puerto | Responsable |
|---|---|---|
| Frontend (React) | 5173 | Maxs |
| Backend (Node.js) | 3001 | Ower |
| Agentes IA (FastAPI) | 8000 | Diego |
