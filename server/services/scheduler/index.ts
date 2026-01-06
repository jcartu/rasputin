/**
 * Task Scheduler Service
 * Manages scheduled JARVIS tasks with cron-like scheduling
 */

import * as db from "../../db";
import {
  runOrchestrator,
  type ToolCall,
  type ToolResult,
} from "../jarvis/orchestrator";
import { executeTool } from "../jarvis/tools";
import type { ScheduledTask } from "../../../drizzle/schema";

// Calculate next run time based on schedule type
export function calculateNextRun(task: ScheduledTask): Date | null {
  const now = new Date();

  switch (task.scheduleType) {
    case "once":
      // One-time tasks don't have a next run after execution
      return null;

    case "daily": {
      const [hours, minutes] = (task.timeOfDay || "09:00")
        .split(":")
        .map(Number);
      const next = new Date(now);
      next.setHours(hours, minutes, 0, 0);
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      return next;
    }

    case "weekly": {
      const [hours, minutes] = (task.timeOfDay || "09:00")
        .split(":")
        .map(Number);
      const targetDay = task.dayOfWeek ?? 1; // Default to Monday
      const next = new Date(now);
      next.setHours(hours, minutes, 0, 0);

      const daysUntilTarget = (targetDay - now.getDay() + 7) % 7;
      if (daysUntilTarget === 0 && next <= now) {
        next.setDate(next.getDate() + 7);
      } else {
        next.setDate(next.getDate() + daysUntilTarget);
      }
      return next;
    }

    case "monthly": {
      const [hours, minutes] = (task.timeOfDay || "09:00")
        .split(":")
        .map(Number);
      const targetDay = task.dayOfMonth ?? 1;
      const next = new Date(now);
      next.setHours(hours, minutes, 0, 0);
      next.setDate(targetDay);

      if (next <= now) {
        next.setMonth(next.getMonth() + 1);
      }
      return next;
    }

    case "cron": {
      // Simple cron parsing for common patterns
      // Full cron implementation would require a library like node-cron
      if (!task.cronExpression) return null;

      // For now, just schedule for next hour as placeholder
      const next = new Date(now);
      next.setHours(next.getHours() + 1, 0, 0, 0);
      return next;
    }

    default:
      return null;
  }
}

// Execute a scheduled task
export async function executeScheduledTask(
  task: ScheduledTask,
  userId: number
): Promise<{ success: boolean; result?: string; error?: string }> {
  const startTime = Date.now();

  // Create a run record
  const runId = await db.createScheduledTaskRun({
    scheduledTaskId: task.id,
    status: "running",
    scheduledAt: task.nextRunAt || new Date(),
    startedAt: new Date(),
  });

  try {
    // Create an agent task for this scheduled execution
    const agentTask = await db.createAgentTask({
      userId,
      title: `[Scheduled] ${task.name}`,
      query: task.prompt,
      status: "running",
    });
    const agentTaskId = agentTask.id;

    // Update run with agent task ID
    await db.updateScheduledTaskRun(runId, { agentTaskId });

    // Collect results
    let finalResult = "";
    let hasError = false;
    let iterationCount = 0;
    const toolResults: Array<{ name: string; output: string }> = [];

    // Run the orchestrator with callbacks
    await runOrchestrator(
      task.prompt,
      {
        onThinking: (thought: string) => {
          // Log thinking for debugging
          console.log(
            `[Scheduler] Task ${task.id} thinking:`,
            thought.substring(0, 100)
          );
        },
        onToolCall: (toolCall: ToolCall) => {
          console.log(`[Scheduler] Task ${task.id} using tool:`, toolCall.name);
          iterationCount++;
        },
        onToolResult: (result: ToolResult) => {
          console.log(
            `[Scheduler] Task ${task.id} tool result:`,
            result.output.substring(0, 100)
          );
        },
        onComplete: (summary: string) => {
          finalResult = summary;
          console.log(
            `[Scheduler] Task ${task.id} completed:`,
            summary.substring(0, 100)
          );
        },
        onError: (error: string) => {
          hasError = true;
          finalResult = error;
          console.error(`[Scheduler] Task ${task.id} error:`, error);
        },
      },
      async (name: string, input: Record<string, unknown>) => {
        const result = await executeTool(name, input);
        toolResults.push({ name, output: result });
        return result;
      },
      10 // Max iterations for scheduled tasks
    );

    const durationMs = Date.now() - startTime;

    // Update agent task
    await db.updateAgentTask(agentTaskId, {
      status: hasError ? "failed" : "completed",
      result: finalResult,
      iterationCount,
      durationMs,
      completedAt: new Date(),
    });

    // Update run record
    await db.updateScheduledTaskRun(runId, {
      status: hasError ? "failed" : "success",
      result: finalResult,
      durationMs,
      completedAt: new Date(),
    });

    // Update scheduled task
    const nextRun = calculateNextRun(task);
    await db.updateScheduledTask(task.id, {
      lastRunAt: new Date(),
      lastRunStatus: hasError ? "failed" : "success",
      lastRunResult: finalResult.substring(0, 1000),
      nextRunAt: nextRun,
      runCount: (task.runCount || 0) + 1,
    });

    return { success: !hasError, result: finalResult };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const durationMs = Date.now() - startTime;

    await db.updateScheduledTaskRun(runId, {
      status: "failed",
      errorMessage,
      durationMs,
      completedAt: new Date(),
    });

    await db.updateScheduledTask(task.id, {
      lastRunAt: new Date(),
      lastRunStatus: "failed",
      lastRunResult: errorMessage.substring(0, 1000),
      nextRunAt: calculateNextRun(task),
      runCount: (task.runCount || 0) + 1,
    });

    return { success: false, error: errorMessage };
  }
}

// Check and execute due tasks (called periodically)
export async function checkAndExecuteDueTasks(): Promise<void> {
  try {
    const dueTasks = await db.getDueScheduledTasks(new Date());

    for (const task of dueTasks) {
      console.log(
        `[Scheduler] Executing due task: ${task.name} (ID: ${task.id})`
      );
      await executeScheduledTask(task, task.userId);
    }
  } catch (error) {
    console.error("[Scheduler] Error checking due tasks:", error);
  }
}

// Start the scheduler (runs every minute)
let schedulerInterval: NodeJS.Timeout | null = null;

export function startScheduler(): void {
  if (schedulerInterval) {
    console.log("[Scheduler] Already running");
    return;
  }

  console.log("[Scheduler] Starting task scheduler...");

  // Check every minute
  schedulerInterval = setInterval(checkAndExecuteDueTasks, 60 * 1000);

  // Also check immediately on start
  checkAndExecuteDueTasks();
}

export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[Scheduler] Stopped");
  }
}
