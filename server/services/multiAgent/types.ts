/**
 * Multi-Agent Orchestration System Types
 */

export type AgentType =
  | "orchestrator"
  | "coordinator"
  | "specialist"
  | "worker"
  | "code"
  | "research"
  | "sysadmin"
  | "data"
  | "custom";
export type AgentStatus =
  | "idle"
  | "thinking"
  | "executing"
  | "waiting"
  | "completed"
  | "failed"
  | "terminated";
export type MessageType =
  | "task"
  | "result"
  | "query"
  | "response"
  | "status"
  | "error";
export type TaskPriority = "low" | "normal" | "high" | "urgent";
export type SubtaskStatus =
  | "pending"
  | "assigned"
  | "in_progress"
  | "completed"
  | "failed"
  | "cancelled";

export interface AgentCapabilities {
  canBrowseWeb: boolean;
  canExecuteCode: boolean;
  canAccessFiles: boolean;
  canSSH: boolean;
  canGenerateImages: boolean;
  canSearchWeb: boolean;
  canManageInfrastructure: boolean;
  customTools?: string[];
}

export interface AgentConfig {
  name: string;
  type: AgentType;
  systemPrompt: string;
  capabilities: AgentCapabilities;
  maxConcurrentTasks?: number;
  timeoutMs?: number;
  model?: string;
}

export interface Agent {
  id: number;
  parentAgentId?: number;
  taskId?: number;
  userId: number;
  name: string;
  agentType: AgentType;
  status: AgentStatus;
  systemPrompt?: string;
  capabilities?: AgentCapabilities;
  currentGoal?: string;
  context?: Record<string, unknown>;
  messagesProcessed: number;
  toolCallsMade: number;
  tokensUsed: number;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

export interface AgentMessage {
  id: number;
  fromAgentId: number;
  toAgentId: number;
  messageType: MessageType;
  content: string;
  metadata?: Record<string, unknown>;
  taskDescription?: string;
  taskPriority: TaskPriority;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
}

export interface Subtask {
  id: number;
  parentTaskId: number;
  assignedAgentId: number;
  createdByAgentId: number;
  title: string;
  description?: string;
  status: SubtaskStatus;
  priority: TaskPriority;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  dependsOn?: number[];
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

export interface TaskDelegation {
  subtaskTitle: string;
  description: string;
  targetAgentType: AgentType;
  priority: TaskPriority;
  input: Record<string, unknown>;
  dependsOn?: number[];
}

export interface AgentResult {
  success: boolean;
  output?: unknown;
  error?: string;
  tokensUsed: number;
  executionTimeMs: number;
}

// Predefined agent configurations
export const AGENT_CONFIGS: Record<AgentType, Omit<AgentConfig, "name">> = {
  orchestrator: {
    type: "orchestrator",
    systemPrompt: `You are the Orchestrator Agent, responsible for breaking down complex tasks into subtasks and delegating them to specialized agents. You coordinate work across multiple agents and aggregate their results.

Your responsibilities:
1. Analyze incoming tasks and determine the best approach
2. Break complex tasks into smaller, manageable subtasks
3. Delegate subtasks to the most appropriate specialized agent
4. Monitor progress and handle failures
5. Aggregate results and provide final output

You can delegate to these agent types:
- code: For programming, debugging, and code analysis
- research: For web research, fact-checking, and information gathering
- sysadmin: For system administration, server management, and DevOps
- data: For data analysis, visualization, and processing`,
    capabilities: {
      canBrowseWeb: false,
      canExecuteCode: false,
      canAccessFiles: true,
      canSSH: false,
      canGenerateImages: false,
      canSearchWeb: false,
      canManageInfrastructure: false,
    },
  },
  code: {
    type: "code",
    systemPrompt: `You are the Code Agent, a specialized programming assistant. You excel at:
- Writing clean, efficient code in multiple languages
- Debugging and fixing issues
- Code review and optimization
- Explaining complex code concepts
- Creating tests and documentation

Always provide working code with clear explanations.`,
    capabilities: {
      canBrowseWeb: false,
      canExecuteCode: true,
      canAccessFiles: true,
      canSSH: false,
      canGenerateImages: false,
      canSearchWeb: false,
      canManageInfrastructure: false,
    },
  },
  research: {
    type: "research",
    systemPrompt: `You are the Research Agent, specialized in gathering and synthesizing information. You excel at:
- Web research and fact-checking
- Summarizing complex topics
- Finding relevant sources and citations
- Comparing different perspectives
- Creating comprehensive reports

Always cite your sources and verify information accuracy.`,
    capabilities: {
      canBrowseWeb: true,
      canExecuteCode: false,
      canAccessFiles: true,
      canSSH: false,
      canGenerateImages: false,
      canSearchWeb: true,
      canManageInfrastructure: false,
    },
  },
  sysadmin: {
    type: "sysadmin",
    systemPrompt: `You are the SysAdmin Agent, specialized in system administration and DevOps. You excel at:
- Server configuration and management
- Troubleshooting system issues
- Security hardening
- Deployment automation
- Infrastructure monitoring

Always prioritize security and follow best practices.`,
    capabilities: {
      canBrowseWeb: false,
      canExecuteCode: true,
      canAccessFiles: true,
      canSSH: true,
      canGenerateImages: false,
      canSearchWeb: false,
      canManageInfrastructure: true,
    },
  },
  data: {
    type: "data",
    systemPrompt: `You are the Data Agent, specialized in data analysis and visualization. You excel at:
- Data cleaning and transformation
- Statistical analysis
- Creating visualizations and charts
- Machine learning model evaluation
- Report generation

Always validate data quality and explain your methodology.`,
    capabilities: {
      canBrowseWeb: false,
      canExecuteCode: true,
      canAccessFiles: true,
      canSSH: false,
      canGenerateImages: true,
      canSearchWeb: false,
      canManageInfrastructure: false,
    },
  },
  coordinator: {
    type: "coordinator",
    systemPrompt: `You are a Coordinator Agent, responsible for managing a team of worker agents. You:
- Assign tasks to workers
- Monitor their progress
- Handle failures and reassignments
- Aggregate results from workers`,
    capabilities: {
      canBrowseWeb: false,
      canExecuteCode: false,
      canAccessFiles: true,
      canSSH: false,
      canGenerateImages: false,
      canSearchWeb: false,
      canManageInfrastructure: false,
    },
  },
  specialist: {
    type: "specialist",
    systemPrompt: `You are a Specialist Agent with deep expertise in a specific domain. You:
- Handle complex domain-specific tasks
- Provide expert analysis and recommendations
- Work independently on specialized problems`,
    capabilities: {
      canBrowseWeb: true,
      canExecuteCode: true,
      canAccessFiles: true,
      canSSH: false,
      canGenerateImages: false,
      canSearchWeb: true,
      canManageInfrastructure: false,
    },
  },
  worker: {
    type: "worker",
    systemPrompt: `You are a Worker Agent, designed to execute specific tasks efficiently. You:
- Execute assigned tasks promptly
- Report progress and results
- Handle simple, well-defined tasks`,
    capabilities: {
      canBrowseWeb: false,
      canExecuteCode: true,
      canAccessFiles: true,
      canSSH: false,
      canGenerateImages: false,
      canSearchWeb: false,
      canManageInfrastructure: false,
    },
  },
  custom: {
    type: "custom",
    systemPrompt:
      "You are a custom agent. Your specific role will be defined by the user.",
    capabilities: {
      canBrowseWeb: false,
      canExecuteCode: false,
      canAccessFiles: false,
      canSSH: false,
      canGenerateImages: false,
      canSearchWeb: false,
      canManageInfrastructure: false,
    },
  },
};
