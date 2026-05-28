"""Early-warning workflow backed by rule checks and guideline RAG retrieval."""

from __future__ import annotations

import os
from typing import Any

from crewai import LLM

from repositories.patient_history import PatientHistoryRepository
from repositories.patient_vitals import PatientVitalsRepository
from schemas.response import WorkflowResponse
from services.guideline_vector_store import GuidelineVectorStore
from services.runtime_env import load_medical_environment


class EarlyWarningService:
    """Detect sensor abnormalities and retrieve guideline context for alerts."""

    def __init__(
        self,
        vector_store: GuidelineVectorStore | None = None,
        patient_history_repository: PatientHistoryRepository | None = None,
        patient_vitals_repository: PatientVitalsRepository | None = None,
        llm: LLM | None = None,
        enable_llm: bool = True,
    ) -> None:
        load_medical_environment()
        self.vector_store = vector_store or GuidelineVectorStore()
        self.patient_history_repository = patient_history_repository or PatientHistoryRepository()
        self.patient_vitals_repository = patient_vitals_repository or PatientVitalsRepository()
        self.model = os.getenv("GEMINI_MODEL", "gemini/gemini-flash-latest")
        self.api_key = os.getenv("GEMINI_API_KEY", "") if enable_llm else ""
        self._llm = llm

    def evaluate(self, payload: dict[str, Any], top_k: int = 5) -> WorkflowResponse:
        try:
            record = self._normalize_record(payload)
        except ValueError as exc:
            return WorkflowResponse(
                success=False,
                message="Sensor record is missing required fields.",
                data={"error": str(exc)},
                warnings=[
                    "Required fields: patient_id and timestamp, or timestamp with temperature, heart_rate, and fall_detected."
                ],
            )

        abnormalities = self._detect_abnormalities(record)
        if not abnormalities:
            return WorkflowResponse(
                success=True,
                message="No early-warning abnormality was detected by the configured rules.",
                data={
                    "result": {
                        "record": record,
                        "abnormalities": [],
                        "alert_required": False,
                    }
                },
                warnings=[],
            )

        rag_query = self._build_rag_query(record, abnormalities)
        retrieved_context, retrieval_warning = self._retrieve_context(rag_query, top_k)
        alert = self._generate_alert(record, abnormalities, rag_query, retrieved_context)

        warnings = []
        if retrieval_warning:
            warnings.append(retrieval_warning)

        return WorkflowResponse(
            success=True,
            message="Early-warning abnormality detected.",
            data={
                "result": {
                    "record": record,
                    "abnormalities": abnormalities,
                    "alert_required": True,
                    "rag_query": rag_query,
                    "retrieved_context": retrieved_context,
                    "alert": alert["alert"],
                    "explanation": alert["explanation"],
                    "sources": alert["sources"],
                    "llm_used": alert["llm_used"],
                }
            },
            warnings=warnings,
        )

    def _normalize_record(self, payload: dict[str, Any]) -> dict[str, Any]:
        timestamp = str(payload.get("timestamp") or payload.get("time") or "").strip()
        if not timestamp:
            raise ValueError("Missing timestamp.")
        patient_id = payload.get("patient_id") or payload.get("patientId")
        normalized_patient_id = (
            self.patient_history_repository.normalize_patient_id(patient_id) if patient_id not in (None, "") else None
        )
        sensor_record = None
        if not self._has_inline_vitals(payload):
            if not normalized_patient_id:
                raise ValueError("Missing patient_id for sensor lookup.")
            sensor_record = self.patient_vitals_repository.get_by_patient_and_timestamp(normalized_patient_id, timestamp)
            if not sensor_record:
                raise ValueError(
                    f"No sensor record found for patient_id={normalized_patient_id} at timestamp={timestamp}."
                )

        record = {
            "patient_id": normalized_patient_id or (sensor_record.patient_id if sensor_record else None),
            "timestamp": timestamp,
            "temperature": sensor_record.temperature
            if sensor_record
            else self._required_float(payload, "temperature", "temp"),
            "heart_rate": sensor_record.heart_rate
            if sensor_record
            else self._required_float(payload, "heart_rate", "heartRate", "hr"),
            "fall_detected": sensor_record.fall_detected
            if sensor_record
            else self._required_bool(payload, "fall_detected", "fallDetected", "fall"),
        }
        if record["patient_id"]:
            history = self.patient_history_repository.get_by_patient_id(record["patient_id"])
            if history:
                record["patient_history"] = history.to_dict()

        age = payload.get("age")
        if age not in (None, ""):
            record["age"] = int(float(age))
        elif isinstance(record.get("patient_history"), dict):
            record["age"] = record["patient_history"]["age"]

        gender = payload.get("gender") or payload.get("sex")
        if gender:
            record["gender"] = str(gender).strip().lower()
        elif isinstance(record.get("patient_history"), dict):
            record["gender"] = record["patient_history"]["gender"]

        return record

    def _has_inline_vitals(self, payload: dict[str, Any]) -> bool:
        has_temperature = any(key in payload and payload[key] not in (None, "") for key in ("temperature", "temp"))
        has_heart_rate = any(key in payload and payload[key] not in (None, "") for key in ("heart_rate", "heartRate", "hr"))
        has_fall = any(key in payload and payload[key] not in (None, "") for key in ("fall_detected", "fallDetected", "fall"))
        return has_temperature and has_heart_rate and has_fall

    def _required_float(self, payload: dict[str, Any], *keys: str) -> float:
        for key in keys:
            if key in payload and payload[key] not in (None, ""):
                return float(payload[key])
        raise ValueError(f"Missing numeric field: {keys[0]}.")

    def _required_bool(self, payload: dict[str, Any], *keys: str) -> bool:
        for key in keys:
            if key not in payload:
                continue
            value = payload[key]
            if isinstance(value, bool):
                return value
            if isinstance(value, (int, float)):
                return bool(value)
            if isinstance(value, str):
                return value.strip().casefold() in {"true", "1", "yes", "y"}
        raise ValueError(f"Missing boolean field: {keys[0]}.")

    def _detect_abnormalities(self, record: dict[str, Any]) -> list[dict[str, Any]]:
        abnormalities: list[dict[str, Any]] = []
        temperature = float(record["temperature"])
        heart_rate = float(record["heart_rate"])

        if temperature < 36:
            abnormalities.append(
                {
                    "type": "low_temperature",
                    "severity": "warning",
                    "value": temperature,
                    "unit": "C",
                    "rule": "temperature < 36 C",
                }
            )
        elif temperature > 38:
            abnormalities.append(
                {
                    "type": "high_temperature",
                    "severity": "warning",
                    "value": temperature,
                    "unit": "C",
                    "rule": "temperature > 38 C",
                }
            )

        if heart_rate < 50:
            abnormalities.append(
                {
                    "type": "low_heart_rate",
                    "severity": "warning",
                    "value": heart_rate,
                    "unit": "bpm",
                    "rule": "heart_rate < 50 bpm",
                }
            )
        elif heart_rate > 120:
            abnormalities.append(
                {
                    "type": "high_heart_rate",
                    "severity": "warning",
                    "value": heart_rate,
                    "unit": "bpm",
                    "rule": "heart_rate > 120 bpm",
                }
            )

        if bool(record["fall_detected"]):
            abnormalities.append(
                {
                    "type": "fall_detected",
                    "severity": "urgent",
                    "value": True,
                    "unit": "",
                    "rule": "fall_detected is true",
                }
            )

        return abnormalities

    def _build_rag_query(self, record: dict[str, Any], abnormalities: list[dict[str, Any]]) -> str:
        patient_bits = []
        if record.get("gender"):
            patient_bits.append(str(record["gender"]))
        if record.get("age"):
            patient_bits.append(f"{record['age']}-year-old")
        patient = " ".join(patient_bits + ["patient"]).strip()
        history_context = self._history_context(record)

        clinical_terms = {
            "high_temperature": "fever high temperature acute illness",
            "low_temperature": "hypothermia low temperature acute illness",
            "high_heart_rate": "tachycardia high heart rate clinical deterioration",
            "low_heart_rate": "bradycardia low heart rate clinical deterioration",
            "fall_detected": "fall in older adult falls assessment immediate response",
        }
        terms = " ".join(clinical_terms[item["type"]] for item in abnormalities)
        fall_text = "fall detected" if record["fall_detected"] else "no fall detected"
        return (
            f"{patient} temperature {record['temperature']} C, heart rate {record['heart_rate']} bpm, "
            f"{fall_text}. {history_context} Retrieve clinical guideline recommendations for {terms}."
        )

    def _history_context(self, record: dict[str, Any]) -> str:
        history = record.get("patient_history")
        if not isinstance(history, dict):
            return ""

        parts = []
        condition = str(history.get("medical_condition") or "").strip()
        medication = str(history.get("medication") or "").strip()
        test_results = str(history.get("test_results") or "").strip()
        admission_type = str(history.get("admission_type") or "").strip()

        if condition:
            parts.append(f"medical history of {condition}")
        if medication:
            parts.append(f"current/recent medication {medication}")
        if test_results:
            parts.append(f"test results {test_results}")
        if admission_type:
            parts.append(f"admission type {admission_type}")

        return "Patient context: " + ", ".join(parts) + "." if parts else ""

    def _retrieve_context(self, query: str, top_k: int) -> tuple[list[dict[str, Any]], str | None]:
        if not self.vector_store.is_available():
            return [], "Guideline vector store is missing. Run scripts/build_guideline_vector_store.py first."
        try:
            results = self.vector_store.search(query, top_k=top_k)
        except Exception as exc:
            return [], f"Guideline retrieval failed: {exc}"

        context: list[dict[str, Any]] = []
        for result in results:
            metadata = result.get("metadata", {})
            if not isinstance(metadata, dict):
                metadata = {}
            context.append(
                {
                    "id": result.get("id"),
                    "score": result.get("score"),
                    "text": result.get("text"),
                    "metadata": metadata,
                    "citation": self._citation(metadata),
                }
            )
        return context, None

    def _generate_alert(
        self,
        record: dict[str, Any],
        abnormalities: list[dict[str, Any]],
        rag_query: str,
        context: list[dict[str, Any]],
    ) -> dict[str, Any]:
        sources = [item["citation"] for item in context if item.get("citation")]
        draft = self._draft_alert(record, abnormalities, sources)
        llm_answer = self._call_llm(record, abnormalities, rag_query, context, draft)
        if llm_answer:
            return {
                "alert": llm_answer,
                "explanation": "Generated from rule-based abnormalities and retrieved guideline context.",
                "sources": sources,
                "llm_used": True,
            }
        return {
            "alert": draft,
            "explanation": "Generated by deterministic rules; guideline chunks are included as context for review.",
            "sources": sources,
            "llm_used": False,
        }

    def _draft_alert(
        self,
        record: dict[str, Any],
        abnormalities: list[dict[str, Any]],
        sources: list[str],
    ) -> str:
        urgent = any(item["severity"] == "urgent" for item in abnormalities)
        if urgent:
            return (
                "Check the patient immediately, assess injury, consciousness, and vital signs, "
                "and escalate to clinical staff according to the local care protocol."
            )
        return (
            "Repeat the measurement, monitor closely, and escalate to clinical staff if the abnormality persists "
            "or worsens."
        )

    def _history_alert_text(self, record: dict[str, Any]) -> str:
        history = record.get("patient_history")
        if not isinstance(history, dict):
            return ""

        fields = []
        condition = history.get("medical_condition")
        medication = history.get("medication")
        test_results = history.get("test_results")
        if condition:
            fields.append(f"medical condition: {condition}")
        if medication:
            fields.append(f"medication: {medication}")
        if test_results:
            fields.append(f"test results: {test_results}")
        return f"Patient history ({'; '.join(fields)}). " if fields else ""

    def _call_llm(
        self,
        record: dict[str, Any],
        abnormalities: list[dict[str, Any]],
        rag_query: str,
        context: list[dict[str, Any]],
        draft: str,
    ) -> str | None:
        if not self._llm and not self.api_key.strip():
            return None

        llm = self._llm or LLM(model=self.model, api_key=self.api_key, temperature=0.2, timeout=20)
        context_text = "\n\n".join(
            f"[{item.get('citation')}] {str(item.get('text', ''))[:1400]}" for item in context[:5]
        )
        prompt = (
            "You are a clinical early-warning assistant. Write in English.\n"
            "Use only the sensor record, rule abnormalities, and retrieved guideline context below.\n"
            "Do not diagnose. Do not invent medication, dosage, or treatment. Recommend escalation to clinical staff "
            "when urgent signs or a fall are present. Include source citations from the context labels when relevant.\n\n"
            "Return one concise action sentence only. "
            "Do not repeat timestamp, vital signs, fall status, patient history, abnormality names, or sources; "
            "the UI already displays those fields separately.\n\n"
            f"Sensor record: {record}\n"
            f"Rule abnormalities: {abnormalities}\n"
            f"RAG query: {rag_query}\n"
            f"Retrieved guideline context:\n{context_text}\n\n"
            f"Fallback draft: {draft}\n\n"
            "Return only the final alert sentence."
        )
        try:
            response = llm.call(prompt)
        except Exception:
            return None
        return response.strip() if isinstance(response, str) and response.strip() else None

    def _citation(self, metadata: dict[str, Any]) -> str:
        guideline = str(metadata.get("guideline") or metadata.get("source") or "guideline")
        page_start = metadata.get("page_start")
        page_end = metadata.get("page_end")
        if page_start and page_end and page_start != page_end:
            return f"{guideline} pp. {page_start}-{page_end}"
        if page_start:
            return f"{guideline} p. {page_start}"
        return guideline
