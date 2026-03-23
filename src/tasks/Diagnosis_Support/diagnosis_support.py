""" LLM Intent Orchestration for Biomedical IoT: Diagnosis Support Task"""
from typing import Optional
from crewai import Task

# 4.2 Diagnosis Support LLM Task
def diagnosis_router(agent, patient_id: Optional[str] = None, symptoms: Optional[list] = None):
    """Diagnosis support task.
    
    Args:
        agent: The CrewAI agent to execute this task
        patient_id: Patient identifier
        symptoms: List of reported symptoms
    """
    return Task(
        description=f"Diagnose patient {patient_id} with symptoms {symptoms}.",
        agent=agent
    )
    
   