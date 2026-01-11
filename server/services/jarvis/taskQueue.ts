import { getDb } from "../../db";
import {
  asyncTaskQueue,
  asyncTaskLogs,
  type AsyncTaskQueue,
  type InsertAsyncTaskQueue,
} from "../../../drizzle/schema";
import { eq, and, or, lte, isNull, asc, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export type TaskStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "paused";

export type TaskType =
  | "jarvis_task"
  | "agent_team"
  | "deep_research"
  | "code_generation"
  | "document_generation"
  | "scheduled_task"
  | "webhook_task"
  | "custom";

export interface SubmitTaskOptions {
  userId: number;
  taskType: TaskType;
  prompt: string;
  input?: Record<string, unknown>;
  priority?: number;
  webhookUrl?: string;
  scheduledFor?: Date;
  expiresAt?: Date;
  maxRetries?: number;
  estimatedDurationMs?: number;
  metadata?: Record<string, unknown>;
}

export interface TaskResult {
  taskId: number;
  status: TaskStatus;
  progress: number;
  progressMessage?: string;
  result?: string;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  actualDurationMs?: number;
  tokensUsed?: number;
  cost?: string;
}

class TaskQueueService {
  private workerId: string;
  private isWorkerRunning = false;
  private workerInterval: ReturnType<typeof setInterval> | null = null;
  private processingTasks = new Set<number>();

  constructor() {
    this.workerId = `worker-${uuidv4().slice(0, 8)}`;
  }

  async submitTask(options: SubmitTaskOptions): Promise<number> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const taskData: InsertAsyncTaskQueue = {
      userId: options.userId,
      taskType: options.taskType,
      prompt: options.prompt,
      input: options.input,
      priority: options.priority ?? 5,
      webhookUrl: options.webhookUrl,
      scheduledFor: options.scheduledFor,
      expiresAt: options.expiresAt,
      maxRetries: options.maxRetries ?? 3,
      estimatedDurationMs: options.estimatedDurationMs,
      metadata: options.metadata,
      status: options.scheduledFor ? "queued" : "queued",
    };

    const [result] = await db.insert(asyncTaskQueue).values(taskData);

    await this.logTask(result.insertId, "info", "Task submitted to queue", {
      taskType: options.taskType,
      priority: options.priority,
    });

    return result.insertId;
  }

  async getTaskStatus(taskId: number): Promise<TaskResult | null> {
    const db = await getDb();
    if (!db) return null;

    const [task] = await db
      .select()
      .from(asyncTaskQueue)
      .where(eq(asyncTaskQueue.id, taskId))
      .limit(1);

    if (!task) return null;

    return {
      taskId: task.id,
      status: task.status as TaskStatus,
      progress: task.progress,
      progressMessage: task.progressMessage ?? undefined,
      result: task.result ?? undefined,
      error: task.error ?? undefined,
      startedAt: task.startedAt ?? undefined,
      completedAt: task.completedAt ?? undefined,
      actualDurationMs: task.actualDurationMs ?? undefined,
      tokensUsed: task.tokensUsed ?? undefined,
      cost: task.cost ?? undefined,
    };
  }

  async getUserTasks(
    userId: number,
    options?: { status?: TaskStatus; limit?: number }
  ): Promise<AsyncTaskQueue[]> {
    const db = await getDb();
    if (!db) return [];

    let query = db
      .select()
      .from(asyncTaskQueue)
      .where(eq(asyncTaskQueue.userId, userId))
      .orderBy(desc(asyncTaskQueue.createdAt));

    if (options?.status) {
      query = db
        .select()
        .from(asyncTaskQueue)
        .where(
          and(
            eq(asyncTaskQueue.userId, userId),
            eq(asyncTaskQueue.status, options.status)
          )
        )
        .orderBy(desc(asyncTaskQueue.createdAt));
    }

    if (options?.limit) {
      return query.limit(options.limit);
    }

    return query;
  }

  async cancelTask(taskId: number, userId: number): Promise<boolean> {
    const db = await getDb();
    if (!db) return false;

    const [task] = await db
      .select()
      .from(asyncTaskQueue)
      .where(
        and(eq(asyncTaskQueue.id, taskId), eq(asyncTaskQueue.userId, userId))
      )
      .limit(1);

    if (!task) return false;
    if (task.status === "completed" || task.status === "cancelled") {
      return false;
    }

    await db
      .update(asyncTaskQueue)
      .set({
        status: "cancelled",
        completedAt: new Date(),
      })
      .where(eq(asyncTaskQueue.id, taskId));

    await this.logTask(taskId, "info", "Task cancelled by user");

    return true;
  }

  async updateTaskProgress(
    taskId: number,
    progress: number,
    message?: string
  ): Promise<void> {
    const db = await getDb();
    if (!db) return;

    await db
      .update(asyncTaskQueue)
      .set({
        progress: Math.min(100, Math.max(0, progress)),
        progressMessage: message,
      })
      .where(eq(asyncTaskQueue.id, taskId));
  }

  async completeTask(
    taskId: number,
    result: string,
    metrics?: { tokensUsed?: number; cost?: string }
  ): Promise<void> {
    const db = await getDb();
    if (!db) return;

    const [task] = await db
      .select()
      .from(asyncTaskQueue)
      .where(eq(asyncTaskQueue.id, taskId))
      .limit(1);

    const startedAt = task?.startedAt;
    const actualDurationMs = startedAt
      ? Date.now() - new Date(startedAt).getTime()
      : null;

    await db
      .update(asyncTaskQueue)
      .set({
        status: "completed",
        result,
        progress: 100,
        completedAt: new Date(),
        actualDurationMs,
        tokensUsed: metrics?.tokensUsed ?? 0,
        cost: metrics?.cost ?? "0",
      })
      .where(eq(asyncTaskQueue.id, taskId));

    this.processingTasks.delete(taskId);

    await this.logTask(taskId, "info", "Task completed", {
      durationMs: actualDurationMs,
      tokensUsed: metrics?.tokensUsed,
    });

    if (task?.webhookUrl) {
      await this.deliverWebhook(taskId, task.webhookUrl, "completed", result);
    }
  }

  async failTask(taskId: number, error: string): Promise<void> {
    const db = await getDb();
    if (!db) return;

    const [task] = await db
      .select()
      .from(asyncTaskQueue)
      .where(eq(asyncTaskQueue.id, taskId))
      .limit(1);

    if (!task) return;

    const shouldRetry = task.retryCount < task.maxRetries;

    if (shouldRetry) {
      await db
        .update(asyncTaskQueue)
        .set({
          status: "queued",
          retryCount: task.retryCount + 1,
          error,
          workerId: null,
        })
        .where(eq(asyncTaskQueue.id, taskId));

      await this.logTask(
        taskId,
        "warn",
        `Task failed, retrying (${task.retryCount + 1}/${task.maxRetries})`,
        { error }
      );
    } else {
      await db
        .update(asyncTaskQueue)
        .set({
          status: "failed",
          error,
          completedAt: new Date(),
        })
        .where(eq(asyncTaskQueue.id, taskId));

      await this.logTask(taskId, "error", "Task failed permanently", { error });

      if (task.webhookUrl) {
        await this.deliverWebhook(taskId, task.webhookUrl, "failed", error);
      }
    }

    this.processingTasks.delete(taskId);
  }

  async claimTask(): Promise<AsyncTaskQueue | null> {
    const db = await getDb();
    if (!db) return null;

    const now = new Date();

    const candidates = await db
      .select()
      .from(asyncTaskQueue)
      .where(
        and(
          eq(asyncTaskQueue.status, "queued"),
          or(
            isNull(asyncTaskQueue.scheduledFor),
            lte(asyncTaskQueue.scheduledFor, now)
          ),
          or(
            isNull(asyncTaskQueue.expiresAt),
            lte(asyncTaskQueue.expiresAt, now)
          )
        )
      )
      .orderBy(asc(asyncTaskQueue.priority), asc(asyncTaskQueue.createdAt))
      .limit(10);

    for (const task of candidates) {
      if (this.processingTasks.has(task.id)) continue;

      const updateResult = await db
        .update(asyncTaskQueue)
        .set({
          status: "running",
          workerId: this.workerId,
          startedAt: now,
        })
        .where(
          and(
            eq(asyncTaskQueue.id, task.id),
            eq(asyncTaskQueue.status, "queued")
          )
        );

      if (updateResult[0].affectedRows > 0) {
        this.processingTasks.add(task.id);
        await this.logTask(task.id, "info", `Task claimed by ${this.workerId}`);
        return task;
      }
    }

    return null;
  }

  async recoverStaleTasks(): Promise<number> {
    const db = await getDb();
    if (!db) return 0;

    const staleThreshold = new Date(Date.now() - 5 * 60 * 1000);

    const result = await db
      .update(asyncTaskQueue)
      .set({
        status: "queued",
        workerId: null,
      })
      .where(
        and(
          eq(asyncTaskQueue.status, "running"),
          lte(asyncTaskQueue.startedAt, staleThreshold)
        )
      );

    return result[0].affectedRows;
  }

  async getQueueStats(): Promise<{
    queued: number;
    running: number;
    completed: number;
    failed: number;
  }> {
    const db = await getDb();
    if (!db) return { queued: 0, running: 0, completed: 0, failed: 0 };

    const tasks = await db.select().from(asyncTaskQueue);

    return {
      queued: tasks.filter(t => t.status === "queued").length,
      running: tasks.filter(t => t.status === "running").length,
      completed: tasks.filter(t => t.status === "completed").length,
      failed: tasks.filter(t => t.status === "failed").length,
    };
  }

  private async logTask(
    taskId: number,
    level: "debug" | "info" | "warn" | "error",
    message: string,
    data?: Record<string, unknown>
  ): Promise<void> {
    const db = await getDb();
    if (!db) return;

    try {
      await db.insert(asyncTaskLogs).values({
        taskId,
        level,
        message,
        data,
      });
    } catch {
      console.error(`Failed to log task ${taskId}: ${message}`);
    }
  }

  async getTaskLogs(
    taskId: number,
    limit = 100
  ): Promise<Array<{ level: string; message: string; createdAt: Date }>> {
    const db = await getDb();
    if (!db) return [];

    return db
      .select()
      .from(asyncTaskLogs)
      .where(eq(asyncTaskLogs.taskId, taskId))
      .orderBy(desc(asyncTaskLogs.createdAt))
      .limit(limit);
  }

  private async deliverWebhook(
    taskId: number,
    webhookUrl: string,
    status: "completed" | "failed",
    resultOrError: string
  ): Promise<void> {
    const db = await getDb();

    try {
      const payload = {
        taskId,
        status,
        timestamp: new Date().toISOString(),
        ...(status === "completed"
          ? { result: resultOrError }
          : { error: resultOrError }),
      };

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-JARVIS-Task-ID": String(taskId),
          "X-JARVIS-Status": status,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000),
      });

      if (db) {
        await db
          .update(asyncTaskQueue)
          .set({
            webhookDelivered: response.ok,
            webhookDeliveredAt: new Date(),
          })
          .where(eq(asyncTaskQueue.id, taskId));
      }

      await this.logTask(
        taskId,
        response.ok ? "info" : "warn",
        `Webhook ${response.ok ? "delivered" : "failed"}: ${response.status}`
      );
    } catch (error) {
      await this.logTask(taskId, "error", `Webhook delivery failed: ${error}`);
    }
  }

  startWorker(intervalMs = 2000): void {
    if (this.isWorkerRunning) return;

    this.isWorkerRunning = true;
    console.info(`[TaskQueue] Worker ${this.workerId} started`);

    this.recoverStaleTasks().then(recovered => {
      if (recovered > 0) {
        console.info(`[TaskQueue] Recovered ${recovered} stale tasks`);
      }
    });

    this.workerInterval = setInterval(async () => {
      if (!this.isWorkerRunning) return;

      try {
        const task = await this.claimTask();
        if (task) {
          console.info(
            `[TaskQueue] Processing task ${task.id}: ${task.taskType}`
          );
          await this.processTask(task);
        }
      } catch (error) {
        console.error("[TaskQueue] Worker error:", error);
      }
    }, intervalMs);
  }

  stopWorker(): void {
    this.isWorkerRunning = false;
    if (this.workerInterval) {
      clearInterval(this.workerInterval);
      this.workerInterval = null;
    }
    console.info(`[TaskQueue] Worker ${this.workerId} stopped`);
  }

  private async processTask(task: AsyncTaskQueue): Promise<void> {
    try {
      await this.updateTaskProgress(task.id, 10, "Initializing task...");

      const { runOrchestrator } = await import("./orchestrator");
      const { executeTool } = await import("./tools");

      await this.updateTaskProgress(task.id, 20, "Running JARVIS...");

      let finalResult = "";
      let totalTokens = 0;
      let iterationCount = 0;

      await runOrchestrator(
        task.prompt,
        {
          onThinking: (thought: string) => {
            this.updateTaskProgress(
              task.id,
              20 + Math.min(iterationCount * 5, 60),
              `Thinking: ${thought.slice(0, 100)}...`
            );
          },
          onToolCall: () => {
            iterationCount++;
            this.updateTaskProgress(
              task.id,
              20 + Math.min(iterationCount * 5, 70),
              `Executing tool ${iterationCount}...`
            );
          },
          onToolResult: () => {},
          onComplete: (summary: string) => {
            finalResult = summary;
            this.updateTaskProgress(task.id, 95, "Completing task...");
          },
          onError: (error: string) => {
            throw new Error(error);
          },
        },
        async (name: string, input: Record<string, unknown>) => {
          return executeTool(name, { ...input, userId: task.userId });
        },
        {
          maxIterations: 20,
          memoryContext: "",
          procedureGuidance: "",
          conversationHistory: [],
        }
      );

      await this.completeTask(task.id, finalResult, {
        tokensUsed: totalTokens,
        cost: "0",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      await this.failTask(task.id, errorMessage);
    }
  }
}

export const taskQueue = new TaskQueueService();
