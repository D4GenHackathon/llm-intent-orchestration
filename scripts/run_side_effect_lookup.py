"""CLI bridge for the Python drug side-effect workflow."""

from __future__ import annotations

import json
from pathlib import Path
import sys


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = PROJECT_ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from schemas.side_effect import SideEffectLookupRequest
from services.side_effect_service import SideEffectService


def main() -> int:
    """Read JSON input from stdin and emit side-effect JSON to stdout."""
    try:
        payload = json.loads(sys.stdin.read() or "{}")
        request = SideEffectLookupRequest(
            query=str(payload.get("query", "")),
            drug_name=str(payload.get("drugName", "")),
        )
        response = SideEffectService().lookup_side_effects(request).to_dict()
        print(json.dumps(response))
        return 0
    except Exception as exc:  # pragma: no cover - CLI fallback path
        print(json.dumps({"success": False, "error": str(exc)}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
