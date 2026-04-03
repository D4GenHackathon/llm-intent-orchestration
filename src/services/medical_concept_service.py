"""Medical concept explanation service backed by the local glossary and Gemini."""

from __future__ import annotations

from dataclasses import dataclass

from services.gemini_concept_service import GeminiConceptService
from services.medical_glossary_service import MedicalGlossaryEntry, MedicalGlossaryService


@dataclass(frozen=True)
class MedicalConceptAnswer:
    """Resolved answer for a medical concept question."""

    term: str
    explanation: str
    source: str


class MedicalConceptService:
    """Resolve medical concept questions from the local glossary, then Gemini."""

    def __init__(
        self,
        glossary_service: MedicalGlossaryService | None = None,
        gemini_service: GeminiConceptService | None = None,
    ) -> None:
        self.glossary_service = glossary_service or MedicalGlossaryService()
        self.gemini_service = gemini_service or GeminiConceptService()

    def explain(self, query: str) -> MedicalConceptAnswer | None:
        """Return a concept explanation from the local glossary or Gemini when available."""
        glossary_entry = self.glossary_service.match_entry(query)
        if glossary_entry:
            return self._from_glossary(glossary_entry)

        gemini_explanation = self.gemini_service.explain_concept(query)
        if gemini_explanation:
            return MedicalConceptAnswer(
                term=query.strip(),
                explanation=gemini_explanation,
                source="gemini",
            )

        return None

    def _from_glossary(self, entry: MedicalGlossaryEntry) -> MedicalConceptAnswer:
        return MedicalConceptAnswer(
            term=entry.term,
            explanation=entry.explanation,
            source="local_glossary",
        )
