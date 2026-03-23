# LLM-Based Intent Orchestration for Medical IoT SDN-enable Environments

## Overview

Modern medical research laboratories are adopting smart environments with diverse IoT devices and services. To ensure secure operations, it is critical to limit access control and authorization between departments within an institution. By leveraging software-defined network (SDN) architecture, this project enables dynamic control over network resources and data flows. 
---

## Quick Setup

### Running with ONOS & Mininet-WiFi (Docker)

```bash
# 1. ONOS controller (Docker) activation
sudo docker start onos<controller_idex> # Start existing ONOS containers
sudo ss -lntp | egrep '|<controller_port_id>|'

# 2. Virtual network stimulation in Mininet-WiFi topology (Docker)
src/mininet/topo_stimulation.sh

# 3. Start Influx Database 
sudo service influxdb start
influx -version
```
> **Note:** See ONOS topology view in http://localhost:8181/onos/ui link, if hosts or links are not visible, press **H** to toggle hosts and **L** to refresh the topology layout. Furthermore, ONOS supports InfluxDB up to 0.10.3. The InfluxDB which has higher version number will not work properly with ONOS.

---
## Basic Flow: From LLM User Intent to ONOS Network Control

### 1. LLM to MCP (Tool Registration)
- Tools are registered in the agent and correspond to network operations, current tools are `topology` (topology overview),
`network` (network summary & configuration), `host` (host details), `ports` (device ports), `links` (link status), `flows` (flow rules and status), `metrics` (QoS metrics), `packet_processors` (packet processors), `multicast` (multicast routes), `diagnostics` (high-level diagnostics),`path` (shortest/disjoint paths between devices/hosts),
`summary` (ONOS system status) with full CRUD (create, read, update and delete) functionality.

WebUI has supported 2 LLMs model (OpenAI, Ollama), implement FastAPIs to retrieve model & chat information, all the API docs in http://localhost:8001/docs#/ with the launching interface in http://localhost:8001 for local version, further deploy in Vercel.

> **Note:** ONOS architecture (Application Layer, Control Layer, Data Layer) follows the **SDN architectural model**, which is conceptually different from the **OSI 7-layer networking model** (Physical, Data Link, Network, Transport, Session, Presentation, Application).

Version: Alpha v1.0.3

See `src/mcp_server/tasks/` for tool implementations. 

### 2. MCP to ONOS (API Layer)
- The MCP server (`src/mcp_server/`) receives tool calls from the agent and maps them to ONOS REST API requests from make_onos_request to call the relevant ONOS API endpoint.

### 3. ONOS REST APIs (Network Control)
- **ONOS REST Endpoint** for SDN control and monitoring all in `http://localhost:8181/onos/v1`, with default credentials `onos / rocks`. All existing service details (**devices**,**hosts**, **topology**, etc) in  `swagger.json` file.

- **ONOS Controller Web UI**: `http://localhost:8181/onos/ui`, with current topology stimulation ![Mininet topology in SDN Controller View](docs/topo/onos-ui.png)

> **Note:** Some tools and API mappings are under development, see more in `src/mcp_server` for tool registration.

### 4. Wireless Mininet Virtual Stimulation (Network Topology)
- **Mininet Configuration** has been defined for clustering topology in `topo_config.yaml`, which then generate wifi virtual network topology by `net_topo.py` file. All the work has been automatically organized in `topo_stimulation.sh` script.

---

## References

1. MCP SDK Integration: [modelcontextprotocol.io/docs/sdk](https://modelcontextprotocol.io/docs/sdk)
2. MCP Learning Resources: [youtu.be/QIOk4XZ5XNU](https://youtu.be/QIOk4XZ5XNU)
3. Integration with FastMCP via [langchain-mcp-adapters](https://github.com/langchain-ai/langchain-mcp-adapters)
4. ONOS MCP Server (Code inspiration):[onos-mcp-server](https://github.com/davidlin2k/onos-mcp-server)
5. Mininet Wifi: [mininet-onos-stimulator](https://mininet-wifi.github.io/commands/)
6. Pipx: [github.com/pypa/pipx](https://github.com/pypa/pipx)
7. Poetry: [python-poetry.org/docs](https://python-poetry.org/docs)
8. ONOS Official Documentation: [onos-guide/docs](https://wiki.onosproject.org/display/ONOS)
---
## Future Work
1. Trang 
- Implement data base, clustering algorithms & test case in clustering features.

2. Massinissa
- Monitoring workflow and implement prototype with Le.