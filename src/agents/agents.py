"""
Agents module for managing different types of agents within the system.
- Define Crew Captain who orients other agents towards the autonomated orchestration goal of IOT device deployment in Software-Defined Networks (SDN) control.
    including security & credentials monitoring, deployment monitoring, plan validation, network auto-configuration, and device orchestration.

"""
from textwrap import dedent
from crewai import Agent
from langchain_openai import ChatOpenAI
from crewai_tools import (
    JSONSearchTool,
    WebsiteSearchTool
)
class CustomAgent:
    def __init__(self, name, role):
        self.OpenAIGPT35 = ChatOpenAI(model="gpt-3.5-turbo", temperature=0.7)
        self.OpentAIGPT4 = ChatOpenAI(model="gpt-4", temperature=0.7)
        self.name = name
        self.role = role

    # 4.1 Define security & credentials monitoring agent
    def security_credentials_monitoring(self):
        return Agent(
            role="Security & Credentials Monitoring Agent",
            backstory=dedent("""Monitors security and credentials for IOT devices, ensuring compliance with Software-Defined Network (SDN) predefined rules and restrictions."""),
            goal = dedent("""
            Ensure compliance with predefined rules and restrictions for IOT devices in the Software-Defined Network (SDN) environment,
            include generating appropriate flow-based SDN data formats (device ip addresses, source ports, destination ports, actions) which satify deployment device status and reporting any security issues for further action.
            """),
                tools = JSONSearchTool(),
                verbose = True,
                llm=self.OpenAIGPT35,
            )
        
    # 4.2 Define deployment monitoring agent
    def deployment_monitoring(self):
        return Agent(
            role="Deployment Monitoring Agent",
            backstory=dedent("""Monitors the deployment of IOT devices in the patient fall detection system."""),
            goal = dedent("""
            Ensure that IOT devices are deployed according to the safety of patient moving patterns and the predefined rules and restrictions,
            include deployment status of each device (ip address, status, location and relevant services), and report any issues for further action.
            """),
            tools = JSONSearchTool(),
            verbose = True,
            llm=self.OpenAIGPT35,
        )
    
    # 4.3 Define orchestration agent
    def orchestration(self):
        return Agent(
            role="Orchestration Agent",
            backstory=dedent("""Orchestrates the deployment of IOT devices in the patient fall detection system."""),
            goal = dedent("""
            Ensure that IOT devices are orchestrated according to the predefined rules and restrictions,
            include generating necessary IOT devices with their services in the deployment monitoring server, and the algorithm for network auto-configuration, and report any issues for further action."""),
            tools = JSONSearchTool(),
            verbose = True,
            llm=self.OpenAIGPT35,
        )
        
    # 4.4 Define plan validation agent
    def plan_validation(self):
        return Agent(
            role="Plan Validation Agent",
            backstory=dedent("""Validates the deployment plan for IOT devices in the patient fall detection system."""),
            goal = dedent("""
            Ensure that the deployment plan for IOT devices is valid and meets the requirements of the patient fall detection system,
            include generating recommendations for improving the deployment plan based on the security and credentials monitoring to reach the device rules and policies, deployment monitoring, and orchestration agents, and report any issues for further action."""),
            tools = JSONSearchTool(),
            verbose = True,
            llm=self.OpenAIGPT35,
        )  
    
    # 4.5 Define network auto-configuration agent
    def network_auto_configuration(self):
        return Agent(
            role="Network Auto-Configuration Agent",
            backstory=dedent("""Automatically configures the network for IOT devices in the patient fall detection system."""),
            goal = dedent("""
            Ensure that the network for IOT devices is automatically configured according to the predefined rules and restrictions,
            include generating necessary flow-based SDN data formats (device ip addresses, source ports, destination ports, actions) for network auto-configuration based on the deployment status of each device, and report any issues for further action."""),
            tools = JSONSearchTool(),
            verbose = True,
            llm=self.OpenAIGPT35,
        )

    # 4.6 Define Edge LLM Agent for sensor data anomaly detection (Future work - Giang)
    # 4.7 Define Diagnosis LLM Agent for doctor's diagnosis support 
    def diagnosis_support(self):
        return Agent(
            role="Diagnosis Support Agent",
            backstory=dedent("""Provides support for doctors in diagnosing patient conditions based on sensor data and other relevant information."""),
            goal = dedent("""
            Ensure that doctors receive accurate and timely support in diagnosing patient conditions,
            include analyzing sensor data, patient history, and other relevant information to provide recommendations for diagnosis and treatment, and report any issues for further action."""),
            verbose = True,
            tools = [WebsiteSearchTool()],
            llm=self.OpenAIGPT35,
        )