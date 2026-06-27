"""Minimal single-shot Gemini agent.

An ``Agent`` pairs a system instruction with a Pydantic response schema and
performs exactly one Gemini call per ``arun``. It validates the model output
against the schema and raises ``AgentError`` on any failure, so each caller can
apply its own domain-appropriate fallback instead of crashing the request.
"""

import logging

from tools.gemini_client import generate_json, GeminiError

logger = logging.getLogger("synaptic.agent")


class AgentError(RuntimeError):
    """The agent could not produce a valid, schema-conformant result."""


class Agent:
    def __init__(self, name, model, system_instruction, response_schema=None):
        self.name = name
        self.model = model
        self.system_instruction = system_instruction
        self.response_schema = response_schema

    async def arun(self, prompt: str):
        try:
            data = await generate_json(
                prompt,
                system_instruction=self.system_instruction,
                response_schema=self.response_schema,
            )
        except GeminiError as exc:
            logger.warning("[%s] Gemini call failed: %s", self.name, exc)
            raise AgentError(str(exc)) from exc

        if self.response_schema is None:
            return data

        try:
            return self.response_schema(**data)
        except Exception as exc:  # noqa: BLE001 - pydantic ValidationError, etc.
            logger.warning("[%s] response did not match schema: %s", self.name, exc)
            raise AgentError(f"schema validation failed: {exc}") from exc
