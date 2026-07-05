# Medical Assistant Prototype

A web-based medical assistant for structured clinical monitoring and medication-safety support. The current system uses a task-based dashboard with deterministic backend workflows, local medical datasets, a trained health-risk model, and guideline retrieval for early-warning alerts.

![Medical Assistant Overview](/docs/medical/overview.png)

## Features

- **Task-Based Medical Dashboard** - Structured `/medical` page for clinical monitoring and medication-safety workflows
- **Early Warning** - Looks up patient sensor records by patient and timestamp, detects abnormal patterns, retrieves guideline context, and produces a source-cited alert
- **Health Risk Prediction** - Risk estimation from complete vital-sign inputs using a trained model
- **Drug Interaction Checking** - Pairwise medication interaction checks from structured local datasets
- **Side-Effect Lookup** - Drug side-effect retrieval from local repository data
- **Patient-Specific Prescription Check** - Reviews medication lists against patient history and configured safety rules
- **Controlled Response Flow** - Dataset-backed services and trained models are the primary path; the optional LLM is limited to early-warning alert wording

## Tech Stack

- **Frontend**: Next.js UI in `src/ui`
- **Backend**: Persistent Python backend via `scripts/run_medical_backend.py`
- **API Routes**: Medical workflow endpoints under `src/ui/src/app/api/medical`
- **Schemas**: Structured request and response models in `src/schemas`
- **Services**: Core workflow logic in `src/services`
- **Data**: Local CSV datasets in `data`
- **Guideline RAG**: PDF chunking and local vector search for early-warning alerts
- **Optional LLM**: Gemini for early-warning alert wording only

## Getting Started

### Prerequisites

- Python with Poetry
- Node.js
- npm

### Setup

```bash
# Install Python dependencies
poetry install

# Install UI dependencies
cd src/ui
npm install
```

Set up `src/ui/.env`:

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"
MEDICAL_BACKEND_URL="http://127.0.0.1:8010"

GEMINI_API_KEY="your-gemini-api-key"
GEMINI_MODEL="gemini/gemini-flash-latest"
```

`GEMINI_API_KEY` is optional. Without it, the workflows still run with local datasets, the trained model, and retrieved guideline context.

Start the backend:

```bash
poetry run python scripts/run_medical_backend.py
```

Start the UI:

```bash
cd src/ui
npm run dev
```

From the repository root, this also works:

```bash
npm run dev
```

Open [http://localhost:3000/medical](http://localhost:3000/medical).

## Current Behavior

The current production emphasis is on bounded, explainable workflows:

- Drug interactions and side effects use structured dataset lookups
- Health risk prediction uses a trained model
- Patient-specific prescription checks use patient history plus configured safety rules
- Early warning uses sensor rules plus guideline RAG for source-cited alerts
- Gemini is optional and only improves early-warning alert wording

## Guideline RAG Preparation

Place guideline PDFs in:

```text
data/guidelines/pdf/
```

Generate guideline chunks:

```bash
poetry run python scripts/prepare_guidelines_rag.py
```

Build the local vector store:

```bash
poetry run python scripts/build_guideline_vector_store.py
```

## Project Structure

```text
data/
|-- healthcare_dataset.csv
|-- Multi-Sensor_Medical_IoT_Dataset.csv
|-- db_drug_interactions.csv
|-- drugs_side_effects_drugs_com.csv
`-- guidelines/

scripts/
|-- run_medical_backend.py
|-- run_early_warning.py
|-- run_prescription_safety.py
|-- prepare_guidelines_rag.py
`-- build_guideline_vector_store.py

src/
|-- repositories/
|-- schemas/
|-- services/
`-- ui/
    `-- src/app/(dashboard)/medical/page.tsx
```

## Architecture Overview

The medical assistant currently follows this flow:

```text
UI (/medical)
  -> Medical API routes
  -> Persistent Python backend
  -> Workflow services
  -> Local repositories / trained model / guideline vector store
  -> Structured dashboard output
```

Early Warning has a separate guideline-backed branch:

```text
Sensor abnormality
  -> Guideline RAG
  -> Source-cited early-warning alert
  -> Medical staff review
```

This design supports a controlled, task-based medical assistant.

## Testing

Run backend tests:

```bash
poetry run python -m unittest discover tests
```

Run frontend checks:

```bash
cd src/ui
npx tsc --noEmit
```
