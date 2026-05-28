"""Optional RxNorm-backed drug name normalization."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from functools import lru_cache
from typing import Optional
from urllib.parse import urlencode
from urllib.request import urlopen

from repositories.interaction_repository import canonicalize_drug_name


@dataclass(frozen=True)
class RxNormMatch:
    """Normalized RxNorm concept details used for local reconciliation."""

    rxcui: str
    name: str
    generic_rxcui: Optional[str]
    generic_name: Optional[str]


class RxNormNormalizationService:
    """Thin RxNorm client for canonical drug-name lookup."""

    def __init__(
        self,
        enabled: Optional[bool] = None,
        base_url: Optional[str] = None,
        timeout_seconds: Optional[float] = None,
    ) -> None:
        self.enabled = enabled if enabled is not None else os.getenv("RXNORM_ENABLED", "0") == "1"
        self.base_url = (base_url or os.getenv("RXNORM_API_BASE", "https://rxnav.nlm.nih.gov/REST")).rstrip("/")
        self.timeout_seconds = timeout_seconds or float(os.getenv("RXNORM_TIMEOUT_SECONDS", "5"))

    @lru_cache(maxsize=256)
    def normalize_name(self, raw_name: str) -> Optional[RxNormMatch]:
        """Normalize a raw drug name through RxNorm, if enabled."""
        if not self.enabled:
            return None

        raw_name = raw_name.strip()
        if not raw_name:
            return None

        rxcui = self._find_rxcui(raw_name, search_mode="2") or self._find_rxcui(raw_name, search_mode="9")
        if not rxcui:
            return None

        generic_rxcui, generic_name = self._get_generic_product(rxcui)
        resolved_rxcui = generic_rxcui or rxcui
        resolved_name = generic_name or self._get_rxnorm_name(rxcui)
        if not resolved_name:
            return None

        return RxNormMatch(
            rxcui=rxcui,
            name=resolved_name,
            generic_rxcui=generic_rxcui,
            generic_name=generic_name,
        )

    def _find_rxcui(self, drug_name: str, search_mode: str) -> Optional[str]:
        payload = self._get_json("/rxcui.json", {"name": drug_name, "search": search_mode, "allsrc": "0"})
        return ((payload.get("idGroup") or {}).get("rxnormId") or [None])[0]

    def _get_generic_product(self, rxcui: str) -> tuple[Optional[str], Optional[str]]:
        payload = self._get_json(f"/rxcui/{rxcui}/generic.json")
        concepts = ((payload.get("minConceptGroup") or {}).get("minConcept") or [])
        first = concepts[0] if concepts else None
        if not first:
            return None, None
        return first.get("rxcui"), first.get("name")

    def _get_rxnorm_name(self, rxcui: str) -> Optional[str]:
        payload = self._get_json(f"/rxcui/{rxcui}.json")
        return ((payload.get("idGroup") or {}).get("name")) or None

    def _get_json(self, path: str, query: Optional[dict[str, str]] = None) -> dict:
        url = f"{self.base_url}{path}"
        if query:
            url = f"{url}?{urlencode(query)}"
        with urlopen(url, timeout=self.timeout_seconds) as response:
            return json.loads(response.read().decode("utf-8"))


def reduce_rxnorm_name(value: str) -> str:
    """Condense RxNorm product labels into a lookup-friendly token string."""
    canonical = canonicalize_drug_name(value)
    stopwords = {
        "mg",
        "ml",
        "tablet",
        "tablets",
        "capsule",
        "capsules",
        "oral",
        "solution",
        "injectable",
        "injection",
        "topical",
        "cream",
        "gel",
        "suspension",
        "extended",
        "release",
        "delayed",
        "kit",
        "pack",
    }
    tokens = [token for token in canonical.split() if not token.isdigit() and token not in stopwords]
    return " ".join(tokens)
