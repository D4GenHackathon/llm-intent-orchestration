"""CrewAI network task wiring and ONOS tool registry."""

from __future__ import annotations

import inspect
from typing import Any, Callable

from crewai import Task

# Import all task modules to register their tools with the shared server
from .network import (
    configuration,
    device,
    diagnostics,
    flow,
    host,
    link,
    meter,
    metric,
    multicast,
    network,
    packet,
    path,
    system,
    topology
)

NETWORK_TOOL_REGISTRY: dict[str, Callable[..., Any]] = {
    "get_network_configuration": configuration.get_network_configuration,
    "upload_network_configuration": configuration.upload_network_configuration,
    "clear_network_configuration": configuration.clear_network_configuration,
    "get_subject_class_configuration": configuration.get_subject_class_configuration,
    "update_subject_class_configuration": configuration.update_subject_class_configuration,
    "get_subject_configuration": configuration.get_subject_configuration,
    "update_subject_configuration": configuration.update_subject_configuration,
    "clear_subject_configuration": configuration.clear_subject_configuration,
    "get_specific_configuration": configuration.get_specific_configuration,
    "update_specific_configuration": configuration.update_specific_configuration,
    "clear_specific_configuration": configuration.clear_specific_configuration,
    "get_devices": device.get_devices,
    "get_device": device.get_device,
    "remove_device": device.remove_device,
    "get_all_device_ports": device.get_all_device_ports,
    "get_device_ports": device.get_device_ports,
    "get_diagnostics": diagnostics.get_diagnostics,
    "run_diagnostic": diagnostics.run_diagnostic,
    "get_flows": flow.get_flows,
    "get_device_flows": flow.get_device_flows,
    "get_device_flow": flow.get_device_flow,
    "get_table_flows": flow.get_table_flows,
    "get_pending_flows": flow.get_pending_flows,
    "add_flow": flow.add_flow,
    "add_flows": flow.add_flows,
    "remove_flow": flow.remove_flow,
    "remove_flows": flow.remove_flows,
    "get_app_flows": flow.get_app_flows,
    "add_app_flows": flow.add_app_flows,
    "remove_app_flows": flow.remove_app_flows,
    "get_hosts": host.get_hosts,
    "get_host": host.get_host,
    "get_host_by_mac_vlan": host.get_host_by_mac_vlan,
    "add_host": host.add_host,
    "remove_host": host.remove_host,
    "get_links": link.get_links,
    "get_link_status": link.get_stale_link_status,
    "set_link_status": link.set_stale_link_status,
    "get_all_meters": meter.get_all_meters,
    "get_device_meters": meter.get_device_meters,
    "get_meter": meter.get_meter,
    "remove_meter": meter.remove_meter,
    "add_meter": meter.add_meter,
    "get_all_metrics": metric.get_all_metrics,
    "get_specific_metric": metric.get_specific_metric,
    "get_multicast_routes": multicast.get_multicast_routes,
    "get_multicast_route": multicast.add_multicast_route,
    "remove_multicast_route": multicast.remove_multicast_route,
    "add_multicast_sink": multicast.add_multicast_sink,
    "get_network_summary": network.get_network_summary,
    "get_network_analysis": network.get_network_analysis,
    "get_packet_processors": packet.get_packet_processors,
    "get_shortest_path": path.get_shortest_path,
    "get_disjoint_paths": path.get_disjoint_paths,
    "get_system_summary": system.get_system_summary,
    "get_topology": topology.get_topology,
    "get_topology_clusters": topology.get_topology_clusters,
    "get_topology_cluster": topology.get_topology_cluster,
    "get_cluster_devices": topology.get_cluster_devices,
    "get_cluster_links": topology.get_cluster_links,
    "get_connection_points": topology.get_connection_points,
    "get_broadcast_domain": topology.get_broadcast_domain,
}


def get_network_tool_registry() -> dict[str, Callable[..., Any]]:
    """Return a copy of the full ONOS network tool registry."""
    return dict(NETWORK_TOOL_REGISTRY)


async def run_network_tool(tool_name: str, **kwargs: Any) -> str:
    """Execute one ONOS tool by name with keyword arguments."""
    tool = NETWORK_TOOL_REGISTRY.get(tool_name)
    if tool is None:
        available = ", ".join(sorted(NETWORK_TOOL_REGISTRY.keys()))
        raise ValueError(f"Unknown tool '{tool_name}'. Available tools: {available}")

    result = tool(**kwargs)
    if inspect.isawaitable(result):
        result = await result
    return str(result)


def network_router(agent, user_query: str | None = None):
    """Network management task for CrewAI execution."""
    available_tools = ", ".join(sorted(NETWORK_TOOL_REGISTRY.keys()))
    query_text = user_query.strip() if isinstance(user_query, str) else ""
    task_description = (
        "Perform network management tasks using ONOS tools. "
        f"Available tools: {available_tools}. "
        f"User request: {query_text or 'Provide an operational network summary and recommended actions.'}"
    )

    return Task(
        description=task_description,
        expected_output=(
            "Network operations response including any ONOS data requested, "
            "applied action summaries, and concise next steps."
        ),
        agent=agent
    )

