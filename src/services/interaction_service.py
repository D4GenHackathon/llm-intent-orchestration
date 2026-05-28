"""Drug interaction business workflow."""

from __future__ import annotations

import re
from typing import Iterable, List, Optional

from repositories.interaction_repository import InteractionRecord, InteractionRepository
from schemas.interaction import (
    DrugInteractionRequest,
    DrugInteractionResponse,
    PairwiseInteraction,
)
from schemas.response import WorkflowResponse
from services.drug_normalization_service import DrugNormalizationService


class InteractionService:
    """Orchestrate extraction, normalization, validation, and lookup."""

    def __init__(
        self,
        repository: InteractionRepository | None = None,
        normalization_service: DrugNormalizationService | None = None,
    ) -> None:
        self.repository = repository or InteractionRepository()
        self.normalization_service = normalization_service or DrugNormalizationService()

    def check_interactions(self, request: DrugInteractionRequest) -> WorkflowResponse:
        """Run the MVP drug interaction workflow."""
        submitted_terms = self._submitted_terms(request.drugs, request.query)
        normalized_drugs = self._resolve_drugs(request.drugs, request.query)
        unrecognized_terms = self._unrecognized_terms(submitted_terms, normalized_drugs)
        if len(normalized_drugs) < 2:
            message = self._minimum_drug_message(normalized_drugs, unrecognized_terms)
            return WorkflowResponse(
                success=False,
                message=message,
                data={
                    "result": {
                        "normalized_drugs": normalized_drugs,
                        "unrecognized_terms": unrecognized_terms,
                        "interacting_pairs": [],
                        "interaction_found": False,
                        "explanation": message,
                    }
                },
                warnings=["No interaction lookup was performed."],
            )

        records = self.repository.find_interactions_for_drugs(normalized_drugs)
        checked_pairs = self._build_pair_results(normalized_drugs, records)
        interacting_pairs = [item for item in checked_pairs if item.interaction_found]
        found = bool(interacting_pairs)
        explanation = self._build_explanation(normalized_drugs, checked_pairs, interacting_pairs)
        payload = DrugInteractionResponse(
            normalized_drugs=normalized_drugs,
            interacting_pairs=interacting_pairs,
            interaction_found=found,
            explanation=explanation,
            unrecognized_terms=unrecognized_terms,
        )
        return WorkflowResponse(success=True, message="Drug interaction workflow completed.", data={"result": payload})

    def _resolve_drugs(self, explicit_drugs: Iterable[str], query: str) -> List[str]:
        known_names = self.repository.get_known_drug_names()
        if explicit_drugs:
            return self._resolve_submitted_terms(list(explicit_drugs), known_names)
        return self.normalization_service.extract_drug_names(query, known_names)

    def _resolve_submitted_terms(self, terms: Iterable[str], known_names: List[str]) -> List[str]:
        known_normalized = {self.normalization_service.normalize_drug_name(name) for name in known_names}
        resolved_drugs: List[str] = []
        seen = set()
        for term in terms:
            normalized = self.normalization_service.normalize_drug_name(str(term), known_names=known_names)
            if normalized in known_normalized and normalized not in seen:
                seen.add(normalized)
                resolved_drugs.append(normalized)
        return resolved_drugs

    def _submitted_terms(self, explicit_drugs: Iterable[str], query: str) -> List[str]:
        if explicit_drugs:
            raw_terms = list(explicit_drugs)
        else:
            cleaned_query = re.sub(
                r"\b(check|interaction|interactions|interact|interacts|with|does|do|between|and|please)\b",
                ",",
                query,
                flags=re.IGNORECASE,
            )
            raw_terms = re.split(r",|\n|;|\+|/", cleaned_query)
        terms: List[str] = []
        seen = set()
        for term in raw_terms:
            normalized = " ".join(str(term).strip(" ?.!\t\r").split())
            if not normalized:
                continue
            key = normalized.casefold()
            if key not in seen:
                seen.add(key)
                terms.append(normalized)
        return terms

    def _unrecognized_terms(self, submitted_terms: List[str], normalized_drugs: List[str]) -> List[str]:
        if not submitted_terms:
            return []
        unrecognized: List[str] = []
        known_names = self.repository.get_known_drug_names()
        known_normalized = {self.normalization_service.normalize_drug_name(name) for name in known_names}
        for term in submitted_terms:
            normalized = self.normalization_service.normalize_drug_name(term, known_names=known_names)
            if not normalized or normalized not in known_normalized or normalized not in normalized_drugs:
                unrecognized.append(term)
        return unrecognized

    def _minimum_drug_message(self, normalized_drugs: List[str], unrecognized_terms: List[str]) -> str:
        if not normalized_drugs:
            if unrecognized_terms:
                return (
                    "No recognizable medications were found. Please check spelling or try generic drug names. "
                    f"Unrecognized: {', '.join(unrecognized_terms)}."
                )
            return "No recognizable medications were found. Please enter at least two medication names."

        message = (
            f"Only one medication was recognized: {normalized_drugs[0]}. "
            "Interaction checking requires at least two recognized medications."
        )
        if unrecognized_terms:
            message += f" Unrecognized: {', '.join(unrecognized_terms)}."
        return message

    def _build_pair_results(
        self,
        normalized_drugs: List[str],
        records: List[InteractionRecord],
    ) -> List[PairwiseInteraction]:
        record_map = {
            tuple(sorted((record.drug_1.casefold(), record.drug_2.casefold()))): record for record in records
        }
        results: List[PairwiseInteraction] = []
        for left_index in range(len(normalized_drugs)):
            for right_index in range(left_index + 1, len(normalized_drugs)):
                drug_1 = normalized_drugs[left_index]
                drug_2 = normalized_drugs[right_index]
                key = tuple(sorted((drug_1.casefold(), drug_2.casefold())))
                record = record_map.get(key)
                if record:
                    results.append(self._build_found_result(drug_1, drug_2, record))
                else:
                    results.append(
                        PairwiseInteraction(
                            drug_1=drug_1,
                            drug_2=drug_2,
                            interaction_found=False,
                            severity=None,
                            mechanism=None,
                            recommendation="No interaction was found in the current structured dataset for this pair.",
                            description=None,
                            source="data/db_drug_interactions.csv",
                        )
                    )
        return results

    def _build_found_result(
        self,
        drug_1: str,
        drug_2: str,
        record: InteractionRecord,
    ) -> PairwiseInteraction:
        mechanism = self._extract_mechanism(record.description)
        return PairwiseInteraction(
            drug_1=drug_1,
            drug_2=drug_2,
            interaction_found=True,
            severity=None,
            mechanism=mechanism,
            recommendation=(
                "A structured interaction entry was found. Review concurrent use with a clinician or pharmacist "
                "before making medication changes."
            ),
            description=record.description,
            source=record.source,
        )

    def _extract_mechanism(self, description: str) -> Optional[str]:
        lowered = description.strip().rstrip(".")
        if " may " in lowered:
            return lowered.split(" may ", 1)[1]
        return lowered or None

    def _build_explanation(
        self,
        normalized_drugs: List[str],
        checked_pairs: List[PairwiseInteraction],
        interacting_pairs: List[PairwiseInteraction],
    ) -> str:
        if not interacting_pairs:
            return (
                "No interaction was found for the submitted medication list in the current structured dataset."
            )

        return (
            f"{len(interacting_pairs)} potential interaction"
            f"{'s were' if len(interacting_pairs) != 1 else ' was'} found."
        )
