"""Tests for LangGraph-style medical chat routing."""

from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from router.medical_chat_graph import MedicalChatGraph


class MedicalChatGraphTests(unittest.TestCase):
    def test_graph_plans_supported_workflow(self) -> None:
        graph = MedicalChatGraph()
        plan = graph.plan("Does ibuprofen interact with warfarin?")
        self.assertEqual(plan.route, "workflow")
        self.assertEqual(plan.intent_result.intent, "drug_interaction")

    def test_graph_plans_social_message(self) -> None:
        graph = MedicalChatGraph()
        plan = graph.plan("hello")
        self.assertEqual(plan.route, "social")
        self.assertEqual(plan.intent_result.intent, "small_talk")


if __name__ == "__main__":
    unittest.main()
