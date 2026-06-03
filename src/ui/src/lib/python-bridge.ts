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

function legacyMedicalEndpoint(endpoint: string): string {
  if (endpoint === "/api/health") {
    return "/health";
  }
  if (endpoint.startsWith("/api/medical/")) {
    return endpoint.replace("/api/medical/", "/medical/");
  }
  return endpoint;
}

async function fetchJson<T>(baseUrl: string, endpoint: string, payload: object): Promise<T | null> {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (response.status === 404) {
    throw new Error("Medical backend endpoint was not found.");
  }
  return (await response.json()) as T;
}

export async function callMedicalBackend<T>(endpoint: string, payload: object): Promise<T | null> {
  const baseUrl = resolveMedicalBackendUrl();
  try {
    return await fetchJson<T>(baseUrl, endpoint, payload);
  } catch {
    const legacyEndpoint = legacyMedicalEndpoint(endpoint);
    if (legacyEndpoint === endpoint) {
      return null;
    }
    try {
      return await fetchJson<T>(baseUrl, legacyEndpoint, payload);
    } catch {
      return null;
    }
  }
}

async function isMedicalBackendHealthy(baseUrl: string): Promise<boolean> {
  for (const endpoint of ["/api/health", "/health"]) {
    try {
      const healthResponse = await fetch(`${baseUrl}${endpoint}`, { cache: "no-store" });
      if (healthResponse.ok) {
        return true;
      }
    } catch {
      // Try the next health endpoint.
    }
  }
  return false;
}

export async function ensureMedicalBackendRunning(): Promise<void> {
  const baseUrl = resolveMedicalBackendUrl();
  if (await isMedicalBackendHealthy(baseUrl)) {
    return;
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
    windowsHide: true,
  });
  child.unref();

  for (let attempt = 0; attempt < 10; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (await isMedicalBackendHealthy(baseUrl)) {
      return;
    }
  }
}
