import { useState, useEffect, useCallback, useRef } from "react";
import {
  getSocket,
  type JarvisThinkingEvent,
  type JarvisToolStartEvent,
  type JarvisToolEndEvent,
  type JarvisIterationEvent,
  type JarvisCompleteEvent,
  type JarvisErrorEvent,
} from "@/lib/socket";

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
  type: "thinking" | "tool";
  content?: string;
  tool?: StreamingToolCall;
  timestamp: number;
}

export interface StreamingState {
  taskId: number | null;
  isStreaming: boolean;
  steps: StreamingStep[];
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

    setState({
      ...initialState,
      isStreaming: true,
    });

    socket.emit("jarvis:start", { task, userId });
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

      setState(prev => ({
        ...prev,
        isStreaming: false,
        summary: event.summary,
        success: event.success,
        durationMs: event.durationMs,
        currentIteration: event.iterationCount,
      }));
      activeTaskIdRef.current = null;
    };

    const handleError = (event: JarvisErrorEvent) => {
      console.info("[JARVIS] error:", event.error, event.taskId);
      if (!activeTaskIdRef.current) return;
      if (event.taskId !== activeTaskIdRef.current) return;

      setState(prev => {
        if (!prev.isStreaming) return prev;
        return {
          ...prev,
          isStreaming: false,
          error: event.error,
          success: false,
        };
      });
      activeTaskIdRef.current = null;
    };

    socket.on("jarvis:thinking", handleThinking);
    socket.on("jarvis:tool_start", handleToolStart);
    socket.on("jarvis:tool_end", handleToolEnd);
    socket.on("jarvis:iteration", handleIteration);
    socket.on("jarvis:complete", handleComplete);
    socket.on("jarvis:error", handleError);

    return () => {
      socket.off("jarvis:thinking", handleThinking);
      socket.off("jarvis:tool_start", handleToolStart);
      socket.off("jarvis:tool_end", handleToolEnd);
      socket.off("jarvis:iteration", handleIteration);
      socket.off("jarvis:complete", handleComplete);
      socket.off("jarvis:error", handleError);
    };
  }, []);

  return {
    ...state,
    startTask,
    cancelTask,
    reset,
  };
}
