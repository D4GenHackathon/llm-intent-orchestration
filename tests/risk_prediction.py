"""Starter tests for the health risk prediction workflow."""

from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from schemas.risk import HealthRiskInput
from services.risk_prediction_service import RiskPredictionService, train_and_save_risk_model


class RiskPredictionWorkflowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        train_and_save_risk_model()

    def test_prediction_returns_label_and_feature_explanation(self) -> None:
        service = RiskPredictionService()
        response = service.predict_risk(
            HealthRiskInput(
                respiratory_rate=28,
                oxygen_saturation=92,
                o2_scale=2,
                systolic_bp=110,
                heart_rate=145,
                temperature=38.3,
                consciousness="P",
                on_oxygen=1,
            )
        )
        self.assertTrue(response.success)
        result = response.to_dict()["data"]["result"]
        self.assertIn(result["predicted_risk"], {"Low", "Medium", "High"})
        self.assertGreater(len(result["top_contributing_features"]), 0)
        self.assertIn("trained model", result["explanation"])


if __name__ == "__main__":
    unittest.main()
