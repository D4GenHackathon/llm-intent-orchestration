"""Human-friendly formatting for medical chatbot responses."""

from __future__ import annotations

from typing import Dict, List


class MedicalResponseFormatter:
    """Convert structured workflow outputs into concise user-facing text."""

    def format_chat_result(self, result: Dict[str, object]) -> str:
        """Render a routed medical chat result as readable plain text."""
        intent = str(result.get("intent", "unknown"))
        workflow_response = result.get("workflow_response", {})
        if not isinstance(workflow_response, dict):
            workflow_response = {}
        return self._format_workflow_body(intent, workflow_response).strip()

    def _format_workflow_body(self, intent: str, workflow_response: Dict[str, object]) -> str:
        if not workflow_response.get("success"):
            return self._format_failure(workflow_response)

        if intent == "drug_interaction":
            return self._format_interaction(workflow_response)
        if intent == "side_effect_lookup":
            return self._format_side_effects(workflow_response)
        if intent == "health_risk_prediction":
            return self._format_health_risk(workflow_response)
        if intent == "medical_concept_help":
            return self._format_concept_help(workflow_response)
        if intent == "small_talk":
            return self._format_small_talk()
        if intent == "help":
            return self._format_help()
        return self._format_failure(workflow_response)

    def _format_interaction(self, workflow_response: Dict[str, object]) -> str:
        result = self._result_payload(workflow_response)
        normalized_drugs = result.get("normalized_drugs", [])
        interacting_pairs = result.get("interacting_pairs", [])

        if not interacting_pairs:
            if normalized_drugs:
                meds = ", ".join(str(item) for item in normalized_drugs)
                return (
                    f"I checked these medications: {meds}. "
                    "I could not find an interaction record for the detected drug pair(s) in the current database."
                )
            return "I could not find an interaction record for the detected drug pair(s) in the current database."

        valid_pairs = [pair for pair in interacting_pairs if isinstance(pair, dict)]
        if len(valid_pairs) == 1:
            pair = valid_pairs[0]
            drug_1 = str(pair.get("drug_1") or "the first medication")
            drug_2 = str(pair.get("drug_2") or "the second medication")
            description = str(pair.get("description") or pair.get("recommendation") or "")
            if description:
                return f"I found a potential interaction between {drug_1} and {drug_2}. {description}"
            return f"I found a potential interaction between {drug_1} and {drug_2}."

        lines: List[str] = ["I found potential interactions between:"]
        for pair in valid_pairs:
            summary = (
                f"- {pair.get('drug_1')} and {pair.get('drug_2')}: "
                f"{pair.get('description') or pair.get('recommendation')}"
            )
            lines.append(summary)
        return "\n".join(lines)

    def _format_side_effects(self, workflow_response: Dict[str, object]) -> str:
        result = self._result_payload(workflow_response)
        groups = result.get("groups", {})
        if not isinstance(groups, dict):
            groups = {}

        lines = [
            f"I looked up side-effect information for {result.get('normalized_drug') or 'this drug'}.",
        ]
        generic_name = result.get("generic_name")
        if generic_name:
            lines.append(f"Generic name: {generic_name}")

        for label, key in (
            ("Common", "common"),
            ("Serious", "serious"),
            ("Rare", "rare"),
            ("When to seek care", "when_to_seek_care"),
        ):
            items = groups.get(key, [])
            if isinstance(items, list) and items:
                lines.append(f"{label}: " + "; ".join(str(item) for item in items[:5]))
        if len(lines) == 2:
            lines.append("No grouped side-effect details were available in the current dataset.")
        return "\n".join(lines)

    def _format_health_risk(self, workflow_response: Dict[str, object]) -> str:
        result = self._result_payload(workflow_response)
        predicted_risk = str(result.get("predicted_risk") or "Unknown")
        confidence = self._format_confidence(result.get("confidence"))
        if confidence != "Unknown":
            return f"The trained model classifies this profile as {predicted_risk} risk, with a confidence of {confidence}."
        return f"The trained model classifies this profile as {predicted_risk} risk."

    def _format_concept_help(self, workflow_response: Dict[str, object]) -> str:
        data = workflow_response.get("data", {})
        if not isinstance(data, dict):
            return str(workflow_response.get("message") or "")

        explanation = data.get("explanation")
        if explanation:
            return str(explanation)
        return str(workflow_response.get("message") or "")

    def _format_failure(self, workflow_response: Dict[str, object]) -> str:
        message = str(workflow_response.get("message") or "The workflow could not complete.")
        warnings = workflow_response.get("warnings", [])
        lines = [message]
        if isinstance(warnings, list) and warnings:
            lines.extend(f"- {warning}" for warning in warnings)
        return "\n".join(lines)

    def _format_small_talk(self) -> str:
        return (
            "Hello. I can help with drug interactions, side effects, and health risk prediction. "
            "You can pick one of the task buttons below, or just ask naturally."
        )

    def _format_help(self) -> str:
        return (
            "I currently support three workflows: drug interaction checking, side-effect lookup, "
            "and health risk prediction. Example questions: 'Does ibuprofen interact with warfarin?', "
            "'What are the side effects of doxycycline?', or "
            "'RR 28, SpO2 89, O2 scale 2, SBP 95, HR 128, temp 38.4, consciousness alert, on oxygen 1'."
        )

    def _result_payload(self, workflow_response: Dict[str, object]) -> Dict[str, object]:
        data = workflow_response.get("data", {})
        if not isinstance(data, dict):
            return {}
        result = data.get("result", {})
        return result if isinstance(result, dict) else {}

    def _format_confidence(self, value: object) -> str:
        if isinstance(value, (float, int)):
            return f"{round(float(value) * 100)}%"
        return "Unknown"
