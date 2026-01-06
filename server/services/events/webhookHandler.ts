/**
 * Webhook Handler
 * Processes incoming webhooks and triggers associated actions
 */

import { getDb } from "../../db";
import {
  webhookEndpoints,
  eventTriggers,
  eventActions,
  eventLog,
} from "../../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import * as crypto from "crypto";
import { eventExecutor } from "./eventExecutor";

interface GitHubWebhookPayload {
  action?: string;
  repository?: {
    full_name: string;
    clone_url: string;
  };
  sender?: {
    login: string;
  };
  ref?: string;
  commits?: Array<{
    id: string;
    message: string;
    author: { name: string; email: string };
  }>;
  pull_request?: {
    number: number;
    title: string;
    state: string;
    html_url: string;
  };
  issue?: {
    number: number;
    title: string;
    state: string;
    html_url: string;
  };
}

interface AlertWebhookPayload {
  alertname: string;
  status: "firing" | "resolved";
  severity?: "critical" | "warning" | "info";
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  startsAt?: string;
  endsAt?: string;
}

interface GenericWebhookPayload {
  event: string;
  data: Record<string, unknown>;
  timestamp?: string;
  source?: string;
}

export class WebhookHandler {
  /**
   * Create a new webhook endpoint
   */
  async createEndpoint(
    userId: number,
    name: string,
    options: {
      description?: string;
      secret?: string;
    } = {}
  ): Promise<typeof webhookEndpoints.$inferSelect> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Generate unique path
    const path = this.generateWebhookPath();
    const secret = options.secret || this.generateSecret();

    const [inserted] = await db
      .insert(webhookEndpoints)
      .values({
        userId,
        name,
        description: options.description,
        path,
        secret,
        isEnabled: 1,
      })
      .$returningId();

    const [result] = await db
      .select()
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.id, inserted.id))
      .limit(1);

    return result;
  }

  /**
   * Process an incoming webhook request
   */
  async processWebhook(
    path: string,
    headers: Record<string, string>,
    body: unknown,
    sourceIp?: string
  ): Promise<{
    success: boolean;
    message: string;
    eventId?: number;
  }> {
    const db = await getDb();
    if (!db) {
      return { success: false, message: "Database not available" };
    }

    // Find the webhook endpoint
    const [endpoint] = await db
      .select()
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.path, path))
      .limit(1);

    if (!endpoint) {
      return { success: false, message: "Webhook endpoint not found" };
    }

    if (!endpoint.isEnabled) {
      return { success: false, message: "Webhook endpoint is disabled" };
    }

    // Verify signature if secret is set
    if (endpoint.secret) {
      const isValid = this.verifySignature(
        endpoint.secret,
        headers,
        JSON.stringify(body)
      );
      if (!isValid) {
        return { success: false, message: "Invalid signature" };
      }
    }

    // Parse the webhook payload
    const eventType = this.detectEventType(headers, body);
    const payload = this.normalizePayload(eventType, body);

    // Find associated triggers
    const triggers = await db
      .select()
      .from(eventTriggers)
      .where(
        and(
          eq(eventTriggers.webhookEndpointId, endpoint.id),
          eq(eventTriggers.isEnabled, 1)
        )
      );

    if (triggers.length === 0) {
      return {
        success: true,
        message: "No triggers configured for this webhook",
      };
    }

    // Process each trigger
    for (const trigger of triggers) {
      // Create event log entry
      const [logEntry] = await db
        .insert(eventLog)
        .values({
          triggerId: trigger.id,
          webhookEndpointId: endpoint.id,
          eventType: "trigger_fired",
          payload: payload as Record<string, unknown>,
          success: 0,
        })
        .$returningId();

      // Get actions for this trigger
      const actions = await db
        .select()
        .from(eventActions)
        .where(eq(eventActions.triggerId, trigger.id));

      // Execute actions
      for (const action of actions) {
        if (!action.isEnabled) continue;

        try {
          await eventExecutor.executeActionFromRow(
            action,
            payload,
            logEntry.id
          );
        } catch (error) {
          console.error(
            `[WebhookHandler] Failed to execute action ${action.id}:`,
            error
          );
        }
      }

      // Update log entry
      await db
        .update(eventLog)
        .set({ success: 1 })
        .where(eq(eventLog.id, logEntry.id));
    }

    // Update webhook stats
    await db
      .update(webhookEndpoints)
      .set({
        lastReceivedAt: new Date(),
        totalReceived: (endpoint.totalReceived || 0) + 1,
      })
      .where(eq(webhookEndpoints.id, endpoint.id));

    return {
      success: true,
      message: "Webhook processed successfully",
    };
  }

  /**
   * Detect event type from headers and body
   */
  private detectEventType(
    headers: Record<string, string>,
    body: unknown
  ): string {
    // GitHub webhooks
    if (headers["x-github-event"]) {
      return `github.${headers["x-github-event"]}`;
    }

    // GitLab webhooks
    if (headers["x-gitlab-event"]) {
      return `gitlab.${headers["x-gitlab-event"].toLowerCase().replace(/ /g, "_")}`;
    }

    // Alertmanager webhooks
    if (body && typeof body === "object" && "alerts" in body) {
      return "alertmanager.alert";
    }

    // Generic webhook
    if (body && typeof body === "object" && "event" in body) {
      return `generic.${(body as GenericWebhookPayload).event}`;
    }

    return "unknown";
  }

  /**
   * Normalize webhook payload to a standard format
   */
  private normalizePayload(
    eventType: string,
    body: unknown
  ): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      raw: body,
      eventType,
      receivedAt: new Date().toISOString(),
    };

    if (!body || typeof body !== "object") {
      return payload;
    }

    // GitHub payload
    if (eventType.startsWith("github.")) {
      const gh = body as GitHubWebhookPayload;
      payload.event = eventType.replace("github.", "");
      payload.action = gh.action;
      payload.repository = gh.repository?.full_name;
      payload.sender = gh.sender?.login;

      if (gh.commits) {
        payload.commits = gh.commits.map(c => ({
          id: c.id,
          message: c.message,
          author: c.author.name,
        }));
      }

      if (gh.pull_request) {
        payload.pullRequest = {
          number: gh.pull_request.number,
          title: gh.pull_request.title,
          state: gh.pull_request.state,
          url: gh.pull_request.html_url,
        };
      }
    }

    // Alert payload
    if (eventType === "alertmanager.alert") {
      const alert = body as AlertWebhookPayload;
      payload.event = "alert";
      payload.alertName = alert.alertname;
      payload.status = alert.status;
      payload.severity = alert.severity;
      payload.labels = alert.labels;
      payload.annotations = alert.annotations;
    }

    return payload;
  }

  /**
   * Verify webhook signature
   */
  private verifySignature(
    secret: string,
    headers: Record<string, string>,
    body: string
  ): boolean {
    // GitHub signature (X-Hub-Signature-256)
    const githubSig = headers["x-hub-signature-256"];
    if (githubSig) {
      const expected =
        "sha256=" +
        crypto.createHmac("sha256", secret).update(body).digest("hex");
      try {
        return crypto.timingSafeEqual(
          Buffer.from(githubSig),
          Buffer.from(expected)
        );
      } catch {
        return false;
      }
    }

    // GitLab token
    const gitlabToken = headers["x-gitlab-token"];
    if (gitlabToken) {
      return gitlabToken === secret;
    }

    // Generic signature header
    const signature = headers["x-signature"] || headers["x-webhook-signature"];
    if (signature) {
      const expected = crypto
        .createHmac("sha256", secret)
        .update(body)
        .digest("hex");
      try {
        return crypto.timingSafeEqual(
          Buffer.from(signature),
          Buffer.from(expected)
        );
      } catch {
        return false;
      }
    }

    // No signature to verify
    return true;
  }

  /**
   * Generate a unique webhook path
   */
  private generateWebhookPath(): string {
    return crypto.randomBytes(16).toString("hex");
  }

  /**
   * Generate a webhook secret
   */
  private generateSecret(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Get webhook endpoint by ID
   */
  async getEndpoint(
    endpointId: number
  ): Promise<typeof webhookEndpoints.$inferSelect | null> {
    const db = await getDb();
    if (!db) return null;

    const [row] = await db
      .select()
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.id, endpointId))
      .limit(1);

    return row || null;
  }

  /**
   * Get user's webhook endpoints
   */
  async getUserEndpoints(
    userId: number
  ): Promise<Array<typeof webhookEndpoints.$inferSelect>> {
    const db = await getDb();
    if (!db) return [];

    return db
      .select()
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.userId, userId));
  }

  /**
   * Delete a webhook endpoint
   */
  async deleteEndpoint(endpointId: number): Promise<void> {
    const db = await getDb();
    if (!db) return;

    await db
      .delete(webhookEndpoints)
      .where(eq(webhookEndpoints.id, endpointId));
  }

  /**
   * Create a webhook trigger
   */
  async createWebhookTrigger(
    userId: number,
    webhookEndpointId: number,
    name: string,
    options: {
      description?: string;
      conditionType?: "always" | "json_match" | "regex" | "expression";
      conditionConfig?: Record<string, unknown>;
    } = {}
  ): Promise<typeof eventTriggers.$inferSelect> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const [inserted] = await db
      .insert(eventTriggers)
      .values({
        userId,
        webhookEndpointId,
        name,
        description: options.description,
        triggerType: "webhook",
        conditionType: options.conditionType || "always",
        conditionConfig: options.conditionConfig,
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
}

// Singleton instance
export const webhookHandler = new WebhookHandler();
