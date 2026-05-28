"""Prescription safety checks against patient history and drug side-effect text."""

from __future__ import annotations

from dataclasses import dataclass
import re
from typing import Any

from repositories.patient_history_repository import PatientHistoryRepository
from repositories.side_effect_repository import SideEffectRecord, SideEffectRepository
from schemas.response import WorkflowResponse
from services.drug_normalization_service import DrugNormalizationService


@dataclass(frozen=True)
class ConditionRiskRule:
    """Text-match rule linking a patient condition to side-effect warnings."""

    condition_key: str
    display_name: str
    warning_type: str
    terms: tuple[str, ...]
    reason: str
    recommendation: str


class PrescriptionSafetyService:
    """Warn when a newly prescribed drug conflicts with known patient history."""

    CONDITION_RISK_RULES = (
        ConditionRiskRule(
            condition_key="hypertension",
            display_name="Hypertension",
            warning_type="hypertension_side_effect_risk",
            terms=(
                "high blood pressure",
                "increased blood pressure",
                "increase blood pressure",
                "hypertension",
                "hypertensive",
                "blood pressure may increase",
                "raise blood pressure",
                "raises blood pressure",
            ),
            reason=(
                "The patient history includes hypertension, and the side-effect source for the newly "
                "prescribed drug mentions blood-pressure elevation or hypertension-related warnings."
            ),
            recommendation=(
                "Review the prescription before dispensing or administration. Consider blood-pressure monitoring, "
                "alternative therapy, or clinician confirmation according to local policy."
            ),
        ),
        ConditionRiskRule(
            condition_key="diabetes",
            display_name="Diabetes",
            warning_type="diabetes_glucose_side_effect_risk",
            terms=(
                "blood sugar",
                "blood glucose",
                "hyperglycemia",
                "hypoglycemia",
                "increased glucose",
                "increased blood glucose",
                "high blood sugar",
                "low blood sugar",
                "diabetes",
                "diabetic",
            ),
            reason=(
                "The patient history includes diabetes, and the side-effect source for the newly prescribed "
                "drug mentions blood-glucose changes or diabetes-related warnings."
            ),
            recommendation=(
                "Review the prescription and consider glucose monitoring, counselling on warning symptoms, "
                "or clinician confirmation according to local policy."
            ),
        ),
        ConditionRiskRule(
            condition_key="asthma",
            display_name="Asthma",
            warning_type="asthma_respiratory_side_effect_risk",
            terms=(
                "asthma",
                "bronchospasm",
                "wheezing",
                "trouble breathing",
                "difficulty breathing",
                "shortness of breath",
                "breathing problems",
                "respiratory depression",
            ),
            reason=(
                "The patient history includes asthma, and the side-effect source for the newly prescribed "
                "drug mentions respiratory symptoms or asthma-related warnings."
            ),
            recommendation=(
                "Review respiratory risk before dispensing or administration. Consider monitoring breathing symptoms "
                "or obtaining clinician confirmation according to local policy."
            ),
        ),
        ConditionRiskRule(
            condition_key="arthritis",
            display_name="Arthritis",
            warning_type="arthritis_musculoskeletal_side_effect_risk",
            terms=(
                "joint pain",
                "joint swelling",
                "muscle pain",
                "muscle weakness",
                "bone pain",
                "arthritis",
                "tendon pain",
                "tendon rupture",
            ),
            reason=(
                "The patient history includes arthritis, and the side-effect source for the newly prescribed "
                "drug mentions musculoskeletal symptoms that may complicate symptom monitoring."
            ),
            recommendation=(
                "Review whether the side-effect profile could worsen or mask musculoskeletal symptoms, and confirm "
                "the plan with clinical staff when appropriate."
            ),
        ),
        ConditionRiskRule(
            condition_key="cancer",
            display_name="Cancer",
            warning_type="cancer_infection_or_bleeding_side_effect_risk",
            terms=(
                "infection",
                "fever",
                "unusual bleeding",
                "unusual bruising",
                "low white blood cells",
                "neutropenia",
                "immune system",
                "cancer",
                "tumor",
            ),
            reason=(
                "The patient history includes cancer, and the side-effect source for the newly prescribed drug "
                "mentions infection, immune-system, bleeding, or cancer-related warnings."
            ),
            recommendation=(
                "Review infection and bleeding risk before dispensing or administration, especially if the patient "
                "is receiving active cancer treatment or is clinically frail."
            ),
        ),
        ConditionRiskRule(
            condition_key="obesity",
            display_name="Obesity",
            warning_type="obesity_weight_or_cardiometabolic_side_effect_risk",
            terms=(
                "weight gain",
                "increased appetite",
                "fluid retention",
                "swelling",
                "high cholesterol",
                "high blood pressure",
                "blood sugar",
                "metabolic",
            ),
            reason=(
                "The patient history includes obesity, and the side-effect source for the newly prescribed drug "
                "mentions weight, fluid-retention, or cardiometabolic warnings."
            ),
            recommendation=(
                "Review cardiometabolic risk and monitoring needs before dispensing or administration, according to "
                "local policy."
            ),
        ),
    )

    def __init__(
        self,
        patient_history_repository: PatientHistoryRepository | None = None,
        side_effect_repository: SideEffectRepository | None = None,
        normalization_service: DrugNormalizationService | None = None,
    ) -> None:
        self.patient_history_repository = patient_history_repository or PatientHistoryRepository()
        self.side_effect_repository = side_effect_repository or SideEffectRepository()
        self.normalization_service = normalization_service or DrugNormalizationService()

    def evaluate(self, payload: dict[str, Any]) -> WorkflowResponse:
        patient_id = payload.get("patient_id") or payload.get("patientId")
        raw_drug = payload.get("drugName") or payload.get("newDrug") or payload.get("drug_name") or payload.get("drug")
        if not patient_id:
            return WorkflowResponse(
                success=False,
                message="patient_id is required for prescription safety checking.",
            )
        if not raw_drug:
            return WorkflowResponse(
                success=False,
                message="A new prescribed drug name is required for prescription safety checking.",
            )

        history = self.patient_history_repository.get_by_patient_id(patient_id)
        if not history:
            normalized_patient_id = self.patient_history_repository.normalize_patient_id(patient_id)
            return WorkflowResponse(
                success=False,
                message="No patient history was found for the supplied patient_id.",
                data={"patient_id": normalized_patient_id},
            )

        known_drug_names = self.side_effect_repository.get_known_drug_names()
        normalized_drug = self.normalization_service.normalize_drug_name(str(raw_drug), known_names=known_drug_names)
        record = self.side_effect_repository.find_by_name(normalized_drug)
        if not record:
            return WorkflowResponse(
                success=True,
                message="No side-effect record was found for the prescribed drug, so no history-based warning was generated.",
                data={
                    "result": {
                        "patient_history": history.to_dict(),
                        "prescribed_drug": str(raw_drug),
                        "normalized_drug": normalized_drug,
                        "alert_required": False,
                        "warnings": [],
                        "evidence": [],
                    }
                },
                warnings=["Drug was not found in the side-effect dataset."],
            )

        history_dict = history.to_dict()
        warnings = self._evaluate_history_risks(history_dict, record, normalized_drug)
        alert_required = any(item["severity"] in {"warning", "urgent"} for item in warnings)
        message = (
            "Prescription safety warning generated."
            if alert_required
            else "No configured patient-history warning was detected for this prescription."
        )

        return WorkflowResponse(
            success=True,
            message=message,
            data={
                "result": {
                    "patient_history": history_dict,
                    "prescribed_drug": str(raw_drug),
                    "normalized_drug": normalized_drug,
                    "generic_name": record.generic_name or record.drug_name,
                    "alert_required": alert_required,
                    "warnings": warnings,
                    "source": record.source,
                }
            },
        )

    def _evaluate_history_risks(
        self,
        history: dict[str, Any],
        record: SideEffectRecord,
        normalized_drug: str,
    ) -> list[dict[str, Any]]:
        warnings: list[dict[str, Any]] = []
        comorbidities = history.get("comorbidities", {})
        if not isinstance(comorbidities, dict):
            return warnings

        for rule in self.CONDITION_RISK_RULES:
            if not bool(comorbidities.get(rule.condition_key)):
                continue
            matches = self._find_term_matches(record.side_effects, rule.terms)
            if not matches:
                continue
            warnings.append(
                {
                    "type": rule.warning_type,
                    "severity": "warning",
                    "patient_condition": rule.display_name,
                    "drug": normalized_drug,
                    "reason": rule.reason,
                    "matched_terms": sorted({match["term"] for match in matches}),
                    "evidence": matches[:5],
                    "recommendation": rule.recommendation,
                }
            )
        return warnings

    def _find_term_matches(self, text: str, terms: tuple[str, ...]) -> list[dict[str, str]]:
        collapsed = " ".join(text.split())
        lowered = collapsed.casefold()
        matches: list[dict[str, str]] = []
        for term in terms:
            start = lowered.find(term.casefold())
            if start == -1:
                continue
            snippet_start = max(0, start - 160)
            snippet_end = min(len(collapsed), start + len(term) + 220)
            snippet = collapsed[snippet_start:snippet_end].strip()
            snippet = re.sub(r"\s+", " ", snippet)
            matches.append({"term": term, "snippet": snippet})
        return matches
