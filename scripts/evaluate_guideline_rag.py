"""Evaluate guideline RAG with a small local benchmark.

The evaluation mirrors the shape of Ragas/NVIDIA medical RAG evaluation while
remaining local-first:
- retrieval metrics: context precision, context recall, citation coverage
- answer metrics: answer relevancy and faithfulness when an answer is provided

Benchmark records are JSON objects with at least:
- query: str
- expected_terms: list[str] | str

Optional fields:
- expected_citation_contains: list[str] | str
- expected_context_ids: list[str] | str
- reference_answer | ground_truth: str
- answer | response: str
- payload: dict, for early-warning workflow evaluation with --workflow
- top_k: int
"""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from pathlib import Path
import sys
from typing import Any, TYPE_CHECKING


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = PROJECT_ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

if TYPE_CHECKING:
    from services.guideline_vector_store import GuidelineVectorStore


DEFAULT_BENCHMARK_PATH = PROJECT_ROOT / "data" / "guidelines" / "rag_eval_cases.jsonl"
DEFAULT_REPORT_PATH = PROJECT_ROOT / "data" / "guidelines" / "rag_eval_report.json"


@dataclass
class BenchmarkCase:
    query: str
    expected_terms: list[str]
    expected_citation_contains: list[str]
    top_k: int = 5
    expected_context_ids: list[str] | None = None
    reference_answer: str = ""
    answer: str = ""
    payload: dict[str, Any] | None = None


STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "has",
    "have",
    "if",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "should",
    "the",
    "this",
    "to",
    "what",
    "when",
    "with",
}


def _coerce_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        value = value.strip()
        return [value] if value else []
    return [str(value).strip()] if str(value).strip() else []


def _coerce_text(value: Any) -> str:
    return str(value or "").strip()


def load_benchmark_cases(path: Path) -> list[BenchmarkCase]:
    if not path.exists():
        return _default_cases()

    cases: list[BenchmarkCase] = []
    with path.open(encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            record = json.loads(line)
            query = str(record.get("query", "")).strip()
            if not query:
                raise ValueError(f"Missing query on line {line_number} of {path}")
            cases.append(
                BenchmarkCase(
                    query=query,
                    expected_terms=_coerce_list(record.get("expected_terms")),
                    expected_citation_contains=_coerce_list(record.get("expected_citation_contains")),
                    top_k=int(record.get("top_k") or 5),
                    expected_context_ids=_coerce_list(record.get("expected_context_ids")),
                    reference_answer=_coerce_text(record.get("reference_answer") or record.get("ground_truth")),
                    answer=_coerce_text(record.get("answer") or record.get("response")),
                    payload=record.get("payload") if isinstance(record.get("payload"), dict) else None,
                )
            )
    if not cases:
        return _default_cases()
    return cases


def _default_cases() -> list[BenchmarkCase]:
    return [
        BenchmarkCase(
            query="70-year-old patient with fever and fall detected, what guideline context applies?",
            expected_terms=["fall", "temperature", "fever"],
            expected_citation_contains=["guideline"],
            top_k=5,
        ),
        BenchmarkCase(
            query="Older adult with tachycardia and acute deterioration, what should be checked?",
            expected_terms=["tachycardia", "heart rate", "deterioration"],
            expected_citation_contains=["guideline"],
            top_k=5,
        ),
        BenchmarkCase(
            query="Low temperature with possible hypothermia, retrieve clinical guidance.",
            expected_terms=["hypothermia", "low temperature"],
            expected_citation_contains=["guideline"],
            top_k=5,
        ),
    ]


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text.casefold()).strip()


def token_set(text: str) -> set[str]:
    return {
        token
        for token in re.findall(r"[a-z0-9]+", text.casefold())
        if len(token) > 2 and token not in STOPWORDS
    }


def lexical_similarity(left: str, right: str) -> float:
    left_tokens = token_set(left)
    right_tokens = token_set(right)
    if not left_tokens or not right_tokens:
        return 0.0
    intersection = len(left_tokens & right_tokens)
    precision = intersection / len(left_tokens)
    recall = intersection / len(right_tokens)
    if precision + recall == 0:
        return 0.0
    return 2 * precision * recall / (precision + recall)


def split_claims(answer: str) -> list[str]:
    claims = []
    for claim in re.split(r"(?<=[.!?])\s+|;\s+|\n+", answer):
        normalized = claim.strip()
        if len(token_set(normalized)) >= 3:
            claims.append(normalized)
    return claims


def strip_citations(text: str) -> str:
    return re.sub(r"\s*\[[^\]]+\]", "", text).strip()


def split_sentences(text: str) -> list[str]:
    normalized = re.sub(r"\s+", " ", text).strip()
    return [item.strip() for item in re.split(r"(?<=[.!?])\s+", normalized) if item.strip()]


def result_text(result: dict[str, Any]) -> str:
    return str(result.get("text", ""))


def result_citation(result: dict[str, Any]) -> str:
    citation = result.get("citation")
    if citation:
        return str(citation)
    metadata = result.get("metadata", {})
    if not isinstance(metadata, dict):
        metadata = {}
    return str(metadata.get("guideline") or metadata.get("source") or result.get("id") or "")


def result_id(result: dict[str, Any]) -> str:
    return str(result.get("id") or "")


def contains_phrase(haystack: str, needle: str) -> bool:
    return normalize_text(needle) in normalize_text(haystack)


def is_relevant_result(result: dict[str, Any], case: BenchmarkCase) -> bool:
    text = result_text(result)
    citation = result_citation(result)
    expected_context_ids = case.expected_context_ids or []
    if expected_context_ids:
        return any(result_id(result) == expected_id for expected_id in expected_context_ids)
    if any(contains_phrase(text, term) for term in case.expected_terms):
        return True
    if any(contains_phrase(citation, expected) for expected in case.expected_citation_contains):
        return True
    if case.reference_answer and lexical_similarity(case.reference_answer, text) >= 0.08:
        return True
    return False


def context_precision(relevance_flags: list[bool]) -> float:
    relevant_count = 0
    precision_sum = 0.0
    for rank, is_relevant in enumerate(relevance_flags, start=1):
        if is_relevant:
            relevant_count += 1
            precision_sum += relevant_count / rank
    if relevant_count == 0:
        return 0.0
    return precision_sum / relevant_count


def generate_grounded_answer(
    query: str,
    results: list[dict[str, Any]],
    expected_terms: list[str] | None = None,
    max_sentences: int = 3,
) -> str:
    expected_terms = expected_terms or []
    query_tokens = token_set(f"{query} {' '.join(expected_terms)}")
    candidates: list[tuple[float, str, str]] = []
    for result in results:
        citation = result_citation(result)
        for sentence in split_sentences(result_text(result)):
            sentence_tokens = token_set(sentence)
            if not sentence_tokens:
                continue
            overlap = len(query_tokens & sentence_tokens) / len(query_tokens) if query_tokens else 0.0
            phrase_bonus = sum(1 for term in expected_terms if contains_phrase(sentence, term)) * 0.08
            score = overlap + phrase_bonus
            if score <= 0:
                continue
            candidates.append((score, sentence, citation))

    candidates.sort(key=lambda item: item[0], reverse=True)
    selected: list[str] = []
    seen = set()
    for _, sentence, citation in candidates:
        normalized = normalize_text(sentence)
        if normalized in seen:
            continue
        seen.add(normalized)
        selected.append(f"{sentence} [{citation}]")
        if len(selected) >= max_sentences:
            break

    if not selected and results:
        first = result_text(results[0])
        citation = result_citation(results[0])
        selected = [f"{split_sentences(first)[0]} [{citation}]" if split_sentences(first) else f"See retrieved context. [{citation}]"]

    return " ".join(selected)


def evaluate_answer(
    query: str,
    answer: str,
    retrieved_texts: list[str],
    expected_terms: list[str],
    reference_answer: str = "",
    extra_grounding_texts: list[str] | None = None,
) -> dict[str, Any]:
    if not answer.strip():
        return {
            "answer_relevancy": None,
            "faithfulness": None,
            "answer_term_coverage": None,
            "claim_count": 0,
            "supported_claims": 0,
        }

    relevancy_basis = f"{query} {reference_answer}".strip()
    answer_relevancy = lexical_similarity(answer, relevancy_basis)
    grounding_text = "\n".join([query, reference_answer, *(extra_grounding_texts or []), *retrieved_texts])
    normalized_grounding = normalize_text(grounding_text)
    claims = split_claims(answer)
    supported_claims = 0
    for claim in claims:
        clean_claim = strip_citations(claim)
        if normalize_text(clean_claim) in normalized_grounding:
            supported_claims += 1
        elif lexical_similarity(clean_claim, grounding_text) >= 0.12:
            supported_claims += 1
    faithfulness = supported_claims / len(claims) if claims else 0.0
    term_coverage = (
        sum(1 for term in expected_terms if contains_phrase(answer, term)) / len(expected_terms)
        if expected_terms
        else None
    )

    return {
        "answer_relevancy": round(answer_relevancy, 4),
        "faithfulness": round(faithfulness, 4),
        "answer_term_coverage": round(term_coverage, 4) if term_coverage is not None else None,
        "claim_count": len(claims),
        "supported_claims": supported_claims,
    }


def evaluate_retrieved_results(
    query: str,
    results: list[dict[str, Any]],
    case: BenchmarkCase,
    answer: str = "",
    extra_grounding_texts: list[str] | None = None,
) -> dict[str, Any]:
    retrieved_texts = [result_text(item).lower() for item in results]
    retrieved_citations = [result_citation(item).lower() for item in results]
    retrieved_ids = [result_id(item) for item in results]

    term_hits = 0
    for term in case.expected_terms:
        needle = term.lower()
        if any(needle in text for text in retrieved_texts):
            term_hits += 1

    citation_hits = 0
    for expected in case.expected_citation_contains:
        needle = expected.lower()
        if any(needle in citation for citation in retrieved_citations):
            citation_hits += 1

    relevance_flags = [is_relevant_result(result, case) for result in results]
    answer_metrics = evaluate_answer(
        query=query,
        answer=answer or case.answer,
        retrieved_texts=retrieved_texts,
        expected_terms=case.expected_terms,
        reference_answer=case.reference_answer,
        extra_grounding_texts=extra_grounding_texts,
    )
    expected_context_ids = case.expected_context_ids or []
    context_id_hits = sum(1 for expected_id in expected_context_ids if expected_id in retrieved_ids)
    context_recall = (
        context_id_hits / len(expected_context_ids)
        if expected_context_ids
        else term_hits / len(case.expected_terms)
        if case.expected_terms
        else 0.0
    )
    top1_hit = (
        bool(results)
        and result_id(results[0]) in expected_context_ids
        if expected_context_ids
        else bool(case.expected_terms) and term_hits > 0 and bool(results)
    )
    return {
        "query": query,
        "top_k": case.top_k,
        "retrieved_count": len(results),
        "term_hits": term_hits,
        "expected_terms": case.expected_terms,
        "citation_hits": citation_hits,
        "expected_citation_contains": case.expected_citation_contains,
        "context_id_hits": context_id_hits,
        "expected_context_ids": expected_context_ids,
        "top1_hit": top1_hit,
        "ragas_style": {
            "context_precision": round(context_precision(relevance_flags), 4),
            "context_recall": round(context_recall, 4),
            "answer_relevancy": answer_metrics["answer_relevancy"],
            "faithfulness": answer_metrics["faithfulness"],
            "answer_term_coverage": answer_metrics["answer_term_coverage"],
        },
        "answer_evaluation": {
            "answer": answer or case.answer,
            "reference_answer": case.reference_answer,
            "claim_count": answer_metrics["claim_count"],
            "supported_claims": answer_metrics["supported_claims"],
        },
        "results": results,
    }


def evaluate_case(vector_store: Any, case: BenchmarkCase) -> dict[str, Any]:
    results = vector_store.search(case.query, top_k=case.top_k)
    return evaluate_retrieved_results(case.query, results, case, answer=case.answer)


def evaluate_generated_answer_case(vector_store: Any, case: BenchmarkCase) -> dict[str, Any]:
    results = vector_store.search(case.query, top_k=case.top_k)
    answer = case.answer or generate_grounded_answer(case.query, results, expected_terms=case.expected_terms)
    return evaluate_retrieved_results(case.query, results, case, answer=answer)


def evaluate_workflow_case(service: Any, case: BenchmarkCase) -> dict[str, Any]:
    if not case.payload:
        return evaluate_case(service.vector_store, case)

    response = service.evaluate(case.payload, top_k=case.top_k).to_dict()
    result = response.get("data", {}).get("result", {}) if isinstance(response.get("data"), dict) else {}
    query = str(result.get("rag_query") or case.query)
    retrieved_context = result.get("retrieved_context") if isinstance(result, dict) else []
    if not isinstance(retrieved_context, list):
        retrieved_context = []
    answer = str(result.get("alert") or case.answer)
    record = result.get("record") if isinstance(result.get("record"), dict) else {}
    abnormalities = result.get("abnormalities") if isinstance(result.get("abnormalities"), list) else []
    workflow_grounding = [
        json.dumps(record, ensure_ascii=False, sort_keys=True),
        json.dumps(abnormalities, ensure_ascii=False, sort_keys=True),
    ]
    row = evaluate_retrieved_results(
        query,
        retrieved_context,
        case,
        answer=answer,
        extra_grounding_texts=workflow_grounding,
    )
    row["workflow"] = {
        "success": response.get("success"),
        "alert_required": result.get("alert_required"),
        "llm_used": result.get("llm_used"),
        "warnings": response.get("warnings", []),
    }
    return row


def aggregate_results(rows: list[dict[str, Any]]) -> dict[str, Any]:
    total = len(rows)
    if total == 0:
        return {
            "total_cases": 0,
            "hit_rate": 0.0,
            "citation_coverage": 0.0,
            "avg_retrieved": 0.0,
            "mean_term_coverage": 0.0,
            "mean_context_precision": 0.0,
            "mean_context_recall": 0.0,
            "mean_context_id_recall": None,
            "answer_evaluated_cases": 0,
            "mean_answer_relevancy": None,
            "mean_faithfulness": None,
            "mean_answer_term_coverage": None,
        }

    hit_rate = sum(1 for row in rows if row["top1_hit"]) / total
    citation_coverage = sum(1 for row in rows if row["citation_hits"] > 0) / total
    avg_retrieved = sum(row["retrieved_count"] for row in rows) / total
    mean_term_coverage = sum(
        (row["term_hits"] / len(row["expected_terms"]) if row["expected_terms"] else 0.0) for row in rows
    ) / total
    mean_context_precision = sum(row["ragas_style"]["context_precision"] for row in rows) / total
    mean_context_recall = sum(row["ragas_style"]["context_recall"] for row in rows) / total
    context_id_recalls = [
        row["context_id_hits"] / len(row["expected_context_ids"])
        for row in rows
        if row.get("expected_context_ids")
    ]
    answer_relevancy_scores = [
        row["ragas_style"]["answer_relevancy"]
        for row in rows
        if row["ragas_style"]["answer_relevancy"] is not None
    ]
    faithfulness_scores = [
        row["ragas_style"]["faithfulness"] for row in rows if row["ragas_style"]["faithfulness"] is not None
    ]
    answer_term_coverages = [
        row["ragas_style"].get("answer_term_coverage")
        for row in rows
        if row["ragas_style"].get("answer_term_coverage") is not None
    ]
    return {
        "total_cases": total,
        "hit_rate": round(hit_rate, 4),
        "citation_coverage": round(citation_coverage, 4),
        "avg_retrieved": round(avg_retrieved, 4),
        "mean_term_coverage": round(mean_term_coverage, 4),
        "mean_context_precision": round(mean_context_precision, 4),
        "mean_context_recall": round(mean_context_recall, 4),
        "mean_context_id_recall": round(sum(context_id_recalls) / len(context_id_recalls), 4)
        if context_id_recalls
        else None,
        "answer_evaluated_cases": len(faithfulness_scores),
        "mean_answer_relevancy": round(sum(answer_relevancy_scores) / len(answer_relevancy_scores), 4)
        if answer_relevancy_scores
        else None,
        "mean_faithfulness": round(sum(faithfulness_scores) / len(faithfulness_scores), 4)
        if faithfulness_scores
        else None,
        "mean_answer_term_coverage": round(sum(answer_term_coverages) / len(answer_term_coverages), 4)
        if answer_term_coverages
        else None,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate guideline RAG retrieval on a local benchmark.")
    parser.add_argument("--benchmark", type=Path, default=DEFAULT_BENCHMARK_PATH)
    parser.add_argument("--top-k", type=int, default=5)
    parser.add_argument("--output", type=Path, default=DEFAULT_REPORT_PATH)
    parser.add_argument(
        "--workflow",
        action="store_true",
        help="Evaluate early-warning workflow payload cases instead of retrieval-only queries.",
    )
    parser.add_argument(
        "--generate-answers",
        action="store_true",
        help="Generate deterministic grounded answers from retrieved contexts for answer-level evaluation.",
    )
    parser.add_argument(
        "--enable-llm",
        action="store_true",
        help="Allow workflow evaluation to call the configured LLM. Defaults to deterministic offline alerts.",
    )
    return parser.parse_args()


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    args = parse_args()
    try:
        from services.guideline_vector_store import GuidelineVectorStore
    except ImportError as exc:
        print(
            json.dumps(
                {
                    "success": False,
                    "error": f"Unable to load guideline vector store dependencies: {exc}",
                },
                ensure_ascii=False,
            )
        )
        return 1

    vector_store = GuidelineVectorStore()
    if not vector_store.is_available():
        print(json.dumps({"success": False, "error": f"Vector store not found at {vector_store.store_dir}"}, ensure_ascii=False))
        return 1

    cases = load_benchmark_cases(args.benchmark)
    workflow_service = None
    if args.workflow:
        from services.early_warning_service import EarlyWarningService

        workflow_service = EarlyWarningService(vector_store=vector_store, enable_llm=args.enable_llm)

    rows = []
    for case in cases:
        if args.top_k > 0:
            case = BenchmarkCase(
                query=case.query,
                expected_terms=case.expected_terms,
                expected_citation_contains=case.expected_citation_contains,
                top_k=args.top_k,
                expected_context_ids=case.expected_context_ids,
                reference_answer=case.reference_answer,
                answer=case.answer,
                payload=case.payload,
            )
        if workflow_service is not None and case.payload:
            rows.append(evaluate_workflow_case(workflow_service, case))
        elif args.generate_answers:
            rows.append(evaluate_generated_answer_case(vector_store, case))
        else:
            rows.append(evaluate_case(vector_store, case))

    summary = aggregate_results(rows)
    payload = {
        "success": True,
        "mode": "early_warning_workflow" if args.workflow else "retrieval_with_generated_answers" if args.generate_answers else "retrieval",
        "llm_enabled": bool(args.workflow and args.enable_llm),
        "benchmark": str(args.benchmark),
        "vector_store": str(vector_store.store_dir),
        "summary": summary,
        "cases": rows,
    }
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
        payload["output"] = str(args.output)
    print(json.dumps(payload, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
