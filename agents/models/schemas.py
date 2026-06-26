from pydantic import BaseModel
from typing import List, Literal, Optional

# --- Modelos para el endpoint /analyze ---

class TraceMetrics(BaseModel):
    wpm: float
    pause_duration_ms: int
    backspace_ratio: float
    elapsed_seconds: int
    chars_written: int

class AnalyzeRequest(BaseModel):
    student_id: str
    session_id: str
    trace: TraceMetrics

class AnalyzeResponse(BaseModel):
    student_id: str
    estado: Literal["flujo", "procesando", "bloqueado"]
    confianza: float
    razon: str

# --- Modelos para el endpoint /match-mentor ---

class MatchMentorRequest(BaseModel):
    blocked_student_id: str
    session_id: str
    available_mentors: List[str]

class MatchMentorResponse(BaseModel):
    mentor_id: str
    blocked_id: str
    match_score: float
