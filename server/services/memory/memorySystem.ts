/**
 * Memory System - Long-term memory with vector embeddings for JARVIS
 * 
 * Three types of memory:
 * 1. Episodic Memory - Specific experiences and events (what happened)
 * 2. Semantic Memory - General knowledge and facts (what is known)
 * 3. Procedural Memory - Skills and how-to knowledge (how to do things)
 */

import { getDb } from "../../db";
import {
  episodicMemories,
  agentSkills,
  learningEvents,
} from "../../../drizzle/schema";
import { eq, desc, and, like, sql } from "drizzle-orm";
import { invokeLLM } from "../../_core/llm";

export interface Memory {
  id: number;
  type: "episodic" | "semantic" | "procedural";
  title: string;
  content: string;
  embedding?: number[];
  importance: number;
  lastAccessed: Date;
  accessCount: number;
  tags: string[];
}

export interface MemorySearchResult {
  memory: Memory;
  relevanceScore: number;
}

/**
 * Generate embedding for text using LLM
 */
async function generateEmbedding(text: string): Promise<number[]> {
  // Use a simple hash-based embedding for now
  // In production, this would use OpenAI's embedding API or similar
  const hash = simpleHash(text);
  const embedding: number[] = [];
  for (let i = 0; i < 384; i++) {
    embedding.push(Math.sin(hash * (i + 1)) * 0.5 + 0.5);
  }
  return embedding;
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash;
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export class MemorySystem {
  private userId: number;

  constructor(userId: number) {
    this.userId = userId;
  }

  /**
   * Store a new episodic memory (experience)
   */
  async storeEpisodicMemory(params: {
    taskId?: number;
    memoryType: "task_success" | "task_failure" | "user_preference" | "system_discovery" | "error_resolution" | "optimization" | "interaction";
    title: string;
    description: string;
    context?: Record<string, unknown>;
    outcome?: string;
    lessonsLearned?: string[];
    importance?: number;
    tags?: string[];
  }): Promise<number> {
    const db = getDb();
    
    const embedding = await generateEmbedding(
      `${params.title} ${params.description} ${params.outcome || ""}`
    );

    const result = await db.insert(episodicMemories).values({
      userId: this.userId,
      taskId: params.taskId,
      memoryType: params.memoryType,
      title: params.title,
      description: params.description,
      context: params.context,
      outcome: params.outcome,
      lessonsLearned: params.lessonsLearned,
      importance: params.importance?.toString() || "0.5",
      embedding: JSON.stringify(embedding),
      tags: params.tags,
    });

    return result[0].insertId;
  }

  /**
   * Store a learned skill (procedural memory)
   */
  async storeSkill(params: {
    name: string;
    description: string;
    triggerCondition: string;
    pattern: string;
    examples?: string[];
    category?: string;
    tags?: string[];
    sourceTaskId?: number;
  }): Promise<number> {
    const db = getDb();

    const result = await db.insert(agentSkills).values({
      userId: this.userId,
      name: params.name,
      description: params.description,
      triggerCondition: params.triggerCondition,
      pattern: params.pattern,
      examples: params.examples,
      category: params.category || "general",
      tags: params.tags,
      sourceTaskId: params.sourceTaskId,
    });

    return result[0].insertId;
  }

  /**
   * Record a learning event
   */
  async recordLearningEvent(params: {
    eventType: "task_completion" | "error_encountered" | "user_feedback" | "self_reflection" | "skill_acquisition" | "performance_improvement";
    sourceTaskId?: number;
    description: string;
    beforeState?: Record<string, unknown>;
    afterState?: Record<string, unknown>;
    improvement?: string;
    metrics?: Record<string, number>;
  }): Promise<number> {
    const db = getDb();

    const result = await db.insert(learningEvents).values({
      userId: this.userId,
      eventType: params.eventType,
      sourceTaskId: params.sourceTaskId,
      description: params.description,
      beforeState: params.beforeState,
      afterState: params.afterState,
      improvement: params.improvement,
      metrics: params.metrics,
    });

    return result[0].insertId;
  }

  /**
   * Search memories by semantic similarity
   */
  async searchMemories(
    query: string,
    options: {
      limit?: number;
      memoryTypes?: string[];
      minImportance?: number;
    } = {}
  ): Promise<MemorySearchResult[]> {
    const db = getDb();
    const limit = options.limit || 10;

    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query);

    // Get all memories for this user
    const memories = await db
      .select()
      .from(episodicMemories)
      .where(eq(episodicMemories.userId, this.userId))
      .orderBy(desc(episodicMemories.importance))
      .limit(100);

    // Calculate similarity scores
    const results: MemorySearchResult[] = memories
      .map((mem) => {
        let embedding: number[] = [];
        try {
          embedding = JSON.parse(mem.embedding || "[]");
        } catch {
          embedding = [];
        }

        const relevanceScore = embedding.length > 0
          ? cosineSimilarity(queryEmbedding, embedding)
          : 0;

        return {
          memory: {
            id: mem.id,
            type: "episodic" as const,
            title: mem.title,
            content: mem.description,
            importance: parseFloat(mem.importance || "0.5"),
            lastAccessed: mem.lastAccessedAt || new Date(),
            accessCount: mem.accessCount || 0,
            tags: mem.tags || [],
          },
          relevanceScore,
        };
      })
      .filter((r) => {
        if (options.minImportance && r.memory.importance < options.minImportance) {
          return false;
        }
        return r.relevanceScore > 0.3; // Minimum similarity threshold
      })
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);

    // Update access counts for retrieved memories
    for (const result of results) {
      await db
        .update(episodicMemories)
        .set({
          accessCount: sql`${episodicMemories.accessCount} + 1`,
          lastAccessedAt: new Date(),
        })
        .where(eq(episodicMemories.id, result.memory.id));
    }

    return results;
  }

  /**
   * Get relevant skills for a task
   */
  async getRelevantSkills(taskDescription: string): Promise<typeof agentSkills.$inferSelect[]> {
    const db = getDb();

    // Get all active skills for this user
    const skills = await db
      .select()
      .from(agentSkills)
      .where(
        and(
          eq(agentSkills.userId, this.userId),
          eq(agentSkills.isActive, 1)
        )
      )
      .orderBy(desc(agentSkills.confidence));

    // Filter skills by trigger condition match
    const relevantSkills = skills.filter((skill) => {
      const trigger = skill.triggerCondition.toLowerCase();
      const task = taskDescription.toLowerCase();
      
      // Simple keyword matching - in production, use semantic similarity
      const keywords = trigger.split(/\s+/);
      return keywords.some((keyword) => task.includes(keyword));
    });

    return relevantSkills;
  }

  /**
   * Update skill confidence based on outcome
   */
  async updateSkillConfidence(
    skillId: number,
    success: boolean
  ): Promise<void> {
    const db = getDb();

    if (success) {
      await db
        .update(agentSkills)
        .set({
          successCount: sql`${agentSkills.successCount} + 1`,
          confidence: sql`LEAST(1.0, ${agentSkills.confidence} + 0.05)`,
          lastUsedAt: new Date(),
        })
        .where(eq(agentSkills.id, skillId));
    } else {
      await db
        .update(agentSkills)
        .set({
          failureCount: sql`${agentSkills.failureCount} + 1`,
          confidence: sql`GREATEST(0.0, ${agentSkills.confidence} - 0.1)`,
          lastUsedAt: new Date(),
        })
        .where(eq(agentSkills.id, skillId));
    }
  }

  /**
   * Consolidate old memories (compress and summarize)
   */
  async consolidateMemories(): Promise<void> {
    const db = getDb();

    // Get old, low-importance memories
    const oldMemories = await db
      .select()
      .from(episodicMemories)
      .where(
        and(
          eq(episodicMemories.userId, this.userId),
          sql`${episodicMemories.createdAt} < DATE_SUB(NOW(), INTERVAL 30 DAY)`,
          sql`${episodicMemories.importance} < 0.5`
        )
      )
      .limit(50);

    if (oldMemories.length < 10) return;

    // Group memories by type and summarize
    const grouped = oldMemories.reduce((acc, mem) => {
      const type = mem.memoryType;
      if (!acc[type]) acc[type] = [];
      acc[type].push(mem);
      return acc;
    }, {} as Record<string, typeof oldMemories>);

    for (const [type, memories] of Object.entries(grouped)) {
      if (memories.length < 5) continue;

      // Generate summary using LLM
      const summaryPrompt = `Summarize these ${memories.length} experiences into key learnings:\n\n${memories.map((m) => `- ${m.title}: ${m.description}`).join("\n")}`;

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "You are a memory consolidation system. Summarize experiences into concise, actionable learnings." },
            { role: "user", content: summaryPrompt },
          ],
        });

        const summary = response.choices[0]?.message?.content || "";

        // Create consolidated memory
        await this.storeEpisodicMemory({
          memoryType: type as any,
          title: `Consolidated: ${type} learnings`,
          description: summary,
          importance: 0.7,
          tags: ["consolidated", type],
        });

        // Mark old memories as consolidated (or delete)
        for (const mem of memories) {
          await db
            .update(episodicMemories)
            .set({ importance: "0.1" })
            .where(eq(episodicMemories.id, mem.id));
        }
      } catch (error) {
        console.error("Memory consolidation failed:", error);
      }
    }
  }

  /**
   * Get memory statistics
   */
  async getStats(): Promise<{
    totalMemories: number;
    totalSkills: number;
    learningEvents: number;
    memoryByType: Record<string, number>;
  }> {
    const db = getDb();

    const [memories, skills, events] = await Promise.all([
      db
        .select({ count: sql<number>`COUNT(*)` })
        .from(episodicMemories)
        .where(eq(episodicMemories.userId, this.userId)),
      db
        .select({ count: sql<number>`COUNT(*)` })
        .from(agentSkills)
        .where(eq(agentSkills.userId, this.userId)),
      db
        .select({ count: sql<number>`COUNT(*)` })
        .from(learningEvents)
        .where(eq(learningEvents.userId, this.userId)),
    ]);

    // Get memory count by type
    const byType = await db
      .select({
        type: episodicMemories.memoryType,
        count: sql<number>`COUNT(*)`,
      })
      .from(episodicMemories)
      .where(eq(episodicMemories.userId, this.userId))
      .groupBy(episodicMemories.memoryType);

    const memoryByType: Record<string, number> = {};
    for (const row of byType) {
      memoryByType[row.type] = row.count;
    }

    return {
      totalMemories: memories[0]?.count || 0,
      totalSkills: skills[0]?.count || 0,
      learningEvents: events[0]?.count || 0,
      memoryByType,
    };
  }
}

/**
 * Create a memory system instance for a user
 */
export function createMemorySystem(userId: number): MemorySystem {
  return new MemorySystem(userId);
}
