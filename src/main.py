from dotenv import load_dotenv
from crewai import Crew

from agents.agents import CustomAgent
from tasks import (
    access_router,
    device_router,
    deployment_router,
    network_config_router,
    validation_router,
    diagnosis_router,
    edge_router,
)

# Load environment variables from .env
load_dotenv()


class CustomCrew:
    def __init__(self):
        self.agents = CustomAgent("crew", "orchestrator")
        
    def run_all(self):
        """Run all agents and tasks."""
        # Create agents
        security_agent = self.agents.security_credentials_monitoring()
        deployment_agent = self.agents.deployment_monitoring()
        orchestration_agent = self.agents.orchestration()
        validation_agent = self.agents.plan_validation()
        network_agent = self.agents.network_auto_configuration()
        diagnosis_agent = self.agents.diagnosis_support()
        
        # Create tasks
        security_task = access_router(security_agent)
        deployment_task = deployment_router(deployment_agent)
        orchestration_task = device_router(orchestration_agent)
        validation_task = validation_router(validation_agent)
        network_task = network_config_router(network_agent)
        diagnosis_task = diagnosis_router(diagnosis_agent)
        
        # Define crew
        crew = Crew(
            agents=[
                security_agent,
                deployment_agent,
                orchestration_agent,
                validation_agent,
                network_agent,
                diagnosis_agent,
            ],
            tasks=[
                security_task,
                deployment_task,
                orchestration_task,
                validation_task,
                network_task,
                diagnosis_task,
            ],
            verbose=True,
        )
        
        return crew.kickoff()
    
    def run_security(self):
        """Run security monitoring only."""
        agent = self.agents.security_credentials_monitoring()
        task = access_router(agent)
        crew = Crew(agents=[agent], tasks=[task], verbose=True)
        return crew.kickoff()
    
    def run_deployment(self):
        """Run deployment monitoring only."""
        agent = self.agents.deployment_monitoring()
        task = deployment_router(agent)
        crew = Crew(agents=[agent], tasks=[task], verbose=True)
        return crew.kickoff()
    
    def run_orchestration(self):
        """Run device orchestration only."""
        agent = self.agents.orchestration()
        task = device_router(agent)
        crew = Crew(agents=[agent], tasks=[task], verbose=True)
        return crew.kickoff()
    
    def run_network(self):
        """Run network configuration only."""
        agent = self.agents.network_auto_configuration()
        task = network_config_router(agent)
        crew = Crew(agents=[agent], tasks=[task], verbose=True)
        return crew.kickoff()
    
    def run_diagnosis(self):
        """Run diagnosis support only."""
        agent = self.agents.diagnosis_support()
        task = diagnosis_router(agent)
        crew = Crew(agents=[agent], tasks=[task], verbose=True)
        return crew.kickoff()


def show_menu():
    """Display menu options."""
    print("\n## IoT Orchestration Crew Menu")
    print("=" * 35)
    print("1. Run All Agents")
    print("2. Security & Credentials Monitoring")
    print("3. Deployment Monitoring")
    print("4. Device Orchestration")
    print("5. Network Auto-Configuration")
    print("6. Diagnosis Support")
    print("0. Exit")
    print("=" * 35)


if __name__ == "__main__":
    print("## Welcome to IoT Orchestration Crew")
    print("-------------------------------")
    
    custom_crew = CustomCrew()
    
    while True:
        show_menu()
        choice = input("\nSelect option: ").strip()
        
        if choice == "0":
            print("Goodbye!")
            break
        elif choice == "1":
            result = custom_crew.run_all()
        elif choice == "2":
            result = custom_crew.run_security()
        elif choice == "3":
            result = custom_crew.run_deployment()
        elif choice == "4":
            result = custom_crew.run_orchestration()
        elif choice == "5":
            result = custom_crew.run_network()
        elif choice == "6":
            result = custom_crew.run_diagnosis()
        else:
            print("Invalid option. Try again.")
            continue
        
        print("\n########################")
        print("## Result:")
        print("########################\n")
        print(result)