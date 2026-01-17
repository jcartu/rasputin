/**
 * JARVIS Desktop Daemon Client
 *
 * Communicates with the Rust gRPC daemon for desktop automation.
 * Uses HTTP/JSON bridge for simpler TypeScript integration.
 */

const DAEMON_URL = process.env.JARVIS_DAEMON_URL || "http://localhost:50051";

interface DaemonCapability {
  token: string;
  scopes: string[];
  expiresAt: number;
  sessionId: string;
  userId: string;
}

interface DaemonStatus {
  success: boolean;
  message: string;
  errorCode?: string;
}

interface Display {
  id: number;
  name: string;
  width: number;
  height: number;
  scale: number;
  primary: boolean;
}

interface Point {
  x: number;
  y: number;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Window {
  id: string;
  title: string;
  appName: string;
  processName: string;
  pid: number;
  bounds: Rect;
  focused: boolean;
  minimized: boolean;
  maximized: boolean;
  displayId: number;
}

interface FileInfo {
  path: string;
  name: string;
  isDir: boolean;
  size: number;
  modifiedMs: number;
  createdMs: number;
  permissions: string;
}

interface ProcessInfo {
  pid: number;
  ppid: number;
  name: string;
  cmdline: string;
  user: string;
  cpuPercent: number;
  memoryBytes: number;
  startedMs: number;
  status: string;
}

interface ShellExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

interface Screenshot {
  imageData: string;
  timestampMs: number;
  display?: Display;
  capturedRegion?: Rect;
}

let cachedCapability: DaemonCapability | null = null;

async function getCapability(): Promise<DaemonCapability> {
  if (cachedCapability && cachedCapability.expiresAt > Date.now()) {
    return cachedCapability;
  }

  const response = await fetch(`${DAEMON_URL}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: "jarvis",
      sessionId: `jarvis-${Date.now()}`,
      scopes: ["screen", "input", "window", "file", "process", "clipboard"],
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to get daemon capability: ${response.statusText}`);
  }

  cachedCapability = await response.json();
  return cachedCapability!;
}

async function daemonRequest<T>(
  endpoint: string,
  body: Record<string, unknown>
): Promise<T> {
  const cap = await getCapability();
  const response = await fetch(`${DAEMON_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cap, ...body }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Daemon request failed: ${error}`);
  }

  return response.json();
}

export async function listDisplays(): Promise<Display[]> {
  const result = await daemonRequest<{ displays: Display[] }>(
    "/screen/list",
    {}
  );
  return result.displays;
}

export async function screenshot(options?: {
  displayId?: number;
  region?: Rect;
  format?: string;
  quality?: number;
  includeCursor?: boolean;
}): Promise<Screenshot> {
  return daemonRequest<Screenshot>("/screen/screenshot", options || {});
}

export async function mouseMove(
  x: number,
  y: number,
  options?: { displayId?: number; relative?: boolean; durationMs?: number }
): Promise<DaemonStatus> {
  return daemonRequest<DaemonStatus>("/input/mouse/move", {
    x,
    y,
    ...options,
  });
}

export async function mouseButton(
  button: "left" | "right" | "middle",
  action: "press" | "release" | "click" | "double_click",
  position?: Point,
  displayId?: number
): Promise<DaemonStatus> {
  return daemonRequest<DaemonStatus>("/input/mouse/button", {
    button,
    action,
    position,
    displayId,
  });
}

export async function mouseScroll(
  deltaX: number,
  deltaY: number,
  position?: Point,
  displayId?: number
): Promise<DaemonStatus> {
  return daemonRequest<DaemonStatus>("/input/mouse/scroll", {
    deltaX,
    deltaY,
    position,
    displayId,
  });
}

export async function keyboardKey(
  key: string,
  action: "press" | "release" | "tap",
  modifiers?: string[]
): Promise<DaemonStatus> {
  return daemonRequest<DaemonStatus>("/input/keyboard/key", {
    key,
    action,
    modifiers,
  });
}

export async function keyboardType(
  text: string,
  delayMs?: number
): Promise<DaemonStatus> {
  return daemonRequest<DaemonStatus>("/input/keyboard/type", {
    text,
    delayMs,
  });
}

export async function listWindows(options?: {
  includeMinimized?: boolean;
  includeHidden?: boolean;
  filterApp?: string;
}): Promise<Window[]> {
  const result = await daemonRequest<{ windows: Window[] }>(
    "/window/list",
    options || {}
  );
  return result.windows;
}

export async function focusWindow(windowId: string): Promise<DaemonStatus> {
  return daemonRequest<DaemonStatus>("/window/focus", { windowId });
}

export async function listFiles(
  path: string,
  options?: { recursive?: boolean; maxDepth?: number; pattern?: string }
): Promise<FileInfo[]> {
  const result = await daemonRequest<{ files: FileInfo[] }>("/file/list", {
    path,
    ...options,
  });
  return result.files;
}

export async function readFile(
  path: string,
  options?: { offset?: number; maxBytes?: number }
): Promise<{ data: string; truncated: boolean; totalSize: number }> {
  return daemonRequest("/file/read", { path, ...options });
}

export async function writeFile(
  path: string,
  data: string,
  options?: {
    createDirs?: boolean;
    atomic?: boolean;
    mode?: string;
    append?: boolean;
  }
): Promise<DaemonStatus> {
  return daemonRequest<DaemonStatus>("/file/write", {
    path,
    data,
    ...options,
  });
}

export async function listProcesses(options?: {
  filterName?: string;
  filterUser?: string;
}): Promise<ProcessInfo[]> {
  const result = await daemonRequest<{ processes: ProcessInfo[] }>(
    "/process/list",
    options || {}
  );
  return result.processes;
}

export async function startProcess(
  command: string,
  options?: {
    args?: string[];
    workingDir?: string;
    env?: Record<string, string>;
    detached?: boolean;
  }
): Promise<{ pid: number }> {
  return daemonRequest("/process/start", { command, ...options });
}

export async function killProcess(
  pid: number,
  signal?: string
): Promise<DaemonStatus> {
  return daemonRequest<DaemonStatus>("/process/kill", { pid, signal });
}

export async function shellExec(
  command: string,
  options?: {
    workingDir?: string;
    env?: Record<string, string>;
    timeoutSeconds?: number;
  }
): Promise<ShellExecResult> {
  return daemonRequest("/process/shell", { command, ...options });
}

export async function getClipboard(): Promise<{
  text: string;
  image?: string;
  mimeType: string;
}> {
  return daemonRequest("/clipboard/get", {});
}

export async function setClipboard(
  text?: string,
  image?: string
): Promise<DaemonStatus> {
  return daemonRequest<DaemonStatus>("/clipboard/set", { text, image });
}

export async function isDaemonAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${DAEMON_URL}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export const daemonClient = {
  listDisplays,
  screenshot,
  mouseMove,
  mouseButton,
  mouseScroll,
  keyboardKey,
  keyboardType,
  listWindows,
  focusWindow,
  listFiles,
  readFile,
  writeFile,
  listProcesses,
  startProcess,
  killProcess,
  shellExec,
  getClipboard,
  setClipboard,
  isDaemonAvailable,
};

export default daemonClient;
