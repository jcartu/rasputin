/**
 * Cron Scheduler
 * Manages scheduled tasks and cron-based triggers
 */

import { getDb } from "../../db";
import { eventTriggers, eventActions, eventLog } from "../../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { eventExecutor } from "./eventExecutor";

// Simple cron parser
interface CronParts {
  minute: number[];
  hour: number[];
  dayOfMonth: number[];
  month: number[];
  dayOfWeek: number[];
}

// Track last run times in memory
const lastRunTimes = new Map<number, Date>();

export class CronScheduler {
  private isRunning = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL_MS = 60000; // Check every minute

  /**
   * Start the cron scheduler
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    console.log("[CronScheduler] Starting scheduler...");

    // Run immediately, then on interval
    this.checkAndExecute();
    this.checkInterval = setInterval(() => {
      this.checkAndExecute();
    }, this.CHECK_INTERVAL_MS);
  }

  /**
   * Stop the cron scheduler
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    console.log("[CronScheduler] Scheduler stopped");
  }

  /**
   * Check for due jobs and execute them
   */
  private async checkAndExecute(): Promise<void> {
    const db = await getDb();
    if (!db) return;

    const now = new Date();

    // Get all active schedule triggers
    const triggers = await db
      .select()
      .from(eventTriggers)
      .where(
        and(
          eq(eventTriggers.triggerType, "schedule"),
          eq(eventTriggers.isEnabled, 1)
        )
      );

    for (const trigger of triggers) {
      if (!trigger.cronExpression) continue;

      const lastRun = lastRunTimes.get(trigger.id);

      // Check if this trigger should run now
      const shouldRun = this.shouldRunNow(
        trigger.cronExpression,
        lastRun,
        "UTC"
      );

      if (shouldRun) {
        await this.executeTrigger(trigger, now);
        lastRunTimes.set(trigger.id, now);
      }
    }
  }

  /**
   * Check if a cron expression should run now
   */
  private shouldRunNow(
    cronExpression: string,
    lastRun: Date | undefined,
    timezone: string
  ): boolean {
    const now = new Date();

    // If we ran in the last minute, skip
    if (lastRun) {
      const timeSinceLastRun = now.getTime() - lastRun.getTime();
      if (timeSinceLastRun < 60000) return false;
    }

    // Parse cron expression
    const parts = this.parseCronExpression(cronExpression);
    if (!parts) return false;

    // Get current time in the specified timezone
    const currentTime = this.getTimeInTimezone(now, timezone);

    // Check if current time matches cron expression
    return (
      parts.minute.includes(currentTime.minute) &&
      parts.hour.includes(currentTime.hour) &&
      parts.dayOfMonth.includes(currentTime.dayOfMonth) &&
      parts.month.includes(currentTime.month) &&
      parts.dayOfWeek.includes(currentTime.dayOfWeek)
    );
  }

  /**
   * Parse a cron expression into its parts
   */
  private parseCronExpression(expression: string): CronParts | null {
    const parts = expression.trim().split(/\s+/);

    // Standard 5-part cron: minute hour dayOfMonth month dayOfWeek
    if (parts.length !== 5) return null;

    try {
      return {
        minute: this.parseField(parts[0], 0, 59),
        hour: this.parseField(parts[1], 0, 23),
        dayOfMonth: this.parseField(parts[2], 1, 31),
        month: this.parseField(parts[3], 1, 12),
        dayOfWeek: this.parseField(parts[4], 0, 6),
      };
    } catch {
      return null;
    }
  }

  /**
   * Parse a single cron field
   */
  private parseField(field: string, min: number, max: number): number[] {
    const values: number[] = [];

    // Handle wildcard
    if (field === "*") {
      for (let i = min; i <= max; i++) values.push(i);
      return values;
    }

    // Handle comma-separated values
    const parts = field.split(",");

    for (const part of parts) {
      // Handle range with step (e.g., 1-10/2)
      if (part.includes("/")) {
        const [range, stepStr] = part.split("/");
        const step = parseInt(stepStr, 10);

        let start = min;
        let end = max;

        if (range !== "*") {
          if (range.includes("-")) {
            const [s, e] = range.split("-").map(n => parseInt(n, 10));
            start = s;
            end = e;
          } else {
            start = parseInt(range, 10);
          }
        }

        for (let i = start; i <= end; i += step) {
          values.push(i);
        }
      }
      // Handle range (e.g., 1-5)
      else if (part.includes("-")) {
        const [start, end] = part.split("-").map(n => parseInt(n, 10));
        for (let i = start; i <= end; i++) {
          values.push(i);
        }
      }
      // Handle single value
      else {
        values.push(parseInt(part, 10));
      }
    }

    return values.filter(v => v >= min && v <= max);
  }

  /**
   * Get time components in a specific timezone
   */
  private getTimeInTimezone(
    date: Date,
    timezone: string
  ): {
    minute: number;
    hour: number;
    dayOfMonth: number;
    month: number;
    dayOfWeek: number;
  } {
    try {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        hour12: false,
      });

      const parts = formatter.formatToParts(date);
      const values: Record<string, number> = {};

      for (const part of parts) {
        if (part.type !== "literal") {
          values[part.type] = parseInt(part.value, 10);
        }
      }

      // Get day of week separately
      const dayFormatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        weekday: "short",
      });
      const dayOfWeekStr = dayFormatter.format(date);
      const dayOfWeekMap: Record<string, number> = {
        Sun: 0,
        Mon: 1,
        Tue: 2,
        Wed: 3,
        Thu: 4,
        Fri: 5,
        Sat: 6,
      };

      return {
        minute: values.minute || 0,
        hour: values.hour || 0,
        dayOfMonth: values.day || 1,
        month: values.month || 1,
        dayOfWeek: dayOfWeekMap[dayOfWeekStr] || 0,
      };
    } catch {
      // Fallback to UTC
      return {
        minute: date.getUTCMinutes(),
        hour: date.getUTCHours(),
        dayOfMonth: date.getUTCDate(),
        month: date.getUTCMonth() + 1,
        dayOfWeek: date.getUTCDay(),
      };
    }
  }

  /**
   * Execute a cron trigger
   */
  private async executeTrigger(
    trigger: typeof eventTriggers.$inferSelect,
    now: Date
  ): Promise<void> {
    const db = await getDb();
    if (!db) return;

    console.log(`[CronScheduler] Executing trigger: ${trigger.name}`);

    // Create event log entry
    const [logEntry] = await db
      .insert(eventLog)
      .values({
        triggerId: trigger.id,
        eventType: "trigger_fired",
        payload: {
          cronExpression: trigger.cronExpression,
          scheduledAt: now.toISOString(),
        },
        success: 0,
      })
      .$returningId();

    // Get and execute the associated actions
    const actions = await db
      .select()
      .from(eventActions)
      .where(eq(eventActions.triggerId, trigger.id));

    for (const action of actions) {
      if (!action.isEnabled) continue;

      try {
        await eventExecutor.executeActionFromRow(
          action,
          {
            trigger: trigger.name,
            cronExpression: trigger.cronExpression,
            scheduledAt: now.toISOString(),
          },
          logEntry.id
        );
      } catch (error) {
        console.error(`[CronScheduler] Failed to execute action:`, error);

        await db
          .update(eventLog)
          .set({
            success: 0,
            errorMessage:
              error instanceof Error ? error.message : "Unknown error",
          })
          .where(eq(eventLog.id, logEntry.id));
      }
    }

    // Update event log status
    await db
      .update(eventLog)
      .set({ success: 1 })
      .where(eq(eventLog.id, logEntry.id));
  }

  /**
   * Calculate next run time for a cron expression
   */
  getNextRunTime(
    cronExpression: string,
    timezone: string = "UTC"
  ): Date | null {
    const parts = this.parseCronExpression(cronExpression);
    if (!parts) return null;

    const now = new Date();
    const maxIterations = 366 * 24 * 60; // Max 1 year of minutes

    for (let i = 0; i < maxIterations; i++) {
      const candidate = new Date(now.getTime() + i * 60000);
      const time = this.getTimeInTimezone(candidate, timezone);

      if (
        parts.minute.includes(time.minute) &&
        parts.hour.includes(time.hour) &&
        parts.dayOfMonth.includes(time.dayOfMonth) &&
        parts.month.includes(time.month) &&
        parts.dayOfWeek.includes(time.dayOfWeek)
      ) {
        // Skip if it's the current minute
        if (i === 0) continue;
        return candidate;
      }
    }

    return null;
  }

  /**
   * Create a cron trigger
   */
  async createCronTrigger(
    userId: number,
    name: string,
    cronExpression: string,
    options: {
      description?: string;
    } = {}
  ): Promise<typeof eventTriggers.$inferSelect> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Validate cron expression
    const parts = this.parseCronExpression(cronExpression);
    if (!parts) {
      throw new Error("Invalid cron expression");
    }

    const [inserted] = await db
      .insert(eventTriggers)
      .values({
        userId,
        name,
        description: options.description,
        triggerType: "schedule",
        cronExpression,
        isEnabled: 1,
      })
      .$returningId();

    const [result] = await db
      .select()
      .from(eventTriggers)
      .where(eq(eventTriggers.id, inserted.id))
      .limit(1);

    return result;
  }

  /**
   * Get user's cron triggers
   */
  async getUserCronTriggers(
    userId: number
  ): Promise<Array<typeof eventTriggers.$inferSelect>> {
    const db = await getDb();
    if (!db) return [];

    return db
      .select()
      .from(eventTriggers)
      .where(
        and(
          eq(eventTriggers.userId, userId),
          eq(eventTriggers.triggerType, "schedule")
        )
      );
  }
}

// Singleton instance
export const cronScheduler = new CronScheduler();
