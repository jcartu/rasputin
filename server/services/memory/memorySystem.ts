import { getDb } from "../../db";
import {
  episodicMemories,
  agentSkills,
  learningEvents,
} from "../../../drizzle/schema";
import { eq, desc, and, sql } from "drizzle-orm";
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

type EpisodicMemory = typeof episodicMemories.$inferSelect;
type AgentSkill = typeof agentSkills.$inferSelect;

async function generateEmbedding(text: string): Promise<number[]> {
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
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash;
}

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

  async storeEpisodicMemory(params: {
    taskId?: number;
    memoryType:
      | "task_success"
      | "task_failure"
      | "user_preference"
      | "system_discovery"
      | "error_resolution"
      | "optimization"
      | "interaction";
    title: string;
    description: string;
    context?: string;
    action?: string;
    outcome?: string;
    lessons?: string[];
    entities?: string[];
    tags?: string[];
    importance?: number;
  }): Promise<number> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const result = await db.insert(episodicMemories).values({
      userId: this.userId,
      taskId: params.taskId,
      memoryType: params.memoryType,
      title: params.title,
      description: params.description,
      context: params.context,
      action: params.action,
      outcome: params.outcome,
      lessons: params.lessons,
      entities: params.entities,
      tags: params.tags,
      importance: params.importance ?? 50,
    });

    return result[0].insertId;
  }

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
    const db = await getDb();
    if (!db) throw new Error("Database not available");

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

  async recordLearningEvent(params: {
    eventType:
      | "new_knowledge"
      | "skill_acquired"
      | "skill_improved"
      | "error_learned"
      | "preference_learned"
      | "pattern_detected"
      | "feedback_received";
    taskId?: number;
    summary: string;
    content?: Record<string, unknown>;
    confidence?: number;
  }): Promise<number> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const result = await db.insert(learningEvents).values({
      userId: this.userId,
      taskId: params.taskId,
      eventType: params.eventType,
      summary: params.summary,
      content: params.content,
      confidence: params.confidence ?? 70,
    });

    return result[0].insertId;
  }

  async searchMemories(
    query: string,
    options: {
      limit?: number;
      memoryTypes?: string[];
      minImportance?: number;
    } = {}
  ): Promise<MemorySearchResult[]> {
    const db = await getDb();
    if (!db) return [];

    const limit = options.limit || 10;
    const queryEmbedding = await generateEmbedding(query);

    const memories = await db
      .select()
      .from(episodicMemories)
      .where(eq(episodicMemories.userId, this.userId))
      .orderBy(desc(episodicMemories.importance))
      .limit(100);

    const results: MemorySearchResult[] = memories
      .map((mem: EpisodicMemory) => {
        let embedding: number[] = [];
        try {
          const embeddingStr = mem.embeddingId;
          if (embeddingStr) {
            embedding = JSON.parse(embeddingStr);
          }
        } catch {
          embedding = [];
        }

        const relevanceScore =
          embedding.length > 0
            ? cosineSimilarity(queryEmbedding, embedding)
            : 0;

        return {
          memory: {
            id: mem.id,
            type: "episodic" as const,
            title: mem.title,
            content: mem.description,
            importance: mem.importance,
            lastAccessed: mem.lastAccessedAt || new Date(),
            accessCount: mem.accessCount,
            tags: mem.tags || [],
          },
          relevanceScore,
        };
      })
      .filter((r: MemorySearchResult) => {
        if (
          options.minImportance &&
          r.memory.importance < options.minImportance
        ) {
          return false;
        }
        return r.relevanceScore > 0.3;
      })
      .sort(
        (a: MemorySearchResult, b: MemorySearchResult) =>
          b.relevanceScore - a.relevanceScore
      )
      .slice(0, limit);

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

  async getRelevantSkills(taskDescription: string): Promise<AgentSkill[]> {
    const db = await getDb();
    if (!db) return [];

    const skills = await db
      .select()
      .from(agentSkills)
      .where(
        and(eq(agentSkills.userId, this.userId), eq(agentSkills.isActive, 1))
      )
      .orderBy(desc(agentSkills.confidence));

    const relevantSkills = skills.filter((skill: AgentSkill) => {
      const trigger = skill.triggerCondition.toLowerCase();
      const task = taskDescription.toLowerCase();
      const keywords = trigger.split(/\s+/);
      return keywords.some((keyword: string) => task.includes(keyword));
    });

    return relevantSkills;
  }

  async updateSkillConfidence(
    skillId: number,
    success: boolean
  ): Promise<void> {
    const db = await getDb();
    if (!db) return;

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

  async consolidateMemories(): Promise<void> {
    const db = await getDb();
    if (!db) return;

    const oldMemories = await db
      .select()
      .from(episodicMemories)
      .where(
        and(
          eq(episodicMemories.userId, this.userId),
          sql`${episodicMemories.createdAt} < DATE_SUB(NOW(), INTERVAL 30 DAY)`,
          sql`${episodicMemories.importance} < 50`
        )
      )
      .limit(50);

    if (oldMemories.length < 10) return;

    const grouped = oldMemories.reduce(
      (acc: Record<string, EpisodicMemory[]>, mem: EpisodicMemory) => {
        const type = mem.memoryType;
        if (!acc[type]) acc[type] = [];
        acc[type].push(mem);
        return acc;
      },
      {} as Record<string, EpisodicMemory[]>
    );

    for (const [type, memories] of Object.entries(grouped)) {
      if (memories.length < 5) continue;

      const summaryPrompt = `Summarize these ${memories.length} experiences into key learnings:\n\n${memories.map((m: EpisodicMemory) => `- ${m.title}: ${m.description}`).join("\n")}`;

      try {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content:
                "You are a memory consolidation system. Summarize experiences into concise, actionable learnings.",
            },
            { role: "user", content: summaryPrompt },
          ],
        });

        const rawContent = response.choices[0]?.message?.content;
        const summary =
          typeof rawContent === "string"
            ? rawContent
            : JSON.stringify(rawContent);

        await this.storeEpisodicMemory({
          memoryType: type as
            | "task_success"
            | "task_failure"
            | "user_preference"
            | "system_discovery"
            | "error_resolution"
            | "optimization"
            | "interaction",
          title: `Consolidated: ${type} learnings`,
          description: summary,
          importance: 70,
          tags: ["consolidated", type],
        });

        for (const mem of memories) {
          await db
            .update(episodicMemories)
            .set({ importance: 10 })
            .where(eq(episodicMemories.id, mem.id));
        }
      } catch (error) {
        console.error("Memory consolidation failed:", error);
      }
    }
  }

  async getStats(): Promise<{
    totalMemories: number;
    totalSkills: number;
    learningEvents: number;
    memoryByType: Record<string, number>;
  }> {
    const db = await getDb();
    if (!db) {
      return {
        totalMemories: 0,
        totalSkills: 0,
        learningEvents: 0,
        memoryByType: {},
      };
    }

    const [memoriesResult, skillsResult, eventsResult] = await Promise.all([
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
      totalMemories: memoriesResult[0]?.count || 0,
      totalSkills: skillsResult[0]?.count || 0,
      learningEvents: eventsResult[0]?.count || 0,
      memoryByType,
    };
  }
}

export function createMemorySystem(userId: number): MemorySystem {
  return new MemorySystem(userId);
}
