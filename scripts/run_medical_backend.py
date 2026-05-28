"""Persistent FastAPI backend for the medical workflows."""

from __future__ import annotations

import argparse
from pathlib import Path
import sys
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = PROJECT_ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from services.runtime_env import load_medical_environment
from services.medical_backend_service import MedicalBackendService


load_medical_environment()
SERVICE = MedicalBackendService()
app = FastAPI(
    title="Medical Backend API",
    description="FastAPI service for deterministic medical workflows.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health_check() -> dict[str, bool]:
    """Health check used by the Next.js bridge."""
    return {"ok": True}


def _workflow_response(response: dict[str, Any]) -> JSONResponse:
    status_code = 200 if response.get("success") else 400
    return JSONResponse(status_code=status_code, content=response)


@app.post("/api/medical/drug-interactions")
async def check_drug_interactions(payload: dict[str, Any]) -> JSONResponse:
    """Check for drug interactions."""
    try:
        return _workflow_response(SERVICE.handle_drug_interactions(payload))
    except Exception as exc:  # pragma: no cover - runtime safety
        return JSONResponse(status_code=500, content={"error": str(exc)})


@app.post("/api/medical/side-effects")
async def lookup_side_effects(payload: dict[str, Any]) -> JSONResponse:
    """Lookup drug side effects."""
    try:
        return _workflow_response(SERVICE.handle_side_effects(payload))
    except Exception as exc:  # pragma: no cover - runtime safety
        return JSONResponse(status_code=500, content={"error": str(exc)})


@app.post("/api/medical/health-risk")
async def predict_health_risk(payload: dict[str, Any]) -> JSONResponse:
    """Predict health risk based on vital signs."""
    try:
        return _workflow_response(SERVICE.handle_health_risk(payload))
    except Exception as exc:  # pragma: no cover - runtime safety
        return JSONResponse(status_code=500, content={"error": str(exc)})


@app.post("/api/medical/early-warning")
async def evaluate_early_warning(payload: dict[str, Any]) -> JSONResponse:
    """Evaluate early warning indicators."""
    try:
        return _workflow_response(SERVICE.handle_early_warning(payload))
    except Exception as exc:  # pragma: no cover - runtime safety
        return JSONResponse(status_code=500, content={"error": str(exc)})


@app.post("/api/medical/prescription-safety")
async def evaluate_prescription_safety(payload: dict[str, Any]) -> JSONResponse:
    """Evaluate prescription safety."""
    try:
        return _workflow_response(SERVICE.handle_prescription_safety(payload))
    except Exception as exc:  # pragma: no cover - runtime safety
        return JSONResponse(status_code=500, content={"error": str(exc)})


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the persistent local FastAPI medical backend.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8010)
    args = parser.parse_args()

    uvicorn.run(app, host=args.host, port=args.port)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
