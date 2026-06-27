"""Lightweight Gemini agent runtime for Synaptic Room.

This is intentionally small and honest: it is NOT Google ADK. It wraps a single
Gemini call with a system prompt and an enforced Pydantic response schema.
"""

from .agent import Agent, AgentError

__all__ = ["Agent", "AgentError"]
