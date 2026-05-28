from src.onos.app_connection import (ONOS_BASE_URL, ONOS_USER, ONOS_PASSWORD, HTTP_TIMEOUT)
from tasks.main import mcp as mcp_server
from src.onos import make_onos_request
from typing import Any, List, Dict, Optional, Union

import httpx
import os
import tempfile
import aiofiles

# Diagnostic tools for ONOS controller (SDN Layer 2)
@mcp_server.tool(name="get_diagnostics")
async def get_diagnostics(file_path: str) -> str:
    """Gets diagnostics information from a file (tar.gz default format in ONOS app).

    Args:
        file_path: Path to the diagnostics file to read, if not exist, a temporary file will be created.
    
    Returns the content of the diagnostics file or an error message if it fails.
    """
    try:
        # Binary read the diagnostics file requiring httpx read
        url = f"{ONOS_BASE_URL}/diagnostics"
        auth = httpx.BasicAuth(ONOS_USER, ONOS_PASSWORD)
        
        async with httpx.AsyncClient(auth=auth, timeout=HTTP_TIMEOUT) as client:
            response = await client.get(url, auth=auth, timeout=HTTP_TIMEOUT)
            response.raise_for_status()  # Raise an error for bad status codes
            
            # Write the binary content to the specified file path
            if not file_path:
                # Create a temporary file if no path is provided
                fd, save_path = tempfile.mkstemp(suffix=".tar.gz", prefix="onos_controller_diagnostics_")
                save_path = os.path.abspath(save_path) # Ensure absolute path
                file_path = save_path
                os.close(fd)
           
            async with aiofiles.open(file_path, "wb") as f:
                await f.write(response.content)
                
            return f"Diagnostics saved to file: {file_path}"
    except Exception as e:
        return f"Error retrieving diagnostics: {str(e)}"
    
@mcp_server.tool(name="run_diagnostic")
async def run_diagnostic(command: str) -> str:
    """Runs a diagnostic command on the ONOS cluster.

    Args:
        command: The diagnostic command to run 
        timeout: Optional timeout for the command in seconds (default: 30)
    
    Returns the output of the diagnostic command or an error message if it fails.
    """
    
    try:
        timeout = HTTP_TIMEOUT  # Default timeout for ONOS requests
        # Prepare the command details
        command_details = {
            "command": command,
            "timeout": timeout
        }
        response = await make_onos_request("post", "diagnostic", data=command_details)
        return str(response)
    except Exception as e:
        return f"Error running diagnostic command '{command}': {str(e)}"