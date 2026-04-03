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
  query: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = requestSchema.parse(body);
    await ensureMedicalBackendRunning();
    const backendResponse = await callMedicalBackend("/medical/chat", data);
    if (backendResponse) {
      return NextResponse.json(backendResponse, { status: 200 });
    }

    const scriptPath = resolveBridgeScript("run_medical_chat.py");

    if (!scriptPath) {
      return NextResponse.json({ error: "Medical chat bridge script was not found." }, { status: 500 });
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
        { error: parsed.error || "Python medical chat workflow failed." },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed, { status: 200 });
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
