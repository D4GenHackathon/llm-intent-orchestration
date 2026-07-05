<div align="center">

# 🏥 HOPPERS — AIoT Smart Healthcare Ecosystem

### *Healthcare-Oriented Privacy-Preserving Platform for Electronic Health Record Reliable Sharing*

[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.133-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-15-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org)
[![CrewAI](https://img.shields.io/badge/CrewAI-1.10-FF4B4B?style=for-the-badge)](https://crewai.com)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)
[![D4Gen 2026](https://img.shields.io/badge/D4Gen%202026-Hackathon-purple?style=for-the-badge)](https://docs.google.com/presentation/d/1dIFfxO6JmQFQiGihexDT0RxHEQ_-1zaR/edit?slide=id.p1#slide=id.p1)

<br/>

**LLM-powered intent orchestration for autonomous medical IoT device management**  
*Université Évry Paris-Saclay · Laboratoire IBISC (EA 4526)*

<br/>

[📖 Documentation](#-project-structure) · [🚀 Quick Start](#-quick-setup) · [🎬 Demos](#-product-versions--demos) · [🏗️ Architecture](#️-system-architecture)

</div>

---

## 🌟 Overview

Modern medical research laboratories increasingly integrate smart workspace environments with diverse IoT devices and services. However, clinicians, nurses, and researchers — typically non-IT specialists — require intuitive mechanisms to express their operational intents **without manual device configuration**.

This repository is the **AIoT subsystem** of the HOPPERS platform, enabling within-institutional management of medical IoT devices through LLM-driven intent orchestration, building a fully automated and secure smart hospital environment.

> 📽️ **[View D4Gen Hackathon Presentation](https://docs.google.com/presentation/d/1dIFfxO6JmQFQiGihexDT0RxHEQ_-1zaR/edit?slide=id.p1#slide=id.p1)**

![Data Auto-Collection in IoT Smart Healthcare Systems](docs/general-architecture/architecture.png)

---

## ✨ Key Capabilities

<table>
<tr>
<td width="50%">

**🤖 LLM Intent Orchestration**
- Multi-agent CrewAI pipeline (Gemini LLM)
- Natural language → automated device control
- FastMCP server for tool integration

</td>
<td width="50%">

**📡 AIoT Device Management**
- ESP32-based medical sensor simulation
- Real-time ECG, temperature monitoring
- TinyLLM edge inference for alerts

</td>
</tr>
<tr>
<td width="50%">

**🧠 Clinical Decision Support**
- RAG model for medication prediction
- Patient diagnosis assistance
- Historical & real-time EHR analysis

</td>
<td width="50%">

**🌐 SDN Network Orchestration**
- Mininet-WiFi hospital network simulation
- ONOS controller (Layer 3 flow management)
- Programmable data flow control

</td>
</tr>
</table>

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    HOPPERS — AIoT Layer                      │
│                                                             │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐    │
│  │  ESP32 / IoT │   │  TinyLLM     │   │  RAG Model   │    │
│  │  Sensors     │──▶│  Edge Alerts │   │  Diagnosis   │    │
│  │  (ECG, Temp) │   │              │   │  Support     │    │
│  └──────┬───────┘   └──────────────┘   └──────────────┘    │
│         │                                                    │
│  ┌──────▼───────────────────────────────────────────────┐   │
│  │              Mininet-WiFi + ONOS SDN                  │   │
│  │          Hospital Network Orchestration               │   │
│  └──────────────────────┬────────────────────────────────┘   │
│                         │                                    │
│  ┌──────────────────────▼────────────────────────────────┐   │
│  │        FastAPI Backend  +  FastMCP Server             │   │
│  │      CrewAI Multi-Agent Orchestration (Gemini)        │   │
│  └──────────────────────┬────────────────────────────────┘   │
│                         │                                    │
│  ┌──────────────────────▼────────────────────────────────┐   │
│  │              Next.js Web Dashboard                    │   │
│  │         Real-time monitoring & control UI             │   │
│  └───────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎬 Product Versions & Demos

| Version | Type | Features | Scenario | Demo |
|:-------:|:----:|----------|:--------:|:----:|
| **Alpha v1.0.1** | 🔵 Initial | Application interface, dashboard | Scenario 2 | [▶ Basic View](docs/demo/alpha101.webm) |
| **Alpha v1.0.2** | 🟡 Update | RAG model for medication prediction | Scenario 1 | [▶ RAG Demo](docs/demo/alpha102.mp4) |
| **Alpha v1.0.3** | 🟡 Update | Generative AI for network management | Scenario 2 | [▶ Network Demo](docs/demo/alpha103.webm) |
| **Alpha v1.0.4** | 🟢 **Latest** | Full web application functionalities | All scenarios | [▶ Full Functionality View](https://www.youtube.com/watch?v=25nDVT_wcZk) |

---

## 🏥 Application Scenarios

### Scenario 1 — In-Hospital Clinical Decision Support

AI-assisted diagnostic recommendations leveraging historical and real-time patient records from sensor/actuator data collection. Healthcare professionals **retain final decision authority** to validate and correct potential errors.

> [!NOTE]
> The RAG model is trained on public medical datasets (Kaggle) and is intended for research/prototype purposes only — not for clinical deployment.

### Scenario 2 — Smart Hospital BioIoT Management

Camera-based monitoring systems detect resident falls, autonomous medical IoT sensors/actuators management, enhancing **safety, energy-awareness, and performance** while reducing staff workload.

> [!TIP]
> The SDN layer (Mininet-WiFi + ONOS) enables dynamic, programmable hospital network management — isolating device traffic, prioritising critical data flows, and adapting to real-time conditions.

---

## 🚀 Quick Setup

### Prerequisites

> [!IMPORTANT]
> Python **3.12.x** is required (Poetry enforces `>=3.12.0,<3.13`).

- Install **pipx**: [github.com/pypa/pipx](https://github.com/pypa/pipx)
- Install **Poetry**: [python-poetry.org/docs](https://python-poetry.org/docs)
- Install **pnpm**: [pnpm.io/installation](https://pnpm.io/installation)
- Install **Node.js 18+**: [nodejs.org](https://nodejs.org)

### Backend Installation

```bash
# Verify Poetry installation
poetry --version

# Install Python dependencies
poetry install --no-root

# Check virtual environment
poetry env list

# Activate environment (Poetry 2.x)
source $(poetry env info --path)/bin/activate

# Or for Poetry 1.x
poetry shell
```

### Environment Configuration

```bash
# Copy and fill in your API keys
cp .env.template .env
# Required: GEMINI_API_KEY=<your-google-gemini-api-key>
```

> [!WARNING]
> Never commit your `.env` file. It is already listed in `.gitignore`.

### Running the Application

```bash
# Start the FastAPI backend + MCP server
poetry run uvicorn src.main:app --host 0.0.0.0 --port 8001

# In a separate terminal — start the Next.js frontend
cd src/ui && pnpm install && pnpm dev
```

The dashboard will be available at **http://localhost:3000**.

---

## 📁 Project Structure

```
llm-intent-orchestration/
├── src/
│   ├── main.py              # FastAPI + FastMCP entry point
│   ├── crew.py              # Multi-agent CrewAI orchestration
│   ├── agents/
│   │   ├── agents.py        # LLM agent logic (Gemini)
│   │   └── prompts/         # System prompt templates
│   ├── tasks/               # Intent routing & task definitions
│   ├── api/                 # REST API routes
│   ├── services/            # Business logic layer
│   ├── repositories/        # Data access layer
│   ├── schemas/             # Pydantic models
│   ├── db/                  # Database configuration
│   ├── mininet/             # Mininet-WiFi SDN simulation
│   ├── onos/                # ONOS SDN controller integration
│   ├── router/              # FastAPI router definitions
│   └── ui/                  # Next.js web dashboard
│       ├── src/             # Frontend source
│       └── prisma/          # Database schema
├── data/                    # Medical datasets (Kaggle)
├── docs/
│   ├── general-architecture/ # Architecture diagrams
│   ├── demo/                # Demo video recordings
│   └── medical/             # Medical reference docs
├── models/                  # ML model artefacts
├── tests/                   # Unit & integration tests
├── tools/                   # Utility helpers
├── scripts/                 # Automation scripts
├── pyproject.toml           # Python dependencies (Poetry)
├── package.json             # Node dependencies
└── .env.template            # Environment variable template
```

---

## 🧰 Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **LLM Backbone** | Google Gemini | Natural language intent parsing |
| **Agent Framework** | CrewAI 1.10 + LangGraph | Multi-agent orchestration |
| **MCP Server** | FastMCP | Tool integration protocol |
| **Backend API** | FastAPI + Uvicorn | REST API & WebSocket server |
| **Frontend** | Next.js + Tailwind CSS | Real-time dashboard |
| **SDN Controller** | ONOS | Hospital network management |
| **Network Simulation** | Mininet-WiFi | Wireless hospital topology |
| **Edge AI** | TinyLLM | On-device sensor monitoring |
| **RAG Pipeline** | LangChain + Gemini | Clinical decision support |
| **Time-series DB** | InfluxDB | Sensor data storage |
| **ORM** | Prisma | Relational data access |

---

## 👥 Team

| Name | Role | Institution |
|------|------|------------|
| **Huyen-Trang Le** | Team Leader · AIoT & LLM | IBISC, Université Évry Paris-Saclay |
| **Nguyen-Huong-Giang Le** | Backend & Integration | IBISC, Université Évry Paris-Saclay |
| **Massinissa Hamidi** | SDN & Network Simulation | IBISC, Université Évry Paris-Saclay |

> [!NOTE]
> This project was developed for **D4Gen 2026 Hackathon** — Smart Healthcare Ecosystem challenge, hosted by Genopole / Agorize. It is also part of ongoing research at the Paris-Saclay innovation ecosystem toward an ESORICS publication.

---

## 📚 References

1. **MCP SDK**: [modelcontextprotocol.io/docs/sdk](https://modelcontextprotocol.io/docs/sdk)
2. **CrewAI MCP**: [docs.crewai.com/en/mcp/overview](https://docs.crewai.com/en/mcp/overview)
3. **CrewAI Tutorial**: [youtu.be/sPzc6hMg7So](https://www.youtube.com/watch?v=sPzc6hMg7So)
4. **MCP Learning**: [youtu.be/QIOk4XZ5XNU](https://youtu.be/QIOk4XZ5XNU)
5. **CrewAI + FastMCP**: [github.com/ashishpatel26/Crewai-MCP-Course](https://github.com/ashishpatel26/Crewai-MCP-Course)
6. **LangChain MCP Adapters**: [langchain-mcp-adapters](https://github.com/langchain-ai/langchain-mcp-adapters)
7. **ONOS MCP Server** *(inspiration)*: [onos-mcp-server](https://github.com/MCP-Mirror/davidlin2k_onos-mcp-server)
8. Njah et al., *"Toward intent-based network automation for smart environments: A healthcare 4.0 use case"*, IEEE Access, 2023.
9. Sun et al., *"SmartIntent: A Serverless LLM-Oriented Architecture for Intent-Driven Building Automation"*, IEEE CloudCom, 2025.
10. Mostafaei & Menth, *"Software-defined wireless sensor networks: A survey"*, JNCA, 2018.

---

<div align="center">

*Built with ❤️ at Université Évry Paris-Saclay · IBISC Laboratory · D4Gen Hackathon 2026*

</div>