"""Custom Crew AI module for LLM Multi Agent Management."""
from dotenv import load_dotenv
from crewai import Crew

from agents.agents import CustomAgent
from tasks.IoT_Management import network_router
from tasks.Edge_Detection import edge_router
from tasks.Drug_Safety import drug_interaction_router, side_effect_router
from tasks.Health_Risk import risk_prediction_router

load_dotenv()


class CustomCrew:
    def __init__(self):
        self.agents = CustomAgent("crew", "Biomedical IoT Orchestration Crew")

    # 4.0 All agents & tasks execution
    def run_all(self):
        """Run all agents and tasks."""
        edge_detection_agent = self.agents.edge_detection()
        drug_interaction_agent = self.agents.drug_safety_agent()
        health_risk_agent = self.agents.health_risk_agent()
        network_agent = self.agents.network_management()
        crew = Crew(
            agents=[edge_detection_agent, drug_interaction_agent, health_risk_agent, network_agent],
            tasks=[
            ],
            verbose=True,
        )
        return crew.kickoff()

    # 4.1 Edge detection agent execution
    def run_edge_detection(self):
        """Run edge detection only."""
        agent = self.agents.edge_detection()
        task = edge_router(agent)
        return Crew(agents=[agent], tasks=[task], verbose=True).kickoff()

    # 4.2 Medicine support agent execution (CrewAI routers)
    def run_drug_interaction(self, query: str = "", drugs: list[str] | None = None):
        """Run the deterministic drug interaction workflow via the drug_interaction router."""
        agent = self.agents.drug_safety_agent()
        task = drug_interaction_router(agent, query=query, drugs=drugs or [])
        return Crew(agents=[agent], tasks=[task], verbose=True).kickoff()

    def run_side_effect_lookup(self, query: str = "", drug_name: str = ""):
        """Run the deterministic side-effect lookup via the side_effect router."""
        agent = self.agents.drug_safety_agent()
        task = side_effect_router(agent, query=query, drug_name=drug_name)
        return Crew(agents=[agent], tasks=[task], verbose=True).kickoff()

    def run_health_risk_prediction(self, patient_profile: dict | None = None):
        """Run the dataset-based health risk workflow via the risk_prediction router."""
        agent = self.agents.health_risk_agent()
        task = risk_prediction_router(agent, patient_profile=patient_profile)
        return Crew(agents=[agent], tasks=[task], verbose=True).kickoff()
    
    # 4.3 Network management agent execution
    def run_network(self, query: str | None = None):
        """Run network management only."""
        agent = self.agents.network_management()
        task = network_router(agent, user_query=query)
        return Crew(agents=[agent], tasks=[task], verbose=True).kickoff()

