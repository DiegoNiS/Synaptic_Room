import os
import logging
import traceback

from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware

from models.schemas import AnalyzeRequest, AnalyzeResponse, MatchMentorRequest, MatchMentorResponse
from agents.process_trace import run_process_trace
from agents.cognitive_mesh import run_cognitive_mesh

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s :: %(message)s",
)
logger = logging.getLogger("synaptic.api")

# Shared secret required from the Node server. Empty = dev mode (no auth).
AGENT_API_KEY = os.getenv("AGENT_API_KEY", "").strip()
# Server-to-server only: the browser never calls this API directly.
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("AGENT_ALLOWED_ORIGINS", "").split(",") if o.strip()]

app = FastAPI(
    title="Synaptic Room - AI Agents API",
    description="Lightweight Gemini agents for cognitive analysis (Process Trace AI + Cognitive Mesh).",
    version="0.3.0",
)

# Tight CORS: agents are reached server-to-server, so default to no browser origins.
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


async def require_agent_key(x_agent_key: str | None = Header(default=None)):
    """Reject calls without the shared secret. No-op when AGENT_API_KEY is unset (dev)."""
    if not AGENT_API_KEY:
        return
    if x_agent_key != AGENT_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing agent API key")


@app.on_event("startup")
async def _startup_banner():
    if not AGENT_API_KEY:
        logger.warning("AGENT_API_KEY not set — the agents API is UNAUTHENTICATED (dev only).")
    if not ALLOWED_ORIGINS:
        logger.info("CORS: no browser origins allowed (server-to-server mode).")


@app.get("/")
def read_root():
    return {"status": "ok", "message": "Synaptic Room AI Agents API", "version": "0.3.0"}


@app.get("/health")
def health_check():
    from tools.gemini_client import GEMINI_CONFIGURED, MODEL_NAME

    return {
        "status": "healthy",
        "gemini_configured": GEMINI_CONFIGURED,
        "model": MODEL_NAME,
    }


@app.post("/analyze", response_model=AnalyzeResponse, dependencies=[Depends(require_agent_key)])
async def analyze_trace(request: AnalyzeRequest):
    """Deep semantic analysis of a student's blockage. Only invoked after the
    server-side heuristic has already classified the student as 'blocked'."""
    try:
        return await run_process_trace(
            request.studentId, request.windowMetrics, request.historicalContext
        )
    except Exception as e:  # noqa: BLE001 - run_process_trace degrades internally; this is a last resort
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Process Trace error: {e}")


@app.post("/match-mentor", response_model=MatchMentorResponse, dependencies=[Depends(require_agent_key)])
async def match_mentor(request: MatchMentorRequest):
    """Select the best available mentor for a blocked student."""
    try:
        return await run_cognitive_mesh(
            request.blockedStudentId, request.availableMentors, request.blockagePoint
        )
    except Exception as e:  # noqa: BLE001
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Cognitive Mesh error: {e}")
