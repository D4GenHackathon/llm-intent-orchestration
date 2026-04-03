"""Local glossary for common medical abbreviations and concepts."""

from __future__ import annotations

from dataclasses import dataclass
import re
from typing import Dict, Optional


@dataclass(frozen=True)
class MedicalGlossaryEntry:
    """A local glossary entry for a medical concept."""

    term: str
    short_definition: str
    explanation: str


class MedicalGlossaryService:
    """Resolve simple medical concept questions from a local glossary."""

    GLOSSARY: Dict[str, MedicalGlossaryEntry] = {
        "rr": MedicalGlossaryEntry(
            term="RR",
            short_definition="Respiratory rate",
            explanation="RR usually means respiratory rate, which is the number of breaths a person takes per minute.",
        ),
        "respiratory rate": MedicalGlossaryEntry(
            term="Respiratory rate",
            short_definition="Respiratory rate",
            explanation="Respiratory rate is the number of breaths a person takes per minute.",
        ),
        "hr": MedicalGlossaryEntry(
            term="HR",
            short_definition="Heart rate",
            explanation="HR usually means heart rate, which is the number of heart beats per minute.",
        ),
        "heart rate": MedicalGlossaryEntry(
            term="Heart rate",
            short_definition="Heart rate",
            explanation="Heart rate is the number of heart beats per minute.",
        ),
        "spo2": MedicalGlossaryEntry(
            term="SpO2",
            short_definition="Peripheral oxygen saturation",
            explanation="SpO2 usually means peripheral oxygen saturation, which estimates how much oxygen is being carried in the blood.",
        ),
        "oxygen saturation": MedicalGlossaryEntry(
            term="Oxygen saturation",
            short_definition="Peripheral oxygen saturation",
            explanation="Oxygen saturation estimates how much oxygen is being carried in the blood.",
        ),
        "sbp": MedicalGlossaryEntry(
            term="SBP",
            short_definition="Systolic blood pressure",
            explanation="SBP usually means systolic blood pressure, the top number in a blood pressure reading.",
        ),
        "systolic blood pressure": MedicalGlossaryEntry(
            term="Systolic blood pressure",
            short_definition="Systolic blood pressure",
            explanation="Systolic blood pressure is the top number in a blood pressure reading.",
        ),
        "o2 scale": MedicalGlossaryEntry(
            term="O2 scale",
            short_definition="Oxygen therapy scale",
            explanation="O2 scale usually refers to the oxygen therapy scale used when recording a patient's oxygen support requirement.",
        ),
        "avpu": MedicalGlossaryEntry(
            term="AVPU",
            short_definition="Level of consciousness scale",
            explanation="AVPU is a quick level of consciousness scale that stands for Alert, Verbal, Pain, and Unresponsive.",
        ),
    }

    CONCEPT_PATTERNS = (
        r"\bwhat is (?P<term>[a-z0-9/ %+-]+)\??$",
        r"\bwhat does (?P<term>[a-z0-9/ %+-]+) mean\??$",
        r"\bdefine (?P<term>[a-z0-9/ %+-]+)\??$",
        r"\bmeaning of (?P<term>[a-z0-9/ %+-]+)\??$",
    )

    def match_entry(self, query: str) -> Optional[MedicalGlossaryEntry]:
        """Match a query to a glossary entry if possible."""
        normalized_query = " ".join((query or "").strip().lower().split())
        for pattern in self.CONCEPT_PATTERNS:
            match = re.search(pattern, normalized_query, re.IGNORECASE)
            if match:
                candidate = match.group("term").strip().lower()
                return self.GLOSSARY.get(candidate)

        if normalized_query in self.GLOSSARY:
            return self.GLOSSARY[normalized_query]

        return None
