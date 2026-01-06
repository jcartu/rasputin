import { useState, useEffect, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import type {
  QueryMode,
  SpeedTier,
  SynthesisStage,
} from "../../../shared/rasputin";

// ============================================================================
// Types
// ============================================================================

interface ModelStatusUpdate {
  modelId: string;
  status: "pending" | "streaming" | "completed" | "error";
  latencyMs?: number;
  tokenCount?: number;
  cost?: number;
  errorMessage?: string;
}

interface ModelStreamUpdate {
  modelId: string;
  chunk: string;
  fullContent: string;
}

interface PipelineStageUpdate {
  stage: SynthesisStage;
  status: "pending" | "running" | "completed" | "error";
  output?: string;
}

interface ConsensusCompleteData {
  messageId: number;
  summary: string;
  agreementPercentage: number;
  totalLatencyMs: number;
  totalTokens: number;
  totalCost: number;
}

interface SynthesisCompleteData {
  messageId: number;
  finalSynthesis: string;
  totalLatencyMs: number;
  totalTokens: number;
  totalCost: number;
}

export interface LogEntry {
  id: string;
  timestamp: number;
  type: "info" | "model" | "stage" | "error" | "success" | "stream";
  message: string;
  modelId?: string;
  stage?: SynthesisStage;
}

interface UseWebSocketOptions {
  onModelStatus?: (update: ModelStatusUpdate) => void;
  onModelStream?: (update: ModelStreamUpdate) => void;
  onPipelineStage?: (update: PipelineStageUpdate) => void;
  onConsensusStart?: () => void;
  onConsensusComplete?: (data: ConsensusCompleteData) => void;
  onSynthesisComplete?: (data: SynthesisCompleteData) => void;
  onError?: (error: { message: string; code?: string }) => void;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  isQuerying: boolean;
  logs: LogEntry[];
  startQuery: (params: {
    chatId: number;
    query: string;
    mode: QueryMode;
    speedTier: SpeedTier;
    userId: number;
  }) => void;
  cancelQuery: (chatId: number) => void;
  clearLogs: () => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useWebSocket(
  options: UseWebSocketOptions = {}
): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isQuerying, setIsQuerying] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const logIdRef = useRef(0);
  const optionsRef = useRef(options);

  // Keep options ref updated
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // Add log entry - stable function
  const addLog = useCallback(
    (
      type: LogEntry["type"],
      message: string,
      extra?: { modelId?: string; stage?: SynthesisStage }
    ) => {
      const log: LogEntry = {
        id: `log-${logIdRef.current++}`,
        timestamp: Date.now(),
        type,
        message,
        ...extra,
      };
      setLogs(prev => [...prev.slice(-100), log]); // Keep last 100 logs
    },
    []
  );

  // Initialize socket connection - only once on mount
  useEffect(() => {
    console.info("[useWebSocket] Initializing socket connection...");

    const socket = io({
      path: "/api/socket.io",
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.info("[WebSocket] Connected, id:", socket.id);
      setIsConnected(true);
      addLog("success", "Connected to server");
    });

    socket.on("disconnect", reason => {
      console.info("[WebSocket] Disconnected:", reason);
      setIsConnected(false);
      if (reason !== "io client disconnect") {
        addLog("info", `Disconnected: ${reason}`);
      }
    });

    socket.on("connect_error", error => {
      console.error("[WebSocket] Connection error:", error.message);
      addLog("error", `Connection error: ${error.message}`);
    });

    socket.on("model:status", (data: ModelStatusUpdate) => {
      const statusText =
        data.status === "streaming"
          ? "started streaming"
          : data.status === "completed"
            ? `completed in ${((data.latencyMs || 0) / 1000).toFixed(2)}s`
            : data.status === "error"
              ? `error: ${data.errorMessage}`
              : data.status;

      addLog(
        data.status === "error" ? "error" : "model",
        `${data.modelId}: ${statusText}`,
        { modelId: data.modelId }
      );

      optionsRef.current.onModelStatus?.(data);
    });

    socket.on("model:stream", (data: ModelStreamUpdate) => {
      // Only log occasionally to avoid spam
      if (data.fullContent.length % 100 < 10) {
        addLog("stream", `${data.modelId}: ${data.chunk.slice(0, 50)}...`, {
          modelId: data.modelId,
        });
      }
      optionsRef.current.onModelStream?.(data);
    });

    socket.on("pipeline:stage", (data: PipelineStageUpdate) => {
      const statusText =
        data.status === "running"
          ? "started"
          : data.status === "completed"
            ? "completed"
            : data.status;

      addLog(
        data.status === "completed" ? "success" : "stage",
        `Stage ${data.stage}: ${statusText}`,
        { stage: data.stage }
      );

      optionsRef.current.onPipelineStage?.(data);
    });

    socket.on("consensus:start", () => {
      addLog("info", "Starting consensus generation...");
      optionsRef.current.onConsensusStart?.();
    });

    socket.on("consensus:complete", (data: ConsensusCompleteData) => {
      setIsQuerying(false);
      addLog(
        "success",
        `Consensus complete: ${data.agreementPercentage}% agreement, ${data.totalTokens} tokens, $${data.totalCost.toFixed(4)}`
      );
      optionsRef.current.onConsensusComplete?.(data);
    });

    socket.on("synthesis:complete", (data: SynthesisCompleteData) => {
      setIsQuerying(false);
      addLog(
        "success",
        `Synthesis complete: ${data.totalTokens} tokens, $${data.totalCost.toFixed(4)}`
      );
      optionsRef.current.onSynthesisComplete?.(data);
    });

    socket.on("error", (data: { message: string; code?: string }) => {
      setIsQuerying(false);
      addLog("error", `Error: ${data.message} (${data.code || "unknown"})`);
      optionsRef.current.onError?.(data);
    });

    return () => {
      console.info("[useWebSocket] Cleaning up socket connection...");
      socket.disconnect();
    };
  }, [addLog]);

  // Start query
  const startQuery = useCallback(
    (params: {
      chatId: number;
      query: string;
      mode: QueryMode;
      speedTier: SpeedTier;
      userId: number;
    }) => {
      if (!socketRef.current?.connected) {
        addLog("error", "Not connected to server");
        return;
      }

      setIsQuerying(true);
      setLogs([]); // Clear previous logs
      logIdRef.current = 0;

      addLog(
        "info",
        `Starting ${params.mode} query: "${params.query.slice(0, 50)}..."`
      );
      addLog("info", `Speed tier: ${params.speedTier}`);

      socketRef.current.emit("query:start", params);
    },
    [addLog]
  );

  // Cancel query
  const cancelQuery = useCallback(
    (chatId: number) => {
      if (!socketRef.current?.connected) return;

      addLog("info", "Cancelling query...");
      socketRef.current.emit("query:cancel", { chatId });
      setIsQuerying(false);
    },
    [addLog]
  );

  // Clear logs
  const clearLogs = useCallback(() => {
    setLogs([]);
    logIdRef.current = 0;
  }, []);

  return {
    isConnected,
    isQuerying,
    logs,
    startQuery,
    cancelQuery,
    clearLogs,
  };
}
