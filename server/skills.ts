/**
 * Skills Archive - Learning and self-improvement for JARVIS Agent
 *
 * Features:
 * - Pattern extraction from successful task executions
 * - Skill storage with confidence scoring
 * - Skill retrieval based on task similarity
 * - Self-modification logging for audit trail
 */

import { getDb } from "./db";
import { agentSkills, selfModificationLog } from "../drizzle/schema";
import { eq, and, desc, like } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";

// Type aliases
type AgentSkill = typeof agentSkills.$inferSelect;
type InsertAgentSkill = typeof agentSkills.$inferInsert;
type SelfModificationLog = typeof selfModificationLog.$inferSelect;

/**
 * Skills Manager - handles learning, retrieval, and self-improvement
 */
export class SkillsManager {
  private static instance: SkillsManager;

  private constructor() {}

  static getInstance(): SkillsManager {
    if (!SkillsManager.instance) {
      SkillsManager.instance = new SkillsManager();
    }
    return SkillsManager.instance;
  }

  /**
   * Extract and store a skill from a successful task execution
   */
  async learnFromTask(
    userId: number,
    taskData: {
      taskId: number;
      query: string;
      toolCalls: Array<{
        toolName: string;
        input: Record<string, unknown>;
        output: string;
        success: boolean;
      }>;
      finalResult: string;
      executionTimeMs: number;
    }
  ): Promise<{ skillId?: number; learned: boolean; reason?: string }> {
    const db = await getDb();
    if (!db) {
      return { learned: false, reason: "Database not available" };
    }

    // Only learn from successful tasks with multiple tool calls
    if (taskData.toolCalls.length < 2) {
      return { learned: false, reason: "Task too simple to learn from" };
    }

    const successfulCalls = taskData.toolCalls.filter(tc => tc.success);
    if (successfulCalls.length < taskData.toolCalls.length * 0.8) {
      return { learned: false, reason: "Too many failed tool calls" };
    }

    // Use LLM to extract a reusable pattern
    const extractionPrompt = `Analyze this successful task execution and extract a reusable skill pattern.

Task Query: ${taskData.query}

Tool Calls Executed:
${taskData.toolCalls.map((tc, i) => `${i + 1}. ${tc.toolName}(${JSON.stringify(tc.input).substring(0, 200)})`).join("\n")}

Final Result: ${taskData.finalResult.substring(0, 500)}

Extract:
1. A short, descriptive name for this skill (e.g., "deploy_nodejs_app", "analyze_csv_data")
2. A trigger condition that would indicate when to use this skill
3. The pattern of tool calls as a reusable template
4. Any preconditions or requirements

Respond in JSON format:
{
  "name": "skill_name",
  "triggerCondition": "when user asks to...",
  "pattern": "Step 1: ... Step 2: ...",
  "category": "category_name"
}`;

    try {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "You are a skill extraction system. Analyze task executions and extract reusable patterns. Always respond with valid JSON.",
          },
          { role: "user", content: extractionPrompt },
        ],
        response_format: { type: "json_object" },
      });

      const content = response.choices?.[0]?.message?.content;
      if (!content || typeof content !== "string") {
        return { learned: false, reason: "Failed to extract skill pattern" };
      }

      const skillData = JSON.parse(content);

      // Check if similar skill already exists
      const existingSkills = await db
        .select()
        .from(agentSkills)
        .where(
          and(
            eq(agentSkills.userId, userId),
            like(agentSkills.name, `%${skillData.name.split("_")[0]}%`)
          )
        );

      if (existingSkills.length > 0) {
        // Update existing skill's confidence and success count
        const existing = existingSkills[0];
        const currentConfidence =
          parseFloat(String(existing.confidence)) || 0.5;
        await db
          .update(agentSkills)
          .set({
            successCount: (existing.successCount || 0) + 1,
            confidence: String(Math.min(1.0, currentConfidence + 0.05)),
            lastUsedAt: new Date(),
          })
          .where(eq(agentSkills.id, existing.id));

        return {
          skillId: existing.id,
          learned: true,
          reason: "Updated existing skill confidence",
        };
      }

      // Create new skill
      const [newSkill] = await db
        .insert(agentSkills)
        .values({
          userId,
          name: skillData.name,
          description: `Learned from task: ${taskData.query.substring(0, 100)}`,
          triggerCondition: skillData.triggerCondition,
          pattern: skillData.pattern,
          category: skillData.category || "general",
          confidence: "0.6", // Start with moderate confidence
          successCount: 1,
          failureCount: 0,
          sourceTaskId: taskData.taskId,
          isActive: 1,
        })
        .$returningId();

      // Log the learning event
      await this.logSelfModification(db, {
        userId,
        modificationType: "skill_add",
        target: skillData.name,
        description: `Learned new skill: ${skillData.name}`,
        changeContent: JSON.stringify({
          skillName: skillData.name,
          trigger: skillData.triggerCondition,
          pattern: skillData.pattern,
        }),
        reason: `Extracted from successful task execution`,
      });

      return {
        skillId: newSkill.id,
        learned: true,
        reason: `Learned new skill: ${skillData.name}`,
      };
    } catch (error) {
      return {
        learned: false,
        reason: `Error extracting skill: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Find relevant skills for a given task query
   */
  async findRelevantSkills(
    userId: number,
    query: string,
    limit = 5
  ): Promise<AgentSkill[]> {
    const db = await getDb();
    if (!db) return [];

    // Get all active skills for user
    const skills = await db
      .select()
      .from(agentSkills)
      .where(and(eq(agentSkills.userId, userId), eq(agentSkills.isActive, 1)))
      .orderBy(desc(agentSkills.confidence));

    if (skills.length === 0) return [];

    // Use LLM to rank skills by relevance
    const rankingPrompt = `Given this user query and list of available skills, rank the skills by relevance.

User Query: ${query}

Available Skills:
${skills.map((s, i) => `${i + 1}. ${s.name}: ${s.triggerCondition} (confidence: ${s.confidence})`).join("\n")}

Return a JSON array of skill indices (1-based) in order of relevance, only including relevant skills:
{"relevant_indices": [1, 3, 5]}

If no skills are relevant, return: {"relevant_indices": []}`;

    try {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "You are a skill matching system. Identify which skills are relevant to a given query. Always respond with valid JSON.",
          },
          { role: "user", content: rankingPrompt },
        ],
        response_format: { type: "json_object" },
      });

      const content = response.choices?.[0]?.message?.content;
      if (!content || typeof content !== "string") return [];

      const { relevant_indices } = JSON.parse(content);
      if (!Array.isArray(relevant_indices)) return [];

      return relevant_indices
        .slice(0, limit)
        .map((idx: number) => skills[idx - 1])
        .filter(Boolean);
    } catch {
      // Fallback: return top skills by confidence
      return skills.slice(0, limit);
    }
  }

  /**
   * Record skill usage outcome
   */
  async recordSkillUsage(
    skillId: number,
    success: boolean,
    _executionTimeMs: number
  ): Promise<void> {
    const db = await getDb();
    if (!db) return;

    const [skill] = await db
      .select()
      .from(agentSkills)
      .where(eq(agentSkills.id, skillId));

    if (!skill) return;

    // Update skill statistics
    const newSuccessCount = (skill.successCount || 0) + (success ? 1 : 0);
    const newFailureCount = (skill.failureCount || 0) + (success ? 0 : 1);
    const totalUses = newSuccessCount + newFailureCount;

    // Adjust confidence based on success rate
    const successRate = newSuccessCount / totalUses;
    const newConfidence = Math.max(0.1, Math.min(1.0, successRate));

    await db
      .update(agentSkills)
      .set({
        successCount: newSuccessCount,
        failureCount: newFailureCount,
        confidence: String(newConfidence),
        lastUsedAt: new Date(),
      })
      .where(eq(agentSkills.id, skillId));
  }

  /**
   * Deactivate a skill that consistently fails
   */
  async deactivateUnreliableSkill(skillId: number): Promise<void> {
    const db = await getDb();
    if (!db) return;

    const [skill] = await db
      .select()
      .from(agentSkills)
      .where(eq(agentSkills.id, skillId));

    if (!skill) return;

    // Deactivate if failure rate > 50% with at least 5 uses
    const totalUses = (skill.successCount || 0) + (skill.failureCount || 0);
    const failureRate = (skill.failureCount || 0) / totalUses;

    if (totalUses >= 5 && failureRate > 0.5) {
      await db
        .update(agentSkills)
        .set({ isActive: 0 })
        .where(eq(agentSkills.id, skillId));

      await this.logSelfModification(db, {
        userId: skill.userId || 0,
        modificationType: "skill_update",
        target: skill.name,
        description: `Deactivated unreliable skill: ${skill.name}`,
        changeContent: JSON.stringify({
          action: "deactivate",
          reason: "High failure rate",
          failureRate,
          totalUses,
        }),
        reason: "High failure rate",
      });
    }
  }

  /**
   * Get all skills for a user
   */
  async getUserSkills(
    userId: number,
    includeInactive = false
  ): Promise<AgentSkill[]> {
    const db = await getDb();
    if (!db) return [];

    const conditions = [eq(agentSkills.userId, userId)];
    if (!includeInactive) {
      conditions.push(eq(agentSkills.isActive, 1));
    }

    return db
      .select()
      .from(agentSkills)
      .where(and(...conditions))
      .orderBy(desc(agentSkills.confidence));
  }

  /**
   * Delete a skill
   */
  async deleteSkill(skillId: number, userId: number): Promise<void> {
    const db = await getDb();
    if (!db) return;

    await db
      .delete(agentSkills)
      .where(and(eq(agentSkills.id, skillId), eq(agentSkills.userId, userId)));
  }

  /**
   * Log a self-modification event
   */
  private async logSelfModification(
    db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
    data: {
      userId: number;
      modificationType:
        | "tool_update"
        | "prompt_update"
        | "skill_add"
        | "skill_update"
        | "config_change"
        | "code_patch";
      target: string;
      description: string;
      changeContent?: string;
      previousState?: string;
      reason?: string;
    }
  ): Promise<void> {
    await db.insert(selfModificationLog).values({
      userId: data.userId,
      modificationType: data.modificationType,
      target: data.target,
      description: data.description,
      changeContent: data.changeContent,
      previousState: data.previousState,
      reason: data.reason,
      success: 1,
    });
  }

  /**
   * Get self-modification history
   */
  async getModificationHistory(
    userId: number,
    limit = 50
  ): Promise<SelfModificationLog[]> {
    const db = await getDb();
    if (!db) return [];

    return db
      .select()
      .from(selfModificationLog)
      .where(eq(selfModificationLog.userId, userId))
      .orderBy(desc(selfModificationLog.createdAt))
      .limit(limit);
  }

  /**
   * Rollback a self-modification
   */
  async rollbackModification(
    modificationId: number,
    userId: number
  ): Promise<{ success: boolean; error?: string }> {
    const db = await getDb();
    if (!db) return { success: false, error: "Database not available" };

    const [modification] = await db
      .select()
      .from(selfModificationLog)
      .where(
        and(
          eq(selfModificationLog.id, modificationId),
          eq(selfModificationLog.userId, userId)
        )
      );

    if (!modification) {
      return { success: false, error: "Modification not found" };
    }

    if (modification.rolledBack === 1) {
      return { success: false, error: "Already rolled back" };
    }

    // Handle rollback based on modification type
    switch (modification.modificationType) {
      case "skill_add":
        // Delete the skill that was added
        if (modification.target) {
          await db
            .delete(agentSkills)
            .where(
              and(
                eq(agentSkills.name, modification.target),
                eq(agentSkills.userId, userId)
              )
            );
        }
        break;

      case "skill_update":
        // Restore previous state if available
        if (modification.previousState) {
          const previousData = JSON.parse(modification.previousState);
          await db
            .update(agentSkills)
            .set(previousData)
            .where(
              and(
                eq(agentSkills.name, modification.target),
                eq(agentSkills.userId, userId)
              )
            );
        }
        break;

      // Add more rollback handlers as needed
    }

    // Mark as rolled back
    await db
      .update(selfModificationLog)
      .set({ rolledBack: 1, rolledBackAt: new Date() })
      .where(eq(selfModificationLog.id, modificationId));

    return { success: true };
  }
}

// Export singleton instance
export const skillsManager = SkillsManager.getInstance();

// ============================================================================
// Database Operations for Skills
// ============================================================================

/**
 * Get skill by ID
 */
export async function getSkill(
  skillId: number,
  userId: number
): Promise<AgentSkill | null> {
  const db = await getDb();
  if (!db) return null;

  const [skill] = await db
    .select()
    .from(agentSkills)
    .where(and(eq(agentSkills.id, skillId), eq(agentSkills.userId, userId)));

  return skill || null;
}

/**
 * Update skill
 */
export async function updateSkill(
  skillId: number,
  userId: number,
  data: Partial<InsertAgentSkill>
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db
    .update(agentSkills)
    .set(data)
    .where(and(eq(agentSkills.id, skillId), eq(agentSkills.userId, userId)));
}

/**
 * Get skills by category
 */
export async function getSkillsByCategory(
  userId: number,
  category: string
): Promise<AgentSkill[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(agentSkills)
    .where(
      and(
        eq(agentSkills.userId, userId),
        eq(agentSkills.category, category),
        eq(agentSkills.isActive, 1)
      )
    )
    .orderBy(desc(agentSkills.confidence));
}

/**
 * Get skill statistics for a user
 */
export async function getSkillStats(userId: number): Promise<{
  totalSkills: number;
  activeSkills: number;
  avgConfidence: number;
  totalSuccesses: number;
  totalFailures: number;
  categories: string[];
}> {
  const db = await getDb();
  if (!db) {
    return {
      totalSkills: 0,
      activeSkills: 0,
      avgConfidence: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      categories: [],
    };
  }

  const skills = await db
    .select()
    .from(agentSkills)
    .where(eq(agentSkills.userId, userId));

  const activeSkills = skills.filter(s => s.isActive === 1);
  const categories = Array.from(
    new Set(skills.map(s => s.category).filter((c): c is string => c !== null))
  );

  const avgConfidence =
    activeSkills.length > 0
      ? activeSkills.reduce(
          (sum, s) => sum + (parseFloat(String(s.confidence)) || 0),
          0
        ) / activeSkills.length
      : 0;

  return {
    totalSkills: skills.length,
    activeSkills: activeSkills.length,
    avgConfidence,
    totalSuccesses: skills.reduce((sum, s) => sum + (s.successCount || 0), 0),
    totalFailures: skills.reduce((sum, s) => sum + (s.failureCount || 0), 0),
    categories,
  };
}
