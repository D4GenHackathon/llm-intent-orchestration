from tasks.main import mcp as mcp_server
from src.onos import make_onos_request
from typing import Any, List, Dict, Optional, Union

# Network: Network topology, devices, links, hosts in details.
@mcp_server.tool(name="get_network_summary")
async def get_network_summary() -> str:
    """Get a detailed summary of the network including devices, links, hosts, and topology."""
    try:
        devices_data = await make_onos_request("get", "devices")
        links_data = await make_onos_request("get", "links")
        hosts_data = await make_onos_request("get", "hosts")
        topology_data = await make_onos_request("get", "topology")

        device_count = len(devices_data.get("devices", []))
        link_count = len(links_data.get("links", []))
        host_count = len(hosts_data.get("hosts", []))
        cluster_count = topology_data.get("clusters", 0)

        summary = [
            "# Network Summary",
            f"- Devices: {device_count}",
            f"- Links: {link_count}",
            f"- Hosts: {host_count}",
            f"- Clusters: {cluster_count}",
        ]

        summary.append("\n## Device Details")
        for device in devices_data.get("devices", []):
            device_id = device.get("id")
            status = "Available" if device.get("available") else "Unavailable"
            manufacturer = device.get("mfr", "Unknown")
            hw_version = device.get("hw", "Unknown")
            sw_version = device.get("sw", "Unknown")
            summary.append(
                f"- {device_id}: {status}, Manufacturer: {manufacturer}, HW: {hw_version}, SW: {sw_version}"
            )

        return "\n".join(summary)
    except Exception as e:
        return f"Error retrieving network summary: {str(e)}"


@mcp_server.tool(name="get_network_analysis")
async def get_network_analysis() -> str:
    """Get an analysis of the network including device availability and link status."""
    try:
        # Gather devices, ports, and flows in parallel
        devices_data = await make_onos_request("get", "devices")
        flows_data = await make_onos_request("get", "flows")
        ports_data = await make_onos_request("get", "statistics/ports")
        
        # Calculate device & flow availability
        device_count = len(devices_data.get("devices", []))
        available_devices = sum(1 for d in devices_data.get("devices", []) if d.get("available", False))
        total_flows = sum(len(dev.get("flows", [])) for dev in flows_data.get("flows", []))
        
        # Port status analysis
        port_status = {}
        for port_stat in ports_data.get("statistics", []):
            device_id = port_stat.get("device", "Unknown")
            if device_id not in port_status:
                port_status[device_id] = []
            
            ports = []
            for port in port_stat.get("ports", []):
                port_id = port.get("port")
                bytes_received = port.get("bytesReceived", 0)
                bytes_sent = port.get("bytesSent", 0)
                packets_received = port.get("packetsReceived", 0)
                packets_sent = port.get("packetsSent", 0)
                state = "Up" if port.get("isEnabled", False) else "Down"
            
                ports.append(
                    {
                        "port_id": port_id,
                        "state": state,
                        "bytes_received": bytes_received,
                        "bytes_sent": bytes_sent,
                        "packets_received": packets_received,
                        "packets_sent": packets_sent
                    }
                )
            
            port_status[device_id].extend(ports)
        
        # Calculate device availability percentage
        availability_percentage = (available_devices / device_count * 100) if device_count > 0 else 0
        
        # Calculate flow density (average flows per device)
        flow_density = (total_flows / available_devices * 100) if available_devices > 0 else 0
        
        # Sort devices by traffic volume (bytes sent & received)
        device_traffic = {}
        for device_id, ports in port_status.items():
            total_bytes = sum(port["bytes_received"] + port["bytes_sent"] for port in ports)
            device_traffic[device_id] = total_bytes
        
        sorted_devices = sorted(device_traffic.items(), key=lambda x: x[1], reverse=True)
        
        # Generate analysis report
        analysis = [
            "# Network Analysis",
            f"- Total Devices: {device_count}",
            f"- Available Devices: {available_devices} ({availability_percentage:.2f}%)",
            f"- Total Flows: {total_flows}",
            f"- Flow Density: {flow_density:.2f}%",
            "\n## Device Traffic Analysis (Top 10 by Volume)"
        ]
        
        for device_id, total_bytes in sorted_devices[:10]:
            analysis.append(f"- {device_id}: {total_bytes} bytes")
        
        return "\n".join(analysis)
    except Exception as e:
        return f"Error retrieving network analysis: {str(e)}"