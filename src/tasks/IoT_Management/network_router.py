""" LLM Intent Orchestration for Biomedical IoT: Diagnosis Support Task"""
from typing import Optional
from crewai import Task

# Import all task modules to register their tools with the shared server
from .network import (
    configuration,
    device,
    diagnostics,
    flow,
    host,
    link,
    meter,
    metric,
    multicast,
    network,
    packet,
    path,
    system,
    topology
)

# 4.3 Network Management LLM Task
def network_router(agent):
    """Network management task.
    
    Args:
        agent: The CrewAI agent to execute this task
        tools: List of ONOS tools for network management
    """
    return Task(
        description=f"Perform network management tasks using ONOS tools.",
        tools=[
            configuration,
            device,
            diagnostics,
            flow,
            host,
            link,
            meter,
            metric,
            multicast,
            network,
            packet,
            path,
            system,
            topology
        ],
        agent=agent
    )
    
   