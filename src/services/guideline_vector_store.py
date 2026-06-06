"""Local guideline vector search for RAG context retrieval."""

from __future__ import annotations

import json
from pathlib import Path
import re
from typing import Any

import joblib
import numpy as np
from sklearn.preprocessing import normalize


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_VECTOR_STORE_DIR = PROJECT_ROOT / "data" / "guidelines" / "vector_store"
STOPWORDS = {
    "about",
    "and",
    "are",
    "clinical",
    "context",
    "does",
    "for",
    "from",
    "guideline",
    "recommend",
    "recommendations",
    "retrieve",
    "say",
    "the",
    "what",
    "when",
    "with",
}


class GuidelineVectorStore:
    """Load a local vector store and retrieve the most relevant guideline chunks."""

    def __init__(self, store_dir: Path | None = None) -> None:
        self.store_dir = store_dir or DEFAULT_VECTOR_STORE_DIR
        self.config_path = self.store_dir / "config.json"
        self.config: dict[str, Any] = {}
        self.metadata: list[dict[str, Any]] = []
        self.embeddings: np.ndarray | None = None
        self.vectorizer: Any = None
        self.model: Any = None
        self._loaded = False

    def is_available(self) -> bool:
        return self.config_path.exists()

    def search(self, query: str, top_k: int = 5) -> list[dict[str, Any]]:
        if not query.strip() or top_k <= 0:
            return []
        self._load()
        if self.embeddings is None:
            return []

        query_embedding = self._embed_query(query)
        if query_embedding is None:
            return []

        scores = self.embeddings @ query_embedding
        candidate_count = min(len(scores), max(top_k * 20, top_k))
        candidate_indices = np.argsort(scores)[::-1][:candidate_count]
        top_indices = self._rerank_indices(query, scores, candidate_indices)[:top_k]
        results: list[dict[str, Any]] = []
        for index in top_indices:
            score = float(scores[index])
            if score <= 0:
                continue
            record = dict(self.metadata[int(index)])
            record["score"] = round(score, 6)
            results.append(record)
        return results

    def _rerank_indices(self, query: str, scores: np.ndarray, candidate_indices: np.ndarray) -> list[int]:
        query_terms = self._content_terms(query)
        query_phrases = self._query_phrases(query)
        query_guidelines = self._guideline_mentions(query)

        ranked: list[tuple[float, int]] = []
        for raw_index in candidate_indices:
            index = int(raw_index)
            record = self.metadata[index]
            text = str(record.get("text", ""))
            metadata = record.get("metadata", {})
            if not isinstance(metadata, dict):
                metadata = {}
            text_lower = text.casefold()
            record_terms = self._content_terms(text)

            phrase_hits = sum(1 for phrase in query_phrases if phrase in text_lower)
            term_overlap = len(query_terms & record_terms) / len(query_terms) if query_terms else 0.0
            guideline = self._normalize_guideline_name(str(metadata.get("guideline") or metadata.get("source") or ""))
            guideline_match = 1.0 if guideline and guideline in query_guidelines else 0.0
            guideline_penalty = -0.18 if query_guidelines and guideline and guideline not in query_guidelines else 0.0
            rerank_score = (
                float(scores[index])
                + (0.08 * phrase_hits)
                + (0.12 * term_overlap)
                + (0.16 * guideline_match)
                + guideline_penalty
            )
            ranked.append((rerank_score, index))
        ranked.sort(key=lambda item: item[0], reverse=True)
        return [index for _, index in ranked]

    def _content_terms(self, text: str) -> set[str]:
        return {
            token
            for token in re.findall(r"[a-z0-9]+", text.casefold())
            if len(token) > 2 and token not in STOPWORDS
        }

    def _query_phrases(self, query: str) -> list[str]:
        phrases = [part.strip().casefold() for part in re.split(r"[,;:?]", query) if part.strip()]
        return [phrase for phrase in phrases if len(self._content_terms(phrase)) >= 2]

    def _guideline_mentions(self, query: str) -> set[str]:
        return {
            self._normalize_guideline_name(token)
            for token in re.findall(r"\b(?:NEWS2|NICE[_\s-]?[A-Z0-9]+)\b", query, flags=re.IGNORECASE)
        }

    def _normalize_guideline_name(self, name: str) -> str:
        return re.sub(r"[\s_-]+", "", name.casefold())

    def _load(self) -> None:
        if self._loaded:
            return
        if not self.config_path.exists():
            raise FileNotFoundError(
                f"Guideline vector store not found at {self.store_dir}. "
                "Run scripts/build_guideline_vector_store.py first."
            )

        self.config = json.loads(self.config_path.read_text(encoding="utf-8"))
        self.embeddings = np.load(self.store_dir / str(self.config["embeddings_path"]))
        self.metadata = self._load_metadata(self.store_dir / str(self.config["metadata_path"]))

        backend = str(self.config.get("backend", ""))
        if backend == "tfidf":
            self.vectorizer = joblib.load(self.store_dir / str(self.config["vectorizer_path"]))
        elif backend == "sentence-transformers":
            try:
                from sentence_transformers import SentenceTransformer  # type: ignore[import-not-found]
            except ImportError as exc:
                raise RuntimeError("sentence-transformers is required to query this vector store.") from exc
            self.model = SentenceTransformer(str(self.config["model_name"]))
        else:
            raise ValueError(f"Unsupported guideline vector store backend: {backend}")

        self._loaded = True

    def _load_metadata(self, metadata_path: Path) -> list[dict[str, Any]]:
        records: list[dict[str, Any]] = []
        with metadata_path.open(encoding="utf-8") as handle:
            for line in handle:
                if line.strip():
                    records.append(json.loads(line))
        return records

    def _embed_query(self, query: str) -> np.ndarray | None:
        backend = str(self.config.get("backend", ""))
        if backend == "tfidf":
            vector = self.vectorizer.transform([query]).astype(np.float32).toarray()
            vector = normalize(vector, norm="l2", axis=1)
            return vector[0]
        if backend == "sentence-transformers":
            vector = self.model.encode(
                [query],
                convert_to_numpy=True,
                normalize_embeddings=True,
                show_progress_bar=False,
            ).astype(np.float32)
            return vector[0]
        return None
