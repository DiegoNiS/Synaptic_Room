from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

from models.schemas import AnalyzeRequest, AnalyzeResponse, MatchMentorRequest, MatchMentorResponse
from agents.process_trace import run_process_trace
from agents.cognitive_mesh import run_cognitive_mesh

app = FastAPI(
    title="Synaptic Room - AI Agents API",
    description="API de agentes de inteligencia artificial construidos con Google ADK para análisis cognitivo.",
    version="0.1.0"
)

# Configurar CORS (necesario si el frontend web se comunica directamente, o por el proxy del server Node.js)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Synaptic Room AI Agents API corriendo"}

@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze_trace(request: AnalyzeRequest):
    """
    Recibe métricas de tecleo y decide el estado cognitivo del estudiante.
    """
    try:
        response = await run_process_trace(request.student_id, request.trace)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en el agente de Process Trace: {str(e)}")

@app.post("/match-mentor", response_model=MatchMentorResponse)
async def match_mentor(request: MatchMentorRequest):
    """
    Busca al mejor mentor disponible para un estudiante bloqueado.
    """
    try:
        response = await run_cognitive_mesh(request.blocked_student_id, request.available_mentors)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en el agente Cognitive Mesh: {str(e)}")
