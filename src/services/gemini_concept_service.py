"""Optional Gemini-backed explanation service for medical concepts."""

from __future__ import annotations

import os
from typing import Optional

from crewai import LLM
from services.runtime_env import load_medical_environment


class GeminiConceptService:
    """Generate concise medical concept explanations with Gemini."""

    def __init__(
        self,
        model: str | None = None,
        api_key: str | None = None,
        llm: LLM | None = None,
    ) -> None:
        load_medical_environment()
        self.model = model or os.getenv("GEMINI_MODEL", "gemini/gemini-flash-latest")
        self.api_key = api_key or os.getenv("GEMINI_API_KEY", "")
        self._llm = llm
        self._enabled = bool(self.api_key.strip()) or self._llm is not None

    def explain_concept(self, query: str) -> Optional[str]:
        """Return a concise medical explanation from Gemini, or None if unavailable."""
        if not self._enabled:
            return None

        llm = self._llm or LLM(
            model=self.model,
            api_key=self.api_key,
            temperature=0.2,
            timeout=15,
        )
        prompt = (
            "You are a concise medical assistant.\n"
            "Explain only the medical concept asked by the user in 1-2 short sentences.\n"
            "Do not diagnose, prescribe, or add unrelated advice.\n"
            "Keep the answer plain, helpful, and suitable for a patient-facing chatbot.\n\n"
            f"User question: {query}"
        )

        try:
            response = llm.call(prompt)
        except Exception:
            return None

        if isinstance(response, str):
            cleaned = response.strip()
            return cleaned or None

        return None
