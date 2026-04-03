"""Optional Gemini-backed response rewriter for smoother chat answers."""

from __future__ import annotations

import os
from typing import Any, Optional

from crewai import LLM

from services.runtime_env import load_medical_environment


class GeminiResponseRewriter:
    """Rewrite deterministic workflow answers into smoother chat responses with Gemini."""

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

    def rewrite(self, intent: str, workflow_response: dict[str, Any], draft_answer: str) -> Optional[str]:
        """Return a smoother answer when Gemini rewriting is available."""
        if not self._enabled or not draft_answer.strip():
            return None

        llm = self._llm or LLM(
            model=self.model,
            api_key=self.api_key,
            temperature=0.2,
            timeout=15,
        )
        prompt = self._build_prompt(intent, workflow_response, draft_answer)

        try:
            response = llm.call(prompt)
        except Exception:
            return None

        if isinstance(response, str):
            cleaned = self._sanitize_output(response.strip())
            return cleaned or None

        return None

    def _build_prompt(self, intent: str, workflow_response: dict[str, Any], draft_answer: str) -> str:
        return (
            "You are rewriting a medical chatbot answer.\n"
            "Rewrite the draft so it sounds natural, concise, and supportive.\n"
            "Use only the facts already present in the structured payload and draft.\n"
            "Do not add new medical claims, diagnoses, drug names, dosages, or recommendations.\n"
            "Keep the answer short, plain, and user-facing.\n"
            "Do not add any meta commentary before the answer.\n\n"
            f"Intent: {intent}\n"
            f"Structured payload: {workflow_response}\n"
            f"Draft answer: {draft_answer}\n\n"
            "Return only the final user-facing answer."
        )

    def _sanitize_output(self, text: str) -> str:
        sanitized = text.strip()
        prefixes = (
            "Here's the rewritten answer:",
            "Here is the rewritten answer:",
            "Rewritten answer:",
            "Final answer:",
        )
        for prefix in prefixes:
            if sanitized.lower().startswith(prefix.lower()):
                sanitized = sanitized[len(prefix) :].strip()
        sanitized = sanitized.replace("**", "")
        return sanitized
