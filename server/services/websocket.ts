/**
 * WebSocket Service
 * Handles real-time streaming for consensus, synthesis, and JARVIS agent modes
 */

import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { QueryMode, SpeedTier, SynthesisStage } from "../../shared/rasputin";
import { generateConsensus } from "./consensus";
import { generateSynthesis } from "./synthesis";
import * as db from "../db";
import {
  runOrchestrator,
  type ToolCall,
  type ToolResult,
} from "./jarvis/orchestrator";
import { executeTool } from "./jarvis/tools";
import {
  getPreTaskContext,
  learnFromTask,
  type TaskContext,
  type TaskOutcome,
} from "./jarvis/memoryIntegration";
import { createSelfReflectionSystem } from "./memory/selfReflection";

// ============================================================================
// Types
// ============================================================================

interface QueryRequest {
  chatId: number;
  query: string;
  mode: QueryMode;
  speedTier: SpeedTier;
  userId: number;
}

interface JarvisRequest {
  task: string;
  taskId?: number;
  userId: number;
}

interface ClientToServerEvents {
  "query:start": (data: QueryRequest) => void;
  "query:cancel": (data: { chatId: number }) => void;
  "jarvis:start": (data: JarvisRequest) => void;
  "jarvis:cancel": (data: { taskId?: number }) => void;
}

interface ServerToClientEvents {
  "model:status": (data: {
    modelId: string;
    status: "pending" | "streaming" | "completed" | "error";
    latencyMs?: number;
    tokenCount?: number;
    cost?: number;
    errorMessage?: string;
  }) => void;
  "model:stream": (data: {
    modelId: string;
    chunk: string;
    fullContent: string;
  }) => void;
  "pipeline:stage": (data: {
    stage: SynthesisStage;
    status: "pending" | "running" | "completed" | "error";
    output?: string;
  }) => void;
  "consensus:start": () => void;
  "consensus:complete": (data: {
    messageId: number;
    summary: string;
    agreementPercentage: number;
    totalLatencyMs: number;
    totalTokens: number;
    totalCost: number;
  }) => void;
  "synthesis:complete": (data: {
    messageId: number;
    finalSynthesis: string;
    totalLatencyMs: number;
    totalTokens: number;
    totalCost: number;
  }) => void;
  "jarvis:thinking": (data: {
    taskId: number;
    content: string;
    timestamp: number;
  }) => void;
  "jarvis:tool_start": (data: {
    taskId: number;
    toolName: string;
    input: Record<string, unknown>;
    timestamp: number;
  }) => void;
  "jarvis:tool_end": (data: {
    taskId: number;
    toolName: string;
    output: string;
    isError: boolean;
    durationMs: number;
    timestamp: number;
  }) => void;
  "jarvis:iteration": (data: {
    taskId: number;
    iteration: number;
    maxIterations: number;
    timestamp: number;
  }) => void;
  "jarvis:complete": (data: {
    taskId: number;
    summary: string;
    success: boolean;
    iterationCount: number;
    durationMs: number;
    timestamp: number;
  }) => void;
  "jarvis:error": (data: {
    taskId?: number;
    error: string;
    timestamp: number;
  }) => void;
  error: (data: { message: string; code?: string }) => void;
}

// ============================================================================
// WebSocket Server
// ============================================================================

let io: Server<ClientToServerEvents, ServerToClientEvents> | null = null;

// Track active queries to support cancellation
const activeQueries = new Map<string, { cancelled: boolean }>();

export function initializeWebSocket(httpServer: HttpServer): Server {
  io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    path: "/api/socket.io",
  });

  io.on(
    "connection",
    (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
      console.log(`[WebSocket] Client connected: ${socket.id}`);

      socket.on("query:start", async (data: QueryRequest) => {
        const queryKey = `${socket.id}-${data.chatId}`;
        activeQueries.set(queryKey, { cancelled: false });

        try {
          await handleQuery(socket, data, queryKey);
        } catch (error) {
          console.error("[WebSocket] Query error:", error);
          socket.emit("error", {
            message: error instanceof Error ? error.message : "Unknown error",
            code: "QUERY_ERROR",
          });
        } finally {
          activeQueries.delete(queryKey);
        }
      });

      socket.on("query:cancel", (data: { chatId: number }) => {
        const queryKey = `${socket.id}-${data.chatId}`;
        const query = activeQueries.get(queryKey);
        if (query) {
          query.cancelled = true;
        }
      });

      socket.on("jarvis:start", async (data: JarvisRequest) => {
        const queryKey = `jarvis-${socket.id}-${Date.now()}`;
        activeQueries.set(queryKey, { cancelled: false });

        try {
          await handleJarvisTask(socket, data, queryKey);
        } catch (error) {
          console.error("[WebSocket] JARVIS error:", error);
          socket.emit("jarvis:error", {
            error: error instanceof Error ? error.message : "Unknown error",
            timestamp: Date.now(),
          });
        } finally {
          activeQueries.delete(queryKey);
        }
      });

      socket.on("jarvis:cancel", () => {
        activeQueries.forEach((query, key) => {
          if (key.startsWith(`jarvis-${socket.id}`)) {
            query.cancelled = true;
          }
        });
      });

      socket.on("disconnect", () => {
        console.log(`[WebSocket] Client disconnected: ${socket.id}`);
        // Cancel any active queries for this socket
        activeQueries.forEach((query, key) => {
          if (key.startsWith(socket.id)) {
            query.cancelled = true;
          }
        });
      });
    }
  );

  console.log("[WebSocket] Server initialized");
  return io;
}

// ============================================================================
// Query Handler
// ============================================================================

async function handleQuery(
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
  data: QueryRequest,
  queryKey: string
): Promise<void> {
  const { chatId, query, mode, speedTier, userId } = data;

  // Verify chat ownership
  const chat = await db.getChat(chatId, userId);
  if (!chat) {
    socket.emit("error", { message: "Chat not found", code: "CHAT_NOT_FOUND" });
    return;
  }

  // Create user message
  const userMessage = await db.createMessage({
    chatId,
    role: "user",
    content: query,
  });

  // Get conversation history
  const allMessages = await db.getChatMessages(chatId);
  const conversationHistory = allMessages
    .filter(m => m.id !== userMessage.id)
    .slice(-20)
    .map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  // Track model content for streaming
  const modelContents = new Map<string, string>();

  if (mode === "consensus") {
    const result = await generateConsensus({
      query,
      speedTier,
      selectedModels: chat.selectedModels || undefined,
      conversationHistory,
      onModelUpdate: (modelId, update) => {
        if (activeQueries.get(queryKey)?.cancelled) return;

        if (update.status) {
          socket.emit("model:status", {
            modelId,
            status: update.status,
            latencyMs: update.latencyMs,
            tokenCount: (update.inputTokens || 0) + (update.outputTokens || 0),
            cost: update.cost,
            errorMessage: update.errorMessage,
          });
        }

        if (update.content && update.status === "streaming") {
          const currentContent = modelContents.get(modelId) || "";
          const newContent = currentContent + update.content;
          modelContents.set(modelId, newContent);

          socket.emit("model:stream", {
            modelId,
            chunk: update.content,
            fullContent: newContent,
          });
        }
      },
      onConsensusStart: () => {
        if (activeQueries.get(queryKey)?.cancelled) return;
        socket.emit("consensus:start");
      },
    });

    // Save assistant message
    const assistantMessage = await db.createMessage({
      chatId,
      role: "assistant",
      content: result.summary,
      summary: result.summary,
      agreementPercentage: result.agreementPercentage,
      latencyMs: result.totalLatencyMs,
      tokenCount: result.totalTokens,
      cost: result.totalCost.toString(),
      metadata: {
        mode: "consensus",
        modelCount: result.modelResponses.length,
      },
    });

    // Save model responses
    for (const modelResponse of result.modelResponses) {
      await db.createModelResponse({
        messageId: assistantMessage.id,
        modelId: modelResponse.modelId,
        modelName: modelResponse.modelName,
        content: modelResponse.content,
        status: modelResponse.status,
        errorMessage: modelResponse.errorMessage,
        latencyMs: modelResponse.latencyMs,
        inputTokens: modelResponse.inputTokens,
        outputTokens: modelResponse.outputTokens,
        cost: modelResponse.cost?.toString(),
        provider: modelResponse.provider,
      });
    }

    // Update chat stats
    await db.updateChat(chatId, {
      totalTokens: chat.totalTokens + result.totalTokens,
      totalCost: (parseFloat(chat.totalCost) + result.totalCost).toString(),
    });

    socket.emit("consensus:complete", {
      messageId: assistantMessage.id,
      summary: result.summary,
      agreementPercentage: result.agreementPercentage,
      totalLatencyMs: result.totalLatencyMs,
      totalTokens: result.totalTokens,
      totalCost: result.totalCost,
    });
  } else {
    // Synthesis mode
    const result = await generateSynthesis({
      query,
      speedTier,
      conversationHistory,
      onStageUpdate: (stage, status, output) => {
        if (activeQueries.get(queryKey)?.cancelled) return;
        socket.emit("pipeline:stage", { stage, status, output });
      },
      onModelUpdate: (modelId, update) => {
        if (activeQueries.get(queryKey)?.cancelled) return;

        if (update.status) {
          socket.emit("model:status", {
            modelId,
            status: update.status,
            latencyMs: update.latencyMs,
            tokenCount: (update.inputTokens || 0) + (update.outputTokens || 0),
            cost: update.cost,
            errorMessage: update.errorMessage,
          });
        }

        if (update.content && update.status === "streaming") {
          const currentContent = modelContents.get(modelId) || "";
          const newContent = currentContent + update.content;
          modelContents.set(modelId, newContent);

          socket.emit("model:stream", {
            modelId,
            chunk: update.content,
            fullContent: newContent,
          });
        }
      },
    });

    // Save assistant message
    const assistantMessage = await db.createMessage({
      chatId,
      role: "assistant",
      content: result.finalSynthesis,
      summary: result.finalSynthesis.slice(0, 500),
      latencyMs: result.totalLatencyMs,
      tokenCount: result.totalTokens,
      cost: result.totalCost.toString(),
      metadata: {
        mode: "synthesis",
        stageCount: result.stages.length,
        gapsIdentified: result.gapsIdentified,
        conflictsResolved: result.conflictsResolved,
      },
    });

    // Save pipeline stages
    for (const stage of result.stages) {
      await db.createPipelineStage({
        messageId: assistantMessage.id,
        stageName: stage.stageName,
        stageOrder: stage.stageOrder,
        status: stage.status,
        output: stage.output,
        durationMs: stage.durationMs,
        metadata: stage.metadata,
      });
    }

    // Save proposer responses
    if (result.proposerResponses) {
      for (const modelResponse of result.proposerResponses) {
        await db.createModelResponse({
          messageId: assistantMessage.id,
          modelId: modelResponse.modelId,
          modelName: modelResponse.modelName,
          content: modelResponse.content,
          status: modelResponse.status,
          errorMessage: modelResponse.errorMessage,
          latencyMs: modelResponse.latencyMs,
          inputTokens: modelResponse.inputTokens,
          outputTokens: modelResponse.outputTokens,
          cost: modelResponse.cost?.toString(),
          provider: modelResponse.provider,
        });
      }
    }

    // Update chat stats
    await db.updateChat(chatId, {
      totalTokens: chat.totalTokens + result.totalTokens,
      totalCost: (parseFloat(chat.totalCost) + result.totalCost).toString(),
    });

    socket.emit("synthesis:complete", {
      messageId: assistantMessage.id,
      finalSynthesis: result.finalSynthesis,
      totalLatencyMs: result.totalLatencyMs,
      totalTokens: result.totalTokens,
      totalCost: result.totalCost,
    });
  }
}

async function handleJarvisTask(
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
  data: JarvisRequest,
  queryKey: string
): Promise<void> {
  const { task, userId } = data;
  const startTime = Date.now();
  let iterationCount = 0;
  const toolsUsed: string[] = [];
  let finalResult = "";
  let hasError = false;

  const today = new Date().toISOString().split("T")[0];
  const rateLimit = await db.checkRateLimit(userId, today, 100);
  if (!rateLimit.allowed) {
    socket.emit("jarvis:error", {
      error: `Rate limit exceeded. Used ${rateLimit.current}/${rateLimit.limit} tasks today.`,
      timestamp: Date.now(),
    });
    return;
  }

  const title = task.slice(0, 100) + (task.length > 100 ? "..." : "");
  const dbTask = await db.createAgentTask({
    userId,
    title,
    query: task,
    status: "running",
  });
  const taskId = dbTask.id;

  await db.incrementUsage(userId, today, "agentTaskCount");
  await db.createAgentMessage({ taskId, role: "user", content: task });

  let memoryPromptAddition = "";
  try {
    const { promptAddition } = await getPreTaskContext(task, userId);
    memoryPromptAddition = promptAddition;
  } catch (error) {
    console.error("[JARVIS WS] Memory context retrieval failed:", error);
  }

  const toolStartTimes = new Map<string, number>();

  // Map tool call IDs to tool names for use in tool_end
  const toolCallNames = new Map<string, string>();

  try {
    await runOrchestrator(
      task,
      {
        onThinking: (thought: string) => {
          if (activeQueries.get(queryKey)?.cancelled) return;
          socket.emit("jarvis:thinking", {
            taskId,
            content: thought,
            timestamp: Date.now(),
          });
        },
        onIteration: (iteration: number, maxIterations: number) => {
          if (activeQueries.get(queryKey)?.cancelled) return;
          iterationCount = iteration;
          socket.emit("jarvis:iteration", {
            taskId,
            iteration,
            maxIterations,
            timestamp: Date.now(),
          });
        },
        onToolCall: (toolCall: ToolCall) => {
          if (activeQueries.get(queryKey)?.cancelled) return;
          toolsUsed.push(toolCall.name);
          toolStartTimes.set(toolCall.id, Date.now());
          toolCallNames.set(toolCall.id, toolCall.name);

          socket.emit("jarvis:tool_start", {
            taskId,
            toolName: toolCall.name,
            input: toolCall.input,
            timestamp: Date.now(),
          });
        },
        onToolResult: (result: ToolResult) => {
          if (activeQueries.get(queryKey)?.cancelled) return;
          const startTs = toolStartTimes.get(result.toolCallId) || Date.now();
          const toolName = toolCallNames.get(result.toolCallId) || "unknown";
          socket.emit("jarvis:tool_end", {
            taskId,
            toolName,
            output: result.output,
            isError: result.isError,
            durationMs: Date.now() - startTs,
            timestamp: Date.now(),
          });
        },
        onComplete: (summary: string) => {
          finalResult = summary;
        },
        onError: (error: string) => {
          hasError = true;
          finalResult = error;
          socket.emit("jarvis:error", {
            taskId,
            error,
            timestamp: Date.now(),
          });
        },
      },
      async (toolName, toolInput) => {
        const toolCallRecord = await db.createAgentToolCall({
          taskId,
          toolName,
          input: toolInput,
          status: "running",
        });

        const toolStartTime = Date.now();
        try {
          const enrichedInput = { ...toolInput, userId };
          const result = await executeTool(toolName, enrichedInput);
          await db.incrementUsage(userId, today, "totalApiCalls");
          await db.updateAgentToolCall(toolCallRecord.id, {
            output: result,
            status: "completed",
            durationMs: Date.now() - toolStartTime,
          });
          return result;
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          await db.updateAgentToolCall(toolCallRecord.id, {
            status: "error",
            errorMessage: errorMsg,
            durationMs: Date.now() - toolStartTime,
          });
          throw error;
        }
      },
      { memoryContext: memoryPromptAddition }
    );
  } catch (error) {
    hasError = true;
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (!finalResult) finalResult = errorMsg;
  }

  const durationMs = Date.now() - startTime;
  await db.updateAgentTask(taskId, {
    status: hasError ? "failed" : "completed",
    result: finalResult,
    errorMessage: hasError ? finalResult : undefined,
    iterationCount,
    durationMs,
    completedAt: new Date(),
  });

  await db.createAgentMessage({
    taskId,
    role: "assistant",
    content: finalResult || "Task completed",
  });

  try {
    const taskContext: TaskContext = { taskId, userId, query: task };
    const outcome: TaskOutcome = {
      success: !hasError,
      result: finalResult,
      error: hasError ? finalResult : undefined,
      toolsUsed: Array.from(new Set(toolsUsed)),
      duration: durationMs,
      iterations: iterationCount,
    };
    await learnFromTask(taskContext, outcome);

    if (iterationCount > 2 || hasError) {
      const reflectionSystem = createSelfReflectionSystem(userId);
      await reflectionSystem
        .reflectOnTask(taskId, {
          taskDescription: task,
          toolCalls: [],
          finalResult: finalResult || "",
          errorMessages: hasError ? [finalResult] : [],
        })
        .catch(() => {});
    }
  } catch (error) {
    console.error("[JARVIS WS] Learning/reflection failed:", error);
  }

  socket.emit("jarvis:complete", {
    taskId,
    summary: finalResult,
    success: !hasError,
    iterationCount,
    durationMs,
    timestamp: Date.now(),
  });
}

export { io };
