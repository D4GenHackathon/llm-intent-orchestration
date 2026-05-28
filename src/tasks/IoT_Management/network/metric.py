from tasks.main import mcp as mcp_server
from src.onos import make_onos_request
from typing import Any, List, Dict, Optional, Union

# Metrics: Performance and usage statistics (e.g., CPU, memory, network, application-specific metrics)

@mcp_server.tool(name="get_all_metrics")
async def get_all_metrics() -> str:
    """Gets stats information of all metrics.

    Returns array of all information for all metrics.
    """
    try:
        metrics = await make_onos_request("get", "metrics")
        return str(metrics)
    except Exception as e:
        return f"Error retrieving all metrics: {str(e)}"


@mcp_server.tool(name="get_specific_metric")
async def get_specific_metric(metric_name: str) -> str:
    """Gets stats information of a specific metric.

    Args:
        metric_name: Name of the metric to query

    Returns array of all information for the specified metric.
    """
    try:
        metric = await make_onos_request("get", f"metrics/{metric_name}")
        return str(metric)
    except Exception as e:
        return f"Error retrieving metric {metric_name}: {str(e)}"



