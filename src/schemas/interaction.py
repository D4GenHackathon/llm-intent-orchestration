"""Schemas for drug interaction checking."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class DrugInteractionRequest:
    """Input contract for interaction checking."""

    query: str = ""
    drugs: List[str] = field(default_factory=list)


@dataclass
class PairwiseInteraction:
    """Structured pairwise interaction result."""

    drug_1: str
    drug_2: str
    interaction_found: bool
    severity: Optional[str]
    mechanism: Optional[str]
    recommendation: str
    description: Optional[str]
    source: str


@dataclass
class DrugInteractionResponse:
    """Response payload for the interaction workflow."""

    normalized_drugs: List[str]
    interacting_pairs: List[PairwiseInteraction]
    interaction_found: bool
    explanation: str
    unrecognized_terms: List[str] = field(default_factory=list)
