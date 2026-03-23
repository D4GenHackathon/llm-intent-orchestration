from tasks.main import mcp as mcp_server
from src.onos import make_onos_request
from typing import Any, List, Dict, Optional, Union

# Device: Network devices such as switches, routers, and hosts, along with their properties and statuses.
@mcp_server.tool(name="get_devices")
async def get_devices() -> str:
    """Gets overview of all devices.

    Returns a summary of all devices in the network.
    """
    try:
        devices = await make_onos_request("get", "devices")
        return str(devices)
    except Exception as e:
        return f"Error retrieving devices: {str(e)}"
    
@mcp_server.tool(name="get_device")
async def get_device(device_id: str) -> str:
    """Gets details of a specific device.

    Args:
        device_id: ID of the device to query

    Returns detailed information about the specified device.
    """
    try:
        device = await make_onos_request("get", f"devices/{device_id}")
        return str(device)
    except Exception as e:
        return f"Error retrieving device {device_id}: {str(e)}"
    
@mcp_server.tool(name="remove_device")
async def remove_device(device_id: str) -> str:
    """Removes a specific device.

    Args:
        device_id: ID of the device to remove

    Returns a confirmation message about the device removal.
    """
    try:
        await make_onos_request("delete", f"devices/{device_id}")
        return f"Device {device_id} removed successfully."
    except Exception as e:
        return f"Error removing device {device_id}: {str(e)}"

@mcp_server.tool(name="get_all_device_ports")
async def get_all_device_ports() -> str:
    """Gets ports of all devices.

    Returns a list of all ports for all devices in the network.
    """
    try:
        ports = await make_onos_request("get", "devices/ports")
        return str(ports)
    except Exception as e:
        return f"Error retrieving ports for all devices: {str(e)}"
    
@mcp_server.tool(name="get_device_ports")
async def get_device_ports(device_id: str) -> str:
    """Gets ports of a specific device.

    Args:
        device_id: ID of the device to query
    
    Returns a list of ports for the specified device.
    """
    try:
        ports = await make_onos_request("get", f"devices/{device_id}/ports")
        return str(ports)
    except Exception as e:
        return f"Error retrieving ports for device {device_id}: {str(e)}"
