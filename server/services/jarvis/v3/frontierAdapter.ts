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
    primaryModel: "anthropic/claude-sonnet-4-20250514",
    fallbackModel: "openai/gpt-4.1",
    temperature: 0.5,
    maxTokens: 4096,
    supportsTools: true,
  },
  coder: {
    primaryModel: "anthropic/claude-sonnet-4-20250514",
    fallbackModel: "openai/gpt-4.1",
    temperature: 0.2,
    maxTokens: 8192,
    supportsTools: true,
  },
  executor: {
    primaryModel: "x-ai/grok-3-beta",
    fallbackModel: "anthropic/claude-sonnet-4-20250514",
    temperature: 0.1,
    maxTokens: 4096,
    supportsTools: true,
  },
  verifier: {
    primaryModel: "anthropic/claude-sonnet-4-20250514",
    fallbackModel: "openai/gpt-4.1",
    temperature: 0.1,
    maxTokens: 4096,
    supportsTools: true,
  },
  researcher: {
    primaryModel: "perplexity/sonar-pro",
    fallbackModel: "anthropic/claude-sonnet-4-20250514",
    temperature: 0.6,
    maxTokens: 8192,
    supportsTools: true,
  },
  learner: {
    primaryModel: "anthropic/claude-sonnet-4-20250514",
    fallbackModel: "openai/gpt-4.1-mini",
    temperature: 0.4,
    maxTokens: 4096,
    supportsTools: false,
  },
  safety: {
    primaryModel: "anthropic/claude-sonnet-4-20250514",
    fallbackModel: "openai/gpt-4.1",
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

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

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
    } = {}
  ): Promise<ReasoningResult> {
    const config = AGENT_REASONING_CONFIGS[agentType];
    const systemPrompt = AGENT_SYSTEM_PROMPTS[agentType];
    const startTime = Date.now();

    const fullMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    const model = options.forceModel || config.primaryModel;
    const temperature = options.temperature ?? config.temperature;
    const maxTokens = options.maxTokens ?? config.maxTokens;

    try {
      return await this.callOpenRouter(
        model,
        fullMessages,
        temperature,
        maxTokens,
        config.supportsTools ? options.tools : undefined,
        startTime
      );
    } catch (error) {
      console.warn(
        `Primary model ${model} failed, trying fallback ${config.fallbackModel}`
      );

      return await this.callOpenRouter(
        config.fallbackModel,
        fullMessages,
        temperature,
        maxTokens,
        config.supportsTools ? options.tools : undefined,
        startTime
      );
    }
  }

  private async callOpenRouter(
    model: string,
    messages: ChatMessage[],
    temperature: number,
    maxTokens: number,
    tools: ToolDefinition[] | undefined,
    startTime: number
  ): Promise<ReasoningResult> {
    const body: Record<string, unknown> = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    };

    if (tools && tools.length > 0) {
      body.tools = tools;
      body.tool_choice = "auto";
    }

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://rasputin.local",
          "X-Title": "RASPUTIN JARVIS",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120000),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as {
      choices: Array<{
        message: {
          content: string | null;
          tool_calls?: ToolCall[];
        };
        finish_reason: string;
      }>;
      usage?: { total_tokens: number };
      model: string;
    };

    const choice = data.choices[0];

    return {
      content: choice.message.content || "",
      toolCalls: choice.message.tool_calls,
      model: data.model || model,
      tokensUsed: data.usage?.total_tokens || 0,
      durationMs: Date.now() - startTime,
      finishReason: choice.finish_reason,
    };
  }

  async reasonDirect(
    agentType: AgentType,
    messages: ChatMessage[],
    options: {
      tools?: ToolDefinition[];
      temperature?: number;
      maxTokens?: number;
    } = {}
  ): Promise<ReasoningResult> {
    if (!ANTHROPIC_API_KEY) {
      return this.reason(agentType, messages, options);
    }

    const config = AGENT_REASONING_CONFIGS[agentType];
    const systemPrompt = AGENT_SYSTEM_PROMPTS[agentType];
    const startTime = Date.now();

    const temperature = options.temperature ?? config.temperature;
    const maxTokens = options.maxTokens ?? config.maxTokens;

    const anthropicMessages = messages.map(m => ({
      role: m.role === "system" ? "user" : m.role,
      content: m.content,
    }));

    const body: Record<string, unknown> = {
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: anthropicMessages,
    };

    if (options.tools && options.tools.length > 0) {
      body.tools = options.tools.map(t => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters,
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
      throw new Error(`Anthropic error ${response.status}`);
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
      model: "claude-sonnet-4-20250514",
      tokensUsed: data.usage.input_tokens + data.usage.output_tokens,
      durationMs: Date.now() - startTime,
      finishReason: data.stop_reason,
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
