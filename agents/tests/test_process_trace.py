# ============================================
# Tests — Process Trace AI (agent logic)
# ============================================
# Verifies the resilience + invariant contract of the deep-analysis agent
# WITHOUT calling Gemini. The AI remains the diagnosis component (NN-3); these
# tests pin how its output is bounded and how failures degrade (NN-1).
# Traceability: P0-R-005 · verifies P0-AC-005 · task P0-T-009.
# ============================================

import pytest

import agents.process_trace as pt
from agents.process_trace import _degraded, run_process_trace
from gemini_agent import AgentError
from models.schemas import AnalysisResult, HistoricalContext, WindowMetrics


def _metrics():
    return WindowMetrics(
        wpm=2,
        pauseDurationMs=9000,
        deletionCount=20,
        keystrokeCount=30,
        textSnapshot="no entiendo cómo empezar",
        windowSizeMs=5000,
        eventCount=10,
    )


def _context():
    return HistoricalContext(lastState="blocked", blockedForMs=12000)


@pytest.mark.asyncio
async def test_degrades_safely_when_ai_fails(monkeypatch):
    async def boom(_prompt):
        raise AgentError("gemini down")

    monkeypatch.setattr(pt.process_trace_agent, "arun", boom)
    resp = await run_process_trace("stu-1", _metrics(), _context())
    assert resp.studentId == "stu-1"
    assert resp.analysis.state == "blocked"  # never breaks the flow (NN-1)
    assert resp.analysis.blockagePoint  # a human-readable fallback is present


@pytest.mark.asyncio
async def test_forces_blocked_invariant_even_if_model_disagrees(monkeypatch):
    async def wrong_state(_prompt):
        return AnalysisResult(state="flow", confidence=0.9, blockagePoint="regla de la cadena")

    monkeypatch.setattr(pt.process_trace_agent, "arun", wrong_state)
    resp = await run_process_trace("stu-2", _metrics(), _context())
    # This agent is only called for blocked students — invariant enforced.
    assert resp.analysis.state == "blocked"
    assert resp.analysis.blockagePoint == "regla de la cadena"


@pytest.mark.asyncio
async def test_passes_through_valid_blocked_diagnosis(monkeypatch):
    async def good(_prompt):
        return AnalysisResult(state="blocked", confidence=0.82, blockagePoint="límite 0/0")

    monkeypatch.setattr(pt.process_trace_agent, "arun", good)
    resp = await run_process_trace("stu-3", _metrics(), _context())
    assert resp.analysis.confidence == 0.82
    assert resp.analysis.blockagePoint == "límite 0/0"


def test_degraded_helper_is_schema_valid():
    result = _degraded()
    assert result.state == "blocked"
    assert 0.0 <= result.confidence <= 1.0
