"""Repository for deterministic drug interaction lookup."""

from __future__ import annotations

import re
from dataclasses import dataclass
from functools import lru_cache
from typing import Dict, Iterable, List, Optional, Set, Tuple

from data_access.database import CsvDatabase


def canonicalize_drug_name(value: str) -> str:
    """Normalize a drug label for matching and indexing."""
    cleaned = re.sub(r"[^a-z0-9\s]", " ", (value or "").casefold())
    return " ".join(cleaned.split())


@dataclass(frozen=True)
class InteractionRecord:
    """Structured interaction record backed by CSV data."""

    drug_1: str
    drug_2: str
    description: str
    source: str = "data/db_drug_interactions.csv"


class InteractionRepository:
    """Deterministic pairwise lookup over the interaction dataset."""

    def __init__(self, database: CsvDatabase | None = None) -> None:
        self.database = database or CsvDatabase()

    @lru_cache(maxsize=1)
    def _index(self) -> Dict[Tuple[str, str], InteractionRecord]:
        rows = self.database.load_csv("db_drug_interactions.csv")
        index: Dict[Tuple[str, str], InteractionRecord] = {}
        for row in rows:
            drug_1 = (row.get("Drug 1") or "").strip()
            drug_2 = (row.get("Drug 2") or "").strip()
            description = (row.get("Interaction Description") or "").strip()
            if not drug_1 or not drug_2 or not description:
                continue

            key = tuple(sorted((canonicalize_drug_name(drug_1), canonicalize_drug_name(drug_2))))
            index[key] = InteractionRecord(drug_1=drug_1, drug_2=drug_2, description=description)
        return index

    @lru_cache(maxsize=1)
    def _known_names(self) -> Set[str]:
        names: Set[str] = set()
        for record in self._index().values():
            names.add(record.drug_1)
            names.add(record.drug_2)
        return names

    def get_known_drug_names(self) -> List[str]:
        """Return known drug names from the interaction dataset."""
        return sorted(self._known_names())

    def find_interaction(self, drug_a: str, drug_b: str) -> Optional[InteractionRecord]:
        """Find a pairwise interaction for two normalized or raw drug names."""
        key = tuple(sorted((canonicalize_drug_name(drug_a), canonicalize_drug_name(drug_b))))
        return self._index().get(key)

    def find_interactions_for_drugs(self, drugs: Iterable[str]) -> List[InteractionRecord]:
        """Find all pairwise interactions for an input list of drugs."""
        normalized = list(dict.fromkeys(drugs))
        results: List[InteractionRecord] = []
        for left_index in range(len(normalized)):
            for right_index in range(left_index + 1, len(normalized)):
                record = self.find_interaction(normalized[left_index], normalized[right_index])
                if record:
                    results.append(record)
        return results
