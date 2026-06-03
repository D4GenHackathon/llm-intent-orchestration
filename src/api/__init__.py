"""API package for IoT Orchestration."""
"""FastAPI Server for IoT Orchestration with Crew AI agents."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from pydantic import BaseModel
import uuid
import os
from dotenv import load_dotenv
from typing import Optional

load_dotenv()

# Store active tasks
active_tasks = {}
crew_instance = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage app lifecycle."""
    global crew_instance
    try:
        from crew.crew import CustomCrew

        crew_instance = CustomCrew()
        print("Crew AI initialized")
    except Exception as exc:
        crew_instance = None
        print(f"Warning: Crew AI initialization skipped: {exc}")
    yield
    print("Shutting down...")

# Create FastAPI app
app = FastAPI(
    title="IoT Orchestration API",
    description="LLM-powered network management with Crew AI",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware for UI communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request/Response models
class AgentRequest(BaseModel):
    """Request model for network configuration."""
    query: str
    department: str = "General"
    priority: str = "medium"

class AgentResponse(BaseModel):
    """Response model from agents."""
    status: str
    message: str
    result: Optional[str] = None
    
# 4.0 General function: Health check
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "online",
        "service": "IoT Orchestration API",
        "agents": ["edge_detection", "diagnosis_support", "network_management"]
    }


# Import diagnosis routes after shared app state is defined.
from . import diagnosis_api  # noqa: E402,F401
