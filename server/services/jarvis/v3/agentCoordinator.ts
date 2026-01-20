import type { AgentType, ToolDefinition } from "./types";
import { getGlobalRegistry } from "./toolRegistry";
import { getToolsForAgent } from "./toolMetadata";

export interface TaskAnalysis {
  primaryAgent: AgentType;
  secondaryAgents: AgentType[];
  confidence: number;
  reasoning: string;
  suggestedTools: string[];
  estimatedComplexity: "simple" | "moderate" | "complex";
  requiresMultiAgent: boolean;
}

export interface AgentTask {
  id: string;
  type: AgentType;
  description: string;
  tools: string[];
  status: "pending" | "running" | "completed" | "failed";
  result?: string;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface CoordinatorState {
  currentTask: string;
  analysis: TaskAnalysis;
  agentTasks: AgentTask[];
  iteration: number;
  startedAt: number;
}

const TASK_PATTERNS: Record<string, { agents: AgentType[]; weight: number }> = {
  "write|create|implement|code|build|develop": {
    agents: ["coder", "planner"],
    weight: 10,
  },
  "test|verify|check|validate|assert": {
    agents: ["verifier", "coder"],
    weight: 10,
  },
  "research|search|find|look up|investigate": {
    agents: ["researcher", "planner"],
    weight: 10,
  },
  "deploy|ship|release|publish": {
    agents: ["executor", "verifier"],
    weight: 10,
  },
  "plan|design|architect|strategy": {
    agents: ["planner", "researcher"],
    weight: 10,
  },
  "execute|run|perform|do": {
    agents: ["executor", "coder"],
    weight: 8,
  },
  "learn|remember|store|recall": {
    agents: ["learner", "planner"],
    weight: 8,
  },
  "security|audit|scan|vulnerability": {
    agents: ["safety", "verifier"],
    weight: 10,
  },
  "git|commit|push|pull|branch": {
    agents: ["coder", "executor"],
    weight: 9,
  },
  "file|read|write|edit": {
    agents: ["coder", "executor"],
    weight: 8,
  },
  "browser|web|scrape|navigate": {
    agents: ["executor", "researcher"],
    weight: 9,
  },
  "image|generate|visual": {
    agents: ["executor"],
    weight: 8,
  },
  "document|report|pdf|docx": {
    agents: ["coder", "executor"],
    weight: 8,
  },
  "ssh|remote|server": {
    agents: ["executor"],
    weight: 9,
  },
  "docker|container|deploy": {
    agents: ["executor", "verifier"],
    weight: 9,
  },
  "database|query|sql": {
    agents: ["executor", "coder"],
    weight: 9,
  },
};

const AGENT_DESCRIPTIONS: Record<AgentType, string> = {
  planner:
    "Strategic task planning, breaking complex tasks into subtasks, memory search, project analysis",
  coder:
    "Writing code, file operations, git operations, code editing, refactoring",
  executor:
    "Running commands, browser automation, deployments, SSH operations, system tasks",
  verifier:
    "Testing, validation, code review, type checking, linting, security audits",
  researcher:
    "Web search, documentation lookup, information gathering, deep research",
  learner:
    "Memory storage, pattern extraction, skill capture, learning from outcomes",
  safety:
    "Permission checks, risk assessment, security analysis, rollback operations",
};

export function analyzeTask(task: string): TaskAnalysis {
  const taskLower = task.toLowerCase();

  const isWeatherQuery =
    taskLower.includes("weather") ||
    taskLower.includes("temperature") ||
    taskLower.includes("forecast");

  const isImageQuery =
    taskLower.includes("generate image") ||
    taskLower.includes("create image") ||
    taskLower.includes("draw") ||
    taskLower.includes("picture of");

  const isCalculationQuery =
    taskLower.includes("calculate") ||
    taskLower.includes("compute") ||
    /\d+\s*[\+\-\*\/\^]\s*\d+/.test(task);

  if (isWeatherQuery) {
    return {
      primaryAgent: "researcher",
      secondaryAgents: [],
      confidence: 95,
      reasoning:
        "Weather query detected - using researcher with get_weather tool",
      suggestedTools: ["get_weather", "task_complete"],
      estimatedComplexity: "simple",
      requiresMultiAgent: false,
    };
  }

  if (isImageQuery) {
    return {
      primaryAgent: "executor",
      secondaryAgents: [],
      confidence: 95,
      reasoning:
        "Image generation query detected - using executor with generate_image tool",
      suggestedTools: ["generate_image", "task_complete"],
      estimatedComplexity: "simple",
      requiresMultiAgent: false,
    };
  }

  if (
    isCalculationQuery &&
    !taskLower.includes("code") &&
    !taskLower.includes("script")
  ) {
    return {
      primaryAgent: "executor",
      secondaryAgents: [],
      confidence: 90,
      reasoning:
        "Calculation query detected - using executor with calculate tool",
      suggestedTools: ["calculate", "task_complete"],
      estimatedComplexity: "simple",
      requiresMultiAgent: false,
    };
  }

  // Explicit search/research query detection
  const isSearchQuery =
    taskLower.includes("search") ||
    taskLower.includes("find") ||
    taskLower.includes("look up") ||
    taskLower.includes("research") ||
    taskLower.includes("investigate") ||
    taskLower.includes("news") ||
    taskLower.includes("latest");

  if (
    isSearchQuery &&
    !taskLower.includes("file") &&
    !taskLower.includes("code")
  ) {
    return {
      primaryAgent: "researcher",
      secondaryAgents: [],
      confidence: 90,
      reasoning:
        "Search/research query detected - using researcher with web_search tool",
      suggestedTools: [
        "web_search",
        "browse_url",
        "deep_research",
        "task_complete",
      ],
      estimatedComplexity: "simple",
      requiresMultiAgent: false,
    };
  }

  const agentScores: Record<AgentType, number> = {
    planner: 0,
    coder: 0,
    executor: 0,
    verifier: 0,
    researcher: 0,
    learner: 0,
    safety: 0,
  };

  for (const [pattern, { agents, weight }] of Object.entries(TASK_PATTERNS)) {
    const regex = new RegExp(pattern, "i");
    if (regex.test(taskLower)) {
      agents.forEach((agent, index) => {
        agentScores[agent] += weight * (1 - index * 0.3);
      });
    }
  }

  if (taskLower.includes("?") || taskLower.includes("how")) {
    agentScores.researcher += 5;
    agentScores.planner += 3;
  }

  if (
    taskLower.includes("scaffold") ||
    taskLower.includes("create project") ||
    taskLower.includes("build app")
  ) {
    agentScores.coder += 10;
    agentScores.planner += 5;
  }

  if (
    taskLower.includes("fix") ||
    taskLower.includes("bug") ||
    taskLower.includes("error")
  ) {
    agentScores.coder += 8;
    agentScores.verifier += 5;
  }

  const sortedAgents = (Object.keys(agentScores) as AgentType[]).sort(
    (a, b) => agentScores[b] - agentScores[a]
  );

  const primaryAgent = sortedAgents[0];
  const maxScore = agentScores[primaryAgent];

  const secondaryAgents = sortedAgents
    .slice(1)
    .filter(agent => agentScores[agent] > maxScore * 0.5);

  const confidence = Math.min(100, maxScore > 0 ? (maxScore / 20) * 100 : 30);

  const suggestedTools = getToolsForAgent(primaryAgent).slice(0, 10);

  const wordCount = task.split(/\s+/).length;
  const isInherentlyComplex =
    /\b(scaffold|scaffolding|portal|bilateral|build_bilateral_portal|scaffold_business_portal)\b/i.test(
      taskLower
    );
  const hasTrulyMultipleSteps =
    (task.includes(" then ") || task.includes(";")) &&
    !isWeatherQuery &&
    !isImageQuery &&
    !isCalculationQuery;

  const estimatedComplexity: TaskAnalysis["estimatedComplexity"] =
    wordCount > 50 || hasTrulyMultipleSteps || isInherentlyComplex
      ? "complex"
      : wordCount > 20
        ? "moderate"
        : "simple";

  const requiresMultiAgent =
    isInherentlyComplex ||
    (estimatedComplexity === "complex" && secondaryAgents.length >= 2);

  return {
    primaryAgent,
    secondaryAgents,
    confidence,
    reasoning: generateReasoning(primaryAgent, secondaryAgents, agentScores),
    suggestedTools,
    estimatedComplexity,
    requiresMultiAgent,
  };
}

function generateReasoning(
  primary: AgentType,
  secondary: AgentType[],
  scores: Record<AgentType, number>
): string {
  const parts: string[] = [];

  parts.push(`Primary agent: ${primary} (${AGENT_DESCRIPTIONS[primary]})`);

  if (secondary.length > 0) {
    parts.push(
      `Supporting agents: ${secondary.map(a => `${a} (score: ${scores[a].toFixed(1)})`).join(", ")}`
    );
  }

  return parts.join(". ");
}

export function getToolsForAgentType(agentType: AgentType): ToolDefinition[] {
  const registry = getGlobalRegistry();
  return registry.getToolDefinitionsForAgent(agentType);
}

export function filterToolsForAgent(
  tools: ToolDefinition[],
  agentType: AgentType
): ToolDefinition[] {
  const allowedTools = new Set(getToolsForAgent(agentType));
  return tools.filter(tool => allowedTools.has(tool.name));
}

export function createAgentTask(
  type: AgentType,
  description: string
): AgentTask {
  return {
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    description,
    tools: getToolsForAgent(type),
    status: "pending",
  };
}

export class AgentCoordinator {
  private state: CoordinatorState | null = null;

  analyzeAndPlan(task: string): TaskAnalysis {
    const analysis = analyzeTask(task);

    this.state = {
      currentTask: task,
      analysis,
      agentTasks: [],
      iteration: 0,
      startedAt: Date.now(),
    };

    return analysis;
  }

  createSubtask(agentType: AgentType, description: string): AgentTask {
    const subtask = createAgentTask(agentType, description);

    if (this.state) {
      this.state.agentTasks.push(subtask);
    }

    return subtask;
  }

  startTask(taskId: string): void {
    if (!this.state) return;

    const task = this.state.agentTasks.find(t => t.id === taskId);
    if (task) {
      task.status = "running";
      task.startedAt = Date.now();
    }
  }

  completeTask(taskId: string, result: string): void {
    if (!this.state) return;

    const task = this.state.agentTasks.find(t => t.id === taskId);
    if (task) {
      task.status = "completed";
      task.result = result;
      task.completedAt = Date.now();
    }
  }

  failTask(taskId: string, error: string): void {
    if (!this.state) return;

    const task = this.state.agentTasks.find(t => t.id === taskId);
    if (task) {
      task.status = "failed";
      task.error = error;
      task.completedAt = Date.now();
    }
  }

  getState(): CoordinatorState | null {
    return this.state;
  }

  getAgentStats(): Record<
    AgentType,
    { total: number; completed: number; failed: number }
  > {
    const stats: Record<
      AgentType,
      { total: number; completed: number; failed: number }
    > = {
      planner: { total: 0, completed: 0, failed: 0 },
      coder: { total: 0, completed: 0, failed: 0 },
      executor: { total: 0, completed: 0, failed: 0 },
      verifier: { total: 0, completed: 0, failed: 0 },
      researcher: { total: 0, completed: 0, failed: 0 },
      learner: { total: 0, completed: 0, failed: 0 },
      safety: { total: 0, completed: 0, failed: 0 },
    };

    if (!this.state) return stats;

    for (const task of this.state.agentTasks) {
      stats[task.type].total++;
      if (task.status === "completed") {
        stats[task.type].completed++;
      } else if (task.status === "failed") {
        stats[task.type].failed++;
      }
    }

    return stats;
  }

  reset(): void {
    this.state = null;
  }
}

let globalCoordinator: AgentCoordinator | null = null;

export function getGlobalCoordinator(): AgentCoordinator {
  if (!globalCoordinator) {
    globalCoordinator = new AgentCoordinator();
  }
  return globalCoordinator;
}

export function resetGlobalCoordinator(): void {
  if (globalCoordinator) {
    globalCoordinator.reset();
  }
  globalCoordinator = null;
}

export { AGENT_DESCRIPTIONS };
