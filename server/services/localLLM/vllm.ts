/**
 * vLLM Client
 *
 * Handles communication with local vLLM instance for high-performance inference.
 * vLLM uses OpenAI-compatible API, making integration straightforward.
 * Optimized for continuous batching and high throughput.
 */

import type {
  ChatMessage,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
  Tool,
  ModelStatus,
} from "./types";

export interface VLLMConfig {
  baseUrl: string;
  timeoutMs: number;
  apiKey?: string; // Optional API key if vLLM is configured with auth
}

interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
}

interface OpenAIChatRequest {
  model: string;
  messages: OpenAIMessage[];
  stream?: boolean;
  max_tokens?: number;
  temperature?: number;
  tools?: Array<{
    type: "function";
    function: {
      name: string;
      description?: string;
      parameters?: Record<string, unknown>;
    };
  }>;
  tool_choice?:
    | "none"
    | "auto"
    | { type: "function"; function: { name: string } };
  response_format?: { type: "text" | "json_object" };
}

interface OpenAIChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: "assistant";
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: "stop" | "length" | "tool_calls";
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: "assistant";
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: "function";
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason: "stop" | "length" | "tool_calls" | null;
  }>;
}

interface VLLMModelInfo {
  id: string;
  object: string;
  created: number;
  owned_by: string;
  root: string;
  parent: string | null;
  permission: unknown[];
}

export class VLLMClient {
  private baseUrl: string;
  private timeoutMs: number;
  private apiKey?: string;

  constructor(config: VLLMConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.timeoutMs = config.timeoutMs;
    this.apiKey = config.apiKey;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  /**
   * Check if vLLM is reachable
   */
  async isHealthy(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.baseUrl}/health`, {
        signal: controller.signal,
        headers: this.getHeaders(),
      });

      clearTimeout(timeout);
      return response.ok;
    } catch {
      // Try the models endpoint as fallback (some vLLM versions)
      try {
        const response = await fetch(`${this.baseUrl}/v1/models`, {
          headers: this.getHeaders(),
        });
        return response.ok;
      } catch {
        return false;
      }
    }
  }

  /**
   * List available models
   */
  async listModels(): Promise<VLLMModelInfo[]> {
    const response = await fetch(`${this.baseUrl}/v1/models`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to list models: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data || [];
  }

  /**
   * Get model statuses
   */
  async getModelStatuses(): Promise<ModelStatus[]> {
    const models = await this.listModels();

    return models.map(model => ({
      id: model.id,
      name: model.id,
      provider: "vllm" as const,
      status: "loaded" as const, // vLLM models are always loaded when listed
    }));
  }

  /**
   * Convert our message format to OpenAI format
   */
  private convertMessages(messages: ChatMessage[]): OpenAIMessage[] {
    return messages.map(msg => {
      const openaiMsg: OpenAIMessage = {
        role: msg.role,
        content: msg.content,
      };

      if (msg.toolCalls) {
        openaiMsg.tool_calls = msg.toolCalls.map(tc => ({
          id: tc.id,
          type: "function" as const,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        }));
      }

      if (msg.toolCallId) {
        openaiMsg.tool_call_id = msg.toolCallId;
      }

      return openaiMsg;
    });
  }

  /**
   * Convert tools to OpenAI format
   */
  private convertTools(tools?: Tool[]): OpenAIChatRequest["tools"] {
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
   * Convert tool choice to OpenAI format
   */
  private convertToolChoice(
    toolChoice?: CompletionRequest["toolChoice"]
  ): OpenAIChatRequest["tool_choice"] {
    if (!toolChoice) return undefined;
    if (toolChoice === "none" || toolChoice === "auto") return toolChoice;
    if (toolChoice === "required") return "auto"; // vLLM doesn't support 'required'
    if (typeof toolChoice === "object" && "name" in toolChoice) {
      return {
        type: "function",
        function: { name: toolChoice.name },
      };
    }
    return undefined;
  }

  /**
   * Chat completion (non-streaming)
   */
  async chat(request: CompletionRequest): Promise<CompletionResponse> {
    const model = request.model || "default";
    const startTime = Date.now();

    const openaiRequest: OpenAIChatRequest = {
      model,
      messages: this.convertMessages(request.messages),
      stream: false,
      max_tokens: request.maxTokens || 4096,
      temperature: request.temperature,
      tools: this.convertTools(request.tools),
      tool_choice: this.convertToolChoice(request.toolChoice),
    };

    if (request.responseFormat?.type === "json_object") {
      openaiRequest.response_format = { type: "json_object" };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(openaiRequest),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`vLLM chat failed: ${response.status} - ${errorText}`);
      }

      const data: OpenAIChatResponse = await response.json();
      const endTime = Date.now();

      return {
        id: data.id,
        model: data.model,
        provider: "vllm",
        created: data.created,
        choices: data.choices.map(choice => ({
          index: choice.index,
          message: {
            role: "assistant",
            content: choice.message.content || "",
            toolCalls: choice.message.tool_calls?.map(tc => ({
              id: tc.id,
              type: "function" as const,
              function: {
                name: tc.function.name,
                arguments: tc.function.arguments,
              },
            })),
          },
          finishReason: choice.finish_reason,
        })),
        usage: {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        },
        timing: {
          queueTimeMs: 0,
          inferenceTimeMs: endTime - startTime,
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
    const model = request.model || "default";

    const openaiRequest: OpenAIChatRequest = {
      model,
      messages: this.convertMessages(request.messages),
      stream: true,
      max_tokens: request.maxTokens || 4096,
      temperature: request.temperature,
      tools: this.convertTools(request.tools),
      tool_choice: this.convertToolChoice(request.toolChoice),
    };

    if (request.responseFormat?.type === "json_object") {
      openaiRequest.response_format = { type: "json_object" };
    }

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(openaiRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`vLLM stream failed: ${response.status} - ${errorText}`);
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
          const trimmed = line.trim();
          if (!trimmed || trimmed === "data: [DONE]") continue;
          if (!trimmed.startsWith("data: ")) continue;

          try {
            const chunk: OpenAIStreamChunk = JSON.parse(trimmed.slice(6));

            const choice = chunk.choices[0];
            if (!choice) continue;

            yield {
              id: chunk.id,
              model: chunk.model,
              provider: "vllm",
              choices: [
                {
                  index: choice.index,
                  delta: {
                    role: choice.delta.role,
                    content: choice.delta.content,
                    toolCalls: choice.delta.tool_calls?.map(tc => ({
                      id: tc.id || "",
                      type: "function" as const,
                      function: {
                        name: tc.function?.name || "",
                        arguments: tc.function?.arguments || "",
                      },
                    })),
                  },
                  finishReason: choice.finish_reason || undefined,
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
   * Get server metrics (if available)
   */
  async getMetrics(): Promise<Record<string, unknown> | null> {
    try {
      const response = await fetch(`${this.baseUrl}/metrics`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) return null;

      const text = await response.text();
      // Parse Prometheus metrics format
      const metrics: Record<string, unknown> = {};
      const lines = text.split("\n");

      for (const line of lines) {
        if (line.startsWith("#") || !line.trim()) continue;
        const match = line.match(/^(\w+)(?:\{[^}]*\})?\s+(.+)$/);
        if (match) {
          metrics[match[1]] = parseFloat(match[2]) || match[2];
        }
      }

      return metrics;
    } catch {
      return null;
    }
  }
}

// Default instance
let defaultClient: VLLMClient | null = null;

export function getVLLMClient(config?: VLLMConfig): VLLMClient {
  if (!defaultClient || config) {
    defaultClient = new VLLMClient(
      config || {
        baseUrl: process.env.VLLM_BASE_URL || "http://localhost:8000",
        timeoutMs: 300000, // 5 minutes for large models
        apiKey: process.env.VLLM_API_KEY,
      }
    );
  }
  return defaultClient;
}
