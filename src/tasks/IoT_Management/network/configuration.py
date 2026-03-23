from tasks.main import mcp as mcp_server
from src.onos import make_onos_request
from typing import Any, List, Dict, Optional, Union

# Configuration: Network and system configuration details (e.g., device configurations, flow rules, network policies)
@mcp_server.tool(name="get_network_configuration")
async def get_network_configuration() -> str:
    """Gets current network configuration.

    Returns a summary of the current network configuration.
    """
    try:
        config = await make_onos_request("get", "network/configuration")
        return str(config)
    except Exception as e:
        return f"Error retrieving network configuration: {str(e)}"

@mcp_server.tool(name="upload_network_configuration")
async def upload_network_configuration(config_data: Dict[str, Any]) -> str:
    """Uploads new network configuration (bulk data: dictionary format).

    Args:
        config_data: Network configuration dictionary.
        
    Returns a message indicating success or failure of the upload operation.
    """
    try:
        response = await make_onos_request("post", "network/configuration", data=config_data)
        return f"Network configuration uploaded successfully: {response}"
    except Exception as e:
        return f"Error uploading network configuration: {str(e)}"
    
@mcp_server.tool(name="clear_network_configuration")
async def clear_network_configuration() -> str:
    """Clears all network configuration.

    Returns a message indicating success or failure of the clear operation.
    """
    try:
        await make_onos_request("delete", "network/configuration")
        return "Network configuration cleared successfully."
    except Exception as e:
        return f"Error clearing network configuration: {str(e)}"

@mcp_server.tool(name="get_subject_class_configuration")
async def get_subject_class_configuration(subject_class: str) -> str:
    """Gets configuration for a specific subject class.

    Args:
        subject_class: Subject class (e.g., "devices", "hosts", "links")

    Returns the configuration details for the specified subject class.
    """
    try:
        config = await make_onos_request("get", f"network/configuration/{subject_class}")
        return str(config)
    except Exception as e:
        return f"Error retrieving configuration for {subject_class}: {str(e)}"
    
@mcp_server.tool(name="update_subject_class_configuration")
async def update_subject_class_configuration(subject_class: str, config_data: Dict[str, Any]) -> str:
    """Updates configuration for a specific subject class.

    Args:
        subject_class: Subject class
        config_data: New configuration data for this subject class. 

    Returns a message indicating success or failure of the update operation.
    """
    try:
        response = await make_onos_request("put", f"network/configuration/{subject_class}", data=config_data)
        return f"Configuration for {subject_class} updated successfully: {response}"
    except Exception as e:
        return f"Error updating configuration for {subject_class}: {str(e)}"

@mcp_server.tool(name="get_subject_configuration")
async def get_subject_configuration(subject_class: str, subject: str) -> str:
    """Gets configuration for a specific subject class.

    Args:
        subject_class: Subject class
        subject: Specific subject within the class (e.g., device ID, host ID, link ID)
        
    Returns the configuration details for the specified subject class.
    """
    try:
        config = await make_onos_request("get", f"network/configuration/{subject_class}/{subject}")
        return str(config)
    except Exception as e:
        return f"Error retrieving configuration for {subject} in {subject_class}: {str(e)}"
    
@mcp_server.tool(name="update_subject_configuration")
async def update_subject_configuration(subject_class: str, subject: str, config_data: Dict[str, Any]) -> str:
    """Updates configuration for a specific subject class.

    Args:
        subject_class: Subject class 
        subject: Specific subject within the class 
        config_data: New configuration data for this subject.      
    
    Returns a message indicating success or failure of the update operation.
    """
    try:
        response = await make_onos_request("post", f"network/configuration/{subject_class}/{subject}", data=config_data)
        return f"Configuration for {subject} in {subject_class} updated successfully: {response}"
    except Exception as e:
        return f"Error updating configuration for {subject} in {subject_class}: {str(e)}"
    
@mcp_server.tool(name="clear_subject_configuration")
async def clear_subject_configuration(subject_class: str, subject: str) -> str:
    """Clears configuration for a specific subject class.

    Args:
        subject_class: Subject class
        subject: Specific subject within the class 
        
    Returns a message indicating success or failure of the clear operation.
    """
    try:
        await make_onos_request("delete", f"network/configuration/{subject_class}/{subject}")
        return f"Configuration for {subject} in {subject_class} cleared successfully."
    except Exception as e:
        return f"Error clearing configuration for {subject} in {subject_class}: {str(e)}"
    
@mcp_server.tool(name="get_specific_configuration")
async def get_specific_configuration(subject_class: str, subject: str, config: str) -> str:
    """Gets specific configuration for a specific subject in a subject class.

    Args:
        subject_class: Subject class.
        subject: Specific subject within the class. 
        config: Specific configuration item (e.g., "basic", "advanced", "status").
        
    Returns the specific configuration details for the specified subject class.
    """
    try:
        config_details = await make_onos_request("get", f"network/configuration/{subject_class}/{subject}/{config}")
        return str(config_details)
    except Exception as e:
        return f"Error retrieving {config} configuration for {subject} in {subject_class}: {str(e)}"

@mcp_server.tool(name="update_specific_configuration")
async def update_specific_configuration(subject_class: str, subject: str, config: str, config_data: Dict[str, Any]) -> str:
    """Updates specific configuration for a specific subject in a subject class.

    Args:
        subject_class: Subject class.
        subject: Specific subject within the class.
        config: Specific configuration item.
        config_data: New configuration data for this specific configuration item.
    
    Returns a message indicating of the update operation.
    """
    try:
        response = await make_onos_request("post", f"network/configuration/{subject_class}/{subject}/{config}", data=config_data)
        return f"{config} configuration for {subject} in {subject_class} updated successfully: {response}"
    except Exception as e:
        return f"Error updating {config} configuration for {subject} in {subject_class}: {str(e)}"

@mcp_server.tool(name="clear_specific_configuration")
async def clear_specific_configuration(subject_class: str, subject: str, config: str) -> str:
    """Clears specific configuration for a specific subject in a subject class.

    Args:
        subject_class: Subject class.
        subject: Specific subject within the class.
        config: Specific configuration item.
        
    Returns a message indicating of the clear operation.
    """
    try:
        await make_onos_request("delete", f"network/configuration/{subject_class}/{subject}/{config}")
        return f"{config} configuration for {subject} in {subject_class} cleared successfully."
    except Exception as e:
        return f"Error clearing {config} configuration for {subject} in {subject_class}: {str(e)}"
    