"""
Agents module for managing different types of agents within the system.
- Define Crew Captain who orients other agents towards the autonomated orchestration goal of IOT device deployment in Software-Defined Networks (SDN) control.
    including security & credentials monitoring, deployment monitoring, plan validation, network auto-configuration, and device orchestration.
"""
import os
from dotenv import load_dotenv
from textwrap import dedent
from crewai import Agent, Task
from langchain.chat_models import ChatOllama, ChatGooglePalm, ChatOpenAI

load_dotenv()

class CustomAgent:
    
    SYSTEM_PROMPT_PATH = os.path.join(os.path.dirname(__file__), "system_prompt.txt")
    PROMPTS_DIR = os.path.join(os.path.dirname(__file__), "prompts")
    
    with open(SYSTEM_PROMPT_PATH, "r") as f:
        SYSTEM_PROMPT = f.read()
        
    def __init__(self, name, role):
        # Use Google Gemini
        self.llm = ChatOllama(
            base_url=os.getenv("API_BASE_URL", "http://localhost:11434/v1"),
        )
        self.model = os.getenv("MODEL", "minimax-m2.5:cloud")       
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
        # Load custom prompt for edge detection agent
        edge_prompt = self._load_prompt("edge_detection_prompt.txt")
        return Agent(
            role="Edge Detection Agent",
            backstory=edge_prompt if edge_prompt else dedent("""Detects anomalies in sensor data at the edge to enable real-time response and reduce network load."""),
            goal = dedent("""
            Analyze sensor data from IOT devices in the fall detection scenario to identify anomalies that may indicate patient falls or health issues, 
            and generate timely alerts with explanations for medical staff to take appropriate actions."""),
            verbose = True,
            llm=self.llm,
            allow_delegation=False,
        )
        
    # 4.2 Define Diagnosis LLM Agent for doctor's diagnosis support (Data tools using registered network tools for patient history, data from IOT devices in the deployment monitoring) 
    def diagnosis_support(self):
        # Load custom prompt for diagnosis support agent
        diagnosis_prompt = self._load_prompt("diagnosis_support_prompt.txt")
        return Agent(
            role="Diagnosis Support Agent",
            backstory=diagnosis_prompt if diagnosis_prompt else dedent("""Supports doctors in diagnosing patient conditions based on data from IOT devices and patient history."""),
            goal = dedent("""
            Provide support to doctors in diagnosing patient conditions by analyzing data from IOT devices in the fall detection scenario to know about patient conditions and patient history,
            include generating recommendations for diagnosis and relevant medical actions step by step with explanations, and report any issues for further action."""),
            verbose = True,
            llm=self.llm,
            allow_delegation=False,
        )
                
    # 4.3 Define network management agent 
    def network_management(self):
        # Load custom prompt for network management agent
        network_prompt = self._load_prompt("network_management_prompt.txt")
        return Agent(
            role="Network Management Agent",
            backstory=network_prompt if network_prompt else dedent("""Manages and auto-configures the SDN network to ensure optimal performance for IOT device communication."""),
            goal = dedent("""
            Manage and auto-configure the SDN network in the fall detection scenario to ensure optimal performance for IOT device communication, 
            including monitoring network status, identifying and resolving connectivity issues, and optimizing data flow for timely alerts."""),
            verbose = True,
            llm=self.llm,
            allow_delegation=False,
        ) 
    