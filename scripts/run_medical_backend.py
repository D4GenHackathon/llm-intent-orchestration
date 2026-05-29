"""Persistent HTTP backend for the medical workflows.
This script will be replaced with FastAPI, only serve as a temporary solution to expose the medical backend service.
"""

from __future__ import annotations

import argparse
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import sys


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = PROJECT_ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from services.runtime_env import load_medical_environment
from services.medical_backend_service import MedicalBackendService


load_medical_environment()
SERVICE = MedicalBackendService()


class MedicalBackendHandler(BaseHTTPRequestHandler):
    """Serve medical workflow requests over a local HTTP interface."""

    server_version = "MedicalBackend/0.1"

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/health":
            self._write_json(HTTPStatus.OK, {"ok": True})
            return
        self._write_json(HTTPStatus.NOT_FOUND, {"error": "Not found"})

    def do_POST(self) -> None:  # noqa: N802
        try:
            payload = self._read_json()
        except ValueError as exc:
            self._write_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
            return

        try:
            if self.path == "/medical/drug-interactions":
                response = SERVICE.handle_drug_interactions(payload)
                self._write_json(HTTPStatus.OK if response.get("success") else HTTPStatus.BAD_REQUEST, response)
                return
            if self.path == "/medical/side-effects":
                response = SERVICE.handle_side_effects(payload)
                self._write_json(HTTPStatus.OK if response.get("success") else HTTPStatus.BAD_REQUEST, response)
                return
            if self.path == "/medical/health-risk":
                response = SERVICE.handle_health_risk(payload)
                self._write_json(HTTPStatus.OK if response.get("success") else HTTPStatus.BAD_REQUEST, response)
                return
            if self.path == "/medical/early-warning":
                response = SERVICE.handle_early_warning(payload)
                self._write_json(HTTPStatus.OK if response.get("success") else HTTPStatus.BAD_REQUEST, response)
                return
            if self.path == "/medical/prescription-safety":
                response = SERVICE.handle_prescription_safety(payload)
                self._write_json(HTTPStatus.OK if response.get("success") else HTTPStatus.BAD_REQUEST, response)
                return
        except Exception as exc:  # pragma: no cover - runtime safety
            self._write_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": str(exc)})
            return

        self._write_json(HTTPStatus.NOT_FOUND, {"error": "Not found"})

    def log_message(self, format: str, *args) -> None:  # noqa: A003
        return

    def _read_json(self) -> dict:
        content_length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(content_length) if content_length else b"{}"
        try:
            payload = json.loads(raw_body.decode("utf-8") or "{}")
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid JSON body: {exc}") from exc
        if not isinstance(payload, dict):
            raise ValueError("Request body must be a JSON object.")
        return payload

    def _write_json(self, status: HTTPStatus, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the persistent local medical backend.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8010)
    args = parser.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), MedicalBackendHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
