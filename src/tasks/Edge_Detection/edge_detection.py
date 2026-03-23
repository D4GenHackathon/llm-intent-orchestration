""" LLM Intent Orchestration for Biomedical IoT: Edge Detection Task"""
from typing import Optional
from crewai import Task

# 4.1 Edge LLM Anomaly Detection
def edge_router(agent, sensor_id: Optional[str] = None, threshold: Optional[float] = None):
    """Edge LLM anomaly detection task.
    
    Args:
        agent: The CrewAI agent to execute this task
        sensor_id: Sensor identifier
        threshold: Anomaly detection threshold
    """
    return Task(
        description=f"Detect anomalies in sensor {sensor_id} data with threshold {threshold}.",
        agent=agent
    )
