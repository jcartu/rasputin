import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { generateConsensus } from "./services/consensus";
import { generateSynthesis } from "./services/synthesis";
import { FRONTIER_MODELS, getModelsForTier } from "../shared/rasputin";
import { invokeLLM } from "./_core/llm";
import {
  runOrchestrator,
  type ToolCall,
  type ToolResult,
} from "./services/jarvis/orchestrator";
import { executeTool } from "./services/jarvis/tools";
import {
  getPreTaskContext,
  learnFromTask,
  findMatchingProcedure,
  generateProcedureGuidance,
  type TaskContext,
  type TaskOutcome,
} from "./services/jarvis/memoryIntegration";
import { createSelfReflectionSystem } from "./services/memory/selfReflection";
import * as ssh from "./ssh";

// ============================================================================
// Zod Schemas
// ============================================================================

const QueryModeSchema = z.enum(["consensus", "synthesis"]);
const SpeedTierSchema = z.enum(["fast", "normal", "max"]);

const CreateChatSchema = z.object({
  title: z.string().optional(),
  mode: QueryModeSchema.optional(),
  speedTier: SpeedTierSchema.optional(),
  selectedModels: z.array(z.string()).optional(),
});

const UpdateChatSchema = z.object({
  chatId: z.number(),
  title: z.string().optional(),
  mode: QueryModeSchema.optional(),
  speedTier: SpeedTierSchema.optional(),
  selectedModels: z.array(z.string()).optional(),
});

const QuerySchema = z.object({
  chatId: z.number(),
  query: z.string().min(1),
  mode: QueryModeSchema,
  speedTier: SpeedTierSchema,
});

// ============================================================================
// App Router
// ============================================================================

export const appRouter = router({
  system: systemRouter,

  // Debug endpoint to check API keys
  debug: router({
    apiKeys: publicProcedure.query(() => {
      return {
        OPENROUTER: !!process.env.OPENROUTER_API_KEY,
        ANTHROPIC: !!process.env.ANTHROPIC_API_KEY,
        GEMINI: !!process.env.GEMINI_API_KEY,
        XAI: !!process.env.XAI_API_KEY,
        SONAR: !!process.env.SONAR_API_KEY,
      };
    }),
  }),

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ============================================================================
  // Models Router
  // ============================================================================
  models: router({
    list: publicProcedure.query(() => {
      return FRONTIER_MODELS.map(m => ({
        id: m.id,
        name: m.name,
        provider: m.provider,
        tier: m.tier,
        contextWindow: m.contextWindow,
        supportsVision: m.supportsVision,
      }));
    }),

    getForTier: publicProcedure
      .input(z.object({ tier: SpeedTierSchema }))
      .query(({ input }) => {
        return getModelsForTier(input.tier).map(m => ({
          id: m.id,
          name: m.name,
          provider: m.provider,
          tier: m.tier,
        }));
      }),
  }),

  // ============================================================================
  // Chats Router
  // ============================================================================
  chats: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const chats = await db.getUserChats(ctx.user.id, input?.limit || 50);
        return chats.map(chat => ({
          id: chat.id,
          title: chat.title,
          mode: chat.mode,
          speedTier: chat.speedTier,
          messageCount: chat.messageCount,
          updatedAt: chat.updatedAt,
        }));
      }),

    get: protectedProcedure
      .input(z.object({ chatId: z.number() }))
      .query(async ({ ctx, input }) => {
        const chat = await db.getChat(input.chatId, ctx.user.id);
        if (!chat) {
          throw new Error("Chat not found");
        }

        const messages = await db.getChatMessages(chat.id);

        return {
          id: chat.id,
          title: chat.title,
          mode: chat.mode,
          speedTier: chat.speedTier,
          selectedModels: chat.selectedModels,
          messageCount: chat.messageCount,
          totalTokens: chat.totalTokens,
          totalCost: chat.totalCost,
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt,
          messages: messages.map(m => ({
            id: m.id,
            role: m.role,
            content: m.content,
            summary: m.summary,
            agreementPercentage: m.agreementPercentage,
            latencyMs: m.latencyMs,
            tokenCount: m.tokenCount,
            cost: m.cost,
            metadata: m.metadata,
            createdAt: m.createdAt,
          })),
        };
      }),

    create: protectedProcedure
      .input(CreateChatSchema)
      .mutation(async ({ ctx, input }) => {
        const chat = await db.createChat(
          ctx.user.id,
          input.mode || "consensus",
          input.speedTier || "normal",
          input.title || "New Chat",
          input.selectedModels
        );

        return {
          id: chat.id,
          title: chat.title,
          mode: chat.mode,
          speedTier: chat.speedTier,
        };
      }),

    update: protectedProcedure
      .input(UpdateChatSchema)
      .mutation(async ({ ctx, input }) => {
        const chat = await db.getChat(input.chatId, ctx.user.id);
        if (!chat) {
          throw new Error("Chat not found");
        }

        const updates: Record<string, unknown> = {};
        if (input.title !== undefined) updates.title = input.title;
        if (input.mode !== undefined) updates.mode = input.mode;
        if (input.speedTier !== undefined) updates.speedTier = input.speedTier;
        if (input.selectedModels !== undefined)
          updates.selectedModels = input.selectedModels;

        await db.updateChat(input.chatId, updates);

        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ chatId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteChat(input.chatId, ctx.user.id);
        return { success: true };
      }),

    // Cleanup empty chats older than 24 hours
    cleanupEmpty: protectedProcedure.mutation(async ({ ctx: _ctx }) => {
      const deletedCount = await db.cleanupEmptyChats(24);
      return { success: true, deletedCount };
    }),

    // Get count of empty chats for current user
    getEmptyCount: protectedProcedure.query(async ({ ctx }) => {
      const count = await db.getEmptyChatCount(ctx.user.id);
      return { count };
    }),

    // Generate a title from the first message
    generateTitle: protectedProcedure
      .input(z.object({ chatId: z.number(), firstMessage: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const chat = await db.getChat(input.chatId, ctx.user.id);
        if (!chat) {
          throw new Error("Chat not found");
        }

        try {
          const result = await invokeLLM({
            messages: [
              {
                role: "system",
                content:
                  "Generate a short, descriptive title (3-6 words) for a chat conversation based on the user's first message. Return ONLY the title, no quotes or punctuation at the end.",
              },
              {
                role: "user",
                content: input.firstMessage,
              },
            ],
          });

          const title =
            result.choices[0]?.message?.content
              ?.toString()
              .trim()
              .slice(0, 100) || "New Chat";
          await db.updateChat(input.chatId, { title });

          return { title };
        } catch (error) {
          console.error("Failed to generate title:", error);
          return { title: "New Chat" };
        }
      }),

    // Export chat as Markdown
    exportMarkdown: protectedProcedure
      .input(z.object({ chatId: z.number() }))
      .query(async ({ ctx, input }) => {
        const chat = await db.getChat(input.chatId, ctx.user.id);
        if (!chat) {
          throw new Error("Chat not found");
        }

        const messages = await db.getChatMessages(chat.id);

        let markdown = `# ${chat.title}\n\n`;
        markdown += `**Mode:** ${chat.mode}\n`;
        markdown += `**Created:** ${chat.createdAt.toISOString()}\n`;
        markdown += `**Messages:** ${chat.messageCount}\n\n`;
        markdown += `---\n\n`;

        for (const msg of messages) {
          const role = msg.role === "user" ? "**You:**" : "**RASPUTIN:**";
          markdown += `${role}\n\n${msg.content}\n\n`;
          if (msg.agreementPercentage) {
            markdown += `*Agreement: ${msg.agreementPercentage}%*\n\n`;
          }
          markdown += `---\n\n`;
        }

        return {
          markdown,
          filename: `${chat.title.replace(/[^a-z0-9]/gi, "-")}.md`,
        };
      }),

    search: protectedProcedure
      .input(z.object({ query: z.string() }))
      .query(async ({ ctx, input }) => {
        const chats = await db.searchChats(ctx.user.id, input.query);
        return chats.map(chat => ({
          id: chat.id,
          title: chat.title,
          mode: chat.mode,
          updatedAt: chat.updatedAt,
        }));
      }),
  }),

  // ============================================================================
  // Query Router (Non-streaming for basic queries)
  // ============================================================================
  query: router({
    // Simple query endpoint (non-streaming, for testing)
    submit: protectedProcedure
      .input(QuerySchema)
      .mutation(async ({ ctx, input }) => {
        const chat = await db.getChat(input.chatId, ctx.user.id);
        if (!chat) {
          throw new Error("Chat not found");
        }

        // Create user message
        const userMessage = await db.createMessage({
          chatId: input.chatId,
          role: "user",
          content: input.query,
        });

        // Get conversation history for context
        const allMessages = await db.getChatMessages(input.chatId);
        const conversationHistory = allMessages
          .filter(m => m.id !== userMessage.id)
          .slice(-20) // Last 20 messages for context
          .map(m => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }));

        let result;

        if (input.mode === "consensus") {
          result = await generateConsensus({
            query: input.query,
            speedTier: input.speedTier,
            selectedModels: chat.selectedModels || undefined,
            conversationHistory,
          });

          // Create assistant message with consensus result
          const assistantMessage = await db.createMessage({
            chatId: input.chatId,
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

          // Store individual model responses
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
          await db.updateChat(input.chatId, {
            totalTokens: chat.totalTokens + result.totalTokens,
            totalCost: (
              parseFloat(chat.totalCost) + result.totalCost
            ).toString(),
          });

          return {
            messageId: assistantMessage.id,
            mode: "consensus",
            summary: result.summary,
            agreementPercentage: result.agreementPercentage,
            modelResponses: result.modelResponses,
            totalLatencyMs: result.totalLatencyMs,
            totalTokens: result.totalTokens,
            totalCost: result.totalCost,
          };
        } else {
          // Synthesis mode
          result = await generateSynthesis({
            query: input.query,
            speedTier: input.speedTier,
            conversationHistory,
          });

          // Create assistant message with synthesis result
          const assistantMessage = await db.createMessage({
            chatId: input.chatId,
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

          // Store pipeline stages
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

          // Store proposer responses
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
          await db.updateChat(input.chatId, {
            totalTokens: chat.totalTokens + result.totalTokens,
            totalCost: (
              parseFloat(chat.totalCost) + result.totalCost
            ).toString(),
          });

          return {
            messageId: assistantMessage.id,
            mode: "synthesis",
            finalSynthesis: result.finalSynthesis,
            stages: result.stages,
            webSearchResults: result.webSearchResults,
            proposerResponses: result.proposerResponses,
            gapsIdentified: result.gapsIdentified,
            conflictsResolved: result.conflictsResolved,
            totalLatencyMs: result.totalLatencyMs,
            totalTokens: result.totalTokens,
            totalCost: result.totalCost,
          };
        }
      }),

    // Get model responses for a message
    getModelResponses: protectedProcedure
      .input(z.object({ messageId: z.number() }))
      .query(async ({ input }) => {
        return db.getMessageModelResponses(input.messageId);
      }),

    // Get pipeline stages for a synthesis message
    getPipelineStages: protectedProcedure
      .input(z.object({ messageId: z.number() }))
      .query(async ({ input }) => {
        return db.getMessagePipelineStages(input.messageId);
      }),
  }),

  // JARVIS Agent Router
  jarvis: router({
    // List user's agent tasks
    listTasks: protectedProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const tasks = await db.getUserAgentTasks(
          ctx.user.id,
          input?.limit || 50
        );
        return tasks.map(task => ({
          id: task.id,
          title: task.title,
          query: task.query,
          status: task.status,
          pendingApprovalId: task.pendingApprovalId,
          iterationCount: task.iterationCount,
          errorMessage: task.errorMessage,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt,
          completedAt: task.completedAt,
        }));
      }),

    // Get task messages only (for loading into UI)
    getTaskMessages: protectedProcedure
      .input(z.object({ taskId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        if (!input?.taskId) return [];
        const task = await db.getAgentTask(input.taskId, ctx.user.id);
        if (!task) throw new Error("Task not found");

        const messages = await db.getAgentTaskMessages(task.id);
        const toolCalls = await db.getAgentTaskToolCalls(task.id);

        return messages.map(m => {
          // Build steps from tool calls for assistant messages
          const steps =
            m.role === "assistant"
              ? toolCalls.map(tc => ({
                  id: String(tc.id),
                  type: "tool" as const,
                  tool: tc.toolName,
                  input:
                    typeof tc.input === "string"
                      ? tc.input
                      : JSON.stringify(tc.input || {}),
                  output: tc.output || "",
                  status:
                    tc.status === "completed"
                      ? ("success" as const)
                      : tc.status === "error"
                        ? ("error" as const)
                        : ("running" as const),
                  timestamp: new Date(tc.createdAt).getTime(),
                }))
              : [];

          return {
            id: String(m.id),
            role: (m.role === "system" ? "assistant" : m.role) as
              | "user"
              | "assistant",
            content: m.content,
            steps,
            timestamp: new Date(m.createdAt).getTime(),
          };
        });
      }),

    // Get a specific task with messages
    getTask: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .query(async ({ ctx, input }) => {
        const task = await db.getAgentTask(input.taskId, ctx.user.id);
        if (!task) throw new Error("Task not found");

        const messages = await db.getAgentTaskMessages(task.id);
        const toolCalls = await db.getAgentTaskToolCalls(task.id);
        const files = await db.getAgentTaskFiles(task.id);

        return {
          ...task,
          messages: messages.map(m => ({
            id: m.id,
            role: m.role,
            content: m.content,
            toolCalls: m.toolCalls,
            thinking: m.thinking,
            createdAt: m.createdAt,
          })),
          toolCalls: toolCalls.map(tc => ({
            id: tc.id,
            toolName: tc.toolName,
            input: tc.input,
            output: tc.output,
            status: tc.status,
            errorMessage: tc.errorMessage,
            durationMs: tc.durationMs,
            createdAt: tc.createdAt,
          })),
          files: files.map(f => ({
            id: f.id,
            fileName: f.fileName,
            filePath: f.filePath,
            mimeType: f.mimeType,
            fileSize: f.fileSize,
            source: f.source,
            s3Url: f.s3Url,
            createdAt: f.createdAt,
          })),
        };
      }),

    // Delete a task
    deleteTask: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteAgentTask(input.taskId, ctx.user.id);
        return { success: true };
      }),

    // Check rate limit
    checkRateLimit: protectedProcedure.query(async ({ ctx }) => {
      const today = new Date().toISOString().split("T")[0];
      return db.checkRateLimit(ctx.user.id, today, 100); // 100 tasks per day
    }),

    // Get usage stats
    getUsageStats: protectedProcedure
      .input(z.object({ days: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const stats = await db.getUserUsageStats(
          ctx.user.id,
          input?.days || 30
        );
        return stats.map(s => ({
          date: s.date,
          agentTaskCount: s.agentTaskCount,
          consensusQueryCount: s.consensusQueryCount,
          synthesisQueryCount: s.synthesisQueryCount,
          totalApiCalls: s.totalApiCalls,
          totalTokens: s.totalTokens,
          totalCost: s.totalCost,
        }));
      }),

    // Execute a task with JARVIS (with persistence)
    executeTask: protectedProcedure
      .input(
        z.object({
          task: z.string().min(1),
          taskId: z.number().optional(), // If provided, continue existing task
          conversationHistory: z
            .array(
              z.object({
                role: z.enum(["user", "assistant"]),
                content: z.string(),
              })
            )
            .optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Check rate limit
        const today = new Date().toISOString().split("T")[0];
        const rateLimit = await db.checkRateLimit(ctx.user.id, today, 100);
        if (!rateLimit.allowed) {
          throw new Error(
            `Rate limit exceeded. You've used ${rateLimit.current}/${rateLimit.limit} tasks today.`
          );
        }

        // Create or get task
        let taskId = input.taskId;
        let task;

        if (taskId) {
          task = await db.getAgentTask(taskId, ctx.user.id);
          if (!task) throw new Error("Task not found");
        } else {
          // Generate title from task
          const title =
            input.task.slice(0, 100) + (input.task.length > 100 ? "..." : "");
          task = await db.createAgentTask({
            userId: ctx.user.id,
            title,
            query: input.task,
            status: "running",
          });
          taskId = task.id;

          // Increment usage
          await db.incrementUsage(ctx.user.id, today, "agentTaskCount");
        }

        // Update task status
        await db.updateAgentTask(taskId, { status: "running" });

        // Create user message
        await db.createAgentMessage({
          taskId,
          role: "user",
          content: input.task,
        });

        // Get memory context for this task
        let memoryPromptAddition = "";
        let procedureGuidance = "";
        try {
          const { promptAddition } = await getPreTaskContext(
            input.task,
            ctx.user.id
          );
          memoryPromptAddition = promptAddition;
          if (memoryPromptAddition) {
            console.info(
              `[JARVIS] Retrieved memory context (${memoryPromptAddition.length} chars)`
            );
          }

          const matchedProcedure = await findMatchingProcedure(
            input.task,
            ctx.user.id
          );
          if (matchedProcedure) {
            console.info(
              `[JARVIS] Procedure match found: "${matchedProcedure.name}" (${matchedProcedure.successRate}% success rate)`
            );
          } else {
            console.info(`[JARVIS] No procedure match found for task`);
          }
          if (matchedProcedure && matchedProcedure.successRate >= 70) {
            procedureGuidance = generateProcedureGuidance(matchedProcedure);
            console.info(
              `[JARVIS] Found matching procedure: "${matchedProcedure.name}" ` +
                `(${matchedProcedure.successRate}% success rate)`
            );
          }
        } catch (error) {
          console.error("[JARVIS] Failed to retrieve memory context:", error);
        }

        const toolsUsed: string[] = [];
        const steps: Array<{
          type:
            | "thinking"
            | "tool_use"
            | "tool_result"
            | "response"
            | "complete"
            | "error";
          content?: string;
          toolCall?: ToolCall;
          toolResult?: ToolResult;
          summary?: string;
          artifacts?: unknown[];
        }> = [];

        const startTime = Date.now();
        let iterationCount = 0;
        let finalResult = "";
        let hasError = false;

        try {
          await runOrchestrator(
            input.task,
            {
              onThinking: (thought: string) => {
                steps.push({ type: "thinking", content: thought });
              },
              onToolCall: (toolCall: ToolCall) => {
                steps.push({ type: "tool_use", toolCall });
                toolsUsed.push(toolCall.name);
                iterationCount++;
              },
              onToolResult: (result: ToolResult) => {
                steps.push({ type: "tool_result", toolResult: result });
              },
              onComplete: (summary: string, artifacts?: unknown[]) => {
                steps.push({ type: "complete", summary, artifacts });
                finalResult = summary;
              },
              onError: (error: string) => {
                steps.push({ type: "error", content: error });
                hasError = true;
              },
            },
            async (toolName, toolInput) => {
              const toolCallRecord = await db.createAgentToolCall({
                taskId: taskId!,
                toolName,
                input: toolInput,
                status: "running",
              });

              const toolStartTime = Date.now();
              const logToolCall = (
                updates: Parameters<typeof db.updateAgentToolCall>[1]
              ) => {
                db.updateAgentToolCall(toolCallRecord.id, updates).catch(e =>
                  console.warn("[Router] Failed to update tool call:", e)
                );
              };

              try {
                const enrichedInput = {
                  ...toolInput,
                  userId: ctx.user.id,
                };
                const result = await executeTool(toolName, enrichedInput);
                db.incrementUsage(ctx.user.id, today, "totalApiCalls").catch(
                  e => console.warn("[Router] Failed to increment usage:", e)
                );

                if (result.startsWith("APPROVAL_REQUIRED:")) {
                  const parts = result.split(":");
                  const approvalId = parseInt(parts[1], 10);
                  logToolCall({
                    output: result,
                    status: "completed",
                    durationMs: Date.now() - toolStartTime,
                  });
                  await db.updateAgentTask(taskId!, {
                    status: "waiting_approval",
                    pendingApprovalId: approvalId,
                  });
                  const pauseError = new Error(
                    `TASK_PAUSED:APPROVAL_REQUIRED:${approvalId}`
                  );
                  pauseError.name = "ApprovalRequiredError";
                  throw pauseError;
                }

                logToolCall({
                  output: result,
                  status: "completed",
                  durationMs: Date.now() - toolStartTime,
                });
                return result;
              } catch (error) {
                const errorMsg =
                  error instanceof Error ? error.message : String(error);
                if (
                  error instanceof Error &&
                  error.name === "ApprovalRequiredError"
                ) {
                  throw error;
                }
                logToolCall({
                  status: "error",
                  errorMessage: errorMsg,
                  durationMs: Date.now() - toolStartTime,
                });
                throw error;
              }
            },
            {
              memoryContext: memoryPromptAddition,
              procedureGuidance,
              conversationHistory: input.conversationHistory,
              userId: ctx.user.id,
              enableMemoryInjection: true,
            }
          );
        } catch (error) {
          if (
            error instanceof Error &&
            error.name === "ApprovalRequiredError"
          ) {
            const match = error.message.match(/APPROVAL_REQUIRED:(\d+)/);
            const approvalId = match ? parseInt(match[1], 10) : null;
            steps.push({
              type: "waiting_approval" as "thinking",
              content: `Task paused: SSH command requires approval. Approval ID: ${approvalId}`,
            });
            return {
              success: true,
              taskId,
              status: "waiting_approval",
              pendingApprovalId: approvalId,
              steps,
            };
          }
          hasError = true;
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          steps.push({ type: "error", content: errorMsg });
        }

        const durationMs = Date.now() - startTime;
        await db.updateAgentTask(taskId, {
          status: hasError ? "failed" : "completed",
          result: finalResult,
          errorMessage: hasError
            ? steps.find(s => s.type === "error")?.content
            : undefined,
          iterationCount,
          durationMs,
          completedAt: new Date(),
        });

        // Create assistant message with result
        await db.createAgentMessage({
          taskId,
          role: "assistant",
          content: finalResult || (hasError ? "Task failed" : "Task completed"),
          toolCalls: steps
            .filter(s => s.type === "tool_use" && s.toolCall)
            .map(s => ({
              id: String(Math.random()),
              name: s.toolCall!.name,
              input: s.toolCall!.input,
              status: "completed" as const,
            })),
        });

        try {
          const toolCallSteps = steps
            .filter(s => s.type === "tool_use" && s.toolCall)
            .map((s, i) => {
              const resultStep = steps.find(
                (r, ri) => ri > i && r.type === "tool_result" && r.toolResult
              );
              return {
                toolName: s.toolCall!.name,
                input: s.toolCall!.input,
                output: resultStep?.toolResult?.output || "",
                success: !resultStep?.toolResult?.isError,
              };
            });

          const taskContext: TaskContext = {
            taskId: taskId!,
            userId: ctx.user.id,
            query: input.task,
          };
          const outcome: TaskOutcome = {
            success: !hasError,
            result: finalResult,
            error: hasError
              ? steps.find(s => s.type === "error")?.content
              : undefined,
            toolsUsed: Array.from(new Set(toolsUsed)),
            duration: durationMs,
            iterations: iterationCount,
            toolCallSteps,
          };
          await learnFromTask(taskContext, outcome);
          console.info(
            `[JARVIS] Learned from task ${taskId} (success: ${!hasError})`
          );

          // Trigger self-reflection for significant tasks (>2 iterations or failures)
          if (iterationCount > 2 || hasError) {
            try {
              const reflectionSystem = createSelfReflectionSystem(ctx.user.id);
              const toolCallDetails = steps
                .filter(s => s.type === "tool_use" && s.toolCall)
                .map((s, i) => {
                  const resultStep = steps.find(
                    (r, ri) =>
                      ri > i && r.type === "tool_result" && r.toolResult
                  );
                  return {
                    toolName: s.toolCall!.name,
                    input: s.toolCall!.input,
                    output: resultStep?.toolResult?.output || "",
                    success: !resultStep?.toolResult?.isError,
                    duration: 0, // Not tracked per-tool currently
                  };
                });

              const reflection = await reflectionSystem.reflectOnTask(taskId!, {
                taskDescription: input.task,
                toolCalls: toolCallDetails,
                finalResult: finalResult || "",
                errorMessages: steps
                  .filter(s => s.type === "error")
                  .map(s => s.content || "Unknown error"),
              });

              console.info(
                `[JARVIS] Self-reflection complete: ${reflection.lessonsLearned.length} lessons, ${reflection.newSkills.length} new skills`
              );
            } catch (reflectionError) {
              console.error(
                "[JARVIS] Self-reflection failed:",
                reflectionError
              );
            }
          }
        } catch (error) {
          console.error("[JARVIS] Failed to learn from task:", error);
        }

        return { taskId, steps };
      }),

    resumeTask: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const task = await db.getAgentTask(input.taskId, ctx.user.id);
        if (!task) {
          throw new Error("Task not found");
        }
        if (task.status !== "waiting_approval") {
          throw new Error(
            `Cannot resume task with status: ${task.status}. Task must be in waiting_approval status.`
          );
        }
        if (!task.pendingApprovalId) {
          throw new Error("No pending approval found for this task");
        }

        const approval = await ssh.getApprovalById(
          task.pendingApprovalId,
          ctx.user.id
        );

        if (!approval) {
          await db.updateAgentTask(input.taskId, {
            status: "failed",
            errorMessage: "Approval not found",
            pendingApprovalId: null,
          });
          throw new Error("Approval not found");
        }

        if (approval.status === "pending") {
          throw new Error(
            "Command has not been approved yet. Please approve the command first."
          );
        }

        if (approval.status !== "approved") {
          await db.updateAgentTask(input.taskId, {
            status: "failed",
            errorMessage: `Command was ${approval.status}`,
            pendingApprovalId: null,
          });
          throw new Error(`Command was ${approval.status}`);
        }

        await db.updateAgentTask(input.taskId, {
          status: "running",
          pendingApprovalId: null,
        });

        return {
          success: true,
          taskId: input.taskId,
          message:
            "Task resumed. The approved command will be executed on next iteration.",
        };
      }),

    // List running dev servers
    listDevServers: protectedProcedure.query(async () => {
      const { getAllDevServers } = await import("./services/jarvis/tools");
      const servers = getAllDevServers();
      return servers.map(s => ({
        projectPath: s.projectPath,
        port: s.port,
        url: s.url,
        status: s.status,
        startedAt: s.startedAt,
        sessionName: s.sessionName,
      }));
    }),

    // Get dev server info for a specific project
    getDevServerInfo: protectedProcedure
      .input(z.object({ projectPath: z.string() }))
      .query(async ({ input }) => {
        const { getDevServerInfo } = await import("./services/jarvis/tools");
        const info = getDevServerInfo(input.projectPath);
        if (!info) return null;
        return {
          projectPath: info.projectPath,
          port: info.port,
          url: info.url,
          status: info.status,
          startedAt: info.startedAt,
          sessionName: info.sessionName,
        };
      }),

    // ============================================================================
    // Async Task Queue - Background tasks that survive session disconnects
    // ============================================================================

    submitAsyncTask: protectedProcedure
      .input(
        z.object({
          taskType: z.enum([
            "jarvis_task",
            "agent_team",
            "deep_research",
            "code_generation",
            "document_generation",
            "scheduled_task",
            "webhook_task",
            "custom",
          ]),
          prompt: z.string(),
          input: z.record(z.string(), z.unknown()).optional(),
          priority: z.number().min(1).max(10).optional(),
          webhookUrl: z.string().url().optional(),
          scheduledFor: z.string().datetime().optional(),
          maxRetries: z.number().min(0).max(10).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { taskQueue } = await import("./services/jarvis/taskQueue");
        const taskId = await taskQueue.submitTask({
          userId: ctx.user.id,
          taskType: input.taskType,
          prompt: input.prompt,
          input: input.input,
          priority: input.priority,
          webhookUrl: input.webhookUrl,
          scheduledFor: input.scheduledFor
            ? new Date(input.scheduledFor)
            : undefined,
          maxRetries: input.maxRetries,
        });
        return { taskId, status: "queued" as const };
      }),

    getAsyncTaskStatus: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .query(async ({ ctx, input }) => {
        const { taskQueue } = await import("./services/jarvis/taskQueue");
        const status = await taskQueue.getTaskStatus(input.taskId);
        if (!status) throw new Error("Task not found");
        return status;
      }),

    listAsyncTasks: protectedProcedure
      .input(
        z
          .object({
            status: z
              .enum([
                "queued",
                "running",
                "completed",
                "failed",
                "cancelled",
                "paused",
              ])
              .optional(),
            limit: z.number().min(1).max(100).optional(),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        const { taskQueue } = await import("./services/jarvis/taskQueue");
        const tasks = await taskQueue.getUserTasks(ctx.user.id, {
          status: input?.status,
          limit: input?.limit,
        });
        return tasks.map(t => ({
          id: t.id,
          taskType: t.taskType,
          status: t.status,
          progress: t.progress,
          progressMessage: t.progressMessage,
          prompt: t.prompt.slice(0, 200),
          createdAt: t.createdAt,
          startedAt: t.startedAt,
          completedAt: t.completedAt,
          error: t.error,
        }));
      }),

    cancelAsyncTask: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { taskQueue } = await import("./services/jarvis/taskQueue");
        const success = await taskQueue.cancelTask(input.taskId, ctx.user.id);
        if (!success) throw new Error("Cannot cancel task");
        return { success: true };
      }),

    getAsyncTaskLogs: protectedProcedure
      .input(z.object({ taskId: z.number(), limit: z.number().optional() }))
      .query(async ({ input }) => {
        const { taskQueue } = await import("./services/jarvis/taskQueue");
        return taskQueue.getTaskLogs(input.taskId, input.limit);
      }),

    getQueueStats: protectedProcedure.query(async () => {
      const { taskQueue } = await import("./services/jarvis/taskQueue");
      return taskQueue.getQueueStats();
    }),
  }),

  // ============================================================================
  // Voice Router - Speech-to-Text and Text-to-Speech
  // ============================================================================
  voice: router({
    // Get available TTS voices
    getVoices: protectedProcedure.query(async () => {
      const { getVoices, VOICE_OPTIONS, DEFAULT_VOICE } = await import(
        "./services/voice/elevenlabs"
      );
      try {
        const voices = await getVoices();
        return {
          voices: voices.slice(0, 10).map(v => ({
            id: v.voice_id,
            name: v.name,
            previewUrl: v.preview_url,
          })),
          presets: Object.entries(VOICE_OPTIONS).map(([key, v]) => ({
            key,
            id: v.id,
            name: v.name,
            description: v.description,
          })),
          defaultVoice: DEFAULT_VOICE.id,
        };
      } catch (error) {
        console.error("Failed to get voices:", error);
        return {
          voices: [],
          presets: Object.entries(VOICE_OPTIONS).map(([key, v]) => ({
            key,
            id: v.id,
            name: v.name,
            description: v.description,
          })),
          defaultVoice: DEFAULT_VOICE.id,
        };
      }
    }),

    // Text-to-Speech - returns audio as base64
    textToSpeech: protectedProcedure
      .input(
        z.object({
          text: z.string().min(1).max(5000),
          voiceId: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { textToSpeech } = await import("./services/voice/elevenlabs");

        // Clean text for TTS - strip markdown, code, and other non-speech elements
        const cleanTextForSpeech = (text: string): string => {
          return (
            text
              // Remove code blocks (```...```)
              .replace(/```[\s\S]*?```/g, "")
              // Remove inline code (`...`)
              .replace(/`[^`]+`/g, "")
              // Remove markdown links but keep text [text](url) -> text
              .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
              // Remove raw URLs
              .replace(/https?:\/\/[^\s]+/g, "")
              // Remove markdown headers (# ## ### etc) but keep text
              .replace(/^#{1,6}\s+/gm, "")
              // Remove bold/italic markers
              .replace(/\*\*([^*]+)\*\*/g, "$1")
              .replace(/\*([^*]+)\*/g, "$1")
              .replace(/__([^_]+)__/g, "$1")
              .replace(/_([^_]+)_/g, "$1")
              // Remove horizontal rules
              .replace(/^[-*_]{3,}$/gm, "")
              // Remove HTML tags
              .replace(/<[^>]+>/g, "")
              // Remove image references ![alt](url)
              .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
              // Remove blockquotes >
              .replace(/^>\s*/gm, "")
              // Remove bullet points but keep text
              .replace(/^[-*+]\s+/gm, "")
              // Remove numbered lists markers but keep text
              .replace(/^\d+\.\s+/gm, "")
              // Clean up multiple newlines
              .replace(/\n{3,}/g, "\n\n")
              // Clean up multiple spaces
              .replace(/  +/g, " ")
              // Trim
              .trim()
          );
        };

        const cleanedText = cleanTextForSpeech(input.text);

        if (!cleanedText) {
          throw new Error("No speakable text after cleaning");
        }

        try {
          const audioBuffer = await textToSpeech(cleanedText, {
            voiceId: input.voiceId,
          });
          // Convert to base64 for transmission
          const base64Audio = Buffer.from(audioBuffer).toString("base64");
          return {
            audio: base64Audio,
            mimeType: "audio/mpeg",
          };
        } catch (error) {
          console.error("TTS error:", error);
          throw new Error(`Text-to-speech failed: ${error}`);
        }
      }),

    // Speech-to-Text - accepts audio URL
    transcribe: protectedProcedure
      .input(
        z.object({
          audioUrl: z.string(),
          language: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { transcribeVoice } = await import(
          "./services/voice/speechToText"
        );
        try {
          const result = await transcribeVoice(input.audioUrl, {
            language: input.language,
          });
          return result;
        } catch (error) {
          console.error("STT error:", error);
          throw new Error(`Speech-to-text failed: ${error}`);
        }
      }),

    // Get subscription info for rate limiting awareness
    getUsage: protectedProcedure.query(async () => {
      const { getSubscriptionInfo } = await import(
        "./services/voice/elevenlabs"
      );
      try {
        const info = await getSubscriptionInfo();
        return {
          charactersUsed: info.character_count,
          characterLimit: info.character_limit,
          canExtend: info.can_extend_character_limit,
          percentUsed: Math.round(
            (info.character_count / info.character_limit) * 100
          ),
        };
      } catch (error) {
        console.error("Failed to get usage:", error);
        return null;
      }
    }),
  }),

  // ============================================================================
  // Workspace Router - Persistent Development Environments
  // ============================================================================
  workspace: router({
    // List all workspaces for the current user
    list: protectedProcedure.query(async ({ ctx }) => {
      const workspaces = await db.getWorkspacesByUserId(ctx.user.id);
      return workspaces;
    }),

    // Get a single workspace by ID
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const workspace = await db.getWorkspaceById(input.id);
        if (!workspace || workspace.userId !== ctx.user.id) {
          throw new Error("Workspace not found");
        }
        await db.updateWorkspaceAccess(input.id);
        return workspace;
      }),

    // Create a new workspace
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1).max(255),
          description: z.string().optional(),
          template: z.string().default("blank"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { createWorkspace, getWorkspacePath } = await import(
          "./services/workspace"
        );

        // Generate unique workspace ID
        const workspaceId = `ws-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const basePath = getWorkspacePath(ctx.user.id, workspaceId);

        // Create workspace on filesystem
        await createWorkspace(
          ctx.user.id,
          workspaceId,
          input.name,
          input.template as any
        );

        // Create database record
        const workspace = await db.createWorkspaceRecord({
          userId: ctx.user.id,
          name: input.name,
          description: input.description || null,
          template: input.template,
          basePath,
          status: "ready",
          gitInitialized: 1,
          gitBranch: "main",
        });

        return workspace;
      }),

    // Delete a workspace
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const workspace = await db.getWorkspaceById(input.id);
        if (!workspace || workspace.userId !== ctx.user.id) {
          throw new Error("Workspace not found");
        }

        const { deleteWorkspace } = await import("./services/workspace");
        const workspaceId = workspace.basePath.split("/").pop() || "";
        await deleteWorkspace(ctx.user.id, workspaceId);
        await db.deleteWorkspaceRecord(input.id);

        return { success: true };
      }),

    // List files in a workspace directory
    listFiles: protectedProcedure
      .input(
        z.object({
          workspaceId: z.number(),
          path: z.string().default(""),
        })
      )
      .query(async ({ ctx, input }) => {
        const workspace = await db.getWorkspaceById(input.workspaceId);
        if (!workspace || workspace.userId !== ctx.user.id) {
          throw new Error("Workspace not found");
        }

        const { listFiles } = await import("./services/workspace");
        const wsId = workspace.basePath.split("/").pop() || "";
        return await listFiles(ctx.user.id, wsId, input.path);
      }),

    // Read a file
    readFile: protectedProcedure
      .input(
        z.object({
          workspaceId: z.number(),
          path: z.string(),
        })
      )
      .query(async ({ ctx, input }) => {
        const workspace = await db.getWorkspaceById(input.workspaceId);
        if (!workspace || workspace.userId !== ctx.user.id) {
          throw new Error("Workspace not found");
        }

        const { readFile } = await import("./services/workspace");
        const wsId = workspace.basePath.split("/").pop() || "";
        const content = await readFile(ctx.user.id, wsId, input.path);
        return { content };
      }),

    // Write a file
    writeFile: protectedProcedure
      .input(
        z.object({
          workspaceId: z.number(),
          path: z.string(),
          content: z.string(),
          autoCommit: z.boolean().default(true),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const workspace = await db.getWorkspaceById(input.workspaceId);
        if (!workspace || workspace.userId !== ctx.user.id) {
          throw new Error("Workspace not found");
        }

        const { writeFile } = await import("./services/workspace");
        const wsId = workspace.basePath.split("/").pop() || "";
        await writeFile(
          ctx.user.id,
          wsId,
          input.path,
          input.content,
          input.autoCommit
        );
        return { success: true };
      }),

    // Delete a file
    deleteFile: protectedProcedure
      .input(
        z.object({
          workspaceId: z.number(),
          path: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const workspace = await db.getWorkspaceById(input.workspaceId);
        if (!workspace || workspace.userId !== ctx.user.id) {
          throw new Error("Workspace not found");
        }

        const { deleteFile } = await import("./services/workspace");
        const wsId = workspace.basePath.split("/").pop() || "";
        await deleteFile(ctx.user.id, wsId, input.path);
        return { success: true };
      }),

    // Create a directory
    createDirectory: protectedProcedure
      .input(
        z.object({
          workspaceId: z.number(),
          path: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const workspace = await db.getWorkspaceById(input.workspaceId);
        if (!workspace || workspace.userId !== ctx.user.id) {
          throw new Error("Workspace not found");
        }

        const { createDirectory } = await import("./services/workspace");
        const wsId = workspace.basePath.split("/").pop() || "";
        await createDirectory(ctx.user.id, wsId, input.path);
        return { success: true };
      }),

    // Get git commit history
    getCommits: protectedProcedure
      .input(
        z.object({
          workspaceId: z.number(),
          limit: z.number().default(20),
        })
      )
      .query(async ({ ctx, input }) => {
        const workspace = await db.getWorkspaceById(input.workspaceId);
        if (!workspace || workspace.userId !== ctx.user.id) {
          throw new Error("Workspace not found");
        }

        const { getCommitHistory } = await import("./services/workspace");
        const wsId = workspace.basePath.split("/").pop() || "";
        return await getCommitHistory(ctx.user.id, wsId, input.limit);
      }),

    // Get git status
    getGitStatus: protectedProcedure
      .input(z.object({ workspaceId: z.number() }))
      .query(async ({ ctx, input }) => {
        const workspace = await db.getWorkspaceById(input.workspaceId);
        if (!workspace || workspace.userId !== ctx.user.id) {
          throw new Error("Workspace not found");
        }

        const { getGitStatus } = await import("./services/workspace");
        const wsId = workspace.basePath.split("/").pop() || "";
        return await getGitStatus(ctx.user.id, wsId);
      }),

    // Create a checkpoint
    createCheckpoint: protectedProcedure
      .input(
        z.object({
          workspaceId: z.number(),
          name: z.string().min(1),
          message: z.string().default(""),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const workspace = await db.getWorkspaceById(input.workspaceId);
        if (!workspace || workspace.userId !== ctx.user.id) {
          throw new Error("Workspace not found");
        }

        const { createCheckpoint } = await import("./services/workspace");
        const wsId = workspace.basePath.split("/").pop() || "";
        const commit = await createCheckpoint(
          ctx.user.id,
          wsId,
          input.name,
          input.message
        );

        if (commit) {
          await db.createWorkspaceCommit({
            workspaceId: input.workspaceId,
            commitHash: commit.hash,
            message: commit.message,
            authorName: commit.author,
            isCheckpoint: 1,
            checkpointName: input.name,
          });
        }

        return commit;
      }),

    // Rollback to a commit
    rollback: protectedProcedure
      .input(
        z.object({
          workspaceId: z.number(),
          commitHash: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const workspace = await db.getWorkspaceById(input.workspaceId);
        if (!workspace || workspace.userId !== ctx.user.id) {
          throw new Error("Workspace not found");
        }

        const { rollbackToCommit } = await import("./services/workspace");
        const wsId = workspace.basePath.split("/").pop() || "";
        const success = await rollbackToCommit(
          ctx.user.id,
          wsId,
          input.commitHash
        );

        if (success) {
          await db.updateWorkspace(input.workspaceId, {
            lastCommitHash: input.commitHash,
          });
        }

        return { success };
      }),

    // Execute a command in workspace
    executeCommand: protectedProcedure
      .input(
        z.object({
          workspaceId: z.number(),
          command: z.string(),
          timeout: z.number().default(30000),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const workspace = await db.getWorkspaceById(input.workspaceId);
        if (!workspace || workspace.userId !== ctx.user.id) {
          throw new Error("Workspace not found");
        }

        const { executeCommand } = await import("./services/workspace");
        const wsId = workspace.basePath.split("/").pop() || "";
        return await executeCommand(
          ctx.user.id,
          wsId,
          input.command,
          input.timeout
        );
      }),

    // Start dev server
    startDevServer: protectedProcedure
      .input(
        z.object({
          workspaceId: z.number(),
          command: z.string().optional(),
          port: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const workspace = await db.getWorkspaceById(input.workspaceId);
        if (!workspace || workspace.userId !== ctx.user.id) {
          throw new Error("Workspace not found");
        }

        const { startDevServer } = await import("./services/workspace");
        const wsId = workspace.basePath.split("/").pop() || "";
        const result = await startDevServer(
          ctx.user.id,
          wsId,
          input.command,
          input.port
        );

        if (result) {
          await db.updateWorkspace(input.workspaceId, {
            status: "running",
            devServerPort: result.port,
            devServerUrl: result.url,
          });
        }

        return result;
      }),

    // Stop dev server
    stopDevServer: protectedProcedure
      .input(z.object({ workspaceId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const workspace = await db.getWorkspaceById(input.workspaceId);
        if (!workspace || workspace.userId !== ctx.user.id) {
          throw new Error("Workspace not found");
        }

        const { stopDevServer } = await import("./services/workspace");
        const wsId = workspace.basePath.split("/").pop() || "";
        await stopDevServer(ctx.user.id, wsId);

        await db.updateWorkspace(input.workspaceId, {
          status: "stopped",
          devServerPort: null,
          devServerUrl: null,
        });

        return { success: true };
      }),

    // Get available templates
    getTemplates: publicProcedure.query(async () => {
      const { WORKSPACE_TEMPLATES } = await import("./services/workspace");
      return Object.values(WORKSPACE_TEMPLATES).map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        category: t.category,
        icon: t.icon,
      }));
    }),

    // Get disk usage
    getDiskUsage: protectedProcedure
      .input(z.object({ workspaceId: z.number() }))
      .query(async ({ ctx, input }) => {
        const workspace = await db.getWorkspaceById(input.workspaceId);
        if (!workspace || workspace.userId !== ctx.user.id) {
          throw new Error("Workspace not found");
        }

        const { getDiskUsage } = await import("./services/workspace");
        const wsId = workspace.basePath.split("/").pop() || "";
        const usageMb = await getDiskUsage(ctx.user.id, wsId);

        return {
          usageMb,
          limitMb: workspace.diskLimitMb || 5120,
          percentUsed: Math.round(
            (usageMb / (workspace.diskLimitMb || 5120)) * 100
          ),
        };
      }),
  }),

  // ============================================================================
  // Schedule Router - Recurring Task Automation
  // ============================================================================
  schedule: router({
    // List all schedules for the current user
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserScheduledTasks(ctx.user.id);
    }),

    // Create a new scheduled task
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          prompt: z.string().min(1),
          scheduleType: z.enum(["once", "daily", "weekly", "monthly", "cron"]),
          timeOfDay: z.string().optional(), // HH:mm format
          dayOfWeek: z.number().min(0).max(6).optional(), // For weekly
          dayOfMonth: z.number().min(1).max(31).optional(), // For monthly
          cronExpression: z.string().optional(), // For cron type
          enabled: z.boolean().default(true),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Calculate next run time
        const now = new Date();
        const nextRunAt = new Date();

        if (input.timeOfDay) {
          const [hours, minutes] = input.timeOfDay.split(":").map(Number);
          nextRunAt.setHours(hours, minutes, 0, 0);
          if (nextRunAt <= now) {
            nextRunAt.setDate(nextRunAt.getDate() + 1);
          }
        }

        const scheduleId = await db.createScheduledTask({
          userId: ctx.user.id,
          name: input.name,
          prompt: input.prompt,
          scheduleType: input.scheduleType,
          cronExpression: input.cronExpression || null,
          timeOfDay: input.timeOfDay || null,
          dayOfWeek: input.dayOfWeek ?? null,
          dayOfMonth: input.dayOfMonth ?? null,
          enabled: input.enabled ? 1 : 0,
          nextRunAt,
        });

        return { id: scheduleId };
      }),

    // Update a scheduled task
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          prompt: z.string().optional(),
          enabled: z.boolean().optional(),
          timeOfDay: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const schedule = await db.getScheduledTask(input.id);
        if (!schedule || schedule.userId !== ctx.user.id) {
          throw new Error("Schedule not found");
        }

        const updates: Record<string, unknown> = {};
        if (input.name !== undefined) updates.name = input.name;
        if (input.prompt !== undefined) updates.prompt = input.prompt;
        if (input.enabled !== undefined)
          updates.enabled = input.enabled ? 1 : 0;
        if (input.timeOfDay !== undefined) updates.timeOfDay = input.timeOfDay;

        await db.updateScheduledTask(input.id, updates);
        return { success: true };
      }),

    // Delete a scheduled task
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const schedule = await db.getScheduledTask(input.id);
        if (!schedule || schedule.userId !== ctx.user.id) {
          throw new Error("Schedule not found");
        }

        await db.deleteScheduledTask(input.id);
        return { success: true };
      }),

    // Toggle active status
    toggle: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const schedule = await db.getScheduledTask(input.id);
        if (!schedule || schedule.userId !== ctx.user.id) {
          throw new Error("Schedule not found");
        }

        await db.updateScheduledTask(input.id, {
          enabled: schedule.enabled ? 0 : 1,
        });
        return { success: true, enabled: !schedule.enabled };
      }),
  }),

  // ============================================================================
  // SSH Hosts Router - Remote server management
  // ============================================================================
  ssh: router({
    // List all hosts for current user
    listHosts: protectedProcedure.query(async ({ ctx }) => {
      return ssh.getUserSshHosts(ctx.user.id);
    }),

    // Get single host details
    getHost: protectedProcedure
      .input(z.object({ hostId: z.number() }))
      .query(async ({ ctx, input }) => {
        const host = await ssh.getSshHost(input.hostId, ctx.user.id);
        if (!host) throw new Error("Host not found");
        return host;
      }),

    // Create new SSH host
    createHost: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          hostname: z.string().min(1),
          port: z.number().min(1).max(65535).optional(),
          username: z.string().min(1),
          authType: z.enum(["password", "key"]),
          password: z.string().optional(),
          privateKey: z.string().optional(),
          passphrase: z.string().optional(),
          description: z.string().optional(),
          tags: z.array(z.string()).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return ssh.createSshHost(ctx.user.id, input);
      }),

    // Update SSH host
    updateHost: protectedProcedure
      .input(
        z.object({
          hostId: z.number(),
          name: z.string().optional(),
          hostname: z.string().optional(),
          port: z.number().optional(),
          username: z.string().optional(),
          description: z.string().optional(),
          tags: z.array(z.string()).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { hostId, ...data } = input;
        await ssh.updateSshHost(hostId, ctx.user.id, data);
        return { success: true };
      }),

    // Delete SSH host
    deleteHost: protectedProcedure
      .input(z.object({ hostId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await ssh.deleteSshHost(input.hostId, ctx.user.id);
        return { success: true };
      }),

    // Test SSH connection
    testConnection: protectedProcedure
      .input(z.object({ hostId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return ssh.sshManager.testConnection(input.hostId, ctx.user.id);
      }),

    // Verify and pin host key
    verifyHostKey: protectedProcedure
      .input(z.object({ hostId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return ssh.verifyAndPinHostKey(input.hostId, ctx.user.id);
      }),

    // Execute command on remote host
    executeCommand: protectedProcedure
      .input(
        z.object({
          hostId: z.number(),
          command: z.string().min(1),
          workingDirectory: z.string().optional(),
          timeout: z.number().optional(),
          taskId: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return ssh.sshManager.executeCommand(
          input.hostId,
          ctx.user.id,
          input.command,
          {
            workingDirectory: input.workingDirectory,
            timeout: input.timeout,
            taskId: input.taskId,
          }
        );
      }),

    // Read file from remote host
    readFile: protectedProcedure
      .input(
        z.object({
          hostId: z.number(),
          filePath: z.string().min(1),
          taskId: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return ssh.sshManager.readFile(
          input.hostId,
          ctx.user.id,
          input.filePath,
          input.taskId
        );
      }),

    // Write file to remote host
    writeFile: protectedProcedure
      .input(
        z.object({
          hostId: z.number(),
          filePath: z.string().min(1),
          content: z.string(),
          taskId: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return ssh.sshManager.writeFile(
          input.hostId,
          ctx.user.id,
          input.filePath,
          input.content,
          input.taskId
        );
      }),

    // List directory on remote host
    listDirectory: protectedProcedure
      .input(
        z.object({
          hostId: z.number(),
          dirPath: z.string().min(1),
          taskId: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return ssh.sshManager.listDirectory(
          input.hostId,
          ctx.user.id,
          input.dirPath,
          input.taskId
        );
      }),

    // Get host permissions
    getPermissions: protectedProcedure
      .input(z.object({ hostId: z.number() }))
      .query(async ({ ctx, input }) => {
        // Verify ownership first
        const host = await ssh.getSshHost(input.hostId, ctx.user.id);
        if (!host) throw new Error("Host not found");
        return ssh.getHostPermissions(input.hostId);
      }),

    // Update host permissions
    updatePermissions: protectedProcedure
      .input(
        z.object({
          hostId: z.number(),
          allowedPaths: z.array(z.string()).optional(),
          blockedPaths: z.array(z.string()).optional(),
          allowedCommands: z.array(z.string()).optional(),
          blockedCommands: z.array(z.string()).optional(),
          approvalRequiredCommands: z.array(z.string()).optional(),
          requireApprovalForAll: z.boolean().optional(),
          maxExecutionTime: z.number().optional(),
          allowFileWrite: z.boolean().optional(),
          allowFileDelete: z.boolean().optional(),
          allowSudo: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const {
          hostId,
          requireApprovalForAll,
          allowFileWrite,
          allowFileDelete,
          allowSudo,
          ...rest
        } = input;
        await ssh.updateHostPermissions(hostId, ctx.user.id, {
          ...rest,
          requireApprovalForAll: requireApprovalForAll ? 1 : 0,
          allowFileWrite: allowFileWrite ? 1 : 0,
          allowFileDelete: allowFileDelete ? 1 : 0,
          allowSudo: allowSudo ? 1 : 0,
        });
        return { success: true };
      }),

    // Get audit log for host
    getAuditLog: protectedProcedure
      .input(
        z.object({
          hostId: z.number(),
          limit: z.number().optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        return ssh.getHostAuditLog(input.hostId, ctx.user.id, input.limit);
      }),

    getPendingApprovals: protectedProcedure.query(async ({ ctx }) => {
      return ssh.getPendingApprovals(ctx.user.id);
    }),

    getApprovalHistory: protectedProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        return ssh.getApprovalHistory(ctx.user.id, input?.limit || 50);
      }),

    // Approve pending command
    approveCommand: protectedProcedure
      .input(
        z.object({
          approvalId: z.number(),
          modifiedCommand: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return ssh.approvePendingCommand(
          input.approvalId,
          ctx.user.id,
          input.modifiedCommand
        );
      }),

    // Reject pending command
    rejectCommand: protectedProcedure
      .input(
        z.object({
          approvalId: z.number(),
          reason: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await ssh.rejectPendingCommand(
          input.approvalId,
          ctx.user.id,
          input.reason
        );
        return { success: true };
      }),
  }),

  // ============================================================================
  // Infrastructure Monitoring Router
  // ============================================================================
  infrastructure: router({
    // Get all monitored hosts
    listHosts: protectedProcedure.query(async ({ ctx }) => {
      const { healthCollector } = await import("./services/infrastructure");
      return healthCollector.getMonitoredHosts(ctx.user.id);
    }),

    // Add host to monitoring
    addHost: protectedProcedure
      .input(
        z.object({
          sshHostId: z.number(),
          checkIntervalMinutes: z.number().min(1).max(1440).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { healthCollector } = await import("./services/infrastructure");
        return healthCollector.addHostToMonitoring(
          ctx.user.id,
          input.sshHostId,
          input.checkIntervalMinutes
        );
      }),

    // Remove host from monitoring
    removeHost: protectedProcedure
      .input(z.object({ hostId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { healthCollector } = await import("./services/infrastructure");
        await healthCollector.removeHostFromMonitoring(
          input.hostId,
          ctx.user.id
        );
        return { success: true };
      }),

    // Get health metrics for a host
    getMetrics: protectedProcedure
      .input(
        z.object({
          hostId: z.number(),
          hours: z.number().min(1).max(168).optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        const { healthCollector } = await import("./services/infrastructure");
        return healthCollector.getHostMetrics(
          input.hostId,
          ctx.user.id,
          input.hours
        );
      }),

    // Get active incidents
    getIncidents: protectedProcedure
      .input(
        z.object({
          status: z.enum(["open", "investigating", "resolved"]).optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        const { alertEngine } = await import("./services/infrastructure");
        return alertEngine.getIncidents(ctx.user.id, input.status);
      }),

    // Get alert rules
    getAlertRules: protectedProcedure.query(async ({ ctx }) => {
      const { alertEngine } = await import("./services/infrastructure");
      return alertEngine.getAlertRules(ctx.user.id);
    }),

    // Create alert rule
    createAlertRule: protectedProcedure
      .input(
        z.object({
          hostId: z.number(),
          name: z.string(),
          metric: z.string(),
          operator: z.enum(["gt", "lt", "eq", "gte", "lte"]),
          threshold: z.number(),
          severity: z.enum(["info", "warning", "critical"]),
          autoRemediate: z.boolean().optional(),
          remediationCommand: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { alertEngine } = await import("./services/infrastructure");
        return alertEngine.createAlertRule(ctx.user.id, input);
      }),
  }),

  // ============================================================================
  // Multi-Agent Router
  // ============================================================================
  agents: router({
    // List all agents
    list: protectedProcedure.query(async ({ ctx }) => {
      const { agentManager } = await import("./services/multiAgent");
      return agentManager.listAgents(ctx.user.id);
    }),

    // Create a new agent
    create: protectedProcedure
      .input(
        z.object({
          name: z.string(),
          type: z.enum([
            "orchestrator",
            "coordinator",
            "specialist",
            "worker",
            "code",
            "research",
            "sysadmin",
            "data",
            "custom",
          ]),
          systemPrompt: z.string().optional(),
          capabilities: z
            .object({
              canBrowse: z.boolean().optional(),
              canCode: z.boolean().optional(),
              canSSH: z.boolean().optional(),
              canSearch: z.boolean().optional(),
              canGenerateImages: z.boolean().optional(),
            })
            .optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { agentManager } = await import("./services/multiAgent");
        return agentManager.createAgent(ctx.user.id, input.name, input.type, {
          systemPrompt: input.systemPrompt,
          capabilities: input.capabilities,
        });
      }),

    // Run multi-agent task
    runTask: protectedProcedure
      .input(
        z.object({
          task: z.string(),
          coordinatorId: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { multiAgentOrchestrator } = await import(
          "./services/multiAgent"
        );
        return multiAgentOrchestrator.runTask(
          ctx.user.id,
          input.task,
          input.coordinatorId
        );
      }),

    // Get agent messages
    getMessages: protectedProcedure
      .input(z.object({ agentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const { agentManager } = await import("./services/multiAgent");
        return agentManager.getAgentMessages(input.agentId, ctx.user.id);
      }),
  }),

  // ============================================================================
  // RAG (Codebase Understanding) Router
  // ============================================================================
  rag: router({
    // List indexed projects
    listProjects: protectedProcedure.query(async ({ ctx }) => {
      const { ragIndexer } = await import("./services/rag");
      return ragIndexer.listProjects(ctx.user.id);
    }),

    // Index a project
    indexProject: protectedProcedure
      .input(
        z.object({
          name: z.string(),
          path: z.string(),
          sshHostId: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { ragIndexer } = await import("./services/rag");
        return ragIndexer.createAndIndexProject(
          ctx.user.id,
          input.name,
          input.path,
          input.sshHostId
        );
      }),

    // Search code
    search: protectedProcedure
      .input(
        z.object({
          query: z.string(),
          projectId: z.number().optional(),
          limit: z.number().min(1).max(50).optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        const { ragSearch } = await import("./services/rag");
        return ragSearch.search(
          ctx.user.id,
          input.query,
          input.projectId,
          input.limit
        );
      }),

    // Get project stats
    getProjectStats: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        const { ragIndexer } = await import("./services/rag");
        return ragIndexer.getProjectStats(input.projectId, ctx.user.id);
      }),
  }),

  // ============================================================================
  // Events & Webhooks Router
  // ============================================================================
  events: router({
    // List webhook endpoints
    listWebhooks: protectedProcedure.query(async ({ ctx }) => {
      const { webhookHandler } = await import("./services/events");
      return webhookHandler.getUserEndpoints(ctx.user.id);
    }),

    // Create webhook endpoint
    createWebhook: protectedProcedure
      .input(
        z.object({
          name: z.string(),
          description: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { webhookHandler } = await import("./services/events");
        return webhookHandler.createEndpoint(ctx.user.id, input.name, {
          description: input.description,
        });
      }),

    // Delete webhook endpoint
    deleteWebhook: protectedProcedure
      .input(z.object({ endpointId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { webhookHandler } = await import("./services/events");
        await webhookHandler.deleteEndpoint(input.endpointId);
        return { success: true };
      }),

    // Create webhook trigger
    createTrigger: protectedProcedure
      .input(
        z.object({
          webhookEndpointId: z.number(),
          name: z.string(),
          description: z.string().optional(),
          conditionType: z
            .enum(["always", "json_match", "regex", "expression"])
            .optional(),
          conditionConfig: z.record(z.string(), z.unknown()).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { webhookHandler } = await import("./services/events");
        return webhookHandler.createWebhookTrigger(
          ctx.user.id,
          input.webhookEndpointId,
          input.name,
          {
            description: input.description,
            conditionType: input.conditionType,
            conditionConfig: input.conditionConfig,
          }
        );
      }),

    // Create cron trigger
    createCronTrigger: protectedProcedure
      .input(
        z.object({
          name: z.string(),
          cronExpression: z.string(),
          description: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { cronScheduler } = await import("./services/events");
        return cronScheduler.createCronTrigger(
          ctx.user.id,
          input.name,
          input.cronExpression,
          { description: input.description }
        );
      }),

    // List cron triggers
    listCronTriggers: protectedProcedure.query(async ({ ctx }) => {
      const { cronScheduler } = await import("./services/events");
      return cronScheduler.getUserCronTriggers(ctx.user.id);
    }),

    // Create action for trigger
    createAction: protectedProcedure
      .input(
        z.object({
          triggerId: z.number(),
          name: z.string(),
          actionType: z.enum([
            "jarvis_task",
            "notification",
            "webhook",
            "command",
            "chain_event",
          ]),
          actionConfig: z.record(z.string(), z.unknown()),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { eventExecutor } = await import("./services/events");
        return eventExecutor.createAction(
          input.triggerId,
          input.name,
          input.actionType,
          input.actionConfig as any
        );
      }),

    // Get trigger actions
    getTriggerActions: protectedProcedure
      .input(z.object({ triggerId: z.number() }))
      .query(async ({ input }) => {
        const { eventExecutor } = await import("./services/events");
        return eventExecutor.getTriggerActions(input.triggerId);
      }),

    // Test webhook endpoint
    testWebhook: protectedProcedure
      .input(
        z.object({
          webhookId: z.number(),
          payload: z.record(z.string(), z.unknown()),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { webhookHandler } = await import("./services/events");
        // Get the webhook endpoint
        const endpoints = await webhookHandler.getUserEndpoints(ctx.user.id);
        const endpoint = endpoints.find(e => e.id === input.webhookId);
        if (!endpoint) {
          throw new Error("Webhook endpoint not found");
        }
        // Simulate processing the webhook
        const result = await webhookHandler.processWebhook(
          endpoint.path,
          { "x-test-webhook": "true" },
          input.payload,
          "127.0.0.1"
        );
        return {
          success: true,
          webhookId: input.webhookId,
          path: endpoint.path,
          payload: input.payload,
          result,
          timestamp: new Date().toISOString(),
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
