"""CLI bridge for free-text medical routing across the MVP workflows."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = PROJECT_ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from services.runtime_env import load_medical_environment
from router.medical_chat_graph import MedicalChatGraph
from schemas.interaction import DrugInteractionRequest
from schemas.risk import HealthRiskInput
from schemas.side_effect import SideEffectLookupRequest
from services.interaction_service import InteractionService
from services.gemini_response_rewriter import GeminiResponseRewriter
from services.medical_concept_service import MedicalConceptService
from services.medical_response_formatter import MedicalResponseFormatter
from services.risk_prediction_service import RiskPredictionService
from services.side_effect_service import SideEffectService


REQUIRED_RISK_FIELDS = (
    "respiratory_rate",
    "oxygen_saturation",
    "o2_scale",
    "systolic_bp",
    "heart_rate",
    "temperature",
    "consciousness",
    "on_oxygen",
)


def main() -> int:
    """Read a free-text query, route it, and run the selected Python workflow."""
    try:
        load_medical_environment()
        args = _parse_args()
        payload = json.loads(sys.stdin.read() or "{}")
        query = str(payload.get("query", ""))
        planner = MedicalChatGraph()
        plan = planner.plan(query)
        intent_result = plan.intent_result

        workflow_response = _run_plan(query, plan)
        formatter = MedicalResponseFormatter()
        draft_answer = formatter.format_chat_result(
            {
                "intent": intent_result.intent,
                "confidence": intent_result.confidence,
                "workflow_response": workflow_response,
            }
        )
        formatted_answer = (
            GeminiResponseRewriter().rewrite(intent_result.intent, workflow_response, draft_answer)
            or draft_answer
        )

        response = {
            "success": True,
            "data": {
                "result": {
                    "query": query,
                    "planner_route": plan.route,
                    "intent": intent_result.intent,
                    "confidence": intent_result.confidence,
                    "reasons": intent_result.reasons + plan.reasons,
                    "extracted_drugs": intent_result.extracted_drugs,
                    "extracted_drug": intent_result.extracted_drug,
                    "patient_profile": intent_result.patient_profile,
                    "workflow_response": workflow_response,
                    "formatted_answer": formatted_answer,
                }
            },
        }
        if args.pretty:
            print(response["data"]["result"]["formatted_answer"])
        else:
            print(json.dumps(response))
        return 0
    except Exception as exc:  # pragma: no cover - CLI fallback path
        print(json.dumps({"success": False, "error": str(exc)}))
        return 1


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Route a medical query and run the matching workflow.")
    parser.add_argument(
        "--pretty",
        action="store_true",
        help="Print a human-friendly answer instead of raw JSON.",
    )
    return parser.parse_args()


def _run_plan(query: str, plan) -> dict:
    intent_result = plan.intent_result

    if plan.route == "clarification":
        return {
            "success": False,
            "message": plan.clarification_message,
            "data": {},
            "warnings": ["No deterministic workflow was triggered for this query."],
        }

    if intent_result.intent == "drug_interaction":
        return InteractionService().check_interactions(
            DrugInteractionRequest(query=query, drugs=intent_result.extracted_drugs)
        ).to_dict()

    if intent_result.intent == "side_effect_lookup":
        return SideEffectService().lookup_side_effects(
            SideEffectLookupRequest(query=query, drug_name=intent_result.extracted_drug)
        ).to_dict()

    if intent_result.intent == "health_risk_prediction":
        missing = [field for field in REQUIRED_RISK_FIELDS if field not in intent_result.patient_profile]
        if missing:
            return {
                "success": False,
                "message": (
                    "The query looks like a health-risk request, but some structured fields are still missing: "
                    + ", ".join(missing)
                ),
                "data": {"patient_profile": intent_result.patient_profile},
                "warnings": ["Provide the missing values to run the trained risk model."],
            }

        health_input = HealthRiskInput(**intent_result.patient_profile)
        return RiskPredictionService().predict_risk(health_input).to_dict()

    if intent_result.intent == "medical_concept_help":
        concept_answer = MedicalConceptService().explain(query)
        if concept_answer:
            return {
                "success": True,
                "message": "Medical concept explanation handled successfully.",
                "data": {
                    "term": concept_answer.term,
                    "explanation": concept_answer.explanation,
                    "source": concept_answer.source,
                },
                "warnings": [],
            }
        return {
            "success": False,
            "message": "I could not match that concept to the current medical glossary.",
            "data": {},
            "warnings": [],
        }

    if intent_result.intent == "small_talk":
        return {
            "success": True,
            "message": "Greeting handled successfully.",
            "data": {},
            "warnings": [],
        }

    if intent_result.intent == "help":
        return {
            "success": True,
            "message": "Help request handled successfully.",
            "data": {},
            "warnings": [],
        }

    return {
        "success": False,
        "message": "I can currently help with drug interactions, side effects, and health risk prediction.",
        "data": {},
        "warnings": ["No deterministic workflow was triggered for this query."],
    }


if __name__ == "__main__":
    raise SystemExit(main())
