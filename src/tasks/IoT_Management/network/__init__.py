"""
Tasks module for ONOS MCP Server.
Initializes a shared FastMCP server instance and imports all task modules.
"""
from mcp.server.fastmcp import FastMCP
from src.onos.app_connection import make_onos_request
from typing import Any, Dict, List

# Create a single shared FastMCP server instance
mcp_server = FastMCP("ONOS MCP Server")

# Import all task modules to register their tools with the shared server
from . import configuration
from . import device
from . import diagnostics
from . import flow
from . import host
from . import link
from . import meter
from . import metric
from . import multicast
from . import network
from . import packet
from . import path
from . import system
from . import topology
