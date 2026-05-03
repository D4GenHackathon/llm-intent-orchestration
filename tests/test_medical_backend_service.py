"""Tests for the persistent medical backend service."""

from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from services.medical_backend_service import MedicalBackendService


class MedicalBackendServiceTests(unittest.TestCase):
    def test_side_effect_route_uses_cache_safe_interface(self) -> None:
        service = MedicalBackendService()
        response = service.handle_side_effects({"drugName": "ibuprofen"})
        self.assertIn("success", response)

    def test_drug_interaction_route_uses_cache_safe_interface(self) -> None:
        service = MedicalBackendService()
        response = service.handle_drug_interactions({"query": "ibuprofen, warfarin"})
        self.assertIn("success", response)


if __name__ == "__main__":
    unittest.main()
