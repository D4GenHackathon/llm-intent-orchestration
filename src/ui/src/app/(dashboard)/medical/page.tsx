"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Activity, AlertTriangle, Pill, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type PairwiseInteraction = {
  drug_1: string;
  drug_2: string;
  mechanism: string | null;
  recommendation: string;
  description: string | null;
};

type InteractionResult = {
  normalized_drugs: string[];
  unrecognized_terms?: string[];
  interacting_pairs: PairwiseInteraction[];
  interaction_found: boolean;
  explanation: string;
};

type SideEffectGroups = {
  common: string[];
  serious: string[];
  rare: string[];
  when_to_seek_care: string[];
};

type SideEffectResult = {
  normalized_drug: string;
  generic_name: string;
  groups: SideEffectGroups;
  source: string;
  explanation: string;
};

type SideEffectLookupResult = {
  items: SideEffectResult[];
  failures: string[];
};

type FeatureContribution = {
  feature: string;
  value: string;
  contribution_score: number;
  rationale: string;
};

type HealthRiskResult = {
  predicted_risk: string;
  confidence: number | null;
  top_contributing_features: FeatureContribution[];
  explanation: string;
};

type EarlyWarningAbnormality = {
  type: string;
  severity: string;
  value: string | number | boolean;
  unit: string;
  rule: string;
};

type GuidelineContext = {
  id: string;
  score: number;
  text: string;
  citation: string;
  metadata: Record<string, unknown>;
};

type EarlyWarningResult = {
  record: Record<string, unknown>;
  abnormalities: EarlyWarningAbnormality[];
  alert_required: boolean;
  rag_query: string;
  retrieved_context: GuidelineContext[];
  alert: string;
  explanation: string;
  sources: string[];
  llm_used: boolean;
};

type PrescriptionSafetyWarning = {
  type: string;
  severity: string;
  patient_condition: string;
  drug: string;
  reason: string;
  matched_terms: string[];
  evidence: Array<{ term: string; snippet: string }>;
  recommendation: string;
};

type PrescriptionSafetyResult = {
  patient_history: Record<string, unknown>;
  prescribed_drug: string;
  normalized_drug: string;
  generic_name?: string;
  alert_required: boolean;
  warnings: PrescriptionSafetyWarning[];
  source?: string;
};

type PrescriptionSafetyLookupResult = {
  items: PrescriptionSafetyResult[];
  failures: string[];
};

type EarlyWarningDraft = {
  patient_id: string;
  timestamp: string;
};

type PrescriptionSafetyDraft = {
  patient_id: string;
  medicationList: string;
};

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data?: {
    result: T;
  };
};

type ApiState<T> = {
  loading: boolean;
  error: string;
  result: T | null;
};

type PatientProfile = Record<string, string | number>;

type HealthRiskDraft = {
  respiratory_rate: string;
  oxygen_saturation: string;
  o2_scale: string;
  systolic_bp: string;
  heart_rate: string;
  temperature: string;
  consciousness: string;
  on_oxygen: string;
};

const EMPTY_HEALTH_RISK_DRAFT: HealthRiskDraft = {
  respiratory_rate: "",
  oxygen_saturation: "",
  o2_scale: "",
  systolic_bp: "",
  heart_rate: "",
  temperature: "",
  consciousness: "",
  on_oxygen: "",
};

const EMPTY_EARLY_WARNING_DRAFT: EarlyWarningDraft = {
  patient_id: "P000004",
  timestamp: "2025-07-08 05:19",
};

const EMPTY_PRESCRIPTION_SAFETY_DRAFT: PrescriptionSafetyDraft = {
  patient_id: "P000012",
  medicationList: "methylphenidate",
};

const idleState = <T,>(): ApiState<T> => ({
  loading: false,
  error: "",
  result: null,
});

async function postJson<T>(url: string, payload: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || data?.error || "Request failed");
  }
  return data as T;
}

const REQUIRED_HEALTH_RISK_FIELDS: Array<{ key: string; label: string }> = [
  { key: "respiratory_rate", label: "respiratory rate" },
  { key: "oxygen_saturation", label: "oxygen saturation" },
  { key: "o2_scale", label: "O2 scale" },
  { key: "systolic_bp", label: "systolic blood pressure" },
  { key: "heart_rate", label: "heart rate" },
  { key: "temperature", label: "temperature" },
  { key: "consciousness", label: "consciousness" },
  { key: "on_oxygen", label: "on oxygen" },
];

const HEALTH_RISK_FIELD_UNITS: Record<string, string> = {
  respiratory_rate: "breaths/min",
  oxygen_saturation: "%",
  o2_scale: "scale",
  systolic_bp: "mmHg",
  heart_rate: "bpm",
  temperature: "C",
};

const HEALTH_RISK_FIELD_LIMITS: Record<
  string,
  { min?: number; step?: number; placeholder?: string }
> = {
  respiratory_rate: { min: 0, step: 1, placeholder: "e.g. 28" },
  oxygen_saturation: { min: 0, step: 1, placeholder: "e.g. 89" },
  o2_scale: { min: 0, step: 1, placeholder: "e.g. 2" },
  systolic_bp: { min: 0, step: 1, placeholder: "e.g. 95" },
  heart_rate: { min: 0, step: 1, placeholder: "e.g. 128" },
  temperature: { min: 0, step: 0.1, placeholder: "e.g. 38.4" },
  on_oxygen: { min: 0, step: 1, placeholder: "Yes / No" },
};

const CONSCIOUSNESS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "A", label: "Alert" },
  { value: "C", label: "Confused" },
  { value: "P", label: "Pain" },
  { value: "U", label: "Unresponsive" },
  { value: "V", label: "Verbal" },
];

const ON_OXYGEN_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "1", label: "Yes" },
  { value: "0", label: "No" },
];

function buildHealthRiskProfileFromDraft(draft: HealthRiskDraft): PatientProfile {
  const profile: PatientProfile = {};
  for (const { key } of REQUIRED_HEALTH_RISK_FIELDS) {
    const value = draft[key as keyof HealthRiskDraft].trim();
    if (!value) {
      continue;
    }
    if (key === "consciousness") {
      profile[key] = value;
    } else {
      profile[key] = Number(value);
    }
  }
  return profile;
}

function getHealthRiskFieldError(
  draft: HealthRiskDraft,
  field: keyof HealthRiskDraft,
): string {
  const rawValue = draft[field].trim();
  if (!rawValue) {
    return "";
  }

  if (field === "consciousness") {
    return CONSCIOUSNESS_OPTIONS.some((option) => option.value === rawValue)
      ? ""
      : "Please select a valid consciousness option.";
  }

  const numericValue = Number(rawValue);
  const limits = HEALTH_RISK_FIELD_LIMITS[field];
  if (Number.isNaN(numericValue) || !limits) {
    return "Please enter a valid number.";
  }

  if (numericValue < 0) {
    return "Value must be zero or greater.";
  }

  return "";
}

function SideEffectItemCard({ result }: { result: SideEffectResult }) {
  return (
    <div className="rounded-2xl border bg-slate-50 p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-sm font-semibold text-slate-900">{result.normalized_drug}</div>
        {result.generic_name ? <div className="text-xs text-slate-500">Generic: {result.generic_name}</div> : null}
      </div>
      {result.groups.common.length > 0 ? (
        <div className="mt-3 text-sm text-slate-700">
          <span className="font-medium">Common:</span> {result.groups.common.slice(0, 3).join("; ")}
        </div>
      ) : null}
      {result.groups.serious.length > 0 ? (
        <div className="mt-2 text-sm text-slate-700">
          <span className="font-medium">Serious:</span> {result.groups.serious.slice(0, 2).join("; ")}
        </div>
      ) : null}
      {result.groups.when_to_seek_care.length > 0 ? (
        <div className="mt-2 text-sm text-slate-700">
          <span className="font-medium">When to seek care:</span>{" "}
          {result.groups.when_to_seek_care.slice(0, 2).join("; ")}
        </div>
      ) : null}
      {result.groups.rare.length > 0 ? (
        <div className="mt-2 text-sm text-slate-700">
          <span className="font-medium">Rare:</span> {result.groups.rare.slice(0, 2).join("; ")}
        </div>
      ) : null}
    </div>
  );
}

function StatusPill({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <span
      className={
        active
          ? "inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700"
          : "inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700"
      }
    >
      {children}
    </span>
  );
}

function ApiError({ message }: { message: string }) {
  if (!message) {
    return null;
  }
  return <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{message}</div>;
}

function formatUnknown(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "N/A";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function humanizeLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (letter) => letter.toUpperCase());
}

function formatClinicalRule(rule: string): string {
  return humanizeLabel(rule)
    .replace(/\bC\b/g, "C")
    .replace(/\bBpm\b/g, "bpm");
}

function formatHealthRiskProfileValue(key: string, value: string | number): string {
  if (value === "N/A") {
    return value;
  }
  if (key === "consciousness") {
    return CONSCIOUSNESS_OPTIONS.find((option) => option.value === String(value))?.label ?? String(value);
  }
  if (key === "on_oxygen") {
    return ON_OXYGEN_OPTIONS.find((option) => option.value === String(value))?.label ?? String(value);
  }
  const unit = HEALTH_RISK_FIELD_UNITS[key];
  return unit ? `${value} ${unit}` : String(value);
}

function simplifyDrugName(value: string | undefined): string {
  return (value ?? "")
    .replace(/\s*\((oral|intravenous|iv|topical|ophthalmic|nasal|inhalation|subcutaneous|transdermal)\)\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function optionalGenericDisplay(drugName: string, genericName: string | undefined): string {
  const cleanedGeneric = simplifyDrugName(genericName);
  const cleanedDrug = simplifyDrugName(drugName);
  if (!cleanedGeneric || cleanedGeneric.toLowerCase() === cleanedDrug.toLowerCase()) {
    return "";
  }
  return ` (${cleanedGeneric})`;
}

function parseMedicationTerms(value: string): string[] {
  const seen = new Set<string>();
  return value
    .split(/,|\n|;/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function PatientHistorySummary({ history }: { history: Record<string, unknown> | undefined }) {
  if (!history) {
    return null;
  }
  const fields: Array<[string, unknown]> = [
    ["Patient", history.patient_id],
    ["Age", history.age],
    ["Gender", history.gender],
    ["Condition", history.medical_condition],
    ["Medication", history.medication],
    ["Test results", history.test_results],
  ];
  return (
    <div className="space-y-3 rounded-md border bg-slate-50 p-3 text-sm">
      <div className="font-medium text-slate-900">Health record</div>
      <div className="grid gap-2 md:grid-cols-2">
        {fields.map(([label, value]) => (
          <div key={String(label)}>
            <span className="font-medium text-slate-700">{label}:</span>{" "}
            <span className="text-slate-600">{formatUnknown(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function cleanMarkdownAlert(text: string): string {
  const withoutSources = text.split(/\n\s*\*\*Sources:\*\*|\n\s*Sources:/i)[0] ?? text;
  const withoutObservationSummary = withoutSources.replace(
    /\n\s*\*?\*?(Observation Summary|Findings|Observations)\*?\*?\s*:?\s*\n[\s\S]*?(?=\n\s*\*?\*?(Clinical Explanation|Explanation|Recommendation)\*?\*?\s*:?\s*\n)/i,
    "\n",
  );
  const withoutRepeatedObservations = withoutObservationSummary.replace(
    /\n\s*\*?\*?Time\*?\*?\s*:?\s*\n[\s\S]*?(?=\n\s*\*?\*?(Clinical Explanation|Explanation|Recommendation)\*?\*?\s*:?\s*\n)/i,
    "\n",
  );
  const normalized = withoutRepeatedObservations
    .replace(/\*\*/g, "")
    .replace(/^\s*[*-]\s+/gm, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  const urgentAction = normalized.match(/(Check the patient immediately[\s\S]*?local care protocol\.)/i);
  if (urgentAction?.[1]) {
    return urgentAction[1].replace(/^check/i, "Check").trim();
  }
  const routineAction = normalized.match(/(Repeat the measurement[\s\S]*?or worsens\.)/i);
  if (routineAction?.[1]) {
    return routineAction[1].replace(/^repeat/i, "Repeat").trim();
  }
  return normalized
    .replace(/\s+(Time\s+\d{4}-\d{2}-\d{2}|Patient history \(|Abnormalities:|Suggested sources:)[\s\S]*$/i, "")
    .trim();
}

function AlertTextBlock({ text }: { text: string }) {
  const cleaned = cleanMarkdownAlert(text);
  const blocks = cleaned
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return (
    <div className="space-y-3 rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">
      {blocks.map((block, index) => {
        const normalized = block.replace(/\n/g, " ").trim();
        const headingMatch = normalized.match(/^([A-Z][A-Za-z ]+):\s*(.*)$/);
        if (headingMatch) {
          return (
            <div key={`${index}-${headingMatch[1]}`}>
              <div className="font-semibold text-slate-900">{headingMatch[1]}</div>
              {headingMatch[2] ? <p className="mt-1">{headingMatch[2]}</p> : null}
            </div>
          );
        }
        return <p key={`${index}-${normalized.slice(0, 24)}`}>{normalized}</p>;
      })}
    </div>
  );
}

function SourceList({ sources }: { sources: string[] }) {
  if (sources.length === 0) {
    return null;
  }
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-slate-800">Sources</div>
      <div className="flex flex-wrap gap-2">
        {sources.map((source) => (
          <span key={source} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            {source}
          </span>
        ))}
      </div>
    </div>
  );
}

function SensorRecordSummary({ record }: { record: Record<string, unknown> }) {
  const fields: Array<[string, unknown]> = [
    ["Timestamp", record.timestamp],
    ["Temperature", `${formatUnknown(record.temperature)} C`],
    ["Heart rate", `${formatUnknown(record.heart_rate)} bpm`],
    ["Fall detected", formatUnknown(record.fall_detected)],
  ];
  return (
    <div className="space-y-3 rounded-md border bg-slate-50 p-3 text-sm">
      <div className="font-medium text-slate-900">Extracted sensor record</div>
      <div className="grid gap-2 md:grid-cols-2">
        {fields.map(([label, value]) => (
          <div key={label}>
            <span className="font-medium text-slate-700">{label}:</span>{" "}
            <span className="text-slate-600">{formatUnknown(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InteractionResultPanel({ result }: { result: InteractionResult }) {
  return (
    <div className="space-y-3 rounded-md border bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="font-medium text-slate-900">Interaction result</div>
        <StatusPill active={result.interaction_found}>
          {result.interaction_found ? "Interaction found" : "No interaction found"}
        </StatusPill>
      </div>
      <div className="text-sm text-slate-600">Checked: {result.normalized_drugs.join(", ") || "N/A"}</div>
      {result.unrecognized_terms && result.unrecognized_terms.length > 0 ? (
        <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          Not recognized in the current dataset: {result.unrecognized_terms.join(", ")}.
        </div>
      ) : null}
      {result.interacting_pairs.length > 0 ? (
        <div className="space-y-2">
          {result.interacting_pairs.map((pair) => (
            <div key={`${pair.drug_1}-${pair.drug_2}`} className="rounded-md bg-slate-50 p-3 text-sm">
              <div className="font-medium text-slate-800">
                {pair.drug_1} + {pair.drug_2}
              </div>
              <div className="mt-1 text-slate-600">{pair.description || pair.recommendation}</div>
            </div>
          ))}
        </div>
      ) : null}
      {result.explanation ? <div className="text-sm text-slate-600">{result.explanation}</div> : null}
    </div>
  );
}

function VitalProfileSummary({ profile }: { profile: PatientProfile }) {
  const fields = REQUIRED_HEALTH_RISK_FIELDS.map(({ key, label }) => [
    key,
    label,
    profile[key] ?? "N/A",
  ] as const);
  return (
    <div className="space-y-3 rounded-md border bg-slate-50 p-3 text-sm">
      <div className="font-medium text-slate-900">Vital-sign profile used</div>
      <div className="grid gap-2 md:grid-cols-2">
        {fields.map(([key, label, value]) => (
          <div key={label}>
            <span className="font-medium text-slate-700">{humanizeLabel(label)}:</span>{" "}
            <span className="text-slate-600">{formatHealthRiskProfileValue(key, value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HealthRiskResultPanel({ result, profile }: { result: HealthRiskResult; profile: PatientProfile | null }) {
  const confidence = typeof result.confidence === "number" ? `${Math.round(result.confidence * 100)}%` : "N/A";
  return (
    <div className="space-y-4 rounded-md border bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="font-medium text-slate-900">Health-risk result</div>
        <span className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white">
          {result.predicted_risk} risk
        </span>
      </div>
      {profile ? <VitalProfileSummary profile={profile} /> : null}
      <div className="text-sm text-slate-600">Confidence: {confidence}</div>
      {result.explanation ? <div className="text-sm text-slate-600">{result.explanation}</div> : null}
      {result.top_contributing_features.length > 0 ? (
        <div className="space-y-2">
          <div className="text-sm font-medium text-slate-800">Top contributing features</div>
          <p className="text-sm text-slate-700">
            {result.top_contributing_features
              .slice(0, 4)
              .map((feature) => humanizeLabel(feature.feature))
              .join(", ")}
            .
          </p>
        </div>
      ) : null}
    </div>
  );
}

function EarlyWarningResultPanel({ result }: { result: EarlyWarningResult }) {
  const history = result.record.patient_history as Record<string, unknown> | undefined;
  return (
    <div className="space-y-4 rounded-md border bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="font-medium text-slate-900">Early-warning result</div>
        <StatusPill active={result.alert_required}>
          {result.alert_required ? "Alert required" : "No alert required"}
        </StatusPill>
      </div>
      <PatientHistorySummary history={history} />
      <SensorRecordSummary record={result.record} />
      {result.abnormalities.length > 0 ? (
        <div className="space-y-2">
          <div className="text-sm font-medium text-slate-800">Abnormalities</div>
          <div className="grid gap-2 md:grid-cols-2">
            {result.abnormalities.map((item) => (
              <div key={item.type} className="rounded-md bg-red-50 p-3 text-sm text-red-800">
                <div className="font-medium">{humanizeLabel(item.type)}</div>
                <div>{formatClinicalRule(item.rule)}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <AlertTextBlock text={result.alert} />
      <SourceList sources={result.sources} />
      {result.retrieved_context.length > 0 ? (
        <details className="rounded-md border bg-slate-50 p-3 text-sm">
          <summary className="cursor-pointer font-medium text-slate-800">Retrieved guideline context</summary>
          <div className="mt-3 space-y-3">
            {result.retrieved_context.slice(0, 3).map((item) => (
              <div key={item.id} className="rounded-md bg-white p-3">
                <div className="font-medium text-slate-800">{item.citation}</div>
                <p className="mt-1 line-clamp-4 text-slate-600">{item.text}</p>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function PrescriptionSafetyResultPanel({
  result,
  showHealthRecord = true,
}: {
  result: PrescriptionSafetyResult;
  showHealthRecord?: boolean;
}) {
  return (
    <div className="space-y-4 rounded-md border bg-white p-4">
      {showHealthRecord ? <PatientHistorySummary history={result.patient_history} /> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-600">
          Drug: <span className="font-medium text-slate-800">{simplifyDrugName(result.normalized_drug)}</span>
          {optionalGenericDisplay(result.normalized_drug, result.generic_name)}
        </div>
        <StatusPill active={result.alert_required}>
          {result.alert_required ? "Review required" : "No configured warning"}
        </StatusPill>
      </div>
      {result.warnings.length > 0 ? (
        <div className="space-y-3">
          {result.warnings.map((warning) => (
            <div key={warning.type} className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
              <div className="font-medium text-amber-900">{warning.patient_condition}: {warning.type}</div>
              <p className="mt-1 text-amber-800">{warning.reason}</p>
              <p className="mt-2 text-amber-800">{warning.recommendation}</p>
              {warning.matched_terms.length > 0 ? (
                <div className="mt-2 text-amber-800">Matched terms: {warning.matched_terms.join(", ")}</div>
              ) : null}
              {warning.evidence.length > 0 ? (
                <details className="mt-2">
                  <summary className="cursor-pointer font-medium text-amber-900">Evidence snippets</summary>
                  <div className="mt-2 space-y-2">
                    {warning.evidence.map((item) => (
                      <div key={`${warning.type}-${item.term}`} className="rounded-md bg-white p-2 text-amber-900">
                        <span className="font-medium">{item.term}:</span> {item.snippet}
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
          No configured patient-history warning was detected for this prescription.
        </div>
      )}
    </div>
  );
}

function healthRiskDraftCompletion(draft: HealthRiskDraft): { filled: number; total: number; missing: string[] } {
  const filled = REQUIRED_HEALTH_RISK_FIELDS.filter(({ key }) => draft[key as keyof HealthRiskDraft].trim()).length;
  const missing = REQUIRED_HEALTH_RISK_FIELDS.filter(({ key }) => !draft[key as keyof HealthRiskDraft].trim()).map(
    ({ label }) => label,
  );
  return {
    filled,
    total: REQUIRED_HEALTH_RISK_FIELDS.length,
    missing,
  };
}

function validateHealthRiskDraft(draft: HealthRiskDraft): { invalid: string[]; missing: string[] } {
  const missing = REQUIRED_HEALTH_RISK_FIELDS.filter(({ key }) => !draft[key as keyof HealthRiskDraft].trim()).map(
    ({ label }) => label,
  );
  const invalid: string[] = [];

  for (const { key, label } of REQUIRED_HEALTH_RISK_FIELDS) {
    const rawValue = draft[key as keyof HealthRiskDraft].trim();
    if (!rawValue) {
      continue;
    }

    if (key === "consciousness") {
      if (!CONSCIOUSNESS_OPTIONS.some((option) => option.value === rawValue)) {
        invalid.push(label);
      }
      continue;
    }

    const numericValue = Number(rawValue);
    const limits = HEALTH_RISK_FIELD_LIMITS[key];
    if (Number.isNaN(numericValue) || !limits) {
      invalid.push(label);
      continue;
    }

    if (numericValue < 0) {
      invalid.push(label);
    }
  }

  return { invalid, missing };
}

function toHealthRiskPayload(profile: PatientProfile) {
  return {
    respiratoryRate: Number(profile.respiratory_rate),
    oxygenSaturation: Number(profile.oxygen_saturation),
    o2Scale: Number(profile.o2_scale),
    systolicBp: Number(profile.systolic_bp),
    heartRate: Number(profile.heart_rate),
    temperature: Number(profile.temperature),
    consciousness: String(profile.consciousness),
    onOxygen: Number(profile.on_oxygen),
  };
}

export default function MedicalWorkflowsPage() {
  const [healthRiskDraft, setHealthRiskDraft] = useState<HealthRiskDraft>(EMPTY_HEALTH_RISK_DRAFT);
  const [healthRiskState, setHealthRiskState] = useState<ApiState<HealthRiskResult>>(idleState());
  const [submittedHealthRiskProfile, setSubmittedHealthRiskProfile] = useState<PatientProfile | null>(null);
  const [earlyWarningDraft, setEarlyWarningDraft] = useState<EarlyWarningDraft>(EMPTY_EARLY_WARNING_DRAFT);
  const [earlyWarningState, setEarlyWarningState] = useState<ApiState<EarlyWarningResult>>(idleState());
  const [interactionQuery, setInteractionQuery] = useState("ibuprofen, warfarin");
  const [interactionState, setInteractionState] = useState<ApiState<InteractionResult>>(idleState());
  const [sideEffectDrug, setSideEffectDrug] = useState("ibuprofen");
  const [sideEffectState, setSideEffectState] = useState<ApiState<SideEffectLookupResult>>(idleState());
  const [prescriptionSafetyDraft, setPrescriptionSafetyDraft] = useState<PrescriptionSafetyDraft>(
    EMPTY_PRESCRIPTION_SAFETY_DRAFT,
  );
  const [prescriptionSafetyState, setPrescriptionSafetyState] =
    useState<ApiState<PrescriptionSafetyLookupResult>>(idleState());
  const healthRiskProgress = healthRiskDraftCompletion(healthRiskDraft);
  const healthRiskDraftValidation = validateHealthRiskDraft(healthRiskDraft);
  const canSubmitHealthRiskCase =
    healthRiskDraftValidation.missing.length === 0 && healthRiskDraftValidation.invalid.length === 0;

  function updateHealthRiskField(field: keyof HealthRiskDraft, value: string) {
    setHealthRiskDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateEarlyWarningField(field: keyof EarlyWarningDraft, value: string) {
    setEarlyWarningDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updatePrescriptionSafetyField(field: keyof PrescriptionSafetyDraft, value: string) {
    setPrescriptionSafetyDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function submitEarlyWarningCase() {
    if (!earlyWarningDraft.patient_id.trim() || !earlyWarningDraft.timestamp.trim()) {
      setEarlyWarningState({ loading: false, error: "Patient ID and timestamp are required.", result: null });
      return;
    }

    setEarlyWarningState({ loading: true, error: "", result: null });
    try {
      const response = await postJson<ApiEnvelope<EarlyWarningResult>>("/api/medical/early-warning", {
        patient_id: earlyWarningDraft.patient_id.trim(),
        timestamp: earlyWarningDraft.timestamp.trim(),
      });
      setEarlyWarningState({ loading: false, error: "", result: response.data?.result ?? null });
    } catch (error) {
      setEarlyWarningState({
        loading: false,
        error: error instanceof Error ? error.message : "Unable to run early-warning workflow.",
        result: null,
      });
    }
  }

  async function submitInteractionCheck() {
    const query = interactionQuery.trim();
    if (!query) {
      setInteractionState({ loading: false, error: "Enter at least two medication names.", result: null });
      return;
    }
    setInteractionState({ loading: true, error: "", result: null });
    try {
      const response = await postJson<ApiEnvelope<InteractionResult>>("/api/medical/drug-interactions", { query });
      setInteractionState({ loading: false, error: "", result: response.data?.result ?? null });
    } catch (error) {
      setInteractionState({
        loading: false,
        error: error instanceof Error ? error.message : "Unable to check drug interactions.",
        result: null,
      });
    }
  }

  async function submitSideEffectLookup() {
    const drugNames = parseMedicationTerms(sideEffectDrug);
    if (drugNames.length === 0) {
      setSideEffectState({ loading: false, error: "Enter a medication name.", result: null });
      return;
    }
    setSideEffectState({ loading: true, error: "", result: null });
    const items: SideEffectResult[] = [];
    const failures: string[] = [];
    for (const drugName of drugNames) {
      try {
        const response = await postJson<ApiEnvelope<SideEffectResult>>("/api/medical/side-effects", { drugName });
        if (response.data?.result) {
          items.push(response.data.result);
        } else {
          failures.push(drugName);
        }
      } catch {
        failures.push(drugName);
      }
    }

    if (items.length === 0) {
      setSideEffectState({
        loading: false,
        error: `No side-effect entry was found for ${failures.join(", ")} in the current dataset.`,
        result: null,
      });
      return;
    }

    setSideEffectState({ loading: false, error: "", result: { items, failures } });
  }

  async function submitPrescriptionSafetyCheck() {
    const patientId = prescriptionSafetyDraft.patient_id.trim();
    const drugNames = parseMedicationTerms(prescriptionSafetyDraft.medicationList);
    if (!patientId || drugNames.length === 0) {
      setPrescriptionSafetyState({ loading: false, error: "Patient ID and medication list are required.", result: null });
      return;
    }
    setPrescriptionSafetyState({ loading: true, error: "", result: null });
    const items: PrescriptionSafetyResult[] = [];
    const failures: string[] = [];
    for (const drugName of drugNames) {
      try {
        const response = await postJson<ApiEnvelope<PrescriptionSafetyResult>>(
          "/api/medical/prescription-safety",
          { patient_id: patientId, drugName },
        );
        if (response.data?.result) {
          items.push(response.data.result);
        } else {
          failures.push(drugName);
        }
      } catch {
        failures.push(drugName);
      }
    }

    if (items.length === 0) {
      setPrescriptionSafetyState({
        loading: false,
        error: `Unable to check patient-specific prescription safety for ${failures.join(", ")}.`,
        result: null,
      });
      return;
    }

    setPrescriptionSafetyState({ loading: false, error: "", result: { items, failures } });
  }

  async function submitHealthRiskCase() {
    const { missing, invalid } = validateHealthRiskDraft(healthRiskDraft);
    if (missing.length > 0 || invalid.length > 0) {
      const problems = [
        missing.length > 0 ? `Missing: ${missing.join(", ")}` : "",
        invalid.length > 0 ? `Invalid values: ${invalid.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join(". ");
      setHealthRiskState({
        loading: false,
        error: `Please fill in valid values before assessing health risk. ${problems}.`,
        result: null,
      });
      return;
    }
    const profile = buildHealthRiskProfileFromDraft(healthRiskDraft);
    setHealthRiskState({ loading: true, error: "", result: null });
    setSubmittedHealthRiskProfile(null);

    try {
      const workflowResponse = await postJson<ApiEnvelope<HealthRiskResult>>(
        "/api/medical/health-risk",
        toHealthRiskPayload(profile),
      );
      setHealthRiskState({ loading: false, error: "", result: workflowResponse.data?.result ?? null });
      setSubmittedHealthRiskProfile(profile);
      setHealthRiskDraft(EMPTY_HEALTH_RISK_DRAFT);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to assess health risk";
      setHealthRiskState({
        loading: false,
        error: message,
        result: null,
      });
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Medical Assistant</h1>
      </div>

      <Tabs defaultValue="clinical-monitoring" className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="clinical-monitoring">
            <Activity className="h-4 w-4" />
            Clinical Monitoring
          </TabsTrigger>
          <TabsTrigger value="medication-safety">
            <ShieldCheck className="h-4 w-4" />
            Medication Safety
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clinical-monitoring" className="space-y-4">
          <Tabs defaultValue="early-warning" className="space-y-4">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="early-warning">Early Warning</TabsTrigger>
              <TabsTrigger value="health-risk">Health Risk</TabsTrigger>
            </TabsList>

            <TabsContent value="early-warning" className="space-y-4">
          <Card className="border-l-4 border-l-red-500">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-red-100 p-2 text-red-700">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Early Warning</CardTitle>
                  <CardDescription>Retrieve sensor data by patient and time, then generate a guideline-backed early-warning alert.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="early-patient-id">Patient ID</Label>
                  <Input
                    id="early-patient-id"
                    value={earlyWarningDraft.patient_id}
                    onChange={(event) => updateEarlyWarningField("patient_id", event.target.value)}
                    placeholder="P000004"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="early-timestamp">Timestamp</Label>
                  <Input
                    id="early-timestamp"
                    value={earlyWarningDraft.timestamp}
                    onChange={(event) => updateEarlyWarningField("timestamp", event.target.value)}
                    placeholder="2025-07-08 05:19"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  onClick={() => void submitEarlyWarningCase()}
                  disabled={earlyWarningState.loading}
                >
                  <Activity className="h-4 w-4" />
                  Run Early Warning
                </Button>
                {earlyWarningState.loading ? <span className="text-sm text-slate-500">Checking...</span> : null}
              </div>
              <ApiError message={earlyWarningState.error} />
              {earlyWarningState.result ? <EarlyWarningResultPanel result={earlyWarningState.result} /> : null}
            </CardContent>
          </Card>
            </TabsContent>

            <TabsContent value="health-risk" className="space-y-4">
              <Card className="border-l-4 border-l-slate-500">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
                      <Activity className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle>Health Risk Prediction</CardTitle>
                      <CardDescription>Run the trained health-risk model from a complete vital-sign profile.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <Label>Vital-Sign Profile</Label>
                    </div>
                    <div className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white">
                      {healthRiskProgress.filled}/{healthRiskProgress.total} collected
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {REQUIRED_HEALTH_RISK_FIELDS.map(({ key, label }) => (
                      <div key={key} className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <Label htmlFor={`health-risk-${key}`}>{label}</Label>
                          {key === "consciousness" || key === "on_oxygen" ? null : (
                            <span className="text-xs text-slate-500">{HEALTH_RISK_FIELD_UNITS[key] ?? ""}</span>
                          )}
                        </div>
                        {getHealthRiskFieldError(healthRiskDraft, key as keyof HealthRiskDraft) ? (
                          <p className="text-xs text-red-600">
                            {getHealthRiskFieldError(healthRiskDraft, key as keyof HealthRiskDraft)}
                          </p>
                        ) : null}
                        {key === "consciousness" ? (
                          <select
                            id={`health-risk-${key}`}
                            className={`h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                              getHealthRiskFieldError(healthRiskDraft, "consciousness")
                                ? "border-red-300"
                                : "border-input"
                            }`}
                            value={healthRiskDraft.consciousness}
                            onChange={(event) => updateHealthRiskField("consciousness", event.target.value)}
                          >
                            <option value="">Select consciousness</option>
                            {CONSCIOUSNESS_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : key === "on_oxygen" ? (
                          <select
                            id={`health-risk-${key}`}
                            className={`h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                              getHealthRiskFieldError(healthRiskDraft, "on_oxygen")
                                ? "border-red-300"
                                : "border-input"
                            }`}
                            value={healthRiskDraft.on_oxygen}
                            onChange={(event) => updateHealthRiskField("on_oxygen", event.target.value)}
                          >
                            <option value="">Select yes or no</option>
                            {ON_OXYGEN_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Input
                            id={`health-risk-${key}`}
                            type="number"
                            value={healthRiskDraft[key as keyof HealthRiskDraft]}
                            onChange={(event) => updateHealthRiskField(key as keyof HealthRiskDraft, event.target.value)}
                            placeholder={HEALTH_RISK_FIELD_LIMITS[key]?.placeholder ?? "0"}
                            min={HEALTH_RISK_FIELD_LIMITS[key]?.min}
                            step={HEALTH_RISK_FIELD_LIMITS[key]?.step}
                            className={
                              getHealthRiskFieldError(healthRiskDraft, key as keyof HealthRiskDraft)
                                ? "border-red-300 focus-visible:ring-red-200"
                                : ""
                            }
                          />
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      onClick={() => void submitHealthRiskCase()}
                      disabled={healthRiskState.loading || !canSubmitHealthRiskCase}
                    >
                      Assess Health Risk
                    </Button>
                    {healthRiskState.loading ? <span className="text-sm text-slate-500">Assessing...</span> : null}
                  </div>
                  <ApiError message={healthRiskState.error} />
                  {healthRiskState.result ? (
                    <HealthRiskResultPanel result={healthRiskState.result} profile={submittedHealthRiskProfile} />
                  ) : null}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="medication-safety" className="space-y-4">
          <Card className="border-l-4 border-l-emerald-500">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
                  <Pill className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Medication Safety</CardTitle>
                  <CardDescription>Run direct medication checks or personalize a new prescription against patient history.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="interactions" className="space-y-4">
                <TabsList className="w-full justify-start overflow-x-auto">
                  <TabsTrigger value="interactions">Drug Interactions</TabsTrigger>
                  <TabsTrigger value="side-effects">Side Effects</TabsTrigger>
                  <TabsTrigger value="patient-specific">Patient-Specific Prescription Check</TabsTrigger>
                </TabsList>

                <TabsContent value="interactions" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="interaction-query">Medication list</Label>
                    <textarea
                      id="interaction-query"
                      className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      value={interactionQuery}
                      onChange={(event) => setInteractionQuery(event.target.value)}
                      placeholder="ibuprofen, warfarin"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={() => void submitInteractionCheck()}
                    disabled={interactionState.loading}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Check Interactions
                  </Button>
                  <ApiError message={interactionState.error} />
                  {interactionState.result ? <InteractionResultPanel result={interactionState.result} /> : null}
                </TabsContent>

                <TabsContent value="side-effects" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="side-effect-drug">Medication name(s)</Label>
                    <Input
                      id="side-effect-drug"
                      value={sideEffectDrug}
                      onChange={(event) => setSideEffectDrug(event.target.value)}
                      placeholder="ibuprofen, warfarin"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={() => void submitSideEffectLookup()}
                    disabled={sideEffectState.loading}
                  >
                    <Pill className="h-4 w-4" />
                    Look Up Side Effects
                  </Button>
                  <ApiError message={sideEffectState.error} />
                  {sideEffectState.result ? (
                    <div className="space-y-3">
                      {sideEffectState.result.items.map((item) => (
                        <SideEffectItemCard key={item.normalized_drug} result={item} />
                      ))}
                      {sideEffectState.result.failures.length > 0 ? (
                        <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                          No side-effect entry was found for {sideEffectState.result.failures.join(", ")} in the current dataset.
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </TabsContent>

                <TabsContent value="patient-specific" className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="prescription-patient">Patient ID</Label>
                      <Input
                        id="prescription-patient"
                        value={prescriptionSafetyDraft.patient_id}
                        onChange={(event) => updatePrescriptionSafetyField("patient_id", event.target.value)}
                        placeholder="P000012"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="prescription-drug">Medication list</Label>
                      <Input
                        id="prescription-drug"
                        value={prescriptionSafetyDraft.medicationList}
                        onChange={(event) => updatePrescriptionSafetyField("medicationList", event.target.value)}
                        placeholder="methylphenidate, ibuprofen"
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={() => void submitPrescriptionSafetyCheck()}
                    disabled={prescriptionSafetyState.loading}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Check Patient-Specific Safety
                  </Button>
                  <ApiError message={prescriptionSafetyState.error} />
                  {prescriptionSafetyState.result ? (
                    <div className="space-y-3">
                      <PatientHistorySummary history={prescriptionSafetyState.result.items[0]?.patient_history} />
                      {prescriptionSafetyState.result.items.map((item) => (
                        <PrescriptionSafetyResultPanel key={item.normalized_drug} result={item} showHealthRecord={false} />
                      ))}
                      {prescriptionSafetyState.result.failures.length > 0 ? (
                        <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                          Unable to check {prescriptionSafetyState.result.failures.join(", ")} with the current dataset.
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
