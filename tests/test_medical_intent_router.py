"""Golden tests for natural-language routing of medical workflows."""

from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from router.intent_router import MedicalIntentRouter


class MedicalIntentRouterTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.router = MedicalIntentRouter()

    def test_golden_queries_route_to_expected_workflow(self) -> None:
        cases = [
            ("hello", "small_talk"),
            ("thanks", "small_talk"),
            ("what can you do", "help"),
            ("what is RR", "medical_concept_help"),
            ("what does SpO2 mean", "medical_concept_help"),
            ("does ibuprofen interact with warfarin", "drug_interaction"),
            ("can i take aspirin with warfarin", "drug_interaction"),
            ("check interaction between trioxsalen and verteporfin", "drug_interaction"),
            ("ibuprofen warfarin and doxycycline", "drug_interaction"),
            ("what side effects does doxycycline have", "side_effect_lookup"),
            ("side effects of doxycycline", "side_effect_lookup"),
            ("what are the adverse effects of paracetamol", "side_effect_lookup"),
            ("Tylenol side effects", "side_effect_lookup"),
            (
                "RR 28, SpO2 89, O2 scale 2, SBP 95, HR 128, temp 38.4, consciousness alert, on oxygen 1",
                "health_risk_prediction",
            ),
            (
                "assess risk for patient: respiratory rate 24 oxygen saturation 91 heart rate 132 systolic bp 100 temp 38 consciousness verbal",
                "health_risk_prediction",
            ),
            (
                "patient risk: RR 30 SpO2 88 HR 140 SBP 90 temp 39 consciousness P on oxygen 1",
                "health_risk_prediction",
            ),
            ("what medicine is best for hepatitis", "unknown"),
            ("can paracetamol worsen hepatitis", "side_effect_lookup"),
            ("warfarin", "side_effect_lookup"),
        ]

        for query, expected_intent in cases:
            with self.subTest(query=query):
                result = self.router.route(query)
                self.assertEqual(result.intent, expected_intent)

    def test_interaction_query_extracts_multiple_drugs(self) -> None:
        result = self.router.route("does ibuprofen interact with warfarin")
        self.assertEqual(result.intent, "drug_interaction")
        self.assertGreaterEqual(len(result.extracted_drugs), 2)
        self.assertIn("ibuprofen", result.extracted_drugs)
        self.assertIn("warfarin", result.extracted_drugs)

    def test_side_effect_query_extracts_single_drug(self) -> None:
        result = self.router.route("Tylenol side effects")
        self.assertEqual(result.intent, "side_effect_lookup")
        self.assertTrue(result.extracted_drug)

    def test_side_effect_query_does_not_extract_generic_phrase_as_drug(self) -> None:
        result = self.router.route("What are the side effects of doxycycline?")
        self.assertEqual(result.intent, "side_effect_lookup")
        self.assertEqual(result.extracted_drug, "doxycycline")
        self.assertNotIn("side effects", result.extracted_drugs)

    def test_health_risk_query_extracts_profile_fields(self) -> None:
        result = self.router.route(
            "RR 28, SpO2 89, O2 scale 2, SBP 95, HR 128, temp 38.4, consciousness alert, on oxygen 1"
        )
        self.assertEqual(result.intent, "health_risk_prediction")
        self.assertEqual(result.patient_profile["respiratory_rate"], 28.0)
        self.assertEqual(result.patient_profile["oxygen_saturation"], 89.0)
        self.assertEqual(result.patient_profile["heart_rate"], 128.0)
        self.assertEqual(result.patient_profile["consciousness"], "A")

    def test_medical_concept_question_routes_to_glossary_help(self) -> None:
        result = self.router.route("what is RR")
        self.assertEqual(result.intent, "medical_concept_help")

    def test_unknown_concept_question_routes_to_concept_help(self) -> None:
        result = self.router.route("what is tidal volume")
        self.assertEqual(result.intent, "medical_concept_help")


if __name__ == "__main__":
    unittest.main()
