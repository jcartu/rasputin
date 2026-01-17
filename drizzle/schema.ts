import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  mediumtext,
  timestamp,
  varchar,
  json,
  bigint,
  decimal,
  boolean,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  username: varchar("username", { length: 64 }).unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  avatarUrl: text("avatarUrl"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Chat sessions - each represents a conversation thread
 */
export const chats = mysqlTable("chats", {
  id: int("id").autoincrement().primaryKey(),

  /** User who owns this chat */
  userId: int("userId").notNull(),

  /** Chat title (auto-generated from first message or user-set) */
  title: varchar("title", { length: 255 }).notNull().default("New Chat"),

  /** Mode: consensus or synthesis */
  mode: mysqlEnum("mode", ["consensus", "synthesis"])
    .notNull()
    .default("consensus"),

  /** Speed tier: fast, normal, max */
  speedTier: mysqlEnum("speedTier", ["fast", "normal", "max"])
    .notNull()
    .default("normal"),

  /** Selected models for this chat (JSON array of model IDs) */
  selectedModels: json("selectedModels").$type<string[]>(),

  /** Total messages in this chat */
  messageCount: int("messageCount").notNull().default(0),

  /** Total tokens used across all messages */
  totalTokens: int("totalTokens").notNull().default(0),

  /** Total cost in USD */
  totalCost: decimal("totalCost", { precision: 10, scale: 6 })
    .notNull()
    .default("0"),

  /** Timestamps */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Chat = typeof chats.$inferSelect;
export type InsertChat = typeof chats.$inferInsert;

/**
 * Messages within a chat - user queries and AI responses
 */
export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),

  /** Parent chat */
  chatId: int("chatId").notNull(),

  /** Message role: user query or assistant response */
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),

  /** The actual message content */
  content: text("content").notNull(),

  /** For assistant messages: the consensus/synthesis result summary */
  summary: text("summary"),

  /** Agreement percentage (for consensus mode) */
  agreementPercentage: int("agreementPercentage"),

  /** Total latency in milliseconds */
  latencyMs: int("latencyMs"),

  /** Total tokens used for this message */
  tokenCount: int("tokenCount"),

  /** Cost in USD for this message */
  cost: decimal("cost", { precision: 10, scale: 6 }),

  /** Metadata JSON (model stats, pipeline info, etc.) */
  metadata: json("metadata").$type<Record<string, unknown>>(),

  /** Timestamp */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

/**
 * Individual model responses for each message
 */
export const modelResponses = mysqlTable("modelResponses", {
  id: int("id").autoincrement().primaryKey(),

  /** Parent message */
  messageId: int("messageId").notNull(),

  /** Model identifier (e.g., "gpt-5", "claude-sonnet-4.5") */
  modelId: varchar("modelId", { length: 128 }).notNull(),

  /** Model display name */
  modelName: varchar("modelName", { length: 128 }).notNull(),

  /** The model's response content */
  content: text("content").notNull(),

  /** Response status */
  status: mysqlEnum("status", ["pending", "streaming", "completed", "error"])
    .notNull()
    .default("pending"),

  /** Error message if failed */
  errorMessage: text("errorMessage"),

  /** Latency in milliseconds */
  latencyMs: int("latencyMs"),

  /** Input tokens */
  inputTokens: int("inputTokens"),

  /** Output tokens */
  outputTokens: int("outputTokens"),

  /** Cost in USD */
  cost: decimal("cost", { precision: 10, scale: 6 }),

  /** Provider used (direct or openrouter) */
  provider: varchar("provider", { length: 64 }),

  /** Timestamp */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ModelResponse = typeof modelResponses.$inferSelect;
export type InsertModelResponse = typeof modelResponses.$inferInsert;

/**
 * Synthesis pipeline stages for tracking multi-stage synthesis
 */
export const synthesisPipelineStages = mysqlTable("synthesisPipelineStages", {
  id: int("id").autoincrement().primaryKey(),

  /** Parent message */
  messageId: int("messageId").notNull(),

  /** Stage name */
  stageName: varchar("stageName", { length: 64 }).notNull(),

  /** Stage order (1-5) */
  stageOrder: int("stageOrder").notNull(),

  /** Stage status */
  status: mysqlEnum("status", ["pending", "running", "completed", "error"])
    .notNull()
    .default("pending"),

  /** Stage output/result */
  output: text("output"),

  /** Duration in milliseconds */
  durationMs: int("durationMs"),

  /** Metadata */
  metadata: json("metadata").$type<Record<string, unknown>>(),

  /** Timestamp */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SynthesisPipelineStage =
  typeof synthesisPipelineStages.$inferSelect;
export type InsertSynthesisPipelineStage =
  typeof synthesisPipelineStages.$inferInsert;

/**
 * JARVIS Agent Tasks - persistent task storage
 */
export const agentTasks = mysqlTable("agentTasks", {
  id: int("id").autoincrement().primaryKey(),

  /** User who owns this task */
  userId: int("userId").notNull(),

  /** Task title (auto-generated from query) */
  title: varchar("title", { length: 255 }).notNull().default("New Task"),

  /** Original user query/prompt */
  query: text("query").notNull(),

  /** Task status */
  status: mysqlEnum("status", [
    "idle",
    "running",
    "completed",
    "failed",
    "cancelled",
    "waiting_approval",
  ])
    .notNull()
    .default("idle"),

  /** Pending approval ID (when status is waiting_approval) */
  pendingApprovalId: int("pendingApprovalId"),

  /** Final result/summary */
  result: text("result"),

  /** Error message if failed */
  errorMessage: text("errorMessage"),

  /** Total iterations/steps taken */
  iterationCount: int("iterationCount").notNull().default(0),

  /** Total tokens used */
  totalTokens: int("totalTokens").notNull().default(0),

  /** Total cost in USD */
  totalCost: decimal("totalCost", { precision: 10, scale: 6 })
    .notNull()
    .default("0"),

  /** Duration in milliseconds */
  durationMs: int("durationMs"),

  /** Timestamps */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type AgentTask = typeof agentTasks.$inferSelect;
export type InsertAgentTask = typeof agentTasks.$inferInsert;

/**
 * Agent Task Messages - conversation history within a task
 */
export const agentMessages = mysqlTable("agentMessages", {
  id: int("id").autoincrement().primaryKey(),

  /** Parent task */
  taskId: int("taskId").notNull(),

  /** Message role */
  role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),

  /** Message content */
  content: text("content").notNull(),

  /** Tool calls made in this message (JSON array) */
  toolCalls: json("toolCalls").$type<
    Array<{
      id: string;
      name: string;
      input: Record<string, unknown>;
      output?: string;
      status: "pending" | "running" | "completed" | "error";
      durationMs?: number;
      error?: string;
    }>
  >(),

  /** Thinking/reasoning content */
  thinking: text("thinking"),

  /** Timestamp */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AgentMessage = typeof agentMessages.$inferSelect;
export type InsertAgentMessage = typeof agentMessages.$inferInsert;

/**
 * Agent Tool Calls - detailed log of each tool execution
 */
export const agentToolCalls = mysqlTable("agentToolCalls", {
  id: int("id").autoincrement().primaryKey(),

  /** Parent task */
  taskId: int("taskId").notNull(),

  /** Parent message (optional) */
  messageId: int("messageId"),

  /** Tool name */
  toolName: varchar("toolName", { length: 64 }).notNull(),

  /** Tool input parameters (JSON) */
  input: json("input").$type<Record<string, unknown>>().notNull(),

  /** Tool output */
  output: text("output"),

  /** Execution status */
  status: mysqlEnum("status", ["pending", "running", "completed", "error"])
    .notNull()
    .default("pending"),

  /** Error message if failed */
  errorMessage: text("errorMessage"),

  /** Duration in milliseconds */
  durationMs: int("durationMs"),

  /** Timestamp */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AgentToolCall = typeof agentToolCalls.$inferSelect;
export type InsertAgentToolCall = typeof agentToolCalls.$inferInsert;

/**
 * Usage Tracking - API call and resource usage per user
 */
export const usageTracking = mysqlTable("usageTracking", {
  id: int("id").autoincrement().primaryKey(),

  /** User ID */
  userId: int("userId").notNull(),

  /** Date (YYYY-MM-DD format for daily tracking) */
  date: varchar("date", { length: 10 }).notNull(),

  /** Number of agent tasks executed */
  agentTaskCount: int("agentTaskCount").notNull().default(0),

  /** Number of consensus queries */
  consensusQueryCount: int("consensusQueryCount").notNull().default(0),

  /** Number of synthesis queries */
  synthesisQueryCount: int("synthesisQueryCount").notNull().default(0),

  /** Total API calls made */
  totalApiCalls: int("totalApiCalls").notNull().default(0),

  /** Total tokens used */
  totalTokens: bigint("totalTokens", { mode: "number" }).notNull().default(0),

  /** Total cost in USD */
  totalCost: decimal("totalCost", { precision: 10, scale: 6 })
    .notNull()
    .default("0"),

  /** Last updated */
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UsageTracking = typeof usageTracking.$inferSelect;
export type InsertUsageTracking = typeof usageTracking.$inferInsert;

/**
 * Agent Files - files created or uploaded during agent tasks
 */
export const agentFiles = mysqlTable("agentFiles", {
  id: int("id").autoincrement().primaryKey(),

  /** Parent task */
  taskId: int("taskId").notNull(),

  /** User ID */
  userId: int("userId").notNull(),

  /** File name */
  fileName: varchar("fileName", { length: 255 }).notNull(),

  /** File path in storage */
  filePath: text("filePath").notNull(),

  /** MIME type */
  mimeType: varchar("mimeType", { length: 128 }),

  /** File size in bytes */
  fileSize: bigint("fileSize", { mode: "number" }),

  /** Whether this was uploaded by user or created by agent */
  source: mysqlEnum("source", ["upload", "generated"])
    .notNull()
    .default("generated"),

  /** S3 URL if stored in cloud */
  s3Url: text("s3Url"),

  /** Timestamp */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AgentFile = typeof agentFiles.$inferSelect;
export type InsertAgentFile = typeof agentFiles.$inferInsert;

/**
 * Scheduled Tasks - recurring or one-time scheduled JARVIS tasks
 */
export const scheduledTasks = mysqlTable("scheduledTasks", {
  id: int("id").autoincrement().primaryKey(),

  /** User who owns this scheduled task */
  userId: int("userId").notNull(),

  /** Task name/title */
  name: varchar("name", { length: 255 }).notNull(),

  /** Task prompt/query to execute */
  prompt: text("prompt").notNull(),

  /** Schedule type: once, daily, weekly, monthly, cron */
  scheduleType: mysqlEnum("scheduleType", [
    "once",
    "daily",
    "weekly",
    "monthly",
    "cron",
  ])
    .notNull()
    .default("once"),

  /** Cron expression (for cron type) */
  cronExpression: varchar("cronExpression", { length: 100 }),

  /** Time of day to run (HH:MM format) */
  timeOfDay: varchar("timeOfDay", { length: 5 }),

  /** Day of week (0-6, for weekly) */
  dayOfWeek: int("dayOfWeek"),

  /** Day of month (1-31, for monthly) */
  dayOfMonth: int("dayOfMonth"),

  /** Timezone */
  timezone: varchar("timezone", { length: 64 }).notNull().default("UTC"),

  /** Whether to speak results via TTS */
  speakResults: int("speakResults").notNull().default(0),

  /** Voice ID for TTS */
  voiceId: varchar("voiceId", { length: 64 }),

  /** Whether task is enabled */
  enabled: int("enabled").notNull().default(1),

  /** Last run timestamp */
  lastRunAt: timestamp("lastRunAt"),

  /** Next scheduled run */
  nextRunAt: timestamp("nextRunAt"),

  /** Last run status */
  lastRunStatus: mysqlEnum("lastRunStatus", ["success", "failed", "skipped"]),

  /** Last run result summary */
  lastRunResult: text("lastRunResult"),

  /** Total run count */
  runCount: int("runCount").notNull().default(0),

  /** Timestamps */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ScheduledTask = typeof scheduledTasks.$inferSelect;
export type InsertScheduledTask = typeof scheduledTasks.$inferInsert;

/**
 * Scheduled Task Runs - history of scheduled task executions
 */
export const scheduledTaskRuns = mysqlTable("scheduledTaskRuns", {
  id: int("id").autoincrement().primaryKey(),

  /** Parent scheduled task */
  scheduledTaskId: int("scheduledTaskId").notNull(),

  /** Associated agent task (if created) */
  agentTaskId: int("agentTaskId"),

  /** Run status */
  status: mysqlEnum("status", [
    "running",
    "success",
    "failed",
    "skipped",
  ]).notNull(),

  /** Result summary */
  result: text("result"),

  /** Error message if failed */
  errorMessage: text("errorMessage"),

  /** Duration in milliseconds */
  durationMs: int("durationMs"),

  /** Whether voice output was generated */
  voiceGenerated: int("voiceGenerated").notNull().default(0),

  /** Scheduled time */
  scheduledAt: timestamp("scheduledAt").notNull(),

  /** Actual start time */
  startedAt: timestamp("startedAt"),

  /** Completion time */
  completedAt: timestamp("completedAt"),
});

export type ScheduledTaskRun = typeof scheduledTaskRuns.$inferSelect;
export type InsertScheduledTaskRun = typeof scheduledTaskRuns.$inferInsert;

/**
 * Workspaces - persistent development environments for JARVIS
 */
export const workspaces = mysqlTable("workspaces", {
  id: int("id").autoincrement().primaryKey(),

  /** User who owns this workspace */
  userId: int("userId").notNull(),

  /** Workspace name */
  name: varchar("name", { length: 255 }).notNull(),

  /** Workspace description */
  description: text("description"),

  /** Template used to create this workspace */
  template: varchar("template", { length: 64 }).notNull().default("blank"),

  /** Workspace status */
  status: mysqlEnum("status", [
    "creating",
    "ready",
    "running",
    "stopped",
    "error",
    "deleted",
  ])
    .notNull()
    .default("creating"),

  /** Base path on filesystem */
  basePath: text("basePath").notNull(),

  /** Container ID (if using Docker) */
  containerId: varchar("containerId", { length: 128 }),

  /** Container status */
  containerStatus: mysqlEnum("containerStatus", [
    "none",
    "creating",
    "running",
    "stopped",
    "error",
  ])
    .notNull()
    .default("none"),

  /** Dev server port (if running) */
  devServerPort: int("devServerPort"),

  /** Dev server URL (if running) */
  devServerUrl: text("devServerUrl"),

  /** Git repository initialized */
  gitInitialized: int("gitInitialized").notNull().default(0),

  /** Current git branch */
  gitBranch: varchar("gitBranch", { length: 128 }).default("main"),

  /** Last git commit hash */
  lastCommitHash: varchar("lastCommitHash", { length: 64 }),

  /** Last git commit message */
  lastCommitMessage: text("lastCommitMessage"),

  /** Resource limits - CPU (cores) */
  cpuLimit: decimal("cpuLimit", { precision: 4, scale: 2 }).default("2.00"),

  /** Resource limits - Memory (MB) */
  memoryLimitMb: int("memoryLimitMb").default(2048),

  /** Resource limits - Disk (MB) */
  diskLimitMb: int("diskLimitMb").default(5120),

  /** Current disk usage (MB) */
  diskUsageMb: int("diskUsageMb").default(0),

  /** Metadata (JSON) */
  metadata: json("metadata").$type<Record<string, unknown>>(),

  /** Timestamps */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastAccessedAt: timestamp("lastAccessedAt").defaultNow().notNull(),
});

export type Workspace = typeof workspaces.$inferSelect;
export type InsertWorkspace = typeof workspaces.$inferInsert;

/**
 * Workspace Files - file metadata for workspace contents
 */
export const workspaceFiles = mysqlTable("workspaceFiles", {
  id: int("id").autoincrement().primaryKey(),

  /** Parent workspace */
  workspaceId: int("workspaceId").notNull(),

  /** File path relative to workspace root */
  filePath: varchar("filePath", { length: 1024 }).notNull(),

  /** File name */
  fileName: varchar("fileName", { length: 255 }).notNull(),

  /** Is directory */
  isDirectory: int("isDirectory").notNull().default(0),

  /** File size in bytes */
  fileSize: bigint("fileSize", { mode: "number" }).default(0),

  /** MIME type */
  mimeType: varchar("mimeType", { length: 128 }),

  /** File hash for change detection */
  contentHash: varchar("contentHash", { length: 64 }),

  /** Last modified timestamp */
  lastModified: timestamp("lastModified").defaultNow().notNull(),

  /** Created timestamp */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WorkspaceFile = typeof workspaceFiles.$inferSelect;
export type InsertWorkspaceFile = typeof workspaceFiles.$inferInsert;

/**
 * Workspace Commits - git commit history
 */
export const workspaceCommits = mysqlTable("workspaceCommits", {
  id: int("id").autoincrement().primaryKey(),

  /** Parent workspace */
  workspaceId: int("workspaceId").notNull(),

  /** Commit hash */
  commitHash: varchar("commitHash", { length: 64 }).notNull(),

  /** Commit message */
  message: text("message").notNull(),

  /** Author name */
  authorName: varchar("authorName", { length: 255 }),

  /** Author email */
  authorEmail: varchar("authorEmail", { length: 320 }),

  /** Files changed count */
  filesChanged: int("filesChanged").default(0),

  /** Insertions count */
  insertions: int("insertions").default(0),

  /** Deletions count */
  deletions: int("deletions").default(0),

  /** Parent commit hash */
  parentHash: varchar("parentHash", { length: 64 }),

  /** Is this a checkpoint (user-created snapshot) */
  isCheckpoint: int("isCheckpoint").notNull().default(0),

  /** Checkpoint name (if checkpoint) */
  checkpointName: varchar("checkpointName", { length: 255 }),

  /** Timestamp */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WorkspaceCommit = typeof workspaceCommits.$inferSelect;
export type InsertWorkspaceCommit = typeof workspaceCommits.$inferInsert;

/**
 * Workspace Templates - available project templates
 */
export const workspaceTemplates = mysqlTable("workspaceTemplates", {
  id: int("id").autoincrement().primaryKey(),

  /** Template identifier */
  templateId: varchar("templateId", { length: 64 }).notNull().unique(),

  /** Template name */
  name: varchar("name", { length: 255 }).notNull(),

  /** Template description */
  description: text("description"),

  /** Template category */
  category: varchar("category", { length: 64 }).notNull().default("general"),

  /** Icon name (Lucide icon) */
  icon: varchar("icon", { length: 64 }).default("folder"),

  /** Base image/setup commands (JSON) */
  setupConfig: json("setupConfig").$type<{
    baseImage?: string;
    setupCommands?: string[];
    defaultFiles?: Array<{ path: string; content: string }>;
    devServerCommand?: string;
    devServerPort?: number;
  }>(),

  /** Whether this is a system template */
  isSystem: int("isSystem").notNull().default(1),

  /** Sort order */
  sortOrder: int("sortOrder").default(0),

  /** Timestamps */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WorkspaceTemplate = typeof workspaceTemplates.$inferSelect;
export type InsertWorkspaceTemplate = typeof workspaceTemplates.$inferInsert;

/**
 * Workspace Processes - running processes in workspaces
 */
export const workspaceProcesses = mysqlTable("workspaceProcesses", {
  id: int("id").autoincrement().primaryKey(),

  /** Parent workspace */
  workspaceId: int("workspaceId").notNull(),

  /** Process type */
  processType: mysqlEnum("processType", [
    "dev-server",
    "build",
    "test",
    "shell",
    "custom",
  ])
    .notNull()
    .default("shell"),

  /** Process ID (OS PID) */
  pid: int("pid"),

  /** Command that was run */
  command: text("command").notNull(),

  /** Working directory */
  workingDir: text("workingDir"),

  /** Process status */
  status: mysqlEnum("status", ["starting", "running", "stopped", "crashed"])
    .notNull()
    .default("starting"),

  /** Exit code (if stopped) */
  exitCode: int("exitCode"),

  /** Port (if applicable) */
  port: int("port"),

  /** CPU usage percentage */
  cpuUsage: decimal("cpuUsage", { precision: 5, scale: 2 }),

  /** Memory usage (MB) */
  memoryUsageMb: int("memoryUsageMb"),

  /** Started at */
  startedAt: timestamp("startedAt").defaultNow().notNull(),

  /** Stopped at */
  stoppedAt: timestamp("stoppedAt"),
});

export type WorkspaceProcess = typeof workspaceProcesses.$inferSelect;
export type InsertWorkspaceProcess = typeof workspaceProcesses.$inferInsert;

/**
 * SSH Hosts - registered remote servers for JARVIS to connect to
 */
export const sshHosts = mysqlTable("sshHosts", {
  id: int("id").autoincrement().primaryKey(),

  /** User who owns this host */
  userId: int("userId").notNull(),

  /** Host display name */
  name: varchar("name", { length: 255 }).notNull(),

  /** Hostname or IP address */
  hostname: varchar("hostname", { length: 255 }).notNull(),

  /** SSH port */
  port: int("port").notNull().default(22),

  /** SSH username */
  username: varchar("username", { length: 128 }).notNull(),

  /** Authentication type */
  authType: mysqlEnum("authType", ["password", "key"]).notNull().default("key"),

  /** Host status */
  status: mysqlEnum("status", ["unknown", "online", "offline", "error"])
    .notNull()
    .default("unknown"),

  /** Last connection test result */
  lastTestResult: text("lastTestResult"),

  /** Last successful connection */
  lastConnectedAt: timestamp("lastConnectedAt"),

  /** Host fingerprint (for host key verification) */
  hostFingerprint: varchar("hostFingerprint", { length: 128 }),

  /** Whether host key is verified/pinned */
  hostKeyVerified: int("hostKeyVerified").notNull().default(0),

  /** Tags for organization (JSON array) */
  tags: json("tags").$type<string[]>(),

  /** Description/notes */
  description: text("description"),

  /** Timestamps */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SshHost = typeof sshHosts.$inferSelect;
export type InsertSshHost = typeof sshHosts.$inferInsert;

/**
 * SSH Credentials - encrypted authentication credentials for hosts
 */
export const sshCredentials = mysqlTable("sshCredentials", {
  id: int("id").autoincrement().primaryKey(),

  /** Parent host */
  hostId: int("hostId").notNull(),

  /** Encrypted private key (for key auth) */
  encryptedPrivateKey: text("encryptedPrivateKey"),

  /** Encrypted password (for password auth or key passphrase) */
  encryptedPassword: text("encryptedPassword"),

  /** Encryption IV (initialization vector) */
  encryptionIv: varchar("encryptionIv", { length: 64 }),

  /** Key type (rsa, ed25519, ecdsa) */
  keyType: varchar("keyType", { length: 32 }),

  /** Timestamps */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SshCredential = typeof sshCredentials.$inferSelect;
export type InsertSshCredential = typeof sshCredentials.$inferInsert;

/**
 * SSH Permissions - granular access control for each host
 */
export const sshPermissions = mysqlTable("sshPermissions", {
  id: int("id").autoincrement().primaryKey(),

  /** Parent host */
  hostId: int("hostId").notNull(),

  /** Allowed paths (JSON array of glob patterns) */
  allowedPaths: json("allowedPaths").$type<string[]>(),

  /** Blocked paths (JSON array of glob patterns) */
  blockedPaths: json("blockedPaths").$type<string[]>(),

  /** Allowed commands (JSON array of command patterns) */
  allowedCommands: json("allowedCommands").$type<string[]>(),

  /** Blocked commands (JSON array of command patterns) */
  blockedCommands: json("blockedCommands").$type<string[]>(),

  /** Commands that require approval (JSON array) */
  approvalRequiredCommands: json("approvalRequiredCommands").$type<string[]>(),

  /** Whether to require approval for all commands */
  requireApprovalForAll: int("requireApprovalForAll").notNull().default(0),

  /** Maximum command execution time (seconds) */
  maxExecutionTime: int("maxExecutionTime").default(300),

  /** Whether file writes are allowed */
  allowFileWrite: int("allowFileWrite").notNull().default(1),

  /** Whether file deletes are allowed */
  allowFileDelete: int("allowFileDelete").notNull().default(0),

  /** Whether sudo is allowed */
  allowSudo: int("allowSudo").notNull().default(0),

  /** Timestamps */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SshPermission = typeof sshPermissions.$inferSelect;
export type InsertSshPermission = typeof sshPermissions.$inferInsert;

/**
 * SSH Audit Log - complete history of all remote commands executed
 */
export const sshAuditLog = mysqlTable("sshAuditLog", {
  id: int("id").autoincrement().primaryKey(),

  /** Host where command was executed */
  hostId: int("hostId").notNull(),

  /** User who initiated the command */
  userId: int("userId").notNull(),

  /** Related agent task (if any) */
  taskId: int("taskId"),

  /** Command that was executed */
  command: text("command").notNull(),

  /** Working directory */
  workingDirectory: varchar("workingDirectory", { length: 1024 }),

  /** Command output (stdout) */
  stdout: text("stdout"),

  /** Command error output (stderr) */
  stderr: text("stderr"),

  /** Exit code */
  exitCode: int("exitCode"),

  /** Execution status */
  status: mysqlEnum("status", [
    "pending",
    "approved",
    "rejected",
    "running",
    "completed",
    "failed",
    "timeout",
  ])
    .notNull()
    .default("pending"),

  /** Whether approval was required */
  approvalRequired: int("approvalRequired").notNull().default(0),

  /** Who approved (if approval was required) */
  approvedBy: int("approvedBy"),

  /** Approval timestamp */
  approvedAt: timestamp("approvedAt"),

  /** Duration in milliseconds */
  durationMs: int("durationMs"),

  /** IP address of the client */
  clientIp: varchar("clientIp", { length: 64 }),

  /** User agent/client info */
  clientInfo: varchar("clientInfo", { length: 255 }),

  /** Timestamp */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SshAuditLog = typeof sshAuditLog.$inferSelect;
export type InsertSshAuditLog = typeof sshAuditLog.$inferInsert;

/**
 * Pending Approvals - commands waiting for user approval
 */
export const pendingApprovals = mysqlTable("pendingApprovals", {
  id: int("id").autoincrement().primaryKey(),

  /** User who needs to approve */
  userId: int("userId").notNull(),

  /** Host where command will execute */
  hostId: int("hostId").notNull(),

  /** Related agent task */
  taskId: int("taskId"),

  /** Command awaiting approval */
  command: text("command").notNull(),

  /** Working directory */
  workingDirectory: varchar("workingDirectory", { length: 1024 }),

  /** Why this command requires approval */
  reason: text("reason"),

  /** Risk level assessment */
  riskLevel: mysqlEnum("riskLevel", ["low", "medium", "high", "critical"])
    .notNull()
    .default("medium"),

  /** Approval status */
  status: mysqlEnum("status", [
    "pending",
    "approved",
    "rejected",
    "expired",
    "modified",
  ])
    .notNull()
    .default("pending"),

  /** Modified command (if user edited before approving) */
  modifiedCommand: text("modifiedCommand"),

  /** Rejection reason */
  rejectionReason: text("rejectionReason"),

  /** Expires at (auto-reject after this time) */
  expiresAt: timestamp("expiresAt"),

  /** Timestamps */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  resolvedAt: timestamp("resolvedAt"),
});

export type PendingApproval = typeof pendingApprovals.$inferSelect;
export type InsertPendingApproval = typeof pendingApprovals.$inferInsert;

/**
 * Agent Skills - learned patterns and capabilities from task execution
 */
export const agentSkills = mysqlTable("agentSkills", {
  id: int("id").autoincrement().primaryKey(),

  /** User who owns this skill (null = global/system skill) */
  userId: int("userId"),

  /** Skill name */
  name: varchar("name", { length: 255 }).notNull(),

  /** Skill description */
  description: text("description"),

  /** Trigger condition - when to apply this skill */
  triggerCondition: text("triggerCondition").notNull(),

  /** The learned pattern/approach */
  pattern: text("pattern").notNull(),

  /** Example successful applications (JSON array) */
  examples: json("examples").$type<string[]>(),

  /** Known failure cases to avoid (JSON array) */
  failures: json("failures").$type<string[]>(),

  /** Confidence score (0-1) based on success rate */
  confidence: decimal("confidence", { precision: 4, scale: 3 })
    .notNull()
    .default("0.5"),

  /** Number of successful applications */
  successCount: int("successCount").notNull().default(0),

  /** Number of failed applications */
  failureCount: int("failureCount").notNull().default(0),

  /** Category for organization */
  category: varchar("category", { length: 64 }).default("general"),

  /** Tags (JSON array) */
  tags: json("tags").$type<string[]>(),

  /** Whether this skill is active */
  isActive: int("isActive").notNull().default(1),

  /** Source task ID (where this skill was learned) */
  sourceTaskId: int("sourceTaskId"),

  /** Last time this skill was used */
  lastUsedAt: timestamp("lastUsedAt"),

  /** Timestamps */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AgentSkill = typeof agentSkills.$inferSelect;
export type InsertAgentSkill = typeof agentSkills.$inferInsert;

/**
 * Self-Modification Log - history of agent self-modifications
 */
export const selfModificationLog = mysqlTable("selfModificationLog", {
  id: int("id").autoincrement().primaryKey(),

  /** User context */
  userId: int("userId"),

  /** Type of modification */
  modificationType: mysqlEnum("modificationType", [
    "tool_update",
    "prompt_update",
    "skill_add",
    "skill_update",
    "config_change",
    "code_patch",
  ]).notNull(),

  /** Target of modification (file path, skill name, etc.) */
  target: varchar("target", { length: 512 }).notNull(),

  /** Description of the change */
  description: text("description").notNull(),

  /** The actual change (diff, new content, etc.) */
  changeContent: text("changeContent"),

  /** Previous state (for rollback) */
  previousState: text("previousState"),

  /** Reason for modification */
  reason: text("reason"),

  /** Whether modification was successful */
  success: int("success").notNull().default(1),

  /** Error message if failed */
  errorMessage: text("errorMessage"),

  /** Benchmark results before modification */
  benchmarkBefore: json("benchmarkBefore").$type<Record<string, number>>(),

  /** Benchmark results after modification */
  benchmarkAfter: json("benchmarkAfter").$type<Record<string, number>>(),

  /** Whether this modification was rolled back */
  rolledBack: int("rolledBack").notNull().default(0),

  /** Rollback timestamp */
  rolledBackAt: timestamp("rolledBackAt"),

  /** Timestamp */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SelfModificationLog = typeof selfModificationLog.$inferSelect;
export type InsertSelfModificationLog = typeof selfModificationLog.$inferInsert;

// ============================================================================
// PERSISTENT MEMORY SYSTEM
// ============================================================================
// Three types of memory for JARVIS:
// 1. Episodic Memory - Specific experiences and events (what happened)
// 2. Semantic Memory - General knowledge and facts (what is known)
// 3. Procedural Memory - Skills and how-to knowledge (how to do things)
// ============================================================================

/**
 * Episodic Memory - Records of specific experiences and events
 * "I remember when I helped Josh deploy the API server and it failed because..."
 */
export const episodicMemories = mysqlTable("episodicMemories", {
  id: int("id").autoincrement().primaryKey(),

  /** User context (whose experience this is) */
  userId: int("userId"),

  /** Related task ID (if from a task) */
  taskId: int("taskId"),

  /** Memory type/category */
  memoryType: mysqlEnum("memoryType", [
    "task_success", // Successfully completed task
    "task_failure", // Failed task with lessons learned
    "user_preference", // Learned user preference
    "system_discovery", // Discovered something about the system
    "error_resolution", // How an error was resolved
    "optimization", // Performance improvement discovered
    "interaction", // Notable user interaction
  ]).notNull(),

  /** Short title/summary of the memory */
  title: varchar("title", { length: 255 }).notNull(),

  /** Detailed description of what happened */
  description: mediumtext("description").notNull(),

  /** Context: what was the situation? */
  context: mediumtext("context"),

  /** Action: what was done? */
  action: mediumtext("action"),

  /** Outcome: what was the result? */
  outcome: mediumtext("outcome"),

  /** Lessons learned (extracted insights) */
  lessons: json("lessons").$type<string[]>(),

  /** Entities involved (tools, files, services, etc.) */
  entities: json("entities").$type<string[]>(),

  /** Tags for categorization */
  tags: json("tags").$type<string[]>(),

  /** Importance score (0-100, higher = more important) */
  importance: int("importance").notNull().default(50),

  /** Access count (how often this memory is retrieved) */
  accessCount: int("accessCount").notNull().default(0),

  /** Last accessed timestamp */
  lastAccessedAt: timestamp("lastAccessedAt"),

  /** Embedding vector ID (reference to vector store) */
  embeddingId: varchar("embeddingId", { length: 64 }),

  /** Timestamps */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EpisodicMemory = typeof episodicMemories.$inferSelect;
export type InsertEpisodicMemory = typeof episodicMemories.$inferInsert;

/**
 * Semantic Memory - General knowledge and facts
 * "I know that the production server is at 192.168.1.100 and uses PostgreSQL"
 */
export const semanticMemories = mysqlTable("semanticMemories", {
  id: int("id").autoincrement().primaryKey(),

  /** User context (optional - some knowledge is global) */
  userId: int("userId"),

  /** Knowledge category */
  category: mysqlEnum("category", [
    "system_info", // Information about systems/infrastructure
    "user_info", // Information about users/preferences
    "domain_knowledge", // Domain-specific knowledge
    "api_info", // API endpoints, schemas, etc.
    "file_structure", // Project/file organization
    "configuration", // Config values and settings
    "relationship", // Relationships between entities
    "definition", // Definitions and explanations
  ]).notNull(),

  /** Subject/entity this knowledge is about */
  subject: varchar("subject", { length: 255 }).notNull(),

  /** Predicate/relationship type */
  predicate: varchar("predicate", { length: 128 }).notNull(),

  /** Object/value of the knowledge */
  object: text("object").notNull(),

  /** Confidence score (0-100) */
  confidence: int("confidence").notNull().default(80),

  /** Source of this knowledge */
  source: varchar("source", { length: 255 }),

  /** Source task ID (if learned from a task) */
  sourceTaskId: int("sourceTaskId"),

  /** Whether this knowledge is still valid */
  isValid: int("isValid").notNull().default(1),

  /** When this knowledge was last verified */
  lastVerifiedAt: timestamp("lastVerifiedAt"),

  /** Expiration (for time-sensitive knowledge) */
  expiresAt: timestamp("expiresAt"),

  /** Access count */
  accessCount: int("accessCount").notNull().default(0),

  /** Embedding vector ID */
  embeddingId: varchar("embeddingId", { length: 64 }),

  /** Timestamps */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SemanticMemory = typeof semanticMemories.$inferSelect;
export type InsertSemanticMemory = typeof semanticMemories.$inferInsert;

/**
 * Procedural Memory - Skills and how-to knowledge
 * "I know how to deploy a Node.js app: first check dependencies, then..."
 */
export const proceduralMemories = mysqlTable("proceduralMemories", {
  id: int("id").autoincrement().primaryKey(),

  /** User context (optional) */
  userId: int("userId"),

  /** Procedure name/title */
  name: varchar("name", { length: 255 }).notNull(),

  /** Description of what this procedure does */
  description: text("description").notNull(),

  /** Trigger conditions (when to use this procedure) */
  triggerConditions: json("triggerConditions").$type<string[]>(),

  /** Prerequisites (what must be true before starting) */
  prerequisites: json("prerequisites").$type<string[]>(),

  /** Steps in the procedure (ordered) */
  steps: json("steps")
    .$type<
      Array<{
        order: number;
        action: string;
        description: string;
        toolName?: string;
        expectedOutcome?: string;
        errorHandling?: string;
      }>
    >()
    .notNull(),

  /** Post-conditions (what should be true after) */
  postConditions: json("postConditions").$type<string[]>(),

  /** Common errors and how to handle them */
  errorHandlers: json("errorHandlers").$type<
    Array<{
      errorPattern: string;
      solution: string;
    }>
  >(),

  /** Success rate (0-100) */
  successRate: int("successRate").notNull().default(100),

  /** Times this procedure has been executed */
  executionCount: int("executionCount").notNull().default(0),

  /** Times this procedure succeeded */
  successCount: int("successCount").notNull().default(0),

  /** Average execution time in ms */
  avgExecutionTimeMs: int("avgExecutionTimeMs"),

  /** Related procedures (alternatives or follow-ups) */
  relatedProcedures: json("relatedProcedures").$type<number[]>(),

  /** Source task ID (where this was learned) */
  sourceTaskId: int("sourceTaskId"),

  /** Whether this procedure is active */
  isActive: int("isActive").notNull().default(1),

  /** Embedding vector ID */
  embeddingId: varchar("embeddingId", { length: 64 }),

  /** Timestamps */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProceduralMemory = typeof proceduralMemories.$inferSelect;
export type InsertProceduralMemory = typeof proceduralMemories.$inferInsert;

/**
 * Memory Embeddings - Vector embeddings for semantic search
 * Stored separately for efficient vector operations
 */
export const memoryEmbeddings = mysqlTable("memoryEmbeddings", {
  id: varchar("id", { length: 64 }).primaryKey(),

  /** Memory type reference */
  memoryType: mysqlEnum("memoryType", [
    "episodic",
    "semantic",
    "procedural",
  ]).notNull(),

  /** Memory ID in the respective table */
  memoryId: int("memoryId").notNull(),

  /** The text that was embedded */
  sourceText: text("sourceText").notNull(),

  /** Embedding model used */
  model: varchar("model", { length: 128 }).notNull(),

  /** Embedding dimensions */
  dimensions: int("dimensions").notNull(),

  /** The embedding vector (stored as JSON array of floats) */
  vector: json("vector").$type<number[]>().notNull(),

  /** Timestamp */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MemoryEmbedding = typeof memoryEmbeddings.$inferSelect;
export type InsertMemoryEmbedding = typeof memoryEmbeddings.$inferInsert;

/**
 * Memory Access Log - Track memory retrieval patterns
 * Used for optimizing memory retrieval and importance scoring
 */
export const memoryAccessLog = mysqlTable("memoryAccessLog", {
  id: int("id").autoincrement().primaryKey(),

  /** Memory type */
  memoryType: mysqlEnum("memoryType", [
    "episodic",
    "semantic",
    "procedural",
  ]).notNull(),

  /** Memory ID */
  memoryId: int("memoryId").notNull(),

  /** Task ID that accessed this memory */
  taskId: int("taskId"),

  /** Query that triggered retrieval */
  query: text("query"),

  /** Relevance score from retrieval */
  relevanceScore: decimal("relevanceScore", { precision: 5, scale: 4 }),

  /** Whether the memory was actually useful */
  wasUseful: int("wasUseful"),

  /** Timestamp */
  accessedAt: timestamp("accessedAt").defaultNow().notNull(),
});

export type MemoryAccessLog = typeof memoryAccessLog.$inferSelect;
export type InsertMemoryAccessLog = typeof memoryAccessLog.$inferInsert;

/**
 * Learning Events - Track what JARVIS learns over time
 * Used for the self-improvement pipeline
 */
export const learningEvents = mysqlTable("learningEvents", {
  id: int("id").autoincrement().primaryKey(),

  /** User context */
  userId: int("userId"),

  /** Source task ID */
  taskId: int("taskId"),

  /** Type of learning event */
  eventType: mysqlEnum("eventType", [
    "new_knowledge", // Learned new fact
    "skill_acquired", // Learned new skill/procedure
    "skill_improved", // Improved existing skill
    "error_learned", // Learned from error
    "preference_learned", // Learned user preference
    "pattern_detected", // Detected recurring pattern
    "feedback_received", // Received user feedback
  ]).notNull(),

  /** What was learned (summary) */
  summary: text("summary").notNull(),

  /** Detailed learning content */
  content: json("content").$type<Record<string, unknown>>(),

  /** Confidence in the learning (0-100) */
  confidence: int("confidence").notNull().default(70),

  /** Whether this learning has been applied */
  applied: int("applied").notNull().default(0),

  /** Impact score after application (0-100) */
  impactScore: int("impactScore"),

  /** Timestamp */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LearningEvent = typeof learningEvents.$inferSelect;
export type InsertLearningEvent = typeof learningEvents.$inferInsert;

/**
 * Training Data - Collected data for fine-tuning
 * Stores successful task traces for model improvement
 */
export const trainingData = mysqlTable("trainingData", {
  id: int("id").autoincrement().primaryKey(),

  /** Source task ID */
  taskId: int("taskId").notNull(),

  /** Data type */
  dataType: mysqlEnum("dataType", [
    "conversation", // Full conversation trace
    "tool_usage", // Tool call examples
    "reasoning", // Reasoning/thinking examples
    "code_generation", // Code generation examples
    "error_recovery", // Error handling examples
  ]).notNull(),

  /** Input (prompt/context) - can be large prompts */
  input: mediumtext("input").notNull(),

  /** Output (response/action) - can be large tool outputs */
  output: mediumtext("output").notNull(),

  /** Quality score (0-100) */
  qualityScore: int("qualityScore").notNull().default(80),

  /** Whether this has been used for training */
  usedForTraining: int("usedForTraining").notNull().default(0),

  /** Training run ID (if used) */
  trainingRunId: varchar("trainingRunId", { length: 64 }),

  /** Metadata */
  metadata: json("metadata").$type<Record<string, unknown>>(),

  /** Timestamp */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TrainingData = typeof trainingData.$inferSelect;
export type InsertTrainingData = typeof trainingData.$inferInsert;

// ============================================================================
// INFRASTRUCTURE MONITORING & SELF-HEALING SYSTEM
// ============================================================================

/**
 * Servers/hosts to monitor
 */
export const infrastructureHosts = mysqlTable("infrastructureHosts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  hostname: varchar("hostname", { length: 255 }).notNull(),
  port: int("port").default(22),
  description: text("description"),
  hostType: mysqlEnum("hostType", [
    "server",
    "container",
    "vm",
    "cloud",
  ]).default("server"),
  status: mysqlEnum("status", [
    "online",
    "offline",
    "degraded",
    "unknown",
  ]).default("unknown"),
  sshHostId: int("sshHostId"), // Link to SSH hosts for access
  lastSeen: timestamp("lastSeen"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type InfrastructureHost = typeof infrastructureHosts.$inferSelect;
export type InsertInfrastructureHost = typeof infrastructureHosts.$inferInsert;

/**
 * Health metrics snapshots
 */
export const healthMetrics = mysqlTable("healthMetrics", {
  id: int("id").autoincrement().primaryKey(),
  hostId: int("hostId").notNull(),

  // CPU metrics
  cpuUsagePercent: decimal("cpuUsagePercent", { precision: 5, scale: 2 }),
  cpuLoadAvg1m: decimal("cpuLoadAvg1m", { precision: 6, scale: 2 }),
  cpuLoadAvg5m: decimal("cpuLoadAvg5m", { precision: 6, scale: 2 }),
  cpuLoadAvg15m: decimal("cpuLoadAvg15m", { precision: 6, scale: 2 }),

  // Memory metrics
  memoryTotalMb: int("memoryTotalMb"),
  memoryUsedMb: int("memoryUsedMb"),
  memoryUsagePercent: decimal("memoryUsagePercent", { precision: 5, scale: 2 }),
  swapTotalMb: int("swapTotalMb"),
  swapUsedMb: int("swapUsedMb"),

  // Disk metrics
  diskTotalGb: int("diskTotalGb"),
  diskUsedGb: int("diskUsedGb"),
  diskUsagePercent: decimal("diskUsagePercent", { precision: 5, scale: 2 }),
  diskIoReadMbps: decimal("diskIoReadMbps", { precision: 8, scale: 2 }),
  diskIoWriteMbps: decimal("diskIoWriteMbps", { precision: 8, scale: 2 }),

  // Network metrics
  networkRxMbps: decimal("networkRxMbps", { precision: 8, scale: 2 }),
  networkTxMbps: decimal("networkTxMbps", { precision: 8, scale: 2 }),
  networkConnections: int("networkConnections"),

  // GPU metrics (for ML servers)
  gpuCount: int("gpuCount"),
  gpuUtilizationPercent: decimal("gpuUtilizationPercent", {
    precision: 5,
    scale: 2,
  }),
  gpuMemoryUsedMb: int("gpuMemoryUsedMb"),
  gpuMemoryTotalMb: int("gpuMemoryTotalMb"),
  gpuTemperatureC: int("gpuTemperatureC"),
  gpuPowerWatts: int("gpuPowerWatts"),

  // Process metrics
  processCount: int("processCount"),
  zombieProcesses: int("zombieProcesses"),

  // System info
  uptimeSeconds: bigint("uptimeSeconds", { mode: "number" }),

  collectedAt: timestamp("collectedAt").defaultNow().notNull(),
});

export type HealthMetric = typeof healthMetrics.$inferSelect;
export type InsertHealthMetric = typeof healthMetrics.$inferInsert;

/**
 * Alert rules and thresholds
 */
export const alertRules = mysqlTable("alertRules", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  hostId: int("hostId"), // null = applies to all hosts
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),

  // What to monitor
  metric: varchar("metric", { length: 50 }).notNull(), // e.g., "cpuUsagePercent", "diskUsagePercent"

  // Condition
  operator: mysqlEnum("operator", [
    "gt",
    "gte",
    "lt",
    "lte",
    "eq",
    "neq",
  ]).notNull(),
  threshold: decimal("threshold", { precision: 10, scale: 2 }).notNull(),

  // How long condition must persist before alerting
  durationSeconds: int("durationSeconds").default(60),

  // Severity
  severity: mysqlEnum("severity", ["info", "warning", "critical"]).default(
    "warning"
  ),

  // Actions
  autoRemediate: int("autoRemediate").default(0), // boolean
  remediationId: int("remediationId"), // Link to remediation to try
  notifyOwner: int("notifyOwner").default(1), // boolean

  isEnabled: int("isEnabled").default(1), // boolean
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AlertRule = typeof alertRules.$inferSelect;
export type InsertAlertRule = typeof alertRules.$inferInsert;

/**
 * Detected incidents
 */
export const incidents = mysqlTable("incidents", {
  id: int("id").autoincrement().primaryKey(),
  hostId: int("hostId").notNull(),
  alertRuleId: int("alertRuleId"),

  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),

  severity: mysqlEnum("severity", ["info", "warning", "critical"]).default(
    "warning"
  ),
  status: mysqlEnum("status", [
    "open",
    "acknowledged",
    "investigating",
    "resolved",
    "closed",
  ]).default("open"),

  // Metrics at time of incident
  metricName: varchar("metricName", { length: 50 }),
  metricValue: decimal("metricValue", { precision: 10, scale: 2 }),
  thresholdValue: decimal("thresholdValue", { precision: 10, scale: 2 }),

  // Resolution
  resolvedAt: timestamp("resolvedAt"),
  resolvedBy: varchar("resolvedBy", { length: 50 }), // "auto", "manual", "user"
  resolutionNotes: text("resolutionNotes"),

  // Timing
  detectedAt: timestamp("detectedAt").defaultNow().notNull(),
  acknowledgedAt: timestamp("acknowledgedAt"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Incident = typeof incidents.$inferSelect;
export type InsertIncident = typeof incidents.$inferInsert;

/**
 * Known remediations (fixes for common issues)
 */
export const remediations = mysqlTable("remediations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),

  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),

  // What issue this fixes
  targetMetric: varchar("targetMetric", { length: 50 }),
  targetCondition: text("targetCondition"), // JSON description of when to apply

  // The fix
  actionType: mysqlEnum("actionType", [
    "command",
    "script",
    "restart_service",
    "clear_cache",
    "kill_process",
    "custom",
  ]).notNull(),
  actionPayload: text("actionPayload"), // Command or script to run

  // Safety
  requiresApproval: int("requiresApproval").default(1), // boolean
  maxExecutionsPerHour: int("maxExecutionsPerHour").default(3),
  rollbackCommand: text("rollbackCommand"),

  // Stats
  executionCount: int("executionCount").default(0),
  successCount: int("successCount").default(0),
  failureCount: int("failureCount").default(0),

  isEnabled: int("isEnabled").default(1), // boolean
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Remediation = typeof remediations.$inferSelect;
export type InsertRemediation = typeof remediations.$inferInsert;

/**
 * Actions taken on incidents (audit trail)
 */
export const incidentActions = mysqlTable("incidentActions", {
  id: int("id").autoincrement().primaryKey(),
  incidentId: int("incidentId").notNull(),
  remediationId: int("remediationId"),

  actionType: varchar("actionType", { length: 50 }).notNull(), // "remediation", "acknowledge", "escalate", "resolve", "comment"
  actionBy: varchar("actionBy", { length: 50 }).notNull(), // "system", "jarvis", "user:123"

  description: text("description"),
  command: text("command"), // If a command was run
  output: text("output"), // Command output

  success: int("success"), // boolean, null if not applicable
  errorMessage: text("errorMessage"),

  executedAt: timestamp("executedAt").defaultNow().notNull(),
});

export type IncidentAction = typeof incidentActions.$inferSelect;
export type InsertIncidentAction = typeof incidentActions.$inferInsert;

// ============================================================================
// MULTI-AGENT ORCHESTRATION SYSTEM
// ============================================================================

/**
 * Agent instances
 */
export const agents = mysqlTable("agents", {
  id: int("id").autoincrement().primaryKey(),
  parentAgentId: int("parentAgentId"), // null for root agents (JARVIS)
  taskId: int("taskId"), // Link to agent task
  userId: int("userId").notNull(),

  name: varchar("name", { length: 100 }).notNull(),
  agentType: mysqlEnum("agentType", [
    "orchestrator",
    "coordinator",
    "specialist",
    "worker",
    "code",
    "research",
    "sysadmin",
    "data",
    "custom",
  ]).default("orchestrator"),

  status: mysqlEnum("status", [
    "idle",
    "thinking",
    "executing",
    "waiting",
    "completed",
    "failed",
    "terminated",
  ]).default("idle"),

  // Agent configuration
  systemPrompt: text("systemPrompt"),
  capabilities:
    json("capabilities").$type<Record<string, boolean | string[]>>(), // Agent capabilities

  // State
  currentGoal: text("currentGoal"),
  context: json("context").$type<Record<string, unknown>>(),

  // Stats
  messagesProcessed: int("messagesProcessed").default(0),
  toolCallsMade: int("toolCallsMade").default(0),
  tokensUsed: int("tokensUsed").default(0),

  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Agent = typeof agents.$inferSelect;
export type InsertAgent = typeof agents.$inferInsert;

/**
 * Inter-agent messages (for multi-agent communication)
 */
export const interAgentMessages = mysqlTable("interAgentMessages", {
  id: int("id").autoincrement().primaryKey(),
  fromAgentId: int("fromAgentId").notNull(),
  toAgentId: int("toAgentId").notNull(),

  messageType: mysqlEnum("messageType", [
    "task",
    "result",
    "query",
    "response",
    "status",
    "error",
  ]).notNull(),

  content: text("content").notNull(),
  metadata: json("metadata").$type<Record<string, unknown>>(),

  // For task delegation
  taskDescription: text("taskDescription"),
  taskPriority: mysqlEnum("taskPriority", [
    "low",
    "normal",
    "high",
    "urgent",
  ]).default("normal"),

  isRead: int("isRead").default(0), // boolean
  readAt: timestamp("readAt"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InterAgentMessage = typeof interAgentMessages.$inferSelect;
export type InsertInterAgentMessage = typeof interAgentMessages.$inferInsert;

/**
 * Delegated subtasks
 */
export const agentSubtasks = mysqlTable("agentSubtasks", {
  id: int("id").autoincrement().primaryKey(),
  parentTaskId: int("parentTaskId").notNull(),
  assignedAgentId: int("assignedAgentId").notNull(),
  createdByAgentId: int("createdByAgentId").notNull(),

  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),

  status: mysqlEnum("status", [
    "pending",
    "assigned",
    "in_progress",
    "completed",
    "failed",
    "cancelled",
  ]).default("pending"),
  priority: mysqlEnum("priority", ["low", "normal", "high", "urgent"]).default(
    "normal"
  ),

  // Input/output
  input: json("input").$type<Record<string, unknown>>(),
  output: json("output").$type<Record<string, unknown>>(),

  // Dependencies
  dependsOn: json("dependsOn").$type<number[]>(), // IDs of subtasks this depends on

  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AgentSubtask = typeof agentSubtasks.$inferSelect;
export type InsertAgentSubtask = typeof agentSubtasks.$inferInsert;

// ============================================================================
// RAG PIPELINE FOR CODEBASE UNDERSTANDING
// ============================================================================

/**
 * Indexed codebase projects
 */
export const codebaseProjects = mysqlTable("codebaseProjects", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),

  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),

  // Source
  sourceType: mysqlEnum("sourceType", [
    "local",
    "github",
    "gitlab",
    "ssh",
  ]).default("local"),
  sourcePath: text("sourcePath").notNull(), // Local path or repo URL
  branch: varchar("branch", { length: 100 }).default("main"),

  // Indexing config
  includePatterns: json("includePatterns").$type<string[]>(), // Glob patterns to include
  excludePatterns: json("excludePatterns").$type<string[]>(), // Glob patterns to exclude

  // Stats
  totalFiles: int("totalFiles").default(0),
  totalChunks: int("totalChunks").default(0),
  totalSymbols: int("totalSymbols").default(0),
  indexSizeBytes: bigint("indexSizeBytes", { mode: "number" }).default(0),

  // Status
  status: mysqlEnum("status", [
    "pending",
    "indexing",
    "ready",
    "error",
    "stale",
  ]).default("pending"),
  lastIndexedAt: timestamp("lastIndexedAt"),
  lastError: text("lastError"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CodebaseProject = typeof codebaseProjects.$inferSelect;
export type InsertCodebaseProject = typeof codebaseProjects.$inferInsert;

/**
 * Code chunks with embeddings
 */
export const codeChunks = mysqlTable("codeChunks", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),

  filePath: text("filePath").notNull(),
  language: varchar("language", { length: 50 }),

  // Chunk content
  content: text("content").notNull(),
  startLine: int("startLine").notNull(),
  endLine: int("endLine").notNull(),

  // Chunk type
  chunkType: mysqlEnum("chunkType", [
    "function",
    "class",
    "method",
    "module",
    "comment",
    "other",
  ]).default("other"),
  symbolName: varchar("symbolName", { length: 255 }), // Function/class name if applicable

  // Embedding
  embedding: json("embedding").$type<number[]>(),
  embeddingModel: varchar("embeddingModel", { length: 50 }),

  // Metadata
  hash: varchar("hash", { length: 64 }), // For change detection

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CodeChunk = typeof codeChunks.$inferSelect;
export type InsertCodeChunk = typeof codeChunks.$inferInsert;

/**
 * Code relationships (imports, calls, inheritance)
 */
export const codeRelationships = mysqlTable("codeRelationships", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),

  sourceChunkId: int("sourceChunkId").notNull(),
  targetChunkId: int("targetChunkId"),
  targetSymbol: varchar("targetSymbol", { length: 255 }), // If target is external

  relationshipType: mysqlEnum("relationshipType", [
    "imports",
    "calls",
    "extends",
    "implements",
    "uses",
    "defines",
  ]).notNull(),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CodeRelationship = typeof codeRelationships.$inferSelect;
export type InsertCodeRelationship = typeof codeRelationships.$inferInsert;

/**
 * Code symbols index
 */
export const codeSymbols = mysqlTable("codeSymbols", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  chunkId: int("chunkId").notNull(),

  name: varchar("name", { length: 255 }).notNull(),
  fullyQualifiedName: text("fullyQualifiedName"),

  symbolType: mysqlEnum("symbolType", [
    "function",
    "class",
    "method",
    "variable",
    "constant",
    "interface",
    "type",
    "enum",
    "module",
  ]).notNull(),

  signature: text("signature"), // Function signature, type definition, etc.
  docstring: text("docstring"),

  filePath: text("filePath").notNull(),
  line: int("line").notNull(),

  isExported: int("isExported").default(0), // boolean

  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CodeSymbol = typeof codeSymbols.$inferSelect;
export type InsertCodeSymbol = typeof codeSymbols.$inferInsert;

// ============================================================================
// WEBHOOK & EVENT SYSTEM
// ============================================================================

/**
 * Registered webhook endpoints
 */
export const webhookEndpoints = mysqlTable("webhookEndpoints", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),

  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),

  // Endpoint config
  path: varchar("path", { length: 255 }).notNull().unique(), // e.g., "/webhooks/github-abc123"
  secret: varchar("secret", { length: 255 }), // For signature verification

  // Source
  sourceType: mysqlEnum("sourceType", [
    "github",
    "gitlab",
    "custom",
    "monitoring",
  ]).default("custom"),

  // Stats
  totalReceived: int("totalReceived").default(0),
  lastReceivedAt: timestamp("lastReceivedAt"),

  isEnabled: int("isEnabled").default(1), // boolean
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WebhookEndpoint = typeof webhookEndpoints.$inferSelect;
export type InsertWebhookEndpoint = typeof webhookEndpoints.$inferInsert;

/**
 * Event triggers (conditions that fire events)
 */
export const eventTriggers = mysqlTable("eventTriggers", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  webhookEndpointId: int("webhookEndpointId"), // null for non-webhook triggers

  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),

  // Trigger type
  triggerType: mysqlEnum("triggerType", [
    "webhook",
    "schedule",
    "alert",
    "manual",
  ]).notNull(),

  // Condition (JSON path matching, regex, etc.)
  conditionType: mysqlEnum("conditionType", [
    "always",
    "json_match",
    "regex",
    "expression",
  ]).default("always"),
  conditionConfig: json("conditionConfig").$type<Record<string, unknown>>(),

  // For scheduled triggers
  cronExpression: varchar("cronExpression", { length: 100 }),

  isEnabled: int("isEnabled").default(1), // boolean
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EventTrigger = typeof eventTriggers.$inferSelect;
export type InsertEventTrigger = typeof eventTriggers.$inferInsert;

/**
 * Actions to take when events fire
 */
export const eventActions = mysqlTable("eventActions", {
  id: int("id").autoincrement().primaryKey(),
  triggerId: int("triggerId").notNull(),

  name: varchar("name", { length: 100 }).notNull(),

  // Action type
  actionType: mysqlEnum("actionType", [
    "jarvis_task",
    "notification",
    "webhook",
    "command",
    "chain_event",
  ]).notNull(),

  // Action config
  actionConfig: json("actionConfig").$type<Record<string, unknown>>().notNull(),
  // For jarvis_task: { prompt: string }
  // For notification: { title: string, message: string }
  // For webhook: { url: string, method: string, headers: object }
  // For command: { command: string, hostId: number }
  // For chain_event: { triggerId: number }

  // Execution order
  executionOrder: int("executionOrder").default(0),

  // Retry config
  maxRetries: int("maxRetries").default(3),
  retryDelaySeconds: int("retryDelaySeconds").default(60),

  isEnabled: int("isEnabled").default(1), // boolean
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EventAction = typeof eventActions.$inferSelect;
export type InsertEventAction = typeof eventActions.$inferInsert;

/**
 * Event execution log
 */
export const eventLog = mysqlTable("eventLog", {
  id: int("id").autoincrement().primaryKey(),
  triggerId: int("triggerId").notNull(),
  actionId: int("actionId"),
  webhookEndpointId: int("webhookEndpointId"),

  eventType: varchar("eventType", { length: 50 }).notNull(), // "trigger_fired", "action_executed", "action_failed"

  // Payload that triggered the event
  payload: json("payload").$type<Record<string, unknown>>(),

  // Result
  success: int("success"), // boolean
  result: json("result").$type<Record<string, unknown>>(),
  errorMessage: text("errorMessage"),

  // Timing
  executionTimeMs: int("executionTimeMs"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EventLogEntry = typeof eventLog.$inferSelect;
export type InsertEventLogEntry = typeof eventLog.$inferInsert;

/**
 * Event-triggered scheduled tasks (cron jobs linked to event triggers)
 * Note: For JARVIS scheduled tasks, use the existing scheduledTasks table above.
 * This table is specifically for event system cron triggers.
 */
export const eventCronJobs = mysqlTable("eventCronJobs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  triggerId: int("triggerId").notNull(),

  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),

  cronExpression: varchar("cronExpression", { length: 100 }).notNull(),
  timezone: varchar("timezone", { length: 50 }).default("UTC"),

  // Execution tracking
  lastRunAt: timestamp("lastRunAt"),
  nextRunAt: timestamp("nextRunAt"),
  lastRunSuccess: int("lastRunSuccess"), // boolean
  lastRunError: text("lastRunError"),

  // Stats
  totalRuns: int("totalRuns").default(0),
  successfulRuns: int("successfulRuns").default(0),
  failedRuns: int("failedRuns").default(0),

  isEnabled: int("isEnabled").default(1), // boolean
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EventCronJob = typeof eventCronJobs.$inferSelect;
export type InsertEventCronJob = typeof eventCronJobs.$inferInsert;

// ============================================================================
// WEB APP DEVELOPMENT SYSTEM
// ============================================================================

/**
 * Web App Projects - Track AI-generated web applications
 */
export const webAppProjects = mysqlTable("webAppProjects", {
  id: int("id").autoincrement().primaryKey(),

  /** User who owns this project */
  userId: int("userId").notNull(),

  /** Project name */
  name: varchar("name", { length: 255 }).notNull(),

  /** Project description */
  description: text("description"),

  /** Project type (React, Next.js, Vue, Svelte, etc.) */
  type: mysqlEnum("type", [
    "react",
    "nextjs",
    "vue",
    "svelte",
    "express",
    "fastapi",
    "rails",
  ]).notNull(),

  /** GitHub repository URL */
  repositoryUrl: varchar("repositoryUrl", { length: 512 }),

  /** Deployment URL (Vercel, Railway, etc.) */
  deploymentUrl: varchar("deploymentUrl", { length: 512 }),

  /** Project status */
  status: mysqlEnum("status", [
    "scaffolding",
    "developing",
    "testing",
    "deployed",
    "archived",
  ])
    .notNull()
    .default("scaffolding"),

  /** Technology stack (JSON) */
  stack: json("stack").$type<string[]>(),

  /** Database type */
  database: varchar("database", { length: 64 }),

  /** Authentication method */
  authentication: varchar("authentication", { length: 64 }),

  /** Features implemented (JSON array) */
  features: json("features").$type<string[]>(),

  /** Deployment platform */
  deploymentPlatform: varchar("deploymentPlatform", { length: 64 }),

  /** Environment variables (encrypted) */
  envVariables: text("envVariables"),

  /** Total lines of code */
  totalLoc: int("totalLoc").notNull().default(0),

  /** Test coverage percentage */
  testCoverage: int("testCoverage").notNull().default(0),

  /** Last deployment timestamp */
  lastDeployedAt: timestamp("lastDeployedAt"),

  /** Timestamps */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WebAppProject = typeof webAppProjects.$inferSelect;
export type InsertWebAppProject = typeof webAppProjects.$inferInsert;

/**
 * App Iterations - Track changes and improvements to web apps
 */
export const appIterations = mysqlTable("appIterations", {
  id: int("id").autoincrement().primaryKey(),

  /** Parent project */
  projectId: int("projectId").notNull(),

  /** Iteration number */
  iterationNumber: int("iterationNumber").notNull(),

  /** User request that triggered this iteration */
  userRequest: text("userRequest").notNull(),

  /** AI-generated plan for changes */
  plan: text("plan"),

  /** Changes made (JSON diff) */
  changes: json("changes").$type<Record<string, unknown>>(),

  /** Files modified (JSON array of file paths) */
  filesModified: json("filesModified").$type<string[]>(),

  /** Commit hash (if pushed to git) */
  commitHash: varchar("commitHash", { length: 64 }),

  /** Test results (JSON) */
  testResults: json("testResults").$type<Record<string, unknown>>(),

  /** Whether tests passed */
  testsPassed: int("testsPassed").notNull().default(0),

  /** Deployment status */
  deploymentStatus: mysqlEnum("deploymentStatus", [
    "pending",
    "deploying",
    "deployed",
    "failed",
  ]).notNull(),

  /** Deployment error message */
  deploymentError: text("deploymentError"),

  /** Deployment timestamp */
  deployedAt: timestamp("deployedAt"),

  /** Whether this iteration was rolled back */
  rolledBack: int("rolledBack").notNull().default(0),

  /** Timestamps */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type AppIteration = typeof appIterations.$inferSelect;
export type InsertAppIteration = typeof appIterations.$inferInsert;

/**
 * Code Generation History - Track AI code generation for analysis
 */
export const codeGenerationHistory = mysqlTable("codeGenerationHistory", {
  id: int("id").autoincrement().primaryKey(),

  /** Related app project */
  projectId: int("projectId"),

  /** Related task */
  taskId: int("taskId"),

  /** File path that was generated */
  filePath: varchar("filePath", { length: 512 }).notNull(),

  /** AI model used for generation */
  model: varchar("model", { length: 128 }).notNull(),

  /** Original prompt/request */
  prompt: text("prompt").notNull(),

  /** Generated code */
  generatedCode: text("generatedCode").notNull(),

  /** Whether code was accepted/deployed */
  accepted: int("accepted").notNull().default(0),

  /** User feedback */
  feedback: text("feedback"),

  /** Test results for this code */
  testResults: json("testResults").$type<Record<string, unknown>>(),

  /** Performance metrics */
  metrics: json("metrics").$type<Record<string, number>>(),

  /** Timestamps */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CodeGenerationHistory = typeof codeGenerationHistory.$inferSelect;
export type InsertCodeGenerationHistory =
  typeof codeGenerationHistory.$inferInsert;

/**
 * Knowledge Cache - Cache search results and web data for faster retrieval
 */
export const knowledgeCache = mysqlTable("knowledgeCache", {
  id: int("id").autoincrement().primaryKey(),

  userId: int("userId"),

  cacheKey: varchar("cacheKey", { length: 255 }).notNull(),

  query: text("query").notNull(),

  source: mysqlEnum("source", [
    "web_search",
    "searxng",
    "browse",
    "api",
    "documentation",
    "llm_response",
  ]).notNull(),

  content: text("content").notNull(),

  metadata: json("metadata").$type<Record<string, unknown>>(),

  embedding: json("embedding").$type<number[]>(),

  hitCount: int("hitCount").notNull().default(0),

  expiresAt: timestamp("expiresAt"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  lastAccessedAt: timestamp("lastAccessedAt").defaultNow().notNull(),
});

export type KnowledgeCache = typeof knowledgeCache.$inferSelect;
export type InsertKnowledgeCache = typeof knowledgeCache.$inferInsert;

/**
 * Async Task Queue - Background tasks that survive session disconnects and server restarts
 */
export const asyncTaskQueue = mysqlTable("asyncTaskQueue", {
  id: int("id").autoincrement().primaryKey(),

  userId: int("userId").notNull(),

  taskType: mysqlEnum("taskType", [
    "jarvis_task",
    "agent_team",
    "deep_research",
    "code_generation",
    "document_generation",
    "scheduled_task",
    "webhook_task",
    "custom",
  ]).notNull(),

  status: mysqlEnum("status", [
    "queued",
    "running",
    "completed",
    "failed",
    "cancelled",
    "paused",
  ])
    .notNull()
    .default("queued"),

  priority: int("priority").notNull().default(5),

  prompt: text("prompt").notNull(),

  input: json("input").$type<Record<string, unknown>>(),

  result: text("result"),

  error: text("error"),

  progress: int("progress").notNull().default(0),

  progressMessage: varchar("progressMessage", { length: 500 }),

  retryCount: int("retryCount").notNull().default(0),

  maxRetries: int("maxRetries").notNull().default(3),

  webhookUrl: varchar("webhookUrl", { length: 1000 }),

  webhookDelivered: boolean("webhookDelivered").default(false),

  webhookDeliveredAt: timestamp("webhookDeliveredAt"),

  workerId: varchar("workerId", { length: 100 }),

  startedAt: timestamp("startedAt"),

  completedAt: timestamp("completedAt"),

  estimatedDurationMs: int("estimatedDurationMs"),

  actualDurationMs: int("actualDurationMs"),

  tokensUsed: int("tokensUsed").default(0),

  cost: decimal("cost", { precision: 10, scale: 6 }).default("0"),

  metadata: json("metadata").$type<Record<string, unknown>>(),

  createdAt: timestamp("createdAt").defaultNow().notNull(),

  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),

  scheduledFor: timestamp("scheduledFor"),

  expiresAt: timestamp("expiresAt"),
});

export type AsyncTaskQueue = typeof asyncTaskQueue.$inferSelect;
export type InsertAsyncTaskQueue = typeof asyncTaskQueue.$inferInsert;

/**
 * Async Task Logs - Detailed execution logs for async tasks
 */
export const asyncTaskLogs = mysqlTable("asyncTaskLogs", {
  id: int("id").autoincrement().primaryKey(),

  taskId: int("taskId").notNull(),

  level: mysqlEnum("level", ["debug", "info", "warn", "error"]).notNull(),

  message: text("message").notNull(),

  data: json("data").$type<Record<string, unknown>>(),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AsyncTaskLog = typeof asyncTaskLogs.$inferSelect;
export type InsertAsyncTaskLog = typeof asyncTaskLogs.$inferInsert;

export const dynamicTools = mysqlTable("dynamic_tools", {
  id: int("id").autoincrement().primaryKey(),

  userId: int("user_id").notNull(),

  name: varchar("name", { length: 100 }).notNull(),

  description: text("description").notNull(),

  parameters: json("parameters")
    .$type<
      Record<string, { type: string; description: string; required?: boolean }>
    >()
    .notNull(),

  implementation: text("implementation").notNull(),

  testCases:
    json("test_cases").$type<
      Array<{ input: Record<string, unknown>; expectedPattern: string }>
    >(),

  isActive: int("is_active").notNull().default(1),

  usageCount: int("usage_count").notNull().default(0),

  lastUsedAt: timestamp("last_used_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type DynamicTool = typeof dynamicTools.$inferSelect;
export type InsertDynamicTool = typeof dynamicTools.$inferInsert;

export const dynamicAgentTypes = mysqlTable("dynamic_agent_types", {
  id: int("id").autoincrement().primaryKey(),

  userId: int("user_id").notNull(),

  typeName: varchar("type_name", { length: 50 }).notNull(),

  displayName: varchar("display_name", { length: 100 }),

  systemPrompt: text("system_prompt").notNull(),

  capabilities: json("capabilities").$type<{
    canBrowse?: boolean;
    canCode?: boolean;
    canSearchWeb?: boolean;
    canUseFiles?: boolean;
    canRunShell?: boolean;
    canSSH?: boolean;
    canManageInfrastructure?: boolean;
    canDelegateToSubAgents?: boolean;
    canLearn?: boolean;
    domains?: string[];
  }>(),

  toolRestrictions: json("tool_restrictions").$type<{
    allowed?: string[];
    forbidden?: string[];
  }>(),

  proposedReason: text("proposed_reason"),

  triggerPatterns: json("trigger_patterns").$type<string[]>(),

  usageCount: int("usage_count").notNull().default(0),

  successRate: decimal("success_rate", { precision: 5, scale: 2 }),

  isActive: int("is_active").notNull().default(1),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type DynamicAgentType = typeof dynamicAgentTypes.$inferSelect;
export type InsertDynamicAgentType = typeof dynamicAgentTypes.$inferInsert;

export const jarvisEventLog = mysqlTable("jarvisEventLog", {
  id: int("id").autoincrement().primaryKey(),

  eventId: varchar("eventId", { length: 32 }).notNull().unique(),

  userId: int("userId").notNull(),

  sessionId: varchar("sessionId", { length: 64 }).notNull(),

  taskId: int("taskId").notNull(),

  seq: int("seq").notNull(),

  jarvisEventType: mysqlEnum("jarvisEventType", [
    "OBSERVATION",
    "PLAN",
    "TOOL_CALL",
    "ACTION",
    "VERIFICATION",
    "FEEDBACK",
    "ERROR",
    "TASK_START",
    "TASK_END",
    "STATE_UPDATE",
    "PLAN_PROPOSED",
    "ACTION_PROPOSED",
    "ACTION_RESULT",
    "CONTROL_CMD",
  ]).notNull(),

  payload: json("payload").$type<Record<string, unknown>>().notNull(),

  prevHash: varchar("prevHash", { length: 64 }),

  hash: varchar("hash", { length: 64 }).notNull(),

  blobRefs: json("blobRefs").$type<string[]>(),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type JarvisEventLog = typeof jarvisEventLog.$inferSelect;
export type InsertJarvisEventLog = typeof jarvisEventLog.$inferInsert;

export const actionDSLLog = mysqlTable("actionDSLLog", {
  id: int("id").autoincrement().primaryKey(),

  actionId: varchar("actionId", { length: 32 }).notNull().unique(),

  taskId: int("taskId").notNull(),

  userId: int("userId").notNull(),

  sessionId: varchar("sessionId", { length: 64 }).notNull(),

  actionType: varchar("actionType", { length: 64 }).notNull(),

  argsJson: json("argsJson").$type<Record<string, unknown>>().notNull(),

  idempotencyKey: varchar("idempotencyKey", { length: 64 }),

  preStateHash: varchar("preStateHash", { length: 64 }),

  postStateHash: varchar("postStateHash", { length: 64 }),

  status: mysqlEnum("status", [
    "pending",
    "executing",
    "completed",
    "failed",
    "cancelled",
  ])
    .notNull()
    .default("pending"),

  result: json("result").$type<Record<string, unknown>>(),

  errorMessage: text("errorMessage"),

  durationMs: int("durationMs"),

  screenshotPreRef: varchar("screenshotPreRef", { length: 128 }),

  screenshotPostRef: varchar("screenshotPostRef", { length: 128 }),

  createdAt: timestamp("createdAt").defaultNow().notNull(),

  completedAt: timestamp("completedAt"),
});

export type ActionDSLLog = typeof actionDSLLog.$inferSelect;
export type InsertActionDSLLog = typeof actionDSLLog.$inferInsert;

export const visionActionSessions = mysqlTable("visionActionSessions", {
  id: int("id").autoincrement().primaryKey(),

  sessionId: varchar("sessionId", { length: 64 }).notNull().unique(),

  taskId: int("taskId").notNull(),

  userId: int("userId").notNull(),

  goal: text("goal").notNull(),

  status: mysqlEnum("status", [
    "running",
    "paused",
    "completed",
    "failed",
    "cancelled",
  ])
    .notNull()
    .default("running"),

  currentPhase: varchar("currentPhase", { length: 32 }),

  stateHash: varchar("stateHash", { length: 64 }),

  iterationCount: int("iterationCount").notNull().default(0),

  actionCount: int("actionCount").notNull().default(0),

  vlmCallCount: int("vlmCallCount").notNull().default(0),

  repeatStateCount: int("repeatStateCount").notNull().default(0),

  lastObservation: json("lastObservation").$type<Record<string, unknown>>(),

  recoveryAttempts: int("recoveryAttempts").notNull().default(0),

  startedAt: timestamp("startedAt").defaultNow().notNull(),

  completedAt: timestamp("completedAt"),

  result: text("result"),

  errorMessage: text("errorMessage"),
});

export type VisionActionSession = typeof visionActionSessions.$inferSelect;
export type InsertVisionActionSession =
  typeof visionActionSessions.$inferInsert;
