"""Generate project-specific guideline RAG evaluation cases.

This avoids using an external dataset such as MACCROBAT. Instead, it creates a
synthetic benchmark from the same NEWS2/NICE guideline chunks used by the
project vector store, then records the source chunk ID as reference context.
"""

from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import json
from pathlib import Path
import re
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CHUNKS_PATH = PROJECT_ROOT / "data" / "guidelines" / "guideline_chunks.jsonl"
DEFAULT_OUTPUT_PATH = PROJECT_ROOT / "data" / "guidelines" / "rag_eval_cases.jsonl"


STOPWORDS = {
    "about",
    "above",
    "acute",
    "after",
    "also",
    "and",
    "are",
    "because",
    "been",
    "being",
    "care",
    "clinical",
    "committee",
    "could",
    "does",
    "for",
    "from",
    "guidance",
    "guideline",
    "hospital",
    "into",
    "made",
    "management",
    "more",
    "must",
    "nice",
    "page",
    "patient",
    "patients",
    "people",
    "person",
    "recommendation",
    "recommendations",
    "should",
    "that",
    "the",
    "their",
    "there",
    "this",
    "use",
    "used",
    "using",
    "was",
    "were",
    "what",
    "when",
    "with",
}


MEDICAL_PHRASES = [
    "NEWS2 score",
    "score of 5 or more",
    "single parameter",
    "oxygen saturation",
    "respiration rate",
    "respiratory rate",
    "systolic blood pressure",
    "heart rate",
    "temperature",
    "consciousness",
    "new confusion",
    "delirium",
    "hypercapnic respiratory failure",
    "COPD",
    "sepsis",
    "suspected sepsis",
    "clinical deterioration",
    "escalation",
    "urgent escalation",
    "monitoring frequency",
    "physiological observations",
    "falls assessment",
    "fall risk",
    "older adult",
    "risk assessment",
    "medicines review",
    "observation",
    "vital signs",
    "acute illness",
    "critical care",
]


QUERY_TEMPLATES = {
    "sepsis": "In suspected sepsis or acute deterioration, what does {guideline} say about {terms}?",
    "fall": "For a patient with possible fall risk, what does {guideline} say about {terms}?",
    "oxygen": "What does {guideline} recommend for oxygen-related assessment involving {terms}?",
    "observations": "Which physiological observations or monitoring steps does {guideline} recommend for {terms}?",
    "default": "What clinical guideline context does {guideline} provide for {terms}?",
}


def repair_mojibake(text: str) -> str:
    replacements = {
        "\u00e2\u2021\u2019": "=>",
        "\u00c2\u00a9": "(c)",
        "\u00c2": "",
        "\u00e2\u20ac\u201c": "-",
        "\u00e2\u20ac\u201d": "-",
        "\u00e2\u20ac\u2122": "'",
        "\u00e2\u20ac\u02dc": "'",
        "\u00e2\u20ac\u0153": '"',
        "\u00e2\u20ac\u009d": '"',
        "\u00e2\u20ac\u00a6": "...",
        "\u00e2\u20ac\u00a2": "-",
    }
    for bad, good in replacements.items():
        text = text.replace(bad, good)
    return text


def load_chunks(path: Path) -> list[dict[str, Any]]:
    chunks = []
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            if line.strip():
                chunks.append(json.loads(line))
    return chunks


def normalize(text: str) -> str:
    text = repair_mojibake(text)
    return re.sub(r"\s+", " ", text).strip()


def split_sentences(text: str) -> list[str]:
    cleaned = normalize(text)
    return [item.strip() for item in re.split(r"(?<=[.!?])\s+", cleaned) if item.strip()]


def tokens(text: str) -> list[str]:
    return [
        token
        for token in re.findall(r"[A-Za-z][A-Za-z0-9-]{2,}", text.lower())
        if token not in STOPWORDS and not token.isnumeric()
    ]


def phrase_hits(text: str) -> list[str]:
    lower_text = text.lower()
    hits = []
    for phrase in MEDICAL_PHRASES:
        if phrase.lower() in lower_text:
            hits.append(phrase)
    return hits


def keyword_score(text: str) -> int:
    hits = phrase_hits(text)
    token_counts = Counter(tokens(text))
    return len(hits) * 3 + sum(token_counts[word] for word in ("sepsis", "falls", "fall", "news2", "deterioration"))


def dedupe_terms(terms: list[str]) -> list[str]:
    seen = set()
    unique = []
    for term in terms:
        normalized = term.casefold()
        if normalized in seen:
            continue
        seen.add(normalized)
        unique.append(term)
    return unique


def document_frequencies(chunks: list[dict[str, Any]]) -> Counter[str]:
    frequencies: Counter[str] = Counter()
    for chunk in chunks:
        frequencies.update(set(tokens(str(chunk.get("text") or ""))))
    return frequencies


def expected_terms(text: str, doc_freq: Counter[str] | None = None, total_docs: int = 1, limit: int = 5) -> list[str]:
    terms = phrase_hits(text)
    counts = Counter(tokens(text))
    if doc_freq:
        ranked_tokens = sorted(
            counts,
            key=lambda token: (
                doc_freq[token] / max(total_docs, 1),
                -counts[token],
                token,
            ),
        )
    else:
        ranked_tokens = [token for token, _ in counts.most_common(12)]

    for token in ranked_tokens:
        if token not in {term.lower() for term in terms}:
            terms.append(token)
        if len(terms) >= limit:
            break
    return dedupe_terms(terms)[:limit]


def reference_answer(text: str, terms: list[str], max_chars: int = 700) -> str:
    lower_terms = [term.lower() for term in terms]
    selected = []
    for sentence in split_sentences(text):
        if any(term in sentence.lower() for term in lower_terms):
            selected.append(sentence)
        if len(" ".join(selected)) >= max_chars * 0.7:
            break
    if not selected:
        selected = split_sentences(text)[:2]
    answer = normalize(" ".join(selected))
    return answer[:max_chars].rstrip()


def query_family(text: str) -> str:
    lower_text = text.lower()
    if "sepsis" in lower_text:
        return "sepsis"
    if "fall" in lower_text:
        return "fall"
    if "oxygen" in lower_text or "spo" in lower_text or "copd" in lower_text:
        return "oxygen"
    if "observations" in lower_text or "monitoring" in lower_text:
        return "observations"
    return "default"


def make_case(chunk: dict[str, Any], doc_freq: Counter[str], total_docs: int) -> dict[str, Any]:
    text = str(chunk.get("text") or "")
    metadata = chunk.get("metadata") if isinstance(chunk.get("metadata"), dict) else {}
    guideline = str(metadata.get("guideline") or chunk.get("id", "guideline").split("_")[0])
    terms = expected_terms(text, doc_freq=doc_freq, total_docs=total_docs)
    template = QUERY_TEMPLATES[query_family(text)]
    query_terms = [term for term in terms if len(term.split()) > 1][:2]
    query_terms.extend([term for term in terms if len(term.split()) == 1][:2])
    query_terms = dedupe_terms(query_terms)[:4]
    return {
        "query": template.format(guideline=guideline, terms=", ".join(query_terms)),
        "expected_terms": terms,
        "expected_citation_contains": [guideline],
        "expected_context_ids": [str(chunk.get("id"))],
        "reference_answer": reference_answer(text, terms),
        "top_k": 5,
        "metadata": {
            "generated_from": str(chunk.get("id")),
            "guideline": guideline,
            "page_start": metadata.get("page_start"),
            "page_end": metadata.get("page_end"),
            "topic": normalize(str(metadata.get("topic") or "")) or None,
        },
    }


def generate_cases(chunks: list[dict[str, Any]], max_cases: int, per_guideline: int) -> list[dict[str, Any]]:
    doc_freq = document_frequencies(chunks)
    total_docs = len(chunks)
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for chunk in chunks:
        text = str(chunk.get("text") or "")
        metadata = chunk.get("metadata") if isinstance(chunk.get("metadata"), dict) else {}
        guideline = str(metadata.get("guideline") or chunk.get("id", "guideline").split("_")[0])
        if len(tokens(text)) < 80:
            continue
        if keyword_score(text) <= 2:
            continue
        grouped[guideline].append(chunk)

    cases = []
    for guideline in sorted(grouped):
        ranked = sorted(grouped[guideline], key=lambda item: keyword_score(str(item.get("text") or "")), reverse=True)
        for chunk in ranked[:per_guideline]:
            cases.append(make_case(chunk, doc_freq=doc_freq, total_docs=total_docs))

    seen_queries: Counter[str] = Counter()
    for case in cases:
        query = str(case["query"])
        seen_queries[query] += 1
        if seen_queries[query] <= 1:
            continue
        topic = case["metadata"].get("topic")
        source = case["metadata"].get("generated_from")
        hint = topic or source
        case["query"] = f"{query} Focus on {hint}."

    cases = sorted(
        cases,
        key=lambda item: (
            str(item["metadata"]["guideline"]),
            str(item["metadata"]["generated_from"]),
        ),
    )
    return cases[:max_cases]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate guideline-specific RAG evaluation cases.")
    parser.add_argument("--chunks", type=Path, default=DEFAULT_CHUNKS_PATH)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_PATH)
    parser.add_argument("--max-cases", type=int, default=40)
    parser.add_argument("--per-guideline", type=int, default=12)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    chunks = load_chunks(args.chunks)
    cases = generate_cases(chunks, max_cases=args.max_cases, per_guideline=args.per_guideline)
    if not cases:
        raise ValueError(f"No evaluation cases could be generated from {args.chunks}")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as handle:
        for case in cases:
            handle.write(json.dumps(case, ensure_ascii=False) + "\n")

    guideline_counts = Counter(case["metadata"]["guideline"] for case in cases)
    print(
        json.dumps(
            {
                "success": True,
                "output": str(args.output),
                "case_count": len(cases),
                "guideline_counts": dict(sorted(guideline_counts.items())),
            },
            indent=2,
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
