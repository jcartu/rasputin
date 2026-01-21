/**
 * Local LLM Router
 *
 * Intelligent routing layer that directs requests to the best available model.
 * Supports automatic failover from local to cloud, model selection based on
 * task type, and load balancing across multiple GPUs.
 */

import { OllamaClient, getOllamaClient } from "./ollama";
import { VLLMClient, getVLLMClient } from "./vllm";
import { invokeLLM, type Message as CloudMessage } from "../../_core/llm";
import type {
  LocalLLMConfig,
  ModelRegistry,
  LocalModel,
  ModelCapability as _ModelCapability,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
  EmbeddingRequest,
  EmbeddingResponse,
  RouterStatus,
  ModelStatus,
  ChatMessage,
} from "./types";

// Default model registry - will be configurable
const DEFAULT_REGISTRY: ModelRegistry = {
  models: [
    // Large reasoning models (RTX 6000 Pro - 96GB)
    {
      id: "llama3.3:70b",
      name: "Llama 3.3 70B",
      provider: "ollama",
      capabilities: ["general", "code", "function"],
      contextLength: 128000,
      vramRequired: 45,
      priority: 90,
    },
    {
      id: "qwen2.5:72b",
      name: "Qwen 2.5 72B",
      provider: "ollama",
      capabilities: ["general", "code", "function"],
      contextLength: 128000,
      vramRequired: 48,
      priority: 85,
    },
    {
      id: "deepseek-coder-v2:33b",
      name: "DeepSeek Coder V2 33B",
      provider: "ollama",
      capabilities: ["code", "function"],
      contextLength: 128000,
      vramRequired: 22,
      priority: 95, // Highest for code tasks
    },
    // Medium models (5090 - 32GB each)
    {
      id: "codellama:34b",
      name: "Code Llama 34B",
      provider: "ollama",
      capabilities: ["code"],
      contextLength: 16000,
      vramRequired: 20,
      priority: 80,
    },
    {
      id: "mixtral:8x7b",
      name: "Mixtral 8x7B",
      provider: "ollama",
      capabilities: ["general", "function"],
      contextLength: 32000,
      vramRequired: 26,
      priority: 75,
    },
    // Fast models
    {
      id: "llama3.2:3b",
      name: "Llama 3.2 3B",
      provider: "ollama",
      capabilities: ["fast", "general"],
      contextLength: 128000,
      vramRequired: 3,
      priority: 70,
    },
    {
      id: "mistral:7b",
      name: "Mistral 7B",
      provider: "ollama",
      capabilities: ["fast", "general", "function"],
      contextLength: 32000,
      vramRequired: 5,
      priority: 65,
    },
    // Vision models
    {
      id: "llama3.2-vision:11b",
      name: "Llama 3.2 Vision 11B",
      provider: "ollama",
      capabilities: ["vision", "general"],
      contextLength: 128000,
      vramRequired: 8,
      priority: 90, // Highest for vision
    },
    {
      id: "llava:13b",
      name: "LLaVA 13B",
      provider: "ollama",
      capabilities: ["vision"],
      contextLength: 4096,
      vramRequired: 10,
      priority: 80,
    },
    // Embedding models
    {
      id: "nomic-embed-text",
      name: "Nomic Embed Text",
      provider: "ollama",
      capabilities: ["embedding"],
      contextLength: 8192,
      vramRequired: 1,
      priority: 100,
    },
    {
      id: "mxbai-embed-large",
      name: "MixedBread Embed Large",
      provider: "ollama",
      capabilities: ["embedding"],
      contextLength: 512,
      vramRequired: 1,
      priority: 90,
    },
  ],
  defaultModel: "llama3.3:70b",
  codeModel: "deepseek-coder-v2:33b",
  fastModel: "mistral:7b",
  visionModel: "llama3.2-vision:11b",
};

const DEFAULT_CONFIG: LocalLLMConfig = {
  ollamaBaseUrl: "http://localhost:11434",
  ollamaEnabled: true,
  vllmBaseUrl: "http://localhost:8000",
  vllmEnabled: true,
  preferLocal: true,
  maxRetries: 2,
  timeoutMs: 300000,
  availableVram: 96, // RTX 6000 Pro
  reservedVram: 4,
};

export class LocalLLMRouter {
  private config: LocalLLMConfig;
  private registry: ModelRegistry;
  private ollamaClient: OllamaClient;
  private vllmClient: VLLMClient;

  // Stats tracking
  private stats = {
    requestsToday: 0,
    localRequestsToday: 0,
    cloudRequestsToday: 0,
    lastReset: new Date(),
  };

  constructor(config?: Partial<LocalLLMConfig>, registry?: ModelRegistry) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.registry = registry || DEFAULT_REGISTRY;

    this.ollamaClient = getOllamaClient({
      baseUrl: this.config.ollamaBaseUrl,
      timeoutMs: this.config.timeoutMs,
    });

    this.vllmClient = getVLLMClient({
      baseUrl: this.config.vllmBaseUrl,
      timeoutMs: this.config.timeoutMs,
    });
  }

  /**
   * Select the best model for a given request
   */
  private selectModel(request: CompletionRequest): LocalModel | null {
    // If specific model requested, use it
    if (request.model) {
      const model = this.registry.models.find(m => m.id === request.model);
      if (model) return model;
    }

    // Check for vision content
    const hasImages = request.messages.some(
      m => m.images && m.images.length > 0
    );
    if (hasImages) {
      return (
        this.registry.models
          .filter(m => m.capabilities.includes("vision"))
          .sort((a, b) => b.priority - a.priority)[0] || null
      );
    }

    // Select based on capability hint
    const capability = request.capability || "general";
    const candidates = this.registry.models
      .filter(m => m.capabilities.includes(capability))
      .filter(
        m =>
          m.vramRequired <= this.config.availableVram - this.config.reservedVram
      )
      .sort((a, b) => b.priority - a.priority);

    return candidates[0] || null;
  }

  /**
   * Check health of all providers
   */
  async checkHealth(): Promise<{
    ollama: boolean;
    vllm: boolean;
    cloud: boolean;
  }> {
    const [ollamaHealth, vllmHealth] = await Promise.all([
      this.config.ollamaEnabled ? this.ollamaClient.isHealthy() : false,
      this.config.vllmEnabled ? this.vllmClient.isHealthy() : false,
    ]);

    return {
      ollama: ollamaHealth,
      vllm: vllmHealth,
      cloud: true, // Assume cloud is always available
    };
  }

  /**
   * Get full router status
   */
  async getStatus(): Promise<RouterStatus> {
    const health = await this.checkHealth();

    let loadedModels: ModelStatus[] = [];
    let totalVramUsed = 0;

    if (health.ollama) {
      const ollamaModels = await this.ollamaClient.getModelStatuses();
      loadedModels = [...loadedModels, ...ollamaModels];
      totalVramUsed += ollamaModels
        .filter(m => m.status === "loaded")
        .reduce((sum, m) => sum + (m.vramUsed || 0), 0);
    }

    if (health.vllm) {
      const vllmModels = await this.vllmClient.getModelStatuses();
      loadedModels = [...loadedModels, ...vllmModels];
    }

    // Reset daily stats if needed
    const now = new Date();
    if (now.getDate() !== this.stats.lastReset.getDate()) {
      this.stats.requestsToday = 0;
      this.stats.localRequestsToday = 0;
      this.stats.cloudRequestsToday = 0;
      this.stats.lastReset = now;
    }

    return {
      ollamaConnected: health.ollama,
      vllmConnected: health.vllm,
      cloudAvailable: health.cloud,
      loadedModels,
      totalVramUsed,
      totalVramAvailable: this.config.availableVram,
      requestsToday: this.stats.requestsToday,
      localRequestsToday: this.stats.localRequestsToday,
      cloudRequestsToday: this.stats.cloudRequestsToday,
    };
  }

  /**
   * Convert our message format to cloud format
   */
  private toCloudMessages(messages: ChatMessage[]): CloudMessage[] {
    return messages.map(msg => ({
      role: msg.role as "system" | "user" | "assistant" | "tool",
      content: msg.content,
      tool_call_id: msg.toolCallId,
    }));
  }

  /**
   * Main completion method with automatic routing and fallback
   */
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    this.stats.requestsToday++;

    const health = await this.checkHealth();
    const selectedModel = this.selectModel(request);

    // Try local first if preferred and available
    if (this.config.preferLocal && selectedModel) {
      let lastError: Error | null = null;

      for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
        try {
          let response: CompletionResponse;

          if (selectedModel.provider === "ollama" && health.ollama) {
            response = await this.ollamaClient.chat({
              ...request,
              model: selectedModel.id,
            });
          } else if (selectedModel.provider === "vllm" && health.vllm) {
            response = await this.vllmClient.chat({
              ...request,
              model: selectedModel.id,
            });
          } else {
            throw new Error(`Provider ${selectedModel.provider} not available`);
          }

          this.stats.localRequestsToday++;
          return response;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          console.warn(
            `Local LLM attempt ${attempt + 1} failed:`,
            lastError.message
          );
        }
      }

      console.warn("All local attempts failed, falling back to cloud");
    }

    // Fallback to cloud
    try {
      const cloudResponse = await invokeLLM({
        messages: this.toCloudMessages(request.messages),
        tools: request.tools,
        tool_choice: request.toolChoice,
        max_tokens: request.maxTokens,
      });

      this.stats.cloudRequestsToday++;

      return {
        id: cloudResponse.id,
        model: cloudResponse.model,
        provider: "cloud",
        created: cloudResponse.created,
        choices: cloudResponse.choices.map(choice => ({
          index: choice.index,
          message: {
            role: "assistant",
            content:
              typeof choice.message.content === "string"
                ? choice.message.content
                : JSON.stringify(choice.message.content),
            toolCalls: choice.message.tool_calls,
          },
          finishReason: (choice.finish_reason || "stop") as
            | "stop"
            | "length"
            | "tool_calls"
            | "error",
        })),
        usage: cloudResponse.usage
          ? {
              promptTokens: cloudResponse.usage.prompt_tokens,
              completionTokens: cloudResponse.usage.completion_tokens,
              totalTokens: cloudResponse.usage.total_tokens,
            }
          : undefined,
        fallbackUsed: this.config.preferLocal,
      };
    } catch (error) {
      throw new Error(`All providers failed. Last error: ${error}`);
    }
  }

  /**
   * Streaming completion with automatic routing
   */
  async *completeStream(
    request: CompletionRequest
  ): AsyncGenerator<StreamChunk> {
    this.stats.requestsToday++;

    const health = await this.checkHealth();
    const selectedModel = this.selectModel(request);

    // Try local streaming
    if (this.config.preferLocal && selectedModel) {
      try {
        if (selectedModel.provider === "ollama" && health.ollama) {
          this.stats.localRequestsToday++;
          yield* this.ollamaClient.chatStream({
            ...request,
            model: selectedModel.id,
          });
          return;
        } else if (selectedModel.provider === "vllm" && health.vllm) {
          this.stats.localRequestsToday++;
          yield* this.vllmClient.chatStream({
            ...request,
            model: selectedModel.id,
          });
          return;
        }
      } catch (error) {
        console.warn("Local streaming failed, falling back to cloud:", error);
      }
    }

    // Cloud streaming fallback - convert to non-streaming for now
    // TODO: Implement proper cloud streaming
    this.stats.cloudRequestsToday++;
    const response = await this.complete(request);

    yield {
      id: response.id,
      model: response.model,
      provider: response.provider,
      choices: response.choices.map(choice => ({
        index: choice.index,
        delta: {
          role: "assistant",
          content: choice.message.content,
        },
        finishReason: choice.finishReason,
      })),
    };
  }

  /**
   * Generate embeddings
   */
  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const health = await this.checkHealth();

    if (health.ollama) {
      try {
        return await this.ollamaClient.embed(request);
      } catch (error) {
        console.warn("Ollama embedding failed:", error);
      }
    }

    // TODO: Add cloud embedding fallback
    throw new Error("No embedding provider available");
  }

  /**
   * Preload a model into memory
   */
  async preloadModel(modelId: string): Promise<void> {
    const model = this.registry.models.find(m => m.id === modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found in registry`);
    }

    if (model.provider === "ollama") {
      await this.ollamaClient.loadModel(modelId);
    }
    // vLLM models are loaded at server start
  }

  /**
   * Unload a model from memory
   */
  async unloadModel(modelId: string): Promise<void> {
    const model = this.registry.models.find(m => m.id === modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found in registry`);
    }

    if (model.provider === "ollama") {
      await this.ollamaClient.unloadModel(modelId);
    }
    // vLLM doesn't support dynamic unloading
  }

  /**
   * Get the model registry
   */
  getRegistry(): ModelRegistry {
    return this.registry;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<LocalLLMConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Singleton instance
let routerInstance: LocalLLMRouter | null = null;

export function getLocalLLMRouter(
  config?: Partial<LocalLLMConfig>,
  registry?: ModelRegistry
): LocalLLMRouter {
  if (!routerInstance || config || registry) {
    routerInstance = new LocalLLMRouter(config, registry);
  }
  return routerInstance;
}

// Export for direct use
export { DEFAULT_REGISTRY, DEFAULT_CONFIG };
