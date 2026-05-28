"""Starter tests for the drug interaction workflow."""

from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from schemas.interaction import DrugInteractionRequest
from services.interaction_service import InteractionService


class DrugInteractionWorkflowTests(unittest.TestCase):
    def test_known_pair_returns_structured_match(self) -> None:
        service = InteractionService()
        response = service.check_interactions(
            DrugInteractionRequest(drugs=["Trioxsalen", "Verteporfin"])
        )
        self.assertTrue(response.success)
        result = response.to_dict()["data"]["result"]
        self.assertTrue(result["interaction_found"])
        self.assertEqual(result["interacting_pairs"][0]["drug_1"], "trioxsalen")
        self.assertEqual(result["interacting_pairs"][0]["drug_2"], "verteporfin")

    def test_multi_drug_input_returns_only_interacting_pairs(self) -> None:
        service = InteractionService()
        response = service.check_interactions(
            DrugInteractionRequest(drugs=["Trioxsalen", "Verteporfin", "Madeupmed"])
        )
        self.assertTrue(response.success)
        result = response.to_dict()["data"]["result"]
        self.assertTrue(result["interaction_found"])
        self.assertGreaterEqual(len(result["interacting_pairs"]), 1)
        self.assertFalse(any(pair["drug_2"] == "madeupmed" for pair in result["interacting_pairs"]))
        self.assertEqual(result["unrecognized_terms"], ["Madeupmed"])

    def test_no_recognizable_medications_returns_specific_message(self) -> None:
        service = InteractionService()
        response = service.check_interactions(DrugInteractionRequest(query="vitamin c, madeupmed"))
        result = response.to_dict()["data"]["result"]

        self.assertFalse(response.success)
        self.assertEqual(result["normalized_drugs"], [])
        self.assertEqual(result["unrecognized_terms"], ["vitamin c", "madeupmed"])
        self.assertIn("No recognizable medications were found", response.message)

    def test_one_recognized_medication_returns_unrecognized_terms(self) -> None:
        service = InteractionService()
        response = service.check_interactions(DrugInteractionRequest(query="trioxsalen, vitamin c"))
        result = response.to_dict()["data"]["result"]

        self.assertFalse(response.success)
        self.assertEqual(result["normalized_drugs"], ["trioxsalen"])
        self.assertEqual(result["unrecognized_terms"], ["vitamin c"])
        self.assertIn("Only one medication was recognized: trioxsalen", response.message)

    def test_two_recognized_medications_without_interaction_is_successful(self) -> None:
        service = InteractionService()
        response = service.check_interactions(DrugInteractionRequest(query="trioxsalen, digoxin"))
        result = response.to_dict()["data"]["result"]

        self.assertTrue(response.success)
        self.assertEqual(result["normalized_drugs"], ["trioxsalen", "digoxin"])
        self.assertFalse(result["interaction_found"])
        self.assertEqual(result["interacting_pairs"], [])
        self.assertIn("No interaction was found", result["explanation"])


if __name__ == "__main__":
    unittest.main()
