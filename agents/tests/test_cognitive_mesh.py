# ============================================
# Tests — Cognitive Mesh AI (mentor matching logic)
# ============================================
# Verifies deterministic edge cases and the safety guards that keep the AI's
# orchestration trustworthy (NN-3) and resilient (NN-1), without calling Gemini.
# Traceability: P0-R-005 · verifies P0-AC-005 · task P0-T-009.
# ============================================

import pytest

import agents.cognitive_mesh as cm
from agents.cognitive_mesh import run_cognitive_mesh
from gemini_agent import AgentError
from models.schemas import MatchMentorResponse, MentorProfile


def _mentor(mid, confidence, flow_ms=10000, challenge=None):
    return MentorProfile(
        id=mid,
        displayName=f"Name-{mid}",
        confidence=confidence,
        timeInFlowMs=flow_ms,
        currentChallenge=challenge,
    )


@pytest.mark.asyncio
async def test_no_mentors_returns_none():
    resp = await run_cognitive_mesh("blocked-1", [], "límite 0/0")
    assert resp.mentorId == "none"
    assert resp.matchScore == 0.0


@pytest.mark.asyncio
async def test_single_mentor_is_chosen_deterministically():
    resp = await run_cognitive_mesh("blocked-1", [_mentor("m1", 0.9)], "x")
    assert resp.mentorId == "m1"
    assert resp.matchScore <= 0.75  # capped for a forced single-candidate match


@pytest.mark.asyncio
async def test_falls_back_to_highest_confidence_when_ai_fails(monkeypatch):
    async def boom(_prompt):
        raise AgentError("gemini down")

    monkeypatch.setattr(cm.cognitive_mesh_agent, "arun", boom)
    mentors = [_mentor("m1", 0.6), _mentor("m2", 0.95), _mentor("m3", 0.7)]
    resp = await run_cognitive_mesh("blocked-1", mentors, "x")
    assert resp.mentorId == "m2"  # highest confidence


@pytest.mark.asyncio
async def test_rejects_hallucinated_mentor_id(monkeypatch):
    async def hallucinate(_prompt):
        return MatchMentorResponse(mentorId="ghost", blockedId="blocked-1", matchScore=0.9)

    monkeypatch.setattr(cm.cognitive_mesh_agent, "arun", hallucinate)
    mentors = [_mentor("m1", 0.6), _mentor("m2", 0.95)]
    resp = await run_cognitive_mesh("blocked-1", mentors, "x")
    # Model invented an off-roster id → guard falls back to a real mentor.
    assert resp.mentorId in {"m1", "m2"}
    assert resp.mentorId == "m2"


@pytest.mark.asyncio
async def test_accepts_valid_ai_selection(monkeypatch):
    async def good(_prompt):
        return MatchMentorResponse(mentorId="m1", blockedId="blocked-1", matchScore=0.88)

    monkeypatch.setattr(cm.cognitive_mesh_agent, "arun", good)
    mentors = [_mentor("m1", 0.8, challenge="grafos"), _mentor("m2", 0.7)]
    resp = await run_cognitive_mesh("blocked-1", mentors, "grafos")
    assert resp.mentorId == "m1"
    assert resp.matchScore == 0.88
