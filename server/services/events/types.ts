/**
 * Webhook & Event System Types
 */

export type EventSource = "webhook" | "cron" | "system" | "manual" | "agent";
export type TriggerType = "webhook" | "cron" | "event" | "condition";
export type ActionType =
  | "agent_task"
  | "notification"
  | "webhook_call"
  | "script"
  | "chain";
export type EventStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "skipped";

export interface WebhookEndpoint {
  id: number;
  userId: number;
  name: string;
  description?: string;
  path: string; // Unique path for this webhook
  secret?: string; // For signature verification
  isActive: boolean;
  allowedSources?: string[]; // IP whitelist
  rateLimit?: number; // Requests per minute
  lastTriggeredAt?: Date;
  triggerCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventTrigger {
  id: number;
  userId: number;
  name: string;
  description?: string;
  triggerType: TriggerType;
  isActive: boolean;

  // Webhook trigger config
  webhookId?: number;
  webhookEventTypes?: string[]; // e.g., ['push', 'pull_request']

  // Cron trigger config
  cronExpression?: string;
  timezone?: string;

  // Event trigger config
  eventPattern?: string; // Pattern to match system events

  // Condition trigger config
  conditionScript?: string; // JS expression to evaluate

  // Linked action
  actionId?: number;

  lastTriggeredAt?: Date;
  nextTriggerAt?: Date;
  triggerCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventAction {
  id: number;
  userId: number;
  name: string;
  description?: string;
  actionType: ActionType;
  isActive: boolean;

  // Agent task config
  agentPrompt?: string;
  agentConfig?: AgentActionConfig;

  // Notification config
  notificationTitle?: string;
  notificationBody?: string;
  notificationChannels?: string[];

  // Webhook call config
  webhookUrl?: string;
  webhookMethod?: "GET" | "POST" | "PUT" | "DELETE";
  webhookHeaders?: Record<string, string>;
  webhookBody?: string;

  // Script config
  scriptContent?: string;
  scriptLanguage?: "javascript" | "python";

  // Chain config (execute multiple actions)
  chainedActionIds?: number[];

  // Retry config
  maxRetries: number;
  retryDelayMs: number;

  // Stats
  executionCount: number;
  successCount: number;
  failureCount: number;
  lastExecutedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export interface AgentActionConfig {
  taskType?: string;
  priority?: "low" | "normal" | "high" | "urgent";
  timeout?: number;
  context?: Record<string, unknown>;
}

export interface EventLog {
  id: number;
  userId: number;
  triggerId?: number;
  actionId?: number;

  source: EventSource;
  eventType: string;
  eventData?: Record<string, unknown>;

  status: EventStatus;
  result?: Record<string, unknown>;
  error?: string;

  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;

  createdAt: Date;
}

export interface CronJob {
  id: number;
  triggerId: number;
  cronExpression: string;
  timezone: string;
  isActive: boolean;
  lastRunAt?: Date;
  nextRunAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Webhook payload types
export interface GitHubWebhookPayload {
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

export interface AlertWebhookPayload {
  alertname: string;
  status: "firing" | "resolved";
  severity?: "critical" | "warning" | "info";
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  startsAt?: string;
  endsAt?: string;
}

export interface GenericWebhookPayload {
  event: string;
  data: Record<string, unknown>;
  timestamp?: string;
  source?: string;
}

// Event templates
export const EVENT_TEMPLATES = {
  github_push: {
    name: "GitHub Push",
    description: "Triggered when code is pushed to a repository",
    triggerType: "webhook" as TriggerType,
    webhookEventTypes: ["push"],
    defaultAction: {
      actionType: "agent_task" as ActionType,
      agentPrompt:
        "Analyze the pushed commits and summarize the changes: {{payload}}",
    },
  },
  github_pr: {
    name: "GitHub Pull Request",
    description: "Triggered when a pull request is opened or updated",
    triggerType: "webhook" as TriggerType,
    webhookEventTypes: ["pull_request"],
    defaultAction: {
      actionType: "agent_task" as ActionType,
      agentPrompt: "Review the pull request and provide feedback: {{payload}}",
    },
  },
  alert_firing: {
    name: "Alert Firing",
    description: "Triggered when a monitoring alert fires",
    triggerType: "webhook" as TriggerType,
    webhookEventTypes: ["alert"],
    defaultAction: {
      actionType: "agent_task" as ActionType,
      agentPrompt:
        "Investigate and attempt to remediate the alert: {{payload}}",
    },
  },
  daily_report: {
    name: "Daily Report",
    description: "Generate a daily summary report",
    triggerType: "cron" as TriggerType,
    cronExpression: "0 9 * * *", // 9 AM daily
    defaultAction: {
      actionType: "agent_task" as ActionType,
      agentPrompt:
        "Generate a daily summary report of system status and recent activity",
    },
  },
  hourly_health_check: {
    name: "Hourly Health Check",
    description: "Check system health every hour",
    triggerType: "cron" as TriggerType,
    cronExpression: "0 * * * *", // Every hour
    defaultAction: {
      actionType: "agent_task" as ActionType,
      agentPrompt:
        "Perform a health check on all monitored systems and report any issues",
    },
  },
};
