"""Health risk prediction task."""

from __future__ import annotations

from typing import Optional

from crewai import Task
from schemas.risk import HealthRiskInput
from services.risk_prediction_service import RiskPredictionService


def risk_prediction_router(agent, patient_profile: Optional[dict] = None):
    """Create a CrewAI task for health risk prediction."""
    service = RiskPredictionService()
    profile = patient_profile or {}

    # Helper functions to safely convert input values
    def to_float(value, default: float = 0.0) -> float:
        if value is None:
            return default
        return float(value)

    def to_int(value, default: int = 0) -> int:
        if value is None:
            return default
        return int(value)

    input_data = HealthRiskInput(
        respiratory_rate=to_float(profile.get("respiratory_rate")),
        oxygen_saturation=to_float(profile.get("oxygen_saturation")),
        o2_scale=to_int(profile.get("o2_scale")),
        systolic_bp=to_float(profile.get("systolic_bp")),
        heart_rate=to_float(profile.get("heart_rate")),
        temperature=to_float(profile.get("temperature")),
        consciousness=profile.get("consciousness") or "",
        on_oxygen=bool(profile.get("on_oxygen")),
    )
    
    task = service.predict_risk(input_data).to_dict()
    return Task(
        description=(
            "Predict health risk from structured tabular input using the trained model. "
            f"Input profile: {profile}."
        ),
        expected_output=(
            "Predicted risk label, confidence if available, top contributing features, and a short model-based explanation."
        ),
        task=task,
        service=service,
        agent=agent,
    )
