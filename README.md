# LLM-Based Intent Orchestration for Medical IoT Environments

## Overview

Modern medical research laboratories increasingly integrate smart workspace environments with diverse IoT devices and services. However, clinicians, nurses, and researchers—typically non-IT specialists—require intuitive mechanisms to express their operational intents without manual device configuration. LLMs offer promising capabilities in reasoning, planning, and task orchestration, enabling seamless automation of data retrieval, analysis, and workflow execution. This repository represent the within-institutional management of medical IOT devices to build the complete secure and automated smart environment for the solution presented in our work for [D4Gen Hackathon Presentation](https://docs.google.com/presentation/d/1dIFfxO6JmQFQiGihexDT0RxHEQ_-1zaR/edit?slide=id.p1#slide=id.p1).

![Data Auto-Collection in IOT Smart Healthcare Systems](docs/general-architecture/architecture.png)

## Application Scenarios

### Scenario 1: In-Hospital Clinical Decision Support
AI-assisted diagnostic recommendations leveraging historical and real-time patient records from sensor/actuator data collection systems. Healthcare professionals retain final decision authority to validate and correct potential errors.

### Scenario 2: Smart Hospital BioIOT Management 
Camera-based monitoring systems detect resident falls, autonomous medical IOT sensors/actuators management, enhancing safety, performance, energy-awareness while reducing staff workload.

## Product Prototype Version

| Version | Type | Features | Scenario| Video Demo |
|---|---|---|---|---|
| Alpha v1.0.1 | Initial Alpha | Application interface, dashboard functionality| Scenario 2 | [▶ Basic Function View](docs/demo/alpha101.webm) | 
| Alpha v1.0.2 | Alpha Update | RAG model for medication prediction | Scenario 1 | [▶ Network Function Demo View](docs/demo/alpha102.mp4) |
| Alpha v1.0.3 | Alpha Update | Generative AI for network management | Scenario 2 | [▶ Network Function Demo View](docs/demo/alpha103.webm) |
| Alpha v1.0.4 | Alpha Update | Full web application functionalities | All scenarios |Upcomming (Hackathon Day) | 

---

## Quick Setup

### Prerequisites
- Install pipx: [github.com/pypa/pipx](https://github.com/pypa/pipx)
- Install Poetry: [python-poetry.org/docs](https://python-poetry.org/docs)

### Installation
```bash
# Verify Poetry installation
poetry --version

# Install dependencies
poetry install --no-root

# Check virtual environment
poetry env list

# Activate environment (Poetry 2.x)
source $(poetry env info --path)/bin/activate

# Or for Poetry 1.x
poetry shell



```

---

## Project Structure

```
llm-intent-orchestration/
├── src/
│   ├── main.py              # CLI entry point in FastMCP server with menu interface
│   ├── crew.py              # Multi-agent orchestration
│   ├── agents/
│   │   └── agents.py        # LLM Agent logic (Gemini LLM)
│   └── tasks/               # Task router 
├── configs/                 # Configuration files
├── tests/                   # Unit tests
├── docs/                    # Documentation
├── tools/                   # Tools
├── data/                    # Data
└── .env                     # Environment variables (GEMINI_API_KEY)
```

### Running the Application

```bash
# Backend Functionality
poetry run uvicorn src.main:app --host 0.0.0.0 --port 8001

# Fontend Appearance
cd src/ui && pnpm dev
```

---

## References

1. MCP SDK Integration: [modelcontextprotocol.io/docs/sdk](https://modelcontextprotocol.io/docs/sdk)
2. CrewAI Task Automation: [docs.crewai.com/en/mcp/overview](https://docs.crewai.com/en/mcp/overview)
3. CrewAI Tutorial: [youtu.be/sPzc6hMg7So](https://www.youtube.com/watch?v=sPzc6hMg7So)
4. MCP Learning Resources: [youtu.be/QIOk4XZ5XNU](https://youtu.be/QIOk4XZ5XNU)
5. CrewAI + FastMCP: [github.com/ashishpatel26/Crewai-MCP-Course](https://github.com/ashishpatel26/Crewai-MCP-Course)
6. Integration with FastMCP via [langchain-mcp-adapters](https://github.com/langchain-ai/langchain-mcp-adapters)
7. ONOS MCP Server (Code inspiration):[onos-mcp-server](https://github.com/MCP-Mirror/davidlin2k_onos-mcp-server)