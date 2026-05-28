"""Schemas for health risk prediction."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class HealthRiskInput:
    """Structured input for the health risk model."""

    respiratory_rate: float
    oxygen_saturation: float
    o2_scale: float
    systolic_bp: float
    heart_rate: float
    temperature: float
    consciousness: str
    on_oxygen: float


@dataclass
class FeatureContribution:
    """Feature contribution summary for explanation."""

    feature: str
    value: str
    contribution_score: float
    rationale: str


@dataclass
class HealthRiskPrediction:
    """Response payload for risk prediction."""

    predicted_risk: str
    confidence: Optional[float]
    top_contributing_features: List[FeatureContribution] = field(default_factory=list)
    explanation: str = ""
