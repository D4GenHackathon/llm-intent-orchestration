"""Network Management API endpoints integrated with CrewAI and ONOS tools."""

# Endpoints available:
# - POST /api/network/configure
# - GET /api/network/status/{task_id}
# - GET /api/network/health
# - GET /api/network/tools
# - POST /api/network/tools/execute

from __future__ import annotations

from typing import Any

from fastapi import BackgroundTasks, HTTPException
from pydantic import BaseModel, Field

from . import app, crew_instance, active_tasks, AgentRequest, AgentResponse
from tasks.IoT_Management.network_router import get_network_tool_registry, run_network_tool

import uuid

class NetworkToolExecutionRequest(BaseModel):
    tool_name: str = Field(..., description="Registered ONOS tool name")
    arguments: dict[str, Any] = Field(default_factory=dict, description="Keyword arguments for the selected tool")


@app.post("/api/network/configure")
async def configure_network(request: AgentRequest, background_tasks: BackgroundTasks) -> AgentResponse:
    """Configure SDN network using CrewAI network agent."""
    if crew_instance is None:
        raise HTTPException(status_code=500, detail="CrewAI instance not initialized")

    task_id = str(uuid.uuid4())

    def run_network_config() -> None:
        try:
            result = crew_instance.run_network(query=request.query)
            active_tasks[task_id] = {
                "status": "completed",
                "result": result,
                "error": None,
            }
        except Exception as exc:
            active_tasks[task_id] = {
                "status": "failed",
                "result": None,
                "error": str(exc),
            }

    background_tasks.add_task(run_network_config)
    active_tasks[task_id] = {
        "status": "processing",
        "result": None,
        "error": None,
    }

    return AgentResponse(
        status="processing",
        message=f"Network configuration processing: {request.query}",
    )


@app.get("/api/network/status/{task_id}")
async def get_network_task_status(task_id: str):
    """Get status of a network configuration task."""
    if task_id not in active_tasks:
        return {"error": "Task not found"}

    task = active_tasks[task_id]
    return {
        "task_id": task_id,
        "status": task["status"],
        "result": task["result"],
        "error": task["error"],
    }

@app.get("/api/network/health")
async def network_health():
    """Health check for network management service."""
    tools = get_network_tool_registry()
    return {
        "status": "online",
        "service": "Network Management (CrewAI)",
        "agent": "network_management",
        "tool_count": len(tools),
    }


@app.get("/api/network/tools")
async def list_network_tools():
    """List all registered ONOS network tools available to CrewAI architecture."""
    tools = get_network_tool_registry()
    return {
        "count": len(tools),
        "tools": sorted(tools.keys()),
    }

@app.post("/api/network/tools/execute")
async def execute_network_tool(request: NetworkToolExecutionRequest):
    """Execute one registered ONOS network tool by name."""
    try:
        result = await run_network_tool(request.tool_name, **request.arguments)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except TypeError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid arguments for tool '{request.tool_name}': {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {
        "tool": request.tool_name,
        "arguments": request.arguments,
        "result": result,
    }



