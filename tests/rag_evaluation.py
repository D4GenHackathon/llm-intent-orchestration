"""Tests for the standalone guideline RAG evaluator."""

from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.evaluate_guideline_rag import (
    BenchmarkCase,
    aggregate_results,
    evaluate_answer,
    evaluate_case,
    evaluate_generated_answer_case,
    generate_grounded_answer,
    load_benchmark_cases,
)


class FakeVectorStore:
    store_dir = Path("data/guidelines/vector_store")

    def is_available(self) -> bool:
        return True

    def search(self, query: str, top_k: int = 5) -> list[dict]:
        return [
            {
                "id": "NICE_CG50_0001",
                "text": "Physiological observations should include heart rate and temperature.",
                "metadata": {
                    "guideline": "NICE_CG50",
                    "page_start": 10,
                    "page_end": 12,
                },
                "score": 0.7,
            }
        ][:top_k]


class RagEvaluationTests(unittest.TestCase):
    def test_aggregate_results_returns_summary_metrics(self) -> None:
        rows = [
            {
                "query": "q1",
                "top_k": 5,
                "retrieved_count": 1,
                "term_hits": 1,
                "expected_terms": ["temperature"],
                "citation_hits": 1,
                "expected_citation_contains": ["guideline"],
                "top1_hit": True,
                "ragas_style": {
                    "context_precision": 1.0,
                    "context_recall": 1.0,
                    "answer_relevancy": None,
                    "faithfulness": None,
                },
                "results": [],
            },
            {
                "query": "q2",
                "top_k": 5,
                "retrieved_count": 0,
                "term_hits": 0,
                "expected_terms": ["fall"],
                "citation_hits": 0,
                "expected_citation_contains": ["guideline"],
                "top1_hit": False,
                "ragas_style": {
                    "context_precision": 0.0,
                    "context_recall": 0.0,
                    "answer_relevancy": None,
                    "faithfulness": None,
                },
                "results": [],
            },
        ]

        summary = aggregate_results(rows)
        self.assertEqual(summary["total_cases"], 2)
        self.assertEqual(summary["hit_rate"], 0.5)
        self.assertEqual(summary["citation_coverage"], 0.5)
        self.assertEqual(summary["avg_retrieved"], 0.5)
        self.assertEqual(summary["mean_context_precision"], 0.5)
        self.assertEqual(summary["mean_context_recall"], 0.5)

    def test_evaluate_case_uses_retrieved_text_and_citation(self) -> None:
        result = evaluate_case(
            FakeVectorStore(),
            BenchmarkCase(
                query="temperature and heart rate",
                expected_terms=["temperature", "heart rate"],
                expected_citation_contains=["NICE_CG50"],
                expected_context_ids=["NICE_CG50_0001"],
                top_k=1,
            ),
        )

        self.assertEqual(result["retrieved_count"], 1)
        self.assertEqual(result["term_hits"], 2)
        self.assertEqual(result["citation_hits"], 1)
        self.assertEqual(result["context_id_hits"], 1)
        self.assertTrue(result["top1_hit"])
        self.assertEqual(result["ragas_style"]["context_precision"], 1.0)
        self.assertEqual(result["ragas_style"]["context_recall"], 1.0)

    def test_answer_metrics_score_grounded_relevant_answer(self) -> None:
        metrics = evaluate_answer(
            query="temperature and heart rate guidance",
            answer="Physiological observations should include heart rate and temperature.",
            retrieved_texts=["Physiological observations should include heart rate and temperature."],
            expected_terms=["temperature", "heart rate"],
        )

        self.assertGreater(metrics["answer_relevancy"], 0)
        self.assertEqual(metrics["faithfulness"], 1.0)
        self.assertEqual(metrics["answer_term_coverage"], 1.0)

    def test_generated_answer_uses_retrieved_context_and_citation(self) -> None:
        result = evaluate_generated_answer_case(
            FakeVectorStore(),
            BenchmarkCase(
                query="temperature and heart rate",
                expected_terms=["temperature", "heart rate"],
                expected_citation_contains=["NICE_CG50"],
                expected_context_ids=["NICE_CG50_0001"],
                top_k=1,
            ),
        )

        self.assertIn("NICE_CG50", result["answer_evaluation"]["answer"])
        self.assertEqual(result["answer_evaluation"]["claim_count"], 1)
        self.assertEqual(result["ragas_style"]["faithfulness"], 1.0)

    def test_load_benchmark_cases_falls_back_when_missing(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            missing_path = Path(temp_dir) / "missing.jsonl"
            cases = load_benchmark_cases(missing_path)

        self.assertGreaterEqual(len(cases), 3)


if __name__ == "__main__":
    unittest.main()
