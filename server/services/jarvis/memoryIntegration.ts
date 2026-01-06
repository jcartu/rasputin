/**
 * JARVIS Memory Integration
 *
 * Enhances the orchestrator with persistent memory capabilities:
 * - Pre-task context retrieval (what do I know about this?)
 * - Post-task learning (what did I learn?)
 * - Procedure matching (have I done this before?)
 * - Training data collection (for future fine-tuning)
 */

import { getMemoryService } from "../memory";
import type {
  MemoryContext,
  EpisodicMemory,
  SemanticMemory,
  ProceduralMemory,
  LearningEvent,
} from "../memory/types";

export interface TaskContext {
  taskId: number;
  userId?: number;
  query: string;
  memoryContext?: MemoryContext;
  matchedProcedure?: ProceduralMemory;
}

export interface TaskOutcome {
  success: boolean;
  result?: string;
  error?: string;
  toolsUsed: string[];
  duration: number;
  iterations: number;
}

/**
 * Format memory context for injection into system prompt
 */
export function formatMemoryForPrompt(context: MemoryContext): string {
  const sections: string[] = [];

  // Relevant past experiences
  if (context.relevantEpisodes.length > 0) {
    sections.push("## Relevant Past Experiences");
    for (const ep of context.relevantEpisodes) {
      sections.push(
        `- **${ep.memory.title}** (relevance: ${(ep.relevance * 100).toFixed(0)}%)`
      );
      sections.push(`  ${ep.memory.description}`);
      if (ep.memory.lessons && ep.memory.lessons.length > 0) {
        sections.push(`  Lessons learned: ${ep.memory.lessons.join("; ")}`);
      }
    }
  }

  // Relevant knowledge
  if (context.relevantKnowledge.length > 0) {
    sections.push("\n## Relevant Knowledge");
    for (const know of context.relevantKnowledge) {
      sections.push(
        `- ${know.memory.subject} ${know.memory.predicate} ${know.memory.object} (confidence: ${know.memory.confidence}%)`
      );
    }
  }

  // Relevant procedures
  if (context.relevantProcedures.length > 0) {
    sections.push("\n## Known Procedures");
    for (const proc of context.relevantProcedures) {
      sections.push(
        `- **${proc.memory.name}** (success rate: ${proc.memory.successRate}%, used ${proc.memory.executionCount} times)`
      );
      sections.push(`  ${proc.memory.description}`);
      if (
        proc.memory.triggerConditions &&
        proc.memory.triggerConditions.length > 0
      ) {
        sections.push(
          `  Use when: ${proc.memory.triggerConditions.join(", ")}`
        );
      }
    }
  }

  if (sections.length === 0) {
    return "";
  }

  return `\n\n--- MEMORY CONTEXT ---\n${sections.join("\n")}\n--- END MEMORY CONTEXT ---\n`;
}

/**
 * Get memory context before starting a task
 */
export async function getPreTaskContext(
  taskDescription: string,
  userId?: number
): Promise<{ context: MemoryContext; promptAddition: string }> {
  const memoryService = getMemoryService();

  const context = await memoryService.getContextForTask(
    taskDescription,
    userId,
    {
      maxEpisodic: 3,
      maxSemantic: 5,
      maxProcedural: 2,
    }
  );

  const promptAddition = formatMemoryForPrompt(context);

  return { context, promptAddition };
}

/**
 * Learn from a completed task
 */
export async function learnFromTask(
  taskContext: TaskContext,
  outcome: TaskOutcome
): Promise<void> {
  const memoryService = getMemoryService();

  // 1. Create episodic memory of this task
  const episodicMemory: Omit<EpisodicMemory, "id" | "createdAt" | "updatedAt"> =
    {
      userId: taskContext.userId,
      taskId: taskContext.taskId,
      memoryType: outcome.success ? "task_success" : "task_failure",
      title: taskContext.query.slice(0, 100),
      description: `Task: ${taskContext.query}`,
      context: `Tools available: ${outcome.toolsUsed.join(", ")}`,
      action: `Executed ${outcome.iterations} iterations using tools: ${outcome.toolsUsed.join(", ")}`,
      outcome: outcome.success
        ? `Successfully completed: ${outcome.result?.slice(0, 500) || "No result"}`
        : `Failed: ${outcome.error || "Unknown error"}`,
      lessons: extractLessons(outcome),
      entities: extractEntities(taskContext.query, outcome.toolsUsed),
      tags: generateTags(taskContext.query, outcome),
      importance: calculateImportance(outcome),
    };

  await memoryService.createEpisodicMemory(episodicMemory);

  // 2. Record learning event
  const learningEvent: Omit<LearningEvent, "id" | "createdAt"> = {
    userId: taskContext.userId,
    taskId: taskContext.taskId,
    eventType: outcome.success ? "skill_improved" : "error_learned",
    summary: outcome.success
      ? `Successfully completed task using ${outcome.toolsUsed.join(", ")}`
      : `Failed task - learned about error: ${outcome.error?.slice(0, 200)}`,
    content: {
      query: taskContext.query,
      toolsUsed: outcome.toolsUsed,
      duration: outcome.duration,
      iterations: outcome.iterations,
      success: outcome.success,
    },
    confidence: outcome.success ? 80 : 60,
    applied: false,
  };

  await memoryService.recordLearning(learningEvent);

  // 3. Store training data if successful
  if (outcome.success && outcome.result) {
    await memoryService.storeTrainingData({
      taskId: taskContext.taskId,
      dataType: "conversation",
      input: taskContext.query,
      output: outcome.result,
      qualityScore: calculateQualityScore(outcome),
      usedForTraining: false,
    });
  }

  // 4. Update procedure stats if a procedure was matched
  if (taskContext.matchedProcedure?.id) {
    await memoryService.recordProcedureExecution(
      taskContext.matchedProcedure.id,
      outcome.success,
      outcome.duration
    );
  }

  // 5. Extract and store new knowledge if task was successful
  if (outcome.success) {
    const newKnowledge = extractKnowledge(taskContext, outcome);
    for (const knowledge of newKnowledge) {
      await memoryService.createSemanticMemory(knowledge);
    }
  }
}

/**
 * Check if there's a known procedure for this task
 */
export async function findMatchingProcedure(
  taskDescription: string,
  userId?: number
): Promise<ProceduralMemory | null> {
  const memoryService = getMemoryService();
  return memoryService.findProcedureForTask(taskDescription, userId);
}

/**
 * Create a new procedure from a successful task
 */
export async function createProcedureFromTask(
  taskContext: TaskContext,
  outcome: TaskOutcome,
  steps: Array<{ action: string; tool?: string; result?: string }>
): Promise<number> {
  const memoryService = getMemoryService();

  const procedure: Omit<ProceduralMemory, "id" | "createdAt" | "updatedAt"> = {
    userId: taskContext.userId,
    name: `Procedure: ${taskContext.query.slice(0, 50)}`,
    description: `Learned procedure for: ${taskContext.query}`,
    triggerConditions: [taskContext.query],
    prerequisites: [],
    steps: steps.map((s, i) => ({
      order: i + 1,
      action: s.action,
      description: s.action,
      toolName: s.tool,
      expectedOutcome: s.result,
    })),
    postConditions: [],
    errorHandlers: [],
    successRate: 100,
    executionCount: 1,
    successCount: 1,
    avgExecutionTimeMs: outcome.duration,
    sourceTaskId: taskContext.taskId,
    isActive: true,
  };

  return memoryService.createProceduralMemory(procedure);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function extractLessons(outcome: TaskOutcome): string[] {
  const lessons: string[] = [];

  if (outcome.success) {
    if (outcome.iterations === 1) {
      lessons.push("Task completed efficiently in single iteration");
    } else if (outcome.iterations > 5) {
      lessons.push(
        "Task required multiple iterations - consider optimizing approach"
      );
    }

    if (outcome.toolsUsed.includes("web_search")) {
      lessons.push("Web search was useful for this type of task");
    }
    if (outcome.toolsUsed.includes("execute_python")) {
      lessons.push("Python execution was needed for this task");
    }
  } else {
    lessons.push(
      `Task failed: ${outcome.error?.slice(0, 100) || "Unknown error"}`
    );
    if (outcome.iterations >= 3) {
      lessons.push("Multiple retry attempts did not resolve the issue");
    }
  }

  return lessons;
}

function extractEntities(query: string, toolsUsed: string[]): string[] {
  const entities = new Set<string>();

  // Add tools as entities
  toolsUsed.forEach(tool => entities.add(`tool:${tool}`));

  // Extract potential entities from query (simple heuristic)
  const words = query.split(/\s+/);
  for (const word of words) {
    // URLs
    if (word.match(/^https?:\/\//)) {
      entities.add(`url:${word}`);
    }
    // File paths
    if (word.match(/^[\/~]/)) {
      entities.add(`path:${word}`);
    }
    // Capitalized words (potential proper nouns)
    if (word.match(/^[A-Z][a-z]+$/)) {
      entities.add(`name:${word}`);
    }
  }

  return Array.from(entities);
}

function generateTags(query: string, outcome: TaskOutcome): string[] {
  const tags: string[] = [];

  // Add outcome tag
  tags.push(outcome.success ? "success" : "failure");

  // Add tool-based tags
  if (outcome.toolsUsed.includes("web_search")) tags.push("research");
  if (outcome.toolsUsed.includes("execute_python")) tags.push("coding");
  if (outcome.toolsUsed.includes("execute_shell")) tags.push("system");
  if (outcome.toolsUsed.includes("ssh_execute")) tags.push("remote");
  if (outcome.toolsUsed.includes("generate_image")) tags.push("creative");
  if (outcome.toolsUsed.includes("http_request")) tags.push("api");

  // Add query-based tags (simple keyword detection)
  const queryLower = query.toLowerCase();
  if (queryLower.includes("deploy")) tags.push("deployment");
  if (queryLower.includes("debug") || queryLower.includes("fix"))
    tags.push("debugging");
  if (queryLower.includes("install")) tags.push("installation");
  if (queryLower.includes("create") || queryLower.includes("build"))
    tags.push("creation");
  if (queryLower.includes("analyze") || queryLower.includes("analysis"))
    tags.push("analysis");

  return tags;
}

function calculateImportance(outcome: TaskOutcome): number {
  let importance = 50;

  // Successful tasks are more important
  if (outcome.success) importance += 20;

  // Tasks that took more iterations are more notable
  if (outcome.iterations > 3) importance += 10;

  // Tasks using multiple tools are more complex/important
  if (outcome.toolsUsed.length > 3) importance += 10;

  // Cap at 100
  return Math.min(importance, 100);
}

function calculateQualityScore(outcome: TaskOutcome): number {
  let score = 70;

  if (outcome.success) score += 15;
  if (outcome.iterations <= 3) score += 10;
  if (outcome.duration < 30000) score += 5; // Under 30 seconds

  return Math.min(score, 100);
}

function extractKnowledge(
  taskContext: TaskContext,
  outcome: TaskOutcome
): Array<Omit<SemanticMemory, "id" | "createdAt" | "updatedAt">> {
  const knowledge: Array<
    Omit<SemanticMemory, "id" | "createdAt" | "updatedAt">
  > = [];

  // Extract tool effectiveness knowledge
  for (const tool of outcome.toolsUsed) {
    knowledge.push({
      userId: taskContext.userId,
      category: "domain_knowledge",
      subject: tool,
      predicate: "is_effective_for",
      object: taskContext.query.slice(0, 100),
      confidence: outcome.success ? 80 : 40,
      source: `task:${taskContext.taskId}`,
      sourceTaskId: taskContext.taskId,
      isValid: true,
    });
  }

  return knowledge;
}

/**
 * Get memory statistics for display
 */
export async function getMemoryStats(userId?: number) {
  const memoryService = getMemoryService();
  return memoryService.getStats(userId);
}
