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
  status: "pending" | "running" | "complete" | "failed";
  result?: string;
  error?: string;
}

export interface TeamMessage {
  from: AgentRole;
  to: AgentRole | "all";
  content: string;
  timestamp: number;
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

Respond with a JSON array of subtasks:
[
  { "assignedAgent": "researcher", "description": "..." },
  { "assignedAgent": "analyst", "description": "..." },
  ...
]

Keep subtasks focused and specific. Use 2-4 subtasks typically.`;

  // Use a simple LLM call for planning
  const { invokeLLM } = await import("../../_core/llm");

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "You are a task planning assistant. Respond only with valid JSON.",
      },
      { role: "user", content: planningPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "subtask_plan",
        strict: true,
        schema: {
          type: "object",
          properties: {
            subtasks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  assignedAgent: {
                    type: "string",
                    enum: ["researcher", "analyst", "coder", "writer"],
                  },
                  description: { type: "string" },
                },
                required: ["assignedAgent", "description"],
                additionalProperties: false,
              },
            },
          },
          required: ["subtasks"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("Failed to plan subtasks");
  }

  const parsed = JSON.parse(content);
  return parsed.subtasks.map((st: any, index: number) => ({
    id: `subtask-${index}`,
    assignedAgent: st.assignedAgent as AgentRole,
    description: st.description,
    status: "pending" as const,
  }));
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
    5 // Max iterations per agent
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
 */
export async function runAgentTeam(
  query: string,
  callbacks: TeamCallback
): Promise<string> {
  const _startTime = Date.now();

  try {
    // Step 1: Plan subtasks
    const subtasks = await planSubtasks(query);
    callbacks.onPlanCreated(subtasks);

    // Step 2: Execute subtasks (can be parallelized in future)
    const results: Array<{ agent: AgentRole; task: string; result: string }> =
      [];

    for (const subtask of subtasks) {
      callbacks.onAgentStart(subtask.assignedAgent, subtask);

      try {
        // Build context from previous results
        const context =
          results.length > 0
            ? `Previous findings:\n${results.map(r => `- ${r.agent}: ${r.result.substring(0, 200)}...`).join("\n")}`
            : `Original query: ${query}`;

        const result = await executeSubtask(subtask, context, callbacks);

        subtask.status = "complete";
        subtask.result = result;
        results.push({
          agent: subtask.assignedAgent,
          task: subtask.description,
          result,
        });

        callbacks.onAgentComplete(subtask.assignedAgent, subtask, result);

        // Send team message
        callbacks.onTeamMessage({
          from: subtask.assignedAgent,
          to: "coordinator",
          content: `Completed: ${subtask.description}`,
          timestamp: Date.now(),
        });
      } catch (error) {
        subtask.status = "failed";
        subtask.error =
          error instanceof Error ? error.message : "Unknown error";
        callbacks.onAgentError(subtask.assignedAgent, subtask, subtask.error);
      }
    }

    // Step 3: Synthesize results
    callbacks.onSynthesisStart();
    const finalResult = await synthesizeResults(query, results);

    callbacks.onComplete(finalResult);
    return finalResult;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    callbacks.onError(errorMessage);
    throw error;
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
