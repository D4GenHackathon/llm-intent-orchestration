"""FastMCP Server for IoT Orchestration."""
import time
import uuid
import json
from fastmcp import FastMCP
from crew.crew import CustomCrew
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict
from fastapi.responses import StreamingResponse

# Initialize MCP server
mcp = FastMCP("Secure AIOT Electronic Health Record Collection & Network Management Orchestration", verbose=True)
custom_crew = CustomCrew()

# 4.0 Define MCP tools to run agents for different tasks in the IoT orchestration scenario
@mcp.tool()
def run_all_agents() -> str:
    """Run all IoT orchestration agents."""
    result = custom_crew.run_all()
    return str(result)

# 4.1 Define edge detection agent
@mcp.tool()
def run_edge_detection_agent() -> str:
    """Run edge detection agent."""
    result = custom_crew.run_edge_detection()
    return str(result)

# 4.2 Define diagnosis support agent
@mcp.tool()
def run_diagnosis_agent() -> str:
    """Run diagnosis support agent."""
    result = custom_crew.run_diagnosis()
    return str(result)

# 4.3 Define network management agent
@mcp.tool()
def run_network_agent() -> str:
    """Run network auto-configuration agent."""
    result = custom_crew.run_network()
    return str(result)

if __name__ == "__main__":
    mcp.run()
