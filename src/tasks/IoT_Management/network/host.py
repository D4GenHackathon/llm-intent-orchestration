from tasks.main import mcp as mcp_server
from src.onos import make_onos_request
from typing import Any, List, Dict, Optional, Union

# Host: End-station hosts connected to the network (e.g., computers, phones, IoT devices)
@mcp_server.tool(name="get_hosts")
async def get_hosts() -> str:
    """Get all end-station hosts.

    Returns array of all known end-station hosts.
    """
    try:
        hosts = await make_onos_request("get", "hosts")
        return str(hosts)
    except Exception as e:
        return f"Error retrieving hosts: {str(e)}"


@mcp_server.tool(name="get_host")
async def get_host(host_id: str) -> str:
    """Get details of a specific end-station host.

    Args:
        host_id: Host identifier

    Returns detailed properties of the specified end-station host.
    """
    try:
        host = await make_onos_request("get", f"hosts/{host_id}")
        return str(host)
    except Exception as e:
        return f"Error retrieving host {host_id}: {str(e)}"

@mcp_server.tool(name="get_host_by_mac_vlan")
async def get_host_by_mac_vlan(mac: str, vlan: str) -> str:
    """Get details of end-station host with MAC/VLAN.

    Args:
        mac: Host MAC address
        vlan: Host VLAN identifier

    Returns detailed properties of the specified end-station host.
    """
    try:
        host = await make_onos_request("get", f"hosts/{mac}/{vlan}")
        return str(host)
    except Exception as e:
        return f"Error retrieving host with MAC {mac} and VLAN {vlan}: {str(e)}"

@mcp_server.tool(name="add_host")
async def add_host(
    mac: str, vlan: str, ip_addresses: List[str], locations: List[Dict[str, Any]]
) -> str:
    """Create a new host and add it to the host inventory.

    Args:
        mac: MAC address of the host (format: xx:xx:xx:xx:xx:xx)
        vlan: VLAN ID (use "-1" for none)
        ip_addresses: List of IP addresses for the host
        locations: List of locations where the host is connected
                  Each location should have 'elementId' (device ID) and 'port' (port number)

    Creates a new host based on provided information and adds it to the current host inventory.
    """
    try:
        host_data = {
            "mac": mac,
            "vlan": vlan,
            "ipAddresses": ip_addresses,
            "locations": locations,
        }

        result = await make_onos_request("post", "hosts", data=host_data)
        return f"Host added successfully: {result}"
    except Exception as e:
        return f"Error adding host: {str(e)}"


@mcp_server.tool(name="remove_host")
async def remove_host(mac: str, vlan: str) -> str:
    """Remove a host from the inventory.

    Args:
        mac: Host MAC address
        vlan: Host VLAN identifier

    Administratively deletes the specified host from the inventory of known hosts.
    """
    try:
        await make_onos_request("delete", f"hosts/{mac}/{vlan}")
        return f"Host with MAC {mac} and VLAN {vlan} removed successfully"
    except Exception as e:
        return f"Error removing host with MAC {mac} and VLAN {vlan}: {str(e)}"

