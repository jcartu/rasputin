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
  MAX_TOOL_DURATION_MS,
} from "./jarvis/orchestrator";
import { executeTool } from "./jarvis/tools";

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  toolName: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(
          `Tool '${toolName}' timed out after ${Math.round(timeoutMs / 1000)}s`
        )
      );
    }, timeoutMs);

    promise
      .then(result => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timer);
        reject(error);
      });
  });
}
import {
  getPreTaskContext,
  findMatchingProcedure,
  generateProcedureGuidance,
  learnFromTask,
  type TaskContext,
  type TaskOutcome,
} from "./jarvis/memoryIntegration";
import { createSelfReflectionSystem } from "./memory/selfReflection";

// ============================================================================
// Utilities
// ============================================================================

/**
 * Extract clean user query from task that may contain file context.
 * Looks for [USER TASK] or [USER QUESTION] markers and extracts just the user's query.
 */
function extractCleanTitle(task: string): string {
  // Check for [USER TASK] marker (Agent page)
  const userTaskMatch = task.match(/\[USER TASK\]\s*\n?([\s\S]*?)$/i);
  if (userTaskMatch) {
    const cleanQuery = userTaskMatch[1].trim();
    return cleanQuery.slice(0, 100) + (cleanQuery.length > 100 ? "..." : "");
  }

  // Check for [USER QUESTION] marker (Chat page)
  const userQuestionMatch = task.match(/\[USER QUESTION\]\s*\n?([\s\S]*?)$/i);
  if (userQuestionMatch) {
    const cleanQuery = userQuestionMatch[1].trim();
    return cleanQuery.slice(0, 100) + (cleanQuery.length > 100 ? "..." : "");
  }

  // No markers found, return as-is (truncated)
  return task.slice(0, 100) + (task.length > 100 ? "..." : "");
}

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

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

interface JarvisRequest {
  task: string;
  taskId?: number;
  userId: number;
  conversationHistory?: ConversationMessage[];
  maxIterations?: number;
}

interface ClientToServerEvents {
  "query:start": (data: QueryRequest) => void;
  "query:cancel": (data: { chatId: number }) => void;
  "jarvis:start": (data: JarvisRequest) => void;
  "jarvis:cancel": (data: { taskId?: number }) => void;
  "jarvis:rejoin": (data: { userId: number }) => void;
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
  "jarvis:thinking_chunk": (data: {
    taskId: number;
    chunk: string;
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
  "jarvis:rejoin_state": (data: {
    taskId: number;
    query: string;
    steps: StreamingStep[];
    currentIteration: number;
    maxIterations: number;
    startedAt: number;
  }) => void;
  "jarvis:memory": (data: {
    taskId: number;
    type: "search" | "store" | "enrich";
    message: string;
    count?: number;
    timestamp: number;
  }) => void;
  "approval:new": (data: {
    id: number;
    hostId: number;
    command: string;
    riskLevel: string;
    reason: string | null;
    expiresAt: Date | null;
    timestamp: number;
  }) => void;
  "approval:resolved": (data: {
    id: number;
    status: "approved" | "rejected" | "expired";
    timestamp: number;
  }) => void;
  "voice:announce": (data: {
    text: string;
    source: "scheduled_task" | "multi_agent" | "jarvis" | "system";
    taskId?: number;
    priority?: "normal" | "high";
    timestamp: number;
  }) => void;
  "swarm:negotiation_start": (data: {
    taskId: number;
    taskDescription: string;
    requiredCapabilities: string[];
    timestamp: number;
  }) => void;
  "swarm:bid": (data: {
    taskId: number;
    agentId: number;
    agentName: string;
    agentType: string;
    confidence: number;
    availabilityScore: number;
    experienceScore: number;
    estimatedDuration: number;
    timestamp: number;
  }) => void;
  "swarm:negotiation_complete": (data: {
    taskId: number;
    winningAgentId: number;
    winningAgentName: string;
    totalBids: number;
    timestamp: number;
  }) => void;
  "swarm:team_forming": (data: {
    teamId: string;
    taskDescription: string;
    requiredCapabilities: string[];
    timestamp: number;
  }) => void;
  "swarm:team_member_added": (data: {
    teamId: string;
    agentId: number;
    agentName: string;
    agentType: string;
    isLeader: boolean;
    timestamp: number;
  }) => void;
  "swarm:team_formed": (data: {
    teamId: string;
    memberCount: number;
    leaderId: number;
    leaderName: string;
    timestamp: number;
  }) => void;
  "swarm:team_disbanded": (data: { teamId: string; timestamp: number }) => void;
  "swarm:consensus_start": (data: {
    proposalId: string;
    question: string;
    participantCount: number;
    timestamp: number;
  }) => void;
  "swarm:vote": (data: {
    proposalId: string;
    agentId: number;
    agentName: string;
    agentType: string;
    vote: "approve" | "reject" | "abstain";
    weight: number;
    reasoning?: string;
    timestamp: number;
  }) => void;
  "swarm:consensus_complete": (data: {
    proposalId: string;
    decision: "approved" | "rejected" | "tie";
    approvalPercentage: number;
    totalVotes: number;
    timestamp: number;
  }) => void;
  "swarm:broadcast": (data: {
    teamId: string;
    fromAgentId: number;
    fromAgentName: string;
    message: string;
    timestamp: number;
  }) => void;
  "swarm:collective_problem_start": (data: {
    problemId: string;
    description: string;
    subProblemCount: number;
    contributorCount: number;
    timestamp: number;
  }) => void;
  "swarm:sub_problem_assigned": (data: {
    problemId: string;
    subProblemId: string;
    description: string;
    agentId: number;
    agentName: string;
    timestamp: number;
  }) => void;
  "swarm:sub_problem_solved": (data: {
    problemId: string;
    subProblemId: string;
    agentId: number;
    confidence: number;
    solvedCount: number;
    totalCount: number;
    timestamp: number;
  }) => void;
  "swarm:knowledge_shared": (data: {
    problemId: string;
    agentId: number;
    agentName: string;
    knowledgeType: string;
    relevanceScore: number;
    timestamp: number;
  }) => void;
  "swarm:solution_synthesized": (data: {
    problemId: string;
    confidence: number;
    subProblemsSolved: number;
    timestamp: number;
  }) => void;
  "swarm:role_adaptation": (data: {
    agentId: number;
    agentName: string;
    originalRole: string;
    newRole: string;
    reason: string;
    timestamp: number;
  }) => void;
  "swarm:stigmergy_marker": (data: {
    markerId: string;
    agentId: number;
    taskContext: string;
    markerType: string;
    message: string;
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

// ============================================================================
// Active Task Streaming State (for session reconnection)
// ============================================================================

interface StreamingStep {
  id: string;
  type: "thinking" | "tool";
  content?: string;
  tool?: {
    id: string;
    name: string;
    input: Record<string, unknown>;
    output?: string;
    isError?: boolean;
    status: "running" | "completed" | "failed";
    startTime: number;
    endTime?: number;
    durationMs?: number;
  };
  timestamp: number;
}

interface ActiveTaskState {
  taskId: number;
  userId: number;
  query: string;
  steps: StreamingStep[];
  currentIteration: number;
  maxIterations: number;
  startedAt: number;
}

// Store active task state by userId (one active task per user)
const activeTaskStates = new Map<number, ActiveTaskState>();

export function getActiveTaskState(userId: number): ActiveTaskState | null {
  return activeTaskStates.get(userId) || null;
}

export function setActiveTaskState(
  userId: number,
  state: ActiveTaskState
): void {
  activeTaskStates.set(userId, state);
}

export function updateActiveTaskState(
  userId: number,
  update: Partial<ActiveTaskState>
): void {
  const current = activeTaskStates.get(userId);
  if (current) {
    activeTaskStates.set(userId, { ...current, ...update });
  }
}

export function addStepToActiveTask(userId: number, step: StreamingStep): void {
  const current = activeTaskStates.get(userId);
  if (current) {
    current.steps.push(step);
  }
}

export function updateLastToolStep(
  userId: number,
  toolName: string,
  update: Partial<StreamingStep["tool"]>
): void {
  const current = activeTaskStates.get(userId);
  if (!current) return;

  for (let i = current.steps.length - 1; i >= 0; i--) {
    const step = current.steps[i];
    if (
      step.type === "tool" &&
      step.tool?.name === toolName &&
      step.tool?.status === "running"
    ) {
      step.tool = { ...step.tool, ...update };
      break;
    }
  }
}

export function clearActiveTaskState(userId: number): void {
  activeTaskStates.delete(userId);
}

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

      socket.on("jarvis:rejoin", (data: { userId: number }) => {
        const activeState = getActiveTaskState(data.userId);
        if (activeState) {
          console.log(
            `[WebSocket] Client rejoining task ${activeState.taskId} for user ${data.userId}`
          );
          socket.emit("jarvis:rejoin_state", {
            taskId: activeState.taskId,
            query: activeState.query,
            steps: activeState.steps,
            currentIteration: activeState.currentIteration,
            maxIterations: activeState.maxIterations,
            startedAt: activeState.startedAt,
          });
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
  // Track last emitted status to avoid spam
  const lastModelStatus = new Map<string, string>();

  if (mode === "consensus") {
    const result = await generateConsensus({
      query,
      speedTier,
      selectedModels: chat.selectedModels || undefined,
      conversationHistory,
      onModelUpdate: (modelId, update) => {
        if (activeQueries.get(queryKey)?.cancelled) return;

        // Only emit status when it changes (prevents log spam)
        if (update.status && update.status !== lastModelStatus.get(modelId)) {
          lastModelStatus.set(modelId, update.status);
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

        if (update.status && update.status !== lastModelStatus.get(modelId)) {
          lastModelStatus.set(modelId, update.status);
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
  const { task, userId, conversationHistory } = data;
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

  const title = extractCleanTitle(task);
  const dbTask = await db.createAgentTask({
    userId,
    title,
    query: task,
    status: "running",
  });
  const taskId = dbTask.id;

  setActiveTaskState(userId, {
    taskId,
    userId,
    query: task,
    steps: [],
    currentIteration: 0,
    maxIterations: 25,
    startedAt: startTime,
  });

  await db.incrementUsage(userId, today, "agentTaskCount");
  await db.createAgentMessage({ taskId, role: "user", content: task });

  let memoryPromptAddition = "";
  let procedureGuidance = "";
  try {
    const { promptAddition } = await getPreTaskContext(task, userId);
    memoryPromptAddition = promptAddition;
    if (memoryPromptAddition) {
      console.info(
        `[JARVIS WS] Retrieved memory context (${memoryPromptAddition.length} chars)`
      );
    }

    const matchedProcedure = await findMatchingProcedure(task, userId);
    if (matchedProcedure) {
      console.info(
        `[JARVIS WS] Procedure match found: "${matchedProcedure.name}" (${matchedProcedure.successRate}% success rate)`
      );
      if (matchedProcedure.successRate >= 70) {
        procedureGuidance = generateProcedureGuidance(matchedProcedure, task);
        if (procedureGuidance) {
          console.info("[JARVIS WS] Using procedure guidance");
        } else {
          console.info(
            "[JARVIS WS] Procedure guidance disabled for this task type"
          );
        }
      }
    } else {
      console.info(`[JARVIS WS] No procedure match found for task`);
    }
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
          const timestamp = Date.now();
          addStepToActiveTask(userId, {
            id: crypto.randomUUID(),
            type: "thinking",
            content: thought,
            timestamp,
          });
          socket.emit("jarvis:thinking", {
            taskId,
            content: thought,
            timestamp,
          });
        },
        onThinkingChunk: (() => {
          let totalChars = 0;
          let lastProgressUpdate = Date.now();
          const streamStartTime = Date.now();
          return (chunk: string) => {
            if (activeQueries.get(queryKey)?.cancelled) return;
            const timestamp = Date.now();
            totalChars += chunk.length;

            const state = getActiveTaskState(userId);
            if (state && state.steps.length > 0) {
              const lastStep = state.steps[state.steps.length - 1];
              if (lastStep.type === "thinking") {
                lastStep.content = (lastStep.content || "") + chunk;
              } else {
                addStepToActiveTask(userId, {
                  id: crypto.randomUUID(),
                  type: "thinking",
                  content: chunk,
                  timestamp,
                });
              }
            } else {
              addStepToActiveTask(userId, {
                id: crypto.randomUUID(),
                type: "thinking",
                content: chunk,
                timestamp,
              });
            }

            socket.emit("jarvis:thinking_chunk", {
              taskId,
              chunk,
              timestamp,
            });

            if (timestamp - lastProgressUpdate > 2000) {
              const elapsedSecs = Math.floor(
                (timestamp - streamStartTime) / 1000
              );
              const estimatedTokens = Math.floor(totalChars / 4);
              socket.emit("jarvis:thinking", {
                taskId,
                content: `📊 Streaming: ${totalChars.toLocaleString()} chars (~${estimatedTokens.toLocaleString()} tokens) | ⏱️ ${elapsedSecs}s elapsed`,
                timestamp,
              });
              addStepToActiveTask(userId, {
                id: crypto.randomUUID(),
                type: "thinking",
                content: `📊 Streaming: ${totalChars.toLocaleString()} chars (~${estimatedTokens.toLocaleString()} tokens) | ⏱️ ${elapsedSecs}s elapsed`,
                timestamp,
              });
              lastProgressUpdate = timestamp;
            }
          };
        })(),
        onIteration: (iteration: number, maxIterations: number) => {
          if (activeQueries.get(queryKey)?.cancelled) return;
          iterationCount = iteration;
          updateActiveTaskState(userId, {
            currentIteration: iteration,
            maxIterations,
          });
          socket.emit("jarvis:iteration", {
            taskId,
            iteration,
            maxIterations,
            timestamp: Date.now(),
          });
        },
        onToolCall: (toolCall: ToolCall) => {
          if (activeQueries.get(queryKey)?.cancelled) return;
          const timestamp = Date.now();
          toolsUsed.push(toolCall.name);
          toolStartTimes.set(toolCall.id, timestamp);
          toolCallNames.set(toolCall.id, toolCall.name);

          addStepToActiveTask(userId, {
            id: crypto.randomUUID(),
            type: "tool",
            tool: {
              id: toolCall.id,
              name: toolCall.name,
              input: toolCall.input,
              status: "running",
              startTime: timestamp,
            },
            timestamp,
          });

          socket.emit("jarvis:tool_start", {
            taskId,
            toolName: toolCall.name,
            input: toolCall.input,
            timestamp,
          });
        },
        onToolResult: (result: ToolResult) => {
          if (activeQueries.get(queryKey)?.cancelled) return;
          const timestamp = Date.now();
          const startTs = toolStartTimes.get(result.toolCallId) || timestamp;
          const toolName = toolCallNames.get(result.toolCallId) || "unknown";
          const durationMs = timestamp - startTs;

          updateLastToolStep(userId, toolName, {
            output: result.output,
            isError: result.isError,
            status: result.isError ? "failed" : "completed",
            endTime: timestamp,
            durationMs,
          });

          socket.emit("jarvis:tool_end", {
            taskId,
            toolName,
            output: result.output,
            isError: result.isError,
            durationMs,
            timestamp,
          });
        },
        onComplete: (summary: string) => {
          finalResult = summary;
          clearActiveTaskState(userId);
          const completeDurationMs = Date.now() - startTime;
          socket.emit("jarvis:complete", {
            taskId,
            summary: finalResult,
            success: true,
            iterationCount,
            durationMs: completeDurationMs,
            timestamp: Date.now(),
          });
          emitVoiceAnnouncement({
            text: `Task completed successfully. ${finalResult?.slice(0, 200) || ""}`,
            source: "jarvis",
            taskId,
            priority: "normal",
          });
        },
        onError: (error: string) => {
          hasError = true;
          finalResult = error;
          clearActiveTaskState(userId);
          socket.emit("jarvis:error", {
            taskId,
            error,
            timestamp: Date.now(),
          });
        },
        onMemory: (
          type: "search" | "store" | "enrich",
          message: string,
          count?: number
        ) => {
          if (activeQueries.get(queryKey)?.cancelled) return;
          socket.emit("jarvis:memory", {
            taskId,
            type,
            message,
            count,
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
          const enrichedInput = { ...toolInput, userId, taskId };
          const result = await withTimeout(
            executeTool(toolName, enrichedInput),
            MAX_TOOL_DURATION_MS,
            toolName
          );
          // Non-blocking DB logging - don't let logging failures break tool execution
          db.incrementUsage(userId, today, "totalApiCalls").catch(e =>
            console.warn("[WebSocket] Failed to increment usage:", e)
          );
          db.updateAgentToolCall(toolCallRecord.id, {
            output: result,
            status: "completed",
            durationMs: Date.now() - toolStartTime,
          }).catch(e =>
            console.warn("[WebSocket] Failed to update tool call record:", e)
          );
          return result;
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          // Non-blocking DB logging - don't let logging failures mask the actual error
          db.updateAgentToolCall(toolCallRecord.id, {
            status: "error",
            errorMessage: errorMsg,
            durationMs: Date.now() - toolStartTime,
          }).catch(e =>
            console.warn("[WebSocket] Failed to update tool call error:", e)
          );
          throw error;
        }
      },
      {
        memoryContext: memoryPromptAddition,
        procedureGuidance,
        userId,
        enableMemoryInjection: true,
        conversationHistory,
        maxIterations: data.maxIterations,
      }
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
    const storedToolCalls = await db.getAgentTaskToolCalls(taskId);
    const toolCallSteps = storedToolCalls
      .filter((tc: { status: string }) => tc.status === "completed")
      .map(
        (tc: {
          toolName: string;
          input: unknown;
          output: string | null;
          status: string;
        }) => ({
          toolName: tc.toolName,
          input: (tc.input as Record<string, unknown>) || {},
          output: tc.output || "",
          success: tc.status === "completed",
        })
      );

    const taskContext: TaskContext = { taskId, userId, query: task };
    const outcome: TaskOutcome = {
      success: !hasError,
      result: finalResult,
      error: hasError ? finalResult : undefined,
      toolsUsed: Array.from(new Set(toolsUsed)),
      duration: durationMs,
      iterations: iterationCount,
      toolCallSteps,
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

  if (hasError) {
    socket.emit("jarvis:complete", {
      taskId,
      summary: finalResult,
      success: false,
      iterationCount,
      durationMs,
      timestamp: Date.now(),
    });
    emitVoiceAnnouncement({
      text: `Task failed. ${finalResult?.slice(0, 150) || "An error occurred."}`,
      source: "jarvis",
      taskId,
      priority: "high",
    });
  }
}

// ============================================================================
// Approval Event Emitters
// ============================================================================

export function emitApprovalNew(approval: {
  id: number;
  hostId: number;
  command: string;
  riskLevel: string;
  reason: string | null;
  expiresAt: Date | null;
}): void {
  if (io) {
    io.emit("approval:new", {
      ...approval,
      timestamp: Date.now(),
    });
  }
}

export function emitApprovalResolved(
  id: number,
  status: "approved" | "rejected" | "expired"
): void {
  if (io) {
    io.emit("approval:resolved", {
      id,
      status,
      timestamp: Date.now(),
    });
  }
}

/**
 * Emit voice announcement to all connected clients
 */
export function emitVoiceAnnouncement(data: {
  text: string;
  source: "scheduled_task" | "multi_agent" | "jarvis" | "system";
  taskId?: number;
  priority?: "normal" | "high";
}): void {
  if (io) {
    io.emit("voice:announce", {
      ...data,
      priority: data.priority || "normal",
      timestamp: Date.now(),
    });
  }
}

export function emitSwarmNegotiationStart(data: {
  taskId: number;
  taskDescription: string;
  requiredCapabilities: string[];
}): void {
  if (io) {
    io.emit("swarm:negotiation_start", { ...data, timestamp: Date.now() });
  }
}

export function emitSwarmBid(data: {
  taskId: number;
  agentId: number;
  agentName: string;
  agentType: string;
  confidence: number;
  availabilityScore: number;
  experienceScore: number;
  estimatedDuration: number;
}): void {
  if (io) {
    io.emit("swarm:bid", { ...data, timestamp: Date.now() });
  }
}

export function emitSwarmNegotiationComplete(data: {
  taskId: number;
  winningAgentId: number;
  winningAgentName: string;
  totalBids: number;
}): void {
  if (io) {
    io.emit("swarm:negotiation_complete", { ...data, timestamp: Date.now() });
  }
}

export function emitSwarmTeamForming(data: {
  teamId: string;
  taskDescription: string;
  requiredCapabilities: string[];
}): void {
  if (io) {
    io.emit("swarm:team_forming", { ...data, timestamp: Date.now() });
  }
}

export function emitSwarmTeamMemberAdded(data: {
  teamId: string;
  agentId: number;
  agentName: string;
  agentType: string;
  isLeader: boolean;
}): void {
  if (io) {
    io.emit("swarm:team_member_added", { ...data, timestamp: Date.now() });
  }
}

export function emitSwarmTeamFormed(data: {
  teamId: string;
  memberCount: number;
  leaderId: number;
  leaderName: string;
}): void {
  if (io) {
    io.emit("swarm:team_formed", { ...data, timestamp: Date.now() });
  }
}

export function emitSwarmTeamDisbanded(teamId: string): void {
  if (io) {
    io.emit("swarm:team_disbanded", { teamId, timestamp: Date.now() });
  }
}

export function emitSwarmConsensusStart(data: {
  proposalId: string;
  question: string;
  participantCount: number;
}): void {
  if (io) {
    io.emit("swarm:consensus_start", { ...data, timestamp: Date.now() });
  }
}

export function emitSwarmVote(data: {
  proposalId: string;
  agentId: number;
  agentName: string;
  agentType: string;
  vote: "approve" | "reject" | "abstain";
  weight: number;
  reasoning?: string;
}): void {
  if (io) {
    io.emit("swarm:vote", { ...data, timestamp: Date.now() });
  }
}

export function emitSwarmConsensusComplete(data: {
  proposalId: string;
  decision: "approved" | "rejected" | "tie";
  approvalPercentage: number;
  totalVotes: number;
}): void {
  if (io) {
    io.emit("swarm:consensus_complete", { ...data, timestamp: Date.now() });
  }
}

export function emitSwarmBroadcast(data: {
  teamId: string;
  fromAgentId: number;
  fromAgentName: string;
  message: string;
}): void {
  if (io) {
    io.emit("swarm:broadcast", { ...data, timestamp: Date.now() });
  }
}

export function emitCollectiveProblemStart(data: {
  problemId: string;
  description: string;
  subProblemCount: number;
  contributorCount: number;
}): void {
  if (io) {
    io.emit("swarm:collective_problem_start", {
      ...data,
      timestamp: Date.now(),
    });
  }
}

export function emitSubProblemAssigned(data: {
  problemId: string;
  subProblemId: string;
  description: string;
  agentId: number;
  agentName: string;
}): void {
  if (io) {
    io.emit("swarm:sub_problem_assigned", { ...data, timestamp: Date.now() });
  }
}

export function emitSubProblemSolved(data: {
  problemId: string;
  subProblemId: string;
  agentId: number;
  confidence: number;
  solvedCount: number;
  totalCount: number;
}): void {
  if (io) {
    io.emit("swarm:sub_problem_solved", { ...data, timestamp: Date.now() });
  }
}

export function emitKnowledgeShared(data: {
  problemId: string;
  agentId: number;
  agentName: string;
  knowledgeType: string;
  relevanceScore: number;
}): void {
  if (io) {
    io.emit("swarm:knowledge_shared", { ...data, timestamp: Date.now() });
  }
}

export function emitSolutionSynthesized(data: {
  problemId: string;
  confidence: number;
  subProblemsSolved: number;
}): void {
  if (io) {
    io.emit("swarm:solution_synthesized", { ...data, timestamp: Date.now() });
  }
}

export function emitRoleAdaptation(data: {
  agentId: number;
  agentName: string;
  originalRole: string;
  newRole: string;
  reason: string;
}): void {
  if (io) {
    io.emit("swarm:role_adaptation", { ...data, timestamp: Date.now() });
  }
}

export function emitStigmergyMarker(data: {
  markerId: string;
  agentId: number;
  taskContext: string;
  markerType: string;
  message: string;
}): void {
  if (io) {
    io.emit("swarm:stigmergy_marker", { ...data, timestamp: Date.now() });
  }
}

export { io };
