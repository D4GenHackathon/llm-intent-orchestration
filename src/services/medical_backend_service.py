"""Persistent medical backend service with lightweight response caching."""

from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

from router.medical_chat_graph import MedicalChatGraph
from schemas.interaction import DrugInteractionRequest
from schemas.risk import HealthRiskInput
from schemas.side_effect import SideEffectLookupRequest
from services.interaction_service import InteractionService
from services.gemini_response_rewriter import GeminiResponseRewriter
from services.medical_concept_service import MedicalConceptService
from services.medical_response_formatter import MedicalResponseFormatter
from services.risk_prediction_service import RiskPredictionService
from services.side_effect_service import SideEffectService


REQUIRED_RISK_FIELDS = (
    "respiratory_rate",
    "oxygen_saturation",
    "o2_scale",
    "systolic_bp",
    "heart_rate",
    "temperature",
    "consciousness",
    "on_oxygen",
)


class MedicalBackendService:
    """Serve deterministic medical workflows from a long-lived Python process."""

    def __init__(self) -> None:
        self.graph = MedicalChatGraph()
        self.interaction_service = InteractionService()
        self.side_effect_service = SideEffectService()
        self.risk_service = RiskPredictionService()
        self.concept_service = MedicalConceptService()
        self.formatter = MedicalResponseFormatter()
        self.gemini_rewriter = GeminiResponseRewriter()

    def handle_chat(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self._handle_chat_cached(self._stable_key(payload))

    def handle_drug_interactions(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self._handle_drug_interactions_cached(self._stable_key(payload))

    def handle_side_effects(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self._handle_side_effects_cached(self._stable_key(payload))

    def handle_health_risk(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self._handle_health_risk_cached(self._stable_key(payload))

    @lru_cache(maxsize=256)
    def _handle_chat_cached(self, payload_key: str) -> dict[str, Any]:
        payload = json.loads(payload_key)
        query = str(payload.get("query", ""))
        plan = self.graph.plan(query)
        intent_result = plan.intent_result
        workflow_response = self._run_plan(query, plan)
        draft_answer = self.formatter.format_chat_result(
            {
                "intent": intent_result.intent,
                "confidence": intent_result.confidence,
                "workflow_response": workflow_response,
            }
        )
        formatted_answer = (
            self.gemini_rewriter.rewrite(intent_result.intent, workflow_response, draft_answer)
            or draft_answer
        )
        return {
            "success": True,
            "data": {
                "result": {
                    "query": query,
                    "planner_route": plan.route,
                    "intent": intent_result.intent,
                    "confidence": intent_result.confidence,
                    "reasons": intent_result.reasons + plan.reasons,
                    "extracted_drugs": intent_result.extracted_drugs,
                    "extracted_drug": intent_result.extracted_drug,
                    "patient_profile": intent_result.patient_profile,
                    "workflow_response": workflow_response,
                    "formatted_answer": formatted_answer,
                }
            },
        }

    @lru_cache(maxsize=256)
    def _handle_drug_interactions_cached(self, payload_key: str) -> dict[str, Any]:
        payload = json.loads(payload_key)
        request = DrugInteractionRequest(
            query=str(payload.get("query", "")),
            drugs=[str(item) for item in payload.get("drugs", [])],
        )
        return self.interaction_service.check_interactions(request).to_dict()

    @lru_cache(maxsize=256)
    def _handle_side_effects_cached(self, payload_key: str) -> dict[str, Any]:
        payload = json.loads(payload_key)
        request = SideEffectLookupRequest(
            query=str(payload.get("query", "")),
            drug_name=str(payload.get("drugName", "")),
        )
        return self.side_effect_service.lookup_side_effects(request).to_dict()

    @lru_cache(maxsize=256)
    def _handle_health_risk_cached(self, payload_key: str) -> dict[str, Any]:
        payload = json.loads(payload_key)
        health_input = HealthRiskInput(
            respiratory_rate=float(payload["respiratoryRate"]),
            oxygen_saturation=float(payload["oxygenSaturation"]),
            o2_scale=float(payload["o2Scale"]),
            systolic_bp=float(payload["systolicBp"]),
            heart_rate=float(payload["heartRate"]),
            temperature=float(payload["temperature"]),
            consciousness=str(payload["consciousness"]),
            on_oxygen=float(payload["onOxygen"]),
        )
        return self.risk_service.predict_risk(health_input).to_dict()

    def _run_plan(self, query: str, plan) -> dict[str, Any]:
        intent_result = plan.intent_result

        if plan.route == "clarification":
            return {
                "success": False,
                "message": plan.clarification_message,
                "data": {},
                "warnings": ["No deterministic workflow was triggered for this query."],
            }

        if intent_result.intent == "drug_interaction":
            return self.interaction_service.check_interactions(
                DrugInteractionRequest(query=query, drugs=intent_result.extracted_drugs)
            ).to_dict()

        if intent_result.intent == "side_effect_lookup":
            return self.side_effect_service.lookup_side_effects(
                SideEffectLookupRequest(query=query, drug_name=intent_result.extracted_drug)
            ).to_dict()

        if intent_result.intent == "health_risk_prediction":
            missing = [field for field in REQUIRED_RISK_FIELDS if field not in intent_result.patient_profile]
            if missing:
                return {
                    "success": False,
                    "message": (
                        "The query looks like a health-risk request, but some structured fields are still missing: "
                        + ", ".join(missing)
                    ),
                    "data": {"patient_profile": intent_result.patient_profile},
                    "warnings": ["Provide the missing values to run the trained risk model."],
                }

            health_input = HealthRiskInput(**intent_result.patient_profile)
            return self.risk_service.predict_risk(health_input).to_dict()

        if intent_result.intent == "medical_concept_help":
            concept_answer = self.concept_service.explain(query)
            if concept_answer:
                return {
                    "success": True,
                    "message": "Medical concept explanation handled successfully.",
                    "data": {
                        "term": concept_answer.term,
                        "explanation": concept_answer.explanation,
                        "source": concept_answer.source,
                    },
                    "warnings": [],
                }
            return {
                "success": False,
                "message": "I could not match that concept to the current medical glossary.",
                "data": {},
                "warnings": [],
            }

        if intent_result.intent == "small_talk":
            return {"success": True, "message": "Greeting handled successfully.", "data": {}, "warnings": []}

        if intent_result.intent == "help":
            return {"success": True, "message": "Help request handled successfully.", "data": {}, "warnings": []}

        return {
            "success": False,
            "message": "I can currently help with drug interactions, side effects, and health risk prediction.",
            "data": {},
            "warnings": ["No deterministic workflow was triggered for this query."],
        }

    def _stable_key(self, payload: dict[str, Any]) -> str:
        return json.dumps(payload, sort_keys=True, separators=(",", ":"))
