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
  analyzeTask,
  getGlobalCoordinator,
  type TaskAnalysis,
  type AgentTask,
} from "./agentCoordinator";
import { getToolsForAgent, getToolMetadata } from "./toolMetadata";
import {
  getGlobalMemoryClient,
  enrichContextWithMemory,
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
  getAgentMaxIterations,
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

type SwarmTaskStatus =
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
    executor: AgentExecutor
  ): Promise<SwarmExecutionResult> {
    const startTime = Date.now();
    const agentsUsed: AgentType[] = [];
    let learningsExtracted = 0;

    const analysis = await this.analyzeAndPlan(task);

    let enrichedContext = context;
    if (this.config.enableMemoryEnrichment) {
      try {
        enrichedContext = await enrichContextWithMemory(context, task);
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
    const { primaryAgent, suggestedTools } = analysis;
    const behavior = getAgentBehavior(primaryAgent);
    const tools =
      suggestedTools.length > 0
        ? suggestedTools
        : behavior.selectTools(task, getToolsForAgent(primaryAgent));

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
}

export function createFrontierExecutor(
  toolExecutor?: (
    name: string,
    params: Record<string, unknown>
  ) => Promise<string>,
  options: FrontierExecutorOptions = {}
): AgentExecutor {
  const { enableConsensus = false, swarmOrchestrator } = options;

  return {
    async executeWithAgent(
      agentType: AgentType,
      task: string,
      tools: string[],
      _context: ExecutionContext
    ): Promise<ToolResult> {
      const startTime = Date.now();

      try {
        const adapter = await getGlobalFrontierAdapter();

        const toolDefs: ToolDefinition[] = tools.slice(0, 20).map(name => ({
          type: "function",
          function: {
            name,
            description: `Tool: ${name}`,
            parameters: { type: "object", properties: {} },
          },
        }));

        const messages: ChatMessage[] = [{ role: "user", content: task }];

        const result = await adapter.reason(agentType, messages, {
          tools: toolDefs.length > 0 ? toolDefs : undefined,
        });

        if (result.toolCalls && result.toolCalls.length > 0 && toolExecutor) {
          const toolResults: string[] = [];

          for (const call of result.toolCalls) {
            try {
              const params = JSON.parse(call.function.arguments);
              const toolName = call.function.name;

              if (
                enableConsensus &&
                swarmOrchestrator &&
                swarmOrchestrator.isHighRiskTool(toolName)
              ) {
                const consensus = await swarmOrchestrator.requestToolConsensus(
                  toolName,
                  params
                );
                if (consensus.decision !== "approved") {
                  toolResults.push(
                    `[${toolName}]: BLOCKED - Consensus ${consensus.decision} ` +
                      `(${Math.round(consensus.agreementPercentage * 100)}% agreement)`
                  );
                  continue;
                }
              }

              const toolResult = await toolExecutor(toolName, params);
              toolResults.push(`[${toolName}]: ${toolResult}`);
            } catch (err) {
              toolResults.push(`[${call.function.name}]: Error - ${err}`);
            }
          }

          return {
            success: true,
            output: `${result.content}\n\nTool Results:\n${toolResults.join("\n")}`,
            durationMs: Date.now() - startTime,
            metadata: {
              model: result.model,
              tokensUsed: result.tokensUsed,
              toolCalls: result.toolCalls.length,
            },
          };
        }

        return {
          success: true,
          output: result.content,
          durationMs: Date.now() - startTime,
          metadata: {
            model: result.model,
            tokensUsed: result.tokensUsed,
          },
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
