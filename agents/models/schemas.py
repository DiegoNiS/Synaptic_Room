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

class MentorProfile(BaseModel):
    """
    Rich mentor profile sent by the Node.js server.
    Provides the AI with real context to make informed
    mentor selections instead of choosing from blind IDs.
    """
    id: str
    displayName: str
    confidence: float               # AI confidence in their 'flow' state (0.0-1.0)
    timeInFlowMs: float             # How long they've been in flow state (ms)
    currentChallenge: Optional[str] = None  # Which challenge they're working on

class MatchMentorRequest(BaseModel):
    blockedStudentId: str
    sessionId: str
    blockagePoint: Optional[str] = None  # What the blocked student is struggling with
    availableMentors: List[MentorProfile]  # Rich profiles instead of plain IDs

class MatchMentorResponse(BaseModel):
    mentorId: str
    blockedId: str
    matchScore: float

