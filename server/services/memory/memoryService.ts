/**
 * Memory Service
 *
 * Provides CRUD operations and semantic search for JARVIS's persistent memory.
 * Supports episodic, semantic, and procedural memory types with vector embeddings.
 */

import { getDb } from "../../db";
import {
  episodicMemories,
  semanticMemories,
  proceduralMemories,
  memoryEmbeddings,
  memoryAccessLog,
  learningEvents,
  trainingData,
} from "../../../drizzle/schema";
import { eq, and, desc, sql, like } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import type {
  MemoryType,
  EpisodicMemory,
  SemanticMemory,
  ProceduralMemory,
  LearningEvent,
  TrainingData,
  MemorySearchQuery,
  MemorySearchResult,
  MemoryContext,
  MemoryStats,
} from "./types";

// Cosine similarity calculation
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

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

export class MemoryService {
  private embeddingCache = new Map<string, number[]>();

  // ============================================================================
  // EMBEDDING OPERATIONS
  // ============================================================================

  async generateEmbedding(text: string): Promise<number[]> {
    const cacheKey = text.slice(0, 100);
    if (this.embeddingCache.has(cacheKey)) {
      return this.embeddingCache.get(cacheKey)!;
    }

    try {
      const { generateEmbedding } = await import("../rag/embeddings");
      const embedding = await generateEmbedding(text);
      this.embeddingCache.set(cacheKey, embedding);
      return embedding;
    } catch (error) {
      console.warn("Embedding generation failed, using fallback:", error);
      return this.simpleEmbedding(text);
    }
  }

  private simpleEmbedding(text: string): number[] {
    const dimensions = 1536;
    const embedding = new Array(dimensions).fill(0);
    const words = text.toLowerCase().split(/\s+/);

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      for (let j = 0; j < word.length; j++) {
        const idx = (word.charCodeAt(j) * (i + 1) * (j + 1)) % dimensions;
        embedding[idx] += 1 / (i + 1);
      }
    }

    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (norm > 0) {
      for (let i = 0; i < dimensions; i++) {
        embedding[i] /= norm;
      }
    }

    return embedding;
  }

  /**
   * Store embedding in database
   */
  async storeEmbedding(
    memoryType: MemoryType,
    memoryId: number,
    text: string
  ): Promise<string> {
    const database = await getDb();
    if (!database) throw new Error("Database not available");

    const vector = await this.generateEmbedding(text);
    const id = uuidv4();

    await database.insert(memoryEmbeddings).values({
      id,
      memoryType,
      memoryId,
      sourceText: text,
      model: "nomic-embed-text",
      dimensions: vector.length,
      vector,
    });

    return id;
  }

  // ============================================================================
  // EPISODIC MEMORY OPERATIONS
  // ============================================================================

  /**
   * Create a new episodic memory
   */
  async createEpisodicMemory(
    memory: Omit<EpisodicMemory, "id" | "createdAt" | "updatedAt">
  ): Promise<number> {
    const database = await getDb();
    if (!database) throw new Error("Database not available");

    const result = await database.insert(episodicMemories).values({
      userId: memory.userId,
      taskId: memory.taskId,
      memoryType: memory.memoryType,
      title: memory.title,
      description: memory.description,
      context: memory.context,
      action: memory.action,
      outcome: memory.outcome,
      lessons: memory.lessons,
      entities: memory.entities,
      tags: memory.tags,
      importance: memory.importance,
      accessCount: 0,
    });

    const memoryId = result[0].insertId;

    // Generate and store embedding
    const embeddingText = `${memory.title}. ${memory.description}. ${memory.context || ""}`;
    const embeddingId = await this.storeEmbedding(
      "episodic",
      memoryId,
      embeddingText
    );

    // Update with embedding ID
    await database
      .update(episodicMemories)
      .set({ embeddingId })
      .where(eq(episodicMemories.id, memoryId));

    return memoryId;
  }

  /**
   * Get episodic memory by ID
   */
  async getEpisodicMemory(id: number): Promise<EpisodicMemory | null> {
    const database = await getDb();
    if (!database) return null;

    const results = await database
      .select()
      .from(episodicMemories)
      .where(eq(episodicMemories.id, id))
      .limit(1);

    if (results.length === 0) return null;

    // Update access count
    await database
      .update(episodicMemories)
      .set({
        accessCount: sql`${episodicMemories.accessCount} + 1`,
        lastAccessedAt: new Date(),
      })
      .where(eq(episodicMemories.id, id));

    return this.mapEpisodicResult(results[0]);
  }

  /**
   * Search episodic memories
   */
  async searchEpisodicMemories(
    query: string,
    options: { userId?: number; limit?: number; tags?: string[] } = {}
  ): Promise<Array<{ memory: EpisodicMemory; relevance: number }>> {
    const database = await getDb();
    if (!database) return [];

    const { userId, limit = 10, tags } = options;

    // Get query embedding
    const queryEmbedding = await this.generateEmbedding(query);

    // Build conditions
    const conditions = [];
    if (userId) conditions.push(eq(episodicMemories.userId, userId));

    // Get all episodic memories with embeddings
    const memories = await database
      .select()
      .from(episodicMemories)
      .leftJoin(
        memoryEmbeddings,
        eq(episodicMemories.embeddingId, memoryEmbeddings.id)
      )
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(episodicMemories.importance));

    // Calculate relevance scores
    const scored = memories
      .filter((m: any) => m.memoryEmbeddings?.vector)
      .map((m: any) => ({
        memory: this.mapEpisodicResult(m.episodicMemories),
        relevance: cosineSimilarity(
          queryEmbedding,
          m.memoryEmbeddings!.vector as number[]
        ),
      }))
      .filter((m: any) => {
        // Filter by tags if specified
        if (tags && tags.length > 0) {
          const memoryTags = m.memory.tags || [];
          return tags.some((t: string) => memoryTags.includes(t));
        }
        return true;
      })
      .sort((a: any, b: any) => b.relevance - a.relevance)
      .slice(0, limit);

    return scored;
  }

  // ============================================================================
  // SEMANTIC MEMORY OPERATIONS
  // ============================================================================

  /**
   * Create a new semantic memory (knowledge fact)
   */
  async createSemanticMemory(
    memory: Omit<SemanticMemory, "id" | "createdAt" | "updatedAt">
  ): Promise<number> {
    const database = await getDb();
    if (!database) throw new Error("Database not available");

    const result = await database.insert(semanticMemories).values({
      userId: memory.userId,
      category: memory.category,
      subject: memory.subject,
      predicate: memory.predicate,
      object: memory.object,
      confidence: memory.confidence,
      source: memory.source,
      sourceTaskId: memory.sourceTaskId,
      isValid: memory.isValid ? 1 : 0,
      expiresAt: memory.expiresAt,
      accessCount: 0,
    });

    const memoryId = result[0].insertId;

    // Generate and store embedding
    const embeddingText = `${memory.subject} ${memory.predicate} ${memory.object}`;
    const embeddingId = await this.storeEmbedding(
      "semantic",
      memoryId,
      embeddingText
    );

    // Update with embedding ID
    await database
      .update(semanticMemories)
      .set({ embeddingId })
      .where(eq(semanticMemories.id, memoryId));

    return memoryId;
  }

  /**
   * Get semantic memory by subject
   */
  async getKnowledgeAbout(
    subject: string,
    userId?: number
  ): Promise<SemanticMemory[]> {
    const database = await getDb();
    if (!database) return [];

    const conditions = [
      like(semanticMemories.subject, `%${subject}%`),
      eq(semanticMemories.isValid, 1),
    ];
    if (userId) conditions.push(eq(semanticMemories.userId, userId));

    const results = await database
      .select()
      .from(semanticMemories)
      .where(and(...conditions))
      .orderBy(desc(semanticMemories.confidence));

    return results.map((r: any) => this.mapSemanticResult(r));
  }

  /**
   * Search semantic memories
   */
  async searchSemanticMemories(
    query: string,
    options: { userId?: number; limit?: number; category?: string } = {}
  ): Promise<Array<{ memory: SemanticMemory; relevance: number }>> {
    const database = await getDb();
    if (!database) return [];

    const { userId, limit = 10, category } = options;

    const queryEmbedding = await this.generateEmbedding(query);

    const conditions = [eq(semanticMemories.isValid, 1)];
    if (userId) conditions.push(eq(semanticMemories.userId, userId));
    if (category)
      conditions.push(eq(semanticMemories.category, category as any));

    const memories = await database
      .select()
      .from(semanticMemories)
      .leftJoin(
        memoryEmbeddings,
        eq(semanticMemories.embeddingId, memoryEmbeddings.id)
      )
      .where(and(...conditions));

    const scored = memories
      .filter((m: any) => m.memoryEmbeddings?.vector)
      .map((m: any) => ({
        memory: this.mapSemanticResult(m.semanticMemories),
        relevance: cosineSimilarity(
          queryEmbedding,
          m.memoryEmbeddings!.vector as number[]
        ),
      }))
      .sort((a: any, b: any) => b.relevance - a.relevance)
      .slice(0, limit);

    return scored;
  }

  // ============================================================================
  // PROCEDURAL MEMORY OPERATIONS
  // ============================================================================

  /**
   * Create a new procedural memory (skill/procedure)
   */
  async createProceduralMemory(
    memory: Omit<ProceduralMemory, "id" | "createdAt" | "updatedAt">
  ): Promise<number> {
    const database = await getDb();
    if (!database) throw new Error("Database not available");

    const result = await database.insert(proceduralMemories).values({
      userId: memory.userId,
      name: memory.name,
      description: memory.description,
      triggerConditions: memory.triggerConditions,
      prerequisites: memory.prerequisites,
      steps: memory.steps,
      postConditions: memory.postConditions,
      errorHandlers: memory.errorHandlers,
      successRate: memory.successRate,
      executionCount: memory.executionCount,
      successCount: memory.successCount,
      avgExecutionTimeMs: memory.avgExecutionTimeMs,
      relatedProcedures: memory.relatedProcedures,
      sourceTaskId: memory.sourceTaskId,
      isActive: memory.isActive ? 1 : 0,
    });

    const memoryId = result[0].insertId;

    // Generate embedding from name, description, and trigger conditions
    const embeddingText = `${memory.name}. ${memory.description}. ${memory.triggerConditions?.join(". ") || ""}`;
    const embeddingId = await this.storeEmbedding(
      "procedural",
      memoryId,
      embeddingText
    );

    await database
      .update(proceduralMemories)
      .set({ embeddingId })
      .where(eq(proceduralMemories.id, memoryId));

    return memoryId;
  }

  /**
   * Find procedure by trigger condition
   */
  async findProcedureForTask(
    taskDescription: string,
    userId?: number
  ): Promise<ProceduralMemory | null> {
    const results = await this.searchProceduralMemories(taskDescription, {
      userId,
      limit: 1,
    });
    return results.length > 0 && results[0].relevance > 0.7
      ? results[0].memory
      : null;
  }

  /**
   * Search procedural memories
   */
  async searchProceduralMemories(
    query: string,
    options: { userId?: number; limit?: number } = {}
  ): Promise<Array<{ memory: ProceduralMemory; relevance: number }>> {
    const database = await getDb();
    if (!database) return [];

    const { userId, limit = 10 } = options;

    const queryEmbedding = await this.generateEmbedding(query);

    const conditions = [eq(proceduralMemories.isActive, 1)];
    if (userId) conditions.push(eq(proceduralMemories.userId, userId));

    const memories = await database
      .select()
      .from(proceduralMemories)
      .leftJoin(
        memoryEmbeddings,
        eq(proceduralMemories.embeddingId, memoryEmbeddings.id)
      )
      .where(and(...conditions));

    const scored = memories
      .filter((m: any) => m.memoryEmbeddings?.vector)
      .map((m: any) => ({
        memory: this.mapProceduralResult(m.proceduralMemories),
        relevance: cosineSimilarity(
          queryEmbedding,
          m.memoryEmbeddings!.vector as number[]
        ),
      }))
      .sort((a: any, b: any) => b.relevance - a.relevance)
      .slice(0, limit);

    return scored;
  }

  /**
   * Update procedure execution stats
   */
  async recordProcedureExecution(
    procedureId: number,
    success: boolean,
    executionTimeMs: number
  ): Promise<void> {
    const database = await getDb();
    if (!database) return;

    const procedure = await database
      .select()
      .from(proceduralMemories)
      .where(eq(proceduralMemories.id, procedureId))
      .limit(1);

    if (procedure.length === 0) return;

    const current = procedure[0];
    const newExecutionCount = (current.executionCount || 0) + 1;
    const newSuccessCount = (current.successCount || 0) + (success ? 1 : 0);
    const newSuccessRate = Math.round(
      (newSuccessCount / newExecutionCount) * 100
    );

    // Calculate running average
    const currentAvg = current.avgExecutionTimeMs || executionTimeMs;
    const newAvg = Math.round(
      (currentAvg * (newExecutionCount - 1) + executionTimeMs) /
        newExecutionCount
    );

    await database
      .update(proceduralMemories)
      .set({
        executionCount: newExecutionCount,
        successCount: newSuccessCount,
        successRate: newSuccessRate,
        avgExecutionTimeMs: newAvg,
      })
      .where(eq(proceduralMemories.id, procedureId));
  }

  // ============================================================================
  // UNIFIED SEARCH & CONTEXT RETRIEVAL
  // ============================================================================

  /**
   * Search across all memory types
   */
  async search(query: MemorySearchQuery): Promise<MemorySearchResult[]> {
    const { memoryTypes = ["episodic", "semantic", "procedural"], limit = 10 } =
      query;
    const results: MemorySearchResult[] = [];

    if (memoryTypes.includes("episodic")) {
      const episodic = await this.searchEpisodicMemories(query.query, {
        userId: query.userId,
        limit,
        tags: query.tags,
      });
      results.push(
        ...episodic.map(r => ({
          memory: r.memory,
          memoryType: "episodic" as MemoryType,
          relevanceScore: r.relevance,
          matchedOn: ["embedding"],
        }))
      );
    }

    if (memoryTypes.includes("semantic")) {
      const semantic = await this.searchSemanticMemories(query.query, {
        userId: query.userId,
        limit,
      });
      results.push(
        ...semantic.map(r => ({
          memory: r.memory,
          memoryType: "semantic" as MemoryType,
          relevanceScore: r.relevance,
          matchedOn: ["embedding"],
        }))
      );
    }

    if (memoryTypes.includes("procedural")) {
      const procedural = await this.searchProceduralMemories(query.query, {
        userId: query.userId,
        limit,
      });
      results.push(
        ...procedural.map(r => ({
          memory: r.memory,
          memoryType: "procedural" as MemoryType,
          relevanceScore: r.relevance,
          matchedOn: ["embedding"],
        }))
      );
    }

    // Sort by relevance and limit
    return results
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
  }

  /**
   * Get memory context for JARVIS task execution
   */
  async getContextForTask(
    taskDescription: string,
    userId?: number,
    options: {
      maxEpisodic?: number;
      maxSemantic?: number;
      maxProcedural?: number;
    } = {}
  ): Promise<MemoryContext> {
    const startTime = Date.now();
    const { maxEpisodic = 3, maxSemantic = 5, maxProcedural = 2 } = options;

    const [episodic, semantic, procedural] = await Promise.all([
      this.searchEpisodicMemories(taskDescription, {
        userId,
        limit: maxEpisodic,
      }),
      this.searchSemanticMemories(taskDescription, {
        userId,
        limit: maxSemantic,
      }),
      this.searchProceduralMemories(taskDescription, {
        userId,
        limit: maxProcedural,
      }),
    ]);

    return {
      relevantEpisodes: episodic.map(e => ({
        memory: e.memory,
        relevance: e.relevance,
      })),
      relevantKnowledge: semantic.map(s => ({
        memory: s.memory,
        relevance: s.relevance,
      })),
      relevantProcedures: procedural.map(p => ({
        memory: p.memory,
        relevance: p.relevance,
      })),
      totalMemoriesRetrieved:
        episodic.length + semantic.length + procedural.length,
      retrievalTimeMs: Date.now() - startTime,
    };
  }

  // ============================================================================
  // LEARNING & TRAINING DATA
  // ============================================================================

  /**
   * Record a learning event
   */
  async recordLearning(
    event: Omit<LearningEvent, "id" | "createdAt">
  ): Promise<number> {
    const database = await getDb();
    if (!database) throw new Error("Database not available");

    const result = await database.insert(learningEvents).values({
      userId: event.userId,
      taskId: event.taskId,
      eventType: event.eventType,
      summary: event.summary,
      content: event.content,
      confidence: event.confidence,
      applied: event.applied ? 1 : 0,
      impactScore: event.impactScore,
    });

    return result[0].insertId;
  }

  /**
   * Store training data from successful task
   */
  async storeTrainingData(
    data: Omit<TrainingData, "id" | "createdAt">
  ): Promise<number> {
    const database = await getDb();
    if (!database) throw new Error("Database not available");

    const result = await database.insert(trainingData).values({
      taskId: data.taskId,
      dataType: data.dataType,
      input: data.input,
      output: data.output,
      qualityScore: data.qualityScore,
      usedForTraining: data.usedForTraining ? 1 : 0,
      trainingRunId: data.trainingRunId,
      metadata: data.metadata,
    });

    return result[0].insertId;
  }

  /**
   * Get unused training data for fine-tuning
   */
  async getUnusedTrainingData(
    dataType?: string,
    minQuality: number = 70,
    limit: number = 100
  ): Promise<TrainingData[]> {
    const database = await getDb();
    if (!database) return [];

    const conditions = [
      eq(trainingData.usedForTraining, 0),
      sql`${trainingData.qualityScore} >= ${minQuality}`,
    ];
    if (dataType) conditions.push(eq(trainingData.dataType, dataType as any));

    const results = await database
      .select()
      .from(trainingData)
      .where(and(...conditions))
      .orderBy(desc(trainingData.qualityScore))
      .limit(limit);

    return results.map((r: any) => ({
      id: r.id,
      taskId: r.taskId,
      dataType: r.dataType as any,
      input: r.input,
      output: r.output,
      qualityScore: r.qualityScore,
      usedForTraining: r.usedForTraining === 1,
      trainingRunId: r.trainingRunId || undefined,
      metadata: r.metadata as Record<string, unknown> | undefined,
      createdAt: r.createdAt,
    }));
  }

  // ============================================================================
  // STATISTICS
  // ============================================================================

  /**
   * Get memory statistics
   */
  async getStats(userId?: number): Promise<MemoryStats> {
    const database = await getDb();
    if (!database) {
      return {
        totalEpisodic: 0,
        totalSemantic: 0,
        totalProcedural: 0,
        totalEmbeddings: 0,
        totalLearningEvents: 0,
        totalTrainingData: 0,
        recentAccessCount: 0,
        topEntities: [],
        topTags: [],
      };
    }

    const [
      episodicCount,
      semanticCount,
      proceduralCount,
      embeddingCount,
      learningCount,
      trainingCount,
    ] = await Promise.all([
      database
        .select({ count: sql<number>`count(*)` })
        .from(episodicMemories)
        .where(userId ? eq(episodicMemories.userId, userId) : undefined),
      database
        .select({ count: sql<number>`count(*)` })
        .from(semanticMemories)
        .where(userId ? eq(semanticMemories.userId, userId) : undefined),
      database
        .select({ count: sql<number>`count(*)` })
        .from(proceduralMemories)
        .where(userId ? eq(proceduralMemories.userId, userId) : undefined),
      database.select({ count: sql<number>`count(*)` }).from(memoryEmbeddings),
      database
        .select({ count: sql<number>`count(*)` })
        .from(learningEvents)
        .where(userId ? eq(learningEvents.userId, userId) : undefined),
      database.select({ count: sql<number>`count(*)` }).from(trainingData),
    ]);

    return {
      totalEpisodic: episodicCount[0].count,
      totalSemantic: semanticCount[0].count,
      totalProcedural: proceduralCount[0].count,
      totalEmbeddings: embeddingCount[0].count,
      totalLearningEvents: learningCount[0].count,
      totalTrainingData: trainingCount[0].count,
      recentAccessCount: 0,
      topEntities: [],
      topTags: [],
    };
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private mapEpisodicResult(row: any): EpisodicMemory {
    return {
      id: row.id,
      userId: row.userId,
      taskId: row.taskId,
      memoryType: row.memoryType,
      title: row.title,
      description: row.description,
      context: row.context,
      action: row.action,
      outcome: row.outcome,
      lessons: row.lessons as string[] | undefined,
      entities: row.entities as string[] | undefined,
      tags: row.tags as string[] | undefined,
      importance: row.importance,
      accessCount: row.accessCount,
      lastAccessedAt: row.lastAccessedAt,
      embeddingId: row.embeddingId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapSemanticResult(row: any): SemanticMemory {
    return {
      id: row.id,
      userId: row.userId,
      category: row.category,
      subject: row.subject,
      predicate: row.predicate,
      object: row.object,
      confidence: row.confidence,
      source: row.source,
      sourceTaskId: row.sourceTaskId,
      isValid: row.isValid === 1,
      lastVerifiedAt: row.lastVerifiedAt,
      expiresAt: row.expiresAt,
      accessCount: row.accessCount,
      embeddingId: row.embeddingId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapProceduralResult(row: any): ProceduralMemory {
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      description: row.description,
      triggerConditions: row.triggerConditions as string[] | undefined,
      prerequisites: row.prerequisites as string[] | undefined,
      steps: row.steps as any,
      postConditions: row.postConditions as string[] | undefined,
      errorHandlers: row.errorHandlers as any,
      successRate: row.successRate,
      executionCount: row.executionCount,
      successCount: row.successCount,
      avgExecutionTimeMs: row.avgExecutionTimeMs,
      relatedProcedures: row.relatedProcedures as number[] | undefined,
      sourceTaskId: row.sourceTaskId,
      isActive: row.isActive === 1,
      embeddingId: row.embeddingId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

// Singleton instance
let memoryServiceInstance: MemoryService | null = null;

export function getMemoryService(): MemoryService {
  if (!memoryServiceInstance) {
    memoryServiceInstance = new MemoryService();
  }
  return memoryServiceInstance;
}
