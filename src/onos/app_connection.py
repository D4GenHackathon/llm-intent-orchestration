"""ONOS API Client for network requests."""
import os
import httpx
from typing import Any

# ONOS Configuration from environment
ONOS_HOST = os.getenv("ONOS_HOST", "localhost")
ONOS_PORT = os.getenv("ONOS_PORT", "8181")
ONOS_USER = os.getenv("ONOS_USER", "onos")
ONOS_PASSWORD = os.getenv("ONOS_PASSWORD", "rocks")

BASE_URL = f"http://{ONOS_HOST}:{ONOS_PORT}/onos/v1"


async def make_onos_request(method: str, endpoint: str, data: dict = None) -> dict[str, Any]:
    """Make an async request to ONOS REST API."""
    url = f"{BASE_URL}{endpoint}"
    auth = (ONOS_USER, ONOS_PASSWORD)
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    
    async with httpx.AsyncClient() as client:
        if method.lower() == "get":
            response = await client.get(url, auth=auth, headers=headers)
        elif method.lower() == "post":
            response = await client.post(url, auth=auth, headers=headers, json=data)
        elif method.lower() == "delete":
            response = await client.delete(url, auth=auth, headers=headers)
        else:
            raise ValueError(f"Unsupported HTTP method: {method}")
        
        response.raise_for_status()
        return response.json() if response.text else {}
