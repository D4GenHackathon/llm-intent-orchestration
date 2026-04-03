"""Medical-domain agent definitions for the new MVP workflows."""

from __future__ import annotations

import os
from textwrap import dedent

from crewai import Agent, LLM


class MedicalAgentFactory:
    """Separate medical-domain agents from the existing IoT-focused agent set."""

    def __init__(self) -> None:
        self.llm = LLM(
            model="gemini/gemini-flash-latest",
            api_key=os.getenv("GEMINI_API_KEY"),
        )

    def drug_safety_agent(self) -> Agent:
        """Agent for explaining deterministic drug-safety results."""
        return Agent(
            role="Drug Safety Workflow Agent",
            backstory=dedent(
                """Supports deterministic drug-safety workflows while deferring medical facts to structured data sources."""
            ),
            goal=dedent(
                """
                Help route drug interaction and side-effect requests, but do not invent medical facts.
                Prefer normalized inputs, structured lookups, and user-friendly summaries of database results.
                """
            ),
            verbose=True,
            llm=self.llm,
        )

    def health_risk_agent(self) -> Agent:
        """Agent for summarizing structured risk prediction outputs."""
        return Agent(
            role="Health Risk Workflow Agent",
            backstory=dedent(
                """Summarizes dataset-based health risk predictions and evidence for triage-oriented workflows."""
            ),
            goal=dedent(
                """
                Help present model outputs, similar-case evidence, and feature-based explanations without using the
                dataset as a generic medical knowledge base.
                """
            ),
            verbose=True,
            llm=self.llm,
        )
