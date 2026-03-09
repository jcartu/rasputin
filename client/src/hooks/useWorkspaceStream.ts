/**
 * useWorkspaceStream - Real-time workspace data via Socket.IO /workspace namespace
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";

// ============================================================================
// Types
// ============================================================================

export interface GpuInfo {
  index: number;
  name: string;
  memUsed: number;
  memTotal: number;
  utilization: number;
  temperature: number;
  power: number;
  models: string[];
}

export interface ServiceInfo {
  name: string;
  status: "online" | "stopped" | "errored";
  cpu: string;
  memory: string;
  restarts: number;
  uptime: string;
  pid: number;
}

export interface SystemInfo {
  cpuUsage: number;
  memUsed: number;
  memTotal: number;
  diskUsed: number;
  diskTotal: number;
  uptime: string;
  loadAvg: number[];
}

export interface OpenClawActivity {
  activeSession: string | null;
  model: string;
  messageCount: number;
  lastMessage: string;
  lastMessageTime: number;
  thinking: boolean;
  cost: number;
}

export interface TerminalLine {
  id: string;
  timestamp: number;
  source: "gateway" | "system" | "openclaw" | "gpu";
  content: string;
  level: "info" | "warn" | "error" | "debug";
}

export interface FileActivity {
  path: string;
  action: "modified" | "created" | "deleted";
  timestamp: number;
  size?: number;
}

export interface WorkspaceState {
  gpus: GpuInfo[];
  services: ServiceInfo[];
  system: SystemInfo | null;
  openclaw: OpenClawActivity | null;
  terminal: TerminalLine[];
  activity: FileActivity[];
  connected: boolean;
}

const MAX_TERMINAL_LINES = 200;

export function useWorkspaceStream(): WorkspaceState & {
  execCommand: (command: string) => void;
} {
  const [gpus, setGpus] = useState<GpuInfo[]>([]);
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [openclaw, setOpenclaw] = useState<OpenClawActivity | null>(null);
  const [terminal, setTerminal] = useState<TerminalLine[]>([]);
  const [activity, setActivity] = useState<FileActivity[]>([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io("/workspace", {
      path: "/api/socket.io",
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("workspace:gpu", (data: GpuInfo[]) => setGpus(data));
    socket.on("workspace:services", (data: ServiceInfo[]) => setServices(data));
    socket.on("workspace:system", (data: SystemInfo) => setSystem(data));
    socket.on("workspace:openclaw", (data: OpenClawActivity) => setOpenclaw(data));
    socket.on("workspace:activity", (data: FileActivity[]) => setActivity(data));

    socket.on("workspace:terminal", (lines: TerminalLine[]) => {
      setTerminal((prev) => {
        const combined = [...prev, ...lines];
        return combined.slice(-MAX_TERMINAL_LINES);
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const execCommand = useCallback((command: string) => {
    socketRef.current?.emit("workspace:exec", { command });
  }, []);

  return { gpus, services, system, openclaw, terminal, activity, connected, execCommand };
}
