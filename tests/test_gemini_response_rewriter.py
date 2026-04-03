"""Tests for Gemini-backed medical response rewriting."""

from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from services.gemini_response_rewriter import GeminiResponseRewriter


class StubGeminiResponseRewriter(GeminiResponseRewriter):
    def __init__(self, response: str | None, enabled: bool = True) -> None:
        self.response = response
        self._enabled = enabled

    def rewrite(self, intent: str, workflow_response: dict, draft_answer: str) -> str | None:  # type: ignore[override]
        return self.response


class GeminiResponseRewriterTests(unittest.TestCase):
    def test_disabled_rewriter_returns_none(self) -> None:
        rewriter = GeminiResponseRewriter(api_key="")
        rewriter._enabled = False  # explicit guard for the test environment
        answer = rewriter.rewrite("small_talk", {}, "hello")
        self.assertIsNone(answer)

    def test_sanitizes_meta_prefixes(self) -> None:
        rewriter = GeminiResponseRewriter(api_key="test")
        cleaned = rewriter._sanitize_output("Here's the rewritten answer: Hello there.")
        self.assertEqual(cleaned, "Hello there.")


if __name__ == "__main__":
    unittest.main()
