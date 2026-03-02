"""ONOS Network Tools for MCP Server."""
from onos.api_client import make_onos_request


async def get_network_summary() -> str:
    """Get a high-level summary of the network including devices, links, and hosts."""
    try:
        devices_data = await make_onos_request("get", "/devices")
        links_data = await make_onos_request("get", "/links")
        hosts_data = await make_onos_request("get", "/hosts")
        topology_data = await make_onos_request("get", "/topology")

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


async def get_network_analytics() -> str:
    """Get analytics about network performance, utilization and health."""
    try:
        stats = await make_onos_request("get", "/statistics/ports")
        flows = await make_onos_request("get", "/flows")
        devices = await make_onos_request("get", "/devices")

        device_count = len(devices.get("devices", []))
        active_devices = sum(1 for d in devices.get("devices", []) if d.get("available", False))
        total_flows = sum(len(dev.get("flows", [])) for dev in flows.get("flows", []))

        port_stats = {}
        for stat in stats.get("statistics", []):
            device_id = stat.get("device", "")
            ports = []
            for port in stat.get("ports", []):
                ports.append({
                    "port": port.get("port", ""),
                    "bytesReceived": port.get("bytesReceived", 0),
                    "bytesSent": port.get("bytesSent", 0),
                    "packetsReceived": port.get("packetsReceived", 0),
                    "packetsSent": port.get("packetsSent", 0),
                })
            port_stats[device_id] = ports

        result = [
            "# Network Analytics",
            "## Overview",
            f"- Total Devices: {device_count}",
            f"- Active Devices: {active_devices}",
        ]

        availability_pct = f"{active_devices / device_count * 100:.1f}%" if device_count > 0 else "N/A"
        result.append(f"- Device Availability: {availability_pct}")
        result.append(f"- Total Flow Rules: {total_flows}")

        avg_flows = f"{total_flows / active_devices:.1f}" if active_devices > 0 else "N/A"
        result.append(f"- Avg. Flow Rules per Device: {avg_flows}")

        result.append("\n## Port Statistics (Top 5 Devices)")
        device_traffic = {
            device_id: sum(p.get("bytesReceived", 0) + p.get("bytesSent", 0) for p in ports)
            for device_id, ports in port_stats.items()
        }

        top_devices = sorted(device_traffic.items(), key=lambda x: x[1], reverse=True)[:5]
        for device_id, traffic in top_devices:
            result.append(f"\n### Device {device_id}")
            result.append(f"- Total Traffic: {traffic} bytes")

            ports = sorted(
                port_stats.get(device_id, []),
                key=lambda p: p.get("bytesReceived", 0) + p.get("bytesSent", 0),
                reverse=True,
            )[:3]

            result.append("#### Busiest Ports:")
            for port in ports:
                bytes_total = port.get("bytesReceived", 0) + port.get("bytesSent", 0)
                packets_total = port.get("packetsReceived", 0) + port.get("packetsSent", 0)
                result.append(f"- Port {port.get('port', '')}: {bytes_total} bytes, {packets_total} packets")

        return "\n".join(result)
    except Exception as e:
        return f"Error retrieving network analytics: {str(e)}"
