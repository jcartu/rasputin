import { useState, useEffect, useCallback, useRef } from "react";
import {
  getSocket,
  type JarvisThinkingEvent,
  type JarvisThinkingChunkEvent,
  type JarvisToolStartEvent,
  type JarvisToolEndEvent,
  type JarvisIterationEvent,
  type JarvisCompleteEvent,
  type JarvisErrorEvent,
  type JarvisRejoinStateEvent,
  type JarvisMemoryEvent,
  type StreamingStep as SocketStreamingStep,
} from "@/lib/socket";

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface StreamingToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output?: string;
  isError?: boolean;
  status: "running" | "completed" | "failed";
  startTime: number;
  endTime?: number;
  durationMs?: number;
}

export interface StreamingStep {
  id: string;
  type: "thinking" | "tool" | "memory";
  content?: string;
  tool?: StreamingToolCall;
  memoryType?: "search" | "store" | "enrich";
  memoryCount?: number;
  timestamp: number;
}

export interface TaskExchange {
  userQuery: string;
  assistantSummary: string | null;
  timestamp: number;
}

export interface StreamingState {
  taskId: number | null;
  isStreaming: boolean;
  steps: StreamingStep[];
  exchanges: TaskExchange[];
  currentIteration: number;
  maxIterations: number;
  summary: string | null;
  success: boolean | null;
  error: string | null;
  durationMs: number | null;
}

const initialState: StreamingState = {
  taskId: null,
  isStreaming: false,
  steps: [],
  exchanges: [],
  currentIteration: 0,
  maxIterations: 10,
  summary: null,
  success: null,
  error: null,
  durationMs: null,
};

export function useJarvisStream() {
  const [state, setState] = useState<StreamingState>(initialState);
  const activeTaskIdRef = useRef<number | null>(null);

  const startTask = useCallback((task: string, userId: number) => {
    const socket = getSocket();

    setState(prev => {
      const conversationHistory: ConversationMessage[] = prev.exchanges.flatMap(
        ex =>
          ex.assistantSummary
            ? [
                { role: "user" as const, content: ex.userQuery },
                { role: "assistant" as const, content: ex.assistantSummary },
              ]
            : [{ role: "user" as const, content: ex.userQuery }]
      );

      socket.emit("jarvis:start", { task, userId, conversationHistory });

      return {
        ...prev,
        taskId: null,
        isStreaming: true,
        steps: [],
        currentIteration: 0,
        exchanges: [
          ...prev.exchanges,
          { userQuery: task, assistantSummary: null, timestamp: Date.now() },
        ],
        summary: null,
        success: null,
        error: null,
        durationMs: null,
      };
    });
  }, []);

  const cancelTask = useCallback(() => {
    if (activeTaskIdRef.current) {
      const socket = getSocket();
      socket.emit("jarvis:cancel", { taskId: activeTaskIdRef.current });
      setState(prev => ({
        ...prev,
        isStreaming: false,
        error: "Task cancelled by user",
      }));
      activeTaskIdRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
    activeTaskIdRef.current = null;
  }, []);

  const loadConversationHistory = useCallback(
    (tasks: Array<{ query: string; summary?: string | null }>) => {
      setState(prev => {
        if (prev.exchanges.length > 0) return prev;

        const exchanges: TaskExchange[] = tasks
          .slice(0, 5)
          .reverse()
          .map(task => ({
            userQuery: task.query,
            assistantSummary: task.summary || null,
            timestamp: Date.now(),
          }));

        return {
          ...prev,
          exchanges,
        };
      });
    },
    []
  );

  const rejoinTask = useCallback((userId: number) => {
    const socket = getSocket();
    socket.emit("jarvis:rejoin", { userId });
  }, []);

  useEffect(() => {
    const socket = getSocket();

    const handleThinking = (event: JarvisThinkingEvent) => {
      console.info("[JARVIS] thinking:", event.taskId);
      if (activeTaskIdRef.current === null) {
        activeTaskIdRef.current = event.taskId;
      }
      if (event.taskId !== activeTaskIdRef.current) return;

      setState(prev => ({
        ...prev,
        taskId: event.taskId,
        steps: [
          ...prev.steps,
          {
            id: crypto.randomUUID(),
            type: "thinking",
            content: event.content,
            timestamp: event.timestamp,
          },
        ],
      }));
    };

    const handleThinkingChunk = (event: JarvisThinkingChunkEvent) => {
      if (activeTaskIdRef.current === null) {
        activeTaskIdRef.current = event.taskId;
      }
      if (event.taskId !== activeTaskIdRef.current) return;

      setState(prev => {
        const steps = [...prev.steps];
        const lastStep = steps[steps.length - 1];

        if (lastStep && lastStep.type === "thinking") {
          steps[steps.length - 1] = {
            ...lastStep,
            content: (lastStep.content || "") + event.chunk,
          };
        } else {
          steps.push({
            id: crypto.randomUUID(),
            type: "thinking",
            content: event.chunk,
            timestamp: event.timestamp,
          });
        }

        return {
          ...prev,
          taskId: event.taskId,
          steps,
        };
      });
    };

    const handleToolStart = (event: JarvisToolStartEvent) => {
      console.info("[JARVIS] tool_start:", event.toolName, event.taskId);
      if (event.taskId !== activeTaskIdRef.current) return;

      const toolCall: StreamingToolCall = {
        id: crypto.randomUUID(),
        name: event.toolName,
        input: event.input,
        status: "running",
        startTime: event.timestamp,
      };

      setState(prev => ({
        ...prev,
        steps: [
          ...prev.steps,
          {
            id: crypto.randomUUID(),
            type: "tool",
            tool: toolCall,
            timestamp: event.timestamp,
          },
        ],
      }));
    };

    const handleToolEnd = (event: JarvisToolEndEvent) => {
      if (event.taskId !== activeTaskIdRef.current) return;

      setState(prev => {
        const steps = [...prev.steps];
        for (let i = steps.length - 1; i >= 0; i--) {
          const step = steps[i];
          if (
            step.type === "tool" &&
            step.tool?.name === event.toolName &&
            step.tool?.status === "running"
          ) {
            steps[i] = {
              ...step,
              tool: {
                ...step.tool,
                output: event.output,
                isError: event.isError,
                status: event.isError ? "failed" : "completed",
                endTime: event.timestamp,
                durationMs: event.durationMs,
              },
            };
            break;
          }
        }
        return { ...prev, steps };
      });
    };

    const handleIteration = (event: JarvisIterationEvent) => {
      console.info(
        "[JARVIS] iteration:",
        event.iteration,
        "/",
        event.maxIterations
      );
      if (event.taskId !== activeTaskIdRef.current) return;

      setState(prev => ({
        ...prev,
        currentIteration: event.iteration,
        maxIterations: event.maxIterations,
      }));
    };

    const handleComplete = (event: JarvisCompleteEvent) => {
      console.info("[JARVIS] complete:", event.success, event.taskId);
      if (event.taskId !== activeTaskIdRef.current) return;

      setState(prev => {
        const exchanges = [...prev.exchanges];
        if (exchanges.length > 0) {
          exchanges[exchanges.length - 1] = {
            ...exchanges[exchanges.length - 1],
            assistantSummary: event.summary,
          };
        }

        const steps = prev.steps.map(step => {
          if (step.type === "tool" && step.tool?.status === "running") {
            return {
              ...step,
              tool: {
                ...step.tool,
                status: "completed" as const,
                endTime: event.timestamp || Date.now(),
              },
            };
          }
          return step;
        });

        return {
          ...prev,
          isStreaming: false,
          summary: event.summary,
          success: event.success,
          durationMs: event.durationMs,
          currentIteration: event.iterationCount,
          exchanges,
          steps,
        };
      });
      activeTaskIdRef.current = null;
    };

    const handleError = (event: JarvisErrorEvent) => {
      console.info("[JARVIS] error:", event.error, event.taskId);
      if (!activeTaskIdRef.current) return;
      if (event.taskId !== activeTaskIdRef.current) return;

      setState(prev => {
        if (!prev.isStreaming) return prev;

        const steps = prev.steps.map(step => {
          if (step.type === "tool" && step.tool?.status === "running") {
            return {
              ...step,
              tool: {
                ...step.tool,
                status: "failed" as const,
                endTime: Date.now(),
              },
            };
          }
          return step;
        });

        return {
          ...prev,
          isStreaming: false,
          error: event.error,
          success: false,
          steps,
        };
      });
      activeTaskIdRef.current = null;
    };

    const handleRejoinState = (event: JarvisRejoinStateEvent) => {
      console.info("[JARVIS] rejoin_state:", event.taskId);
      activeTaskIdRef.current = event.taskId;

      const steps: StreamingStep[] = event.steps.map(
        (step: SocketStreamingStep) => ({
          id: step.id,
          type: step.type,
          content: step.content,
          tool: step.tool
            ? {
                id: step.tool.id,
                name: step.tool.name,
                input: step.tool.input,
                output: step.tool.output,
                isError: step.tool.isError,
                status: step.tool.status,
                startTime: step.tool.startTime,
                endTime: step.tool.endTime,
                durationMs: step.tool.durationMs,
              }
            : undefined,
          timestamp: step.timestamp,
        })
      );

      setState(prev => ({
        ...prev,
        taskId: event.taskId,
        isStreaming: true,
        steps,
        currentIteration: event.currentIteration,
        maxIterations: event.maxIterations,
        exchanges: [
          ...prev.exchanges.filter(
            e => !e.userQuery.includes(event.query.slice(0, 50))
          ),
          {
            userQuery: event.query,
            assistantSummary: null,
            timestamp: event.startedAt,
          },
        ],
        summary: null,
        success: null,
        error: null,
      }));
    };

    const handleMemory = (event: JarvisMemoryEvent) => {
      console.info("[JARVIS] memory:", event.type, event.message);
      if (event.taskId !== activeTaskIdRef.current) return;

      setState(prev => ({
        ...prev,
        steps: [
          ...prev.steps,
          {
            id: crypto.randomUUID(),
            type: "memory",
            content: event.message,
            memoryType: event.type,
            memoryCount: event.count,
            timestamp: event.timestamp,
          },
        ],
      }));
    };

    socket.on("jarvis:thinking", handleThinking);
    socket.on("jarvis:thinking_chunk", handleThinkingChunk);
    socket.on("jarvis:tool_start", handleToolStart);
    socket.on("jarvis:tool_end", handleToolEnd);
    socket.on("jarvis:iteration", handleIteration);
    socket.on("jarvis:complete", handleComplete);
    socket.on("jarvis:error", handleError);
    socket.on("jarvis:rejoin_state", handleRejoinState);
    socket.on("jarvis:memory", handleMemory);

    return () => {
      socket.off("jarvis:thinking", handleThinking);
      socket.off("jarvis:thinking_chunk", handleThinkingChunk);
      socket.off("jarvis:tool_start", handleToolStart);
      socket.off("jarvis:tool_end", handleToolEnd);
      socket.off("jarvis:iteration", handleIteration);
      socket.off("jarvis:complete", handleComplete);
      socket.off("jarvis:error", handleError);
      socket.off("jarvis:rejoin_state", handleRejoinState);
      socket.off("jarvis:memory", handleMemory);
    };
  }, []);

  return {
    ...state,
    startTask,
    cancelTask,
    reset,
    loadConversationHistory,
    rejoinTask,
  };
}
