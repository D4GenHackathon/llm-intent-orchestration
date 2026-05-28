"""
Agents module for managing different types of agents within the system.
- Define Crew Captain who orients other agents towards the autonomated orchestration goal of IOT device deployment in Software-Defined Networks (SDN) control.
    including security & credentials monitoring, deployment monitoring, plan validation, network auto-configuration, and device orchestration.
"""
from __future__ import annotations

import os
from dotenv import load_dotenv
from textwrap import dedent
from crewai import Agent, LLM

load_dotenv()


class CustomAgent:
    SYSTEM_PROMPT_PATH = os.path.join(os.path.dirname(__file__), "system_prompt.txt")
    PROMPTS_DIR = os.path.join(os.path.dirname(__file__), "prompts")

    with open(SYSTEM_PROMPT_PATH, "r") as f:
        SYSTEM_PROMPT = f.read()

    def __init__(self, name, role):
        self.llm = LLM(
            model=os.getenv("GEMINI_MODEL", "gemini/gemini-flash-latest"),
            api_key=os.getenv("GEMINI_API_KEY"),
        )
        self.name = name
        self.role = role

    @classmethod
    def _load_prompt(cls, prompt_filename: str) -> str:
        """Load a prompt from the prompts folder."""
        prompt_path = os.path.join(cls.PROMPTS_DIR, prompt_filename)
        try:
            with open(prompt_path, "r") as f:
                return f.read().strip()
        except FileNotFoundError:
            print(f"Warning: Prompt file not found: {prompt_path}")
            return ""

    # 4.1 Define Edge LLM Agent for sensor data anomaly detection (Future work - Giang)
    def edge_detection(self):
        edge_prompt = self._load_prompt("edge_detection_prompt.txt")
        return Agent(
            role="Edge Detection Agent",
            backstory=edge_prompt
            if edge_prompt
            else dedent(
                """Detects anomalies in sensor data at the edge to enable real-time response and reduce network load."""
            ),
            goal=dedent(
                """
            Analyze sensor data from IOT devices in the fall detection scenario to identify anomalies that may indicate patient falls or health issues,
            and generate timely alerts with explanations for medical staff to take appropriate actions."""
            ),
            verbose=True,
            llm=self.llm,
            allow_delegation=False,
        )

    # 4.2 Define Diagnosis LLM Agent for doctor's diagnosis support 
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

    # 4.3 Define network management agent
    def network_management(self):
        network_prompt = self._load_prompt("network_management_prompt.txt")
        return Agent(
            role="Network Management Agent",
            backstory=network_prompt
            if network_prompt
            else dedent(
                """Manages and auto-configures the SDN network to ensure optimal performance for IOT device communication."""
            ),
            goal=dedent(
                """
            Manage and auto-configure the SDN network in the fall detection scenario to ensure optimal performance for IOT device communication,
            including monitoring network status, identifying and resolving connectivity issues, and optimizing data flow for timely alerts."""
            ),
            verbose=True,
            llm=self.llm,
            allow_delegation=False,
        )
