import { exec, spawn } from "child_process";
import { promisify } from "util";
import * as path from "path";
import * as crypto from "crypto";

const execAsync = promisify(exec);

const SANDBOX_IMAGE = process.env.SANDBOX_IMAGE || "rasputin-sandbox:latest";
const SANDBOX_NETWORK = process.env.SANDBOX_NETWORK || "none";
const DEFAULT_TIMEOUT_MS = 60000;
const DEFAULT_MEMORY_LIMIT = "512m";
const DEFAULT_CPU_LIMIT = "1.0";
const CONTAINER_PREFIX = "jarvis-sandbox-";

export interface SandboxConfig {
  timeoutMs?: number;
  memoryLimit?: string;
  cpuLimit?: string;
  networkEnabled?: boolean;
  workspacePath?: string;
  env?: Record<string, string>;
}

export interface SandboxResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  containerId?: string;
  error?: string;
}

interface ActiveContainer {
  id: string;
  createdAt: Date;
  workspacePath?: string;
  timeoutHandle?: NodeJS.Timeout;
}

const activeContainers = new Map<string, ActiveContainer>();

async function isDockerAvailable(): Promise<boolean> {
  try {
    await execAsync("docker info", { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

async function imagePulledOrBuilt(): Promise<boolean> {
  try {
    const { stdout } = await execAsync(`docker images -q ${SANDBOX_IMAGE}`, {
      timeout: 10000,
    });
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

export async function buildSandboxImage(): Promise<string> {
  const dockerfilePath = path.join(__dirname, "Dockerfile");

  try {
    const { stdout, stderr } = await execAsync(
      `docker build -t ${SANDBOX_IMAGE} -f ${dockerfilePath} ${__dirname}`,
      { timeout: 300000, maxBuffer: 10 * 1024 * 1024 }
    );
    return `Sandbox image built successfully.\n${stdout}\n${stderr}`;
  } catch (error) {
    const err = error as { message?: string; stderr?: string };
    throw new Error(
      `Failed to build sandbox image: ${err.message || err.stderr}`
    );
  }
}

export async function ensureSandboxReady(): Promise<void> {
  const dockerAvailable = await isDockerAvailable();
  if (!dockerAvailable) {
    throw new Error(
      "Docker is not available. Sandbox execution requires Docker."
    );
  }

  const imageExists = await imagePulledOrBuilt();
  if (!imageExists) {
    await buildSandboxImage();
  }
}

function generateContainerId(): string {
  return CONTAINER_PREFIX + crypto.randomBytes(8).toString("hex");
}

export async function executeInSandbox(
  command: string,
  config: SandboxConfig = {}
): Promise<SandboxResult> {
  const startTime = Date.now();
  const containerId = generateContainerId();

  const timeoutMs = config.timeoutMs || DEFAULT_TIMEOUT_MS;
  const memoryLimit = config.memoryLimit || DEFAULT_MEMORY_LIMIT;
  const cpuLimit = config.cpuLimit || DEFAULT_CPU_LIMIT;
  const network = config.networkEnabled ? "bridge" : SANDBOX_NETWORK;

  try {
    await ensureSandboxReady();
  } catch (error) {
    return {
      success: false,
      stdout: "",
      stderr: "",
      exitCode: 1,
      durationMs: Date.now() - startTime,
      error: `Sandbox not ready: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const dockerArgs = [
    "run",
    "--rm",
    "--name",
    containerId,
    "--memory",
    memoryLimit,
    "--cpus",
    cpuLimit,
    "--network",
    network,
    "--pids-limit",
    "100",
    "--read-only",
    "--tmpfs",
    "/tmp:rw,noexec,nosuid,size=100m",
    "--security-opt",
    "no-new-privileges:true",
    "--cap-drop",
    "ALL",
  ];

  if (config.workspacePath) {
    dockerArgs.push("-v", `${config.workspacePath}:/workspace:rw`);
    const uid = process.getuid?.() ?? 1000;
    const gid = process.getgid?.() ?? 1000;
    dockerArgs.push("--user", `${uid}:${gid}`);
  }

  if (config.env) {
    for (const [key, value] of Object.entries(config.env)) {
      dockerArgs.push("-e", `${key}=${value}`);
    }
  }

  dockerArgs.push(SANDBOX_IMAGE, "/bin/bash", "-c", command);

  return new Promise(resolve => {
    let stdout = "";
    let stderr = "";
    let killed = false;

    const proc = spawn("docker", dockerArgs, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    activeContainers.set(containerId, {
      id: containerId,
      createdAt: new Date(),
      workspacePath: config.workspacePath,
    });

    const timeoutHandle = setTimeout(async () => {
      killed = true;
      proc.kill("SIGKILL");
      await execAsync(`docker kill ${containerId}`, { timeout: 5000 }).catch(
        () => {}
      );
    }, timeoutMs);

    proc.stdout?.on("data", data => {
      stdout += data.toString();
      if (stdout.length > 1024 * 1024) {
        stdout = stdout.slice(-1024 * 1024);
      }
    });

    proc.stderr?.on("data", data => {
      stderr += data.toString();
      if (stderr.length > 1024 * 1024) {
        stderr = stderr.slice(-1024 * 1024);
      }
    });

    proc.on("close", exitCode => {
      clearTimeout(timeoutHandle);
      activeContainers.delete(containerId);

      const durationMs = Date.now() - startTime;

      if (killed) {
        resolve({
          success: false,
          stdout,
          stderr,
          exitCode: exitCode ?? 137,
          durationMs,
          containerId,
          error: `Execution timed out after ${timeoutMs}ms`,
        });
        return;
      }

      resolve({
        success: exitCode === 0,
        stdout,
        stderr,
        exitCode: exitCode ?? 1,
        durationMs,
        containerId,
      });
    });

    proc.on("error", error => {
      clearTimeout(timeoutHandle);
      activeContainers.delete(containerId);

      resolve({
        success: false,
        stdout,
        stderr,
        exitCode: 1,
        durationMs: Date.now() - startTime,
        containerId,
        error: error.message,
      });
    });
  });
}

export async function executePythonInSandbox(
  code: string,
  config: SandboxConfig = {}
): Promise<SandboxResult> {
  const escapedCode = code.replace(/'/g, "'\"'\"'");
  const cdPrefix = config.workspacePath ? "cd /workspace && " : "";
  const command = `${cdPrefix}python3 -c '${escapedCode}'`;
  return executeInSandbox(command, config);
}

export async function executeNodeInSandbox(
  code: string,
  config: SandboxConfig = {}
): Promise<SandboxResult> {
  const escapedCode = code.replace(/'/g, "'\"'\"'");
  const cdPrefix = config.workspacePath ? "cd /workspace && " : "";
  const command = `${cdPrefix}node -e '${escapedCode}'`;
  return executeInSandbox(command, config);
}

export async function executeShellInSandbox(
  script: string,
  config: SandboxConfig = {}
): Promise<SandboxResult> {
  const cdPrefix = config.workspacePath ? "cd /workspace && " : "";
  const command = `${cdPrefix}${script}`;
  return executeInSandbox(command, config);
}

export async function cleanupStaleContainers(): Promise<number> {
  try {
    const { stdout } = await execAsync(
      `docker ps -a --filter "name=${CONTAINER_PREFIX}" --format "{{.ID}}"`,
      { timeout: 10000 }
    );

    const containerIds = stdout.trim().split("\n").filter(Boolean);

    if (containerIds.length === 0) {
      return 0;
    }

    await execAsync(`docker rm -f ${containerIds.join(" ")}`, {
      timeout: 30000,
    });

    return containerIds.length;
  } catch {
    return 0;
  }
}

export function getActiveContainers(): Array<{
  id: string;
  createdAt: Date;
  workspacePath?: string;
}> {
  return Array.from(activeContainers.values()).map(c => ({
    id: c.id,
    createdAt: c.createdAt,
    workspacePath: c.workspacePath,
  }));
}

export async function killContainer(containerId: string): Promise<boolean> {
  try {
    await execAsync(`docker kill ${containerId}`, { timeout: 10000 });
    activeContainers.delete(containerId);
    return true;
  } catch {
    return false;
  }
}

export async function getSandboxStatus(): Promise<{
  dockerAvailable: boolean;
  imageBuilt: boolean;
  activeContainers: number;
}> {
  const dockerAvailable = await isDockerAvailable();
  const imageBuilt = dockerAvailable ? await imagePulledOrBuilt() : false;

  return {
    dockerAvailable,
    imageBuilt,
    activeContainers: activeContainers.size,
  };
}
