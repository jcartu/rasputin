import type {
  AgentType,
  ExecutionContext,
  SwarmTask,
  ToolResult,
  AgentState,
  AgentMetrics,
  ConsensusRequest,
  ConsensusVote,
  ConsensusResult,
} from "./types";
import {
  analyzeTask as _analyzeTask,
  getGlobalCoordinator,
  type TaskAnalysis,
  type AgentTask,
} from "./agentCoordinator";
import { getToolsForAgent, getToolMetadata } from "./toolMetadata";
import { getAvailableTools } from "../tools";
import {
  getGlobalMemoryClient,
  enrichContextWithMemory,
  type MemoryEventCallback,
} from "./memoryIntegration";
import { extractLearningFromExecution } from "./learningExtractor";
import {
  getGlobalFrontierAdapter,
  type ChatMessage,
  type ToolDefinition,
} from "./frontierAdapter";
import {
  getAgentBehavior,
  applyAgentPreProcess,
  applyAgentPostProcess,
  getAgentMaxIterations as _getAgentMaxIterations,
} from "./agentBehaviors";
import {
  emitSwarmConsensusStart,
  emitSwarmVote,
  emitSwarmConsensusComplete,
} from "../../websocket";
import {
  persistAgentMetrics,
  persistConsensusVote,
  persistConsensusResult,
} from "./metricsStore";
import {
  detectRefusal,
  detectSemanticReframing,
  queryLocalFallbackWithQwenEnhancement,
  performDolphinResearch,
  type DolphinResearchResult,
} from "../../synthesis";

export interface SwarmConfig {
  maxConcurrentAgents: number;
  consensusThreshold: number;
  taskTimeoutMs: number;
  enableLearning: boolean;
  enableMemoryEnrichment: boolean;
  enableConsensus: boolean;
  consensusTimeoutMs: number;
}

const DEFAULT_SWARM_CONFIG: SwarmConfig = {
  maxConcurrentAgents: 3,
  consensusThreshold: 0.6,
  taskTimeoutMs: 300000,
  enableLearning: true,
  enableMemoryEnrichment: true,
  enableConsensus: true,
  consensusTimeoutMs: 30000,
};

const HIGH_RISK_TOOLS = new Set([
  "ssh_execute",
  "daemon_shell_exec",
  "docker_compose",
  "deploy_vercel",
  "deploy_railway",
  "git_push",
  "git_force_push",
  "delete_file",
  "rm_rf",
  "database_drop",
  "daemon_start_process",
]);

export interface SwarmExecutionResult {
  success: boolean;
  output: string;
  agentsUsed: AgentType[];
  tasksCompleted: number;
  tasksFailed: number;
  totalDurationMs: number;
  learningsExtracted: number;
  consensusReached?: boolean;
}

export interface AgentExecutor {
  executeWithAgent(
    agentType: AgentType,
    task: string,
    tools: string[],
    context: ExecutionContext
  ): Promise<ToolResult>;
}

type _SwarmTaskStatus =
  | "pending"
  | "claimed"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export class SwarmOrchestrator {
  private config: SwarmConfig;
  private activeAgents: Map<string, AgentState> = new Map();
  private taskQueue: SwarmTask[] = [];
  private completedTasks: SwarmTask[] = [];
  private agentMetrics: Map<AgentType, AgentMetrics> = new Map();

  constructor(config: Partial<SwarmConfig> = {}) {
    this.config = { ...DEFAULT_SWARM_CONFIG, ...config };
    this.initializeMetrics();
  }

  private initializeMetrics(): void {
    const agentTypes: AgentType[] = [
      "planner",
      "coder",
      "executor",
      "verifier",
      "researcher",
      "learner",
      "safety",
    ];

    for (const type of agentTypes) {
      this.agentMetrics.set(type, {
        tasksCompleted: 0,
        tasksFailed: 0,
        averageDurationMs: 0,
        successRate: 1.0,
      });
    }
  }

  async analyzeAndPlan(task: string): Promise<TaskAnalysis> {
    const coordinator = getGlobalCoordinator();
    return coordinator.analyzeAndPlan(task);
  }

  async executeSwarmTask(
    task: string,
    context: ExecutionContext,
    executor: AgentExecutor,
    onMemoryEvent?: MemoryEventCallback
  ): Promise<SwarmExecutionResult> {
    const startTime = Date.now();
    const agentsUsed: AgentType[] = [];
    let learningsExtracted = 0;

    const analysis = await this.analyzeAndPlan(task);

    let enrichedContext = context;
    if (this.config.enableMemoryEnrichment) {
      try {
        enrichedContext = await enrichContextWithMemory(
          context,
          task,
          onMemoryEvent
        );
      } catch {
        void 0;
      }
    }

    if (!analysis.requiresMultiAgent) {
      const result = await this.executeSingleAgent(
        analysis,
        task,
        enrichedContext,
        executor
      );
      agentsUsed.push(analysis.primaryAgent);

      if (this.config.enableLearning && result.success) {
        learningsExtracted = await this.extractLearnings(
          analysis.primaryAgent,
          task,
          result,
          enrichedContext
        );
      }

      return {
        success: result.success,
        output: result.output,
        agentsUsed,
        tasksCompleted: result.success ? 1 : 0,
        tasksFailed: result.success ? 0 : 1,
        totalDurationMs: Date.now() - startTime,
        learningsExtracted,
      };
    }

    return this.executeMultiAgent(
      analysis,
      task,
      enrichedContext,
      executor,
      startTime
    );
  }

  private async executeSingleAgent(
    analysis: TaskAnalysis,
    task: string,
    context: ExecutionContext,
    executor: AgentExecutor
  ): Promise<ToolResult> {
    const { primaryAgent } = analysis;
    const behavior = getAgentBehavior(primaryAgent);
    const availableTools = getToolsForAgent(primaryAgent);
    const tools = behavior.selectTools(task, availableTools);

    this.activateAgent(primaryAgent, `single-${Date.now()}`);

    try {
      const processedTask = await applyAgentPreProcess(
        primaryAgent,
        task,
        context
      );

      const result = await executor.executeWithAgent(
        primaryAgent,
        processedTask,
        tools,
        context
      );

      const processedResult = await applyAgentPostProcess(
        primaryAgent,
        result,
        context
      );

      this.updateAgentMetrics(primaryAgent, processedResult);
      return processedResult;
    } finally {
      this.deactivateAgent(primaryAgent);
    }
  }

  private async executeMultiAgent(
    analysis: TaskAnalysis,
    task: string,
    context: ExecutionContext,
    executor: AgentExecutor,
    startTime: number
  ): Promise<SwarmExecutionResult> {
    const agentsUsed: AgentType[] = [];
    const results: ToolResult[] = [];
    let learningsExtracted = 0;

    const subtasks = this.decomposeTask(analysis, task);

    for (const subtask of subtasks) {
      if (Date.now() - startTime > this.config.taskTimeoutMs) {
        break;
      }

      const activeCount = this.activeAgents.size;
      if (activeCount >= this.config.maxConcurrentAgents) {
        await this.waitForAgentSlot();
      }

      const result = await this.executeSubtask(subtask, context, executor);
      results.push(result);

      if (!agentsUsed.includes(subtask.type)) {
        agentsUsed.push(subtask.type);
      }

      if (this.config.enableLearning && result.success) {
        learningsExtracted += await this.extractLearnings(
          subtask.type,
          subtask.description,
          result,
          context
        );
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    const combinedOutput = this.combineResults(results);

    return {
      success: successCount > failureCount,
      output: combinedOutput,
      agentsUsed,
      tasksCompleted: successCount,
      tasksFailed: failureCount,
      totalDurationMs: Date.now() - startTime,
      learningsExtracted,
    };
  }

  private decomposeTask(analysis: TaskAnalysis, task: string): AgentTask[] {
    const coordinator = getGlobalCoordinator();
    const subtasks: AgentTask[] = [];

    if (analysis.estimatedComplexity === "complex") {
      subtasks.push(
        coordinator.createSubtask("planner", `Plan approach for: ${task}`)
      );
    }

    subtasks.push(coordinator.createSubtask(analysis.primaryAgent, task));

    for (const secondaryAgent of analysis.secondaryAgents.slice(0, 2)) {
      const secondaryTask = this.createSecondaryTask(secondaryAgent, task);
      if (secondaryTask) {
        subtasks.push(coordinator.createSubtask(secondaryAgent, secondaryTask));
      }
    }

    if (analysis.estimatedComplexity !== "simple") {
      subtasks.push(
        coordinator.createSubtask("verifier", `Verify results for: ${task}`)
      );
    }

    return subtasks;
  }

  private createSecondaryTask(
    agent: AgentType,
    mainTask: string
  ): string | null {
    switch (agent) {
      case "researcher":
        return `Research context and best practices for: ${mainTask}`;
      case "verifier":
        return `Prepare verification criteria for: ${mainTask}`;
      case "safety":
        return `Analyze security implications of: ${mainTask}`;
      case "learner":
        return `Identify patterns and learnings from: ${mainTask}`;
      default:
        return null;
    }
  }

  private async executeSubtask(
    subtask: AgentTask,
    context: ExecutionContext,
    executor: AgentExecutor
  ): Promise<ToolResult> {
    const coordinator = getGlobalCoordinator();
    coordinator.startTask(subtask.id);

    this.activateAgent(subtask.type, subtask.id);

    try {
      const processedTask = await applyAgentPreProcess(
        subtask.type,
        subtask.description,
        context
      );

      const result = await executor.executeWithAgent(
        subtask.type,
        processedTask,
        subtask.tools,
        context
      );

      const processedResult = await applyAgentPostProcess(
        subtask.type,
        result,
        context
      );

      if (processedResult.success) {
        coordinator.completeTask(subtask.id, processedResult.output);
      } else {
        coordinator.failTask(
          subtask.id,
          processedResult.error || "Unknown error"
        );
      }

      this.updateAgentMetrics(subtask.type, processedResult);
      return processedResult;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      coordinator.failTask(subtask.id, errorMsg);

      return {
        success: false,
        output: `Error: ${errorMsg}`,
        error: errorMsg,
      };
    } finally {
      this.deactivateAgent(subtask.type);
    }
  }

  private activateAgent(type: AgentType, taskId: string): void {
    const agentId = `${type}-${Date.now()}`;
    const metrics = this.agentMetrics.get(type) || {
      tasksCompleted: 0,
      tasksFailed: 0,
      averageDurationMs: 0,
      successRate: 1.0,
    };
    const behavior = getAgentBehavior(type);

    this.activeAgents.set(agentId, {
      id: agentId,
      type,
      status: "busy",
      currentTask: taskId,
      capabilities: {
        tools: getToolsForAgent(type),
        maxConcurrentTasks: 1,
        specializations: [behavior.thinkingStyle],
        canDelegate: behavior.canDelegate,
        requiresHumanApproval: behavior.requiresApprovalFor,
      },
      metrics,
      lastHeartbeat: Date.now(),
    });
  }

  private deactivateAgent(type: AgentType): void {
    const entries = Array.from(this.activeAgents.entries());
    for (const [id, state] of entries) {
      if (state.type === type) {
        this.activeAgents.delete(id);
        break;
      }
    }
  }

  private async waitForAgentSlot(): Promise<void> {
    return new Promise(resolve => {
      const check = () => {
        if (this.activeAgents.size < this.config.maxConcurrentAgents) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  private updateAgentMetrics(type: AgentType, result: ToolResult): void {
    const metrics = this.agentMetrics.get(type);
    if (!metrics) return;

    if (result.success) {
      metrics.tasksCompleted++;
    } else {
      metrics.tasksFailed++;
    }

    const totalTasks = metrics.tasksCompleted + metrics.tasksFailed;
    metrics.successRate =
      totalTasks > 0 ? metrics.tasksCompleted / totalTasks : 1.0;

    if (result.durationMs) {
      const prevTotal = metrics.averageDurationMs * (totalTasks - 1);
      metrics.averageDurationMs = (prevTotal + result.durationMs) / totalTasks;
    }

    metrics.lastTaskAt = Date.now();
    this.agentMetrics.set(type, metrics);

    persistAgentMetrics(
      type,
      result.success,
      result.durationMs ?? 0,
      result.metadata?.tokensUsed as number | undefined,
      result.metadata?.cost as number | undefined
    ).catch(() => {});
  }

  private combineResults(results: ToolResult[]): string {
    const successResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);

    let output = "";

    if (successResults.length > 0) {
      output += successResults.map(r => r.output).join("\n\n");
    }

    if (failedResults.length > 0) {
      output += `\n\nPartial failures (${failedResults.length}):\n`;
      output += failedResults.map(r => `- ${r.error || r.output}`).join("\n");
    }

    return output.trim();
  }

  private async extractLearnings(
    agentType: AgentType,
    task: string,
    result: ToolResult,
    context: ExecutionContext
  ): Promise<number> {
    try {
      const memoryClient = await getGlobalMemoryClient(context.userId);

      const learning = extractLearningFromExecution({
        toolName: `agent_${agentType}`,
        category: "multiagent",
        params: { task, agentType },
        result,
        context,
        agentType,
      });

      await memoryClient.storeLearning(learning);
      return 1;
    } catch {
      return 0;
    }
  }

  async requestConsensus(request: ConsensusRequest): Promise<ConsensusResult> {
    const votes: ConsensusVote[] = [];
    const startTime = Date.now();
    const adapter = await getGlobalFrontierAdapter();

    emitSwarmConsensusStart({
      proposalId: request.taskId,
      question: request.question,
      participantCount: request.participants.length,
    });

    const consensusPrompt = `You are being asked to vote on a high-risk operation.

QUESTION: ${request.question}

You must respond with a JSON object containing:
- vote: "approve" | "reject" | "abstain"
- confidence: number between 0 and 1
- reasoning: brief explanation of your decision

Consider:
- Is this operation safe?
- Are there potential risks?
- Is there sufficient context to make a decision?
- Could this cause irreversible damage?

Respond ONLY with valid JSON, no other text.`;

    const votePromises = request.participants.map(async participant => {
      if (Date.now() - startTime > request.timeoutMs) {
        return {
          agentType: participant,
          vote: "abstain" as const,
          confidence: 0,
          reasoning: "Timeout before agent could respond",
          timestamp: Date.now(),
        };
      }

      try {
        const result = await adapter.reason(
          participant,
          [{ role: "user", content: consensusPrompt }],
          { temperature: 0.1, maxTokens: 256 }
        );

        const parsed = this.parseVoteResponse(result.content, participant);

        emitSwarmVote({
          proposalId: request.taskId,
          agentId: Date.now(),
          agentName: participant,
          agentType: participant,
          vote: parsed.vote,
          weight: parsed.confidence,
          reasoning: parsed.reasoning,
        });

        persistConsensusVote(request.taskId, request.question, parsed).catch(
          () => {}
        );

        return parsed;
      } catch (error) {
        return {
          agentType: participant,
          vote: "abstain" as const,
          confidence: 0,
          reasoning: `Error: ${error instanceof Error ? error.message : "Unknown"}`,
          timestamp: Date.now(),
        };
      }
    });

    const settledVotes = await Promise.allSettled(votePromises);
    for (const result of settledVotes) {
      if (result.status === "fulfilled") {
        votes.push(result.value);
      }
    }

    const approvals = votes.filter(v => v.vote === "approve").length;
    const rejections = votes.filter(v => v.vote === "reject").length;
    const validVotes = approvals + rejections;
    const agreementPercentage = validVotes > 0 ? approvals / validVotes : 0;

    let decision: ConsensusResult["decision"];
    if (Date.now() - startTime > request.timeoutMs && votes.length === 0) {
      decision = "timeout";
    } else if (validVotes < request.participants.length * 0.5) {
      decision = "insufficient";
    } else if (agreementPercentage >= request.requiredAgreement) {
      decision = "approved";
    } else {
      decision = "rejected";
    }

    emitSwarmConsensusComplete({
      proposalId: request.taskId,
      decision: decision === "approved" ? "approved" : "rejected",
      approvalPercentage: agreementPercentage * 100,
      totalVotes: votes.length,
    });

    const consensusResult = {
      taskId: request.taskId,
      decision,
      votes,
      agreementPercentage,
      timestamp: Date.now(),
    };

    persistConsensusResult(request.taskId, consensusResult).catch(() => {});

    return consensusResult;
  }

  private parseVoteResponse(
    content: string,
    agentType: AgentType
  ): ConsensusVote {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        vote?: string;
        confidence?: number;
        reasoning?: string;
      };

      const vote =
        parsed.vote === "approve"
          ? "approve"
          : parsed.vote === "reject"
            ? "reject"
            : "abstain";

      return {
        agentType,
        vote,
        confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0.5)),
        reasoning: parsed.reasoning ?? "No reasoning provided",
        timestamp: Date.now(),
      };
    } catch {
      const contentLower = content.toLowerCase();
      const vote = contentLower.includes("approve")
        ? "approve"
        : contentLower.includes("reject")
          ? "reject"
          : "abstain";

      return {
        agentType,
        vote,
        confidence: 0.3,
        reasoning: content.slice(0, 200),
        timestamp: Date.now(),
      };
    }
  }

  isHighRiskTool(toolName: string): boolean {
    const metadata = getToolMetadata(toolName);
    if (metadata) {
      return metadata.riskLevel === "high" || metadata.riskLevel === "critical";
    }
    return HIGH_RISK_TOOLS.has(toolName);
  }

  async requestToolConsensus(
    toolName: string,
    params: Record<string, unknown>
  ): Promise<ConsensusResult> {
    const question = `Should we execute the tool "${toolName}" with parameters: ${JSON.stringify(params, null, 2)}`;

    return this.requestConsensus({
      taskId: `tool-${toolName}-${Date.now()}`,
      question,
      participants: ["safety", "verifier"],
      requiredAgreement: this.config.consensusThreshold,
      timeoutMs: this.config.consensusTimeoutMs,
    });
  }

  getAgentMetrics(): Map<AgentType, AgentMetrics> {
    return new Map(this.agentMetrics);
  }

  getActiveAgents(): AgentState[] {
    return Array.from(this.activeAgents.values());
  }

  getConfig(): SwarmConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<SwarmConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  reset(): void {
    this.activeAgents.clear();
    this.taskQueue = [];
    this.completedTasks = [];
    this.initializeMetrics();
  }
}

let globalSwarmOrchestrator: SwarmOrchestrator | null = null;

export function getGlobalSwarmOrchestrator(): SwarmOrchestrator {
  if (!globalSwarmOrchestrator) {
    globalSwarmOrchestrator = new SwarmOrchestrator();
  }
  return globalSwarmOrchestrator;
}

export function resetGlobalSwarmOrchestrator(): void {
  if (globalSwarmOrchestrator) {
    globalSwarmOrchestrator.reset();
  }
  globalSwarmOrchestrator = null;
}

export function createSwarmExecutor(
  baseExecutor: (
    name: string,
    input: Record<string, unknown>
  ) => Promise<string>
): AgentExecutor {
  return {
    async executeWithAgent(
      agentType: AgentType,
      task: string,
      tools: string[],
      _context: ExecutionContext
    ): Promise<ToolResult> {
      const startTime = Date.now();

      try {
        const output = await baseExecutor("agent_execute", {
          agentType,
          task,
          tools,
        });

        return {
          success: !output.startsWith("Error:"),
          output,
          durationMs: Date.now() - startTime,
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          output: `Error: ${errorMsg}`,
          error: errorMsg,
          durationMs: Date.now() - startTime,
        };
      }
    },
  };
}

export interface FrontierExecutorOptions {
  enableConsensus?: boolean;
  swarmOrchestrator?: SwarmOrchestrator;
  onToolCall?: (toolCall: {
    id: string;
    name: string;
    input: Record<string, unknown>;
  }) => void;
  onToolResult?: (result: {
    toolCallId: string;
    output: string;
    isError: boolean;
  }) => void;
  onThinking?: (thought: string) => void;
  onThinkingChunk?: (chunk: string) => void;
}

const MAX_SWARM_ITERATIONS = 10;

const FILE_REQUEST_KEYWORDS =
  /\b(file|md|markdown|document|report|save|write|create.*file|output.*file|analysis|dashboard|forecast|outlook|summary|comprehensive|in-depth|detailed)\b/i;
const FILE_WRITE_TOOLS = new Set([
  "write_file",
  "write_docx",
  "write_pptx",
  "write_xlsx",
  "create_rich_report",
  "generate_interactive_report",
]);

export function createFrontierExecutor(
  toolExecutor?: (
    name: string,
    params: Record<string, unknown>
  ) => Promise<string>,
  options: FrontierExecutorOptions = {}
): AgentExecutor {
  const {
    enableConsensus = false,
    swarmOrchestrator,
    onToolCall,
    onToolResult,
    onThinking,
    onThinkingChunk,
  } = options;

  return {
    async executeWithAgent(
      agentType: AgentType,
      task: string,
      tools: string[],
      context: ExecutionContext
    ): Promise<ToolResult> {
      const startTime = Date.now();
      const taskRequestsFiles = FILE_REQUEST_KEYWORDS.test(task);
      const toolsUsed = new Set<string>();
      let iteration = 0;

      onThinking?.(`🚀 Starting ${agentType} agent for task...`);

      try {
        const adapter = await getGlobalFrontierAdapter();

        const allTools = getAvailableTools();
        const toolMap = new Map(allTools.map(t => [t.name, t]));

        const toolDefs: ToolDefinition[] = tools
          .slice(0, 20)
          .map(name => {
            const tool = toolMap.get(name);
            if (tool) {
              return {
                type: "function" as const,
                function: {
                  name: tool.name,
                  description: tool.description,
                  parameters: {
                    type: "object" as const,
                    properties: Object.fromEntries(
                      Object.entries(tool.parameters).map(([key, val]) => [
                        key,
                        {
                          type: val.type,
                          description: val.description,
                          ...(val.type === "array"
                            ? { items: val.items || { type: "string" } }
                            : {}),
                        },
                      ])
                    ),
                    required: Object.entries(tool.parameters)
                      .filter(([, val]) => val.required)
                      .map(([key]) => key),
                  },
                },
              };
            }
            return {
              type: "function" as const,
              function: {
                name,
                description: `Tool: ${name}`,
                parameters: { type: "object", properties: {} },
              },
            };
          })
          .filter(Boolean);

        const messages: ChatMessage[] = [];

        if (
          context.conversationHistory &&
          context.conversationHistory.length > 0
        ) {
          for (const msg of context.conversationHistory) {
            messages.push({ role: msg.role, content: msg.content });
          }
        }

        messages.push({ role: "user", content: task });

        let allToolResults: string[] = [];
        let lastContent = "";
        let forceToolUsage = false;
        let usedDolphinFallback = false;

        while (iteration < MAX_SWARM_ITERATIONS) {
          iteration++;
          onThinking?.(
            `📍 Iteration ${iteration}/${MAX_SWARM_ITERATIONS} - Reasoning...${forceToolUsage ? " (forcing tool usage)" : ""}`
          );

          const result = await adapter.reason(agentType, messages, {
            tools: toolDefs.length > 0 ? toolDefs : undefined,
            onChunk: onThinkingChunk,
            toolChoice: forceToolUsage ? "any" : undefined,
            maxTokens: 64000,
          });

          lastContent = result.content;
          onThinking?.(
            `💭 Model responded (${result.tokensUsed} tokens, ${result.model})`
          );

          if (result.toolCalls && result.toolCalls.length > 0 && toolExecutor) {
            onThinking?.(
              `🔧 Executing ${result.toolCalls.length} tool(s): ${result.toolCalls.map(tc => tc.function.name).join(", ")}`
            );

            messages.push({
              role: "assistant",
              content: result.content,
              tool_calls: result.toolCalls,
            });

            for (const call of result.toolCalls) {
              const toolCallId = call.id || crypto.randomUUID();
              try {
                let params = JSON.parse(call.function.arguments);
                const toolName = call.function.name;
                toolsUsed.add(toolName);

                // REFUSAL INTERCEPTION: Check if generate_interactive_report is being called with refusal content
                if (toolName === "generate_interactive_report" && params.sections) {
                  // Extract text content from sections to check for refusals
                  const sectionContent = params.sections
                    .map((s: { markdownContent?: string; content?: string; title?: string; description?: string }) => 
                      s.markdownContent || s.content || s.title || s.description || ""
                    )
                    .join(" ");
                  
                  const hasRefusal = detectRefusal(sectionContent);
                  const hasReframing = detectSemanticReframing(task, sectionContent);
                  
                  if (hasRefusal || hasReframing) {
                    const reason = hasRefusal 
                      ? "Frontier model refused in report content" 
                      : "Frontier model reframed query in report";
                    onThinking?.(
                      `🚫 ${reason}. Intercepting report generation - activating uncensored local models...`
                    );
                    
                    // Gather web research if needed
                    let webSearchResults = allToolResults
                      .filter(r => r.startsWith("[web_search]:") || r.startsWith("[searxng_search]:") || r.startsWith("[browse_url]:"))
                      .join("\n\n");
                    
                    if (!webSearchResults || webSearchResults.length < 500) {
                      onThinking?.(`🔍 Performing comprehensive web research...`);
                      const researchResults = await performDolphinResearch(
                        task,
                        (status) => onThinking?.(`🔍 ${status}`)
                      );
                      if (researchResults.text) {
                        webSearchResults = researchResults.text;
                      }
                    }
                    
                    // Get uncensored response from local models
                    onThinking?.(`🐬 Querying uncensored local models for real content...`);
                    const dolphinResponse = await queryLocalFallbackWithQwenEnhancement(
                      task,
                      webSearchResults,
                      (status) => onThinking?.(`🐬 Local: ${status}`)
                    );
                    
                    if (dolphinResponse && dolphinResponse.content && dolphinResponse.content.length > 500) {
                      onThinking?.(
                        `✅ Local models provided uncensored response (${dolphinResponse.content.length} chars). Substituting report content...`
                      );
                      
                      // Replace the sections with Dolphin's content
                      const dolphinContent = dolphinResponse.content;
                      
                      // Parse Dolphin's output into sections based on headers
                      const headerPattern = /^(?:#{1,3}|---[A-Z\s]+---)\s*(.+)$/gm;
                      const newSections: Array<{ type: string; title: string; markdownContent?: string; content?: string }> = [];
                      const parts = dolphinContent.split(headerPattern);
                      
                      if (parts.length > 2) {
                        for (let i = 1; i < parts.length; i += 2) {
                          const title = parts[i]?.trim().replace(/^[-#\s]+|[-#\s]+$/g, "") || `Section ${Math.floor(i / 2) + 1}`;
                          const content = parts[i + 1]?.trim() || "";
                          if (content) {
                            newSections.push({ type: "text", title, markdownContent: content });
                          }
                        }
                      }
                      
                      // Fallback: if no sections parsed, use entire content as one section
                      if (newSections.length === 0) {
                        newSections.push({
                          type: "text",
                          title: "Analysis",
                          markdownContent: dolphinContent,
                        });
                      }
                      
                      // Update params with new sections
                      params = {
                        ...params,
                        sections: newSections,
                        subtitle: params.subtitle || "Generated by uncensored local AI models",
                      };
                      
                      usedDolphinFallback = true;
                    }
                  }
                }

                onToolCall?.({ id: toolCallId, name: toolName, input: params });
                onThinking?.(`⚙️ Running ${toolName}...`);

                if (
                  enableConsensus &&
                  swarmOrchestrator &&
                  swarmOrchestrator.isHighRiskTool(toolName)
                ) {
                  onThinking?.(
                    `🔒 High-risk tool detected, requesting consensus...`
                  );
                  const consensus =
                    await swarmOrchestrator.requestToolConsensus(
                      toolName,
                      params
                    );
                  if (consensus.decision !== "approved") {
                    const blockedMsg = `BLOCKED - Consensus ${consensus.decision} (${Math.round(consensus.agreementPercentage * 100)}% agreement)`;
                    onToolResult?.({
                      toolCallId,
                      output: blockedMsg,
                      isError: true,
                    });
                    allToolResults.push(`[${toolName}]: ${blockedMsg}`);
                    messages.push({
                      role: "tool",
                      content: blockedMsg,
                      tool_call_id: toolCallId,
                    });
                    continue;
                  }
                }

                const toolResult = await toolExecutor(toolName, params);
                const isError = toolResult.startsWith("Error:");
                onToolResult?.({
                  toolCallId,
                  output: toolResult,
                  isError,
                });
                allToolResults.push(`[${toolName}]: ${toolResult}`);
                onThinking?.(
                  `${isError ? "❌" : "✅"} ${toolName} ${isError ? "failed" : "completed"}`
                );

                messages.push({
                  role: "tool",
                  content: toolResult,
                  tool_call_id: toolCallId,
                });
              } catch (err) {
                const errorMsg =
                  err instanceof Error ? err.message : String(err);
                onToolResult?.({ toolCallId, output: errorMsg, isError: true });
                allToolResults.push(
                  `[${call.function.name}]: Error - ${errorMsg}`
                );
                onThinking?.(`❌ ${call.function.name} error: ${errorMsg}`);
                messages.push({
                  role: "tool",
                  content: `Error: ${errorMsg}`,
                  tool_call_id: toolCallId,
                });
              }
            }

            const usedFileWriteTool = Array.from(toolsUsed).some(t =>
              FILE_WRITE_TOOLS.has(t)
            );
            if (usedFileWriteTool) {
              onThinking?.(
                `✅ File output generated (${toolsUsed.size} tools used). Task complete.`
              );
              break;
            }
            if (!taskRequestsFiles) {
              onThinking?.(
                `✅ Task iteration complete (${toolsUsed.size} tools used)`
              );
              continue;
            }
          } else {
            const usedFileWriteTool = Array.from(toolsUsed).some(t =>
              FILE_WRITE_TOOLS.has(t)
            );

            if (taskRequestsFiles && !usedFileWriteTool && toolExecutor) {
              let contentForReport = lastContent;
              let dolphinImages: string[] = [];
              
              const hasExplicitRefusal = detectRefusal(lastContent);
              const hasSemanticReframing = detectSemanticReframing(task, lastContent);
              
              if (hasExplicitRefusal || hasSemanticReframing) {
                const reason = hasExplicitRefusal 
                  ? "Frontier model refused" 
                  : "Frontier model reframed query (defensive instead of offensive content)";
                onThinking?.(
                  `🚫 ${reason}. Activating Dolphin fallback with comprehensive research...`
                );
                
                let webSearchResults = allToolResults
                  .filter(r => r.startsWith("[web_search]:") || r.startsWith("[searxng_search]:") || r.startsWith("[browse_url]:"))
                  .join("\n\n");
              
              if (!webSearchResults || webSearchResults.length < 500) {
                  onThinking?.(`🔍 Performing comprehensive web research first...`);
                  const researchResults = await performDolphinResearch(
                    task,
                    (status) => onThinking?.(`🔍 ${status}`)
                  );
                  if (researchResults.text) {
                    webSearchResults = webSearchResults 
                      ? `${webSearchResults}\n\n---\n\n${researchResults.text}`
                      : researchResults.text;
                    dolphinImages = researchResults.images || [];
                  }
                }
                
                onThinking?.(`🐬 Querying local models with ${webSearchResults.length} chars of research...`);
                const dolphinResponse = await queryLocalFallbackWithQwenEnhancement(
                  task,
                  webSearchResults,
                  (status) => onThinking?.(`🐬 Local: ${status}`)
                );
                
                if (dolphinResponse && dolphinResponse.content) {
                  onThinking?.(
                    `✅ Local models provided comprehensive response (${dolphinResponse.content.length} chars). Generating report...`
                  );
                  contentForReport = dolphinResponse.content;
                  lastContent = dolphinResponse.content;
                  usedDolphinFallback = true;
                } else {
                  onThinking?.(
                    `⚠️ Dolphin fallback unavailable. Using original response for report.`
                  );
                }
              }
              
              onThinking?.(
                `⚠️ No tools called but task requires file output. Auto-generating report from LLM response...`
              );

              const reportTitle =
                task.length > 50 ? task.substring(0, 47) + "..." : task;
              const reportFilename = `report_${Date.now()}.html`;

              let cleanContent = contentForReport
                .replace(
                  /^(I'll|I will|Let me|Here's|I'm going to|I can|Sure|Absolutely|Of course)[^.!?]*[.!?]\s*/gi,
                  ""
                )
                .replace(
                  /^(Creating|Generating|Building|Preparing)[^.!?]*[.!?]\s*/gi,
                  ""
                )
                .trim();

              // If stripping left nothing, use original
              if (!cleanContent || cleanContent.length < 100) {
                cleanContent = lastContent;
              }

              const sections: Array<Record<string, unknown>> = [];
              
              if (dolphinImages && dolphinImages.length > 0) {
                sections.push({
                  type: "image_gallery",
                  title: "Related Images",
                  images: dolphinImages.map((url, idx) => ({
                    url,
                    alt: `Image ${idx + 1}`,
                  })),
                });
              }
              
              const headerPattern = /^#+\s+(.+)$/gm;
              const parts = cleanContent.split(headerPattern);

              if (parts.length > 2) {
                for (let i = 1; i < parts.length; i += 2) {
                  const title =
                    parts[i]?.trim() || `Section ${Math.floor(i / 2) + 1}`;
                  const content = parts[i + 1]?.trim() || "";
                  if (content) {
                    sections.push({ type: "text", title, content });
                  }
                }
              }

              if (sections.filter(s => s.type === "text").length === 0) {
                sections.push({
                  type: "text",
                  title: "Report",
                  content: cleanContent,
                });
              }

              const reportParams = {
                path: reportFilename,
                title: `Report: ${reportTitle}`,
                sections,
                theme: "rasputin",
              };

              onThinking?.(`🔧 Auto-calling generate_interactive_report...`);
              onToolCall?.({
                id: crypto.randomUUID(),
                name: "generate_interactive_report",
                input: reportParams,
              });

              try {
                const reportResult = await toolExecutor(
                  "generate_interactive_report",
                  reportParams
                );
                toolsUsed.add("generate_interactive_report");
                allToolResults.push(
                  `[generate_interactive_report]: ${reportResult}`
                );
                onThinking?.(
                  `✅ Report generated successfully via auto-tool-call`
                );
                onToolResult?.({
                  toolCallId: crypto.randomUUID(),
                  output: reportResult,
                  isError: false,
                });
              } catch (err) {
                const errorMsg =
                  err instanceof Error ? err.message : String(err);
                onThinking?.(`❌ Auto-report generation failed: ${errorMsg}`);
                allToolResults.push(
                  `[generate_interactive_report]: Error - ${errorMsg}`
                );
              }

              // Break the loop - we've created the report
              break;
            }

            onThinking?.(
              `📝 No more tool calls needed. Finalizing response...`
            );
            break;
          }
        }

        if (iteration >= MAX_SWARM_ITERATIONS) {
          onThinking?.(
            `⏰ Reached max iterations (${MAX_SWARM_ITERATIONS}). Returning current results.`
          );
        }

        let finalContent = lastContent;

        const hasExplicitRefusal = detectRefusal(lastContent);
        const hasSemanticReframing = detectSemanticReframing(task, lastContent);
        
        if (hasExplicitRefusal || hasSemanticReframing) {
          const reason = hasExplicitRefusal 
            ? "Frontier model refused" 
            : "Frontier model reframed query (defensive instead of offensive content)";
          onThinking?.(
            `🚫 ${reason}. Activating Dolphin fallback with comprehensive research...`
          );
          
          let webSearchResults = allToolResults
            .filter(r => r.startsWith("[web_search]:") || r.startsWith("[searxng_search]:") || r.startsWith("[browse_url]:"))
            .join("\n\n");
          
          if (!webSearchResults || webSearchResults.length < 500) {
            onThinking?.(`🔍 Performing comprehensive web research first...`);
            const researchResults = await performDolphinResearch(
              task,
              (status) => onThinking?.(`🔍 ${status}`)
            );
            if (researchResults.text) {
              webSearchResults = webSearchResults 
                ? `${webSearchResults}\n\n---\n\n${researchResults.text}`
                : researchResults.text;
              // Images from second fallback block aren't used for report generation
              // since this branch doesn't auto-generate reports
            }
          }
          
          onThinking?.(`🐬 Querying local models with ${webSearchResults.length} chars of research...`);
          const dolphinResponse = await queryLocalFallbackWithQwenEnhancement(
            task,
            webSearchResults,
            (status) => onThinking?.(`🐬 Local: ${status}`)
          );
          
          if (dolphinResponse && dolphinResponse.content) {
            onThinking?.(
              `✅ Local models provided comprehensive response (${dolphinResponse.content.length} chars)`
            );
            finalContent = dolphinResponse.content;
            usedDolphinFallback = true;
          } else {
            onThinking?.(
              `⚠️ Dolphin fallback unavailable. Using original response.`
            );
          }
        }

        const finalOutput =
          allToolResults.length > 0
            ? `${finalContent}\n\nTool Results:\n${allToolResults.join("\n")}`
            : finalContent;

        return {
          success: true,
          output: finalOutput,
          durationMs: Date.now() - startTime,
          metadata: {
            model: usedDolphinFallback ? "dolphin-fallback" : "frontier",
            tokensUsed: 0,
            toolCalls: toolsUsed.size,
            iterations: iteration,
          },
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        onThinking?.(`❌ Error: ${errorMsg}`);
        return {
          success: false,
          output: `Error: ${errorMsg}`,
          error: errorMsg,
          durationMs: Date.now() - startTime,
        };
      }
    },
  };
}
