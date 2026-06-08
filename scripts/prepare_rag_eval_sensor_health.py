"""Prepare RAG-only workflow evaluation cases from patient sensor records.

The generated JSONL is intended for:

  python scripts/evaluate_guideline_rag.py \
    --workflow \
    --benchmark data/guidelines/rag_eval_sensor_workflow_cases.jsonl \
    --output data/guidelines/rag_eval_sensor_workflow_report.json

These cases keep abnormality/risk detection as upstream preprocessing. The
evaluation target is the RAG portion of the workflow: transform the patient
payload into a guideline query, retrieve relevant guideline context, and produce
a grounded alert.
"""

from __future__ import annotations

import argparse
from collections import Counter
import csv
import json
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_VITALS_PATH = PROJECT_ROOT / "data" / "Multi-Sensor_Medical_IoT_Dataset.csv"
DEFAULT_OUTPUT_PATH = PROJECT_ROOT / "data" / "guidelines" / "rag_eval_sensor_workflow_cases.jsonl"


ABNORMALITY_RULES = {
    "high_temperature": {
        "expected_terms": ["temperature", "acute illness", "clinical deterioration", "observations"],
        "expected_citations": ["NEWS2", "NICE_NG253", "NICE_CG50"],
        "reference_answer": (
            "The RAG output should use guideline context about acute illness or suspected sepsis assessment, "
            "including temperature and other physiological observations, and should recommend monitoring "
            "and escalation to clinical staff when deterioration is possible."
        ),
    },
    "low_temperature": {
        "expected_terms": ["temperature", "hypothermia", "acute illness", "observations"],
        "expected_citations": ["NEWS2", "NICE_NG253", "NICE_CG50"],
        "reference_answer": (
            "The RAG output should ground the alert in guideline context about abnormal temperature, "
            "physiological observations, and escalation or reassessment when acute illness is suspected."
        ),
    },
    "high_heart_rate": {
        "expected_terms": ["heart rate", "pulse rate", "clinical deterioration", "observations"],
        "expected_citations": ["NEWS2", "NICE_NG253", "NICE_CG50"],
        "reference_answer": (
            "The RAG output should use guideline context about heart or pulse rate as part of physiological "
            "assessment, and should recommend reassessment, monitoring, and escalation if the abnormality persists."
        ),
    },
    "low_heart_rate": {
        "expected_terms": ["pulse rate", "heart rate", "clinical deterioration", "observations"],
        "expected_citations": ["NEWS2", "NICE_CG50"],
        "reference_answer": (
            "The RAG output should use guideline context about pulse or heart rate as a physiological "
            "observation and should recommend clinical review if the abnormality persists or worsens."
        ),
    },
    "fall_detected": {
        "expected_terms": ["fall", "falls assessment", "risk factors", "medication review"],
        "expected_citations": ["NICE_CG161"],
        "reference_answer": (
            "The RAG output should use falls guideline context, recommend immediate assessment after a fall, "
            "consider injury, consciousness, mobility, risk factors, and escalation to clinical staff."
        ),
    },
}


def parse_bool(value: Any) -> bool:
    return str(value).strip().casefold() in {"true", "1", "yes", "y"}


def normalize_sensor_row(row: dict[str, str]) -> dict[str, str]:
    return {
        "patient_id": str(row.get("patient_id") or "").strip(),
        "timestamp": str(row.get("timestamp") or "").strip(),
        "temperature": str(row.get("body_temperature") or row.get("temperature") or "").strip(),
        "heart_rate": str(row.get("heart_rate") or "").strip(),
        "fall_detected": str(row.get("fall_detected") or "").strip(),
    }


def detect_abnormalities(row: dict[str, str]) -> list[str]:
    temperature = float(row["temperature"])
    heart_rate = float(row["heart_rate"])
    fall_detected = parse_bool(row["fall_detected"])

    abnormalities = []
    if temperature < 36:
        abnormalities.append("low_temperature")
    elif temperature > 38:
        abnormalities.append("high_temperature")

    if heart_rate < 50:
        abnormalities.append("low_heart_rate")
    elif heart_rate > 120:
        abnormalities.append("high_heart_rate")

    if fall_detected:
        abnormalities.append("fall_detected")

    return abnormalities


def dedupe(items: list[str]) -> list[str]:
    seen = set()
    unique = []
    for item in items:
        key = item.casefold()
        if key in seen:
            continue
        seen.add(key)
        unique.append(item)
    return unique


def scenario_query(row: dict[str, str], abnormalities: list[str]) -> str:
    labels = ", ".join(item.replace("_", " ") for item in abnormalities)
    fall_text = "fall detected" if parse_bool(row["fall_detected"]) else "no fall detected"
    return (
        f"Patient sensor workflow case for {row['patient_id']} at {row['timestamp']}: "
        f"temperature {row['temperature']} C, heart rate {row['heart_rate']} bpm, "
        f"{fall_text}; abnormal findings: {labels}. Retrieve applicable clinical guideline context."
    )


def make_case(row: dict[str, str], abnormalities: list[str], index: int, top_k: int) -> dict[str, Any]:
    expected_terms: list[str] = []
    expected_citations: list[str] = []
    reference_parts: list[str] = []

    for abnormality in abnormalities:
        rule = ABNORMALITY_RULES[abnormality]
        expected_terms.extend(rule["expected_terms"])
        expected_citations.extend(rule["expected_citations"])
        reference_parts.append(rule["reference_answer"])

    return {
        "id": f"sensor-rag-{index:04d}",
        "query": scenario_query(row, abnormalities),
        "payload": {
            "patient_id": row["patient_id"],
            "timestamp": row["timestamp"],
        },
        "expected_terms": dedupe(expected_terms)[:8],
        "expected_citation_contains": dedupe(expected_citations),
        "reference_answer": " ".join(dedupe(reference_parts)),
        "top_k": top_k,
        "metadata": {
            "evaluation_scope": "rag_only_after_sensor_payload",
            "abnormalities": abnormalities,
            "temperature": float(row["temperature"]),
            "heart_rate": float(row["heart_rate"]),
            "fall_detected": parse_bool(row["fall_detected"]),
        },
    }


def load_abnormal_rows(path: Path) -> list[tuple[dict[str, str], list[str]]]:
    rows = []
    with path.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            normalized_row = normalize_sensor_row(row)
            abnormalities = detect_abnormalities(normalized_row)
            if abnormalities:
                rows.append((normalized_row, abnormalities))
    return rows


def choose_cases(rows: list[tuple[dict[str, str], list[str]]], max_cases: int) -> list[tuple[dict[str, str], list[str]]]:
    if max_cases <= 0 or len(rows) <= max_cases:
        return rows

    selected: list[tuple[dict[str, str], list[str]]] = []
    seen_keys = set()

    for abnormality in ABNORMALITY_RULES:
        for index, (_, abnormalities) in enumerate(rows):
            if abnormality in abnormalities and index not in seen_keys:
                selected.append(rows[index])
                seen_keys.add(index)
                break

    for index, row in enumerate(rows):
        if len(selected) >= max_cases:
            break
        if index in seen_keys:
            continue
        selected.append(row)

    return selected[:max_cases]


def write_cases(cases: list[dict[str, Any]], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as handle:
        for case in cases:
            handle.write(json.dumps(case, ensure_ascii=False) + "\n")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate sensor-payload RAG workflow evaluation cases.")
    parser.add_argument("--vitals", type=Path, default=DEFAULT_VITALS_PATH)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_PATH)
    parser.add_argument("--max-cases", type=int, default=20)
    parser.add_argument("--top-k", type=int, default=5)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    rows = choose_cases(load_abnormal_rows(args.vitals), max_cases=args.max_cases)
    cases = [make_case(row, abnormalities, index + 1, top_k=args.top_k) for index, (row, abnormalities) in enumerate(rows)]
    if not cases:
        raise ValueError(f"No abnormal sensor records found in {args.vitals}")

    write_cases(cases, args.output)
    abnormality_counts = Counter(
        abnormality for case in cases for abnormality in case["metadata"]["abnormalities"]
    )
    print(
        json.dumps(
            {
                "success": True,
                "output": str(args.output),
                "case_count": len(cases),
                "scope": "rag_only_after_sensor_payload",
                "abnormality_counts": dict(sorted(abnormality_counts.items())),
            },
            indent=2,
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
