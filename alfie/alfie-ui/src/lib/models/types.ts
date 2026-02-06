// AI Model Management Types

export type ModelProvider = 'openai' | 'anthropic' | 'google' | 'local' | 'openrouter' | 'custom';

export type ModelCapability = 
  | 'chat'
  | 'completion'
  | 'embedding'
  | 'vision'
  | 'function-calling'
  | 'streaming'
  | 'json-mode';

export type ModelStatus = 'available' | 'unavailable' | 'loading' | 'error' | 'rate-limited';

export interface ModelPricing {
  inputPerMillion: number;  // USD per million input tokens
  outputPerMillion: number; // USD per million output tokens
  currency: 'USD';
}

export interface ModelLimits {
  maxContextTokens: number;
  maxOutputTokens: number;
  requestsPerMinute?: number;
  tokensPerMinute?: number;
}

export interface ModelMetrics {
  averageLatency: number;      // ms
  tokensPerSecond: number;
  successRate: number;         // 0-1
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;           // USD
  errorCount: number;
  lastUsed?: Date;
  lastError?: string;
}

export interface AIModel {
  id: string;
  name: string;
  provider: ModelProvider;
  modelId: string;            // The actual model ID to use in API calls
  description: string;
  capabilities: ModelCapability[];
  pricing: ModelPricing;
  limits: ModelLimits;
  status: ModelStatus;
  metrics: ModelMetrics;
  isDefault?: boolean;
  isFavorite?: boolean;
  tags?: string[];
  releaseDate?: string;
  deprecationDate?: string;
}

export interface ProviderConfig {
  id: ModelProvider;
  name: string;
  description: string;
  baseUrl: string;
  apiKeyName: string;         // env var name or key identifier
  isEnabled: boolean;
  isConfigured: boolean;
  icon: string;               // Lucide icon name
  models: AIModel[];
  customEndpoint?: string;
  healthCheckEndpoint?: string;
}

export interface CustomEndpoint {
  id: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  headers?: Record<string, string>;
  provider: 'openai-compatible' | 'anthropic-compatible' | 'custom';
  models: string[];           // List of model IDs available at this endpoint
  isActive: boolean;
  createdAt: Date;
  lastTestedAt?: Date;
  lastTestResult?: 'success' | 'failure';
}

export interface ModelComparison {
  id: string;
  name: string;
  models: string[];           // Model IDs being compared
  prompt: string;
  responses: ModelComparisonResponse[];
  createdAt: Date;
  isSaved: boolean;
}

export interface ModelComparisonResponse {
  modelId: string;
  response: string;
  latency: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  status: 'pending' | 'streaming' | 'complete' | 'error';
  error?: string;
  timestamp: Date;
}

export interface MarketplaceModel {
  id: string;
  name: string;
  provider: ModelProvider;
  modelId: string;
  description: string;
  longDescription?: string;
  capabilities: ModelCapability[];
  pricing: ModelPricing;
  limits: ModelLimits;
  category: MarketplaceCategory;
  tags: string[];
  rating: number;             // 1-5
  reviewCount: number;
  downloadCount: number;
  releaseDate: string;
  lastUpdated: string;
  author: string;
  website?: string;
  documentation?: string;
  benchmarks?: ModelBenchmark[];
  isInstalled?: boolean;
  isFeatured?: boolean;
  isNew?: boolean;
}

export type MarketplaceCategory = 
  | 'general'
  | 'coding'
  | 'writing'
  | 'analysis'
  | 'vision'
  | 'embedding'
  | 'specialized';

export interface ModelBenchmark {
  name: string;
  score: number;
  maxScore: number;
  category: string;
}

export interface UsageRecord {
  id: string;
  modelId: string;
  timestamp: Date;
  inputTokens: number;
  outputTokens: number;
  latency: number;
  cost: number;
  success: boolean;
  error?: string;
  sessionId?: string;
}

export interface CostSummary {
  today: number;
  thisWeek: number;
  thisMonth: number;
  allTime: number;
  byModel: Record<string, number>;
  byProvider: Record<ModelProvider, number>;
}

export interface PerformanceSummary {
  averageLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  averageTokensPerSecond: number;
  successRate: number;
  totalRequests: number;
  byModel: Record<string, {
    latency: number;
    tokensPerSecond: number;
    successRate: number;
  }>;
}

// API Request/Response types
export interface ModelsListResponse {
  models: AIModel[];
  providers: ProviderConfig[];
}

export interface ModelTestRequest {
  modelId: string;
  prompt?: string;
}

export interface ModelTestResponse {
  success: boolean;
  latency: number;
  response?: string;
  error?: string;
}

export interface CompareModelsRequest {
  modelIds: string[];
  prompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AddCustomEndpointRequest {
  name: string;
  baseUrl: string;
  apiKey?: string;
  provider: 'openai-compatible' | 'anthropic-compatible' | 'custom';
  models?: string[];
}

export interface UsageStatsRequest {
  startDate?: Date;
  endDate?: Date;
  modelId?: string;
  provider?: ModelProvider;
}

export interface UsageStatsResponse {
  records: UsageRecord[];
  costSummary: CostSummary;
  performanceSummary: PerformanceSummary;
}
