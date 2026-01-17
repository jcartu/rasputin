/**
 * JARVIS v3 Core Types
 * Type definitions for the enhanced tool registry and agent swarm system
 */

export type AgentType =
  | "planner"
  | "coder"
  | "executor"
  | "verifier"
  | "researcher"
  | "learner"
  | "safety";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type ToolCategory =
  | "web"
  | "code"
  | "file"
  | "git"
  | "docker"
  | "ssh"
  | "browser"
  | "database"
  | "communication"
  | "research"
  | "document"
  | "image"
  | "audio"
  | "video"
  | "scaffold"
  | "multiagent"
  | "memory"
  | "security"
  | "system"
  | "mcp"
  | "desktop";

export interface ToolParameter {
  type: string;
  description: string;
  required: boolean;
  default?: unknown;
  enum?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, ToolParameter>;
  category?: ToolCategory;
}

export interface JARVISToolMetadata {
  agentAffinity: AgentType[];
  requiresLease: string[];
  riskLevel: RiskLevel;
  estimatedDurationMs: number;
  canParallelize: boolean;
  qdrantCollections: string[];
  category: ToolCategory;
  requiresApproval: boolean;
  maxRetries: number;
  timeoutMs: number;
  fallbackTools?: string[];
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

export interface ExecutionContext {
  sessionId: string;
  userId: number;
  taskId: number;
  params: Record<string, unknown>;
  enrichment?: Record<string, unknown>;
  leaseManager: LeaseManager;
  qdrant: QdrantClient;
  redis: RedisClient;
  startTime: number;
}

export interface LeaseManager {
  acquire(
    resource: string,
    sessionId: string,
    ttlMs?: number
  ): Promise<boolean>;
  release(resource: string, sessionId: string): Promise<void>;
  isHeld(resource: string): Promise<boolean>;
  extend(resource: string, sessionId: string, ttlMs: number): Promise<boolean>;
}

export interface QdrantClient {
  search(
    collection: string,
    query: {
      vector: number[];
      filter?: Record<string, unknown>;
      limit?: number;
    }
  ): Promise<QdrantSearchResult[]>;
  upsert(
    collection: string,
    point: { id: string; vector: number[]; payload: Record<string, unknown> }
  ): Promise<void>;
  delete(collection: string, ids: string[]): Promise<void>;
}

export interface QdrantSearchResult {
  id: string;
  score: number;
  payload: Record<string, unknown>;
}

export interface RedisClient {
  xadd(
    stream: string,
    id: string,
    fields: Record<string, unknown>
  ): Promise<string>;
  xread(
    streams: string[],
    ids: string[],
    options?: { count?: number; block?: number }
  ): Promise<StreamMessage[]>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { ex?: number }): Promise<void>;
  publish(channel: string, message: string): Promise<number>;
}

export interface StreamMessage {
  stream: string;
  id: string;
  fields: Record<string, string>;
}

export interface LearningPayload {
  type: string;
  toolName: string;
  taskContext: string;
  inputSummary: string;
  outputSummary: string;
  success: boolean;
  durationMs: number;
  patterns?: string[];
  insights?: string[];
  timestamp: number;
}

export interface ToolExecutionEvent {
  eventType: "start" | "progress" | "complete" | "error" | "retry";
  toolName: string;
  sessionId: string;
  taskId: number;
  timestamp: number;
  data?: Record<string, unknown>;
}

export interface SwarmTask {
  id: string;
  parentTaskId?: string;
  type:
    | "plan"
    | "code"
    | "execute"
    | "verify"
    | "research"
    | "learn"
    | "safety";
  status:
    | "pending"
    | "claimed"
    | "running"
    | "completed"
    | "failed"
    | "cancelled";
  assignedAgent?: AgentType;
  priority: number;
  payload: Record<string, unknown>;
  dependencies: string[];
  result?: unknown;
  error?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

export interface AgentCapabilities {
  tools: string[];
  maxConcurrentTasks: number;
  specializations: string[];
  canDelegate: boolean;
  requiresHumanApproval: string[];
}

export interface AgentState {
  id: string;
  type: AgentType;
  status: "idle" | "busy" | "paused" | "error";
  currentTask?: string;
  capabilities: AgentCapabilities;
  metrics: AgentMetrics;
  lastHeartbeat: number;
}

export interface AgentMetrics {
  tasksCompleted: number;
  tasksFailed: number;
  averageDurationMs: number;
  successRate: number;
  lastTaskAt?: number;
}

export interface ConsensusRequest {
  taskId: string;
  question: string;
  participants: AgentType[];
  requiredAgreement: number;
  timeoutMs: number;
}

export interface ConsensusVote {
  agentType: AgentType;
  vote: "approve" | "reject" | "abstain";
  confidence: number;
  reasoning: string;
  timestamp: number;
}

export interface ConsensusResult {
  taskId: string;
  decision: "approved" | "rejected" | "timeout" | "insufficient";
  votes: ConsensusVote[];
  agreementPercentage: number;
  timestamp: number;
}

export const DEFAULT_TOOL_METADATA: Partial<JARVISToolMetadata> = {
  agentAffinity: ["executor"],
  requiresLease: [],
  riskLevel: "low",
  estimatedDurationMs: 5000,
  canParallelize: true,
  qdrantCollections: [],
  requiresApproval: false,
  maxRetries: 2,
  timeoutMs: 60000,
};

export const HIGH_RISK_TOOLS = new Set([
  "write_file",
  "execute_shell",
  "execute_python",
  "execute_javascript",
  "run_shell",
  "ssh_execute",
  "ssh_write_file",
  "git_commit",
  "git_push",
  "git_force_push",
  "deploy_vercel",
  "deploy_railway",
  "docker_push",
  "docker_compose",
  "send_email",
  "slack_message",
  "database_query",
  "delete_file",
  "kill_process",
]);

export const CRITICAL_TOOLS = new Set([
  "git_force_push",
  "database_query",
  "kill_process",
  "docker_compose",
  "deploy_vercel",
  "deploy_railway",
]);
