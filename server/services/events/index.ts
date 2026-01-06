/**
 * Webhook & Event System
 *
 * Provides event-driven automation capabilities:
 * - Webhook endpoints for external integrations (GitHub, GitLab, Alertmanager, etc.)
 * - Cron-based scheduled tasks
 * - Event-triggered actions (agent tasks, notifications, webhook calls, scripts)
 * - Action chaining for complex workflows
 */

export * from "./types";
export { webhookHandler } from "./webhookHandler";
export { eventExecutor } from "./eventExecutor";
export { cronScheduler } from "./cronScheduler";
