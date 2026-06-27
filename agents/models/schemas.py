from pydantic import BaseModel
from typing import List, Literal, Optional

# --- Modelos para el endpoint /analyze ---

class WindowMetrics(BaseModel):
    wpm: float
    pauseDurationMs: float
    deletionCount: float
    keystrokeCount: float
    textSnapshot: str
    windowSizeMs: float
    eventCount: float

class HistoricalContext(BaseModel):
    lastState: str
    blockedForMs: float

class AnalyzeRequest(BaseModel):
    studentId: str
    sessionId: str
    windowMetrics: WindowMetrics
    historicalContext: HistoricalContext

class AnalysisResult(BaseModel):
    state: Literal["flow", "blocked", "idle", "analyzing"]
    confidence: float
    blockagePoint: Optional[str] = None

class AnalyzeResponse(BaseModel):
    studentId: str
    analysis: AnalysisResult

# --- Modelos para el endpoint /match-mentor ---

class MatchMentorRequest(BaseModel):
    blockedStudentId: str
    sessionId: str
    availableMentors: List[str]

class MatchMentorResponse(BaseModel):
    mentorId: str
    blockedId: str
    matchScore: float
