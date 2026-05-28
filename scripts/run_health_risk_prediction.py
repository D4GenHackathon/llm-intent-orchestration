"""CLI bridge for the trained Python health risk prediction service."""

from __future__ import annotations

import json
from pathlib import Path
import sys


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = PROJECT_ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from schemas.risk import HealthRiskInput
from services.risk_prediction_service import RiskPredictionService


def main() -> int:
    """Read JSON input from stdin and emit prediction JSON to stdout."""
    try:
        payload = json.loads(sys.stdin.read() or "{}")
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
        response = RiskPredictionService().predict_risk(health_input).to_dict()
        print(json.dumps(response))
        return 0
    except Exception as exc:  # pragma: no cover - CLI fallback path
        print(json.dumps({"success": False, "error": str(exc)}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
