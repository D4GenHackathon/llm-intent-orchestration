"""Patient history lookup backed by the healthcare dataset CSV."""

from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_HEALTHCARE_DATASET_PATH = PROJECT_ROOT / "data" / "healthcare_dataset.csv"


@dataclass(frozen=True)
class PatientHistory:
    """Normalized patient history fields used by early-warning workflows."""

    patient_id: str
    age: int
    gender: str
    blood_type: str
    medical_condition: str
    admission_type: str
    medication: str
    test_results: str

    def to_dict(self) -> dict[str, Any]:
        condition = self.medical_condition.strip().casefold()
        return {
            "patient_id": self.patient_id,
            "age": self.age,
            "gender": self.gender,
            "blood_type": self.blood_type,
            "medical_condition": self.medical_condition,
            "admission_type": self.admission_type,
            "medication": self.medication,
            "test_results": self.test_results,
            "comorbidities": {
                "arthritis": condition == "arthritis",
                "asthma": condition == "asthma",
                "cancer": condition == "cancer",
                "diabetes": condition == "diabetes",
                "hypertension": condition == "hypertension",
                "obesity": condition == "obesity",
            },
        }


class PatientHistoryRepository:
    """Load patient history records by patient_id."""

    def __init__(self, dataset_path: Path | None = None) -> None:
        self.dataset_path = dataset_path or DEFAULT_HEALTHCARE_DATASET_PATH
        self._records: dict[str, PatientHistory] | None = None

    def get_by_patient_id(self, patient_id: str | int | None) -> PatientHistory | None:
        if patient_id in (None, ""):
            return None
        self._load()
        normalized_id = self.normalize_patient_id(patient_id)
        return self._records.get(normalized_id) if self._records is not None else None

    def normalize_patient_id(self, patient_id: str | int) -> str:
        raw = str(patient_id).strip()
        if not raw:
            return raw
        if raw.upper().startswith("P"):
            return raw.upper()
        return f"P{int(raw):06d}"

    def _load(self) -> None:
        if self._records is not None:
            return
        records: dict[str, PatientHistory] = {}
        with self.dataset_path.open(encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                patient_id = str(row.get("patient_id", "")).strip()
                if not patient_id:
                    continue
                records[patient_id] = PatientHistory(
                    patient_id=patient_id,
                    age=int(float(row.get("Age") or 0)),
                    gender=str(row.get("Gender") or "").strip().lower(),
                    blood_type=str(row.get("Blood Type") or "").strip(),
                    medical_condition=str(row.get("Medical Condition") or "").strip(),
                    admission_type=str(row.get("Admission Type") or "").strip(),
                    medication=str(row.get("Medication") or "").strip(),
                    test_results=str(row.get("Test Results") or "").strip(),
                )
        self._records = records
