"""Tests for local and optional Gemini-backed medical concept explanations."""

from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from services.medical_concept_service import MedicalConceptService
from services.gemini_concept_service import GeminiConceptService


class StubGeminiConceptService(GeminiConceptService):
    def __init__(self, response: str | None) -> None:
        self.response = response

    def explain_concept(self, query: str) -> str | None:
        return self.response


class MedicalConceptServiceTests(unittest.TestCase):
    def test_local_glossary_handles_rr(self) -> None:
        service = MedicalConceptService()
        answer = service.explain("what is RR")
        self.assertIsNotNone(answer)
        assert answer is not None
        self.assertEqual(answer.source, "local_glossary")
        self.assertIn("respiratory rate", answer.explanation.lower())

    def test_gemini_fallback_handles_unknown_glossary_term(self) -> None:
        service = MedicalConceptService(
            gemini_service=StubGeminiConceptService(
                "RR usually means respiratory rate in a clinical context."
            ),
        )
        answer = service.explain("what is respiratory assessment")
        self.assertIsNotNone(answer)
        assert answer is not None
        self.assertEqual(answer.source, "gemini")
        self.assertIn("respiratory", answer.explanation.lower())


if __name__ == "__main__":
    unittest.main()
