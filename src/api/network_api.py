"""Network Management API endpoints - integrated in main.py"""

# Endpoints available:
# - POST /api/network/configure
# - GET /api/network/status/{task_id}
# - GET /api/network/health
# - POST /api/network/apply-policy
from . import *

@app.post("/api/network/configure")
async def configure_network(request: AgentRequest, background_tasks: BackgroundTasks) -> AgentResponse:
    """Configure SDN network using LLM-powered network agent."""
    task_id = str(uuid.uuid4())
    
    def run_network_config():
        try:
            result = crew_instance.run_network()
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
    
    background_tasks.add_task(run_network_config)
    active_tasks[task_id] = {
        "status": "processing",
        "result": None,
        "error": None
    }
    
    return AgentResponse(
        status="processing",
        message=f"Network configuration processing: {request.query}"
    )

@app.get("/api/network/status/{task_id}")
async def get_task_status(task_id: str):
    """Get status of a network configuration task."""
    if task_id not in active_tasks:
        return {"error": "Task not found"}
    
    task = active_tasks[task_id]
    return {
        "task_id": task_id,
        "status": task["status"],
        "result": task["result"],
        "error": task["error"]
    }

@app.get("/api/network/health")
async def network_health():
    """Health check for network agent."""
    return {
        "status": "online",
        "service": "Network Management Agent",
        "agent": "network_management"
    }



