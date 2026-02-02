/**
 * Ollama Client
 *
 * Handles communication with local Ollama instance for model inference.
 * Supports streaming, tool calling, and vision models.
 */

import type {
  ChatMessage,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
  EmbeddingRequest,
  EmbeddingResponse,
  ModelStatus,
  Tool,
} from "./types";

export interface OllamaConfig {
  baseUrl: string;
  timeoutMs: number;
}

interface OllamaMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  images?: string[];
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: Record<string, unknown>;
    };
  }>;
}

interface OllamaChatRequest {
  model: string;
  messages: OllamaMessage[];
  stream?: boolean;
  format?: "json" | "";
  options?: {
    temperature?: number;
    num_predict?: number;
    num_ctx?: number;
  };
  tools?: Array<{
    type: "function";
    function: {
      name: string;
      description?: string;
      parameters?: Record<string, unknown>;
    };
  }>;
}

interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: "assistant";
    content: string;
    tool_calls?: Array<{
      id: string;
      type: "function";
      function: {
        name: string;
        arguments: Record<string, unknown>;
      };
    }>;
  };
  done: boolean;
  done_reason?: "stop" | "length";
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

interface OllamaStreamChunk {
  model: string;
  created_at: string;
  message: {
    role: "assistant";
    content: string;
  };
  done: boolean;
  done_reason?: "stop" | "length";
  total_duration?: number;
  eval_count?: number;
}

interface OllamaModelInfo {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    format: string;
    family: string;
    parameter_size: string;
    quantization_level: string;
  };
}

interface OllamaRunningModel {
  name: string;
  model: string;
  size: number;
  digest: string;
  details: {
    format: string;
    family: string;
    parameter_size: string;
    quantization_level: string;
  };
  expires_at: string;
  size_vram: number;
}

export class OllamaClient {
  private baseUrl: string;
  private timeoutMs: number;

  constructor(config: OllamaConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.timeoutMs = config.timeoutMs;
  }

  /**
   * Check if Ollama is reachable
   */
  async isHealthy(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: controller.signal,
      });

      clearTimeout(timeout);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * List available models
   */
  async listModels(): Promise<OllamaModelInfo[]> {
    const response = await fetch(`${this.baseUrl}/api/tags`);
    if (!response.ok) {
      throw new Error(`Failed to list models: ${response.statusText}`);
    }
    const data = await response.json();
    return data.models || [];
  }

  /**
   * List currently loaded/running models
   */
  async listRunningModels(): Promise<OllamaRunningModel[]> {
    const response = await fetch(`${this.baseUrl}/api/ps`);
    if (!response.ok) {
      throw new Error(`Failed to list running models: ${response.statusText}`);
    }
    const data = await response.json();
    return data.models || [];
  }

  /**
   * Get status of all models
   */
  async getModelStatuses(): Promise<ModelStatus[]> {
    const [available, running] = await Promise.all([
      this.listModels(),
      this.listRunningModels(),
    ]);

    const runningSet = new Set(running.map(m => m.name));

    return available.map(model => ({
      id: model.name,
      name: model.name,
      provider: "ollama" as const,
      status: runningSet.has(model.name)
        ? ("loaded" as const)
        : ("unloaded" as const),
      vramUsed: running.find(r => r.name === model.name)?.size_vram,
    }));
  }

  /**
   * Load a model into memory
   */
  async loadModel(modelName: string): Promise<void> {
    // Ollama loads models on first use, but we can warm it up
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelName,
        prompt: "",
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to load model ${modelName}: ${response.statusText}`
      );
    }
  }

  /**
   * Unload a model from memory
   */
  async unloadModel(modelName: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelName,
        keep_alive: 0,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to unload model ${modelName}: ${response.statusText}`
      );
    }
  }

  /**
   * Convert our message format to Ollama format
   */
  private convertMessages(messages: ChatMessage[]): OllamaMessage[] {
    return messages.map(msg => {
      const ollamaMsg: OllamaMessage = {
        role: msg.role,
        content: msg.content,
      };

      if (msg.images && msg.images.length > 0) {
        ollamaMsg.images = msg.images;
      }

      if (msg.toolCalls) {
        ollamaMsg.tool_calls = msg.toolCalls.map(tc => ({
          id: tc.id,
          type: "function" as const,
          function: {
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments),
          },
        }));
      }

      return ollamaMsg;
    });
  }

  /**
   * Convert tools to Ollama format
   */
  private convertTools(tools?: Tool[]): OllamaChatRequest["tools"] {
    if (!tools) return undefined;
    return tools.map(tool => ({
      type: "function" as const,
      function: {
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters,
      },
    }));
  }

  /**
   * Chat completion (non-streaming)
   */
  async chat(request: CompletionRequest): Promise<CompletionResponse> {
    const model = request.model || "llama3.3:70b";
    const startTime = Date.now();

    const ollamaRequest: OllamaChatRequest = {
      model,
      messages: this.convertMessages(request.messages),
      stream: false,
      options: {
        temperature: request.temperature,
        num_predict: request.maxTokens,
        num_ctx: request.numCtx,
      },
      tools: this.convertTools(request.tools),
    };

    if (
      request.responseFormat?.type === "json_object" ||
      request.responseFormat?.type === "json_schema"
    ) {
      ollamaRequest.format = "json";
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ollamaRequest),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Ollama chat failed: ${response.status} - ${errorText}`
        );
      }

      const data: OllamaChatResponse = await response.json();
      const endTime = Date.now();

      return {
        id: `ollama-${Date.now()}`,
        model: data.model,
        provider: "ollama",
        created: Date.now(),
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: data.message.content,
              toolCalls: data.message.tool_calls?.map(tc => ({
                id: tc.id,
                type: "function" as const,
                function: {
                  name: tc.function.name,
                  arguments: JSON.stringify(tc.function.arguments),
                },
              })),
            },
            finishReason:
              data.done_reason === "length"
                ? "length"
                : data.message.tool_calls
                  ? "tool_calls"
                  : "stop",
          },
        ],
        usage: {
          promptTokens: data.prompt_eval_count || 0,
          completionTokens: data.eval_count || 0,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        },
        timing: {
          queueTimeMs: data.load_duration ? data.load_duration / 1_000_000 : 0,
          inferenceTimeMs: data.total_duration
            ? data.total_duration / 1_000_000
            : 0,
          totalTimeMs: endTime - startTime,
        },
      };
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }

  /**
   * Chat completion (streaming)
   */
  async *chatStream(request: CompletionRequest): AsyncGenerator<StreamChunk> {
    const model = request.model || "llama3.3:70b";

    const ollamaRequest: OllamaChatRequest = {
      model,
      messages: this.convertMessages(request.messages),
      stream: true,
      options: {
        temperature: request.temperature,
        num_predict: request.maxTokens,
      },
    };

    if (
      request.responseFormat?.type === "json_object" ||
      request.responseFormat?.type === "json_schema"
    ) {
      ollamaRequest.format = "json";
    }

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ollamaRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Ollama stream failed: ${response.status} - ${errorText}`
      );
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const chunk: OllamaStreamChunk = JSON.parse(line);

            yield {
              id: `ollama-stream-${Date.now()}`,
              model: chunk.model,
              provider: "ollama",
              choices: [
                {
                  index: 0,
                  delta: {
                    role: "assistant",
                    content: chunk.message.content,
                  },
                  finishReason: chunk.done
                    ? chunk.done_reason === "length"
                      ? "length"
                      : "stop"
                    : undefined,
                },
              ],
            };
          } catch {
            // Skip malformed JSON lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Generate embeddings
   */
  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const model = request.model || "nomic-embed-text";
    const inputs = Array.isArray(request.input)
      ? request.input
      : [request.input];

    const embeddings: number[][] = [];

    for (const input of inputs) {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          prompt: input,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama embedding failed: ${response.statusText}`);
      }

      const data = await response.json();
      embeddings.push(data.embedding);
    }

    return {
      model,
      provider: "ollama",
      embeddings,
    };
  }

  /**
   * Pull a model from Ollama registry
   */
  async pullModel(
    modelName: string,
    onProgress?: (status: string) => void
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: modelName,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to pull model: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (onProgress && data.status) {
              onProgress(data.status);
            }
          } catch {
            // Skip malformed lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

// Default instance
let defaultClient: OllamaClient | null = null;

export function getOllamaClient(config?: OllamaConfig): OllamaClient {
  if (!defaultClient || config) {
    defaultClient = new OllamaClient(
      config || {
        baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
        timeoutMs: 300000, // 5 minutes for large models
      }
    );
  }
  return defaultClient;
}
