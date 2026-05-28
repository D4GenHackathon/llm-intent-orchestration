"""Starter tests for the side-effect workflow."""

from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from schemas.side_effect import SideEffectLookupRequest
from services.side_effect_service import SideEffectService


class SideEffectWorkflowTests(unittest.TestCase):
    def test_lookup_returns_grouped_sections(self) -> None:
        service = SideEffectService()
        response = service.lookup_side_effects(SideEffectLookupRequest(drug_name="doxycycline"))
        self.assertTrue(response.success)
        result = response.to_dict()["data"]["result"]
        self.assertEqual(result["normalized_drug"], "doxycycline")
        self.assertGreater(len(result["groups"]["serious"]), 0)

    def test_brand_mentions_are_sanitized_to_match_requested_drug(self) -> None:
        service = SideEffectService()
        response = service.lookup_side_effects(SideEffectLookupRequest(drug_name="ibuprofen"))
        self.assertTrue(response.success)
        result = response.to_dict()["data"]["result"]

        serious_text = " ".join(result["groups"]["serious"])
        seek_care_text = " ".join(result["groups"]["when_to_seek_care"])
        self.assertNotIn("Midol IB", serious_text)
        self.assertNotIn("Midol IB", seek_care_text)


if __name__ == "__main__":
    unittest.main()
