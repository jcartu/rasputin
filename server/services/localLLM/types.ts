/**
 * Local LLM Integration Types
 *
 * Defines interfaces for routing requests to local models (Ollama, vLLM)
 * with automatic fallback to cloud APIs.
 */

export type ModelProvider = "ollama" | "vllm" | "cloud";

export type ModelCapability =
  | "general" // General purpose reasoning
  | "code" // Code generation/analysis
  | "vision" // Image understanding
  | "fast" // Quick responses (smaller models)
  | "embedding" // Text embeddings
  | "function"; // Function calling support

export interface LocalModel {
  id: string; // Unique identifier (e.g., "llama3.3:70b")
  name: string; // Display name
  provider: ModelProvider; // Which backend serves this model
  capabilities: ModelCapability[]; // What this model is good at
  contextLength: number; // Max context window
  vramRequired: number; // VRAM in GB needed to load
  priority: number; // Higher = prefer this model (0-100)
  endpoint?: string; // Custom endpoint if not default
  isLoaded?: boolean; // Whether model is currently loaded
  lastUsed?: Date; // For LRU eviction
}

export interface ModelRegistry {
  models: LocalModel[];
  defaultModel: string; // Default model ID for general tasks
  codeModel: string; // Default for code tasks
  fastModel: string; // Default for quick responses
  visionModel: string; // Default for vision tasks
}

export interface LocalLLMConfig {
  // Ollama settings
  ollamaBaseUrl: string; // Default: http://localhost:11434
  ollamaEnabled: boolean;

  // vLLM settings
  vllmBaseUrl: string; // Default: http://localhost:8000
  vllmEnabled: boolean;

  // Routing settings
  preferLocal: boolean; // Try local first, fallback to cloud
  maxRetries: number; // Retries before fallback
  timeoutMs: number; // Request timeout

  // GPU settings (for model loading decisions)
  availableVram: number; // Total VRAM in GB
  reservedVram: number; // VRAM to keep free
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  images?: string[]; // Base64 encoded images for vision
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface Tool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

export interface CompletionRequest {
  messages: ChatMessage[];
  model?: string; // Specific model or auto-select
  capability?: ModelCapability; // Hint for model selection
  tools?: Tool[];
  toolChoice?: "none" | "auto" | "required" | { name: string };
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  responseFormat?: ResponseFormat;
}

export interface ResponseFormat {
  type: "text" | "json_object" | "json_schema";
  jsonSchema?: {
    name: string;
    schema: Record<string, unknown>;
    strict?: boolean;
  };
}

export interface CompletionResponse {
  id: string;
  model: string;
  provider: ModelProvider;
  created: number;
  choices: Array<{
    index: number;
    message: {
      role: "assistant";
      content: string;
      toolCalls?: ToolCall[];
    };
    finishReason: "stop" | "length" | "tool_calls" | "error";
  }>;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  timing?: {
    queueTimeMs: number;
    inferenceTimeMs: number;
    totalTimeMs: number;
  };
  fallbackUsed?: boolean; // True if fell back to cloud
}

export interface StreamChunk {
  id: string;
  model: string;
  provider: ModelProvider;
  choices: Array<{
    index: number;
    delta: {
      role?: "assistant";
      content?: string;
      toolCalls?: Partial<ToolCall>[];
    };
    finishReason?: "stop" | "length" | "tool_calls" | "error";
  }>;
}

export interface EmbeddingRequest {
  input: string | string[];
  model?: string;
}

export interface EmbeddingResponse {
  model: string;
  provider: ModelProvider;
  embeddings: number[][];
  usage?: {
    promptTokens: number;
    totalTokens: number;
  };
}

export interface ModelStatus {
  id: string;
  name: string;
  provider: ModelProvider;
  status: "loaded" | "loading" | "unloaded" | "error";
  vramUsed?: number;
  lastUsed?: Date;
  requestCount?: number;
  avgLatencyMs?: number;
  errorCount?: number;
}

export interface RouterStatus {
  ollamaConnected: boolean;
  vllmConnected: boolean;
  cloudAvailable: boolean;
  loadedModels: ModelStatus[];
  totalVramUsed: number;
  totalVramAvailable: number;
  requestsToday: number;
  localRequestsToday: number;
  cloudRequestsToday: number;
}
