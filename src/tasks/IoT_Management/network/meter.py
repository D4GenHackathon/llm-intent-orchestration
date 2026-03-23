from tasks.main import mcp as mcp_server
from src.onos import make_onos_request
from typing import Any, List, Dict, Optional, Union

### Meter: Traffic control (bandwidth, packet drop/remark policies, rate limit, burst behavior - meter exceed actions, etc.) 

@mcp_server.tool(name="get_all_meters")
async def get_all_meters() -> str:
    """Gets stats information of all meters.

    Returns array of all information for all meters.
    """
    try:
        meters = await make_onos_request("get", "meters")
        return str(meters)
    except Exception as e:
        return f"Error retrieving all meters: {str(e)}"

@mcp_server.tool(name="get_device_meters")
async def get_device_meters(device_id: str) -> str:
    """Gets stats information of all meters for a specific device.

    Args:
        device_id: Device identifier

    Returns array of all information for all meters of the specified device.
    """
    try:
        meters = await make_onos_request("get", f"meters/{device_id}")
        return str(meters)
    except Exception as e:
        return f"Error retrieving meters for device {device_id}: {str(e)}"
    
@mcp_server.tool(name="get_meter")
async def get_meter(device_id: str, meter_id: str) -> str:
    """Gets stats information of a specific meter.

    Args:
        device_id: Device identifier
        meter_id: Meter identifier

    Returns array of all information for the specified meter.
    """
    try:
        meter = await make_onos_request("get", f"meters/{device_id}/{meter_id}")
        return str(meter)
    except Exception as e:
        return f"Error retrieving meter {meter_id} for device {device_id}: {str(e)}"

@mcp_server.tool(name="remove_meter")
async def remove_meter(device_id: str, meter_id: str) -> str:
    """Removes a specific meter.

    Args:
        device_id: Device identifier
        meter_id: Meter identifier

    Returns a confirmation message about the meter removal.
    """
    try:
        await make_onos_request("delete", f"meters/{device_id}/{meter_id}")
        return f"Meter {meter_id} on device {device_id} removed successfully."
    except Exception as e:
        return f"Error removing meter {meter_id} on device {device_id}: {str(e)}"

@mcp_server.tool(name="add_meter")
async def add_meter(device_id: str, app_id: str, unit: str, burst: bool, bands: List[Dict[str, Any]]) -> str:
    """Adds a new meter to a device.

    Args:
        device_id: Device identifier
        app_id: Application identifier for the meter
        unit: Unit of measurement for the meter (e.g., "KBPS", "PKTPS")
        burst: Whether the meter should use burst behavior
        bands: List of band specifications for the meter (e.g., rate, burst size, actions)
    """
    try:
        meter_data = {
            "deviceId": device_id,
            "appId": app_id,
            "unit": unit,
            "burst": burst,
            "bands": bands
        }
        await make_onos_request("post", f"meters/{device_id}", meter_data)
        return f"Meter added successfully to device {device_id}."
    except Exception as e:
        return f"Error adding meter to device {device_id}: {str(e)}"
    
