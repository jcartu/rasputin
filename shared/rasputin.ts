/**
 * RASPUTIN Shared Types
 * Types shared between client and server for the consensus/synthesis engine
 */

// ============================================================================
// Model Configuration
// ============================================================================

export interface ModelConfig {
  id: string;
  name: string;
  provider:
    | "openai"
    | "anthropic"
    | "google"
    | "xai"
    | "perplexity"
    | "cerebras"
    | "openrouter";
  openRouterId?: string;
  contextWindow: number;
  maxOutputTokens: number;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  supportsStreaming: boolean;
  supportsVision?: boolean;
  tier: "fast" | "normal" | "max";
}

export const FRONTIER_MODELS: ModelConfig[] = [
  // OpenAI
  {
    id: "gpt-5",
    name: "GPT-5",
    provider: "openai",
    openRouterId: "openai/gpt-5",
    contextWindow: 128000,
    maxOutputTokens: 16384,
    inputPricePerMillion: 5,
    outputPricePerMillion: 15,
    supportsStreaming: true,
    supportsVision: true,
    tier: "normal",
  },
  {
    id: "gpt-5.2-pro",
    name: "GPT-5.2 Pro",
    provider: "openai",
    openRouterId: "openai/gpt-5.2-pro",
    contextWindow: 200000,
    maxOutputTokens: 32768,
    inputPricePerMillion: 10,
    outputPricePerMillion: 30,
    supportsStreaming: true,
    supportsVision: true,
    tier: "max",
  },
  // Anthropic
  {
    id: "claude-sonnet-4.5",
    name: "Claude Sonnet 4.5",
    provider: "anthropic",
    openRouterId: "anthropic/claude-sonnet-4.5",
    contextWindow: 200000,
    maxOutputTokens: 8192,
    inputPricePerMillion: 3,
    outputPricePerMillion: 15,
    supportsStreaming: true,
    supportsVision: true,
    tier: "normal",
  },
  {
    id: "claude-opus-4.5",
    name: "Claude Opus 4.5",
    provider: "anthropic",
    openRouterId: "anthropic/claude-opus-4.5",
    contextWindow: 200000,
    maxOutputTokens: 8192,
    inputPricePerMillion: 15,
    outputPricePerMillion: 75,
    supportsStreaming: true,
    supportsVision: true,
    tier: "max",
  },
  // Google
  {
    id: "gemini-3-flash",
    name: "Gemini 3 Flash",
    provider: "google",
    openRouterId: "google/gemini-3-flash",
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    inputPricePerMillion: 0.075,
    outputPricePerMillion: 0.3,
    supportsStreaming: true,
    supportsVision: true,
    tier: "fast",
  },
  {
    id: "gemini-3-pro",
    name: "Gemini 3 Pro",
    provider: "google",
    openRouterId: "google/gemini-3-pro",
    contextWindow: 2000000,
    maxOutputTokens: 16384,
    inputPricePerMillion: 1.25,
    outputPricePerMillion: 5,
    supportsStreaming: true,
    supportsVision: true,
    tier: "max",
  },
  // xAI - Grok 4.1 released Nov 17, 2025
  {
    id: "grok-4.1",
    name: "Grok 4.1",
    provider: "xai",
    openRouterId: "x-ai/grok-4.1-fast",
    contextWindow: 131072,
    maxOutputTokens: 16384,
    inputPricePerMillion: 3,
    outputPricePerMillion: 15,
    supportsStreaming: true,
    supportsVision: true,
    tier: "normal",
  },
  {
    id: "grok-4.1-mini",
    name: "Grok 4.1 Mini",
    provider: "xai",
    openRouterId: "x-ai/grok-4-fast",
    contextWindow: 131072,
    maxOutputTokens: 32768,
    inputPricePerMillion: 2,
    outputPricePerMillion: 10,
    supportsStreaming: true,
    supportsVision: true,
    tier: "max",
  },
  // Perplexity
  {
    id: "sonar-pro",
    name: "Sonar Pro",
    provider: "perplexity",
    openRouterId: "perplexity/sonar-pro",
    contextWindow: 200000,
    maxOutputTokens: 8192,
    inputPricePerMillion: 3,
    outputPricePerMillion: 15,
    supportsStreaming: true,
    supportsVision: false,
    tier: "normal",
  },
  // Cerebras - Ultra-fast inference (2000+ tokens/sec)
  {
    id: "cerebras-llama-70b",
    name: "Cerebras Llama 3.3 70B",
    provider: "cerebras",
    contextWindow: 128000,
    maxOutputTokens: 8192,
    inputPricePerMillion: 0.6,
    outputPricePerMillion: 0.6,
    supportsStreaming: true,
    supportsVision: false,
    tier: "fast",
  },
  {
    id: "cerebras-qwen-32b",
    name: "Cerebras Qwen 3 32B",
    provider: "cerebras",
    contextWindow: 32768,
    maxOutputTokens: 8192,
    inputPricePerMillion: 0.2,
    outputPricePerMillion: 0.2,
    supportsStreaming: true,
    supportsVision: false,
    tier: "fast",
  },
];

// ============================================================================
// Query Modes
// ============================================================================

export type QueryMode = "consensus" | "synthesis";
export type SpeedTier = "fast" | "normal" | "max";

// ============================================================================
// Consensus Mode Types
// ============================================================================

export interface ConsensusRequest {
  query: string;
  chatId?: number;
  mode: "consensus";
  speedTier: SpeedTier;
  selectedModels?: string[];
}

export interface ModelResponseData {
  modelId: string;
  modelName: string;
  content: string;
  status: "pending" | "streaming" | "completed" | "error";
  errorMessage?: string;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
  provider?: string;
}

export interface ConsensusResult {
  summary: string;
  agreementPercentage: number;
  modelResponses: ModelResponseData[];
  totalLatencyMs: number;
  totalTokens: number;
  totalCost: number;
}

// ============================================================================
// Synthesis Mode Types
// ============================================================================

export type SynthesisStage =
  | "web_search"
  | "parallel_proposers"
  | "information_extraction"
  | "gap_detection"
  | "meta_synthesis";

export interface SynthesisRequest {
  query: string;
  chatId?: number;
  mode: "synthesis";
  speedTier: SpeedTier;
}

export interface SynthesisPipelineStageData {
  stageName: SynthesisStage;
  stageOrder: number;
  status: "pending" | "running" | "completed" | "error";
  output?: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

export interface SynthesisResult {
  finalSynthesis: string;
  stages: SynthesisPipelineStageData[];
  webSearchResults?: string;
  proposerResponses?: ModelResponseData[];
  gapsIdentified?: string[];
  conflictsResolved?: string[];
  totalLatencyMs: number;
  totalTokens: number;
  totalCost: number;
}

// ============================================================================
// WebSocket Events
// ============================================================================

export interface WSEvent {
  type: string;
  payload: unknown;
  timestamp: number;
}

export interface ModelStreamEvent extends WSEvent {
  type: "model_stream";
  payload: {
    modelId: string;
    chunk: string;
    isComplete: boolean;
  };
}

export interface ModelStatusEvent extends WSEvent {
  type: "model_status";
  payload: {
    modelId: string;
    status: "pending" | "streaming" | "completed" | "error";
    latencyMs?: number;
    tokenCount?: number;
    cost?: number;
    errorMessage?: string;
  };
}

export interface PipelineStageEvent extends WSEvent {
  type: "pipeline_stage";
  payload: {
    stage: SynthesisStage;
    status: "pending" | "running" | "completed" | "error";
    progress?: number;
    output?: string;
  };
}

export interface ConsensusCompleteEvent extends WSEvent {
  type: "consensus_complete";
  payload: ConsensusResult;
}

export interface SynthesisCompleteEvent extends WSEvent {
  type: "synthesis_complete";
  payload: SynthesisResult;
}

export interface ErrorEvent extends WSEvent {
  type: "error";
  payload: {
    message: string;
    code?: string;
  };
}

// ============================================================================
// Chat Types
// ============================================================================

export interface ChatSummary {
  id: number;
  title: string;
  mode: QueryMode;
  speedTier: SpeedTier;
  messageCount: number;
  updatedAt: Date;
}

export interface ChatMessage {
  id: number;
  chatId: number;
  role: "user" | "assistant";
  content: string;
  summary?: string;
  agreementPercentage?: number;
  latencyMs?: number;
  tokenCount?: number;
  cost?: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface ChatWithMessages {
  id: number;
  title: string;
  mode: QueryMode;
  speedTier: SpeedTier;
  selectedModels?: string[];
  messages: ChatMessage[];
  totalTokens: number;
  totalCost: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Default Model Selection by Speed Tier
// ============================================================================

export function getModelsForTier(tier: SpeedTier): ModelConfig[] {
  switch (tier) {
    case "fast":
      return FRONTIER_MODELS.filter(m =>
        [
          "gemini-3-flash",
          "claude-sonnet-4.5",
          "cerebras-llama-70b",
          "cerebras-qwen-32b",
        ].includes(m.id)
      );
    case "normal":
      return FRONTIER_MODELS.filter(m =>
        [
          "gpt-5",
          "claude-sonnet-4.5",
          "gemini-3-flash",
          "grok-4.1",
          "sonar-pro",
        ].includes(m.id)
      );
    case "max":
      return FRONTIER_MODELS.filter(m =>
        [
          "gpt-5.2-pro",
          "claude-opus-4.5",
          "gemini-3-pro",
          "grok-4.1-mini",
          "sonar-pro",
        ].includes(m.id)
      );
  }
}

export function getSynthesizerModel(tier: SpeedTier): ModelConfig {
  if (tier === "max") {
    return FRONTIER_MODELS.find(m => m.id === "claude-opus-4.5")!;
  }
  return FRONTIER_MODELS.find(m => m.id === "claude-sonnet-4.5")!;
}

export function getCerebrasForIntermediateStages(): ModelConfig {
  return FRONTIER_MODELS.find(m => m.id === "cerebras-llama-70b")!;
}

export function getClaudeForFinalSynthesis(tier: SpeedTier): ModelConfig {
  if (tier === "max") {
    return FRONTIER_MODELS.find(m => m.id === "claude-opus-4.5")!;
  }
  return FRONTIER_MODELS.find(m => m.id === "claude-sonnet-4.5")!;
}

export type QueryComplexity = "simple" | "moderate" | "complex";

const SIMPLE_MATH_PATTERNS = [
  /^\s*(?:what\s+is\s+)?[\d\s+\-*/().^]+\s*[=?]?\s*$/i,
  /^\s*(?:calculate|compute|solve|what\s+is)\s+[\d\s+\-*/().^]+/i,
  /^\s*\d+\s*[+\-*/x×÷]\s*\d+/i,
];

const SIMPLE_FACT_PATTERNS = [
  /^(?:what|who)\s+(?:is|are|was|were)\s+(?:the\s+)?(?:capital|president|author|inventor|founder|ceo)\s+of\s+/i,
  /^(?:when|where)\s+(?:is|was|did)\s+\w+\s+(?:born|founded|created|invented|discovered)/i,
  /^(?:how\s+(?:many|much|old|tall|long|far))\s+(?:is|are|was|were)\s+/i,
  /^(?:what|who)\s+(?:wrote|invented|discovered|founded|created)\s+/i,
  /^(?:define|what\s+does)\s+\w+\s+mean/i,
];

export function classifyQueryComplexity(query: string): QueryComplexity {
  const trimmedQuery = query.trim();
  const wordCount = trimmedQuery.split(/\s+/).length;

  if (wordCount <= 10) {
    for (const pattern of SIMPLE_MATH_PATTERNS) {
      if (pattern.test(trimmedQuery)) return "simple";
    }
    for (const pattern of SIMPLE_FACT_PATTERNS) {
      if (pattern.test(trimmedQuery)) return "simple";
    }
  }

  if (wordCount <= 5) return "simple";
  if (wordCount <= 20) return "moderate";
  return "complex";
}

export function isSimpleQuery(query: string): boolean {
  return classifyQueryComplexity(query) === "simple";
}

export function getFastModelForSimpleQueries(): ModelConfig {
  return FRONTIER_MODELS.find(m => m.id === "gemini-3-flash")!;
}
