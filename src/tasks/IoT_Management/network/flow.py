from src.onos.app_connection import (ONOS_BASE_URL, ONOS_USER, ONOS_PASSWORD, HTTP_TIMEOUT)
from src.main import mcp as mcp_server
from src.onos import make_onos_request
from typing import Any, List, Dict, Optional, Union

from urllib.parse import quote

### Controller Layer Flow Tasks (SDN Layer 2)
@mcp_server.tool(name="get_flows")
async def get_flows() -> str:
    """Gets all flows in the network.

    Returns a list of all flows in the network.
    """
    try:
        flows = await make_onos_request("get", "flows")
        return str(flows)
    except Exception as e:
        return f"Error retrieving flows: {str(e)}"

@mcp_server.tool(name="get_device_flows")
async def get_device_flows(device_id: str) -> str:
    """Gets flows for a specific device.

    Args:
        device_id: Device identifier
        
    Returns a list of flows for the specified device.
    """
    try:
        flows = await make_onos_request("get", f"flows/{device_id}")
        return str(flows)
    except Exception as e:
        return f"Error retrieving flows for device {device_id}: {str(e)}"

@mcp_server.tool(name="get_device_flow")
async def get_device_flow(device_id: str, flow_id: str) -> str:
    """Gets details of a specific flow on a device.

    Args:
        device_id: Device identifier
        flow_id: Flow identifier

    Returns detailed information about the specified flow on the device.
    """
    try:
        flow = await make_onos_request("get", f"flows/{device_id}/{flow_id}")
        return str(flow)
    except Exception as e:
        return f"Error retrieving flow {flow_id} for device {device_id}: {str(e)}"
    
@mcp_server.tool(name="get_table_flows")
async def get_table_flows(table_id: str) -> str:
    """Gets flows for a specific table on a device.

    Args:
        table_id: Table identifier
    
    Returns a list of flows for the specified table on the device.
    """
    try:
        flows = await make_onos_request("get", f"flows/table/{table_id}")
        return str(flows)
    except Exception as e:
        return f"Error retrieving flows for table {table_id}: {str(e)}"   

@mcp_server.tool(name="get_pending_flows")
async def get_pending_flows() -> str:
    """Gets pending flows that are not yet fully processed.

    Returns a list of pending flows in the network.
    """
    try:
        flows = await make_onos_request("get", "flows/pending")
        return str(flows)
    except Exception as e:
        return f"Error retrieving pending flows: {str(e)}"
    
@mcp_server.tool(name="add_flow")
async def add_flow(device_id: str, priority: int, timeout: int, is_permanent: bool, criteria: List[Dict[str, Any]], instructions: List[Dict[str, Any]]) -> str:
    """Adds a new flow to a device.

    Args:
        device_id: Device identifier
        app_id: Application identifier
        priority: Flow priority
        timeout: Flow timeout in seconds
        is_permanent: Whether the flow is permanent 
        criteria: List of match criteria for the flow (e.g, type, port, etc.)
        instructions: List of instructions for the flow (type, port, group, etc.)

    Returns a confirmation message about the flow addition.
    """
    try:
        flow_data = {
            "priority": priority,
            "timeout": timeout,
            "isPermanent": is_permanent,
            "deviceId": device_id,
            "treatment": {
                "instructions": instructions
            },
            "selector": {
                "criteria": criteria
            }
        }

        await make_onos_request("post", f"flows/{device_id}", data=flow_data)
        return f"Flow added successfully to device {device_id}."
    except Exception as e:
        return f"Error adding flow to device {device_id}: {str(e)}"

@mcp_server.tool(name="add_flows")
async def add_flows(flows: List[Dict[str, Any]]) -> str:
    """Adds multiple flows to the network.

    Args:
        flows: List of flow rules.
        
    Returns a confirmation message about the flows addition.
    """
    try:
        flows_data = {"flows": flows}
        
        await make_onos_request("post", "flows", data=flows_data)
        return "All flows added successfully."
    except Exception as e:
        return f"Error adding flows: {str(e)}"

@mcp_server.tool(name="remove_flow")
async def remove_flow(device_id: str, flow_id: str) -> str:
    """Removes a specific flow from a device.

    Args:
        device_id: Device identifier
        flow_id: Flow identifier
    
    Returns a confirmation message about the flow removal.
    """
    try:
        encoded_device_id = quote(device_id, safe="")
        encoded_flow_id = quote(str(flow_id), safe="")
        await make_onos_request("delete", f"flows/{encoded_device_id}/{encoded_flow_id}")
        return f"Flow {flow_id} removed successfully from device {device_id}."
    except Exception as e:
        return f"Error removing flow {flow_id} from device {device_id}: {str(e)}"

@mcp_server.tool(name="remove_flows")
async def remove_flows(flows: List[Dict[str, Any]]) -> str:
    """Removes multiple flows from the network.

    Args:
        flows: List of flow identifiers to remove.
    
    Returns a confirmation message about the flows removal.
    """
    try:
        flows_data = {"flows": flows}
        
        await make_onos_request("delete", "flows", data=flows_data)
        return "All specified flows removed successfully."
    except Exception as e:
        return f"Error removing flows: {str(e)}"
    
### Application Layer Flow Tasks (SDN Layer 3)
@mcp_server.tool(name="get_app_flows")
async def get_app_flows(app_id: str) -> str:
    """Gets flows for a specific ONOS application (Application layer - Layer 3).

    Args:
        app_id: Application identifier

    Returns a list of flows for the specified ONOS application.
    """
    try:
        flows = await make_onos_request("get", f"flows/application/{app_id}")
        return str(flows)
    except Exception as e:
        return f"Error retrieving flows for application {app_id}: {str(e)}"
    
@mcp_server.tool(name="add_app_flows")
async def add_app_flows(app_id: str, flows: List[Dict[str, Any]]) -> str:
    """Adds multiple flows for a specific ONOS app.

    Args:
        app_id: Application identifier
        flows: List of flow rules
    
    Returns a confirmation message about the flows addition.
    """
    try:
        flows_data = {"flows": flows}
        
        await make_onos_request("post", f"flows/application/{app_id}", data=flows_data)
        return f"Flows added successfully for application {app_id}."
    except Exception as e:
        return f"Error adding flows for application {app_id}: {str(e)}"

@mcp_server.tool(name="remove_app_flows")
async def remove_app_flows(app_id: str, flows: List[Dict[str, Any]]) -> str:
    """Removes multiple flows for a specific ONOS app.

    Args:
        app_id: Application identifier
        flows: List of flow identifiers to remove
    
    Returns a confirmation message about the flows removal.
    """
    try:
        flows_data = {"flows": flows}
        
        await make_onos_request("delete", f"flows/application/{app_id}", data=flows_data)
        return f"Flows removed successfully for application {app_id}."
    except Exception as e:
        return f"Error removing flows for application {app_id}: {str(e)}"