"""CLI bridge for the Python drug interaction workflow."""

from __future__ import annotations

import json
from pathlib import Path
import sys


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = PROJECT_ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from schemas.interaction import DrugInteractionRequest
from services.interaction_service import InteractionService


def main() -> int:
    """Read JSON input from stdin and emit interaction JSON to stdout."""
    try:
        payload = json.loads(sys.stdin.read() or "{}")
        request = DrugInteractionRequest(
            query=str(payload.get("query", "")),
            drugs=[str(item) for item in payload.get("drugs", [])],
        )
        response = InteractionService().check_interactions(request).to_dict()
        print(json.dumps(response))
        return 0
    except Exception as exc:  # pragma: no cover - CLI fallback path
        print(json.dumps({"success": False, "error": str(exc)}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

