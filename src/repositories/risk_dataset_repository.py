"""Repository for the health risk tabular dataset."""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Dict, List

from data_access.database import CsvDatabase


@dataclass(frozen=True)
class RiskRecord:
    """Typed row from the health risk dataset."""

    patient_id: str
    respiratory_rate: float
    oxygen_saturation: float
    o2_scale: float
    systolic_bp: float
    heart_rate: float
    temperature: float
    consciousness: str
    on_oxygen: float
    risk_level: str


class RiskDatasetRepository:
    """Read-only repository for risk training and evidence data."""

    NUMERIC_FIELDS = [
        "respiratory_rate",
        "oxygen_saturation",
        "o2_scale",
        "systolic_bp",
        "heart_rate",
        "temperature",
        "on_oxygen",
    ]
    CATEGORICAL_FIELDS = ["consciousness"]

    def __init__(self, database: CsvDatabase | None = None) -> None:
        self.database = database or CsvDatabase()

    @lru_cache(maxsize=1)
    def list_records(self) -> List[RiskRecord]:
        """Load and type-cast all rows from the risk dataset."""
        rows = self.database.load_csv("Health_Risk_Dataset.csv")
        records: List[RiskRecord] = []
        for row in rows:
            records.append(
                RiskRecord(
                    patient_id=(row.get("Patient_ID") or "").strip(),
                    respiratory_rate=float(row["Respiratory_Rate"]),
                    oxygen_saturation=float(row["Oxygen_Saturation"]),
                    o2_scale=float(row["O2_Scale"]),
                    systolic_bp=float(row["Systolic_BP"]),
                    heart_rate=float(row["Heart_Rate"]),
                    temperature=float(row["Temperature"]),
                    consciousness=(row.get("Consciousness") or "").strip(),
                    on_oxygen=float(row["On_Oxygen"]),
                    risk_level=(row.get("Risk_Level") or "").strip(),
                )
            )
        return records

    def numeric_ranges(self) -> Dict[str, float]:
        """Return feature ranges for normalized distance calculations."""
        records = self.list_records()
        ranges: Dict[str, float] = {}
        for field in self.NUMERIC_FIELDS:
            values = [getattr(record, field) for record in records]
            ranges[field] = max(max(values) - min(values), 1.0)
        return ranges
