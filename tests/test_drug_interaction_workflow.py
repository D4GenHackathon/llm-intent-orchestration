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
            DrugInteractionRequest(drugs=["Trioxsalen", "Verteporfin", "Ibuprofen"])
        )
        self.assertTrue(response.success)
        result = response.to_dict()["data"]["result"]
        self.assertTrue(result["interaction_found"])
        self.assertGreaterEqual(len(result["interacting_pairs"]), 1)
        self.assertFalse(any(pair["drug_2"] == "ibuprofen" for pair in result["interacting_pairs"]))


if __name__ == "__main__":
    unittest.main()
