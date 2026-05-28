"""Drug side-effect business workflow."""

from __future__ import annotations

import re
from typing import List

from repositories.side_effect import SideEffectRecord, SideEffectRepository
from schemas.response import WorkflowResponse
from schemas.side_effect import (
    SideEffectGroup,
    SideEffectLookupRequest,
    SideEffectLookupResponse,
)
from services.drug_normalization_service import DrugNormalizationService


class SideEffectService:
    """Orchestrate deterministic side-effect lookup and grouping."""

    def __init__(
        self,
        repository: SideEffectRepository | None = None,
        normalization_service: DrugNormalizationService | None = None,
    ) -> None:
        self.repository = repository or SideEffectRepository()
        self.normalization_service = normalization_service or DrugNormalizationService()

    def lookup_side_effects(self, request: SideEffectLookupRequest) -> WorkflowResponse:
        """Run the MVP side-effect workflow."""
        normalized_name = self._resolve_name(request)
        if not normalized_name:
            return WorkflowResponse(
                success=False,
                message="No recognizable drug name was found for side-effect lookup.",
            )

        record = self.repository.find_by_name(normalized_name)
        if not record:
            return WorkflowResponse(
                success=False,
                message="No side-effect entry was found in the current structured dataset.",
                data={"normalized_drug": normalized_name},
            )

        groups = self._group_side_effects(record, normalized_name)
        explanation = self._build_explanation(record)
        payload = SideEffectLookupResponse(
            normalized_drug=normalized_name,
            generic_name=record.generic_name or record.drug_name,
            groups=groups,
            source=record.source,
            explanation=explanation,
        )
        return WorkflowResponse(success=True, message="Side-effect workflow completed.", data={"result": payload})

    def _resolve_name(self, request: SideEffectLookupRequest) -> str:
        known_names = self.repository.get_known_drug_names()
        if request.drug_name:
            return self.normalization_service.normalize_drug_name(request.drug_name, known_names=known_names)
        matches = self.normalization_service.extract_drug_names(
            request.query,
            known_names,
        )
        return matches[0] if matches else ""

    def _group_side_effects(self, record: SideEffectRecord, display_name: str) -> SideEffectGroup:
        text = self._sanitize_source_text(" ".join(record.side_effects.split()), record, display_name)
        serious_text, common_text = self._split_sections(text)
        serious = self._extract_items(serious_text)
        common = self._extract_items(common_text)
        rare = [item for item in serious if "rare" in item.casefold()]
        seek_care = [
            item
            for item in serious
            if any(keyword in item.casefold() for keyword in ["call your doctor", "seek medical treatment", "signs of"])
        ]
        return SideEffectGroup(common=common[:8], serious=serious[:10], rare=rare[:5], when_to_seek_care=seek_care[:5])

    def _split_sections(self, text: str) -> tuple[str, str]:
        common_marker = "Common side effects may include:"
        serious_marker = "Call your doctor at once if you have:"
        serious_text = text
        common_text = ""
        if common_marker in text:
            serious_text, common_text = text.split(common_marker, 1)
        elif "common " in text.casefold():
            parts = re.split(r"common .*?:", text, maxsplit=1, flags=re.IGNORECASE)
            serious_text = parts[0]
            common_text = parts[1] if len(parts) > 1 else ""

        if serious_marker in serious_text:
            serious_text = serious_text.split(serious_marker, 1)[1]

        return serious_text.strip(), common_text.strip()

    def _extract_items(self, text: str) -> List[str]:
        segments = re.split(r";|\.(?=\s+[A-Z])", text)
        items = []
        for segment in segments:
            cleaned = segment.strip(" .")
            if cleaned:
                items.append(cleaned)
        return items

    def _sanitize_source_text(self, text: str, record: SideEffectRecord, display_name: str) -> str:
        cleaned_text = text
        replacement = display_name.title() if display_name else record.drug_name

        candidate_names = [brand.strip() for brand in record.brand_names.split(",") if brand.strip()]
        for candidate_name in sorted(candidate_names, key=len, reverse=True):
            cleaned_text = re.sub(
                rf"\b{re.escape(candidate_name)}\b",
                replacement,
                cleaned_text,
                flags=re.IGNORECASE,
            )

        return cleaned_text

    def _build_explanation(self, record: SideEffectRecord) -> str:
        return (
            f"Structured side-effect information was retrieved for {record.drug_name}. "
            "Common items were separated from higher-urgency warning statements using the source text layout. "
            "This summary is derived from the dataset entry and should not replace product labeling or clinical review."
        )
