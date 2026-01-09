/**
 * Memory Service Types
 *
 * Type definitions for the persistent memory system.
 */

export type MemoryType = "episodic" | "semantic" | "procedural";

export type EpisodicMemoryType =
  | "task_success"
  | "task_failure"
  | "user_preference"
  | "system_discovery"
  | "error_resolution"
  | "optimization"
  | "interaction";

export type SemanticCategory =
  | "system_info"
  | "user_info"
  | "domain_knowledge"
  | "api_info"
  | "file_structure"
  | "configuration"
  | "relationship"
  | "definition";

export type LearningEventType =
  | "new_knowledge"
  | "skill_acquired"
  | "skill_improved"
  | "error_learned"
  | "preference_learned"
  | "pattern_detected"
  | "feedback_received";

export type TrainingDataType =
  | "conversation"
  | "tool_usage"
  | "reasoning"
  | "code_generation"
  | "error_recovery";

// Episodic Memory - specific experiences
export interface EpisodicMemory {
  id?: number;
  userId?: number;
  taskId?: number;
  memoryType: EpisodicMemoryType;
  title: string;
  description: string;
  context?: string;
  action?: string;
  outcome?: string;
  lessons?: string[];
  entities?: string[];
  tags?: string[];
  importance: number;
  accessCount?: number;
  lastAccessedAt?: Date;
  embeddingId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Semantic Memory - facts and knowledge
export interface SemanticMemory {
  id?: number;
  userId?: number;
  category: SemanticCategory;
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  source?: string;
  sourceTaskId?: number;
  isValid: boolean;
  lastVerifiedAt?: Date;
  expiresAt?: Date;
  accessCount?: number;
  embeddingId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Procedural Memory - skills and procedures
export interface ProcedureStep {
  order: number;
  action: string;
  description: string;
  toolName?: string;
  expectedOutcome?: string;
  errorHandling?: string;
}

export interface ErrorHandler {
  errorPattern: string;
  solution: string;
}

export interface ProceduralMemory {
  id?: number;
  userId?: number;
  name: string;
  description: string;
  triggerConditions?: string[];
  prerequisites?: string[];
  steps: ProcedureStep[];
  postConditions?: string[];
  errorHandlers?: ErrorHandler[];
  successRate: number;
  executionCount: number;
  successCount: number;
  avgExecutionTimeMs?: number;
  relatedProcedures?: number[];
  sourceTaskId?: number;
  isActive: boolean;
  embeddingId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Memory Embedding
export interface MemoryEmbedding {
  id: string;
  memoryType: MemoryType;
  memoryId: number;
  sourceText: string;
  model: string;
  dimensions: number;
  vector: number[];
  createdAt?: Date;
}

// Learning Event
export interface LearningEvent {
  id?: number;
  userId?: number;
  taskId?: number;
  eventType: LearningEventType;
  summary: string;
  content?: Record<string, unknown>;
  confidence: number;
  applied: boolean;
  impactScore?: number;
  createdAt?: Date;
}

// Training Data
export interface TrainingData {
  id?: number;
  taskId: number;
  dataType: TrainingDataType;
  input: string;
  output: string;
  qualityScore: number;
  usedForTraining: boolean;
  trainingRunId?: string;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
}

// Search/Query types
export interface MemorySearchQuery {
  query: string;
  memoryTypes?: MemoryType[];
  userId?: number;
  limit?: number;
  minRelevance?: number;
  tags?: string[];
  entities?: string[];
  dateRange?: {
    start?: Date;
    end?: Date;
  };
}

export interface MemorySearchResult {
  memory: EpisodicMemory | SemanticMemory | ProceduralMemory;
  memoryType: MemoryType;
  relevanceScore: number;
  matchedOn: string[];
}

// Context injection for JARVIS
export interface MemoryContext {
  relevantEpisodes: Array<{
    memory: EpisodicMemory;
    relevance: number;
  }>;
  relevantKnowledge: Array<{
    memory: SemanticMemory;
    relevance: number;
  }>;
  relevantProcedures: Array<{
    memory: ProceduralMemory;
    relevance: number;
  }>;
  totalMemoriesRetrieved: number;
  retrievalTimeMs: number;
}

export interface MemoryStats {
  totalEpisodic: number;
  totalSemantic: number;
  totalProcedural: number;
  totalEmbeddings: number;
  totalLearningEvents: number;
  totalTrainingData: number;
  recentAccessCount: number;
  topEntities: Array<{ entity: string; count: number }>;
  topTags: Array<{ tag: string; count: number }>;
  qdrantVectors?: number;
}
