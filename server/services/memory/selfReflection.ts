/**
 * Self-Reflection System - Analyze task outcomes and learn from experiences
 *
 * After each task, JARVIS reflects on:
 * 1. What worked well
 * 2. What could be improved
 * 3. New patterns or skills to remember
 * 4. Errors to avoid in the future
 */

import { invokeLLM } from "../../_core/llm";
import { createMemorySystem, MemorySystem } from "./memorySystem";
import { getDb } from "../../db";
import {
  agentTasks as _agentTasks,
  agentToolCalls as _agentToolCalls,
  selfModificationLog,
} from "../../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

export interface TaskReflection {
  taskId: number;
  success: boolean;
  summary: string;
  whatWorked: string[];
  whatFailed: string[];
  lessonsLearned: string[];
  suggestedImprovements: string[];
  newSkills: Array<{
    name: string;
    description: string;
    triggerCondition: string;
    pattern: string;
  }>;
  confidenceScore: number;
}

export interface ReflectionContext {
  taskDescription: string;
  toolCalls: Array<{
    toolName: string;
    input: unknown;
    output: unknown;
    success: boolean;
    duration: number;
  }>;
  finalResult: string;
  userFeedback?: string;
  errorMessages: string[];
}

/**
 * Self-Reflection System for JARVIS
 */
export class SelfReflectionSystem {
  private memorySystem: MemorySystem;
  private userId: number;

  constructor(userId: number) {
    this.userId = userId;
    this.memorySystem = createMemorySystem(userId);
  }

  /**
   * Perform reflection after task completion
   */
  async reflectOnTask(
    taskId: number,
    context: ReflectionContext
  ): Promise<TaskReflection> {
    // Generate reflection using LLM
    const reflectionPrompt = this.buildReflectionPrompt(context);

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a self-reflection system for an AI agent named JARVIS. 
Your job is to analyze task execution and extract learnings.
Be specific, actionable, and honest about both successes and failures.
Output your analysis as JSON.`,
        },
        { role: "user", content: reflectionPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "task_reflection",
          strict: true,
          schema: {
            type: "object",
            properties: {
              success: {
                type: "boolean",
                description: "Whether the task was successful",
              },
              summary: {
                type: "string",
                description: "Brief summary of what happened",
              },
              whatWorked: {
                type: "array",
                items: { type: "string" },
                description: "List of things that worked well",
              },
              whatFailed: {
                type: "array",
                items: { type: "string" },
                description: "List of things that failed or could be improved",
              },
              lessonsLearned: {
                type: "array",
                items: { type: "string" },
                description: "Key lessons to remember for future tasks",
              },
              suggestedImprovements: {
                type: "array",
                items: { type: "string" },
                description: "Specific improvements to make",
              },
              newSkills: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    description: { type: "string" },
                    triggerCondition: { type: "string" },
                    pattern: { type: "string" },
                  },
                  required: [
                    "name",
                    "description",
                    "triggerCondition",
                    "pattern",
                  ],
                  additionalProperties: false,
                },
                description: "New skills or patterns learned",
              },
              confidenceScore: {
                type: "number",
                description: "Confidence in this reflection (0-1)",
              },
            },
            required: [
              "success",
              "summary",
              "whatWorked",
              "whatFailed",
              "lessonsLearned",
              "suggestedImprovements",
              "newSkills",
              "confidenceScore",
            ],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = response.choices[0]?.message?.content;
    const reflectionContent =
      typeof rawContent === "string" ? rawContent : "{}";
    let reflection: TaskReflection;

    try {
      const parsed = JSON.parse(reflectionContent);
      reflection = {
        taskId,
        ...parsed,
      };
    } catch {
      reflection = {
        taskId,
        success: context.errorMessages.length === 0,
        summary: "Reflection parsing failed",
        whatWorked: [],
        whatFailed: ["Reflection system error"],
        lessonsLearned: [],
        suggestedImprovements: [],
        newSkills: [],
        confidenceScore: 0.1,
      };
    }

    // Store reflection in memory
    await this.storeReflection(taskId, context, reflection);

    // Store new skills
    for (const skill of reflection.newSkills) {
      await this.memorySystem.storeSkill({
        name: skill.name,
        description: skill.description,
        triggerCondition: skill.triggerCondition,
        pattern: skill.pattern,
        sourceTaskId: taskId,
        category: "learned",
      });
    }

    await this.memorySystem.recordLearningEvent({
      eventType: "pattern_detected",
      taskId,
      summary: reflection.summary,
      content: {
        taskDescription: context.taskDescription,
        reflection,
        suggestedImprovements: reflection.suggestedImprovements,
      },
      confidence: Math.round(reflection.confidenceScore * 100),
    });

    return reflection;
  }

  /**
   * Build the reflection prompt
   */
  private buildReflectionPrompt(context: ReflectionContext): string {
    const toolSummary = context.toolCalls
      .map(t => `- ${t.toolName}: ${t.success ? "✓" : "✗"} (${t.duration}ms)`)
      .join("\n");

    const errorSummary =
      context.errorMessages.length > 0
        ? `\nErrors encountered:\n${context.errorMessages.map(e => `- ${e}`).join("\n")}`
        : "";

    return `Analyze this task execution and provide a detailed reflection:

## Task Description
${context.taskDescription}

## Tool Calls
${toolSummary}

## Final Result
${context.finalResult}
${errorSummary}
${context.userFeedback ? `\n## User Feedback\n${context.userFeedback}` : ""}

Please analyze:
1. Was the task successful? Why or why not?
2. What approaches worked well?
3. What could have been done better?
4. What lessons should be remembered for similar future tasks?
5. Are there any new skills or patterns worth saving?`;
  }

  /**
   * Store reflection as episodic memory
   */
  private async storeReflection(
    taskId: number,
    context: ReflectionContext,
    reflection: TaskReflection
  ): Promise<void> {
    const memoryType = reflection.success ? "task_success" : "task_failure";
    const importance = reflection.success ? 0.6 : 0.8; // Failures are more important to remember

    await this.memorySystem.storeEpisodicMemory({
      taskId,
      memoryType,
      title: `Task: ${context.taskDescription.slice(0, 100)}`,
      description: reflection.summary,
      context: JSON.stringify({
        toolCalls: context.toolCalls.map(t => t.toolName),
        errorCount: context.errorMessages.length,
      }),
      outcome: context.finalResult,
      lessons: reflection.lessonsLearned,
      importance,
      tags: [memoryType, ...context.toolCalls.map(t => t.toolName)],
    });
  }

  /**
   * Get relevant past experiences for a new task
   */
  async getRelevantExperiences(taskDescription: string): Promise<{
    memories: Array<{ title: string; lessons: string[]; relevance: number }>;
    skills: Array<{ name: string; pattern: string; confidence: number }>;
  }> {
    // Search for relevant memories
    const memoryResults = await this.memorySystem.searchMemories(
      taskDescription,
      {
        limit: 5,
        minImportance: 0.3,
      }
    );

    // Get relevant skills
    const skills = await this.memorySystem.getRelevantSkills(taskDescription);

    return {
      memories: memoryResults.map(r => ({
        title: r.memory.title,
        lessons: r.memory.tags,
        relevance: r.relevanceScore,
      })),
      skills: skills.slice(0, 5).map(s => ({
        name: s.name,
        pattern: s.pattern,
        confidence: parseFloat(s.confidence || "0.5"),
      })),
    };
  }

  /**
   * Suggest improvements based on accumulated learnings
   */
  async suggestImprovements(): Promise<string[]> {
    const db = await getDb();
    if (!db) return [];

    const recentLearnings = await db
      .select()
      .from(selfModificationLog)
      .where(eq(selfModificationLog.userId, this.userId))
      .orderBy(desc(selfModificationLog.createdAt))
      .limit(20);

    // Get memory stats
    const stats = await this.memorySystem.getStats();

    // Generate improvement suggestions
    const prompt = `Based on these recent learnings and statistics, suggest 3-5 specific improvements:

Recent Modifications:
${recentLearnings.map(l => `- ${l.modificationType}: ${l.description}`).join("\n")}

Memory Statistics:
- Total memories: ${stats.totalMemories}
- Total skills: ${stats.totalSkills}
- Learning events: ${stats.learningEvents}

Suggest concrete, actionable improvements for the AI agent.`;

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are an AI improvement advisor. Suggest specific, actionable improvements.",
        },
        { role: "user", content: prompt },
      ],
    });

    const rawContent = response.choices[0]?.message?.content;
    const content = typeof rawContent === "string" ? rawContent : "";

    const suggestions = content
      .split("\n")
      .filter(
        (line: string) =>
          line.trim().startsWith("-") || line.trim().match(/^\d+\./)
      )
      .map((line: string) => line.replace(/^[-\d.]+\s*/, "").trim())
      .filter((s: string) => s.length > 10);

    return suggestions;
  }

  /**
   * Perform periodic self-improvement
   */
  async performSelfImprovement(): Promise<{
    memoriesConsolidated: number;
    skillsUpdated: number;
    improvementsMade: string[];
  }> {
    // Consolidate old memories
    await this.memorySystem.consolidateMemories();

    // Get improvement suggestions
    const suggestions = await this.suggestImprovements();

    await this.memorySystem.recordLearningEvent({
      eventType: "skill_improved",
      summary: "Periodic self-improvement cycle",
      content: { improvements: suggestions },
    });

    return {
      memoriesConsolidated: 0, // Would be tracked in consolidateMemories
      skillsUpdated: 0,
      improvementsMade: suggestions,
    };
  }
}

/**
 * Create a self-reflection system instance for a user
 */
export function createSelfReflectionSystem(
  userId: number
): SelfReflectionSystem {
  return new SelfReflectionSystem(userId);
}
