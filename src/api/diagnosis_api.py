"""Diagnosis Support API endpoints."""

# Endpoints available:
# - POST /api/diagnosis/support
# - GET /api/diagnosis/status/{task_id}

from . import *

@app.post("/api/diagnosis/support")
async def run_diagnosis_support(background_tasks: BackgroundTasks):
    """Run diagnosis support agent."""
    task_id = str(uuid.uuid4())
    
    def run_diagnosis():
        try:
            result = crew_instance.run_diagnosis()
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
    
    background_tasks.add_task(run_diagnosis)
    active_tasks[task_id] = {
        "status": "processing",
        "result": None,
        "error": None
    }
    
    return {
        "task_id": task_id,
        "status": "processing",
        "message": "Diagnosis support running..."
    }

@app.get("/api/diagnosis/status/{task_id}")
async def get_diagnosis_status(task_id: str):
    """Get diagnosis support task status."""
    if task_id not in active_tasks:
        return {"error": "Task not found"}
    
    task = active_tasks[task_id]
    return {
        "task_id": task_id,
        "status": task["status"],
        "result": task["result"],
        "error": task["error"]
    }

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
