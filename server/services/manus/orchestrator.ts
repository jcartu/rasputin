/**
 * Manus Orchestrator
 *
 * A Manus-style agent using Claude Opus 4.5 with computer-use capabilities.
 * Focuses on browser automation, terminal execution, and file management.
 */

import * as fs from "fs/promises";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// API Configuration
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const CLAUDE_OPUS_MODEL = "claude-opus-4-5-20250929";

// Workspace configuration
const MANUS_WORKSPACE = process.env.MANUS_WORKSPACE || "/tmp/manus-workspace";

// Types
export interface ManusToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ManusToolResult {
  toolCallId: string;
  output: string;
  isError: boolean;
  screenshot?: string; // base64 encoded screenshot
}

export interface ManusStep {
  id: string;
  type: "thinking" | "tool" | "browser" | "terminal" | "file" | "response";
  title: string;
  content?: string;
  screenshot?: string;
  status: "pending" | "running" | "completed" | "failed";
  timestamp: number;
  durationMs?: number;
}

export interface ManusCallbacks {
  onThinking: (content: string) => void;
  onThinkingChunk?: (chunk: string) => void;
  onToolCall: (tool: ManusToolCall) => void;
  onToolResult: (result: ManusToolResult) => void;
  onScreenshot: (base64: string, url: string) => void;
  onTerminalOutput: (output: string, isError: boolean) => void;
  onFileOperation: (operation: string, path: string, content?: string) => void;
  onComplete: (summary: string) => void;
  onError: (error: string) => void;
  onIteration?: (iteration: number, maxIterations: number) => void;
}

// Browser state
interface BrowserState {
  browser: Awaited<
    ReturnType<typeof import("playwright").chromium.launch>
  > | null;
  page: Awaited<
    ReturnType<
      Awaited<
        ReturnType<typeof import("playwright").chromium.launch>
      >["newPage"]
    >
  > | null;
  url: string;
  isActive: boolean;
}

const browserState: BrowserState = {
  browser: null,
  page: null,
  url: "about:blank",
  isActive: false,
};

// Ensure workspace exists
async function ensureWorkspace(): Promise<void> {
  try {
    await fs.mkdir(MANUS_WORKSPACE, { recursive: true });
  } catch {
    // Directory may already exist
  }
}

// Tool definitions for Claude
const MANUS_TOOLS = [
  {
    name: "browser_navigate",
    description:
      "Navigate the browser to a URL. This will load the page and take a screenshot.",
    input_schema: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "The URL to navigate to" },
      },
      required: ["url"],
    },
  },
  {
    name: "browser_click",
    description: "Click on an element in the browser by CSS selector.",
    input_schema: {
      type: "object" as const,
      properties: {
        selector: {
          type: "string",
          description: "CSS selector for the element to click",
        },
      },
      required: ["selector"],
    },
  },
  {
    name: "browser_type",
    description: "Type text into an input field in the browser.",
    input_schema: {
      type: "object" as const,
      properties: {
        selector: {
          type: "string",
          description: "CSS selector for the input field",
        },
        text: { type: "string", description: "Text to type" },
      },
      required: ["selector", "text"],
    },
  },
  {
    name: "browser_screenshot",
    description: "Take a screenshot of the current browser page.",
    input_schema: {
      type: "object" as const,
      properties: {
        fullPage: {
          type: "boolean",
          description: "Whether to capture the full page",
        },
      },
    },
  },
  {
    name: "browser_get_content",
    description: "Get the text content of the current page.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "terminal_execute",
    description:
      "Execute a shell command in the terminal. Returns stdout and stderr.",
    input_schema: {
      type: "object" as const,
      properties: {
        command: {
          type: "string",
          description: "The shell command to execute",
        },
        workdir: {
          type: "string",
          description: "Working directory (optional)",
        },
      },
      required: ["command"],
    },
  },
  {
    name: "file_read",
    description: "Read the contents of a file.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "Path to the file (relative to workspace)",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "file_write",
    description: "Write content to a file.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "Path to the file (relative to workspace)",
        },
        content: { type: "string", description: "Content to write" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "file_list",
    description: "List files in a directory.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "Directory path (relative to workspace)",
        },
      },
    },
  },
  {
    name: "task_complete",
    description: "Mark the task as complete and provide a summary.",
    input_schema: {
      type: "object" as const,
      properties: {
        summary: {
          type: "string",
          description: "Summary of what was accomplished",
        },
      },
      required: ["summary"],
    },
  },
];

// Tool implementations
async function executeBrowserNavigate(
  url: string,
  callbacks: ManusCallbacks
): Promise<{ output: string; screenshot?: string }> {
  try {
    const { chromium } = await import("playwright");

    if (!browserState.browser) {
      browserState.browser = await chromium.launch({ headless: true });
      browserState.page = await browserState.browser.newPage();
      browserState.isActive = true;
    }

    await browserState.page!.goto(url, {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    browserState.url = url;

    const title = await browserState.page!.title();

    // Take screenshot and return as base64
    const screenshotBuffer = await browserState.page!.screenshot({
      type: "png",
    });
    const screenshotBase64 = screenshotBuffer.toString("base64");

    callbacks.onScreenshot(screenshotBase64, url);

    return {
      output: `Navigated to: ${url}\nPage title: ${title}`,
      screenshot: screenshotBase64,
    };
  } catch (error) {
    return {
      output: `Navigation error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function executeBrowserClick(
  selector: string,
  callbacks: ManusCallbacks
): Promise<{ output: string; screenshot?: string }> {
  if (!browserState.page) {
    return {
      output: "Error: No browser page active. Navigate to a URL first.",
    };
  }

  try {
    await browserState.page.click(selector, { timeout: 10000 });
    await browserState.page
      .waitForLoadState("networkidle", { timeout: 5000 })
      .catch(() => {});

    const url = browserState.page.url();
    browserState.url = url;

    // Take screenshot after click
    const screenshotBuffer = await browserState.page.screenshot({
      type: "png",
    });
    const screenshotBase64 = screenshotBuffer.toString("base64");

    callbacks.onScreenshot(screenshotBase64, url);

    return {
      output: `Clicked: ${selector}\nCurrent URL: ${url}`,
      screenshot: screenshotBase64,
    };
  } catch (error) {
    return {
      output: `Click error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function executeBrowserType(
  selector: string,
  text: string,
  callbacks: ManusCallbacks
): Promise<{ output: string; screenshot?: string }> {
  if (!browserState.page) {
    return {
      output: "Error: No browser page active. Navigate to a URL first.",
    };
  }

  try {
    await browserState.page.fill(selector, text, { timeout: 10000 });

    // Take screenshot after typing
    const screenshotBuffer = await browserState.page.screenshot({
      type: "png",
    });
    const screenshotBase64 = screenshotBuffer.toString("base64");

    callbacks.onScreenshot(screenshotBase64, browserState.url);

    return {
      output: `Typed "${text.length > 50 ? text.slice(0, 50) + "..." : text}" into ${selector}`,
      screenshot: screenshotBase64,
    };
  } catch (error) {
    return {
      output: `Type error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function executeBrowserScreenshot(
  fullPage: boolean,
  callbacks: ManusCallbacks
): Promise<{ output: string; screenshot?: string }> {
  if (!browserState.page) {
    return {
      output: "Error: No browser page active. Navigate to a URL first.",
    };
  }

  try {
    const screenshotBuffer = await browserState.page.screenshot({
      type: "png",
      fullPage,
    });
    const screenshotBase64 = screenshotBuffer.toString("base64");

    callbacks.onScreenshot(screenshotBase64, browserState.url);

    return {
      output: `Screenshot captured (${fullPage ? "full page" : "viewport"})`,
      screenshot: screenshotBase64,
    };
  } catch (error) {
    return {
      output: `Screenshot error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function executeBrowserGetContent(): Promise<{ output: string }> {
  if (!browserState.page) {
    return {
      output: "Error: No browser page active. Navigate to a URL first.",
    };
  }

  try {
    const content = await browserState.page.evaluate(() => {
      const body = document.body.cloneNode(true) as HTMLElement;
      const scripts = body.querySelectorAll("script, style, noscript");
      scripts.forEach(s => s.remove());
      return body.innerText;
    });

    const title = await browserState.page.title();
    const url = browserState.page.url();

    let result = `URL: ${url}\nTitle: ${title}\n\nContent:\n${content}`;
    if (result.length > 10000) {
      result = result.slice(0, 10000) + "\n... [truncated]";
    }

    return { output: result };
  } catch (error) {
    return {
      output: `Content error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function executeTerminal(
  command: string,
  workdir: string | undefined,
  callbacks: ManusCallbacks
): Promise<{ output: string }> {
  const cwd = workdir ? path.join(MANUS_WORKSPACE, workdir) : MANUS_WORKSPACE;

  // Security: Block dangerous commands
  const dangerousPatterns = [
    /rm\s+-rf\s+\//,
    /mkfs/,
    /dd\s+if=.*of=\/dev/,
    />\s*\/dev\/sd/,
    /shutdown/,
    /reboot/,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(command)) {
      return { output: "Error: This command is blocked for security reasons" };
    }
  }

  try {
    await fs.mkdir(cwd, { recursive: true });

    const { stdout, stderr } = await execAsync(command, {
      cwd,
      timeout: 60000,
      maxBuffer: 1024 * 1024 * 5,
    });

    const output = stdout + (stderr ? `\nStderr: ${stderr}` : "");
    callbacks.onTerminalOutput(output, !!stderr && !stdout);

    return { output: output || "Command executed successfully (no output)" };
  } catch (error) {
    const execError = error as {
      stdout?: string;
      stderr?: string;
      message?: string;
    };
    const output = `Command error:\n${execError.stderr || ""}\nOutput:\n${execError.stdout || ""}\n${execError.message || ""}`;
    callbacks.onTerminalOutput(output, true);
    return { output };
  }
}

async function executeFileRead(filePath: string): Promise<{ output: string }> {
  const fullPath = path.join(MANUS_WORKSPACE, filePath);

  try {
    const content = await fs.readFile(fullPath, "utf-8");
    if (content.length > 50000) {
      return { output: content.slice(0, 50000) + "\n... [truncated]" };
    }
    return { output: content };
  } catch (error) {
    return {
      output: `File read error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function executeFileWrite(
  filePath: string,
  content: string,
  callbacks: ManusCallbacks
): Promise<{ output: string }> {
  const fullPath = path.join(MANUS_WORKSPACE, filePath);

  try {
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, "utf-8");

    const stats = await fs.stat(fullPath);
    callbacks.onFileOperation("write", filePath, content);

    return { output: `File written: ${fullPath} (${stats.size} bytes)` };
  } catch (error) {
    return {
      output: `File write error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function executeFileList(dirPath: string): Promise<{ output: string }> {
  const fullPath = dirPath
    ? path.join(MANUS_WORKSPACE, dirPath)
    : MANUS_WORKSPACE;

  try {
    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    const items = entries.map(
      e => `${e.isDirectory() ? "[DIR]" : "[FILE]"} ${e.name}`
    );
    return {
      output: `Contents of ${fullPath}:\n${items.join("\n") || "(empty)"}`,
    };
  } catch (error) {
    return {
      output: `List error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// Execute a tool
async function executeTool(
  name: string,
  input: Record<string, unknown>,
  callbacks: ManusCallbacks
): Promise<ManusToolResult> {
  const startTime = Date.now();
  let result: { output: string; screenshot?: string };

  switch (name) {
    case "browser_navigate":
      result = await executeBrowserNavigate(input.url as string, callbacks);
      break;
    case "browser_click":
      result = await executeBrowserClick(input.selector as string, callbacks);
      break;
    case "browser_type":
      result = await executeBrowserType(
        input.selector as string,
        input.text as string,
        callbacks
      );
      break;
    case "browser_screenshot":
      result = await executeBrowserScreenshot(
        (input.fullPage as boolean) || false,
        callbacks
      );
      break;
    case "browser_get_content":
      result = await executeBrowserGetContent();
      break;
    case "terminal_execute":
      result = await executeTerminal(
        input.command as string,
        input.workdir as string | undefined,
        callbacks
      );
      break;
    case "file_read":
      result = await executeFileRead(input.path as string);
      break;
    case "file_write":
      result = await executeFileWrite(
        input.path as string,
        input.content as string,
        callbacks
      );
      break;
    case "file_list":
      result = await executeFileList((input.path as string) || "");
      break;
    case "task_complete":
      return {
        toolCallId: "",
        output: input.summary as string,
        isError: false,
      };
    default:
      result = { output: `Unknown tool: ${name}` };
  }

  const isError = result.output.toLowerCase().includes("error:");

  return {
    toolCallId: "",
    output: result.output,
    isError,
    screenshot: result.screenshot,
  };
}

// Main orchestrator
export async function runManusOrchestrator(
  task: string,
  callbacks: ManusCallbacks,
  options?: {
    maxIterations?: number;
    systemPrompt?: string;
  }
): Promise<void> {
  const MAX_ITERATIONS = options?.maxIterations || 15;

  await ensureWorkspace();

  const systemPrompt =
    options?.systemPrompt ||
    `You are Manus, an autonomous AI agent capable of using a computer to complete tasks.

You have access to:
- A web browser (navigate, click, type, screenshot, get content)
- A terminal (execute shell commands)
- File system (read, write, list files)

Your workspace is at: ${MANUS_WORKSPACE}

IMPORTANT GUIDELINES:
1. Think step by step about how to accomplish the task
2. Use browser_navigate to visit websites
3. Use terminal_execute for shell commands (installing packages, running scripts, etc.)
4. Use file_write to create files in the workspace
5. After each action, observe the results before proceeding
6. When the task is complete, use task_complete to summarize what you did

Current date: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`;

  const messages: Array<{
    role: "user" | "assistant";
    content:
      | string
      | Array<{
          type: string;
          text?: string;
          id?: string;
          name?: string;
          input?: Record<string, unknown>;
          tool_use_id?: string;
          content?: string;
        }>;
  }> = [{ role: "user", content: task }];

  let iteration = 0;
  let isComplete = false;

  while (iteration < MAX_ITERATIONS && !isComplete) {
    iteration++;
    callbacks.onIteration?.(iteration, MAX_ITERATIONS);

    try {
      // Call Claude Opus 4.5
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: CLAUDE_OPUS_MODEL,
          max_tokens: 4096,
          system: systemPrompt,
          messages,
          tools: MANUS_TOOLS,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic API error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      const assistantContent = data.content;

      // Process the response
      const toolCalls: ManusToolCall[] = [];
      let textContent = "";

      for (const block of assistantContent) {
        if (block.type === "text") {
          textContent += block.text;
          callbacks.onThinking(block.text);
        } else if (block.type === "tool_use") {
          const toolCall: ManusToolCall = {
            id: block.id,
            name: block.name,
            input: block.input,
          };
          toolCalls.push(toolCall);
          callbacks.onToolCall(toolCall);
        }
      }

      // Add assistant message to history
      messages.push({
        role: "assistant",
        content: assistantContent,
      });

      // Execute tools
      if (toolCalls.length > 0) {
        const toolResults: Array<{
          type: string;
          tool_use_id: string;
          content: string;
        }> = [];

        for (const toolCall of toolCalls) {
          // Check for task completion
          if (toolCall.name === "task_complete") {
            const summary = toolCall.input.summary as string;
            callbacks.onComplete(summary);
            isComplete = true;
            break;
          }

          const result = await executeTool(
            toolCall.name,
            toolCall.input,
            callbacks
          );
          result.toolCallId = toolCall.id;
          callbacks.onToolResult(result);

          toolResults.push({
            type: "tool_result",
            tool_use_id: toolCall.id,
            content: result.output,
          });
        }

        if (!isComplete) {
          // Add tool results to conversation
          messages.push({
            role: "user",
            content: toolResults,
          });
        }
      } else if (data.stop_reason === "end_turn") {
        // No tool calls and end turn - provide the text response
        callbacks.onComplete(textContent || "Task completed.");
        isComplete = true;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      callbacks.onError(errorMsg);
      break;
    }
  }

  // Cleanup browser if active
  if (browserState.browser) {
    try {
      await browserState.browser.close();
    } catch {
      // Ignore cleanup errors
    }
    browserState.browser = null;
    browserState.page = null;
    browserState.isActive = false;
  }

  if (!isComplete && iteration >= MAX_ITERATIONS) {
    callbacks.onError(`Task exceeded maximum iterations (${MAX_ITERATIONS})`);
  }
}

// Get current browser state for UI
export function getBrowserState(): { url: string; isActive: boolean } {
  return {
    url: browserState.url,
    isActive: browserState.isActive,
  };
}

// Get workspace path
export function getWorkspacePath(): string {
  return MANUS_WORKSPACE;
}
