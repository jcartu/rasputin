/**
 * Multi-Agent Orchestrator
 * Coordinates multiple specialized agents to accomplish complex tasks
 */

import { agentManager } from "./agentManager";
import {
  Agent,
  AgentType,
  TaskDelegation,
  AgentResult,
  Subtask,
  AGENT_CONFIGS,
} from "./types";
import { invokeLLM } from "../../_core/llm";

interface OrchestrationPlan {
  analysis: string;
  subtasks: TaskDelegation[];
  executionOrder: "parallel" | "sequential" | "mixed";
  dependencies: Map<number, number[]>;
}

interface OrchestrationResult {
  success: boolean;
  finalOutput: string;
  subtaskResults: Map<number, AgentResult>;
  totalTokensUsed: number;
  totalExecutionTimeMs: number;
}

export class MultiAgentOrchestrator {
  private orchestratorAgentId: number | null = null;

  /**
   * Execute a complex task using multiple agents
   */
  async executeTask(
    userId: number,
    taskId: number,
    task: string
  ): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const subtaskResults = new Map<number, AgentResult>();
    let totalTokensUsed = 0;

    try {
      // Spawn the orchestrator agent
      const orchestrator = await agentManager.spawnAgent(
        userId,
        { type: "orchestrator", name: "main-orchestrator" },
        undefined,
        taskId
      );
      this.orchestratorAgentId = orchestrator.id;

      // Plan the task execution
      const plan = await this.planExecution(orchestrator.id, task);
      totalTokensUsed += 500; // Approximate tokens for planning

      if (plan.subtasks.length === 0) {
        // Simple task, execute directly
        const result = await agentManager.executeAgent(orchestrator.id, task);
        totalTokensUsed += result.tokensUsed;

        return {
          success: result.success,
          finalOutput: String(result.output || result.error || ""),
          subtaskResults,
          totalTokensUsed,
          totalExecutionTimeMs: Date.now() - startTime,
        };
      }

      // Create and execute subtasks
      const subtasks: Subtask[] = [];
      for (const delegation of plan.subtasks) {
        const subtask = await agentManager.createSubtask(
          taskId,
          orchestrator.id,
          delegation
        );
        subtasks.push(subtask);
      }

      // Execute based on execution order
      if (plan.executionOrder === "parallel") {
        // Execute all subtasks in parallel
        const results = await Promise.all(
          subtasks.map(async subtask => {
            const result = await agentManager.executeAgent(
              subtask.assignedAgentId,
              subtask.description || subtask.title
            );
            await agentManager.updateSubtask(
              subtask.id,
              result.success ? "completed" : "failed",
              { result: result.output, error: result.error }
            );
            return { subtaskId: subtask.id, result };
          })
        );

        for (const { subtaskId, result } of results) {
          subtaskResults.set(subtaskId, result);
          totalTokensUsed += result.tokensUsed;
        }
      } else {
        // Execute sequentially (respecting dependencies)
        for (const subtask of subtasks) {
          // Check dependencies
          if (subtask.dependsOn && subtask.dependsOn.length > 0) {
            const allDependenciesMet = subtask.dependsOn.every(depId => {
              const depResult = subtaskResults.get(depId);
              return depResult && depResult.success;
            });

            if (!allDependenciesMet) {
              await agentManager.updateSubtask(subtask.id, "cancelled");
              continue;
            }
          }

          await agentManager.updateSubtask(subtask.id, "in_progress");

          const result = await agentManager.executeAgent(
            subtask.assignedAgentId,
            subtask.description || subtask.title
          );

          await agentManager.updateSubtask(
            subtask.id,
            result.success ? "completed" : "failed",
            { result: result.output, error: result.error }
          );

          subtaskResults.set(subtask.id, result);
          totalTokensUsed += result.tokensUsed;
        }
      }

      // Aggregate results
      const finalOutput = await this.aggregateResults(
        orchestrator.id,
        task,
        subtasks,
        subtaskResults
      );
      totalTokensUsed += 300; // Approximate tokens for aggregation

      // Mark orchestrator as completed
      await agentManager.updateAgentStatus(orchestrator.id, "completed");

      return {
        success: true,
        finalOutput,
        subtaskResults,
        totalTokensUsed,
        totalExecutionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      if (this.orchestratorAgentId) {
        await agentManager.updateAgentStatus(
          this.orchestratorAgentId,
          "failed"
        );
      }

      return {
        success: false,
        finalOutput: error instanceof Error ? error.message : "Unknown error",
        subtaskResults,
        totalTokensUsed,
        totalExecutionTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Plan the execution by breaking down the task
   */
  private async planExecution(
    orchestratorId: number,
    task: string
  ): Promise<OrchestrationPlan> {
    const planningPrompt = `You are a task planning agent. Analyze the following task and determine if it should be broken down into subtasks for specialized agents.

Available agent types:
- code: Programming, debugging, code analysis
- research: Web research, fact-checking, information gathering
- sysadmin: System administration, server management, DevOps
- data: Data analysis, visualization, processing

Task: ${task}

Respond in JSON format:
{
  "analysis": "Brief analysis of the task",
  "needsDecomposition": true/false,
  "subtasks": [
    {
      "subtaskTitle": "Title of subtask",
      "description": "Detailed description",
      "targetAgentType": "code|research|sysadmin|data",
      "priority": "low|normal|high|urgent",
      "dependsOn": [] // indices of subtasks this depends on
    }
  ],
  "executionOrder": "parallel|sequential|mixed"
}

If the task is simple and doesn't need decomposition, return an empty subtasks array.`;

    try {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "You are a task planning assistant. Always respond with valid JSON.",
          },
          { role: "user", content: planningPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "task_plan",
            strict: true,
            schema: {
              type: "object",
              properties: {
                analysis: { type: "string" },
                needsDecomposition: { type: "boolean" },
                subtasks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      subtaskTitle: { type: "string" },
                      description: { type: "string" },
                      targetAgentType: { type: "string" },
                      priority: { type: "string" },
                      dependsOn: { type: "array", items: { type: "number" } },
                    },
                    required: [
                      "subtaskTitle",
                      "description",
                      "targetAgentType",
                      "priority",
                    ],
                    additionalProperties: false,
                  },
                },
                executionOrder: { type: "string" },
              },
              required: [
                "analysis",
                "needsDecomposition",
                "subtasks",
                "executionOrder",
              ],
              additionalProperties: false,
            },
          },
        },
      });

      const rawContent = response.choices[0]?.message?.content;
      const content = typeof rawContent === "string" ? rawContent : "{}";
      const plan = JSON.parse(content);

      // Convert to TaskDelegation format
      const subtasks: TaskDelegation[] = (plan.subtasks || []).map(
        (s: {
          subtaskTitle: string;
          description: string;
          targetAgentType: string;
          priority: string;
          dependsOn?: number[];
        }) => ({
          subtaskTitle: s.subtaskTitle,
          description: s.description,
          targetAgentType: s.targetAgentType as AgentType,
          priority: s.priority as TaskDelegation["priority"],
          input: {},
          dependsOn: s.dependsOn,
        })
      );

      return {
        analysis: plan.analysis || "",
        subtasks,
        executionOrder: plan.executionOrder || "sequential",
        dependencies: new Map(),
      };
    } catch (error) {
      console.error("[MultiAgentOrchestrator] Planning failed:", error);
      return {
        analysis: "Failed to plan task",
        subtasks: [],
        executionOrder: "sequential",
        dependencies: new Map(),
      };
    }
  }

  /**
   * Aggregate results from all subtasks
   */
  private async aggregateResults(
    orchestratorId: number,
    originalTask: string,
    subtasks: Subtask[],
    results: Map<number, AgentResult>
  ): Promise<string> {
    // Build summary of results
    const resultSummaries: string[] = [];
    for (const subtask of subtasks) {
      const result = results.get(subtask.id);
      if (result) {
        resultSummaries.push(
          `## ${subtask.title}\n` +
            `Status: ${result.success ? "Success" : "Failed"}\n` +
            `Output: ${result.output || result.error || "No output"}\n`
        );
      }
    }

    const aggregationPrompt = `You are synthesizing results from multiple specialized agents.

Original Task: ${originalTask}

Subtask Results:
${resultSummaries.join("\n---\n")}

Please provide a comprehensive final answer that:
1. Synthesizes all the subtask results
2. Addresses the original task completely
3. Highlights any issues or failures
4. Provides actionable conclusions`;

    try {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "You are a result synthesis agent. Combine multiple agent outputs into a coherent final answer.",
          },
          { role: "user", content: aggregationPrompt },
        ],
      });

      const rawContent = response.choices[0]?.message?.content;
      return typeof rawContent === "string"
        ? rawContent
        : "Failed to aggregate results";
    } catch (error) {
      return `Aggregation failed: ${error instanceof Error ? error.message : "Unknown error"}\n\nRaw results:\n${resultSummaries.join("\n")}`;
    }
  }

  /**
   * Run a multi-agent task (simplified entry point)
   */
  async runTask(
    userId: number,
    task: string,
    coordinatorId?: number
  ): Promise<OrchestrationResult> {
    // Generate a task ID
    const taskId = Date.now();
    return this.executeTask(userId, taskId, task);
  }

  /**
   * Get status of an ongoing orchestration
   */
  async getOrchestrationStatus(taskId: number): Promise<{
    orchestrator: Agent | null;
    subtasks: Subtask[];
    progress: number;
  }> {
    const subtasks = await agentManager.getSubtasks(taskId);

    let orchestrator: Agent | null = null;
    if (this.orchestratorAgentId) {
      orchestrator = await agentManager.getAgent(this.orchestratorAgentId);
    }

    const completedCount = subtasks.filter(
      s => s.status === "completed" || s.status === "failed"
    ).length;
    const progress =
      subtasks.length > 0 ? (completedCount / subtasks.length) * 100 : 0;

    return {
      orchestrator,
      subtasks,
      progress,
    };
  }

  /**
   * Cancel an ongoing orchestration
   */
  async cancelOrchestration(taskId: number): Promise<void> {
    const subtasks = await agentManager.getSubtasks(taskId);

    for (const subtask of subtasks) {
      if (subtask.status === "pending" || subtask.status === "in_progress") {
        await agentManager.updateSubtask(subtask.id, "cancelled");
        await agentManager.terminateAgent(subtask.assignedAgentId);
      }
    }

    if (this.orchestratorAgentId) {
      await agentManager.terminateAgent(this.orchestratorAgentId);
      this.orchestratorAgentId = null;
    }
  }
}

// Singleton instance
export const multiAgentOrchestrator = new MultiAgentOrchestrator();
