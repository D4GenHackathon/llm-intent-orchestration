"""Diagnosis Support API endpoints."""

# Endpoints available:
# - POST /api/medical/drug-interactions
# - POST /api/medical/side-effects
# - POST /api/medical/health-risk
# - POST /api/medical/early-warning
# - POST /api/medical/prescription-safety
# - GET /api/health

from . import app, crew_instance, active_tasks
from fastapi import BackgroundTasks

import uuid
from services.medical_backend_service import MedicalBackendService
from schemas.interaction import DrugInteractionRequest
from schemas.side_effect import SideEffectLookupRequest
from schemas.risk import HealthRiskInput

# Run all agents
@app.post("/api/agents/run-all")
async def run_all_agents(background_tasks: BackgroundTasks):
    """Run all IoT orchestration agents."""
    task_id = str(uuid.uuid4())
    
    def run_all():
        try:
            result = crew_instance.run_all()
            active_tasks[task_id] = {
                "status": "completed",
                "result": result,
                "error": None
            }
        except Exception as e:
            active_tasks[task_id] = {
                "status": "failed",
                "result": None,
                "error": str(e)
            }
    
    background_tasks.add_task(run_all)
    active_tasks[task_id] = {
        "status": "processing",
        "result": None,
        "error": None
    }
    
    return {
        "task_id": task_id,
        "status": "processing",
        "message": "Running all agents..."
    }

@app.get("/api/agents/status/{task_id}")
async def get_all_agents_status(task_id: str):
    """Get all agents task status."""
    if task_id not in active_tasks:
        return {"error": "Task not found"}
    
    task = active_tasks[task_id]
    return {
        "task_id": task_id,
        "status": task["status"],
        "result": task["result"],
        "error": task["error"]
    }


# Medical Backend Endpoints
medical_service = None

def get_medical_service():
    """Get or initialize the medical backend service."""
    global medical_service
    if medical_service is None:
        medical_service = MedicalBackendService()
    return medical_service


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "Active",
        "service": "IoT Orchestration API with Medical Backend"
    }


@app.post("/api/medical/drug-interactions")
async def check_drug_interactions(payload: dict):
    """Check for drug interactions."""
    try:
        service = get_medical_service()
        response = service.handle_drug_interactions(payload)
        return response
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


@app.post("/api/medical/side-effects")
async def lookup_side_effects(payload: dict):
    """Lookup drug side effects."""
    try:
        service = get_medical_service()
        response = service.handle_side_effects(payload)
        return response
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


@app.post("/api/medical/health-risk")
async def predict_health_risk(payload: dict):
    """Predict health risk based on vital signs."""
    try:
        service = get_medical_service()
        response = service.handle_health_risk(payload)
        return response
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


@app.post("/api/medical/early-warning")
async def evaluate_early_warning(payload: dict):
    """Evaluate early warning indicators."""
    try:
        service = get_medical_service()
        response = service.handle_early_warning(payload)
        return response
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


@app.post("/api/medical/prescription-safety")
async def evaluate_prescription_safety(payload: dict):
    """Evaluate prescription safety."""
    try:
        service = get_medical_service()
        response = service.handle_prescription_safety(payload)
        return response
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
