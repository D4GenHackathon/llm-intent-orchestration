"""Persistent medical backend service with lightweight response caching."""

from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

from schemas.interaction import DrugInteractionRequest
from schemas.risk import HealthRiskInput
from schemas.side_effect import SideEffectLookupRequest
from services.early_warning_service import EarlyWarningService
from services.interaction_service import InteractionService
from services.prescription_safety_service import PrescriptionSafetyService
from services.risk_prediction_service import RiskPredictionService
from services.side_effect_service import SideEffectService


class MedicalBackendService:
    """Serve deterministic medical workflows from a long-lived Python process."""

    def __init__(self) -> None:
        self.interaction_service = InteractionService()
        self.side_effect_service = SideEffectService()
        self.risk_service = RiskPredictionService()
        self.early_warning_service = EarlyWarningService()
        self.prescription_safety_service = PrescriptionSafetyService()

    def handle_drug_interactions(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self._handle_drug_interactions_cached(self._stable_key(payload))

    def handle_side_effects(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self._handle_side_effects_cached(self._stable_key(payload))

    def handle_health_risk(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self._handle_health_risk_cached(self._stable_key(payload))

    def handle_early_warning(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self._handle_early_warning_cached(self._stable_key(payload))

    def handle_prescription_safety(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self._handle_prescription_safety_cached(self._stable_key(payload))

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

    @lru_cache(maxsize=256)
    def _handle_early_warning_cached(self, payload_key: str) -> dict[str, Any]:
        payload = json.loads(payload_key)
        top_k = int(payload.get("topK") or payload.get("top_k") or 5)
        return self.early_warning_service.evaluate(payload, top_k=top_k).to_dict()

    @lru_cache(maxsize=256)
    def _handle_prescription_safety_cached(self, payload_key: str) -> dict[str, Any]:
        payload = json.loads(payload_key)
        return self.prescription_safety_service.evaluate(payload).to_dict()

    def _stable_key(self, payload: dict[str, Any]) -> str:
        return json.dumps(payload, sort_keys=True, separators=(",", ":"))
