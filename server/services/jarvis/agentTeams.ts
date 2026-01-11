/**
 * Collaborative Agent Teams
 * Multiple specialized JARVIS agents working together on complex tasks
 */

import {
  runOrchestrator,
  type ToolCall,
  type ToolResult,
  type OrchestratorCallbacks,
} from "./orchestrator";
import { executeTool } from "./tools";

// Agent specializations
export type AgentRole =
  | "researcher" // Web search, fact-finding, data gathering
  | "analyst" // Data analysis, pattern recognition, insights
  | "coder" // Code generation, debugging, technical tasks
  | "writer" // Content creation, summarization, documentation
  | "coordinator"; // Task delegation, synthesis, final output

export interface Agent {
  id: string;
  role: AgentRole;
  name: string;
  description: string;
  systemPrompt: string;
}

export interface TeamTask {
  id: string;
  originalQuery: string;
  subtasks: SubTask[];
  status: "planning" | "executing" | "synthesizing" | "complete" | "failed";
  finalResult?: string;
  startTime: number;
  endTime?: number;
}

export interface SubTask {
  id: string;
  assignedAgent: AgentRole;
  description: string;
  status: "pending" | "running" | "complete" | "failed" | "cancelled";
  result?: string;
  error?: string;
  dependsOn?: string[];
  priority?: number;
  startedAt?: number;
  completedAt?: number;
}

export interface TeamMessage {
  from: AgentRole;
  to: AgentRole | "all";
  content: string;
  timestamp: number;
  type?: "progress" | "result" | "request" | "broadcast";
}

export interface TeamCoordination {
  sharedContext: Map<string, string>;
  messageQueue: TeamMessage[];
  activeAgents: Set<string>;
  cancelledAgents: Set<string>;
  completedSubtasks: Map<string, string>;
}

function createTeamCoordination(): TeamCoordination {
  return {
    sharedContext: new Map(),
    messageQueue: [],
    activeAgents: new Set(),
    cancelledAgents: new Set(),
    completedSubtasks: new Map(),
  };
}

function buildDependencyOrder(subtasks: SubTask[]): SubTask[][] {
  const taskMap = new Map(subtasks.map(t => [t.id, t]));
  const completed = new Set<string>();
  const batches: SubTask[][] = [];

  while (completed.size < subtasks.length) {
    const batch: SubTask[] = [];

    for (const task of subtasks) {
      if (completed.has(task.id)) continue;

      const deps = task.dependsOn || [];
      const depsCompleted = deps.every(d => completed.has(d));

      if (depsCompleted) {
        batch.push(task);
      }
    }

    if (batch.length === 0 && completed.size < subtasks.length) {
      const remaining = subtasks.filter(t => !completed.has(t.id));
      batches.push(remaining);
      break;
    }

    for (const task of batch) {
      completed.add(task.id);
    }

    if (batch.length > 0) {
      batches.push(batch);
    }
  }

  return batches;
}

async function executeSubtaskBatch(
  batch: SubTask[],
  coordination: TeamCoordination,
  callbacks: Partial<TeamCallback>
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  const promises = batch.map(async subtask => {
    if (coordination.cancelledAgents.has(subtask.id)) {
      subtask.status = "cancelled";
      return { id: subtask.id, result: "" };
    }

    coordination.activeAgents.add(subtask.id);
    subtask.status = "running";
    subtask.startedAt = Date.now();
    callbacks.onAgentStart?.(subtask.assignedAgent, subtask);

    try {
      const contextParts: string[] = [];

      if (subtask.dependsOn) {
        for (const depId of subtask.dependsOn) {
          const depResult = coordination.completedSubtasks.get(depId);
          if (depResult) {
            contextParts.push(
              `Previous result (${depId}): ${depResult.slice(0, 500)}`
            );
          }
        }
      }

      coordination.sharedContext.forEach((value, key) => {
        contextParts.push(`[${key}]: ${value.slice(0, 200)}`);
      });

      const context =
        contextParts.length > 0
          ? `Context:\n${contextParts.join("\n")}\n\n`
          : "";

      const result = await executeSubtask(subtask, context, callbacks);

      subtask.status = "complete";
      subtask.result = result;
      subtask.completedAt = Date.now();
      coordination.completedSubtasks.set(subtask.id, result);

      callbacks.onAgentComplete?.(subtask.assignedAgent, subtask, result);
      callbacks.onTeamMessage?.({
        from: subtask.assignedAgent,
        to: "all",
        content: `Completed: ${subtask.description}`,
        timestamp: Date.now(),
        type: "result",
      });

      return { id: subtask.id, result };
    } catch (error) {
      subtask.status = "failed";
      subtask.error = error instanceof Error ? error.message : "Unknown error";
      subtask.completedAt = Date.now();
      callbacks.onAgentError?.(subtask.assignedAgent, subtask, subtask.error);
      return { id: subtask.id, result: "" };
    } finally {
      coordination.activeAgents.delete(subtask.id);
    }
  });

  const batchResults = await Promise.all(promises);

  for (const { id, result } of batchResults) {
    if (result) {
      results.set(id, result);
    }
  }

  return results;
}

// Predefined agents
const AGENTS: Record<AgentRole, Agent> = {
  researcher: {
    id: "researcher",
    role: "researcher",
    name: "Research Agent",
    description: "Specializes in web search, fact-finding, and data gathering",
    systemPrompt: `You are a specialized Research Agent. Your role is to:
- Search the web for accurate, up-to-date information
- Find and verify facts from multiple sources
- Gather comprehensive data on topics
- Cite sources when possible
Focus on finding information, not analyzing it. Pass your findings to other agents for analysis.`,
  },
  analyst: {
    id: "analyst",
    role: "analyst",
    name: "Analysis Agent",
    description:
      "Specializes in data analysis, pattern recognition, and insights",
    systemPrompt: `You are a specialized Analysis Agent. Your role is to:
- Analyze data and information provided by other agents
- Identify patterns, trends, and insights
- Compare and contrast different pieces of information
- Draw conclusions based on evidence
Focus on analysis and interpretation, not data gathering.`,
  },
  coder: {
    id: "coder",
    role: "coder",
    name: "Coding Agent",
    description:
      "Specializes in code generation, debugging, and technical tasks",
    systemPrompt: `You are a specialized Coding Agent. Your role is to:
- Write clean, efficient code in any language
- Debug and fix code issues
- Create scripts for data processing
- Implement technical solutions
Focus on code quality and correctness. Test your code when possible.`,
  },
  writer: {
    id: "writer",
    role: "writer",
    name: "Writing Agent",
    description:
      "Specializes in content creation, summarization, and documentation",
    systemPrompt: `You are a specialized Writing Agent. Your role is to:
- Create clear, well-structured content
- Summarize complex information
- Write documentation and reports
- Format output for readability
Focus on clarity and communication. Make information accessible.`,
  },
  coordinator: {
    id: "coordinator",
    role: "coordinator",
    name: "Coordinator Agent",
    description: "Manages task delegation and synthesizes results",
    systemPrompt: `You are the Coordinator Agent. Your role is to:
- Break down complex tasks into subtasks
- Assign subtasks to appropriate specialized agents
- Synthesize results from multiple agents
- Ensure the final output addresses the original query
You orchestrate the team and produce the final deliverable.`,
  },
};

// Callback interface for team progress
export interface TeamCallback {
  onPlanCreated: (subtasks: SubTask[]) => void;
  onAgentStart: (agent: AgentRole, subtask: SubTask) => void;
  onAgentProgress: (agent: AgentRole, message: string) => void;
  onAgentComplete: (agent: AgentRole, subtask: SubTask, result: string) => void;
  onAgentError: (agent: AgentRole, subtask: SubTask, error: string) => void;
  onTeamMessage: (message: TeamMessage) => void;
  onSynthesisStart: () => void;
  onComplete: (result: string) => void;
  onError: (error: string) => void;
}

/**
 * Plan subtasks for a complex query using the coordinator
 */
async function planSubtasks(query: string): Promise<SubTask[]> {
  const planningPrompt = `Analyze this task and break it down into subtasks for specialized agents.

Task: ${query}

Available agents:
- researcher: Web search, fact-finding, data gathering
- analyst: Data analysis, pattern recognition, insights  
- coder: Code generation, debugging, technical tasks
- writer: Content creation, summarization, documentation

Create subtasks with dependencies. Tasks without dependencies can run in parallel.
Use "dependsOn" to specify which tasks must complete first (by their id like "subtask-0").

Example: If analyst needs researcher's data, set dependsOn: ["subtask-0"].`;

  const { invokeLLM } = await import("../../_core/llm");

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are a task planning assistant. Respond only with valid JSON in this exact format:
{
  "subtasks": [
    {
      "assignedAgent": "researcher" | "analyst" | "coder" | "writer",
      "description": "task description",
      "dependsOn": ["subtask-0"] // optional, array of task IDs this depends on
    }
  ]
}`,
      },
      { role: "user", content: planningPrompt },
    ],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("Failed to plan subtasks");
  }

  const parsed = JSON.parse(content);
  return parsed.subtasks.map(
    (
      st: { assignedAgent: string; description: string; dependsOn?: string[] },
      index: number
    ) => ({
      id: `subtask-${index}`,
      assignedAgent: st.assignedAgent as AgentRole,
      description: st.description,
      status: "pending" as const,
      dependsOn: st.dependsOn || [],
      priority: index,
    })
  );
}

/**
 * Execute a subtask with a specialized agent
 */
async function executeSubtask(
  subtask: SubTask,
  context: string,
  callbacks: Partial<TeamCallback>
): Promise<string> {
  const _agent = AGENTS[subtask.assignedAgent];

  const taskPrompt = `${context}

Your specific task: ${subtask.description}

Complete this task and provide your findings/output.`;

  let result = "";

  await runOrchestrator(
    taskPrompt,
    {
      onThinking: (thought: string) => {
        callbacks.onAgentProgress?.(subtask.assignedAgent, thought);
      },
      onToolCall: (toolCall: ToolCall) => {
        callbacks.onAgentProgress?.(
          subtask.assignedAgent,
          `Using ${toolCall.name}...`
        );
      },
      onToolResult: (_toolResult: ToolResult) => {
        // Progress update
      },
      onComplete: (summary: string) => {
        result = summary || result;
      },
      onError: (error: string) => {
        throw new Error(error);
      },
    },
    async (name, input) => {
      return await executeTool(name, input);
    },
    { maxIterations: 5 }
  );

  return result;
}

/**
 * Synthesize results from all agents into final output
 */
async function synthesizeResults(
  originalQuery: string,
  subtaskResults: Array<{ agent: AgentRole; task: string; result: string }>
): Promise<string> {
  const { invokeLLM } = await import("../../_core/llm");

  const synthesisPrompt = `Original Query: ${originalQuery}

Results from specialized agents:
${subtaskResults
  .map(
    r => `
### ${AGENTS[r.agent].name}
Task: ${r.task}
Result: ${r.result}
`
  )
  .join("\n")}

Synthesize these results into a comprehensive, well-structured response that fully addresses the original query. Include key findings from each agent and present a unified answer.`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: AGENTS.coordinator.systemPrompt },
      { role: "user", content: synthesisPrompt },
    ],
  });

  const content = response.choices[0]?.message?.content;
  return typeof content === "string" ? content : "Failed to synthesize results";
}

/**
 * Run a collaborative agent team on a complex task
 * Executes independent subtasks in parallel based on dependency graph
 */
export async function runAgentTeam(
  query: string,
  callbacks: TeamCallback,
  options: { maxParallel?: number; timeoutMs?: number } = {}
): Promise<string> {
  const { maxParallel = 3, timeoutMs = 300000 } = options;
  const startTime = Date.now();
  const coordination = createTeamCoordination();

  try {
    const subtasks = await planSubtasks(query);
    callbacks.onPlanCreated(subtasks);

    coordination.sharedContext.set("originalQuery", query);

    const batches = buildDependencyOrder(subtasks);
    const independentCount = batches[0]?.length || 0;

    if (independentCount > 1) {
      callbacks.onTeamMessage({
        from: "coordinator",
        to: "all",
        content: `Executing ${independentCount} independent tasks in parallel`,
        timestamp: Date.now(),
        type: "broadcast",
      });
    }

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      if (Date.now() - startTime > timeoutMs) {
        for (const task of batch) {
          coordination.cancelledAgents.add(task.id);
        }
        callbacks.onTeamMessage({
          from: "coordinator",
          to: "all",
          content: "Timeout reached, cancelling remaining tasks",
          timestamp: Date.now(),
          type: "broadcast",
        });
        break;
      }

      const limitedBatch = batch.slice(0, maxParallel);
      const overflow = batch.slice(maxParallel);

      await executeSubtaskBatch(limitedBatch, coordination, callbacks);

      if (overflow.length > 0) {
        await executeSubtaskBatch(overflow, coordination, callbacks);
      }
    }

    const results: Array<{ agent: AgentRole; task: string; result: string }> =
      [];
    for (const subtask of subtasks) {
      if (subtask.status === "complete" && subtask.result) {
        results.push({
          agent: subtask.assignedAgent,
          task: subtask.description,
          result: subtask.result,
        });
      }
    }

    callbacks.onSynthesisStart();
    const finalResult = await synthesizeResults(query, results);

    const totalTime = Date.now() - startTime;
    const parallelSavings = calculateParallelSavings(subtasks);

    callbacks.onTeamMessage({
      from: "coordinator",
      to: "all",
      content: `Team completed in ${Math.round(totalTime / 1000)}s (${parallelSavings}% faster with parallelization)`,
      timestamp: Date.now(),
      type: "broadcast",
    });

    callbacks.onComplete(finalResult);
    return finalResult;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    callbacks.onError(errorMessage);
    throw error;
  }
}

function calculateParallelSavings(subtasks: SubTask[]): number {
  const completedTasks = subtasks.filter(
    t => t.status === "complete" && t.startedAt && t.completedAt
  );

  if (completedTasks.length < 2) return 0;

  const sequentialTime = completedTasks.reduce(
    (sum, t) => sum + ((t.completedAt || 0) - (t.startedAt || 0)),
    0
  );

  const actualStart = Math.min(...completedTasks.map(t => t.startedAt || 0));
  const actualEnd = Math.max(...completedTasks.map(t => t.completedAt || 0));
  const actualTime = actualEnd - actualStart;

  if (sequentialTime === 0) return 0;
  return Math.round(((sequentialTime - actualTime) / sequentialTime) * 100);
}

export function cancelAgentTeamTask(
  coordination: TeamCoordination,
  taskId?: string
): void {
  if (taskId) {
    coordination.cancelledAgents.add(taskId);
  } else {
    coordination.activeAgents.forEach(id => {
      coordination.cancelledAgents.add(id);
    });
  }
}

/**
 * Check if a query should use agent teams (complex, multi-faceted tasks)
 */
export async function shouldUseAgentTeam(query: string): Promise<boolean> {
  const { invokeLLM } = await import("../../_core/llm");

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          'You determine if a task requires multiple specialized agents. Respond with JSON: {"useTeam": true/false, "reason": "..."}',
      },
      {
        role: "user",
        content: `Should this task use a team of specialized agents (researcher, analyst, coder, writer)?

Task: ${query}

Use team if the task:
- Requires both research AND analysis/coding
- Has multiple distinct components
- Would benefit from specialized expertise
- Is complex enough to warrant coordination

Don't use team for:
- Simple questions
- Single-focus tasks
- Quick lookups`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "team_decision",
        strict: true,
        schema: {
          type: "object",
          properties: {
            useTeam: { type: "boolean" },
            reason: { type: "string" },
          },
          required: ["useTeam", "reason"],
          additionalProperties: false,
        },
      },
    },
  });

  const rawContent = response.choices[0]?.message?.content;
  if (!rawContent || typeof rawContent !== "string") return false;

  try {
    const parsed = JSON.parse(rawContent);
    return parsed.useTeam === true;
  } catch {
    return false;
  }
}

export { AGENTS };
