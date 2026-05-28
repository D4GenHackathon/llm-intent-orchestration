"""Repository for deterministic side-effect lookup."""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Dict, List, Optional, Set

from db.database import CsvDatabase
from repositories.interaction import canonicalize_drug_name


@dataclass(frozen=True)
class SideEffectRecord:
    """Structured side-effect source record."""

    drug_name: str
    generic_name: str
    side_effects: str
    drug_classes: str
    brand_names: str
    source: str = "data/drugs_side_effects_drugs_com.csv"


class SideEffectRepository:
    """Lookup repository backed by the drugs.com side-effect export."""

    def __init__(self, database: CsvDatabase | None = None) -> None:
        self.database = database or CsvDatabase()

    @lru_cache(maxsize=1)
    def _index(self) -> Dict[str, SideEffectRecord]:
        rows = self.database.load_csv("drugs_side_effects_drugs_com.csv")
        index: Dict[str, SideEffectRecord] = {}
        priority_index: Dict[str, int] = {}

        for row in rows:
            drug_name = (row.get("drug_name") or "").strip()
            generic_name = (row.get("generic_name") or "").strip()
            side_effects = (row.get("side_effects") or "").strip()
            if not drug_name or not side_effects:
                continue

            record = SideEffectRecord(
                drug_name=drug_name,
                generic_name=generic_name,
                side_effects=side_effects,
                drug_classes=(row.get("drug_classes") or "").strip(),
                brand_names=(row.get("brand_names") or "").strip(),
            )

            exact_names: Set[str] = {
                canonicalize_drug_name(drug_name),
            }
            generic_names: Set[str] = {
                canonicalize_drug_name(generic_name),
            }
            brand_names: Set[str] = set()
            for brand_name in record.brand_names.split(","):
                brand_names.add(canonicalize_drug_name(brand_name))

            for name in exact_names:
                self._store_with_priority(index, priority_index, name, record, priority=3)
            for name in generic_names:
                self._store_with_priority(index, priority_index, name, record, priority=2)
            for name in brand_names:
                self._store_with_priority(index, priority_index, name, record, priority=1)
        return index

    def _store_with_priority(
        self,
        index: Dict[str, SideEffectRecord],
        priority_index: Dict[str, int],
        name: str,
        record: SideEffectRecord,
        priority: int,
    ) -> None:
        if not name:
            return

        current_priority = priority_index.get(name, -1)
        if priority >= current_priority:
            index[name] = record
            priority_index[name] = priority

    def get_known_drug_names(self) -> List[str]:
        """Return the indexed names available for side-effect lookup."""
        return sorted(self._index().keys())

    def find_by_name(self, drug_name: str) -> Optional[SideEffectRecord]:
        """Return a matching side-effect record for a raw or normalized name."""
        return self._index().get(canonicalize_drug_name(drug_name))
