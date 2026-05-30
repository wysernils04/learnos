"""
OpenAI Whisper transcription service — Phase 4.
Tiny model, on-demand. Enable openai-whisper in requirements.txt before use.
"""
from __future__ import annotations

from pathlib import Path

_model = None
_MODEL_SIZE = "tiny"


def _get_model():
    global _model
    if _model is None:
        import whisper  # only imported when actually used

        _model = whisper.load_model(_MODEL_SIZE)
    return _model


def transcribe(path: str | Path) -> str:
    """Transcribe audio file. Returns plain text transcript."""
    model = _get_model()
    result = model.transcribe(str(path))
    return result["text"]
