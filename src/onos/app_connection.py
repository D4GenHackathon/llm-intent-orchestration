"""ONOS API Client for network requests."""
import os
import httpx
from typing import Any
from dotenv import load_dotenv

# Load .env with override to take precedence over system env vars
load_dotenv(override=True)

# ONOS Configuration from environment
ONOS_HOST = os.getenv("ONOS_HOST", "localhost")
ONOS_PORT = os.getenv("ONOS_PORT", "8181")
ONOS_USER = os.getenv("ONOS_USER", "onos")
ONOS_PASSWORD = os.getenv("ONOS_PASSWORD", "rocks")

ONOS_BASE_URL = f"http://{ONOS_HOST}:{ONOS_PORT}/onos/v1"
HTTP_TIMEOUT = 30.0  # seconds

from typing import Optional

async def make_onos_request(method: str, service: str, data: Optional[dict[str, Any]] = None) -> dict[str, Any]:
    """Make an async request to ONOS REST API."""
    url = f"{ONOS_BASE_URL}/{service}" # service like "topology", "hosts", etc.
    auth = httpx.BasicAuth(ONOS_USER, ONOS_PASSWORD)
    
    async with httpx.AsyncClient(auth=auth) as client:
        if method.lower() == "get":
            response = await client.get(url, headers={"Accept": "application/json"})
        elif method.lower() == "post":
            response = await client.post(url, headers={"Accept": "application/json", "Content-Type": "application/json"}, json=data)
        elif method.lower() == "delete":
            response = await client.delete(url, headers={"Accept": "application/json"})
        else:
            raise ValueError(f"Unsupported HTTP method: {method}")
        
        response.raise_for_status()
        return response.json() if response.text else {}
