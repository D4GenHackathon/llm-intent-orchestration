"""Schemas for drug side-effect lookup."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List


@dataclass
class SideEffectLookupRequest:
    """Input contract for side-effect lookup."""

    query: str = ""
    drug_name: str = ""


@dataclass
class SideEffectGroup:
    """Grouped side-effect sections for a drug."""

    common: List[str] = field(default_factory=list)
    serious: List[str] = field(default_factory=list)
    rare: List[str] = field(default_factory=list)
    when_to_seek_care: List[str] = field(default_factory=list)


@dataclass
class SideEffectLookupResponse:
    """Response payload for side-effect lookup."""

    normalized_drug: str
    generic_name: str
    groups: SideEffectGroup
    source: str
    explanation: str

