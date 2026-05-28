"""CLI bridge for the early-warning RAG workflow."""

from __future__ import annotations

import json
from pathlib import Path
import sys


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = PROJECT_ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from services.early_warning_service import EarlyWarningService


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    try:
        payload = json.loads(sys.stdin.read() or "{}")
        if not isinstance(payload, dict):
            raise ValueError("Input must be a JSON object.")
        top_k = int(payload.get("topK") or payload.get("top_k") or 5)
        response = EarlyWarningService().evaluate(payload, top_k=top_k)
        print(json.dumps(response.to_dict(), ensure_ascii=False))
        return 0 if response.success else 1
    except Exception as exc:
        print(json.dumps({"success": False, "error": str(exc)}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
