"""Starter tests for drug normalization."""

from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from services.drug_normalization_service import DrugNormalizationService
from services.rxnorm_normalization_service import RxNormMatch


class DrugNormalizationServiceTests(unittest.TestCase):
    def test_normalize_drug_name_strips_case_and_punctuation(self) -> None:
        service = DrugNormalizationService()
        self.assertEqual(service.normalize_drug_name("  Paracetamol! "), "paracetamol")

    def test_rxnorm_match_can_resolve_brand_to_known_generic_name(self) -> None:
        class FakeRxNormService:
            def normalize_name(self, raw_name: str):
                if raw_name == "Accutane":
                    return RxNormMatch(
                        rxcui="123",
                        name="Accutane 10 MG Oral Capsule",
                        generic_rxcui="456",
                        generic_name="isotretinoin 10 MG Oral Capsule",
                    )
                return None

        service = DrugNormalizationService(rxnorm_service=FakeRxNormService())
        normalized = service.normalize_drug_name("Accutane", known_names=["isotretinoin", "doxycycline"])
        self.assertEqual(normalized, "isotretinoin")

    def test_fuzzy_match_can_resolve_minor_drug_name_typo(self) -> None:
        service = DrugNormalizationService()
        normalized = service.normalize_drug_name("wafarin", known_names=["warfarin", "ibuprofen"])
        self.assertEqual(normalized, "warfarin")


if __name__ == "__main__":
    unittest.main()
