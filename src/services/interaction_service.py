"""Drug interaction business workflow."""

from __future__ import annotations

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
        normalized_drugs = self._resolve_drugs(request.drugs, request.query)
        if len(normalized_drugs) < 2:
            return WorkflowResponse(
                success=False,
                message="At least two recognizable drugs are required for interaction checking.",
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
        )
        return WorkflowResponse(success=True, message="Drug interaction workflow completed.", data={"result": payload})

    def _resolve_drugs(self, explicit_drugs: Iterable[str], query: str) -> List[str]:
        known_names = self.repository.get_known_drug_names()
        if explicit_drugs:
            return self.normalization_service.normalize_many(explicit_drugs, known_names=known_names)
        return self.normalization_service.extract_drug_names(query, known_names)

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
                f"Checked {len(checked_pairs)} pairwise combinations across {len(normalized_drugs)} normalized drugs. "
                "No structured interaction record was found in the current database extract."
            )

        return (
            f"Found {len(interacting_pairs)} interacting pair(s) across {len(normalized_drugs)} normalized drugs. "
            "Only pairs with structured matches are returned below, along with the database-backed explanation for each pair."
        )
