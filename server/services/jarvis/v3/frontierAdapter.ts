import type { AgentType } from "./types";

export interface AgentReasoningConfig {
  primaryModel: string;
  fallbackModel: string;
  temperature: number;
  maxTokens: number;
  supportsTools: boolean;
}

const AGENT_REASONING_CONFIGS: Record<AgentType, AgentReasoningConfig> = {
  planner: {
    primaryModel: "anthropic/claude-opus-4.5",
    fallbackModel: "openai/gpt-5.2-pro",
    temperature: 0.5,
    maxTokens: 4096,
    supportsTools: true,
  },
  coder: {
    primaryModel: "anthropic/claude-sonnet-4.5",
    fallbackModel: "openai/gpt-5",
    temperature: 0.2,
    maxTokens: 8192,
    supportsTools: true,
  },
  executor: {
    primaryModel: "x-ai/grok-4.1",
    fallbackModel: "anthropic/claude-sonnet-4.5",
    temperature: 0.1,
    maxTokens: 4096,
    supportsTools: true,
  },
  verifier: {
    primaryModel: "anthropic/claude-sonnet-4.5",
    fallbackModel: "openai/gpt-5",
    temperature: 0.1,
    maxTokens: 4096,
    supportsTools: true,
  },
  researcher: {
    primaryModel: "perplexity/sonar-pro",
    fallbackModel: "anthropic/claude-sonnet-4.5",
    temperature: 0.6,
    maxTokens: 8192,
    supportsTools: true,
  },
  learner: {
    primaryModel: "anthropic/claude-sonnet-4.5",
    fallbackModel: "openai/gpt-5",
    temperature: 0.4,
    maxTokens: 4096,
    supportsTools: false,
  },
  safety: {
    primaryModel: "anthropic/claude-opus-4.5",
    fallbackModel: "openai/gpt-5.2-pro",
    temperature: 0.1,
    maxTokens: 2048,
    supportsTools: false,
  },
};

const AGENT_SYSTEM_PROMPTS: Record<AgentType, string> = {
  planner: `You are a strategic planning agent. Break down complex tasks into manageable subtasks, identify dependencies, allocate to specialized agents, and monitor progress.`,

  coder: `You are a coding specialist. Write clean, efficient, well-documented code. Follow best practices, handle edge cases, and optimize for readability and maintainability.`,

  executor: `You are an execution agent. Execute commands and operations reliably, handle errors with appropriate retries, and report progress accurately.`,

  verifier: `You are a verification agent. Validate code correctness, run tests, check for security vulnerabilities, and ensure compliance with requirements.`,

  researcher: `You are a research agent. Gather information from various sources, analyze and synthesize findings, and provide comprehensive summaries with relevant insights.`,

  learner: `You are a learning agent. Extract patterns from successful operations, identify improvement areas, and organize knowledge for future tasks.`,

  safety: `You are a safety agent. Assess risks, validate permissions, ensure operations are reversible when possible, and flag concerns for human review.`,
};

type ProviderType =
  | "anthropic"
  | "openai"
  | "x-ai"
  | "perplexity"
  | "openrouter";

function getProviderFromModel(model: string): ProviderType {
  if (model.startsWith("anthropic/")) return "anthropic";
  if (model.startsWith("openai/")) return "openai";
  if (model.startsWith("x-ai/")) return "x-ai";
  if (model.startsWith("perplexity/")) return "perplexity";
  return "openrouter";
}

function getModelId(model: string): string {
  const parts = model.split("/");
  return parts.length > 1 ? parts[1] : model;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ReasoningResult {
  content: string;
  toolCalls?: ToolCall[];
  model: string;
  tokensUsed: number;
  durationMs: number;
  finishReason: string;
}

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const XAI_API_KEY = process.env.XAI_API_KEY || "";
const SONAR_API_KEY = process.env.SONAR_API_KEY || "";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";

export class FrontierAdapter {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
  }

  getConfig(agentType: AgentType): AgentReasoningConfig {
    return AGENT_REASONING_CONFIGS[agentType];
  }

  getSystemPrompt(agentType: AgentType): string {
    return AGENT_SYSTEM_PROMPTS[agentType];
  }

  async reason(
    agentType: AgentType,
    messages: ChatMessage[],
    options: {
      tools?: ToolDefinition[];
      temperature?: number;
      maxTokens?: number;
      forceModel?: string;
      onChunk?: (chunk: string) => void;
    } = {}
  ): Promise<ReasoningResult> {
    const config = AGENT_REASONING_CONFIGS[agentType];
    const systemPrompt = AGENT_SYSTEM_PROMPTS[agentType];
    const startTime = Date.now();

    const temperature = options.temperature ?? config.temperature;
    const maxTokens = options.maxTokens ?? config.maxTokens;
    const model = options.forceModel || config.primaryModel;
    const provider = getProviderFromModel(model);
    const modelId = getModelId(model);
    const tools = config.supportsTools ? options.tools : undefined;

    try {
      switch (provider) {
        case "anthropic":
          return await this.callAnthropicDirect(
            modelId,
            systemPrompt,
            messages,
            temperature,
            maxTokens,
            tools,
            startTime,
            options.onChunk
          );
        case "openai":
          return await this.callOpenAIDirect(
            modelId,
            systemPrompt,
            messages,
            temperature,
            maxTokens,
            tools,
            startTime,
            options.onChunk
          );
        case "x-ai":
          return await this.callXAIDirect(
            modelId,
            systemPrompt,
            messages,
            temperature,
            maxTokens,
            tools,
            startTime,
            options.onChunk
          );
        case "perplexity":
          return await this.callPerplexityDirect(
            modelId,
            systemPrompt,
            messages,
            temperature,
            maxTokens,
            tools,
            startTime,
            options.onChunk
          );
        default:
          return await this.callOpenRouter(
            model,
            systemPrompt,
            messages,
            temperature,
            maxTokens,
            tools,
            startTime,
            options.onChunk
          );
      }
    } catch (error) {
      console.error(
        `[FrontierAdapter] ${provider} failed for ${agentType}, trying fallback:`,
        error instanceof Error ? error.message : error
      );

      const fallbackModel = config.fallbackModel;
      const fallbackProvider = getProviderFromModel(fallbackModel);
      const fallbackModelId = getModelId(fallbackModel);

      if (fallbackProvider === "anthropic") {
        return await this.callAnthropicDirect(
          fallbackModelId,
          systemPrompt,
          messages,
          temperature,
          maxTokens,
          tools,
          startTime,
          options.onChunk
        );
      } else {
        return await this.callOpenRouter(
          fallbackModel,
          systemPrompt,
          messages,
          temperature,
          maxTokens,
          tools,
          startTime,
          options.onChunk
        );
      }
    }
  }

  private async callAnthropicDirect(
    modelId: string,
    systemPrompt: string,
    messages: ChatMessage[],
    temperature: number,
    maxTokens: number,
    tools: ToolDefinition[] | undefined,
    startTime: number,
    onChunk?: (chunk: string) => void
  ): Promise<ReasoningResult> {
    // Map friendly model names to Anthropic API model IDs
    const ANTHROPIC_MODEL_MAP: Record<string, string> = {
      "claude-sonnet-4.5": "claude-sonnet-4-5-20250929",
      "claude-opus-4.5": "claude-opus-4-5-20250514",
    };
    const apiModelId = ANTHROPIC_MODEL_MAP[modelId] || modelId;

    const anthropicMessages = messages
      .filter(m => m.role !== "system")
      .map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    const body: Record<string, unknown> = {
      model: apiModelId,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: anthropicMessages,
      stream: !!onChunk,
    };

    if (tools && tools.length > 0) {
      body.tools = tools.map(t => ({
        name: t.function.name,
        description: t.function.description || `Tool: ${t.function.name}`,
        input_schema: t.function.parameters || {
          type: "object",
          properties: {},
        },
      }));
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic error ${response.status}: ${errorText}`);
    }

    if (onChunk && response.body) {
      const toolCalls: ToolCall[] = [];
      let textContent = "";
      let modelUsed = apiModelId;
      let stopReason = "stop";
      let tokensUsed = 0;
      const toolInputBuffers: Map<number, string> = new Map();
      const toolBlocks: Map<number, { id: string; name: string }> = new Map();

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const event = JSON.parse(data);

            switch (event.type) {
              case "message_start":
                modelUsed = event.message?.model || modelUsed;
                if (event.message?.usage) {
                  tokensUsed = event.message.usage.input_tokens || 0;
                }
                break;
              case "content_block_start":
                if (event.content_block?.type === "tool_use") {
                  toolBlocks.set(event.index, {
                    id: event.content_block.id,
                    name: event.content_block.name,
                  });
                  toolInputBuffers.set(event.index, "");
                }
                break;
              case "content_block_delta":
                if (event.delta?.type === "text_delta" && event.delta.text) {
                  textContent += event.delta.text;
                  onChunk(event.delta.text);
                } else if (
                  event.delta?.type === "input_json_delta" &&
                  event.delta.partial_json
                ) {
                  const existing = toolInputBuffers.get(event.index) || "";
                  toolInputBuffers.set(
                    event.index,
                    existing + event.delta.partial_json
                  );
                }
                break;
              case "content_block_stop": {
                const toolBlock = toolBlocks.get(event.index);
                if (toolBlock) {
                  const inputJson = toolInputBuffers.get(event.index) || "{}";
                  toolCalls.push({
                    id: toolBlock.id,
                    type: "function",
                    function: {
                      name: toolBlock.name,
                      arguments: inputJson,
                    },
                  });
                }
                break;
              }
              case "message_delta":
                if (event.delta?.stop_reason) {
                  stopReason =
                    event.delta.stop_reason === "end_turn"
                      ? "stop"
                      : event.delta.stop_reason;
                }
                if (event.usage?.output_tokens) {
                  tokensUsed += event.usage.output_tokens;
                }
                break;
            }
          } catch {
            // Ignore parse errors for malformed chunks
          }
        }
      }

      return {
        content: textContent,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        model: modelUsed,
        tokensUsed,
        durationMs: Date.now() - startTime,
        finishReason: stopReason,
      };
    }

    const data = (await response.json()) as {
      content: Array<{
        type: string;
        text?: string;
        id?: string;
        name?: string;
        input?: unknown;
      }>;
      usage: { input_tokens: number; output_tokens: number };
      stop_reason: string;
      model: string;
    };

    const textContent = data.content
      .filter(c => c.type === "text")
      .map(c => c.text)
      .join("");

    const toolCalls: ToolCall[] = data.content
      .filter(c => c.type === "tool_use")
      .map(c => ({
        id: c.id!,
        type: "function" as const,
        function: {
          name: c.name!,
          arguments: JSON.stringify(c.input),
        },
      }));

    return {
      content: textContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      model: data.model || apiModelId,
      tokensUsed: data.usage.input_tokens + data.usage.output_tokens,
      durationMs: Date.now() - startTime,
      finishReason: data.stop_reason,
    };
  }

  private async callOpenAIDirect(
    modelId: string,
    systemPrompt: string,
    messages: ChatMessage[],
    temperature: number,
    maxTokens: number,
    tools: ToolDefinition[] | undefined,
    startTime: number,
    onChunk?: (chunk: string) => void
  ): Promise<ReasoningResult> {
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    const openaiMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messages
        .filter(m => m.role !== "system")
        .map(m => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
    ];

    const body: Record<string, unknown> = {
      model: modelId,
      max_tokens: maxTokens,
      temperature,
      messages: openaiMessages,
      stream: !!onChunk,
    };

    if (tools && tools.length > 0) {
      body.tools = tools;
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI error ${response.status}: ${errorText}`);
    }

    if (onChunk && response.body) {
      const toolCalls: ToolCall[] = [];
      let textContent = "";
      let tokensUsed = 0;
      let finishReason = "stop";
      const toolCallBuffers: Map<
        number,
        { id: string; name: string; arguments: string }
      > = new Map();

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const event = JSON.parse(data);
            const choice = event.choices?.[0];

            if (choice?.delta?.content) {
              textContent += choice.delta.content;
              onChunk(choice.delta.content);
            }

            if (choice?.delta?.tool_calls) {
              for (const tc of choice.delta.tool_calls) {
                const existing = toolCallBuffers.get(tc.index);
                if (tc.id) {
                  toolCallBuffers.set(tc.index, {
                    id: tc.id,
                    name: tc.function?.name || existing?.name || "",
                    arguments: tc.function?.arguments || "",
                  });
                } else if (existing) {
                  existing.arguments += tc.function?.arguments || "";
                }
              }
            }

            if (choice?.finish_reason) {
              finishReason = choice.finish_reason;
            }

            if (event.usage) {
              tokensUsed =
                (event.usage.prompt_tokens || 0) +
                (event.usage.completion_tokens || 0);
            }
          } catch {
            // Ignore parse errors
          }
        }
      }

      Array.from(toolCallBuffers.values()).forEach(tc => {
        toolCalls.push({
          id: tc.id,
          type: "function",
          function: { name: tc.name, arguments: tc.arguments },
        });
      });

      return {
        content: textContent,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        model: modelId,
        tokensUsed,
        durationMs: Date.now() - startTime,
        finishReason,
      };
    }

    const data = (await response.json()) as {
      choices: Array<{
        message: {
          content?: string;
          tool_calls?: Array<{
            id: string;
            function: { name: string; arguments: string };
          }>;
        };
        finish_reason: string;
      }>;
      usage: { prompt_tokens: number; completion_tokens: number };
      model: string;
    };

    const choice = data.choices[0];
    const toolCalls: ToolCall[] = (choice.message.tool_calls || []).map(tc => ({
      id: tc.id,
      type: "function" as const,
      function: { name: tc.function.name, arguments: tc.function.arguments },
    }));

    return {
      content: choice.message.content || "",
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      model: data.model || modelId,
      tokensUsed: data.usage.prompt_tokens + data.usage.completion_tokens,
      durationMs: Date.now() - startTime,
      finishReason: choice.finish_reason,
    };
  }

  private async callXAIDirect(
    modelId: string,
    systemPrompt: string,
    messages: ChatMessage[],
    temperature: number,
    maxTokens: number,
    tools: ToolDefinition[] | undefined,
    startTime: number,
    onChunk?: (chunk: string) => void
  ): Promise<ReasoningResult> {
    if (!XAI_API_KEY) {
      throw new Error("XAI_API_KEY not configured");
    }

    const xaiMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messages
        .filter(m => m.role !== "system")
        .map(m => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
    ];

    const body: Record<string, unknown> = {
      model: modelId,
      max_tokens: maxTokens,
      temperature,
      messages: xaiMessages,
      stream: !!onChunk,
    };

    if (tools && tools.length > 0) {
      body.tools = tools;
    }

    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${XAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`xAI error ${response.status}: ${errorText}`);
    }

    if (onChunk && response.body) {
      const toolCalls: ToolCall[] = [];
      let textContent = "";
      let tokensUsed = 0;
      let finishReason = "stop";
      const toolCallBuffers: Map<
        number,
        { id: string; name: string; arguments: string }
      > = new Map();

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const event = JSON.parse(data);
            const choice = event.choices?.[0];

            if (choice?.delta?.content) {
              textContent += choice.delta.content;
              onChunk(choice.delta.content);
            }

            if (choice?.delta?.tool_calls) {
              for (const tc of choice.delta.tool_calls) {
                const existing = toolCallBuffers.get(tc.index);
                if (tc.id) {
                  toolCallBuffers.set(tc.index, {
                    id: tc.id,
                    name: tc.function?.name || existing?.name || "",
                    arguments: tc.function?.arguments || "",
                  });
                } else if (existing) {
                  existing.arguments += tc.function?.arguments || "";
                }
              }
            }

            if (choice?.finish_reason) {
              finishReason = choice.finish_reason;
            }

            if (event.usage) {
              tokensUsed =
                (event.usage.prompt_tokens || 0) +
                (event.usage.completion_tokens || 0);
            }
          } catch {
            // Ignore parse errors
          }
        }
      }

      Array.from(toolCallBuffers.values()).forEach(tc => {
        toolCalls.push({
          id: tc.id,
          type: "function",
          function: { name: tc.name, arguments: tc.arguments },
        });
      });

      return {
        content: textContent,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        model: modelId,
        tokensUsed,
        durationMs: Date.now() - startTime,
        finishReason,
      };
    }

    const data = (await response.json()) as {
      choices: Array<{
        message: {
          content?: string;
          tool_calls?: Array<{
            id: string;
            function: { name: string; arguments: string };
          }>;
        };
        finish_reason: string;
      }>;
      usage: { prompt_tokens: number; completion_tokens: number };
      model: string;
    };

    const choice = data.choices[0];
    const toolCalls: ToolCall[] = (choice.message.tool_calls || []).map(tc => ({
      id: tc.id,
      type: "function" as const,
      function: { name: tc.function.name, arguments: tc.function.arguments },
    }));

    return {
      content: choice.message.content || "",
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      model: data.model || modelId,
      tokensUsed: data.usage.prompt_tokens + data.usage.completion_tokens,
      durationMs: Date.now() - startTime,
      finishReason: choice.finish_reason,
    };
  }

  private async callPerplexityDirect(
    modelId: string,
    systemPrompt: string,
    messages: ChatMessage[],
    temperature: number,
    maxTokens: number,
    _tools: ToolDefinition[] | undefined,
    startTime: number,
    onChunk?: (chunk: string) => void
  ): Promise<ReasoningResult> {
    if (!SONAR_API_KEY) {
      throw new Error("SONAR_API_KEY not configured");
    }

    const pplxMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messages
        .filter(m => m.role !== "system")
        .map(m => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
    ];

    const body: Record<string, unknown> = {
      model: modelId,
      max_tokens: maxTokens,
      temperature,
      messages: pplxMessages,
      stream: !!onChunk,
    };

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SONAR_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Perplexity error ${response.status}: ${errorText}`);
    }

    if (onChunk && response.body) {
      let textContent = "";
      let tokensUsed = 0;
      let finishReason = "stop";

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const event = JSON.parse(data);
            const choice = event.choices?.[0];

            if (choice?.delta?.content) {
              textContent += choice.delta.content;
              onChunk(choice.delta.content);
            }

            if (choice?.finish_reason) {
              finishReason = choice.finish_reason;
            }

            if (event.usage) {
              tokensUsed =
                (event.usage.prompt_tokens || 0) +
                (event.usage.completion_tokens || 0);
            }
          } catch {
            // Ignore parse errors
          }
        }
      }

      return {
        content: textContent,
        toolCalls: undefined,
        model: modelId,
        tokensUsed,
        durationMs: Date.now() - startTime,
        finishReason,
      };
    }

    const data = (await response.json()) as {
      choices: Array<{
        message: { content?: string };
        finish_reason: string;
      }>;
      usage: { prompt_tokens: number; completion_tokens: number };
      model: string;
    };

    const choice = data.choices[0];

    return {
      content: choice.message.content || "",
      toolCalls: undefined,
      model: data.model || modelId,
      tokensUsed: data.usage.prompt_tokens + data.usage.completion_tokens,
      durationMs: Date.now() - startTime,
      finishReason: choice.finish_reason,
    };
  }

  private async callOpenRouter(
    model: string,
    systemPrompt: string,
    messages: ChatMessage[],
    temperature: number,
    maxTokens: number,
    tools: ToolDefinition[] | undefined,
    startTime: number,
    onChunk?: (chunk: string) => void
  ): Promise<ReasoningResult> {
    if (!OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY not configured");
    }

    const orMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messages
        .filter(m => m.role !== "system")
        .map(m => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
    ];

    const body: Record<string, unknown> = {
      model,
      max_tokens: maxTokens,
      temperature,
      messages: orMessages,
      stream: !!onChunk,
    };

    if (tools && tools.length > 0) {
      body.tools = tools;
    }

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://rasputin.manus.space",
          "X-Title": "RASPUTIN JARVIS Agent",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120000),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter error ${response.status}: ${errorText}`);
    }

    if (onChunk && response.body) {
      const toolCalls: ToolCall[] = [];
      let textContent = "";
      let tokensUsed = 0;
      let finishReason = "stop";
      const toolCallBuffers: Map<
        number,
        { id: string; name: string; arguments: string }
      > = new Map();

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const event = JSON.parse(data);
            const choice = event.choices?.[0];

            if (choice?.delta?.content) {
              textContent += choice.delta.content;
              onChunk(choice.delta.content);
            }

            if (choice?.delta?.tool_calls) {
              for (const tc of choice.delta.tool_calls) {
                const existing = toolCallBuffers.get(tc.index);
                if (tc.id) {
                  toolCallBuffers.set(tc.index, {
                    id: tc.id,
                    name: tc.function?.name || existing?.name || "",
                    arguments: tc.function?.arguments || "",
                  });
                } else if (existing) {
                  existing.arguments += tc.function?.arguments || "";
                }
              }
            }

            if (choice?.finish_reason) {
              finishReason = choice.finish_reason;
            }

            if (event.usage) {
              tokensUsed =
                (event.usage.prompt_tokens || 0) +
                (event.usage.completion_tokens || 0);
            }
          } catch {
            // Ignore parse errors
          }
        }
      }

      Array.from(toolCallBuffers.values()).forEach(tc => {
        toolCalls.push({
          id: tc.id,
          type: "function",
          function: { name: tc.name, arguments: tc.arguments },
        });
      });

      return {
        content: textContent,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        model: model,
        tokensUsed,
        durationMs: Date.now() - startTime,
        finishReason,
      };
    }

    const data = (await response.json()) as {
      choices: Array<{
        message: {
          content?: string;
          tool_calls?: Array<{
            id: string;
            function: { name: string; arguments: string };
          }>;
        };
        finish_reason: string;
      }>;
      usage: { prompt_tokens: number; completion_tokens: number };
      model: string;
    };

    const choice = data.choices[0];
    const toolCalls: ToolCall[] = (choice.message.tool_calls || []).map(tc => ({
      id: tc.id,
      type: "function" as const,
      function: { name: tc.function.name, arguments: tc.function.arguments },
    }));

    return {
      content: choice.message.content || "",
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      model: data.model || model,
      tokensUsed: data.usage.prompt_tokens + data.usage.completion_tokens,
      durationMs: Date.now() - startTime,
      finishReason: choice.finish_reason,
    };
  }
}

let globalFrontierAdapter: FrontierAdapter | null = null;

export async function getGlobalFrontierAdapter(): Promise<FrontierAdapter> {
  if (!globalFrontierAdapter) {
    globalFrontierAdapter = new FrontierAdapter();
    await globalFrontierAdapter.initialize();
  }
  return globalFrontierAdapter;
}

export function resetGlobalFrontierAdapter(): void {
  globalFrontierAdapter = null;
}

export function getAgentReasoningConfig(
  agentType: AgentType
): AgentReasoningConfig {
  return AGENT_REASONING_CONFIGS[agentType];
}

export function getAllAgentReasoningConfigs(): Record<
  AgentType,
  AgentReasoningConfig
> {
  return { ...AGENT_REASONING_CONFIGS };
}
