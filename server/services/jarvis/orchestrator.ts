/**
 * JARVIS Orchestrator - The Brain
 * Uses direct API connections (Anthropic, Cerebras, Gemini, Grok) for autonomous task execution
 */

// Get API keys from environment - Direct connections, no OpenRouter middleman
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY || "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const XAI_API_KEY = process.env.XAI_API_KEY || "";

// Inference provider type
type InferenceProvider = "anthropic" | "cerebras" | "gemini" | "grok";

// Current provider (can be changed at runtime)
let currentProvider: InferenceProvider = "anthropic";

// OpenRouter API types
interface OpenRouterMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | OpenRouterContentBlock[];
  tool_calls?: OpenRouterToolCall[];
  tool_call_id?: string;
}

interface OpenRouterContentBlock {
  type: "text" | "tool_use";
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface OpenRouterToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenRouterTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

interface OpenRouterResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: OpenRouterToolCall[];
    };
    finish_reason: string;
  }>;
}

// Tool definitions for OpenRouter (OpenAI-compatible format)
const JARVIS_TOOLS: OpenRouterTool[] = [
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the web for current information using Perplexity. Use this to find up-to-date information, news, facts, or research topics.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query to find information about",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "searxng_search",
      description:
        "Search the web using SearXNG - a free, unlimited, privacy-focused meta-search engine that aggregates results from Google, Bing, DuckDuckGo, Wikipedia, GitHub, StackOverflow, and more. Use this for bulk searches or when you need diverse results from multiple sources. No API limits.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query to find information about",
          },
          engines: {
            type: "string",
            description: "Optional: Comma-separated list of engines to use (e.g., 'google,bing,duckduckgo'). Leave empty for all engines.",
          },
          categories: {
            type: "string",
            description: "Optional: Search category (general, images, news, science, files, it, social media)",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "browse_url",
      description:
        "Visit a specific URL and extract its content. Use this to read articles, documentation, or any web page.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "The URL to visit and extract content from",
          },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "execute_python",
      description:
        "Execute Python code in a sandboxed environment. Use for calculations, data processing, file operations, or any Python task.",
      parameters: {
        type: "object",
        properties: {
          code: {
            type: "string",
            description: "The Python code to execute",
          },
        },
        required: ["code"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "execute_javascript",
      description:
        "Execute JavaScript/Node.js code in a sandboxed environment. Use for JS-specific tasks or npm package usage.",
      parameters: {
        type: "object",
        properties: {
          code: {
            type: "string",
            description: "The JavaScript code to execute",
          },
        },
        required: ["code"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "execute_shell",
      description:
        "Execute shell commands in a sandboxed Linux environment. Use for system operations, file management, or running CLI tools.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The shell command to execute",
          },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the contents of a file from the sandboxed filesystem.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "The path to the file to read",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description:
        "Write content to a file in the sandboxed filesystem. Creates the file if it doesn't exist.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "The path where to write the file",
          },
          content: {
            type: "string",
            description: "The content to write to the file",
          },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_files",
      description: "List files and directories in a given path.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description:
              "The directory path to list (default: current directory)",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calculate",
      description:
        "Perform mathematical calculations. Use for precise arithmetic, scientific calculations, or complex math.",
      parameters: {
        type: "object",
        properties: {
          expression: {
            type: "string",
            description:
              "The mathematical expression to evaluate (e.g., '2 + 2 * 3', 'sqrt(16)', 'sin(pi/2)')",
          },
        },
        required: ["expression"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "http_request",
      description:
        "Make HTTP requests to APIs or web services. Use for API calls, data fetching, or web interactions.",
      parameters: {
        type: "object",
        properties: {
          method: {
            type: "string",
            enum: ["GET", "POST", "PUT", "DELETE", "PATCH"],
            description: "The HTTP method to use",
          },
          url: {
            type: "string",
            description: "The URL to send the request to",
          },
          headers: {
            type: "object",
            description: "Optional headers to include in the request",
          },
          body: {
            type: "string",
            description: "Optional request body (for POST, PUT, PATCH)",
          },
        },
        required: ["method", "url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_image",
      description:
        "Generate an image using AI based on a text description. Use for creating illustrations, diagrams, or any visual content.",
      parameters: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description:
              "A detailed description of the image to generate. Be specific about style, composition, colors, and details.",
          },
        },
        required: ["prompt"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ssh_execute",
      description:
        "Execute a command on a remote server via SSH. Use this to run commands on registered SSH hosts.",
      parameters: {
        type: "object",
        properties: {
          hostName: {
            type: "string",
            description:
              "The name of the registered SSH host to connect to (e.g., 'rasputin', 'production-server')",
          },
          command: {
            type: "string",
            description: "The shell command to execute on the remote server",
          },
        },
        required: ["hostName", "command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ssh_read_file",
      description:
        "Read a file from a remote server via SSH. Use this to view file contents on registered SSH hosts.",
      parameters: {
        type: "object",
        properties: {
          hostName: {
            type: "string",
            description: "The name of the registered SSH host",
          },
          path: {
            type: "string",
            description: "The absolute path to the file on the remote server",
          },
        },
        required: ["hostName", "path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ssh_write_file",
      description:
        "Write content to a file on a remote server via SSH. Use this to create or update files on registered SSH hosts.",
      parameters: {
        type: "object",
        properties: {
          hostName: {
            type: "string",
            description: "The name of the registered SSH host",
          },
          path: {
            type: "string",
            description:
              "The absolute path where to write the file on the remote server",
          },
          content: {
            type: "string",
            description: "The content to write to the file",
          },
        },
        required: ["hostName", "path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ssh_list_files",
      description:
        "List files in a directory on a remote server via SSH. Use this to explore file systems on registered SSH hosts.",
      parameters: {
        type: "object",
        properties: {
          hostName: {
            type: "string",
            description: "The name of the registered SSH host",
          },
          path: {
            type: "string",
            description:
              "The directory path to list on the remote server (default: home directory)",
          },
        },
        required: ["hostName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "task_complete",
      description:
        "Mark the task as complete and provide a final summary. Use this when you have finished all required work.",
      parameters: {
        type: "object",
        properties: {
          summary: {
            type: "string",
            description:
              "A comprehensive summary of what was accomplished, including any important results or outputs",
          },
          artifacts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  enum: ["file", "image", "code", "data"],
                },
                path: { type: "string" },
                description: { type: "string" },
              },
            },
            description: "List of artifacts created during the task",
          },
        },
        required: ["summary"],
      },
    },
  },
];

// Get current date string
function getCurrentDateString(): string {
  const now = new Date();
  return now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// System prompt for JARVIS - dynamically generated
function getJarvisSystemPrompt(): string {
  return `You are JARVIS, an autonomous AI agent assistant. Today's date is ${getCurrentDateString()}.

Your capabilities:
- Web search and browsing to find current information
- Code execution (Python, JavaScript, shell commands)
- File management (read, write, list files)
- Mathematical calculations
- HTTP API requests
- Image generation
- Task planning and autonomous execution
- SSH access to remote servers (use ssh_execute, ssh_read_file, ssh_write_file, ssh_list_files)

Guidelines:
1. Break down complex tasks into smaller steps
2. Use tools proactively to gather information and complete tasks
3. Always verify your work before marking a task complete
4. If you encounter an error, try alternative approaches (up to 3 retries)
5. Keep the user informed of your progress with clear thinking
6. When searching for information, always use web_search first to get current data
7. For code tasks, write clean, well-commented code
8. Save important outputs to files when appropriate
9. Use calculate for precise math instead of mental calculations
10. Be concise but thorough in your responses
11. For SSH tasks, use the registered host name (e.g., 'rasputin') to connect to remote servers

Error Handling:
- If a tool fails, analyze the error and try a different approach
- If web_search fails, try browse_url with a specific URL
- If code execution fails, debug and fix the code
- If SSH fails, check if the host is registered and accessible
- If you're stuck after 3 attempts, explain what went wrong and suggest alternatives
- Never give up without providing some useful information to the user

You have access to a sandboxed environment where you can safely execute code and manage files.
You also have SSH access to registered remote servers for infrastructure management.
Work autonomously until the task is complete, then use task_complete to provide your final response.
Always provide a comprehensive summary of what you accomplished.`;
}

// Types
export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  output: string;
  isError: boolean;
}

export interface OrchestratorMessage {
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

export interface OrchestratorStep {
  type: "thinking" | "tool_use" | "response";
  content: string;
  toolCall?: ToolCall;
  toolResult?: ToolResult;
}

export interface OrchestratorCallbacks {
  onThinking: (thought: string) => void;
  onToolCall: (toolCall: ToolCall) => void;
  onToolResult: (result: ToolResult) => void;
  onComplete: (summary: string, artifacts?: unknown[]) => void;
  onError: (error: string) => void;
}

// Export provider control functions
export function setInferenceProvider(provider: InferenceProvider): void {
  currentProvider = provider;
  console.log(`[JARVIS] Switched to ${provider} provider`);
}

export function getInferenceProvider(): InferenceProvider {
  return currentProvider;
}

// For backwards compatibility with existing UI
export function setInferenceTier(tier: string): void {
  if (tier === "cerebras") setInferenceProvider("cerebras");
  else if (tier === "local") setInferenceProvider("anthropic"); // fallback to anthropic
  else if (tier === "cloud") setInferenceProvider("anthropic");
  else setInferenceProvider("anthropic");
}

export function getInferenceTier(): string {
  return currentProvider;
}

// Convert messages to Anthropic format
function toAnthropicMessages(messages: OpenRouterMessage[]): Array<{role: string; content: string | Array<{type: string; text?: string; tool_use_id?: string; content?: string}>}> {
  return messages.map(msg => {
    if (msg.role === "tool") {
      return {
        role: "user",
        content: [{
          type: "tool_result",
          tool_use_id: msg.tool_call_id || "",
          content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content)
        }]
      };
    }
    return {
      role: msg.role === "assistant" ? "assistant" : "user",
      content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content)
    };
  });
}

// Convert tools to Anthropic format
function toAnthropicTools(tools: OpenRouterTool[]): Array<{name: string; description: string; input_schema: object}> {
  return tools.map(t => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters
  }));
}

// Call Anthropic Claude API directly
async function callAnthropic(
  messages: OpenRouterMessage[],
  systemPrompt: string
): Promise<OpenRouterResponse> {
  const anthropicMessages = toAnthropicMessages(messages);
  const anthropicTools = toAnthropicTools(JARVIS_TOOLS);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-opus-4-5-20251101",
      max_tokens: 8192,
      system: systemPrompt,
      messages: anthropicMessages,
      tools: anthropicTools,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  
  // Convert Anthropic response to OpenRouter format
  const toolCalls: OpenRouterToolCall[] = [];
  let textContent = "";
  
  for (const block of data.content || []) {
    if (block.type === "text") {
      textContent += block.text;
    } else if (block.type === "tool_use") {
      toolCalls.push({
        id: block.id,
        type: "function",
        function: {
          name: block.name,
          arguments: JSON.stringify(block.input)
        }
      });
    }
  }

  return {
    id: data.id,
    choices: [{
      message: {
        role: "assistant",
        content: textContent || null,
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined
      },
      finish_reason: data.stop_reason || "stop"
    }]
  };
}

// Call Cerebras API (OpenAI-compatible)
async function callCerebras(
  messages: OpenRouterMessage[],
  systemPrompt: string
): Promise<OpenRouterResponse> {
  const response = await fetch("https://api.cerebras.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${CEREBRAS_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b",
      max_tokens: 8192,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      tools: JARVIS_TOOLS,
      tool_choice: "auto",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Cerebras API error: ${response.status} ${error}`);
  }

  return response.json();
}

// Call Gemini API
async function callGemini(
  messages: OpenRouterMessage[],
  systemPrompt: string
): Promise<OpenRouterResponse> {
  // Convert to Gemini format
  const geminiContents = messages.map(msg => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content) }]
  }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: geminiContents,
        tools: [{
          functionDeclarations: JARVIS_TOOLS.map(t => ({
            name: t.function.name,
            description: t.function.description,
            parameters: t.function.parameters
          }))
        }]
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts || [];
  
  let textContent = "";
  const toolCalls: OpenRouterToolCall[] = [];
  
  for (const part of parts) {
    if (part.text) textContent += part.text;
    if (part.functionCall) {
      toolCalls.push({
        id: `gemini_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: "function",
        function: {
          name: part.functionCall.name,
          arguments: JSON.stringify(part.functionCall.args)
        }
      });
    }
  }

  return {
    id: `gemini_${Date.now()}`,
    choices: [{
      message: {
        role: "assistant",
        content: textContent || null,
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined
      },
      finish_reason: candidate?.finishReason || "stop"
    }]
  };
}

// Call Grok (xAI) API - OpenAI-compatible
async function callGrok(
  messages: OpenRouterMessage[],
  systemPrompt: string
): Promise<OpenRouterResponse> {
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "grok-3-fast",
      max_tokens: 8192,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      tools: JARVIS_TOOLS,
      tool_choice: "auto",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Grok API error: ${response.status} ${error}`);
  }

  return response.json();
}

// Main LLM call function with provider selection and fallback
async function callLLM(
  messages: OpenRouterMessage[],
  systemPrompt: string
): Promise<OpenRouterResponse> {
  const providers: Array<{name: InferenceProvider; fn: typeof callAnthropic; hasKey: boolean}> = [
    { name: "anthropic", fn: callAnthropic, hasKey: !!ANTHROPIC_API_KEY },
    { name: "cerebras", fn: callCerebras, hasKey: !!CEREBRAS_API_KEY },
    { name: "gemini", fn: callGemini, hasKey: !!GEMINI_API_KEY },
    { name: "grok", fn: callGrok, hasKey: !!XAI_API_KEY },
  ];

  // Try current provider first
  const currentIdx = providers.findIndex(p => p.name === currentProvider);
  if (currentIdx > 0) {
    const [current] = providers.splice(currentIdx, 1);
    providers.unshift(current);
  }

  // Try each provider in order
  for (const provider of providers) {
    if (!provider.hasKey) continue;
    
    try {
      console.log(`[JARVIS] Calling ${provider.name} API...`);
      const result = await provider.fn(messages, systemPrompt);
      console.log(`[JARVIS] ${provider.name} call successful`);
      return result;
    } catch (error) {
      console.error(`[JARVIS] ${provider.name} failed:`, error);
      // Continue to next provider
    }
  }

  throw new Error("All LLM providers failed");
}

// Main orchestrator function
export async function runOrchestrator(
  task: string,
  callbacks: OrchestratorCallbacks,
  executeToolFn: (
    name: string,
    input: Record<string, unknown>
  ) => Promise<string>,
  maxIterations: number = 15
): Promise<void> {
  const messages: OpenRouterMessage[] = [];

  // Add the new user task
  messages.push({ role: "user", content: task });

  let iterations = 0;
  let isComplete = false;

  while (!isComplete && iterations < maxIterations) {
    iterations++;

    try {
      // Call LLM (direct API - Anthropic, Cerebras, Gemini, or Grok)
      const response = await callLLM(messages, getJarvisSystemPrompt());

      const choice = response.choices[0];
      if (!choice) {
        throw new Error("No response from model");
      }

      const assistantMessage = choice.message;
      const toolCalls: ToolCall[] = [];

      // Process text response
      if (assistantMessage.content) {
        callbacks.onThinking(assistantMessage.content);
      }

      // Process tool calls
      if (
        assistantMessage.tool_calls &&
        assistantMessage.tool_calls.length > 0
      ) {
        for (const tc of assistantMessage.tool_calls) {
          const toolCall: ToolCall = {
            id: tc.id,
            name: tc.function.name,
            input: JSON.parse(tc.function.arguments || "{}"),
          };
          toolCalls.push(toolCall);
          callbacks.onToolCall(toolCall);
        }
      }

      // Add assistant message to conversation
      messages.push({
        role: "assistant",
        content: assistantMessage.content || "",
        tool_calls: assistantMessage.tool_calls,
      });

      // If there are tool calls, execute them
      if (toolCalls.length > 0) {
        for (const tc of toolCalls) {
          // Check if this is the task_complete tool
          if (tc.name === "task_complete") {
            const input = tc.input as {
              summary: string;
              artifacts?: unknown[];
            };
            callbacks.onComplete(input.summary, input.artifacts);
            isComplete = true;
            break;
          }

          // Execute the tool
          try {
            const output = await executeToolFn(tc.name, tc.input);
            const result: ToolResult = {
              toolCallId: tc.id,
              output,
              isError: false,
            };
            callbacks.onToolResult(result);

            // Add tool result to conversation
            messages.push({
              role: "tool",
              content: output,
              tool_call_id: tc.id,
            });
          } catch (error) {
            const errorMsg =
              error instanceof Error ? error.message : String(error);
            const result: ToolResult = {
              toolCallId: tc.id,
              output: `Error: ${errorMsg}`,
              isError: true,
            };
            callbacks.onToolResult(result);

            // Add error result to conversation
            messages.push({
              role: "tool",
              content: `Error: ${errorMsg}`,
              tool_call_id: tc.id,
            });
          }
        }
      } else if (choice.finish_reason === "stop") {
        // Model finished without tool calls - treat as complete
        callbacks.onComplete(assistantMessage.content || "Task completed.", []);
        isComplete = true;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      callbacks.onError(`Orchestrator error: ${errorMsg}`);
      throw error;
    }
  }

  if (!isComplete) {
    callbacks.onError(
      "Task exceeded maximum iterations. Please try breaking it into smaller steps."
    );
  }
}
