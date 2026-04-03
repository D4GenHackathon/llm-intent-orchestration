"""LangGraph-backed medical chat routing with a safe local fallback."""

from __future__ import annotations

from typing import Any, TypedDict

from router.chat_planner import ChatPlan, MedicalChatPlanner
from router.intent_router import MedicalIntentResult, MedicalIntentRouter

try:  # pragma: no cover - exercised only when langgraph is installed
    from langgraph.graph import END, START, StateGraph
except ImportError:  # pragma: no cover - covered by fallback tests instead
    END = "__end__"
    START = "__start__"
    StateGraph = None


class MedicalChatGraphState(TypedDict, total=False):
    """State carried across the routing graph."""

    query: str
    route: str
    intent_result: MedicalIntentResult
    reasons: list[str]
    clarification_message: str


class MedicalChatGraph:
    """Route a medical chat query through a small LangGraph state graph."""

    def __init__(self, router: MedicalIntentRouter | None = None) -> None:
        self.router = router or MedicalIntentRouter()
        self._fallback_planner = MedicalChatPlanner(router=self.router)
        self._graph = self._build_graph() if StateGraph is not None else None

    def plan(self, query: str) -> ChatPlan:
        """Return a chat plan using LangGraph when available, otherwise local fallback."""
        if self._graph is None:
            return self._fallback_planner.plan(query)

        state = self._graph.invoke({"query": query})
        intent_result = state.get("intent_result")
        if not isinstance(intent_result, MedicalIntentResult):
            return self._fallback_planner.plan(query)

        return ChatPlan(
            route=str(state.get("route", "clarification")),
            intent_result=intent_result,
            reasons=list(state.get("reasons", [])),
            clarification_message=str(state.get("clarification_message", "")),
        )

    def _build_graph(self):  # pragma: no cover - requires langgraph installed
        workflow = StateGraph(MedicalChatGraphState)
        workflow.add_node("route_query", self._route_query)
        workflow.add_node("social", self._social_node)
        workflow.add_node("workflow", self._workflow_node)
        workflow.add_node("clarification", self._clarification_node)
        workflow.add_edge(START, "route_query")
        workflow.add_conditional_edges(
            "route_query",
            self._pick_branch,
            {
                "social": "social",
                "workflow": "workflow",
                "clarification": "clarification",
            },
        )
        workflow.add_edge("social", END)
        workflow.add_edge("workflow", END)
        workflow.add_edge("clarification", END)
        return workflow.compile()

    def _route_query(self, state: MedicalChatGraphState) -> MedicalChatGraphState:
        query = str(state.get("query", ""))
        plan = self._fallback_planner.plan(query)
        return {
            "query": query,
            "route": plan.route,
            "intent_result": plan.intent_result,
            "reasons": plan.reasons,
            "clarification_message": plan.clarification_message,
        }

    def _social_node(self, state: MedicalChatGraphState) -> MedicalChatGraphState:
        return state

    def _workflow_node(self, state: MedicalChatGraphState) -> MedicalChatGraphState:
        return state

    def _clarification_node(self, state: MedicalChatGraphState) -> MedicalChatGraphState:
        return state

    def _pick_branch(self, state: MedicalChatGraphState) -> str:
        route = str(state.get("route", "clarification"))
        return route if route in {"social", "workflow", "clarification"} else "clarification"
