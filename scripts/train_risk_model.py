"""Train and persist the health risk model artifact."""

from __future__ import annotations

from pathlib import Path
import sys


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = PROJECT_ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from services.risk_prediction_service import (
    MODEL_ARTIFACT_PATH,
    MODEL_METRICS_PATH,
    train_and_save_risk_model,
)


def main() -> None:
    """Train the risk model and save it under models/."""
    artifact_path = train_and_save_risk_model()
    print(f"Saved health risk model artifact to {artifact_path}")
    print(f"Saved health risk model metrics to {MODEL_METRICS_PATH}")


if __name__ == "__main__":
    main()
