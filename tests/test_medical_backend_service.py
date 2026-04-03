"""Tests for the persistent medical backend service."""

from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from services.medical_backend_service import MedicalBackendService


class MedicalBackendServiceTests(unittest.TestCase):
    def test_chat_route_handles_interaction_query(self) -> None:
        service = MedicalBackendService()
        response = service.handle_chat({"query": "Does ibuprofen interact with warfarin?"})
        self.assertTrue(response["success"])
        self.assertEqual(response["data"]["result"]["intent"], "drug_interaction")

    def test_side_effect_route_uses_cache_safe_interface(self) -> None:
        service = MedicalBackendService()
        response = service.handle_side_effects({"drugName": "ibuprofen"})
        self.assertIn("success", response)


if __name__ == "__main__":
    unittest.main()
