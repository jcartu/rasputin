import { eq, desc, and, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  chats,
  messages,
  modelResponses,
  synthesisPipelineStages,
  Chat,
  Message,
  ModelResponse,
  SynthesisPipelineStage,
  InsertChat,
  InsertMessage,
  InsertModelResponse,
  InsertSynthesisPipelineStage,
  scheduledTasks,
  scheduledTaskRuns,
  ScheduledTask,
  ScheduledTaskRun,
  InsertScheduledTask,
  InsertScheduledTaskRun,
  workspaces,
  workspaceFiles,
  workspaceCommits,
  workspaceTemplates,
  workspaceProcesses,
  Workspace,
  WorkspaceFile,
  WorkspaceCommit,
  WorkspaceTemplate,
  WorkspaceProcess,
  InsertWorkspace,
  InsertWorkspaceFile,
  InsertWorkspaceCommit,
  InsertWorkspaceTemplate,
  InsertWorkspaceProcess,
  agentTasks,
  agentMessages,
  agentToolCalls,
  usageTracking,
  agentFiles,
  AgentTask,
  AgentMessage,
  AgentToolCall,
  UsageTracking,
  AgentFile,
  InsertAgentTask,
  InsertAgentMessage,
  InsertAgentToolCall,
  InsertAgentFile,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { QueryMode, SpeedTier } from "../shared/rasputin";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============================================================================
// User Functions
// ============================================================================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod", "avatarUrl"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============================================================================
// Chat Functions
// ============================================================================

export async function createChat(
  userId: number,
  mode: QueryMode = "consensus",
  speedTier: SpeedTier = "normal",
  title: string = "New Chat",
  selectedModels?: string[]
): Promise<Chat> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const insertData: InsertChat = {
    userId,
    title,
    mode,
    speedTier,
    selectedModels: selectedModels || null,
    messageCount: 0,
    totalTokens: 0,
    totalCost: "0",
  };

  const result = await db.insert(chats).values(insertData);
  const insertId = result[0].insertId;

  const [chat] = await db.select().from(chats).where(eq(chats.id, insertId));
  return chat;
}

export async function getChat(
  chatId: number,
  userId: number
): Promise<Chat | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [chat] = await db
    .select()
    .from(chats)
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId)));

  return chat || null;
}

export async function getUserChats(
  userId: number,
  limit: number = 50
): Promise<Chat[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .select()
    .from(chats)
    .where(eq(chats.userId, userId))
    .orderBy(desc(chats.updatedAt))
    .limit(limit);
}

export async function updateChat(
  chatId: number,
  updates: Partial<
    Pick<
      Chat,
      | "title"
      | "mode"
      | "speedTier"
      | "selectedModels"
      | "messageCount"
      | "totalTokens"
      | "totalCost"
    >
  >
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(chats).set(updates).where(eq(chats.id, chatId));
}

export async function deleteChat(
  chatId: number,
  userId: number
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Delete related records first
  const chatMessages = await db
    .select({ id: messages.id })
    .from(messages)
    .where(eq(messages.chatId, chatId));
  const messageIds = chatMessages.map(m => m.id);

  if (messageIds.length > 0) {
    for (const msgId of messageIds) {
      await db
        .delete(modelResponses)
        .where(eq(modelResponses.messageId, msgId));
      await db
        .delete(synthesisPipelineStages)
        .where(eq(synthesisPipelineStages.messageId, msgId));
    }
    await db.delete(messages).where(eq(messages.chatId, chatId));
  }

  await db
    .delete(chats)
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId)));
}

// ============================================================================
// Message Functions
// ============================================================================

export async function createMessage(data: InsertMessage): Promise<Message> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(messages).values(data);
  const insertId = result[0].insertId;

  // Update chat message count
  await db
    .update(chats)
    .set({ messageCount: sql`${chats.messageCount} + 1` })
    .where(eq(chats.id, data.chatId));

  const [message] = await db
    .select()
    .from(messages)
    .where(eq(messages.id, insertId));
  return message;
}

export async function getChatMessages(
  chatId: number,
  limit?: number
): Promise<Message[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let query = db
    .select()
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(messages.createdAt);

  if (limit) {
    query = query.limit(limit) as typeof query;
  }

  return query;
}

export async function updateMessage(
  messageId: number,
  updates: Partial<
    Pick<
      Message,
      | "content"
      | "summary"
      | "agreementPercentage"
      | "latencyMs"
      | "tokenCount"
      | "cost"
      | "metadata"
    >
  >
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(messages).set(updates).where(eq(messages.id, messageId));
}

// ============================================================================
// Model Response Functions
// ============================================================================

export async function createModelResponse(
  data: InsertModelResponse
): Promise<ModelResponse> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(modelResponses).values(data);
  const insertId = result[0].insertId;

  const [response] = await db
    .select()
    .from(modelResponses)
    .where(eq(modelResponses.id, insertId));
  return response;
}

export async function getMessageModelResponses(
  messageId: number
): Promise<ModelResponse[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .select()
    .from(modelResponses)
    .where(eq(modelResponses.messageId, messageId));
}

export async function updateModelResponse(
  responseId: number,
  updates: Partial<
    Pick<
      ModelResponse,
      | "content"
      | "status"
      | "errorMessage"
      | "latencyMs"
      | "inputTokens"
      | "outputTokens"
      | "cost"
    >
  >
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(modelResponses)
    .set(updates)
    .where(eq(modelResponses.id, responseId));
}

// ============================================================================
// Synthesis Pipeline Functions
// ============================================================================

export async function createPipelineStage(
  data: InsertSynthesisPipelineStage
): Promise<SynthesisPipelineStage> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(synthesisPipelineStages).values(data);
  const insertId = result[0].insertId;

  const [stage] = await db
    .select()
    .from(synthesisPipelineStages)
    .where(eq(synthesisPipelineStages.id, insertId));
  return stage;
}

export async function getMessagePipelineStages(
  messageId: number
): Promise<SynthesisPipelineStage[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .select()
    .from(synthesisPipelineStages)
    .where(eq(synthesisPipelineStages.messageId, messageId))
    .orderBy(synthesisPipelineStages.stageOrder);
}

export async function updatePipelineStage(
  stageId: number,
  updates: Partial<
    Pick<
      SynthesisPipelineStage,
      "status" | "output" | "durationMs" | "metadata"
    >
  >
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(synthesisPipelineStages)
    .set(updates)
    .where(eq(synthesisPipelineStages.id, stageId));
}

// ============================================================================
// Search Functions
// ============================================================================

export async function searchChats(
  userId: number,
  searchTerm: string
): Promise<Chat[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .select()
    .from(chats)
    .where(
      and(
        eq(chats.userId, userId),
        sql`${chats.title} LIKE ${`%${searchTerm}%`}`
      )
    )
    .orderBy(desc(chats.updatedAt))
    .limit(20);
}

// ============================================================================
// Agent Task Functions
// ============================================================================

// Agent types already imported above

export async function createAgentTask(
  data: InsertAgentTask
): Promise<AgentTask> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(agentTasks).values(data);
  const insertId = result[0].insertId;

  const [task] = await db
    .select()
    .from(agentTasks)
    .where(eq(agentTasks.id, insertId));
  return task;
}

export async function getAgentTask(
  taskId: number,
  userId: number
): Promise<AgentTask | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [task] = await db
    .select()
    .from(agentTasks)
    .where(and(eq(agentTasks.id, taskId), eq(agentTasks.userId, userId)));

  return task || null;
}

export async function getUserAgentTasks(
  userId: number,
  limit: number = 50
): Promise<AgentTask[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .select()
    .from(agentTasks)
    .where(eq(agentTasks.userId, userId))
    .orderBy(desc(agentTasks.updatedAt))
    .limit(limit);
}

export async function updateAgentTask(
  taskId: number,
  updates: Partial<
    Pick<
      AgentTask,
      | "title"
      | "status"
      | "result"
      | "errorMessage"
      | "iterationCount"
      | "totalTokens"
      | "totalCost"
      | "durationMs"
      | "completedAt"
    >
  >
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(agentTasks).set(updates).where(eq(agentTasks.id, taskId));
}

export async function deleteAgentTask(
  taskId: number,
  userId: number
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Delete related records first
  await db.delete(agentToolCalls).where(eq(agentToolCalls.taskId, taskId));
  await db.delete(agentMessages).where(eq(agentMessages.taskId, taskId));
  await db.delete(agentFiles).where(eq(agentFiles.taskId, taskId));
  await db
    .delete(agentTasks)
    .where(and(eq(agentTasks.id, taskId), eq(agentTasks.userId, userId)));
}

// ============================================================================
// Agent Message Functions
// ============================================================================

export async function createAgentMessage(
  data: InsertAgentMessage
): Promise<AgentMessage> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(agentMessages).values(data);
  const insertId = result[0].insertId;

  const [message] = await db
    .select()
    .from(agentMessages)
    .where(eq(agentMessages.id, insertId));
  return message;
}

export async function getAgentTaskMessages(
  taskId: number
): Promise<AgentMessage[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .select()
    .from(agentMessages)
    .where(eq(agentMessages.taskId, taskId))
    .orderBy(agentMessages.createdAt);
}

// ============================================================================
// Agent Tool Call Functions
// ============================================================================

export async function createAgentToolCall(
  data: InsertAgentToolCall
): Promise<AgentToolCall> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(agentToolCalls).values(data);
  const insertId = result[0].insertId;

  const [toolCall] = await db
    .select()
    .from(agentToolCalls)
    .where(eq(agentToolCalls.id, insertId));
  return toolCall;
}

export async function updateAgentToolCall(
  toolCallId: number,
  updates: Partial<
    Pick<AgentToolCall, "output" | "status" | "errorMessage" | "durationMs">
  >
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(agentToolCalls)
    .set(updates)
    .where(eq(agentToolCalls.id, toolCallId));
}

export async function getAgentTaskToolCalls(
  taskId: number
): Promise<AgentToolCall[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .select()
    .from(agentToolCalls)
    .where(eq(agentToolCalls.taskId, taskId))
    .orderBy(agentToolCalls.createdAt);
}

// ============================================================================
// Usage Tracking Functions
// ============================================================================

export async function getOrCreateUsageTracking(
  userId: number,
  date: string
): Promise<UsageTracking> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [existing] = await db
    .select()
    .from(usageTracking)
    .where(and(eq(usageTracking.userId, userId), eq(usageTracking.date, date)));

  if (existing) return existing;

  const result = await db.insert(usageTracking).values({
    userId,
    date,
    agentTaskCount: 0,
    consensusQueryCount: 0,
    synthesisQueryCount: 0,
    totalApiCalls: 0,
    totalTokens: 0,
    totalCost: "0",
  });

  const [usage] = await db
    .select()
    .from(usageTracking)
    .where(eq(usageTracking.id, result[0].insertId));
  return usage;
}

export async function incrementUsage(
  userId: number,
  date: string,
  field:
    | "agentTaskCount"
    | "consensusQueryCount"
    | "synthesisQueryCount"
    | "totalApiCalls",
  amount: number = 1
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await getOrCreateUsageTracking(userId, date);

  const fieldMap = {
    agentTaskCount: usageTracking.agentTaskCount,
    consensusQueryCount: usageTracking.consensusQueryCount,
    synthesisQueryCount: usageTracking.synthesisQueryCount,
    totalApiCalls: usageTracking.totalApiCalls,
  };

  await db
    .update(usageTracking)
    .set({ [field]: sql`${fieldMap[field]} + ${amount}` })
    .where(and(eq(usageTracking.userId, userId), eq(usageTracking.date, date)));
}

export async function addUsageTokensAndCost(
  userId: number,
  date: string,
  tokens: number,
  cost: number
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await getOrCreateUsageTracking(userId, date);

  await db
    .update(usageTracking)
    .set({
      totalTokens: sql`${usageTracking.totalTokens} + ${tokens}`,
      totalCost: sql`${usageTracking.totalCost} + ${cost}`,
    })
    .where(and(eq(usageTracking.userId, userId), eq(usageTracking.date, date)));
}

export async function getUserUsageStats(
  userId: number,
  days: number = 30
): Promise<UsageTracking[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .select()
    .from(usageTracking)
    .where(eq(usageTracking.userId, userId))
    .orderBy(desc(usageTracking.date))
    .limit(days);
}

export async function checkRateLimit(
  userId: number,
  date: string,
  limit: number = 50
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const usage = await getOrCreateUsageTracking(userId, date);
  return {
    allowed: usage.agentTaskCount < limit,
    current: usage.agentTaskCount,
    limit,
  };
}

// ============================================================================
// Agent File Functions
// ============================================================================

export async function createAgentFile(
  data: InsertAgentFile
): Promise<AgentFile> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(agentFiles).values(data);
  const insertId = result[0].insertId;

  const [file] = await db
    .select()
    .from(agentFiles)
    .where(eq(agentFiles.id, insertId));
  return file;
}

export async function getAgentTaskFiles(taskId: number): Promise<AgentFile[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .select()
    .from(agentFiles)
    .where(eq(agentFiles.taskId, taskId))
    .orderBy(agentFiles.createdAt);
}

export async function getUserAgentFiles(
  userId: number,
  limit: number = 100
): Promise<AgentFile[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .select()
    .from(agentFiles)
    .where(eq(agentFiles.userId, userId))
    .orderBy(desc(agentFiles.createdAt))
    .limit(limit);
}

// ============================================================================
// Scheduled Task Functions
// ============================================================================

export async function createScheduledTask(
  task: InsertScheduledTask
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(scheduledTasks).values(task);
  return result[0].insertId;
}

export async function getScheduledTask(
  taskId: number
): Promise<ScheduledTask | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const results = await db
    .select()
    .from(scheduledTasks)
    .where(eq(scheduledTasks.id, taskId))
    .limit(1);
  return results[0];
}

export async function getUserScheduledTasks(
  userId: number
): Promise<ScheduledTask[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .select()
    .from(scheduledTasks)
    .where(eq(scheduledTasks.userId, userId))
    .orderBy(desc(scheduledTasks.createdAt));
}

export async function updateScheduledTask(
  taskId: number,
  updates: Partial<InsertScheduledTask>
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(scheduledTasks)
    .set(updates)
    .where(eq(scheduledTasks.id, taskId));
}

export async function deleteScheduledTask(taskId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(scheduledTasks).where(eq(scheduledTasks.id, taskId));
}

export async function getEnabledScheduledTasks(): Promise<ScheduledTask[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.select().from(scheduledTasks).where(eq(scheduledTasks.enabled, 1));
}

export async function getDueScheduledTasks(
  now: Date
): Promise<ScheduledTask[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .select()
    .from(scheduledTasks)
    .where(
      and(
        eq(scheduledTasks.enabled, 1),
        sql`${scheduledTasks.nextRunAt} <= ${now}`
      )
    );
}

export async function createScheduledTaskRun(
  run: InsertScheduledTaskRun
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(scheduledTaskRuns).values(run);
  return result[0].insertId;
}

export async function updateScheduledTaskRun(
  runId: number,
  updates: Partial<InsertScheduledTaskRun>
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(scheduledTaskRuns)
    .set(updates)
    .where(eq(scheduledTaskRuns.id, runId));
}

export async function getScheduledTaskRuns(
  scheduledTaskId: number,
  limit: number = 10
): Promise<ScheduledTaskRun[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .select()
    .from(scheduledTaskRuns)
    .where(eq(scheduledTaskRuns.scheduledTaskId, scheduledTaskId))
    .orderBy(desc(scheduledTaskRuns.scheduledAt))
    .limit(limit);
}

// ============================================================================
// Workspace Functions
// ============================================================================

export async function createWorkspaceRecord(
  workspace: InsertWorkspace
): Promise<Workspace | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    await db.insert(workspaces).values(workspace);
    const [created] = await db
      .select()
      .from(workspaces)
      .where(
        and(
          eq(workspaces.userId, workspace.userId),
          eq(workspaces.basePath, workspace.basePath)
        )
      )
      .limit(1);
    return created || null;
  } catch (error) {
    console.error("[Database] Error creating workspace:", error);
    return null;
  }
}

export async function getWorkspaceById(id: number): Promise<Workspace | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, id))
      .limit(1);
    return workspace || null;
  } catch (error) {
    console.error("[Database] Error getting workspace:", error);
    return null;
  }
}

export async function getWorkspacesByUserId(
  userId: number
): Promise<Workspace[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db
      .select()
      .from(workspaces)
      .where(
        and(
          eq(workspaces.userId, userId),
          sql`${workspaces.status} != 'deleted'`
        )
      )
      .orderBy(desc(workspaces.updatedAt));
  } catch (error) {
    console.error("[Database] Error getting workspaces:", error);
    return [];
  }
}

export async function updateWorkspace(
  id: number,
  updates: Partial<InsertWorkspace>
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db
      .update(workspaces)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(workspaces.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Error updating workspace:", error);
    return false;
  }
}

export async function deleteWorkspaceRecord(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db
      .update(workspaces)
      .set({ status: "deleted", updatedAt: new Date() })
      .where(eq(workspaces.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Error deleting workspace:", error);
    return false;
  }
}

export async function updateWorkspaceAccess(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    await db
      .update(workspaces)
      .set({ lastAccessedAt: new Date() })
      .where(eq(workspaces.id, id));
  } catch (error) {
    console.error("[Database] Error updating workspace access:", error);
  }
}

// Workspace Commits
export async function createWorkspaceCommit(
  commit: InsertWorkspaceCommit
): Promise<WorkspaceCommit | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    await db.insert(workspaceCommits).values(commit);
    const [created] = await db
      .select()
      .from(workspaceCommits)
      .where(eq(workspaceCommits.commitHash, commit.commitHash))
      .limit(1);
    return created || null;
  } catch (error) {
    console.error("[Database] Error creating workspace commit:", error);
    return null;
  }
}

export async function getWorkspaceCommits(
  workspaceId: number,
  limit: number = 50
): Promise<WorkspaceCommit[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db
      .select()
      .from(workspaceCommits)
      .where(eq(workspaceCommits.workspaceId, workspaceId))
      .orderBy(desc(workspaceCommits.createdAt))
      .limit(limit);
  } catch (error) {
    console.error("[Database] Error getting workspace commits:", error);
    return [];
  }
}

export async function getWorkspaceCheckpoints(
  workspaceId: number
): Promise<WorkspaceCommit[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db
      .select()
      .from(workspaceCommits)
      .where(
        and(
          eq(workspaceCommits.workspaceId, workspaceId),
          eq(workspaceCommits.isCheckpoint, 1)
        )
      )
      .orderBy(desc(workspaceCommits.createdAt));
  } catch (error) {
    console.error("[Database] Error getting workspace checkpoints:", error);
    return [];
  }
}

// Workspace Files (metadata tracking)
export async function syncWorkspaceFiles(
  workspaceId: number,
  files: InsertWorkspaceFile[]
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    // Delete existing file records for this workspace
    await db
      .delete(workspaceFiles)
      .where(eq(workspaceFiles.workspaceId, workspaceId));

    // Insert new file records
    if (files.length > 0) {
      await db.insert(workspaceFiles).values(files);
    }
  } catch (error) {
    console.error("[Database] Error syncing workspace files:", error);
  }
}

export async function getWorkspaceFiles(
  workspaceId: number
): Promise<WorkspaceFile[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db
      .select()
      .from(workspaceFiles)
      .where(eq(workspaceFiles.workspaceId, workspaceId))
      .orderBy(workspaceFiles.filePath);
  } catch (error) {
    console.error("[Database] Error getting workspace files:", error);
    return [];
  }
}

// Workspace Processes
export async function createWorkspaceProcess(
  process: InsertWorkspaceProcess
): Promise<WorkspaceProcess | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    await db.insert(workspaceProcesses).values(process);
    const [created] = await db
      .select()
      .from(workspaceProcesses)
      .where(
        and(
          eq(workspaceProcesses.workspaceId, process.workspaceId),
          eq(workspaceProcesses.command, process.command)
        )
      )
      .orderBy(desc(workspaceProcesses.startedAt))
      .limit(1);
    return created || null;
  } catch (error) {
    console.error("[Database] Error creating workspace process:", error);
    return null;
  }
}

export async function updateWorkspaceProcess(
  id: number,
  updates: Partial<InsertWorkspaceProcess>
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db
      .update(workspaceProcesses)
      .set(updates)
      .where(eq(workspaceProcesses.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Error updating workspace process:", error);
    return false;
  }
}

export async function getRunningProcesses(
  workspaceId: number
): Promise<WorkspaceProcess[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db
      .select()
      .from(workspaceProcesses)
      .where(
        and(
          eq(workspaceProcesses.workspaceId, workspaceId),
          eq(workspaceProcesses.status, "running")
        )
      );
  } catch (error) {
    console.error("[Database] Error getting running processes:", error);
    return [];
  }
}

// Workspace Templates
export async function getWorkspaceTemplates(): Promise<WorkspaceTemplate[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db
      .select()
      .from(workspaceTemplates)
      .orderBy(workspaceTemplates.sortOrder);
  } catch (error) {
    console.error("[Database] Error getting workspace templates:", error);
    return [];
  }
}

export async function seedWorkspaceTemplates(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const templates: InsertWorkspaceTemplate[] = [
    {
      templateId: "blank",
      name: "Blank Project",
      description: "Empty workspace with no files",
      category: "general",
      icon: "folder",
      isSystem: 1,
      sortOrder: 0,
    },
    {
      templateId: "node-basic",
      name: "Node.js Basic",
      description: "Simple Node.js project with package.json",
      category: "backend",
      icon: "server",
      isSystem: 1,
      sortOrder: 1,
    },
    {
      templateId: "react-vite",
      name: "React + Vite",
      description: "Modern React app with Vite bundler",
      category: "frontend",
      icon: "layout",
      isSystem: 1,
      sortOrder: 2,
    },
    {
      templateId: "python-basic",
      name: "Python Basic",
      description: "Simple Python project with virtual environment",
      category: "backend",
      icon: "terminal",
      isSystem: 1,
      sortOrder: 3,
    },
    {
      templateId: "express-api",
      name: "Express.js API",
      description: "REST API with Express.js",
      category: "backend",
      icon: "server",
      isSystem: 1,
      sortOrder: 4,
    },
    {
      templateId: "nextjs",
      name: "Next.js App",
      description: "Full-stack React framework with Next.js",
      category: "fullstack",
      icon: "layers",
      isSystem: 1,
      sortOrder: 5,
    },
  ];

  try {
    for (const template of templates) {
      await db
        .insert(workspaceTemplates)
        .values(template)
        .onDuplicateKeyUpdate({ set: { name: template.name } });
    }
  } catch (error) {
    console.error("[Database] Error seeding workspace templates:", error);
  }
}

// ============================================================================
// Chat Cleanup Functions
// ============================================================================

/**
 * Delete empty chats (0 messages) older than specified hours
 * Excludes the most recently created chat per user to avoid deleting active sessions
 */
export async function cleanupEmptyChats(
  olderThanHours: number = 24
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);

  // Find empty chats older than cutoff time
  const emptyChats = await db
    .select({ id: chats.id, userId: chats.userId })
    .from(chats)
    .where(
      and(eq(chats.messageCount, 0), sql`${chats.createdAt} < ${cutoffTime}`)
    );

  if (emptyChats.length === 0) {
    return 0;
  }

  // Get the most recent chat per user to exclude from deletion
  const recentChatsPerUser = await db
    .select({
      userId: chats.userId,
      maxId: sql<number>`MAX(${chats.id})`.as("maxId"),
    })
    .from(chats)
    .groupBy(chats.userId);

  const recentChatIds = new Set(recentChatsPerUser.map(r => r.maxId));

  // Filter out the most recent chat per user
  const chatsToDelete = emptyChats.filter(c => !recentChatIds.has(c.id));

  if (chatsToDelete.length === 0) {
    return 0;
  }

  // Delete the empty chats
  let deletedCount = 0;
  for (const chat of chatsToDelete) {
    await db.delete(chats).where(eq(chats.id, chat.id));
    deletedCount++;
  }

  console.log(
    `[Cleanup] Deleted ${deletedCount} empty chats older than ${olderThanHours} hours`
  );
  return deletedCount;
}

/**
 * Get count of empty chats for a user
 */
export async function getEmptyChatCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select({ count: sql<number>`COUNT(*)`.as("count") })
    .from(chats)
    .where(and(eq(chats.userId, userId), eq(chats.messageCount, 0)));

  return result[0]?.count || 0;
}
