"""Patient sensor-vital lookup backed by the patient vitals CSV."""

from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from repositories.patient_history import PatientHistoryRepository


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_PATIENT_VITALS_PATH = PROJECT_ROOT / "data" / "patient_vitals.csv"


@dataclass(frozen=True)
class PatientVitals:
    """Normalized patient sensor record for one timestamp."""

    patient_id: str
    timestamp: str
    temperature: float
    heart_rate: float
    fall_detected: bool

    def to_dict(self) -> dict[str, Any]:
        return {
            "patient_id": self.patient_id,
            "timestamp": self.timestamp,
            "temperature": self.temperature,
            "heart_rate": self.heart_rate,
            "fall_detected": self.fall_detected,
        }


class PatientVitalsRepository:
    """Load sensor vitals by patient_id and timestamp."""

    def __init__(self, dataset_path: Path | None = None) -> None:
        self.dataset_path = dataset_path or DEFAULT_PATIENT_VITALS_PATH
        self._records: dict[tuple[str, str], PatientVitals] | None = None
        self._patient_id_normalizer = PatientHistoryRepository().normalize_patient_id

    def get_by_patient_and_timestamp(
        self,
        patient_id: str | int | None,
        timestamp: str | None,
    ) -> PatientVitals | None:
        if patient_id in (None, "") or timestamp in (None, ""):
            return None
        self._load()
        normalized_id = self._patient_id_normalizer(patient_id)
        normalized_timestamp = str(timestamp).strip()
        return self._records.get((normalized_id, normalized_timestamp)) if self._records is not None else None

    def _load(self) -> None:
        if self._records is not None:
            return
        records: dict[tuple[str, str], PatientVitals] = {}
        with self.dataset_path.open(encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                patient_id = self._patient_id_normalizer(str(row.get("patient_id", "")).strip())
                timestamp = str(row.get("timestamp", "")).strip()
                if not patient_id or not timestamp:
                    continue
                fall_detected = str(row.get("fall_detected", "")).strip().casefold() in {"true", "1", "yes", "y"}
                records[(patient_id, timestamp)] = PatientVitals(
                    patient_id=patient_id,
                    timestamp=timestamp,
                    temperature=float(row.get("temperature") or 0),
                    heart_rate=float(row.get("heart_rate") or 0),
                    fall_detected=fall_detected,
                )
        self._records = records
