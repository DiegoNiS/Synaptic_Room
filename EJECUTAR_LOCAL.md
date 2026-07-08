# Ejecutar Synaptic Room en local (hasta Fase 1)

Dos formas: **A) Docker (un solo comando, recomendado)** o **B) manual** (servicio por servicio).

---

## Opción A — Docker Compose (recomendado)

Levanta TODO el sistema (Redis + agentes + servidor + cliente) con un comando, sin entrar a cada
carpeta ni manejar puertos a mano.

Requisito: Docker Desktop (incluye `docker compose`).

```bash
# 1. Preparar variables (una sola vez). El repo ya trae .env; si no, cópialo:
cp .env.example .env         # (en Windows PowerShell: copy .env.example .env)

# 2. Levantar todo
docker compose up --build
```

Cuando termine de construir verás los 4 servicios sanos. Abre:

- Cliente (UI):   http://localhost:5174
- Servidor API:   http://localhost:3001  (`/healthz`, `/readyz`, `/health`)
- Agentes API:    http://localhost:8000

Para apagar: `Ctrl+C` y luego `docker compose down` (agrega `-v` para borrar el volumen de Redis).

Notas:
- El único valor obligatorio en `.env` es `GEMINI_API_KEY` (ya viene puesto). Todo lo demás tiene
  defaults de desarrollo.
- Docker usa automáticamente el servicio **Redis** incluido (estado durable de Fase 1); tú no
  configuras nada.
- El passcode de docente por defecto es `123456` (variable `TEACHER_PASSCODE`).
- Arranca en modo desarrollo sin auth (`NEXORA_DEV_INSECURE=true`) para que funcione sin fricción.
  Para un arranque seguro: en `.env` pon `NEXORA_DEV_INSECURE=false` y secretos reales.

---

## Opción B — Manual (sin Docker)

Guía verificada para correr los tres servicios por separado. El servidor ya se probó arrancando de
verdad: `/healthz`, `/readyz`, `/health` y `/api/auth/join` responden correctamente.

### Requisitos

- Node.js >= 20.11 (recomendado 20 LTS o 22)
- Python 3.10+
- Redis: **opcional**. Sin Redis, corre en modo in-memory (una sola instancia).

### Importante (cambios de esta fase)

- **Dependencias nuevas** en `server/` (`ioredis`, `@socket.io/redis-adapter`) y devDeps en
  `client/` y `agents/`. Por eso hay que correr `npm install` / `pip install` de nuevo.
- Usa **`npm install`**, no `npm ci` (los `package-lock.json` quedaron desactualizados al añadir
  dependencias; regenéralos con `npm install`).
- **Secure-by-default**: el servidor NO arranca sin los secretos `JOIN_TOKEN_SECRET`,
  `AGENT_API_KEY`, `TEACHER_PASSCODE`, salvo que pongas `NEXORA_DEV_INSECURE=true`. Tu `.env` raíz
  ya tiene ambos (los secretos y el flag), así que arranca sin fricción.

---

## 1) Agentes IA (FastAPI + Gemini) — puerto 8000

```powershell
cd agents
python -m venv .venv
.\.venv\Scripts\activate            # PowerShell.  (cmd: .venv\Scripts\activate.bat)
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

- Necesita `GEMINI_API_KEY` en `agents/.env` (ya lo tienes).
- Para autenticar el canal servidor->agentes, añade a `agents/.env` la MISMA clave que el servidor:
  `AGENT_API_KEY=secreto_compartido_entre_node_y_python_456`. Si la dejas vacía, los agentes corren
  sin auth en local (también funciona).

## 2) Servidor (Node + Socket.io) — puerto 3001

En otra terminal:

```powershell
cd server
npm install
npm start
```

- Lee `..\.env` (el `.env` de la raíz), que ya está configurado.
- Verás en el log `State runtime ready (redis:false)` y `listening on 3001`. Si `NEXORA_DEV_INSECURE=true`,
  también verás el aviso de modo inseguro (normal en local).
- Comprobación rápida (otra terminal):
  ```powershell
  curl http://localhost:3001/healthz     # {"status":"alive",...}
  curl http://localhost:3001/readyz      # {"status":"ready","ready":true,...}
  ```

## 3) Cliente (React + Vite) — puerto 5173

En otra terminal:

```powershell
cd client
npm install
npm run dev
```

Abre http://localhost:5173. El cliente usa `VITE_SERVER_URL` (o `http://localhost:3001` por defecto).

---

## Correr las pruebas (opcional, para confirmar)

```powershell
# Servidor (44 tests: Fase 0 + Fase 1, incluida la prueba de caos multi-instancia)
cd server
npm install
npm test

# Agentes (9 tests de clasificación/resiliencia)
cd ..\agents
pip install -r requirements-dev.txt
pytest -q

# Cliente (lógica del tracker)
cd ..\client
npm install
npm test

# Benchmark de latencia local del motor de reglas (presupuesto 300 ms)
cd ..\server
npm run bench
```

## Activar estado durable + escala horizontal (opcional)

Para usar Redis (estado que sobrevive reinicios y varias instancias):

1. Levanta Redis (p. ej. `docker run -p 6379:6379 redis:7`).
2. En el `.env` raíz añade: `REDIS_URL=redis://localhost:6379`.
3. Reinicia el servidor. Verás `durableState: true` y el adaptador Redis de Socket.io activado.

## Notas

- Si el servidor no arranca y se queja de un secreto, revisa que el `.env` raíz tenga
  `JOIN_TOKEN_SECRET`, `AGENT_API_KEY`, `TEACHER_PASSCODE` (o `NEXORA_DEV_INSECURE=true`).
- La IA aparece "degraded" en `/health` si los agentes no están arriba: es el comportamiento
  esperado (el aula sigue funcionando sin IA por diseño).
