/**
 * Self-Improvement Data Collection Pipeline
 *
 * Collects, processes, and prepares training data from successful JARVIS tasks.
 * This data can be used for:
 * - Fine-tuning local models
 * - Improving prompt templates
 * - Analyzing task patterns
 */

import { getDb } from "../../db";
import {
  trainingData,
  learningEvents,
  agentTasks,
  agentMessages,
  agentToolCalls,
  type AgentTask,
  type AgentMessage,
} from "../../../drizzle/schema";
import { eq, and, desc, sql, gte } from "drizzle-orm";
import { getMemoryService } from "../memory";

// Training data formats
export interface ConversationTurn {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCall?: {
    name: string;
    arguments: Record<string, unknown>;
  };
  toolResult?: string;
}

export interface TrainingExample {
  id: number;
  taskId: number;
  type:
    | "conversation"
    | "tool_usage"
    | "reasoning"
    | "code_generation"
    | "error_recovery";
  input: string;
  output: string;
  quality: number;
  metadata?: Record<string, unknown>;
}

export interface FineTuningDataset {
  format: "alpaca" | "sharegpt" | "openai";
  examples: Array<{
    instruction?: string;
    input?: string;
    output?: string;
    conversations?: ConversationTurn[];
    messages?: Array<{ role: string; content: string }>;
  }>;
  stats: {
    totalExamples: number;
    avgQuality: number;
    byType: Record<string, number>;
  };
}

/**
 * Collect training data from a completed task
 */
export async function collectTrainingDataFromTask(
  taskId: number
): Promise<number> {
  const database = await getDb();
  if (!database) return 0;

  // Get task details
  const task = await database
    .select()
    .from(agentTasks)
    .where(eq(agentTasks.id, taskId))
    .limit(1);

  if (task.length === 0 || task[0].status !== "completed") {
    return 0;
  }

  const taskData = task[0];
  let dataCollected = 0;

  // Get all messages for this task
  const messages = await database
    .select()
    .from(agentMessages)
    .where(eq(agentMessages.taskId, taskId))
    .orderBy(agentMessages.createdAt);

  // Get all tool calls for this task
  const toolCalls = await database
    .select()
    .from(agentToolCalls)
    .where(eq(agentToolCalls.taskId, taskId))
    .orderBy(agentToolCalls.createdAt);

  const memoryService = getMemoryService();

  // 1. Store conversation as training data
  if (messages.length > 0) {
    const conversationInput = taskData.query;
    const conversationOutput =
      taskData.result || messages[messages.length - 1].content;

    await memoryService.storeTrainingData({
      taskId,
      dataType: "conversation",
      input: conversationInput,
      output: conversationOutput,
      qualityScore: calculateConversationQuality(messages, taskData),
      usedForTraining: false,
      metadata: {
        messageCount: messages.length,
        duration: taskData.durationMs,
      },
    });
    dataCollected++;
  }

  // 2. Store tool usage examples
  for (const toolCall of toolCalls) {
    if (toolCall.status === "completed" && toolCall.output) {
      await memoryService.storeTrainingData({
        taskId,
        dataType: "tool_usage",
        input: JSON.stringify({
          context: taskData.query,
          tool: toolCall.toolName,
          arguments: toolCall.input,
        }),
        output: toolCall.output,
        qualityScore: toolCall.errorMessage ? 50 : 85,
        usedForTraining: false,
        metadata: {
          toolName: toolCall.toolName,
          duration: toolCall.durationMs,
        },
      });
      dataCollected++;
    }
  }

  const thinkingMessages = messages.filter(m => m.thinking);
  for (const msg of thinkingMessages) {
    await memoryService.storeTrainingData({
      taskId,
      dataType: "reasoning",
      input: taskData.query,
      output: msg.thinking ?? "",
      qualityScore: 75,
      usedForTraining: false,
    });
    dataCollected++;
  }

  const codeToolCalls = toolCalls.filter(
    tc =>
      tc.toolName === "execute_python" || tc.toolName === "execute_javascript"
  );
  for (const codeCall of codeToolCalls) {
    if (codeCall.status === "completed") {
      const inputObj = codeCall.input as { code?: string };
      const codeInput = inputObj?.code || "";
      await memoryService.storeTrainingData({
        taskId,
        dataType: "code_generation",
        input: JSON.stringify({
          task: taskData.query,
          language:
            codeCall.toolName === "execute_python" ? "python" : "javascript",
        }),
        output: codeInput,
        qualityScore: codeCall.errorMessage ? 60 : 80,
        usedForTraining: false,
        metadata: {
          language:
            codeCall.toolName === "execute_python" ? "python" : "javascript",
          hasError: !!codeCall.errorMessage,
        },
      });
      dataCollected++;
    }
  }

  return dataCollected;
}

/**
 * Export training data in various formats for fine-tuning
 */
export async function exportTrainingData(
  format: "alpaca" | "sharegpt" | "openai",
  options: {
    minQuality?: number;
    dataTypes?: string[];
    limit?: number;
    markAsUsed?: boolean;
  } = {}
): Promise<FineTuningDataset> {
  const database = await getDb();
  if (!database) {
    return {
      format,
      examples: [],
      stats: { totalExamples: 0, avgQuality: 0, byType: {} },
    };
  }

  const {
    minQuality = 70,
    dataTypes,
    limit = 1000,
    markAsUsed = false,
  } = options;

  // Build query conditions
  const conditions = [
    eq(trainingData.usedForTraining, 0),
    sql`${trainingData.qualityScore} >= ${minQuality}`,
  ];

  const results = await database
    .select()
    .from(trainingData)
    .where(and(...conditions))
    .orderBy(desc(trainingData.qualityScore))
    .limit(limit);

  const filtered = dataTypes
    ? results.filter(r => dataTypes.includes(r.dataType))
    : results;

  const examples = filtered.map(row => {
    switch (format) {
      case "alpaca":
        return {
          instruction:
            row.dataType === "conversation"
              ? "Complete the following task:"
              : `Perform ${row.dataType}:`,
          input: row.input,
          output: row.output,
        };

      case "sharegpt":
        return {
          conversations: [
            { role: "user" as const, content: row.input },
            { role: "assistant" as const, content: row.output },
          ],
        };

      case "openai":
        return {
          messages: [
            { role: "user", content: row.input },
            { role: "assistant", content: row.output },
          ],
        };

      default:
        return { input: row.input, output: row.output };
    }
  });

  const byType: Record<string, number> = {};
  let totalQuality = 0;
  for (const row of filtered) {
    byType[row.dataType] = (byType[row.dataType] || 0) + 1;
    totalQuality += row.qualityScore;
  }

  if (markAsUsed && filtered.length > 0) {
    const ids = filtered.map(r => r.id);
    for (const id of ids) {
      await database
        .update(trainingData)
        .set({ usedForTraining: 1 })
        .where(eq(trainingData.id, id));
    }
  }

  return {
    format,
    examples,
    stats: {
      totalExamples: filtered.length,
      avgQuality: filtered.length > 0 ? totalQuality / filtered.length : 0,
      byType,
    },
  };
}

/**
 * Analyze learning patterns over time
 */
export async function analyzeLearningPatterns(
  userId?: number,
  days: number = 30
): Promise<{
  totalLearningEvents: number;
  eventsByType: Record<string, number>;
  topSkillsImproved: Array<{ skill: string; count: number }>;
  errorPatterns: Array<{ pattern: string; count: number }>;
  successRate: number;
}> {
  const database = await getDb();
  if (!database) {
    return {
      totalLearningEvents: 0,
      eventsByType: {},
      topSkillsImproved: [],
      errorPatterns: [],
      successRate: 0,
    };
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const conditions = [gte(learningEvents.createdAt, cutoffDate)];
  if (userId) conditions.push(eq(learningEvents.userId, userId));

  const events = await database
    .select()
    .from(learningEvents)
    .where(and(...conditions))
    .orderBy(desc(learningEvents.createdAt));

  // Count by type
  const eventsByType: Record<string, number> = {};
  const skillCounts: Record<string, number> = {};
  const errorCounts: Record<string, number> = {};
  let successCount = 0;

  for (const event of events) {
    eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;

    if (
      event.eventType === "skill_improved" ||
      event.eventType === "skill_acquired"
    ) {
      const content = event.content as { toolsUsed?: string[] } | null;
      if (content?.toolsUsed) {
        for (const tool of content.toolsUsed) {
          skillCounts[tool] = (skillCounts[tool] || 0) + 1;
        }
      }
    }

    if (event.eventType === "error_learned") {
      const errorPattern = event.summary.slice(0, 50);
      errorCounts[errorPattern] = (errorCounts[errorPattern] || 0) + 1;
    }

    if (
      event.eventType === "skill_improved" ||
      event.eventType === "new_knowledge"
    ) {
      successCount++;
    }
  }

  return {
    totalLearningEvents: events.length,
    eventsByType,
    topSkillsImproved: Object.entries(skillCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([skill, count]) => ({ skill, count })),
    errorPatterns: Object.entries(errorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([pattern, count]) => ({ pattern, count })),
    successRate: events.length > 0 ? (successCount / events.length) * 100 : 0,
  };
}

/**
 * Generate improvement suggestions based on learning data
 */
export async function generateImprovementSuggestions(
  userId?: number
): Promise<string[]> {
  const patterns = await analyzeLearningPatterns(userId, 30);
  const suggestions: string[] = [];

  // Suggest based on error patterns
  if (patterns.errorPatterns.length > 0) {
    const topError = patterns.errorPatterns[0];
    suggestions.push(
      `Consider creating a procedure for handling "${topError.pattern}" - it occurred ${topError.count} times`
    );
  }

  // Suggest based on success rate
  if (patterns.successRate < 70) {
    suggestions.push(
      `Success rate is ${patterns.successRate.toFixed(1)}% - consider reviewing failed tasks for common issues`
    );
  }

  // Suggest based on skill usage
  if (patterns.topSkillsImproved.length > 0) {
    const topSkill = patterns.topSkillsImproved[0];
    suggestions.push(
      `${topSkill.skill} is your most used tool (${topSkill.count} times) - consider optimizing prompts for it`
    );
  }

  // Suggest training data export
  const memoryService = getMemoryService();
  const stats = await memoryService.getStats(userId);
  if (stats.totalTrainingData > 100) {
    suggestions.push(
      `You have ${stats.totalTrainingData} training examples - consider fine-tuning a local model`
    );
  }

  return suggestions;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateConversationQuality(
  messages: AgentMessage[],
  task: AgentTask
): number {
  let quality = 70;

  if (task.status === "completed") quality += 15;

  if (messages.length <= 5) quality += 10;
  else if (messages.length > 10) quality -= 10;

  if (task.durationMs && task.durationMs < 30000) quality += 5;

  return Math.min(Math.max(quality, 0), 100);
}

/**
 * Schedule periodic training data collection
 */
export async function runPeriodicCollection(): Promise<{
  tasksProcessed: number;
  dataCollected: number;
}> {
  const database = await getDb();
  if (!database) return { tasksProcessed: 0, dataCollected: 0 };

  // Get completed tasks that haven't been processed
  const recentTasks = await database
    .select()
    .from(agentTasks)
    .where(eq(agentTasks.status, "completed"))
    .orderBy(desc(agentTasks.completedAt))
    .limit(50);

  let tasksProcessed = 0;
  let dataCollected = 0;

  for (const task of recentTasks) {
    // Check if we already have training data for this task
    const existing = await database
      .select()
      .from(trainingData)
      .where(eq(trainingData.taskId, task.id))
      .limit(1);

    if (existing.length === 0) {
      const collected = await collectTrainingDataFromTask(task.id);
      if (collected > 0) {
        tasksProcessed++;
        dataCollected += collected;
      }
    }
  }

  return { tasksProcessed, dataCollected };
}
