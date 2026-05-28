"""Drug interaction workflow task."""

from __future__ import annotations

from typing import Optional

from crewai import Task


def drug_interaction_router(agent, query: Optional[str] = None, drugs: Optional[list[str]] = None):
    """Create a CrewAI task for deterministic drug interaction checking."""
    drug_count = len(drugs) if drugs else 0
    return Task(
        description=(
            f"Check structured pairwise interactions for {drug_count} input drugs. "
            f"Use database-backed lookup only. Query: {query or 'N/A'}."
        ),
        expected_output=(
            "A structured interaction report including normalized drugs, interaction_found, severity if available, "
            "mechanism if available, recommendation, and source."
        ),
        agent=agent,
    )

