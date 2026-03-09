/**
 * Workspace Live Stream Service
 * Streams real-time system activity via Socket.IO for the cyberpunk workspace panel
 * 
 * Events emitted:
 * - workspace:gpu       → GPU utilization, VRAM, temperature, loaded models
 * - workspace:services  → PM2 service status (all services)
 * - workspace:terminal  → Live terminal output from system (journalctl, OpenClaw gateway)
 * - workspace:openclaw  → OpenClaw session activity (messages, model usage, costs)
 * - workspace:system    → CPU, RAM, disk, uptime
 * - workspace:activity  → Recent file changes, git commits, coding activity
 */

import { Server, Socket } from "socket.io";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";

const execAsync = promisify(exec);

// ============================================================================
// Types
// ============================================================================

interface GpuInfo {
  index: number;
  name: string;
  memUsed: number;
  memTotal: number;
  utilization: number;
  temperature: number;
  power: number;
  models: string[];
}

interface ServiceInfo {
  name: string;
  status: "online" | "stopped" | "errored";
  cpu: string;
  memory: string;
  restarts: number;
  uptime: string;
  pid: number;
}

interface SystemInfo {
  cpuUsage: number;
  memUsed: number;
  memTotal: number;
  diskUsed: number;
  diskTotal: number;
  uptime: string;
  loadAvg: number[];
}

interface OpenClawActivity {
  activeSession: string | null;
  model: string;
  messageCount: number;
  lastMessage: string;
  lastMessageTime: number;
  thinking: boolean;
  cost: number;
}

interface TerminalLine {
  id: string;
  timestamp: number;
  source: "gateway" | "system" | "openclaw" | "gpu";
  content: string;
  level: "info" | "warn" | "error" | "debug";
}

interface FileActivity {
  path: string;
  action: "modified" | "created" | "deleted";
  timestamp: number;
  size?: number;
}

// ============================================================================
// Collectors
// ============================================================================

let terminalLineId = 0;

async function collectGpuInfo(): Promise<GpuInfo[]> {
  try {
    const { stdout } = await execAsync(
      "nvidia-smi --query-gpu=index,name,memory.used,memory.total,utilization.gpu,temperature.gpu,power.draw --format=csv,noheader,nounits 2>/dev/null"
    );
    const gpus = stdout.trim().split("\n").map(line => {
      const [index, name, memUsed, memTotal, util, temp, power] = line.split(", ").map(s => s.trim());
      return {
        index: parseInt(index),
        name,
        memUsed: parseInt(memUsed),
        memTotal: parseInt(memTotal),
        utilization: parseInt(util),
        temperature: parseInt(temp),
        power: parseFloat(power),
        models: [] as string[],
      };
    });

    // Get loaded Ollama models
    try {
      const { stdout: ollamaOut } = await execAsync(
        'curl -s http://localhost:11434/api/ps 2>/dev/null'
      );
      const ollamaData = JSON.parse(ollamaOut);
      for (const model of ollamaData.models || []) {
        // Assign to GPU0 by default (Ollama uses GPU0)
        if (gpus[0]) {
          gpus[0].models.push(model.name);
        }
      }
    } catch (_) {}

    // GPU1 has embeddings + reranker
    if (gpus[1]) {
      gpus[1].models.push("nomic-embed-text-v1.5", "bge-reranker-v2-m3");
    }

    return gpus;
  } catch (e) {
    return [];
  }
}

async function collectServices(): Promise<ServiceInfo[]> {
  try {
    const { stdout } = await execAsync(
      "pm2 jlist 2>/dev/null"
    );
    const procs = JSON.parse(stdout);
    return procs.map((p: any) => ({
      name: p.name,
      status: p.pm2_env?.status || "unknown",
      cpu: `${p.monit?.cpu || 0}%`,
      memory: formatBytes(p.monit?.memory || 0),
      restarts: p.pm2_env?.restart_time || 0,
      uptime: p.pm2_env?.pm_uptime ? formatUptime(Date.now() - p.pm2_env.pm_uptime) : "—",
      pid: p.pid || 0,
    }));
  } catch (e) {
    return [];
  }
}

async function collectSystem(): Promise<SystemInfo> {
  try {
    const { stdout: memOut } = await execAsync("free -b | grep Mem");
    const memParts = memOut.trim().split(/\s+/);
    const memTotal = parseInt(memParts[1]);
    const memUsed = parseInt(memParts[2]);

    const { stdout: diskOut } = await execAsync("df -B1 / | tail -1");
    const diskParts = diskOut.trim().split(/\s+/);
    const diskTotal = parseInt(diskParts[1]);
    const diskUsed = parseInt(diskParts[2]);

    const { stdout: loadOut } = await execAsync("cat /proc/loadavg");
    const loadParts = loadOut.trim().split(/\s+/);
    const loadAvg = loadParts.slice(0, 3).map(Number);

    const { stdout: uptimeOut } = await execAsync("uptime -p");

    // CPU usage from /proc/stat (simplified)
    const { stdout: cpuOut } = await execAsync(
      "top -bn1 | grep 'Cpu(s)' | awk '{print $2}'"
    );
    const cpuUsage = parseFloat(cpuOut.trim()) || 0;

    return {
      cpuUsage,
      memUsed,
      memTotal,
      diskUsed,
      diskTotal,
      uptime: uptimeOut.trim(),
      loadAvg,
    };
  } catch (e) {
    return { cpuUsage: 0, memUsed: 0, memTotal: 0, diskUsed: 0, diskTotal: 0, uptime: "unknown", loadAvg: [0, 0, 0] };
  }
}

async function collectOpenClawActivity(): Promise<OpenClawActivity> {
  try {
    const sessionsDir = "/home/josh/.openclaw/agents/main/sessions";
    const files = fs.readdirSync(sessionsDir)
      .filter(f => f.endsWith(".json"))
      .map(f => ({ name: f, mtime: fs.statSync(path.join(sessionsDir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);

    const latest = files[0];
    if (!latest) return { activeSession: null, model: "unknown", messageCount: 0, lastMessage: "", lastMessageTime: 0, thinking: false, cost: 0 };

    const content = fs.readFileSync(path.join(sessionsDir, latest.name), "utf8");
    const session = JSON.parse(content);
    const messages = session.messages || [];
    const lastMsg = messages[messages.length - 1];

    return {
      activeSession: latest.name.replace(".json", ""),
      model: session.model || "unknown",
      messageCount: messages.length,
      lastMessage: lastMsg?.content?.substring(0, 200) || "",
      lastMessageTime: latest.mtime,
      thinking: false,
      cost: session.totalCost || 0,
    };
  } catch (e) {
    return { activeSession: null, model: "unknown", messageCount: 0, lastMessage: "", lastMessageTime: 0, thinking: false, cost: 0 };
  }
}

async function collectRecentActivity(): Promise<FileActivity[]> {
  try {
    const { stdout } = await execAsync(
      "find /home/josh/.openclaw/workspace -maxdepth 3 -type f -mmin -30 -printf '%T@ %s %p\\n' 2>/dev/null | sort -rn | head -20"
    );
    return stdout.trim().split("\n").filter(Boolean).map(line => {
      const parts = line.split(" ");
      const timestamp = parseFloat(parts[0]) * 1000;
      const size = parseInt(parts[1]);
      const filePath = parts.slice(2).join(" ");
      return {
        path: filePath.replace("/home/josh/", "~/"),
        action: "modified" as const,
        timestamp,
        size,
      };
    });
  } catch (e) {
    return [];
  }
}

// Tail the gateway log for live terminal feed
let gatewayLogOffset = 0;
const GATEWAY_LOG_PATH = "/tmp/openclaw";

async function collectGatewayLog(): Promise<TerminalLine[]> {
  const lines: TerminalLine[] = [];
  try {
    const today = new Date().toISOString().split("T")[0];
    const logPath = path.join(GATEWAY_LOG_PATH, `openclaw-${today}.log`);
    if (!fs.existsSync(logPath)) return lines;

    const stat = fs.statSync(logPath);
    if (stat.size <= gatewayLogOffset) return lines;

    // Read new bytes
    const fd = fs.openSync(logPath, "r");
    const bufSize = Math.min(stat.size - gatewayLogOffset, 8192); // Max 8KB per poll
    const buf = Buffer.alloc(bufSize);
    fs.readSync(fd, buf, 0, bufSize, gatewayLogOffset);
    fs.closeSync(fd);
    gatewayLogOffset = stat.size;

    const newContent = buf.toString("utf8");
    for (const rawLine of newContent.split("\n").filter(Boolean)) {
      try {
        const parsed = JSON.parse(rawLine);
        const msg = parsed["1"] || parsed["0"] || "";
        if (typeof msg !== "string") continue;
        const level = parsed._meta?.logLevelName === "ERROR" ? "error" 
                    : parsed._meta?.logLevelName === "WARN" ? "warn" 
                    : parsed._meta?.logLevelName === "DEBUG" ? "debug" 
                    : "info";
        lines.push({
          id: `gw-${++terminalLineId}`,
          timestamp: new Date(parsed.time || Date.now()).getTime(),
          source: "gateway",
          content: msg.substring(0, 500),
          level,
        });
      } catch (_) {
        // Non-JSON line
        lines.push({
          id: `gw-${++terminalLineId}`,
          timestamp: Date.now(),
          source: "gateway",
          content: rawLine.substring(0, 500),
          level: "info",
        });
      }
    }
  } catch (e) {}
  return lines;
}

// ============================================================================
// Helpers
// ============================================================================

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)}KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)}MB`;
  return `${(bytes / 1073741824).toFixed(1)}GB`;
}

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
}

// ============================================================================
// Socket.IO Integration
// ============================================================================

let workspaceIntervals: NodeJS.Timeout[] = [];

export function initializeWorkspaceStream(io: Server): void {
  // Create a namespace for workspace
  const wsNs = io.of("/workspace");

  wsNs.on("connection", (socket: Socket) => {
    console.log(`[Workspace] Client connected: ${socket.id}`);

    // Send initial snapshot immediately
    sendSnapshot(socket);

    // Handle terminal command execution
    socket.on("workspace:exec", async (data: { command: string }) => {
      try {
        const { stdout, stderr } = await execAsync(data.command, { timeout: 10000 });
        socket.emit("workspace:exec_result", {
          command: data.command,
          stdout: stdout.substring(0, 4096),
          stderr: stderr.substring(0, 1024),
          timestamp: Date.now(),
        });
      } catch (e: any) {
        socket.emit("workspace:exec_result", {
          command: data.command,
          stdout: "",
          stderr: e.message?.substring(0, 1024) || "Command failed",
          timestamp: Date.now(),
        });
      }
    });

    socket.on("disconnect", () => {
      console.log(`[Workspace] Client disconnected: ${socket.id}`);
    });
  });

  // Periodic broadcasts to all connected workspace clients
  // GPU + System: every 3 seconds
  workspaceIntervals.push(
    setInterval(async () => {
      if (wsNs.sockets.size === 0) return; // No clients, skip
      const [gpus, system] = await Promise.all([collectGpuInfo(), collectSystem()]);
      wsNs.emit("workspace:gpu", gpus);
      wsNs.emit("workspace:system", system);
    }, 3000)
  );

  // Services: every 5 seconds
  workspaceIntervals.push(
    setInterval(async () => {
      if (wsNs.sockets.size === 0) return;
      const services = await collectServices();
      wsNs.emit("workspace:services", services);
    }, 5000)
  );

  // OpenClaw activity: every 4 seconds
  workspaceIntervals.push(
    setInterval(async () => {
      if (wsNs.sockets.size === 0) return;
      const activity = await collectOpenClawActivity();
      wsNs.emit("workspace:openclaw", activity);
    }, 4000)
  );

  // Gateway log tail: every 2 seconds
  workspaceIntervals.push(
    setInterval(async () => {
      if (wsNs.sockets.size === 0) return;
      const lines = await collectGatewayLog();
      if (lines.length > 0) {
        wsNs.emit("workspace:terminal", lines);
      }
    }, 2000)
  );

  // File activity: every 10 seconds
  workspaceIntervals.push(
    setInterval(async () => {
      if (wsNs.sockets.size === 0) return;
      const activity = await collectRecentActivity();
      wsNs.emit("workspace:activity", activity);
    }, 10000)
  );

  console.log("[Workspace] Live stream service initialized");
}

async function sendSnapshot(socket: Socket): Promise<void> {
  try {
    const [gpus, system, services, openclaw, activity] = await Promise.all([
      collectGpuInfo(),
      collectSystem(),
      collectServices(),
      collectOpenClawActivity(),
      collectRecentActivity(),
    ]);
    socket.emit("workspace:gpu", gpus);
    socket.emit("workspace:system", system);
    socket.emit("workspace:services", services);
    socket.emit("workspace:openclaw", openclaw);
    socket.emit("workspace:activity", activity);
  } catch (e) {
    console.error("[Workspace] Snapshot error:", e);
  }
}
