from src.main import mcp as mcp_server
from src.onos import make_onos_request
from typing import Any, List, Dict, Optional, Union

# Packet: Packet processing and handling (e.g., packet-in events, packet-out actions, packet processors)

@mcp_server.tool(name="get_packet_processors")
async def get_packet_processors() -> str:
    """Gets packet processors.

    Returns array of all packet processors.
    """
    try:
        processors = await make_onos_request("get", "packet/processors")
        return str(processors)
    except Exception as e:
        return f"Error retrieving packet processors: {str(e)}"
