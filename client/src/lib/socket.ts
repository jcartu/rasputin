import { io, Socket } from "socket.io-client";

export interface JarvisThinkingEvent {
  taskId: number;
  content: string;
  timestamp: number;
}

export interface JarvisThinkingChunkEvent {
  taskId: number;
  chunk: string;
  timestamp: number;
}

export interface JarvisToolStartEvent {
  taskId: number;
  toolName: string;
  input: Record<string, unknown>;
  timestamp: number;
}

export interface JarvisToolEndEvent {
  taskId: number;
  toolName: string;
  output: string;
  isError: boolean;
  durationMs: number;
  timestamp: number;
}

export interface JarvisIterationEvent {
  taskId: number;
  iteration: number;
  maxIterations: number;
  timestamp: number;
}

export interface JarvisCompleteEvent {
  taskId: number;
  summary: string | null;
  success: boolean;
  iterationCount: number;
  durationMs: number;
  timestamp: number;
}

export interface JarvisErrorEvent {
  taskId?: number;
  error: string;
  timestamp: number;
}

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      path: "/api/socket.io",
      transports: ["websocket", "polling"],
      autoConnect: true,
    });

    socket.on("connect", () => {
      console.info("[Socket] Connected:", socket?.id);
    });

    socket.on("disconnect", reason => {
      console.info("[Socket] Disconnected:", reason);
    });

    socket.on("connect_error", error => {
      console.error("[Socket] Connection error:", error);
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
