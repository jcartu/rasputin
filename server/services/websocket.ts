/**
 * WebSocket Service
 * Handles real-time streaming for consensus and synthesis modes
 */

import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { QueryMode, SpeedTier, SynthesisStage } from "../../shared/rasputin";
import { generateConsensus } from "./consensus";
import { generateSynthesis } from "./synthesis";
import * as db from "../db";

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

interface ClientToServerEvents {
  "query:start": (data: QueryRequest) => void;
  "query:cancel": (data: { chatId: number }) => void;
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

export { io };
