"""Tests for lightweight medical chat planning."""

from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from router.chat_planner import MedicalChatPlanner


class MedicalChatPlannerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.planner = MedicalChatPlanner()

    def test_small_talk_routes_to_social_branch(self) -> None:
        plan = self.planner.plan("hello")
        self.assertEqual(plan.route, "social")
        self.assertEqual(plan.intent_result.intent, "small_talk")

    def test_supported_medical_query_routes_to_workflow_branch(self) -> None:
        plan = self.planner.plan("Does ibuprofen interact with warfarin?")
        self.assertEqual(plan.route, "workflow")
        self.assertEqual(plan.intent_result.intent, "drug_interaction")

    def test_unknown_query_routes_to_clarification_branch(self) -> None:
        plan = self.planner.plan("What medicine is best for hepatitis?")
        self.assertEqual(plan.route, "clarification")
        self.assertEqual(plan.intent_result.intent, "unknown")
        self.assertTrue(plan.clarification_message)


if __name__ == "__main__":
    unittest.main()
