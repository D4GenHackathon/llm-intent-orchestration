"""Drug side-effect lookup task."""

from __future__ import annotations

from typing import Optional

from crewai import Task


def side_effect_router(agent, query: Optional[str] = None, drug_name: Optional[str] = None):
    """Create a CrewAI task for grouped side-effect lookup."""
    return Task(
        description=(
            f"Look up structured side effects for drug {drug_name or 'from query'}. "
            f"Use deterministic source data only. Query: {query or 'N/A'}."
        ),
        expected_output=(
            "Grouped side effects including common, serious, rare, when_to_seek_care, and the underlying source."
        ),
        agent=agent,
    )

