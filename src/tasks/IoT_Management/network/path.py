from src.main import mcp as mcp_server
from src.onos import make_onos_request
from typing import Any, List, Dict, Optional, Union

# Routing: Path routing in OSI Transport Layer 3 (shortest path, disjoint paths for redundancy and load balancing purposes)
@mcp_server.tool(name="get_shortest_path")
async def get_shortest_path(src: str, dst: str) -> str:
    """Gets the shortest path between two devices.

    Args:
        src: Source device identifier (device/host)
        dst: Destination device identifier (device/host)

    Returns array of all shortest paths between the source and destination devices.
    """
    try:
        path = await make_onos_request("get", f"paths/{src}/{dst}")
        return str(path)
    except Exception as e:
        return f"Error retrieving shortest path from {src} to {dst}: {str(e)}"

@mcp_server.tool(name="get_disjoint_paths")
async def get_disjoint_paths(src: str, dst: str) -> str:
    """Gets disjoint paths between two devices.

    Args:
        src: Source device identifier 
        dst: Destination device identifier 

    Returns array of all disjoint paths between the source and destination devices.
    """
    try:
        paths = await make_onos_request("get", f"paths/disjoint/{src}/{dst}/disjoint")
        return str(paths)
    except Exception as e:
        return f"Error retrieving disjoint paths from {src} to {dst}: {str(e)}"