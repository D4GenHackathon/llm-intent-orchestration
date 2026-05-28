"""Custom Crew AI module for LLM Multi Agent Management."""
from dotenv import load_dotenv
from crewai import Crew

from agents.agents import CustomAgent
from agents.medical_agents import MedicalAgentFactory
from schemas.interaction import DrugInteractionRequest
from schemas.risk import HealthRiskInput
from schemas.side_effect import SideEffectLookupRequest
from services.interaction_service import InteractionService
from services.risk_prediction_service import RiskPredictionService
from services.side_effect_service import SideEffectService
from tasks.IoT_Management import network_router
from tasks.Edge_Detection import edge_router
from tasks.Diagnosis_Support import diagnosis_router

load_dotenv()


class CustomCrew:
    def __init__(self):
        self.agents = CustomAgent("crew", "Biomedical IoT Orchestration Crew")
        self.medical_agents = MedicalAgentFactory()
        self.interaction_service = InteractionService()
        self.side_effect_service = SideEffectService()
        self.risk_prediction_service = RiskPredictionService()

    # 4.0 All agents & tasks execution
    def run_all(self):
        """Run all agents and tasks."""
        edge_detection_agent = self.agents.edge_detection()
        diagnosis_agent = self.agents.diagnosis_support()
        network_agent = self.agents.network_management()
        crew = Crew(
            agents=[edge_detection_agent, diagnosis_agent, network_agent],
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

    # 4.2 Diagnosis support agent execution
    def run_diagnosis(self):
        """Run diagnosis support only."""
        agent = self.agents.diagnosis_support()
        task = diagnosis_router(agent)
        return Crew(agents=[agent], tasks=[task], verbose=True).kickoff()

    # 4.3 Network management agent execution
    def run_network(self):
        """Run network management only."""
        agent = self.agents.network_management()
        task = network_router(agent)
        return Crew(agents=[agent], tasks=[task], verbose=True).kickoff()

    def run_drug_interaction(self, query: str = "", drugs: list[str] | None = None):
        """Run the deterministic drug interaction workflow."""
        return self.interaction_service.check_interactions(
            DrugInteractionRequest(query=query, drugs=drugs or [])
        ).to_dict()

    def run_side_effect_lookup(self, query: str = "", drug_name: str = ""):
        """Run the deterministic side-effect lookup workflow."""
        return self.side_effect_service.lookup_side_effects(
            SideEffectLookupRequest(query=query, drug_name=drug_name)
        ).to_dict()

    def run_health_risk_prediction(self, patient_profile: dict):
        """Run the dataset-based health risk workflow."""
        return self.risk_prediction_service.predict_risk(HealthRiskInput(**patient_profile)).to_dict()
