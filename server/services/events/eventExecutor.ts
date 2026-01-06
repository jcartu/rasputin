/**
 * Event Executor
 * Executes actions triggered by events
 */

import { getDb } from "../../db";
import { eventActions, eventLog } from "../../../drizzle/schema";
import { eq } from "drizzle-orm";
import { notifyOwner } from "../../_core/notification";

type ActionType =
  | "jarvis_task"
  | "notification"
  | "webhook"
  | "command"
  | "chain_event";

interface ActionConfig {
  // For jarvis_task
  prompt?: string;
  // For notification
  title?: string;
  message?: string;
  // For webhook
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  // For command
  command?: string;
  hostId?: number;
  // For chain_event
  triggerId?: number;
}

export class EventExecutor {
  /**
   * Execute an action from a database row
   */
  async executeActionFromRow(
    action: typeof eventActions.$inferSelect,
    payload: Record<string, unknown>,
    eventId: number
  ): Promise<{
    success: boolean;
    result?: unknown;
    error?: string;
  }> {
    const db = await getDb();
    if (!db) {
      return { success: false, error: "Database not available" };
    }

    const startTime = Date.now();
    let result: unknown;
    let error: string | undefined;
    let success = false;

    const config = action.actionConfig as ActionConfig;

    try {
      switch (action.actionType) {
        case "jarvis_task":
          result = await this.executeAgentTask(config, payload);
          success = true;
          break;

        case "notification":
          result = await this.executeNotification(config, payload);
          success = true;
          break;

        case "webhook":
          result = await this.executeWebhookCall(config, payload);
          success = true;
          break;

        case "command":
          result = await this.executeCommand(config, payload);
          success = true;
          break;

        case "chain_event":
          result = await this.executeChainEvent(config, payload, eventId);
          success = true;
          break;

        default:
          error = `Unknown action type: ${action.actionType}`;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : "Unknown error";

      // Retry logic
      const maxRetries = action.maxRetries || 3;
      const retryDelay = (action.retryDelaySeconds || 60) * 1000;

      if (maxRetries > 0) {
        for (let i = 0; i < maxRetries; i++) {
          await this.delay(retryDelay * (i + 1));
          try {
            result = await this.retryAction(
              action.actionType as ActionType,
              config,
              payload,
              eventId
            );
            success = true;
            error = undefined;
            break;
          } catch (retryError) {
            error =
              retryError instanceof Error ? retryError.message : "Retry failed";
          }
        }
      }
    }

    const durationMs = Date.now() - startTime;

    // Update event log
    await db
      .update(eventLog)
      .set({
        actionId: action.id,
        success: success ? 1 : 0,
        result: result as Record<string, unknown> | undefined,
        errorMessage: error,
        executionTimeMs: durationMs,
      })
      .where(eq(eventLog.id, eventId));

    return { success, result, error };
  }

  /**
   * Execute an agent task action
   */
  private async executeAgentTask(
    config: ActionConfig,
    payload: Record<string, unknown>
  ): Promise<{ message: string }> {
    if (!config.prompt) {
      throw new Error("Agent prompt is required for jarvis_task action");
    }

    // Interpolate payload into prompt
    const prompt = this.interpolateTemplate(config.prompt, payload);

    // For now, we'll just log the task - actual integration with JARVIS
    // would require importing the orchestrator
    console.log("[EventExecutor] Agent task:", { prompt });

    // TODO: Integrate with JARVIS orchestrator
    // const result = await runOrchestrator(prompt, userId, config);

    return {
      message: "Agent task queued",
    };
  }

  /**
   * Execute a notification action
   */
  private async executeNotification(
    config: ActionConfig,
    payload: Record<string, unknown>
  ): Promise<{ sent: boolean }> {
    if (!config.title) {
      throw new Error("Notification title is required");
    }

    const title = this.interpolateTemplate(config.title, payload);
    const body = config.message
      ? this.interpolateTemplate(config.message, payload)
      : JSON.stringify(payload, null, 2);

    // Send notification to owner
    const sent = await notifyOwner({ title, content: body });

    return { sent };
  }

  /**
   * Execute a webhook call action
   */
  private async executeWebhookCall(
    config: ActionConfig,
    payload: Record<string, unknown>
  ): Promise<{ status: number; response: unknown }> {
    if (!config.url) {
      throw new Error("Webhook URL is required");
    }

    const method = config.method || "POST";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...config.headers,
    };

    // Interpolate body template
    let body: string | undefined;
    if (config.body) {
      body = this.interpolateTemplate(config.body, payload);
    } else if (method !== "GET") {
      body = JSON.stringify(payload);
    }

    const response = await fetch(config.url, {
      method,
      headers,
      body,
    });

    const responseData = await response.text();
    let parsedResponse: unknown;
    try {
      parsedResponse = JSON.parse(responseData);
    } catch {
      parsedResponse = responseData;
    }

    if (!response.ok) {
      throw new Error(
        `Webhook call failed: ${response.status} ${responseData}`
      );
    }

    return {
      status: response.status,
      response: parsedResponse,
    };
  }

  /**
   * Execute a command action (SSH)
   */
  private async executeCommand(
    config: ActionConfig,
    payload: Record<string, unknown>
  ): Promise<{ output: string }> {
    if (!config.command) {
      throw new Error("Command is required");
    }

    const command = this.interpolateTemplate(config.command, payload);

    // TODO: Integrate with SSH manager
    console.log("[EventExecutor] Command:", { command, hostId: config.hostId });

    return {
      output: "Command execution not yet implemented",
    };
  }

  /**
   * Execute a chain event action
   */
  private async executeChainEvent(
    config: ActionConfig,
    payload: Record<string, unknown>,
    eventId: number
  ): Promise<{ triggered: boolean }> {
    if (!config.triggerId) {
      throw new Error("Trigger ID is required for chain_event");
    }

    // TODO: Trigger another event
    console.log("[EventExecutor] Chain event:", {
      triggerId: config.triggerId,
    });

    return { triggered: true };
  }

  /**
   * Retry an action
   */
  private async retryAction(
    actionType: ActionType,
    config: ActionConfig,
    payload: Record<string, unknown>,
    eventId: number
  ): Promise<unknown> {
    switch (actionType) {
      case "jarvis_task":
        return this.executeAgentTask(config, payload);
      case "notification":
        return this.executeNotification(config, payload);
      case "webhook":
        return this.executeWebhookCall(config, payload);
      case "command":
        return this.executeCommand(config, payload);
      case "chain_event":
        return this.executeChainEvent(config, payload, eventId);
      default:
        throw new Error(`Cannot retry action type: ${actionType}`);
    }
  }

  /**
   * Interpolate template variables
   */
  private interpolateTemplate(
    template: string,
    payload: Record<string, unknown>
  ): string {
    return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
      const value = this.getNestedValue(payload, path);
      if (value === undefined) return match;
      if (typeof value === "object") return JSON.stringify(value);
      return String(value);
    });
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split(".");
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current !== "object") return undefined;
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a new action
   */
  async createAction(
    triggerId: number,
    name: string,
    actionType: ActionType,
    config: ActionConfig,
    options: {
      executionOrder?: number;
      maxRetries?: number;
      retryDelaySeconds?: number;
    } = {}
  ): Promise<typeof eventActions.$inferSelect> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const [inserted] = await db
      .insert(eventActions)
      .values({
        triggerId,
        name,
        actionType,
        actionConfig: config as Record<string, unknown>,
        executionOrder: options.executionOrder || 0,
        maxRetries: options.maxRetries || 3,
        retryDelaySeconds: options.retryDelaySeconds || 60,
        isEnabled: 1,
      })
      .$returningId();

    const [result] = await db
      .select()
      .from(eventActions)
      .where(eq(eventActions.id, inserted.id))
      .limit(1);

    return result;
  }

  /**
   * Get actions for a trigger
   */
  async getTriggerActions(
    triggerId: number
  ): Promise<Array<typeof eventActions.$inferSelect>> {
    const db = await getDb();
    if (!db) return [];

    return db
      .select()
      .from(eventActions)
      .where(eq(eventActions.triggerId, triggerId));
  }
}

// Singleton instance
export const eventExecutor = new EventExecutor();
