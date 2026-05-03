"""Tests for prescription safety checks against patient history."""

from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from repositories.side_effect_repository import SideEffectRecord
from services.prescription_safety_service import PrescriptionSafetyService


class FakePatientHistory:
    def __init__(self, condition: str) -> None:
        self.condition = condition

    def to_dict(self) -> dict:
        condition = self.condition.casefold()
        return {
            "patient_id": "P000012",
            "age": 38,
            "gender": "female",
            "blood_type": "O+",
            "medical_condition": self.condition,
            "admission_type": "Urgent",
            "medication": "Lipitor",
            "test_results": "Normal",
            "comorbidities": {
                "arthritis": condition == "arthritis",
                "asthma": condition == "asthma",
                "cancer": condition == "cancer",
                "diabetes": condition == "diabetes",
                "hypertension": condition == "hypertension",
                "obesity": condition == "obesity",
            },
        }


class FakePatientHistoryRepository:
    def __init__(self, condition: str) -> None:
        self.condition = condition

    def normalize_patient_id(self, patient_id: str | int) -> str:
        raw = str(patient_id).strip()
        if raw.upper().startswith("P"):
            return raw.upper()
        return f"P{int(raw):06d}"

    def get_by_patient_id(self, patient_id: str | int) -> FakePatientHistory | None:
        return FakePatientHistory(self.condition)


class FakeSideEffectRepository:
    def get_known_drug_names(self) -> list[str]:
        return ["methylphenidate", "prednisone", "respiratory risk drug", "plain drug"]

    def find_by_name(self, drug_name: str) -> SideEffectRecord | None:
        records = {
            "methylphenidate": SideEffectRecord(
                drug_name="methylphenidate",
                generic_name="methylphenidate",
                side_effects=(
                    "Methylphenidate may cause serious side effects. "
                    "Call your doctor if you have increased blood pressure, chest pain, or fast heartbeat."
                ),
                drug_classes="CNS stimulants",
                brand_names="Ritalin",
            ),
            "prednisone": SideEffectRecord(
                drug_name="prednisone",
                generic_name="prednisone",
                side_effects="Prednisone can cause high blood sugar and fluid retention.",
                drug_classes="Glucocorticoids",
                brand_names="",
            ),
            "respiratory risk drug": SideEffectRecord(
                drug_name="respiratory risk drug",
                generic_name="respiratory risk drug",
                side_effects="This medicine can cause wheezing, shortness of breath, and trouble breathing.",
                drug_classes="Demo",
                brand_names="",
            ),
            "plain drug": SideEffectRecord(
                drug_name="plain drug",
                generic_name="plain drug",
                side_effects="This medicine can cause mild nausea.",
                drug_classes="Demo",
                brand_names="",
            ),
        }
        return records.get(drug_name)


class PrescriptionSafetyServiceTests(unittest.TestCase):
    def test_hypertension_and_blood_pressure_side_effect_generates_warning(self) -> None:
        service = PrescriptionSafetyService(
            patient_history_repository=FakePatientHistoryRepository("Hypertension"),
            side_effect_repository=FakeSideEffectRepository(),
        )

        response = service.evaluate({"patient_id": "P000012", "drugName": "methylphenidate"}).to_dict()

        self.assertTrue(response["success"])
        result = response["data"]["result"]
        self.assertTrue(result["alert_required"])
        self.assertEqual(result["warnings"][0]["type"], "hypertension_side_effect_risk")
        self.assertIn("increased blood pressure", result["warnings"][0]["matched_terms"])

    def test_non_hypertension_patient_does_not_generate_blood_pressure_warning(self) -> None:
        service = PrescriptionSafetyService(
            patient_history_repository=FakePatientHistoryRepository("Diabetes"),
            side_effect_repository=FakeSideEffectRepository(),
        )

        response = service.evaluate({"patient_id": "P000004", "drugName": "methylphenidate"}).to_dict()

        self.assertTrue(response["success"])
        result = response["data"]["result"]
        self.assertFalse(result["alert_required"])
        self.assertEqual(result["warnings"], [])

    def test_diabetes_and_blood_sugar_side_effect_generates_warning(self) -> None:
        service = PrescriptionSafetyService(
            patient_history_repository=FakePatientHistoryRepository("Diabetes"),
            side_effect_repository=FakeSideEffectRepository(),
        )

        response = service.evaluate({"patient_id": "P000004", "drugName": "prednisone"}).to_dict()

        result = response["data"]["result"]
        self.assertTrue(result["alert_required"])
        self.assertEqual(result["warnings"][0]["type"], "diabetes_glucose_side_effect_risk")
        self.assertIn("high blood sugar", result["warnings"][0]["matched_terms"])

    def test_asthma_and_respiratory_side_effect_generates_warning(self) -> None:
        service = PrescriptionSafetyService(
            patient_history_repository=FakePatientHistoryRepository("Asthma"),
            side_effect_repository=FakeSideEffectRepository(),
        )

        response = service.evaluate({"patient_id": "P000008", "drugName": "respiratory-risk-drug"}).to_dict()

        result = response["data"]["result"]
        self.assertTrue(result["alert_required"])
        self.assertEqual(result["warnings"][0]["type"], "asthma_respiratory_side_effect_risk")
        self.assertIn("shortness of breath", result["warnings"][0]["matched_terms"])

    def test_condition_without_matching_side_effect_does_not_warn(self) -> None:
        service = PrescriptionSafetyService(
            patient_history_repository=FakePatientHistoryRepository("Asthma"),
            side_effect_repository=FakeSideEffectRepository(),
        )

        response = service.evaluate({"patient_id": "P000008", "drugName": "plain-drug"}).to_dict()

        result = response["data"]["result"]
        self.assertFalse(result["alert_required"])
        self.assertEqual(result["warnings"], [])


if __name__ == "__main__":
    unittest.main()
