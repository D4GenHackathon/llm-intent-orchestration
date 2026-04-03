import { existsSync } from "fs";
import path from "path";
import { spawn } from "child_process";

export function resolveProjectRoot(): string {
  let current = process.cwd();

  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(path.join(current, "scripts"))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return process.cwd();
}

export function resolvePythonExecutable(projectRoot: string): string {
  if (process.env.PYTHON_EXECUTABLE) {
    return process.env.PYTHON_EXECUTABLE;
  }

  const windowsVenvPython = path.join(projectRoot, ".venv", "Scripts", "python.exe");
  if (existsSync(windowsVenvPython)) {
    return windowsVenvPython;
  }

  const unixVenvPython = path.join(projectRoot, ".venv", "bin", "python");
  if (existsSync(unixVenvPython)) {
    return unixVenvPython;
  }

  return "python";
}

export function resolveBridgeScript(scriptName: string): string {
  let current = process.cwd();

  for (let depth = 0; depth < 8; depth += 1) {
    const candidate = path.join(current, "scripts", scriptName);
    if (existsSync(candidate)) {
      return candidate;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return "";
}

export function resolveMedicalBackendUrl(): string {
  return process.env.MEDICAL_BACKEND_URL || "http://127.0.0.1:8010";
}

export async function callMedicalBackend<T>(endpoint: string, payload: object): Promise<T | null> {
  const baseUrl = resolveMedicalBackendUrl();
  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const data = (await response.json()) as T;
    return data;
  } catch {
    return null;
  }
}

export async function ensureMedicalBackendRunning(): Promise<void> {
  const baseUrl = resolveMedicalBackendUrl();
  try {
    const healthResponse = await fetch(`${baseUrl}/health`, { cache: "no-store" });
    if (healthResponse.ok) {
      return;
    }
  } catch {
    // Backend is not up yet. Try to start it below.
  }

  const projectRoot = resolveProjectRoot();
  const pythonExecutable = resolvePythonExecutable(projectRoot);
  const backendScript = resolveBridgeScript("run_medical_backend.py");
  if (!backendScript) {
    return;
  }

  const child = spawn(pythonExecutable, [backendScript], {
    cwd: projectRoot,
    detached: true,
    stdio: "ignore",
  });
  child.unref();

  for (let attempt = 0; attempt < 10; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    try {
      const healthResponse = await fetch(`${baseUrl}/health`, { cache: "no-store" });
      if (healthResponse.ok) {
        return;
      }
    } catch {
      // keep retrying briefly
    }
  }
}
