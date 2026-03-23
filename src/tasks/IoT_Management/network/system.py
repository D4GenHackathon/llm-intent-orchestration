from src.main import mcp as mcp_server
from src.onos import make_onos_request
from typing import Any, List, Dict, Optional, Union

# System: Overall system status and information (SDN Layer 3)
@mcp_server.tool(name="get_system_summary")
async def get_system_summary() -> str:
    """Get a summary of the system including ONOS version, memory usage, uptime, and other details."""
    try:
        system_data = await make_onos_request("get", "system")
        return str(system_data)
    except Exception as e:
        return f"Error retrieving system summary: {str(e)}"
    