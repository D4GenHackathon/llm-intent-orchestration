"""Planner for conversational medical chat orchestration."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List

from router.intent_router import MedicalIntentResult, MedicalIntentRouter


WORKFLOW_INTENTS = {
    "drug_interaction",
    "side_effect_lookup",
    "health_risk_prediction",
    "medical_concept_help",
}
SOCIAL_INTENTS = {
    "small_talk",
    "help",
}


@dataclass
class ChatPlan:
    """Planner output for the medical chatbot."""

    route: str
    intent_result: MedicalIntentResult
    reasons: List[str] = field(default_factory=list)
    clarification_message: str = ""


class MedicalChatPlanner:
    """Decide whether a query should go to social chat, a workflow, or clarification."""

    def __init__(self, router: MedicalIntentRouter | None = None) -> None:
        self.router = router or MedicalIntentRouter()

    def plan(self, query: str) -> ChatPlan:
        """Create a minimal plan from the current query."""
        intent_result = self.router.route(query)

        if intent_result.intent in SOCIAL_INTENTS:
            return ChatPlan(
                route="social",
                intent_result=intent_result,
                reasons=["The query is conversational and can be handled without invoking a medical workflow."],
            )

        if intent_result.intent in WORKFLOW_INTENTS:
            return ChatPlan(
                route="workflow",
                intent_result=intent_result,
                reasons=["A supported deterministic medical workflow was identified."],
            )

        return ChatPlan(
            route="clarification",
            intent_result=intent_result,
            reasons=["The query did not map confidently to a supported workflow."],
            clarification_message=(
                "I can currently help with drug interactions, side effects, and health risk prediction. "
                "Please rephrase your question toward one of those workflows."
            ),
        )
