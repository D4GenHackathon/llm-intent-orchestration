"""Drug side-effect lookup task."""

from __future__ import annotations

from typing import Optional

from crewai import Task
from schemas.side_effect import SideEffectLookupRequest
from services.side_effect_service import SideEffectService


def side_effect_router(agent, query: Optional[str] = None, drug_name: Optional[str] = None):
    """Create a CrewAI task for grouped side-effect lookup."""
    service = SideEffectService()
    task = service.lookup_side_effects(
            SideEffectLookupRequest(query=query or "", drug_name=drug_name or "")
            ).to_dict()
    return Task(
        description=(
            f"Look up structured side effects for drug {drug_name or 'from query'}. "
            f"Use deterministic source data only. Query: {query or 'N/A'}."
        ),
        expected_output=(
            "Grouped side effects including common, serious, rare, when_to_seek_care, and the underlying source."
        ),
        task=task,
        service=service,
        agent=agent,
    )

