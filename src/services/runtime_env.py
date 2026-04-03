"""Helpers for loading runtime environment files used by the medical backend."""

from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv


def load_medical_environment() -> None:
    """Load repository env files in a predictable order if they exist."""
    project_root = Path(__file__).resolve().parents[2]
    candidates = (
        project_root / ".env",
        project_root / "src" / "ui" / ".env",
    )
    for path in candidates:
        if path.exists():
            load_dotenv(path, override=False)
