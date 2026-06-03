"""Edge Detection API endpoints."""

# Endpoints available:
# - POST /api/edge/detect
# - GET /api/edge/status/{task_id}
from fastapi import BackgroundTasks
import uuid
from . import app, crew_instance, active_tasks

@app.post("/api/edge/detect")
async def run_edge_detection(background_tasks: BackgroundTasks):
    """Run edge detection agent."""
    task_id = str(uuid.uuid4())
    
    def run_edge():
        try:
            result = crew_instance.run_edge_detection()
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
    
    background_tasks.add_task(run_edge)
    active_tasks[task_id] = {
        "status": "processing",
        "result": None,
        "error": None
    }
    
    return {
        "task_id": task_id,
        "status": "processing",
        "message": "Edge detection running..."
    }

@app.get("/api/edge/status/{task_id}")
async def get_edge_status(task_id: str):
    """Get edge detection task status."""
    if task_id not in active_tasks:
        return {"error": "Task not found"}
    
    task = active_tasks[task_id]
    return {
        "task_id": task_id,
        "status": task["status"],
        "result": task["result"],
        "error": task["error"]
    }