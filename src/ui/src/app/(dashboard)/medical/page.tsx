"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { SendHorizonal, Stethoscope } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PairwiseInteraction = {
  drug_1: string;
  drug_2: string;
  mechanism: string | null;
  recommendation: string;
  description: string | null;
};

type InteractionResult = {
  normalized_drugs: string[];
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

type WorkflowEnvelope<T> = {
  success: boolean;
  message?: string;
  warnings?: string[];
  data?: {
    result?: T;
    patient_profile?: Record<string, string | number>;
  };
};

type MedicalChatResult = {
  query: string;
  planner_route?: string;
  intent: string;
  confidence: number;
  reasons: string[];
  extracted_drugs: string[];
  extracted_drug: string;
  patient_profile: Record<string, string | number>;
  workflow_response: WorkflowEnvelope<InteractionResult | SideEffectResult | HealthRiskResult>;
  formatted_answer: string;
  side_effect_items?: SideEffectResult[];
  side_effect_failures?: string[];
};

type ChatTask = "drug_interaction" | "side_effect_lookup" | "health_risk_prediction";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  result?: MedicalChatResult | null;
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

const idleState = <T,>(): ApiState<T> => ({
  loading: false,
  error: "",
  result: null,
});

function friendlyChatError(message: string): string {
  if (message.includes("At least two recognizable drugs are required for interaction checking.")) {
    return "I need at least two recognizable drugs to check interactions. Please try again or double-check the drug names for spelling";
  }

  if (message.includes("No side-effect entry was found in the current structured dataset.")) {
    return "I could not find a side-effect entry for that drug in the current dataset. Please try another drug name";
  }

  if (message.includes("No recognizable drug name was found for side-effect lookup.")) {
    return "I could not find side-effect data for that drug in the current dataset. Please try another drug name";
  }

  return `I ran into a problem while processing that request. ${message}`;
}

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

function ChatBubble({
  role,
  children,
}: {
  role: "user" | "assistant";
  children: ReactNode;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={
          isUser
            ? "max-w-3xl rounded-3xl rounded-br-md bg-violet-600 px-5 py-4 text-sm leading-7 text-white shadow-sm"
            : "max-w-3xl rounded-3xl rounded-bl-md border bg-white px-5 py-4 text-sm leading-7 text-slate-700 shadow-sm"
        }
      >
        {children}
      </div>
    </div>
  );
}

const TASK_OPTIONS: Array<{ id: ChatTask; label: string }> = [
  { id: "drug_interaction", label: "Drug Interactions" },
  { id: "side_effect_lookup", label: "Side Effects" },
  { id: "health_risk_prediction", label: "Health Risk" },
];

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
  temperature: "°C",
  consciousness: "AVPU / dataset code",
  on_oxygen: "Yes / No",
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

function taskPrompt(task: ChatTask): string {
  if (task === "drug_interaction") {
    return "Please give the list of drugs in the prescription, or type a medication question such as 'Does ibuprofen interact with warfarin?'";
  }
  if (task === "side_effect_lookup") {
    return "Please tell me the drug name you want to check, for example 'What are the side effects of doxycycline?'";
  }
  return "Please fill in the boxes below with the vital-sign profile.";
}

function nextStepPrompt(task: ChatTask | null): string {
  if (task === "drug_interaction") {
    return "You can paste another prescription if you want me to check more drug combinations.";
  }
  if (task === "side_effect_lookup") {
    return "You can send another drug name if you want to check a different medication.";
  }
  if (task === "health_risk_prediction") {
    return "You can send another vital-sign profile if you want me to assess a different patient.";
  }
  return "";
}

function followUpPromptForIntent(intent: string, activeTask: ChatTask | null): string {
  if (intent === "medical_concept_help" || intent === "small_talk" || intent === "help" || intent === "clarification") {
    return "";
  }

  if (isSupportedTaskIntent(intent)) {
    return nextStepPrompt(intent);
  }

  return nextStepPrompt(activeTask);
}

function isSmallTalkQuery(query: string): boolean {
  const normalized = query.trim().toLowerCase();
  return [
    "hello",
    "hi",
    "hey",
    "thanks",
    "thank you",
    "bye",
    "goodbye",
    "what can you do",
    "help",
  ].includes(normalized);
}

function normalizeDrugCandidate(candidate: string): string {
  return candidate
    .replace(/^(please\s+)?(check\s+)?(the\s+)?side effects?\s+(of|for)\s+/i, "")
    .replace(/^(side effects?\s+(of|for)\s+)/i, "")
    .replace(/[?.!]$/g, "")
    .trim();
}

function extractSideEffectDrugCandidates(query: string): string[] {
  const normalized = query.replace(/\band\b/gi, ",");
  const parts = normalized
    .split(/,|\n/)
    .map((part) => normalizeDrugCandidate(part))
    .filter(Boolean);
  return parts.length > 1 ? Array.from(new Set(parts)) : [];
}

function buildMultiDrugSideEffectChatResult(
  query: string,
  successes: SideEffectResult[],
  failures: string[],
): MedicalChatResult {
  const failureSummary =
    failures.length > 0 ? `No side-effect was found for ${failures.join(", ")} in the current dataset.` : "";
  return {
    query,
    intent: "side_effect_lookup",
    confidence: 0.99,
    reasons: ["Continued the active side-effect workflow with multiple medications."],
    extracted_drugs: successes.map((item) => item.normalized_drug).concat(failures),
    extracted_drug: "",
    patient_profile: {},
    workflow_response: {
      success: successes.length > 0,
      message:
        successes.length > 0
          ? "Multi-drug side-effect workflow completed."
          : "No structured side-effect entries were found for the submitted medications.",
      data: {},
      warnings: failures.length > 0 ? [failureSummary || `No structured side-effect entries were found.`] : [],
    },
    formatted_answer:
      successes.length > 0
        ? "I looked up side-effect information for the medication(s) you sent."
        : failureSummary || "No side-effect data was found in the current dataset.",
    side_effect_items: successes,
    side_effect_failures: failures,
  };
}

function normalizeSideEffectItem(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function missingHealthRiskFields(profile: PatientProfile): Array<{ key: string; label: string }> {
  return REQUIRED_HEALTH_RISK_FIELDS.filter(({ key }) => !(key in profile));
}

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

function summarizeHealthRiskDraft(draft: HealthRiskDraft): string {
  const parts: string[] = [];
  for (const { key, label } of REQUIRED_HEALTH_RISK_FIELDS) {
    const value = draft[key as keyof HealthRiskDraft].trim();
    if (!value) {
      continue;
    }
    parts.push(key === "consciousness" ? `${label} ${value}` : `${label} ${value}`);
  }
  return parts.join(", ");
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

function isSideEffectFallbackText(message: string): boolean {
  return message.toLowerCase().includes("no side-effect was found for");
}

function stripTrailingFollowUp(content: string, followUp: string): string {
  if (!followUp) {
    return content;
  }
  const trimmedContent = content.trimEnd();
  const trimmedFollowUp = followUp.trim();
  if (trimmedContent.endsWith(trimmedFollowUp)) {
    return trimmedContent.slice(0, trimmedContent.length - trimmedFollowUp.length).trimEnd();
  }
  return content;
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

function buildIncompleteHealthRiskChatResult(query: string, profile: PatientProfile): MedicalChatResult {
  const missing = missingHealthRiskFields(profile);
  const receivedCount = REQUIRED_HEALTH_RISK_FIELDS.length - missing.length;
  const missingLabels = missing.map((field) => field.label).join(", ");
  return {
    query,
    intent: "health_risk_prediction",
    confidence: 0.9,
    reasons: ["Continued the active health risk workflow.", `Still waiting for ${missing.length} required field(s).`],
    extracted_drugs: [],
    extracted_drug: "",
    patient_profile: profile,
    workflow_response: {
      success: false,
      message: `Health-risk case in progress: received ${receivedCount}/${REQUIRED_HEALTH_RISK_FIELDS.length} fields. Missing: ${missingLabels}.`,
      data: { patient_profile: profile },
      warnings: ["Send the missing values and I will combine them with the case you already started."],
    },
    formatted_answer: `Health-risk case in progress: received ${receivedCount}/${REQUIRED_HEALTH_RISK_FIELDS.length} fields. Missing: ${missingLabels}.`,
  };
}

function isSupportedTaskIntent(intent: string): intent is ChatTask {
  return intent === "drug_interaction" || intent === "side_effect_lookup" || intent === "health_risk_prediction";
}

function shouldSwitchTask(
  currentTask: ChatTask | null,
  previewResult: MedicalChatResult | null,
): boolean {
  if (!previewResult) {
    return false;
  }

  if (
    previewResult.intent === "small_talk" ||
    previewResult.intent === "help" ||
    previewResult.intent === "medical_concept_help"
  ) {
    return true;
  }

  if (!isSupportedTaskIntent(previewResult.intent) || previewResult.intent === currentTask) {
    return false;
  }

  return previewResult.confidence >= 0.75;
}

function buildChatResultFromTask(
  task: ChatTask,
  query: string,
  workflowResponse: WorkflowEnvelope<InteractionResult | SideEffectResult | HealthRiskResult>,
  patientProfileOverride?: PatientProfile,
): MedicalChatResult {
  if (task === "drug_interaction") {
    const result = workflowResponse.data?.result as InteractionResult | undefined;
    const normalizedDrugs = result?.normalized_drugs ?? [];
    const hasEnoughDrugs = normalizedDrugs.length >= 2;
    const interactingPairs = result?.interacting_pairs ?? [];
    const validPairs = interactingPairs.filter(
      (pair): pair is PairwiseInteraction => Boolean(pair && pair.drug_1 && pair.drug_2),
    );
    const pairLines =
      validPairs.length === 1
        ? [
            validPairs[0].description ?? validPairs[0].recommendation
              ? `I found a potential interaction between ${validPairs[0].drug_1} and ${validPairs[0].drug_2}. ${validPairs[0].description ?? validPairs[0].recommendation}`
              : `I found a potential interaction between ${validPairs[0].drug_1} and ${validPairs[0].drug_2}.`,
          ]
        : validPairs.length > 1
          ? [
              "I found potential interactions between:",
              ...validPairs.map(
                (pair) =>
                  `- ${pair.drug_1} and ${pair.drug_2}: ${pair.description ?? pair.recommendation}`,
              ),
            ]
          : [];
    return {
      query,
      intent: "drug_interaction",
      confidence: hasEnoughDrugs ? 0.99 : 0.85,
      reasons: [
        hasEnoughDrugs
          ? "Continued the active drug interaction workflow."
          : "The active drug interaction workflow needs at least two recognized drugs.",
      ],
      extracted_drugs: normalizedDrugs,
      extracted_drug: "",
      patient_profile: {},
      workflow_response: workflowResponse,
      formatted_answer: !hasEnoughDrugs
        ? "I need at least two recognized drugs to check interactions. Please send the prescription again with two or more medication names."
        : pairLines.length > 0
          ? pairLines.join("\n")
          : "I checked that prescription and could not find an interaction record in the current database.",
    };
  }

  if (task === "side_effect_lookup") {
    const result = workflowResponse.data?.result as SideEffectResult | undefined;
    const seekCareItems = new Set(
      (result?.groups.when_to_seek_care ?? []).map((item) => normalizeSideEffectItem(item)),
    );
    const seriousItems = (result?.groups.serious ?? []).filter(
      (item) => !seekCareItems.has(normalizeSideEffectItem(item)),
    );
    const sections = result
      ? [
          result.generic_name ? `Generic name: ${result.generic_name}` : "",
          result.groups.common.length > 0 ? `Common: ${result.groups.common.slice(0, 5).join("; ")}` : "",
          seriousItems.length > 0 ? `Serious: ${seriousItems.slice(0, 5).join("; ")}` : "",
          result.groups.rare.length > 0 ? `Rare: ${result.groups.rare.slice(0, 3).join("; ")}` : "",
          result.groups.when_to_seek_care.length > 0
            ? `When to seek care: ${result.groups.when_to_seek_care.slice(0, 3).join("; ")}`
            : "",
        ].filter(Boolean)
      : [];
    return {
      query,
      intent: "side_effect_lookup",
      confidence: 0.99,
      reasons: ["Continued the active side-effect workflow."],
      extracted_drugs: [],
      extracted_drug: result?.normalized_drug ?? query,
      patient_profile: {},
      workflow_response: workflowResponse,
      formatted_answer: result
        ? [`I looked up side-effect information for ${result.normalized_drug}.`, ...sections].join("\n")
        : "I tried to look up side-effect information for that medication.",
    };
  }

  const result = workflowResponse.data?.result as HealthRiskResult | undefined;
  const patientProfile = patientProfileOverride ?? workflowResponse.data?.patient_profile ?? {};
  const confidence =
    typeof result?.confidence === "number" ? `${Math.round(result.confidence * 100)}%` : "";
  return {
    query,
    intent: "health_risk_prediction",
    confidence: 0.99,
    reasons: ["Continued the active health risk workflow."],
    extracted_drugs: [],
    extracted_drug: "",
    patient_profile: patientProfile,
    workflow_response: workflowResponse,
    formatted_answer: result
      ? confidence
        ? `The trained model classifies this profile as ${result.predicted_risk} risk, with a confidence of ${confidence}.`
        : `The trained model classifies this profile as ${result.predicted_risk} risk.`
      : "I tried to assess the health risk from the information you sent.",
  };
}

export default function MedicalWorkflowsPage() {
  const [chatInput, setChatInput] = useState("");
  const [activeTask, setActiveTask] = useState<ChatTask | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello. What can I help you with today? You can choose one of the buttons above or send a message.",
    },
  ]);
  const [chatState, setChatState] = useState<ApiState<MedicalChatResult>>(idleState());
  const [healthRiskDraft, setHealthRiskDraft] = useState<HealthRiskDraft>(EMPTY_HEALTH_RISK_DRAFT);
  const healthRiskProgress = healthRiskDraftCompletion(healthRiskDraft);
  const healthRiskDraftValidation = validateHealthRiskDraft(healthRiskDraft);
  const canSubmitHealthRiskCase =
    healthRiskDraftValidation.missing.length === 0 && healthRiskDraftValidation.invalid.length === 0;

  function handleTaskSelection(task: ChatTask) {
    setActiveTask(task);
    setChatMessages((current) => [
      ...current,
      {
        id: `${task}-${Date.now()}`,
        role: "assistant",
        content: taskPrompt(task),
      },
    ]);
    if (task === "health_risk_prediction") {
      setHealthRiskDraft(EMPTY_HEALTH_RISK_DRAFT);
    } else {
      setHealthRiskDraft(EMPTY_HEALTH_RISK_DRAFT);
    }
  }

  function updateHealthRiskField(field: keyof HealthRiskDraft, value: string) {
    setHealthRiskDraft((current) => ({
      ...current,
      [field]: value,
    }));
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
      setChatState({
        loading: false,
        error: `Please fill in valid values before assessing health risk. ${problems}.`,
        result: null,
      });
      return;
    }
    const profile = buildHealthRiskProfileFromDraft(healthRiskDraft);
    const summary = summarizeHealthRiskDraft(healthRiskDraft) || "structured vital-sign profile";

    setChatMessages((current) => [
      ...current,
      {
        id: `user-${Date.now()}`,
        role: "user",
        content: summary,
      },
    ]);
    setChatState({ loading: true, error: "", result: null });

    try {
      let result: MedicalChatResult;
      if (missing.length === 0) {
        const workflowResponse = await postJson<ApiEnvelope<HealthRiskResult>>("/api/medical/health-risk", toHealthRiskPayload(profile));
        result = buildChatResultFromTask(
          "health_risk_prediction",
          summary,
          {
            success: workflowResponse.success,
            message: workflowResponse.message,
            data: {
              result: workflowResponse.data?.result,
              patient_profile: profile,
            },
            warnings: [],
          },
          profile,
        );
        setHealthRiskDraft(EMPTY_HEALTH_RISK_DRAFT);
      } else {
        result = buildIncompleteHealthRiskChatResult(summary, profile);
      }

      setChatState({ loading: false, error: "", result });
      setActiveTask("health_risk_prediction");
      setChatMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: result.formatted_answer,
          result,
        },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to assess health risk";
      const friendlyMessage = friendlyChatError(message);
      setChatState({
        loading: false,
        error: friendlyMessage,
        result: null,
      });
      setChatMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          content: friendlyMessage,
        },
      ]);
    }
  }

  async function runMedicalChat() {
    const query = chatInput.trim();
    if (!query) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: query,
    };

    setChatMessages((current) => [...current, userMessage]);
    setChatInput("");
    setChatState({ loading: true, error: "", result: null });
    try {
      let result: MedicalChatResult | null = null;
      const sideEffectCandidates = extractSideEffectDrugCandidates(query);
      const previewResponse = await postJson<ApiEnvelope<MedicalChatResult>>("/api/medical/chat", {
        query,
      });
      const previewResult = previewResponse.data?.result ?? null;

      if (
        (activeTask === "side_effect_lookup" || previewResult?.intent === "side_effect_lookup") &&
        sideEffectCandidates.length > 1
      ) {
        const successes: SideEffectResult[] = [];
        const failures: string[] = [];
        for (const candidate of sideEffectCandidates) {
          try {
            const response = await postJson<ApiEnvelope<SideEffectResult>>("/api/medical/side-effects", {
              drugName: candidate,
            });
            if (response.data?.result) {
              successes.push(response.data.result);
            } else {
              failures.push(candidate);
            }
          } catch {
            failures.push(candidate);
          }
        }
        result = buildMultiDrugSideEffectChatResult(query, successes, failures);
      } else if (shouldSwitchTask(activeTask, previewResult)) {
        result = previewResult;
      } else if (isSmallTalkQuery(query)) {
        result = previewResult;
      } else if (activeTask === "drug_interaction") {
        const response = await postJson<ApiEnvelope<InteractionResult>>("/api/medical/drug-interactions", {
          query,
        });
        result = buildChatResultFromTask(
          "drug_interaction",
          query,
          {
            success: response.success,
            message: response.message,
            data: response.data,
            warnings: [],
          },
        );
      } else if (activeTask === "side_effect_lookup") {
        if (sideEffectCandidates.length > 1) {
          const successes: SideEffectResult[] = [];
          const failures: string[] = [];
          for (const candidate of sideEffectCandidates) {
            try {
              const response = await postJson<ApiEnvelope<SideEffectResult>>("/api/medical/side-effects", {
                drugName: candidate,
              });
              if (response.data?.result) {
                successes.push(response.data.result);
              } else {
                failures.push(candidate);
              }
            } catch {
              failures.push(candidate);
            }
          }
          result = buildMultiDrugSideEffectChatResult(query, successes, failures);
        } else {
          const response = await postJson<ApiEnvelope<SideEffectResult>>("/api/medical/side-effects", {
            query,
          });
          result = buildChatResultFromTask(
            "side_effect_lookup",
            query,
            {
              success: response.success,
              message: response.message,
              data: response.data,
              warnings: [],
            },
          );
        }
      } else {
        result = previewResult;
      }

      setChatState({ loading: false, error: "", result });

      if (result) {
        const routedTask = isSupportedTaskIntent(result.intent) ? result.intent : null;
        const followUpPrompt = followUpPromptForIntent(result.intent, routedTask);
        setActiveTask(routedTask);
        if (routedTask !== "health_risk_prediction") {
          setHealthRiskDraft(EMPTY_HEALTH_RISK_DRAFT);
        }
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: [result.formatted_answer, followUpPrompt].filter(Boolean).join("\n\n"),
          result,
        };
        setChatMessages((current) => [...current, assistantMessage]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to route medical query";
      const friendlyMessage = friendlyChatError(message);
      setChatState({
        loading: false,
        error: friendlyMessage,
        result: null,
      });
      setChatMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          content: friendlyMessage,
        },
      ]);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Medical Assistant</h1>
      </div>

      <Card className="border-l-4 border-l-violet-500">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-violet-100 p-2 text-violet-700">
              <Stethoscope className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Medical Assistant</CardTitle>
              <CardDescription>Ask a question or choose one of the buttons above.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-3xl border bg-gradient-to-b from-slate-50 to-white p-4">
            <div className="mb-4 flex flex-wrap gap-2">
              {TASK_OPTIONS.map((task) => (
                <Button
                  key={task.id}
                  type="button"
                  variant={activeTask === task.id ? "default" : "outline"}
                  onClick={() => handleTaskSelection(task.id)}
                >
                  {task.label}
                </Button>
              ))}
            </div>
            <div className="max-h-[28rem] space-y-4 overflow-y-auto pr-2">
              {chatMessages.map((message) => (
                <div key={message.id} className="space-y-2">
                  <ChatBubble role={message.role}>
                    {message.result?.intent === "side_effect_lookup" &&
                    Array.isArray(message.result.side_effect_items) &&
                    message.result.side_effect_items.length > 0 ? (
                      <div className="space-y-3">
                        <div className="whitespace-pre-wrap">
                          {stripTrailingFollowUp(
                            message.content,
                            followUpPromptForIntent(message.result.intent, activeTask),
                          )}
                        </div>
                        <div className="space-y-3">
                          {message.result.side_effect_items.map((item) => (
                            <SideEffectItemCard key={item.normalized_drug} result={item} />
                          ))}
                        </div>
                        {message.result.side_effect_failures && message.result.side_effect_failures.length > 0 ? (
                          <div className="text-sm text-slate-600">
                            No side-effect was found for {message.result.side_effect_failures.join(", ")} in the current dataset.
                          </div>
                        ) : null}
                        {followUpPromptForIntent(message.result.intent, activeTask) ? (
                          <div className="text-sm text-slate-600">
                            {followUpPromptForIntent(message.result.intent, activeTask)}
                          </div>
                        ) : null}
                      </div>
                    ) : message.result?.intent === "side_effect_lookup" &&
                      Array.isArray(message.result.side_effect_failures) &&
                      message.result.side_effect_failures.length > 0 ? (
                      <div className="space-y-3">
                        <div className="whitespace-pre-wrap">
                          {stripTrailingFollowUp(
                            message.content,
                            followUpPromptForIntent(message.result.intent, activeTask),
                          )}
                        </div>
                        {followUpPromptForIntent(message.result.intent, activeTask) ? (
                          <div className="text-sm text-slate-600">
                            {followUpPromptForIntent(message.result.intent, activeTask)}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap">{message.content}</div>
                    )}
                  </ChatBubble>
                </div>
              ))}
              {chatState.loading ? <ChatBubble role="assistant">Working on that now...</ChatBubble> : null}
            </div>
          </div>
          {activeTask === "health_risk_prediction" ? (
            <div className="space-y-3 rounded-2xl border bg-slate-50 p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <Label>Vital-Sign Profile</Label>
                  <p className="text-sm text-slate-500">
                    Please fill in the boxes below with the vital-sign profile.
                  </p>
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
                    disabled={chatState.loading || !canSubmitHealthRiskCase}
                  >
                    Assess Health Risk
                  </Button>
                  <p className={`text-sm ${canSubmitHealthRiskCase ? "text-emerald-600" : "text-red-600"}`}>
                    {canSubmitHealthRiskCase
                      ? "All fields are valid. Ready to assess."
                      : [
                          healthRiskDraftValidation.missing.length > 0
                            ? `Missing: ${healthRiskDraftValidation.missing.join(", ")}`
                            : "",
                          healthRiskDraftValidation.invalid.length > 0
                            ? `Invalid values: ${healthRiskDraftValidation.invalid.join(", ")}`
                            : "",
                        ]
                          .filter(Boolean)
                          .join(". ")}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="chat-query">Message</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="chat-query"
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  placeholder="Type your question here..."
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !chatState.loading) {
                      void runMedicalChat();
                    }
                  }}
                />
                <Button
                  type="button"
                  size="icon"
                  onClick={runMedicalChat}
                  disabled={chatState.loading}
                  aria-label="Send message"
                >
                  <SendHorizonal className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
          {chatState.error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {chatState.error}
            </div>
          ) : null}

          {activeTask === "health_risk_prediction" ? (
            <div className="space-y-2">
              <Label htmlFor="chat-query">Message</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="chat-query"
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  placeholder="Type a follow-up message here..."
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !chatState.loading) {
                      void runMedicalChat();
                    }
                  }}
                />
                <Button
                  type="button"
                  size="icon"
                  onClick={runMedicalChat}
                  disabled={chatState.loading}
                  aria-label="Send message"
                >
                  <SendHorizonal className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
