import { spawnSync } from "child_process";
import path from "path";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  callMedicalBackend,
  ensureMedicalBackendRunning,
  resolveBridgeScript,
  resolvePythonExecutable,
} from "@/lib/python-bridge";

export const runtime = "nodejs";

const requestSchema = z.object({
  patient_id: z.union([z.string(), z.number()]).optional(),
  patientId: z.union([z.string(), z.number()]).optional(),
  timestamp: z.string().min(1),
  temperature: z.number().optional(),
  heartRate: z.number().optional(),
  heart_rate: z.number().optional(),
  fallDetected: z.boolean().optional(),
  fall_detected: z.boolean().optional(),
  age: z.number().optional(),
  gender: z.string().optional(),
  topK: z.number().int().positive().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = requestSchema.parse(body);
    await ensureMedicalBackendRunning();
    const backendResponse = await callMedicalBackend<{ success?: boolean }>("/medical/early-warning", data);
    if (backendResponse) {
      return NextResponse.json(backendResponse, { status: backendResponse.success ? 200 : 400 });
    }

    const scriptPath = resolveBridgeScript("run_early_warning.py");

    if (!scriptPath) {
      return NextResponse.json({ error: "Early-warning bridge script was not found." }, { status: 500 });
    }

    const projectRoot = path.dirname(path.dirname(scriptPath));
    const command = resolvePythonExecutable(projectRoot);
    const result = spawnSync(command, [scriptPath], {
      input: JSON.stringify(data),
      encoding: "utf-8",
      cwd: projectRoot,
    });

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    const parsed = JSON.parse(result.stdout || "{}");
    if (result.status !== 0) {
      return NextResponse.json(
        { error: parsed.error || "Python early-warning workflow failed." },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed, { status: parsed.success ? 200 : 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
