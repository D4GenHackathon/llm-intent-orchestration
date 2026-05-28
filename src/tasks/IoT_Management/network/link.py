from tasks.main import mcp as mcp_server
from src.onos import make_onos_request
from typing import Any, List, Dict, Optional, Union

# Link: Wireless connections between devices.
@mcp_server.tool(name="get_links")
async def get_links() -> str:
    """Get infrastructure links.

    Returns array of all links.
    """
    try:
        links = await make_onos_request("get", "links")
        return str(links)
    except Exception as e:
        return f"Error retrieving links: {str(e)}"


@mcp_server.tool(name="get_link_status")
async def get_stale_link_status() -> str:
    """Get useStaleLinkAge active status.

    Returns current status of the VanishedStaleLink.
    """
    try:
        status = await make_onos_request("get", "links/usestalelinkage")
        return str(status)
    except Exception as e:
        return f"Error retrieving stale link status: {str(e)}"

@mcp_server.tool(name="set_link_status")
async def set_stale_link_status(active: bool) -> str:
    """Set useStaleLinkAge active status.

    Args:
        use_stale_link_age: Desired status of the VanishedStaleLink (down links)
        
    Sets the status which determines whether the stale link age mechanism is used.
    """
    try:
        await make_onos_request("post", "links/usestalelinkage", data={"useStaleLink": active})
        return f"Successfully set useStaleLinkAge to {active}"
    except Exception as e:
        return f"Error setting stale link status: {str(e)}"
        