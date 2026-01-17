import type {
  ExecutionContext,
  QdrantClient,
  QdrantSearchResult,
  AgentType,
} from "./types";
import {
  extractLearningFromExecution,
  type ExtractedLearning,
  type ToolExecutionRecord,
} from "./learningExtractor";

export interface V3MemoryClient {
  storeLearning(learning: ExtractedLearning): Promise<void>;
  searchRelevantLearnings(
    query: string,
    options?: { limit?: number; agentType?: AgentType }
  ): Promise<RelevantLearning[]>;
  getToolStats(toolName: string): Promise<ToolLearningStats | null>;
  recordExecution(record: ToolExecutionRecord): Promise<void>;
}

export interface RelevantLearning {
  type: "episodic" | "semantic" | "procedural";
  content: string;
  relevance: number;
  toolName?: string;
  patterns?: string[];
}

export interface ToolLearningStats {
  toolName: string;
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  avgDurationMs: number;
  commonPatterns: string[];
  recentInsights: string[];
  lastUsed: number;
  decayFactor: number;
}

export interface ProceduralSequence {
  id: string;
  steps: Array<{
    toolName: string;
    params: Record<string, unknown>;
    expectedOutcome: string;
  }>;
  successCount: number;
  lastUsed: number;
  avgTotalDurationMs: number;
}

interface PatternAggregation {
  pattern: string;
  frequency: number;
  successRate: number;
  lastSeen: number;
  toolNames: Set<string>;
}

const DECAY_HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_RELEVANCE_THRESHOLD = 0.1;
const PATTERN_FREQUENCY_BOOST = 0.1;
const RECENCY_BOOST_FACTOR = 0.2;

type MemoryService = {
  createEpisodicMemory: (memory: Record<string, unknown>) => Promise<number>;
  createSemanticMemory: (memory: Record<string, unknown>) => Promise<number>;
  createOrUpdateProcedural: (
    memory: Record<string, unknown>
  ) => Promise<number>;
  createLearningEvent: (event: Record<string, unknown>) => Promise<number>;
  generateEmbedding: (text: string) => Promise<number[]>;
  searchMemories: (query: {
    query: string;
    userId: number;
    limit?: number;
  }) => Promise<
    Array<{
      memory: Record<string, unknown>;
      memoryType: string;
      relevanceScore: number;
    }>
  >;
};

export class V3MemoryIntegration implements V3MemoryClient {
  private memoryService: MemoryService | null = null;
  private toolStatsCache = new Map<string, ToolLearningStats>();
  private pendingLearnings: ExtractedLearning[] = [];
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private patternAggregations = new Map<string, PatternAggregation>();
  private proceduralSequences = new Map<string, ProceduralSequence>();
  private currentSequenceSteps: Array<{
    toolName: string;
    params: Record<string, unknown>;
    success: boolean;
    timestamp: number;
  }> = [];
  private sequenceTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private userId: number,
    private qdrantClient?: QdrantClient
  ) {}

  async initialize(): Promise<void> {
    try {
      const { MemoryService } = await import("../../memory/memoryService");
      this.memoryService = new MemoryService() as unknown as MemoryService;
    } catch {
      console.warn("[V3Memory] MemoryService not available, using fallback");
    }

    this.flushInterval = setInterval(() => {
      this.flushPendingLearnings().catch(console.error);
    }, 30000);
  }

  async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    await this.flushPendingLearnings();
  }

  async storeLearning(learning: ExtractedLearning): Promise<void> {
    this.pendingLearnings.push(learning);

    if (this.pendingLearnings.length >= 10) {
      await this.flushPendingLearnings();
    }
  }

  private async flushPendingLearnings(): Promise<void> {
    if (this.pendingLearnings.length === 0) return;

    const learnings = this.pendingLearnings.splice(0);

    for (const learning of learnings) {
      try {
        await this.persistLearning(learning);
      } catch (error) {
        console.error("[V3Memory] Failed to persist learning:", error);
      }
    }
  }

  private async persistLearning(learning: ExtractedLearning): Promise<void> {
    if (!this.memoryService) {
      await this.persistToQdrant(learning);
      return;
    }

    if (learning.episodic) {
      await this.memoryService.createEpisodicMemory(
        learning.episodic as unknown as Record<string, unknown>
      );
    }

    if (learning.semantic) {
      for (const fact of learning.semantic) {
        await this.memoryService.createSemanticMemory(
          fact as unknown as Record<string, unknown>
        );
      }
    }

    if (learning.procedural) {
      await this.memoryService.createOrUpdateProcedural(
        learning.procedural as unknown as Record<string, unknown>
      );
    }

    if (learning.learningEvent) {
      await this.memoryService.createLearningEvent(
        learning.learningEvent as unknown as Record<string, unknown>
      );
    }

    this.updateToolStatsFromLearning(learning);
  }

  private async persistToQdrant(learning: ExtractedLearning): Promise<void> {
    if (!this.qdrantClient) return;

    const payload = learning.rawPayload;
    const vector = await this.generateSimpleEmbedding(
      `${payload.toolName} ${payload.taskContext} ${payload.inputSummary}`
    );

    const collections = this.getCollectionsForLearning(learning);
    for (const collection of collections) {
      try {
        await this.qdrantClient.upsert(collection, {
          id: `learning-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          vector,
          payload: payload as unknown as Record<string, unknown>,
        });
      } catch {
        void 0;
      }
    }
  }

  private getCollectionsForLearning(learning: ExtractedLearning): string[] {
    const collections: string[] = ["tool_learnings"];

    if (learning.episodic) {
      collections.push("episodic_memories");
    }
    if (learning.semantic && learning.semantic.length > 0) {
      collections.push("semantic_facts");
    }
    if (learning.procedural) {
      collections.push("procedural_skills");
    }

    return collections;
  }

  private updateToolStatsFromLearning(learning: ExtractedLearning): void {
    const { toolName, success, durationMs, patterns, insights } =
      learning.rawPayload;

    const existing = this.toolStatsCache.get(toolName);
    const now = Date.now();

    const stats: ToolLearningStats = existing
      ? { ...existing }
      : {
          toolName,
          totalExecutions: 0,
          successCount: 0,
          failureCount: 0,
          avgDurationMs: 0,
          commonPatterns: [],
          recentInsights: [],
          lastUsed: now,
          decayFactor: 1.0,
        };

    stats.totalExecutions++;
    stats.lastUsed = now;

    if (success) {
      stats.successCount++;
    } else {
      stats.failureCount++;
    }

    const totalDuration =
      stats.avgDurationMs * (stats.totalExecutions - 1) + durationMs;
    stats.avgDurationMs = Math.round(totalDuration / stats.totalExecutions);

    if (patterns) {
      const patternSet = new Set([...stats.commonPatterns, ...patterns]);
      stats.commonPatterns = Array.from(patternSet).slice(0, 20);
    }

    if (insights) {
      stats.recentInsights = [...insights, ...stats.recentInsights].slice(
        0,
        10
      );
    }

    this.toolStatsCache.set(toolName, stats);
    this.aggregatePatterns(toolName, patterns || [], success);
    this.trackSequenceStep(toolName, {}, success);
  }

  private aggregatePatterns(
    toolName: string,
    patterns: string[],
    success: boolean
  ): void {
    const now = Date.now();

    for (const pattern of patterns) {
      const key = pattern.toLowerCase().trim();
      if (!key) continue;

      const existing = this.patternAggregations.get(key);
      if (existing) {
        existing.frequency++;
        existing.lastSeen = now;
        existing.toolNames.add(toolName);
        const total = existing.frequency;
        existing.successRate =
          (existing.successRate * (total - 1) + (success ? 1 : 0)) / total;
      } else {
        this.patternAggregations.set(key, {
          pattern: key,
          frequency: 1,
          successRate: success ? 1 : 0,
          lastSeen: now,
          toolNames: new Set([toolName]),
        });
      }
    }

    if (this.patternAggregations.size > 500) {
      this.prunePatternAggregations();
    }
  }

  private prunePatternAggregations(): void {
    const now = Date.now();
    const entries = Array.from(this.patternAggregations.entries());

    entries.sort((a, b) => {
      const aScore = a[1].frequency * this.calculateDecay(now - a[1].lastSeen);
      const bScore = b[1].frequency * this.calculateDecay(now - b[1].lastSeen);
      return bScore - aScore;
    });

    const toKeep = entries.slice(0, 300);
    this.patternAggregations.clear();
    for (const [key, value] of toKeep) {
      this.patternAggregations.set(key, value);
    }
  }

  private trackSequenceStep(
    toolName: string,
    params: Record<string, unknown>,
    success: boolean
  ): void {
    if (this.sequenceTimeout) {
      clearTimeout(this.sequenceTimeout);
    }

    this.currentSequenceSteps.push({
      toolName,
      params,
      success,
      timestamp: Date.now(),
    });

    this.sequenceTimeout = setTimeout(() => {
      this.finalizeSequence();
    }, 5000);
  }

  private finalizeSequence(): void {
    if (this.currentSequenceSteps.length < 2) {
      this.currentSequenceSteps = [];
      return;
    }

    const allSuccessful = this.currentSequenceSteps.every(s => s.success);
    if (!allSuccessful) {
      this.currentSequenceSteps = [];
      return;
    }

    const sequenceKey = this.currentSequenceSteps
      .map(s => s.toolName)
      .join("->");

    const existing = this.proceduralSequences.get(sequenceKey);
    const now = Date.now();

    if (existing) {
      existing.successCount++;
      existing.lastUsed = now;
      const totalDuration =
        this.currentSequenceSteps[this.currentSequenceSteps.length - 1]
          .timestamp - this.currentSequenceSteps[0].timestamp;
      existing.avgTotalDurationMs =
        (existing.avgTotalDurationMs * (existing.successCount - 1) +
          totalDuration) /
        existing.successCount;
    } else {
      this.proceduralSequences.set(sequenceKey, {
        id: sequenceKey,
        steps: this.currentSequenceSteps.map(s => ({
          toolName: s.toolName,
          params: s.params,
          expectedOutcome: "success",
        })),
        successCount: 1,
        lastUsed: now,
        avgTotalDurationMs:
          this.currentSequenceSteps[this.currentSequenceSteps.length - 1]
            .timestamp - this.currentSequenceSteps[0].timestamp,
      });
    }

    this.currentSequenceSteps = [];

    if (this.proceduralSequences.size > 100) {
      this.pruneProceduralSequences();
    }
  }

  private pruneProceduralSequences(): void {
    const now = Date.now();
    const entries = Array.from(this.proceduralSequences.entries());

    entries.sort((a, b) => {
      const aScore =
        a[1].successCount * this.calculateDecay(now - a[1].lastUsed);
      const bScore =
        b[1].successCount * this.calculateDecay(now - b[1].lastUsed);
      return bScore - aScore;
    });

    const toKeep = entries.slice(0, 50);
    this.proceduralSequences.clear();
    for (const [key, value] of toKeep) {
      this.proceduralSequences.set(key, value);
    }
  }

  private calculateDecay(ageMs: number): number {
    return Math.pow(0.5, ageMs / DECAY_HALF_LIFE_MS);
  }

  applyDecayToStats(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    this.toolStatsCache.forEach((stats, toolName) => {
      const ageMs = now - stats.lastUsed;
      stats.decayFactor = this.calculateDecay(ageMs);

      if (stats.decayFactor < MIN_RELEVANCE_THRESHOLD) {
        toDelete.push(toolName);
      }
    });

    for (const toolName of toDelete) {
      this.toolStatsCache.delete(toolName);
    }
  }

  getTopPatterns(limit: number = 10): PatternAggregation[] {
    const now = Date.now();
    return Array.from(this.patternAggregations.values())
      .map(p => ({
        ...p,
        toolNames: new Set(p.toolNames),
      }))
      .sort((a, b) => {
        const aScore = a.frequency * this.calculateDecay(now - a.lastSeen);
        const bScore = b.frequency * this.calculateDecay(now - b.lastSeen);
        return bScore - aScore;
      })
      .slice(0, limit);
  }

  getRelevantSequences(toolName: string): ProceduralSequence[] {
    return Array.from(this.proceduralSequences.values()).filter(seq =>
      seq.steps.some(s => s.toolName === toolName)
    );
  }

  private calculateEnhancedRelevance(
    baseRelevance: number,
    toolName: string | undefined,
    patterns: string[] | undefined
  ): number {
    let score = baseRelevance;
    const now = Date.now();

    if (toolName) {
      const stats = this.toolStatsCache.get(toolName);
      if (stats) {
        const recencyBoost =
          RECENCY_BOOST_FACTOR * this.calculateDecay(now - stats.lastUsed);
        score += recencyBoost;
      }
    }

    if (patterns) {
      for (const pattern of patterns) {
        const agg = this.patternAggregations.get(pattern.toLowerCase());
        if (agg && agg.frequency > 1) {
          const patternBoost =
            PATTERN_FREQUENCY_BOOST *
            Math.log2(agg.frequency) *
            this.calculateDecay(now - agg.lastSeen);
          score += patternBoost;
        }
      }
    }

    return Math.min(score, 1.0);
  }

  async searchRelevantLearnings(
    query: string,
    options: { limit?: number; agentType?: AgentType } = {}
  ): Promise<RelevantLearning[]> {
    const { limit = 10 } = options;

    if (this.memoryService) {
      try {
        const results = await this.memoryService.searchMemories({
          query,
          userId: this.userId,
          limit,
        });

        return results.map(r => ({
          type: r.memoryType as "episodic" | "semantic" | "procedural",
          content: JSON.stringify(r.memory),
          relevance: r.relevanceScore,
        }));
      } catch {
        void 0;
      }
    }

    if (this.qdrantClient) {
      return this.searchQdrant(query, limit);
    }

    return [];
  }

  private async searchQdrant(
    query: string,
    limit: number
  ): Promise<RelevantLearning[]> {
    if (!this.qdrantClient) return [];

    const vector = await this.generateSimpleEmbedding(query);
    const results: QdrantSearchResult[] = [];

    const collections = ["tool_learnings", "procedural_skills"];
    for (const collection of collections) {
      try {
        const collectionResults = await this.qdrantClient.search(collection, {
          vector,
          limit: Math.ceil(limit / collections.length),
        });
        results.push(...collectionResults);
      } catch {
        void 0;
      }
    }

    const enhanced = results.map(r => {
      const toolName = r.payload.toolName as string | undefined;
      const patterns = r.payload.patterns as string[] | undefined;
      const enhancedRelevance = this.calculateEnhancedRelevance(
        r.score,
        toolName,
        patterns
      );

      return {
        type:
          (r.payload.type as string) === "procedural"
            ? ("procedural" as const)
            : (r.payload.type as string) === "semantic"
              ? ("semantic" as const)
              : ("episodic" as const),
        content:
          (r.payload.outputSummary as string) || JSON.stringify(r.payload),
        relevance: enhancedRelevance,
        toolName,
        patterns,
      };
    });

    return enhanced
      .filter(r => r.relevance >= MIN_RELEVANCE_THRESHOLD)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);
  }

  async getToolStats(toolName: string): Promise<ToolLearningStats | null> {
    return this.toolStatsCache.get(toolName) || null;
  }

  async recordExecution(record: ToolExecutionRecord): Promise<void> {
    const learning = extractLearningFromExecution(record);
    await this.storeLearning(learning);
  }

  private async generateSimpleEmbedding(text: string): Promise<number[]> {
    if (this.memoryService) {
      try {
        return await this.memoryService.generateEmbedding(text);
      } catch {
        void 0;
      }
    }

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

    const norm = Math.sqrt(
      embedding.reduce((sum: number, val: number) => sum + val * val, 0)
    );
    if (norm > 0) {
      for (let i = 0; i < dimensions; i++) {
        embedding[i] /= norm;
      }
    }

    return embedding;
  }
}

export function createV3MemoryClient(
  context: ExecutionContext
): V3MemoryIntegration {
  const client = new V3MemoryIntegration(context.userId, context.qdrant);
  return client;
}

let globalMemoryClient: V3MemoryIntegration | null = null;

export async function getGlobalMemoryClient(
  userId: number
): Promise<V3MemoryIntegration> {
  if (!globalMemoryClient) {
    globalMemoryClient = new V3MemoryIntegration(userId);
    await globalMemoryClient.initialize();
  }
  return globalMemoryClient;
}

export async function resetGlobalMemoryClient(): Promise<void> {
  if (globalMemoryClient) {
    await globalMemoryClient.shutdown();
    globalMemoryClient = null;
  }
}

export async function enrichContextWithMemory(
  context: ExecutionContext,
  taskDescription: string
): Promise<ExecutionContext> {
  const memoryClient = await getGlobalMemoryClient(context.userId);

  const relevantLearnings = await memoryClient.searchRelevantLearnings(
    taskDescription,
    { limit: 5 }
  );

  const enrichment: Record<string, unknown> = {
    ...context.enrichment,
    relevantLearnings,
    memorySearched: true,
    memoryResultCount: relevantLearnings.length,
  };

  return {
    ...context,
    enrichment,
  };
}
