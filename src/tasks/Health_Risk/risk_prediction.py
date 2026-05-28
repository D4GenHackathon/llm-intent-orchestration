"""Health risk prediction task."""

from __future__ import annotations

from typing import Optional

from crewai import Task


def risk_prediction_router(agent, patient_profile: Optional[dict] = None):
    """Create a CrewAI task for health risk prediction."""
    return Task(
        description=(
            "Predict health risk from structured tabular input using the trained model. "
            f"Input profile: {patient_profile or {}}."
        ),
        expected_output=(
            "Predicted risk label, confidence if available, top contributing features, and a short model-based explanation."
        ),
        agent=agent,
    )
