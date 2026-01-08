/**
 * AI Model Service
 * Handles communication with multiple AI providers with fallback to OpenRouter
 */

import {
  ModelConfig,
  FRONTIER_MODELS,
  ModelResponseData,
  getModelsForTier,
} from "../../shared/rasputin";

// ============================================================================
// Types
// ============================================================================

interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onComplete: (response: ModelResponseData) => void;
  onError: (error: Error) => void;
}

interface QueryOptions {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

// ============================================================================
// Environment Variables
// ============================================================================

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const XAI_API_KEY = process.env.XAI_API_KEY;
const SONAR_API_KEY = process.env.SONAR_API_KEY;
const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY;

// Log API key availability at startup
console.log("[AI Models] API Keys loaded:", {
  OPENROUTER: !!OPENROUTER_API_KEY,
  ANTHROPIC: !!ANTHROPIC_API_KEY,
  GEMINI: !!GEMINI_API_KEY,
  XAI: !!XAI_API_KEY,
  SONAR: !!SONAR_API_KEY,
  CEREBRAS: !!CEREBRAS_API_KEY,
});

// ============================================================================
// Provider-specific API calls
// ============================================================================

// Map our model IDs to actual Anthropic API model names (Jan 2026)
const ANTHROPIC_MODEL_MAP: Record<string, string> = {
  "claude-sonnet-4.5": "claude-4-sonnet-20260101",
  "claude-opus-4.5": "claude-4-opus-20260101",
};

async function queryAnthropicDirect(
  model: ModelConfig,
  options: QueryOptions,
  callbacks?: StreamCallbacks
): Promise<ModelResponseData> {
  const startTime = Date.now();

  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const anthropicModel =
    ANTHROPIC_MODEL_MAP[model.id] || "claude-4-opus-20260101";

  const systemMessage = options.messages.find(m => m.role === "system");
  const nonSystemMessages = options.messages.filter(m => m.role !== "system");

  const body: Record<string, unknown> = {
    model: anthropicModel,
    max_tokens: options.maxTokens || model.maxOutputTokens,
    messages: nonSystemMessages.map(m => ({
      role: m.role,
      content: m.content,
    })),
  };

  if (systemMessage) {
    body.system = systemMessage.content;
  }

  if (options.stream && callbacks) {
    body.stream = true;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    let fullContent = "";
    let inputTokens = 0;
    let outputTokens = 0;
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "content_block_delta" && data.delta?.text) {
              fullContent += data.delta.text;
              callbacks.onChunk(data.delta.text);
            }
            if (data.type === "message_delta" && data.usage) {
              outputTokens = data.usage.output_tokens || 0;
            }
            if (data.type === "message_start" && data.message?.usage) {
              inputTokens = data.message.usage.input_tokens || 0;
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }

    const latencyMs = Date.now() - startTime;
    const cost = calculateCost(model, inputTokens, outputTokens);

    const result: ModelResponseData = {
      modelId: model.id,
      modelName: model.name,
      content: fullContent,
      status: "completed",
      latencyMs,
      inputTokens,
      outputTokens,
      cost,
      provider: "anthropic",
    };

    callbacks.onComplete(result);
    return result;
  }

  // Non-streaming
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const data = await response.json();
  const latencyMs = Date.now() - startTime;
  const content = data.content?.[0]?.text || "";
  const inputTokens = data.usage?.input_tokens || 0;
  const outputTokens = data.usage?.output_tokens || 0;
  const cost = calculateCost(model, inputTokens, outputTokens);

  return {
    modelId: model.id,
    modelName: model.name,
    content,
    status: "completed",
    latencyMs,
    inputTokens,
    outputTokens,
    cost,
    provider: "anthropic",
  };
}

async function queryGoogleDirect(
  model: ModelConfig,
  options: QueryOptions,
  callbacks?: StreamCallbacks
): Promise<ModelResponseData> {
  const startTime = Date.now();

  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const geminiModelMap: Record<string, string> = {
    "gemini-3-flash": "gemini-2.5-flash",
    "gemini-3-pro": "gemini-2.5-pro",
  };
  const geminiModel = geminiModelMap[model.id] || "gemini-2.5-flash";

  const contents = options.messages
    .filter(m => m.role !== "system")
    .map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const systemInstruction = options.messages.find(m => m.role === "system");

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      maxOutputTokens: options.maxTokens || model.maxOutputTokens,
      temperature: options.temperature || 0.7,
    },
  };

  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction.content }] };
  }

  const endpoint = options.stream
    ? `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:streamGenerateContent?key=${GEMINI_API_KEY}`
    : `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${GEMINI_API_KEY}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  if (options.stream && callbacks) {
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    let fullContent = "";
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Gemini streams JSON objects separated by newlines
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.trim()) {
          try {
            const data = JSON.parse(line.replace(/^\[|,$/g, ""));
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            if (text) {
              fullContent += text;
              callbacks.onChunk(text);
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }

    const latencyMs = Date.now() - startTime;
    // Estimate tokens (Gemini doesn't always return token counts in streaming)
    const inputTokens = Math.ceil(
      options.messages.reduce((acc, m) => acc + m.content.length, 0) / 4
    );
    const outputTokens = Math.ceil(fullContent.length / 4);
    const cost = calculateCost(model, inputTokens, outputTokens);

    const result: ModelResponseData = {
      modelId: model.id,
      modelName: model.name,
      content: fullContent,
      status: "completed",
      latencyMs,
      inputTokens,
      outputTokens,
      cost,
      provider: "google",
    };

    callbacks.onComplete(result);
    return result;
  }

  // Non-streaming
  const data = await response.json();
  const latencyMs = Date.now() - startTime;
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const inputTokens = data.usageMetadata?.promptTokenCount || 0;
  const outputTokens = data.usageMetadata?.candidatesTokenCount || 0;
  const cost = calculateCost(model, inputTokens, outputTokens);

  return {
    modelId: model.id,
    modelName: model.name,
    content,
    status: "completed",
    latencyMs,
    inputTokens,
    outputTokens,
    cost,
    provider: "google",
  };
}

const XAI_MODEL_MAP: Record<string, string> = {
  "grok-4.1": "grok-4.1",
  "grok-4.1-pro": "grok-4.2",
};

async function queryXAIDirect(
  model: ModelConfig,
  options: QueryOptions,
  callbacks?: StreamCallbacks
): Promise<ModelResponseData> {
  const startTime = Date.now();

  if (!XAI_API_KEY) {
    throw new Error("XAI_API_KEY not configured");
  }

  const xaiModel = XAI_MODEL_MAP[model.id] || "grok-4.1";

  // Use non-streaming for xAI to avoid SSE parsing issues
  const body: Record<string, unknown> = {
    model: xaiModel,
    messages: options.messages,
    max_tokens: options.maxTokens || model.maxOutputTokens,
    temperature: options.temperature || 0.7,
    stream: false, // Disable streaming for xAI due to SSE parsing issues
  };

  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${XAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`xAI API error: ${response.status}`);
  }

  // Non-streaming response
  const data = await response.json();
  const latencyMs = Date.now() - startTime;
  const content = data.choices?.[0]?.message?.content || "";
  const inputTokens = data.usage?.prompt_tokens || 0;
  const outputTokens = data.usage?.completion_tokens || 0;
  const cost = calculateCost(model, inputTokens, outputTokens);

  const result: ModelResponseData = {
    modelId: model.id,
    modelName: model.name,
    content,
    status: "completed",
    latencyMs,
    inputTokens,
    outputTokens,
    cost,
    provider: "xai",
  };

  // Call onComplete callback if provided
  if (callbacks?.onComplete) {
    callbacks.onComplete(result);
  }

  return result;
}

async function queryPerplexityDirect(
  model: ModelConfig,
  options: QueryOptions,
  callbacks?: StreamCallbacks
): Promise<ModelResponseData> {
  const startTime = Date.now();

  if (!SONAR_API_KEY) {
    throw new Error("SONAR_API_KEY not configured");
  }

  // Use non-streaming for Perplexity to avoid SSE parsing issues
  const body: Record<string, unknown> = {
    model: "sonar", // Use 'sonar' as the base model
    messages: options.messages,
    max_tokens: options.maxTokens || model.maxOutputTokens,
    temperature: options.temperature || 0.7,
    stream: false, // Disable streaming for Perplexity
  };

  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SONAR_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Perplexity API error: ${response.status}`);
  }

  // Non-streaming response
  const data = await response.json();
  const latencyMs = Date.now() - startTime;
  const content = data.choices?.[0]?.message?.content || "";
  const inputTokens = data.usage?.prompt_tokens || 0;
  const outputTokens = data.usage?.completion_tokens || 0;
  const cost = calculateCost(model, inputTokens, outputTokens);

  const result: ModelResponseData = {
    modelId: model.id,
    modelName: model.name,
    content,
    status: "completed",
    latencyMs,
    inputTokens,
    outputTokens,
    cost,
    provider: "perplexity",
  };

  // Call onComplete callback if provided
  if (callbacks?.onComplete) {
    callbacks.onComplete(result);
  }

  return result;
}

// ============================================================================
// Cerebras API (Ultra-fast inference - 2000+ tokens/sec)
// ============================================================================

const CEREBRAS_MODEL_MAP: Record<string, string> = {
  "cerebras-llama-70b": "llama-3.3-70b",
  "cerebras-qwen-32b": "qwen-3-32b",
};

async function queryCerebrasDirect(
  model: ModelConfig,
  options: QueryOptions,
  callbacks?: StreamCallbacks
): Promise<ModelResponseData> {
  const startTime = Date.now();

  if (!CEREBRAS_API_KEY) {
    throw new Error("CEREBRAS_API_KEY not configured");
  }

  const cerebrasModel = CEREBRAS_MODEL_MAP[model.id] || "llama-3.3-70b";

  const body: Record<string, unknown> = {
    model: cerebrasModel,
    messages: options.messages,
    max_tokens: options.maxTokens || model.maxOutputTokens,
    temperature: options.temperature || 0.7,
    stream: options.stream || false,
  };

  if (options.stream && callbacks) {
    const response = await fetch(
      "https://api.cerebras.ai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${CEREBRAS_API_KEY}`,
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cerebras API error: ${response.status} - ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    let fullContent = "";
    let inputTokens = 0;
    let outputTokens = 0;
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const dataStr = line.slice(6).trim();
          if (dataStr === "[DONE]") continue;
          try {
            const data = JSON.parse(dataStr);
            const content = data.choices?.[0]?.delta?.content || "";
            if (content) {
              fullContent += content;
              callbacks.onChunk(content);
            }
            // Capture usage from final chunk
            if (data.usage) {
              inputTokens = data.usage.prompt_tokens || 0;
              outputTokens = data.usage.completion_tokens || 0;
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }

    const latencyMs = Date.now() - startTime;
    const cost = calculateCost(model, inputTokens, outputTokens);

    const result: ModelResponseData = {
      modelId: model.id,
      modelName: model.name,
      content: fullContent,
      status: "completed",
      latencyMs,
      inputTokens,
      outputTokens,
      cost,
      provider: "cerebras",
    };

    callbacks.onComplete(result);
    return result;
  }

  // Non-streaming response
  const response = await fetch("https://api.cerebras.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CEREBRAS_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cerebras API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const latencyMs = Date.now() - startTime;
  const content = data.choices?.[0]?.message?.content || "";
  const inputTokens = data.usage?.prompt_tokens || 0;
  const outputTokens = data.usage?.completion_tokens || 0;
  const cost = calculateCost(model, inputTokens, outputTokens);

  const result: ModelResponseData = {
    modelId: model.id,
    modelName: model.name,
    content,
    status: "completed",
    latencyMs,
    inputTokens,
    outputTokens,
    cost,
    provider: "cerebras",
  };

  if (callbacks?.onComplete) {
    callbacks.onComplete(result);
  }

  return result;
}

const OPENROUTER_MODEL_MAP: Record<string, string> = {
  "gpt-5": "openai/gpt-5.2",
  "gpt-5.2-pro": "openai/gpt-5.2",
  "claude-sonnet-4.5": "anthropic/claude-4-sonnet",
  "claude-opus-4.5": "anthropic/claude-4-opus",
  "gemini-3-flash": "google/gemini-2.5-flash",
  "gemini-3-pro": "google/gemini-2.5-pro",
  "grok-4.1": "x-ai/grok-4.1",
  "grok-4.1-pro": "x-ai/grok-4.2",
  "sonar-pro": "perplexity/sonar-pro",
};

// Timeout for OpenRouter requests (60 seconds)
const OPENROUTER_TIMEOUT_MS = 60000;

async function queryOpenRouter(
  model: ModelConfig,
  options: QueryOptions,
  callbacks?: StreamCallbacks
): Promise<ModelResponseData> {
  const startTime = Date.now();

  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY not configured");
  }

  const openRouterId =
    OPENROUTER_MODEL_MAP[model.id] ||
    model.openRouterId ||
    "anthropic/claude-3.5-sonnet";

  // Use non-streaming for OpenRouter to avoid SSE parsing issues
  const body: Record<string, unknown> = {
    model: openRouterId,
    messages: options.messages,
    max_tokens: options.maxTokens || model.maxOutputTokens,
    temperature: options.temperature || 0.7,
    stream: false, // Disable streaming for OpenRouter
  };

  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);

  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://rasputin.manus.space",
          "X-Title": "RASPUTIN Consensus Engine",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    // Non-streaming response
    const data = await response.json();
    const latencyMs = Date.now() - startTime;
    const content = data.choices?.[0]?.message?.content || "";
    const inputTokens = data.usage?.prompt_tokens || 0;
    const outputTokens = data.usage?.completion_tokens || 0;
    const cost = calculateCost(model, inputTokens, outputTokens);

    const result: ModelResponseData = {
      modelId: model.id,
      modelName: model.name,
      content,
      status: "completed",
      latencyMs,
      inputTokens,
      outputTokens,
      cost,
      provider: "openrouter",
    };

    // Call onComplete callback if provided
    if (callbacks?.onComplete) {
      callbacks.onComplete(result);
    }

    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `OpenRouter timeout after ${OPENROUTER_TIMEOUT_MS / 1000}s for ${model.id}`
      );
    }
    throw error;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

function calculateCost(
  model: ModelConfig,
  inputTokens: number,
  outputTokens: number
): number {
  const inputCost = (inputTokens / 1_000_000) * model.inputPricePerMillion;
  const outputCost = (outputTokens / 1_000_000) * model.outputPricePerMillion;
  return inputCost + outputCost;
}

// ============================================================================
// Main Query Function with Fallback
// ============================================================================

export async function queryModel(
  model: ModelConfig,
  options: QueryOptions,
  callbacks?: StreamCallbacks
): Promise<ModelResponseData> {
  console.log(
    `[AI Models] Querying model: ${model.id} (provider: ${model.provider})`
  );

  // Try direct API first, fallback to OpenRouter
  const directQueryFn = getDirectQueryFunction(model.provider);

  if (directQueryFn) {
    try {
      console.log(`[AI Models] Using direct API for ${model.id}`);
      const result = await directQueryFn(model, options, callbacks);
      console.log(`[AI Models] Direct API success for ${model.id}`);
      return result;
    } catch (error) {
      console.error(
        `[AI Models] Direct API failed for ${model.id}:`,
        error instanceof Error ? error.message : error
      );
    }
  } else {
    console.log(
      `[AI Models] No direct API available for ${model.id}, using OpenRouter`
    );
  }

  // Fallback to OpenRouter
  return queryOpenRouter(model, options, callbacks);
}

function getDirectQueryFunction(provider: string) {
  switch (provider) {
    case "anthropic":
      return ANTHROPIC_API_KEY ? queryAnthropicDirect : null;
    case "google":
      return GEMINI_API_KEY ? queryGoogleDirect : null;
    case "xai":
      return XAI_API_KEY ? queryXAIDirect : null;
    case "perplexity":
      return SONAR_API_KEY ? queryPerplexityDirect : null;
    case "cerebras":
      return CEREBRAS_API_KEY ? queryCerebrasDirect : null;
    default:
      return null;
  }
}

// ============================================================================
// Parallel Query Function
// ============================================================================

export async function queryModelsInParallel(
  models: ModelConfig[],
  options: QueryOptions,
  onModelUpdate?: (modelId: string, update: Partial<ModelResponseData>) => void
): Promise<ModelResponseData[]> {
  const promises = models.map(async model => {
    // Notify that model is starting
    onModelUpdate?.(model.id, { status: "streaming" });

    const callbacks: StreamCallbacks | undefined = onModelUpdate
      ? {
          onChunk: chunk => {
            onModelUpdate(model.id, {
              status: "streaming",
              content: chunk, // This will be accumulated on the client
            });
          },
          onComplete: response => {
            onModelUpdate(model.id, response);
          },
          onError: error => {
            onModelUpdate(model.id, {
              status: "error",
              errorMessage: error.message,
            });
          },
        }
      : undefined;

    try {
      return await queryModel(model, { ...options, stream: true }, callbacks);
    } catch (error) {
      const errorResult: ModelResponseData = {
        modelId: model.id,
        modelName: model.name,
        content: "",
        status: "error",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      };
      onModelUpdate?.(model.id, errorResult);
      return errorResult;
    }
  });

  return Promise.all(promises);
}

// ============================================================================
// Exports
// ============================================================================

export { FRONTIER_MODELS, getModelsForTier };
export type { ModelConfig, QueryOptions, StreamCallbacks };
