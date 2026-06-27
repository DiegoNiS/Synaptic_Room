"""Thin, resilient wrapper around the Gemini API.

Responsibilities:
- Configure the client once, failing loudly (in logs) if the key is missing.
- Run the *blocking* SDK call off the asyncio event loop so one slow request
  does not stall the entire classroom.
- Enforce a per-call timeout and surface every failure mode as a single
  typed ``GeminiError`` so callers can degrade gracefully instead of 500ing.
- Optionally pass a Pydantic schema as Gemini's native ``response_schema`` so
  the model returns guaranteed-shaped JSON.
"""

import os
import json
import asyncio
import logging

import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("synaptic.gemini")

MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
TIMEOUT_S = float(os.getenv("GEMINI_TIMEOUT_S", "12"))

_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_CONFIGURED = bool(_API_KEY)

if GEMINI_CONFIGURED:
    genai.configure(api_key=_API_KEY)
    logger.info("Gemini configured (model=%s, timeout=%ss)", MODEL_NAME, TIMEOUT_S)
else:
    logger.error(
        "GEMINI_API_KEY is not set. The agents will return degraded results for "
        "every request. Set GEMINI_API_KEY before serving real traffic."
    )


class GeminiError(RuntimeError):
    """A Gemini call failed, was blocked, timed out, or returned unusable output."""


def _extract_text(response) -> str:
    """Read response.text, which raises when the candidate was blocked/empty."""
    try:
        return response.text
    except Exception as exc:  # noqa: BLE001 - SDK raises ValueError/IndexError here
        finish_reason = None
        try:
            finish_reason = response.candidates[0].finish_reason
        except Exception:  # noqa: BLE001
            pass
        raise GeminiError(
            f"Gemini returned no usable text (finish_reason={finish_reason}): {exc}"
        ) from exc


def _generate_sync(prompt: str, system_instruction, response_schema) -> dict:
    generation_config = {"response_mime_type": "application/json"}
    if response_schema is not None:
        # Native structured output — the model is handed the exact field contract.
        generation_config["response_schema"] = response_schema

    model = genai.GenerativeModel(
        model_name=MODEL_NAME,
        system_instruction=system_instruction,
        generation_config=generation_config,
    )
    response = model.generate_content(prompt, request_options={"timeout": TIMEOUT_S})
    text = _extract_text(response)
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError) as exc:
        raise GeminiError(f"Gemini returned invalid JSON: {exc}") from exc


async def generate_json(
    prompt: str,
    system_instruction: str = None,
    response_schema=None,
) -> dict:
    """Call Gemini off the event loop and return parsed JSON, or raise GeminiError."""
    if not GEMINI_CONFIGURED:
        raise GeminiError("GEMINI_API_KEY not configured")

    try:
        # Offload the blocking SDK call to a worker thread; guard with a hard
        # ceiling slightly above the SDK's own request timeout.
        return await asyncio.wait_for(
            asyncio.to_thread(_generate_sync, prompt, system_instruction, response_schema),
            timeout=TIMEOUT_S + 3,
        )
    except asyncio.TimeoutError as exc:
        raise GeminiError(f"Gemini call exceeded {TIMEOUT_S + 3}s") from exc
    except GeminiError:
        raise
    except Exception as exc:  # noqa: BLE001 - network/auth/quota/etc.
        raise GeminiError(f"Gemini call failed: {exc}") from exc
