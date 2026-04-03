"""Rule-based medical intent routing for the MVP workflows."""

from __future__ import annotations

from dataclasses import dataclass, field
import re
from typing import Dict, List

from repositories.interaction_repository import InteractionRepository
from repositories.side_effect_repository import SideEffectRepository
from services.drug_normalization_service import DrugNormalizationService
from services.medical_glossary_service import MedicalGlossaryService


@dataclass
class MedicalIntentResult:
    """Structured output from the medical intent router."""

    intent: str
    confidence: float
    reasons: List[str] = field(default_factory=list)
    extracted_drugs: List[str] = field(default_factory=list)
    extracted_drug: str = ""
    patient_profile: Dict[str, float | str] = field(default_factory=dict)


class MedicalIntentRouter:
    """Route free-text medical questions to one of the supported MVP workflows."""

    CONCEPT_PATTERNS = (
        r"\bwhat is\s+[a-z0-9/ %+-]+\??$",
        r"\bwhat does\s+[a-z0-9/ %+-]+\s+mean\??$",
        r"\bdefine\s+[a-z0-9/ %+-]+\??$",
        r"\bmeaning of\s+[a-z0-9/ %+-]+\??$",
    )

    SMALL_TALK_KEYWORDS = (
        "hello",
        "hi",
        "hey",
        "good morning",
        "good afternoon",
        "good evening",
        "thanks",
        "thank you",
        "bye",
        "goodbye",
    )
    HELP_KEYWORDS = (
        "help",
        "what can you do",
        "how can you help",
        "what do you do",
        "supported workflows",
        "options",
    )
    INTERACTION_KEYWORDS = (
        "interaction",
        "interact",
        "combine",
        "take together",
        "safe together",
        "mix with",
    )
    SIDE_EFFECT_KEYWORDS = (
        "side effect",
        "side effects",
        "adverse effect",
        "adverse effects",
        "reaction",
        "reactions",
        "warning sign",
        "warning signs",
    )
    HEALTH_RISK_KEYWORDS = (
        "risk",
        "health risk",
        "check health risk",
        "assess health risk",
        "evaluate health risk",
        "triage",
        "deterioration",
        "acuity",
    )

    def __init__(
        self,
        interaction_repository: InteractionRepository | None = None,
        side_effect_repository: SideEffectRepository | None = None,
        normalization_service: DrugNormalizationService | None = None,
        glossary_service: MedicalGlossaryService | None = None,
    ) -> None:
        self.interaction_repository = interaction_repository or InteractionRepository()
        self.side_effect_repository = side_effect_repository or SideEffectRepository()
        self.normalization_service = normalization_service or DrugNormalizationService()
        self.glossary_service = glossary_service or MedicalGlossaryService()
        known_names = set(self.interaction_repository.get_known_drug_names())
        known_names.update(self.side_effect_repository.get_known_drug_names())
        self.known_drug_names = sorted(known_names)

    def route(self, query: str) -> MedicalIntentResult:
        """Return the most likely workflow for a natural-language medical request."""
        text = " ".join((query or "").split())
        lowered = text.casefold()
        if not lowered:
            return MedicalIntentResult(intent="unknown", confidence=0.0, reasons=["Empty query."])

        if self._contains_keyword(lowered, self.SMALL_TALK_KEYWORDS):
            return MedicalIntentResult(
                intent="small_talk",
                confidence=0.98,
                reasons=["Detected a greeting or conversational message."],
            )

        if self._contains_keyword(lowered, self.HELP_KEYWORDS):
            return MedicalIntentResult(
                intent="help",
                confidence=0.97,
                reasons=["Detected a help or capability question."],
            )

        if self._looks_like_health_risk_query(lowered):
            return MedicalIntentResult(
                intent="health_risk_prediction",
                confidence=0.9,
                reasons=[
                    "Detected a direct health-risk request.",
                    "Opening the structured health-risk workflow so the user can fill in the form.",
                ],
                patient_profile={},
            )

        glossary_entry = self.glossary_service.match_entry(text)
        if glossary_entry:
            return MedicalIntentResult(
                intent="medical_concept_help",
                confidence=0.96,
                reasons=[f"Matched the question to a known medical concept: {glossary_entry.term}."],
            )

        if self._looks_like_concept_question(lowered):
            return MedicalIntentResult(
                intent="medical_concept_help",
                confidence=0.72,
                reasons=[
                    "The query is asking for a medical concept definition or explanation.",
                    "Using the concept-help workflow so the glossary or fallback LLM can explain it.",
                ],
            )

        patient_profile = self._extract_health_profile(text)
        extracted_drugs = self.normalization_service.extract_drug_names(text, self.known_drug_names)

        if self._looks_like_health_risk(lowered, patient_profile):
            reasons = [
                "Detected structured vital-sign style inputs or health-risk wording.",
                f"Extracted {len(patient_profile)} health profile fields.",
            ]
            return MedicalIntentResult(
                intent="health_risk_prediction",
                confidence=0.92 if len(patient_profile) >= 4 else 0.78,
                reasons=reasons,
                patient_profile=patient_profile,
            )

        if extracted_drugs and self._contains_keyword(lowered, self.SIDE_EFFECT_KEYWORDS):
            return MedicalIntentResult(
                intent="side_effect_lookup",
                confidence=0.94,
                reasons=[
                    "Detected side-effect wording.",
                    "Detected one recognizable drug name.",
                ],
                extracted_drug=extracted_drugs[0],
                extracted_drugs=extracted_drugs[:1],
            )

        if len(extracted_drugs) >= 2 and self._contains_keyword(lowered, self.INTERACTION_KEYWORDS):
            return MedicalIntentResult(
                intent="drug_interaction",
                confidence=0.95,
                reasons=[
                    "Detected interaction wording.",
                    f"Extracted {len(extracted_drugs)} candidate drugs.",
                ],
                extracted_drugs=extracted_drugs,
            )

        if len(extracted_drugs) >= 2:
            return MedicalIntentResult(
                intent="drug_interaction",
                confidence=0.74,
                reasons=[
                    "Multiple drug names were detected, so pairwise interaction checking is the safest default workflow."
                ],
                extracted_drugs=extracted_drugs,
            )

        if extracted_drugs and not self._contains_keyword(lowered, self.INTERACTION_KEYWORDS):
            return MedicalIntentResult(
                intent="side_effect_lookup",
                confidence=0.58,
                reasons=[
                    "Detected one recognizable drug name, but no clearer interaction wording.",
                    "Defaulting to single-drug lookup rather than inventing another workflow.",
                ],
                extracted_drug=extracted_drugs[0],
                extracted_drugs=extracted_drugs[:1],
            )

        return MedicalIntentResult(
            intent="unknown",
            confidence=0.2,
            reasons=["No supported medical workflow could be selected confidently from the current query."],
        )

    def _contains_keyword(self, text: str, keywords: tuple[str, ...]) -> bool:
        return any(keyword in text for keyword in keywords)

    def _looks_like_concept_question(self, lowered_query: str) -> bool:
        return any(re.search(pattern, lowered_query, re.IGNORECASE) for pattern in self.CONCEPT_PATTERNS)

    def _looks_like_health_risk(self, lowered_query: str, patient_profile: Dict[str, float | str]) -> bool:
        if len(patient_profile) >= 3:
            return True
        if self._contains_keyword(lowered_query, self.HEALTH_RISK_KEYWORDS) and len(patient_profile) >= 2:
            return True
        return False

    def _looks_like_health_risk_query(self, lowered_query: str) -> bool:
        return any(
            phrase in lowered_query
            for phrase in (
                "health risk",
                "check health risk",
                "assess health risk",
                "evaluate health risk",
            )
        )

    def _extract_health_profile(self, query: str) -> Dict[str, float | str]:
        profile: Dict[str, float | str] = {}
        patterns = {
            "respiratory_rate": [
                r"\brr[:=]?\s*(\d+(?:\.\d+)?)\b",
                r"\brespiratory rate[:=]?\s*(\d+(?:\.\d+)?)\b",
            ],
            "oxygen_saturation": [
                r"\bspo2[:=]?\s*(\d+(?:\.\d+)?)\b",
                r"\boxygen saturation[:=]?\s*(\d+(?:\.\d+)?)\b",
                r"\bo2 sat[:=]?\s*(\d+(?:\.\d+)?)\b",
            ],
            "o2_scale": [
                r"\bo2 scale[:=]?\s*(\d+(?:\.\d+)?)\b",
                r"\boxygen scale[:=]?\s*(\d+(?:\.\d+)?)\b",
            ],
            "systolic_bp": [
                r"\bsbp[:=]?\s*(\d+(?:\.\d+)?)\b",
                r"\bsystolic bp[:=]?\s*(\d+(?:\.\d+)?)\b",
                r"\bbp[:=]?\s*(\d+(?:\.\d+)?)\s*/\s*\d+(?:\.\d+)?\b",
            ],
            "heart_rate": [
                r"\bhr[:=]?\s*(\d+(?:\.\d+)?)\b",
                r"\bheart rate[:=]?\s*(\d+(?:\.\d+)?)\b",
                r"\bpulse[:=]?\s*(\d+(?:\.\d+)?)\b",
            ],
            "temperature": [
                r"\btemp(?:erature)?[:=]?\s*(\d+(?:\.\d+)?)\b",
            ],
            "on_oxygen": [
                r"\bon oxygen[:=]?\s*(\d+(?:\.\d+)?)\b",
                r"\boxygen support[:=]?\s*(\d+(?:\.\d+)?)\b",
            ],
        }
        for field, field_patterns in patterns.items():
            for pattern in field_patterns:
                match = re.search(pattern, query, re.IGNORECASE)
                if match:
                    profile[field] = float(match.group(1))
                    break

        consciousness_match = re.search(
            r"\bconsciousness[:=]?\s*(alert|verbal|pain|unresponsive|a|v|p|u)\b",
            query,
            re.IGNORECASE,
        )
        if consciousness_match:
            value = consciousness_match.group(1).strip()
            profile["consciousness"] = self._normalize_consciousness(value)

        if "on_oxygen" not in profile:
            if re.search(r"\bon oxygen\b", query, re.IGNORECASE):
                profile["on_oxygen"] = 1.0
            elif re.search(r"\broom air\b", query, re.IGNORECASE):
                profile["on_oxygen"] = 0.0

        return profile

    def _normalize_consciousness(self, value: str) -> str:
        mapping = {
            "alert": "A",
            "a": "A",
            "verbal": "V",
            "v": "V",
            "pain": "P",
            "p": "P",
            "unresponsive": "U",
            "u": "U",
        }
        return mapping.get(value.casefold(), value.strip().upper())
