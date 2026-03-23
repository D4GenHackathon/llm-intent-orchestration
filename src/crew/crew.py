"""Custom Crew AI module for LLM Multi Agent Management."""
from dotenv import load_dotenv
from crewai import Crew

from agents.agents import CustomAgent
from tasks.IoT_Management import network_router
from tasks.Edge_Detection import edge_router
from tasks.Diagnosis_Support import diagnosis_router

load_dotenv()


class CustomCrew:
    def __init__(self):
        self.agents = CustomAgent("crew", "Biomedical IoT Orchestration Crew")
    
    # 4.0 All agents & tasks execution
    def run_all(self):
        """Run all agents and tasks."""
        edge_detection_agent = self.agents.edge_detection()
        diagnosis_agent = self.agents.diagnosis_support()
        network_agent = self.agents.network_management()
        crew = Crew(
            agents=[edge_detection_agent, diagnosis_agent, network_agent],
            tasks= [
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