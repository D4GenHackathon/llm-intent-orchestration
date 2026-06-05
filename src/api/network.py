"""Network Management API endpoints integrated with CrewAI and ONOS tools."""

# Endpoints available:
# - POST /api/network/configure
# - GET /api/network/status/{task_id}
# - GET /api/network/health
# - GET /api/network/tools
# - POST /api/network/tools/execute
# - POST /api/network/chat
# - GET /api/network/chat/{session_id}
# - POST /api/network/chat/{session_id}/clear

from __future__ import annotations

from typing import Any
from datetime import datetime, timezone

from fastapi import BackgroundTasks, HTTPException
from pydantic import BaseModel, Field

from . import app, crew_instance, active_tasks, AgentRequest, AgentResponse
from tasks.IoT_Management.network_router import get_network_tool_registry, run_network_tool

import uuid

# Chat session storage
chat_sessions: dict[str, list[dict]] = {}


class NetworkToolExecutionRequest(BaseModel):
    tool_name: str = Field(..., description="Registered ONOS tool name")
    arguments: dict[str, Any] = Field(default_factory=dict, description="Keyword arguments for the selected tool")


class ChatMessage(BaseModel):
    """Chat message for chatbot conversation."""
    session_id: str = Field(..., description="Unique session ID for chat conversation")
    message: str = Field(..., description="User message")
    stream: bool = Field(default=False, description="Whether to stream the response")


class ChatChoice(BaseModel):
    """Chat completion choice."""
    index: int
    message: dict
    finish_reason: str = "stop"

class ChatUsage(BaseModel):
    """Token usage information."""
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0

class ChatResponse(BaseModel):
    """Chat completion response."""
    id: str
    object: str = "chat.completion"
    created: int
    model: str = "llm-agent-ollama"
    choices: list[ChatChoice]
    usage: ChatUsage


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


@app.post("/api/network/chat")
async def chat_with_network_agent(request: ChatMessage, background_tasks: BackgroundTasks) -> ChatResponse:
    """Chat with network management agent for conversational network configuration."""
    if crew_instance is None:
        raise HTTPException(status_code=500, detail="CrewAI instance not initialized")

    session_id = request.session_id
    if session_id not in chat_sessions:
        chat_sessions[session_id] = []

    task_id = str(uuid.uuid4())
    import time

    def process_chat_message() -> None:
        try:
            # Add user message to session history
            chat_sessions[session_id].append({
                "role": "user",
                "content": request.message,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })

            # Run network agent with user query
            result = crew_instance.run_network(query=request.message)

            # Add assistant response to session history
            chat_sessions[session_id].append({
                "role": "assistant",
                "content": str(result),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })

            active_tasks[task_id] = {
                "status": "completed",
                "result": result,
                "error": None,
            }
        except Exception as exc:
            chat_sessions[session_id].append({
                "role": "assistant",
                "content": f"Error processing your request: {str(exc)}",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
            active_tasks[task_id] = {
                "status": "failed",
                "result": None,
                "error": str(exc),
            }

    if request.stream:
        background_tasks.add_task(process_chat_message)
        return ChatResponse(
            id=task_id,
            created=int(time.time()),
            choices=[
                ChatChoice(
                    index=0,
                    message={
                        "role": "assistant",
                        "content": "Processing your network configuration request...",
                    },
                )
            ],
            usage=ChatUsage(),
        )
    else:
        process_chat_message()
        content = chat_sessions[session_id][-1]["content"] if chat_sessions[session_id] else "No response"
        return ChatResponse(
            id=task_id,
            created=int(time.time()),
            choices=[
                ChatChoice(
                    index=0,
                    message={
                        "role": "assistant",
                        "content": content,
                    },
                )
            ],
            usage=ChatUsage(),
        )


@app.get("/api/network/chat/{session_id}")
async def get_chat_history(session_id: str):
    """Get chat history for a session."""
    if session_id not in chat_sessions:
        return {
            "session_id": session_id,
            "history": [],
            "message": "No chat history found",
        }

    return {
        "session_id": session_id,
        "history": chat_sessions[session_id],
        "message_count": len(chat_sessions[session_id]),
    }


@app.post("/api/network/chat/{session_id}/clear")
async def clear_chat_history(session_id: str):
    """Clear chat history for a session."""
    if session_id in chat_sessions:
        chat_sessions[session_id] = []
        return {
            "session_id": session_id,
            "status": "cleared",
            "message": "Chat history cleared",
        }

    return {
        "session_id": session_id,
        "status": "not_found",
        "message": "Session not found",
    }


