# ============================================
# Synaptic Room — Agents test bootstrap
# ============================================
# Makes the agent package importable in tests WITHOUT the heavy Gemini SDK or a
# network/API key. We stub `google.generativeai` and `dotenv` (external SDKs
# that are NOT the subject under test) so the real agent logic — fallbacks,
# invariants, mentor guards — can be exercised deterministically.
# ============================================

import sys
import types
from pathlib import Path

# Make the agents package root importable (agents/ is the working dir in CI).
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def _install_stub(name, attrs=None):
    module = types.ModuleType(name)
    for key, value in (attrs or {}).items():
        setattr(module, key, value)
    sys.modules[name] = module
    return module


# Stub `dotenv.load_dotenv` (no-op) so gemini_client imports cleanly.
if "dotenv" not in sys.modules:
    _install_stub("dotenv", {"load_dotenv": lambda *a, **k: False})

# Stub `google.generativeai` with just the surface gemini_client touches at
# import time. Tests never actually call Gemini — they patch the agents' `arun`.
if "google.generativeai" not in sys.modules:
    _install_stub("google")  # parent package

    class _GenerativeModel:  # pragma: no cover - never invoked in unit tests
        def __init__(self, *a, **k):
            pass

        def generate_content(self, *a, **k):
            raise RuntimeError("Gemini SDK is stubbed in tests")

    genai = _install_stub(
        "google.generativeai",
        {"configure": lambda *a, **k: None, "GenerativeModel": _GenerativeModel},
    )
    sys.modules["google"].generativeai = genai
