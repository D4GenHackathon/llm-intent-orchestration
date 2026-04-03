"""Drug name extraction and normalization helpers."""

from __future__ import annotations

from difflib import SequenceMatcher
import re
from typing import Iterable, List, Sequence

from repositories.interaction_repository import canonicalize_drug_name
from services.rxnorm_normalization_service import RxNormNormalizationService, reduce_rxnorm_name


class DrugNormalizationService:
    """Normalize drug names using deterministic matching against known labels."""

    NON_DRUG_QUERY_PHRASES = {
        "side effect",
        "side effects",
        "adverse effect",
        "adverse effects",
        "reaction",
        "reactions",
        "warning sign",
        "warning signs",
        "drug interaction",
        "drug interactions",
        "interaction",
        "interactions",
    }

    def __init__(self, rxnorm_service: RxNormNormalizationService | None = None) -> None:
        self.rxnorm_service = rxnorm_service or RxNormNormalizationService()

    def normalize_drug_name(self, raw_name: str, known_names: Sequence[str] | None = None) -> str:
        """Convert raw input into a canonical lookup token, optionally using RxNorm."""
        local_name = canonicalize_drug_name(raw_name)
        if not local_name:
            return ""

        if known_names:
            resolved_local = self._resolve_to_known_name(local_name, known_names)
            if resolved_local:
                return resolved_local

        rxnorm_match = self.rxnorm_service.normalize_name(raw_name)
        if rxnorm_match and known_names:
            preferred_names = [rxnorm_match.generic_name or "", rxnorm_match.name]
            for preferred_name in preferred_names:
                resolved_name = self._resolve_to_known_name(reduce_rxnorm_name(preferred_name), known_names)
                if resolved_name:
                    return resolved_name

        return local_name

    def normalize_many(self, names: Iterable[str], known_names: Sequence[str] | None = None) -> List[str]:
        """Normalize and deduplicate an iterable of drug names."""
        normalized: List[str] = []
        seen = set()
        for name in names:
            normalized_name = self.normalize_drug_name(name, known_names=known_names)
            if normalized_name and normalized_name not in seen:
                seen.add(normalized_name)
                normalized.append(normalized_name)
        return normalized

    def extract_drug_names(self, query: str, known_names: Iterable[str]) -> List[str]:
        """Extract likely drug names from a free-text query by dictionary matching."""
        query_normalized = self.normalize_drug_name(query)
        if not query_normalized:
            return []

        matches = []
        for candidate in known_names:
            candidate_normalized = self.normalize_drug_name(candidate)
            if not candidate_normalized:
                continue
            if candidate_normalized in self.NON_DRUG_QUERY_PHRASES:
                continue
            pattern = rf"(^|\s){re.escape(candidate_normalized)}(\s|$)"
            if re.search(pattern, query_normalized):
                matches.append(candidate_normalized)

        matches.sort(key=len, reverse=True)
        unique_matches: List[str] = []
        for match in matches:
            if not any(match in existing for existing in unique_matches):
                unique_matches.append(match)
        return unique_matches

    def _resolve_to_known_name(self, candidate: str, known_names: Sequence[str]) -> str:
        normalized_map = {
            canonicalize_drug_name(name): canonicalize_drug_name(name) for name in known_names if canonicalize_drug_name(name)
        }
        if candidate in normalized_map:
            return normalized_map[candidate]

        candidate_tokens = set(candidate.split())
        best_match = ""
        best_score = 0
        for normalized_name in normalized_map:
            known_tokens = set(normalized_name.split())
            if not known_tokens:
                continue
            if known_tokens.issubset(candidate_tokens):
                score = len(known_tokens)
            else:
                score = len(candidate_tokens.intersection(known_tokens))
            if score > best_score:
                best_match = normalized_name
                best_score = score

        if best_score > 0:
            return best_match

        fuzzy_match = self._resolve_fuzzy_match(candidate, tuple(normalized_map))
        return fuzzy_match

    def _resolve_fuzzy_match(self, candidate: str, normalized_names: Sequence[str]) -> str:
        best_match = ""
        best_ratio = 0.0
        for normalized_name in normalized_names:
            ratio = SequenceMatcher(a=candidate, b=normalized_name).ratio()
            if ratio > best_ratio:
                best_match = normalized_name
                best_ratio = ratio

        return best_match if best_ratio >= 0.84 else ""
