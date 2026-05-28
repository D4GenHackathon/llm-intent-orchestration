"""Tests for sensor early-warning and guideline RAG orchestration."""

from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from services.early_warning_service import EarlyWarningService


class FakeVectorStore:
    def is_available(self) -> bool:
        return True

    def search(self, query: str, top_k: int = 5) -> list[dict]:
        return [
            {
                "id": "NICE_CG50_0001",
                "text": "Physiological observations should include heart rate and temperature.",
                "metadata": {
                    "guideline": "NICE_CG50",
                    "page_start": 10,
                    "page_end": 12,
                },
                "score": 0.7,
            }
        ][:top_k]


class FakePatientHistory:
    def to_dict(self) -> dict:
        return {
            "patient_id": "P000004",
            "age": 28,
            "gender": "female",
            "blood_type": "O+",
            "medical_condition": "Diabetes",
            "admission_type": "Elective",
            "medication": "Ibuprofen",
            "test_results": "Abnormal",
            "comorbidities": {
                "arthritis": False,
                "asthma": False,
                "cancer": False,
                "diabetes": True,
                "hypertension": False,
                "obesity": False,
            },
        }


class FakePatientHistoryRepository:
    def normalize_patient_id(self, patient_id: str | int) -> str:
        raw = str(patient_id).strip()
        if raw.upper().startswith("P"):
            return raw.upper()
        return f"P{int(raw):06d}"

    def get_by_patient_id(self, patient_id: str | int) -> FakePatientHistory | None:
        return FakePatientHistory() if self.normalize_patient_id(patient_id) == "P000004" else None


class FakeVitalsRecord:
    patient_id = "P000004"
    timestamp = "2026-04-24 10:00"
    temperature = 38.5
    heart_rate = 125.0
    fall_detected = False


class FakePatientVitalsRepository:
    def get_by_patient_and_timestamp(self, patient_id: str | int | None, timestamp: str | None) -> FakeVitalsRecord | None:
        return FakeVitalsRecord() if patient_id == "P000004" and timestamp == "2026-04-24 10:00" else None


class EarlyWarningServiceTests(unittest.TestCase):
    def test_normal_record_does_not_trigger_rag(self) -> None:
        service = EarlyWarningService(vector_store=FakeVectorStore(), enable_llm=False)
        response = service.evaluate(
            {
                "timestamp": "2026-04-24 08:00",
                "temperature": 37.2,
                "heart_rate": 75,
                "fall_detected": False,
            }
        ).to_dict()

        self.assertTrue(response["success"])
        result = response["data"]["result"]
        self.assertFalse(result["alert_required"])
        self.assertEqual(result["abnormalities"], [])

    def test_abnormal_record_returns_rag_context_and_alert(self) -> None:
        service = EarlyWarningService(vector_store=FakeVectorStore(), enable_llm=False)
        response = service.evaluate(
            {
                "timestamp": "2026-04-24 15:00",
                "temperature": 38.5,
                "heartRate": 125,
                "fallDetected": True,
                "age": 70,
                "gender": "female",
            },
            top_k=1,
        ).to_dict()

        self.assertTrue(response["success"])
        result = response["data"]["result"]
        self.assertTrue(result["alert_required"])
        self.assertEqual(
            [item["type"] for item in result["abnormalities"]],
            ["high_temperature", "high_heart_rate", "fall_detected"],
        )
        self.assertIn("70-year-old", result["rag_query"])
        self.assertEqual(result["sources"], ["NICE_CG50 pp. 10-12"])
        self.assertFalse(result["llm_used"])

    def test_patient_id_enriches_record_from_history(self) -> None:
        service = EarlyWarningService(
            vector_store=FakeVectorStore(),
            patient_history_repository=FakePatientHistoryRepository(),
            enable_llm=False,
        )
        response = service.evaluate(
            {
                "patient_id": "4",
                "timestamp": "2026-04-24 10:00",
                "temperature": 38.5,
                "heart_rate": 125,
                "fall_detected": False,
            },
            top_k=1,
        ).to_dict()

        result = response["data"]["result"]
        self.assertEqual(result["record"]["patient_id"], "P000004")
        self.assertEqual(result["record"]["age"], 28)
        self.assertEqual(result["record"]["gender"], "female")
        self.assertEqual(result["record"]["patient_history"]["medical_condition"], "Diabetes")
        self.assertIn("28-year-old", result["rag_query"])
        self.assertIn("medical history of Diabetes", result["rag_query"])
        self.assertIn("Patient history", result["alert"])

    def test_patient_id_and_timestamp_lookup_sensor_record(self) -> None:
        service = EarlyWarningService(
            vector_store=FakeVectorStore(),
            patient_history_repository=FakePatientHistoryRepository(),
            patient_vitals_repository=FakePatientVitalsRepository(),
            enable_llm=False,
        )
        response = service.evaluate(
            {
                "patient_id": "P000004",
                "timestamp": "2026-04-24 10:00",
            },
            top_k=1,
        ).to_dict()

        self.assertTrue(response["success"])
        result = response["data"]["result"]
        self.assertEqual(result["record"]["temperature"], 38.5)
        self.assertEqual(result["record"]["heart_rate"], 125.0)
        self.assertEqual(result["record"]["fall_detected"], False)
        self.assertEqual(
            [item["type"] for item in result["abnormalities"]],
            ["high_temperature", "high_heart_rate"],
        )


if __name__ == "__main__":
    unittest.main()
