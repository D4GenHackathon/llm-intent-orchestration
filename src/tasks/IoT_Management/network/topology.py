from src.main import mcp as mcp_server
from src.onos import make_onos_request
from typing import Any, List, Dict, Optional, Union

# Topology: Network topology and structure (e.g., clusters, links, connection points, broadcast domains)
@mcp_server.tool(name="get_topology")
async def get_topology() -> str:
    """Gets overview of current topology.

    Returns a summary of the current network topology.
    """
    try:
        topology = await make_onos_request("get", "topology")
        return str(topology)
    except Exception as e:
        return f"Error retrieving topology: {str(e)}"

@mcp_server.tool(name="get_topology_clusters")
async def get_topology_clusters() -> str:
    """Gets overview of topology clusters.

    Returns a summary of the current network topology clusters.
    """
    try:
        clusters = await make_onos_request("get", "topology/clusters")
        return str(clusters)
    except Exception as e:
        return f"Error retrieving topology clusters: {str(e)}"
    
@mcp_server.tool(name="get_topology_cluster")
async def get_topology_cluster(cluster_id: str) -> str:
    """Gets details of a specific topology cluster.

    Args:
        cluster_id: ID of the cluster to query

    Returns detailed information about the specified topology cluster.
    """
    try:
        cluster = await make_onos_request("get", f"topology/clusters/{cluster_id}")
        return str(cluster)
    except Exception as e:
        return f"Error retrieving topology cluster {cluster_id}: {str(e)}"
    
@mcp_server.tool(name="get_cluster_devices")
async def get_cluster_devices(cluster_id: str) -> str:
    """Gets devices in a specific topology cluster.

    Args:
        cluster_id: ID of the cluster to query
    
    Returns a list of devices in the specified topology cluster.
    """
    try:
        devices = await make_onos_request("get", f"topology/clusters/{cluster_id}/devices")
        return str(devices)
    except Exception as e:
        return f"Error retrieving devices for cluster {cluster_id}: {str(e)}"

@mcp_server.tool(name="get_cluster_links")
async def get_cluster_links(cluster_id: str) -> str:
    """Gets links in a specific topology cluster.

    Args:
        cluster_id: ID of the cluster to query 
    
    Returns a list of wireless links in the specified topology cluster.
    """
    try:
        links = await make_onos_request("get", f"topology/clusters/{cluster_id}/links")
        return str(links)
    except Exception as e:
        return f"Error retrieving links for cluster {cluster_id}: {str(e)}"
    
@mcp_server.tool(name="get_connection_points")
async def get_connection_points(connect_point_id: str) -> str:
    """Gets details of a specific connection point to other network elements (OpenFlow instances) or edge devices.

    Args:
        connect_point_id: ID of the connection point to query

    Returns detailed information about the specified connection point.
    """
    try:
        connect_point = await make_onos_request("get", f"topology/infrastructure/{connect_point_id}")
        return str(connect_point)
    except Exception as e:
        return f"Error retrieving connection point {connect_point_id}: {str(e)}"
    
@mcp_server.tool(name="get_broadcast_domain")
async def get_broadcast_domain(connection_point_id: str) -> str:
    """Gets details whether a specific connection point is part of a broadcast domain.

    Args:
        connection_point_id: ID of the connection point to query

    Returns detailed information about the broadcast domain for the specified connection point.
    """
    try:
        broadcast_domain = await make_onos_request("get", f"topology/broadcast/{connection_point_id}")
        return str(broadcast_domain)
    except Exception as e:
        return f"Error retrieving broadcast domain for connection point {connection_point_id}: {str(e)}"