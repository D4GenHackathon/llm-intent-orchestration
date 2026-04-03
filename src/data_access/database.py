"""Shared CSV-backed data access utilities for MVP repositories."""

from __future__ import annotations

import csv
from functools import lru_cache
from pathlib import Path
from typing import Dict, List


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = PROJECT_ROOT / "data"


class CsvDatabase:
    """Lightweight CSV loader used as a stand-in for structured data sources."""

    def __init__(self, data_dir: Path | None = None) -> None:
        self.data_dir = data_dir or DATA_DIR

    @lru_cache(maxsize=8)
    def load_csv(self, filename: str) -> List[Dict[str, str]]:
        """Load a CSV file from the repository data directory."""
        path = self.data_dir / filename
        if not path.exists():
            raise FileNotFoundError(f"Data file not found: {path}")

        with path.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            return [dict(row) for row in reader]
