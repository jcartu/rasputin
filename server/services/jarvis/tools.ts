/**
 * JARVIS Tool Executors
 * Implements the actual functionality for each tool the orchestrator can use
 */

import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";
import { generateImage } from "../../_core/imageGeneration";
import { SSHConnectionManager } from "../../ssh";
import { getDb } from "../../db";
import { sshHosts } from "../../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { getCachedResult, setCachedResult } from "../knowledgeCache";
import * as crypto from "crypto";
import { scaffoldProject, type ScaffoldConfig } from "../webApp/scaffolder";
import {
  getSelfEvolutionTools,
  executeSelfEvolutionTool,
} from "../selfEvolution/tools";
import { runAgentTeam, type TeamCallback } from "./agentTeams";
import { webhookHandler } from "../events/webhookHandler";
import { eventExecutor } from "../events/eventExecutor";
import {
  createProcedureFromTask,
  findMatchingProcedure,
} from "./memoryIntegration";
import { getMemoryService } from "../memory";
import {
  connectMCPServer,
  callMCPTool,
  listMCPTools,
  listMCPServers,
} from "../mcp/client";
import { agentManager } from "../multiAgent/agentManager";
import type { AgentType } from "../multiAgent/types";

const execAsync = promisify(exec);

type ToolResult = {
  success: boolean;
  output: string;
  fallbackUsed?: string;
  attempts?: number;
};

type FallbackFn = () => Promise<string>;

async function withRetryAndFallback(
  primaryFn: () => Promise<string>,
  fallbacks: Array<{ name: string; fn: FallbackFn }> = [],
  maxRetries: number = 2
): Promise<ToolResult> {
  let attempts = 0;
  let lastError = "";

  for (let retry = 0; retry <= maxRetries; retry++) {
    attempts++;
    try {
      const result = await primaryFn();
      if (!result.startsWith("Error:") && !result.includes("error:")) {
        return { success: true, output: result, attempts };
      }
      lastError = result;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  for (const fallback of fallbacks) {
    attempts++;
    try {
      const result = await fallback.fn();
      if (!result.startsWith("Error:") && !result.includes("error:")) {
        return {
          success: true,
          output: result,
          fallbackUsed: fallback.name,
          attempts,
        };
      }
    } catch {
      continue;
    }
  }

  return { success: false, output: lastError, attempts };
}

async function verifyFileCreated(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function verifyCommandOutput(
  output: string,
  expectedPatterns: string[]
): Promise<{ verified: boolean; missing: string[] }> {
  const missing: string[] = [];
  for (const pattern of expectedPatterns) {
    if (!output.includes(pattern)) {
      missing.push(pattern);
    }
  }
  return { verified: missing.length === 0, missing };
}

async function verifyServerRunning(
  port: number,
  maxAttempts: number = 5
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`http://localhost:${port}`, {
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok || response.status < 500) {
        return true;
      }
    } catch {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  return false;
}

// File backup storage for rollback capability
interface FileBackup {
  id: string;
  filePath: string;
  originalContent: string;
  newContent: string;
  timestamp: Date;
  diff: string;
}

const fileBackups: Map<string, FileBackup> = new Map();

interface DebugSnapshot {
  id: string;
  label: string;
  timestamp: Date;
  state: Record<string, unknown>;
  stackTrace: string[];
  outputs: string[];
  errors: string[];
}

interface DebugSession {
  id: string;
  startedAt: Date;
  snapshots: DebugSnapshot[];
  currentStep: number;
  hypothesis: string | null;
  attempts: Array<{
    description: string;
    result: "success" | "failure";
    error?: string;
  }>;
}

const debugSessions: Map<string, DebugSession> = new Map();
let activeDebugSession: string | null = null;

// Perplexity API for web search
const SONAR_API_KEY = process.env.SONAR_API_KEY || "";

// Sandbox directory for JARVIS operations - use /tmp for cross-platform compatibility
const JARVIS_SANDBOX = process.env.JARVIS_SANDBOX || "/tmp/jarvis-workspace";

// Ensure sandbox directory exists
async function ensureSandbox(): Promise<void> {
  try {
    await fs.mkdir(JARVIS_SANDBOX, { recursive: true });
  } catch {
    // Directory may already exist
  }
}

async function perplexitySearch(query: string): Promise<string> {
  if (!SONAR_API_KEY) {
    throw new Error("Perplexity API key not configured");
  }

  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SONAR_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar-pro",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful research assistant. Provide accurate, current information with sources when available.",
        },
        { role: "user", content: query },
      ],
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    throw new Error(`Perplexity API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "No results found";
  const citations = data.citations || [];

  if (citations.length > 0) {
    return `${content}\n\nSources:\n${citations.map((c: string, i: number) => `${i + 1}. ${c}`).join("\n")}`;
  }
  return content;
}

async function directHttpSearch(query: string): Promise<string> {
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  const response = await fetch(searchUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; JARVIS/1.0; +https://rasputin.manus.space)",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP search failed: ${response.status}`);
  }

  const html = await response.text();
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text.length > 5000
    ? text.substring(0, 5000) + "... [truncated]"
    : text;
}

export async function webSearch(query: string): Promise<string> {
  const cached = await getCachedResult(query, "web_search", 24);
  if (cached) {
    return `[CACHED] ${cached}`;
  }

  const result = await withRetryAndFallback(
    () => perplexitySearch(query),
    [
      { name: "SearXNG", fn: () => searxngSearch(query) },
      { name: "DirectHTTP", fn: () => directHttpSearch(query) },
    ],
    1
  );

  if (result.success) {
    const prefix = result.fallbackUsed
      ? `[FALLBACK:${result.fallbackUsed}] `
      : "";
    await setCachedResult(query, "web_search", result.output);
    return prefix + result.output;
  }

  return `Error: All search methods failed after ${result.attempts} attempts. Last error: ${result.output}`;
}

/**
 * SearXNG Search - Free, unlimited, privacy-focused search
 * Aggregates results from multiple search engines (Google, Bing, DuckDuckGo, etc.)
 */
export async function searxngSearch(
  query: string,
  options?: { engines?: string; categories?: string }
): Promise<string> {
  const SEARXNG_URL = process.env.SEARXNG_URL || "http://localhost:8888";

  try {
    const params = new URLSearchParams({
      q: query,
      format: "json",
      ...(options?.engines && { engines: options.engines }),
      ...(options?.categories && { categories: options.categories }),
    });

    const response = await fetch(`${SEARXNG_URL}/search?${params}`, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return `SearXNG error: ${response.status} ${response.statusText}`;
    }

    const data = await response.json();
    const results = data.results || [];

    if (results.length === 0) {
      return "No results found";
    }

    // Format results nicely
    const formattedResults = results
      .slice(0, 10)
      .map(
        (
          r: {
            title?: string;
            url?: string;
            content?: string;
            engine?: string;
          },
          i: number
        ) => {
          return `${i + 1}. ${r.title || "Untitled"}\n   URL: ${r.url || "N/A"}\n   ${r.content || "No description"}\n   Source: ${r.engine || "unknown"}`;
        }
      )
      .join("\n\n");

    return `Found ${data.number_of_results || results.length} results:\n\n${formattedResults}`;
  } catch (error) {
    return `SearXNG error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Browse URL and extract content
 */
export async function browseUrl(url: string): Promise<string> {
  try {
    // Use a simple fetch with user agent
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; JARVIS/1.0; +https://rasputin.manus.space)",
      },
    });

    if (!response.ok) {
      return `Error fetching URL: ${response.status} ${response.statusText}`;
    }

    const html = await response.text();

    // Simple HTML to text extraction
    // Remove script and style tags
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Limit length
    if (text.length > 10000) {
      text = text.substring(0, 10000) + "... [truncated]";
    }

    return text;
  } catch (error) {
    return `Error browsing URL: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Execute Python code in sandbox
 */
export async function executePython(code: string): Promise<string> {
  await ensureSandbox();

  const filename = `script_${Date.now()}.py`;
  const filepath = path.join(JARVIS_SANDBOX, filename);

  try {
    // Write code to file
    await fs.writeFile(filepath, code, "utf-8");

    // Execute with timeout
    const { stdout, stderr } = await execAsync(
      `cd ${JARVIS_SANDBOX} && timeout 30 python3 ${filename}`,
      {
        maxBuffer: 1024 * 1024, // 1MB
      }
    );

    // Clean up
    await fs.unlink(filepath).catch(() => {});

    const output = stdout + (stderr ? `\nStderr: ${stderr}` : "");
    return output || "Code executed successfully (no output)";
  } catch (error: unknown) {
    // Clean up on error
    await fs.unlink(filepath).catch(() => {});

    const execError = error as {
      stdout?: string;
      stderr?: string;
      message?: string;
    };
    if (execError.stdout || execError.stderr) {
      return `Execution error:\n${execError.stderr || ""}\nOutput:\n${execError.stdout || ""}`;
    }
    return `Execution error: ${execError.message || String(error)}`;
  }
}

/**
 * Execute JavaScript/Node.js code in sandbox
 */
export async function executeJavaScript(code: string): Promise<string> {
  await ensureSandbox();

  const filename = `script_${Date.now()}.mjs`;
  const filepath = path.join(JARVIS_SANDBOX, filename);

  try {
    // Write code to file
    await fs.writeFile(filepath, code, "utf-8");

    // Execute with timeout
    const { stdout, stderr } = await execAsync(
      `cd ${JARVIS_SANDBOX} && timeout 30 node ${filename}`,
      {
        maxBuffer: 1024 * 1024, // 1MB
      }
    );

    // Clean up
    await fs.unlink(filepath).catch(() => {});

    const output = stdout + (stderr ? `\nStderr: ${stderr}` : "");
    return output || "Code executed successfully (no output)";
  } catch (error: unknown) {
    // Clean up on error
    await fs.unlink(filepath).catch(() => {});

    const execError = error as {
      stdout?: string;
      stderr?: string;
      message?: string;
    };
    if (execError.stdout || execError.stderr) {
      return `Execution error:\n${execError.stderr || ""}\nOutput:\n${execError.stdout || ""}`;
    }
    return `Execution error: ${execError.message || String(error)}`;
  }
}

/**
 * Run shell command in sandbox
 */
export async function runShell(command: string): Promise<string> {
  await ensureSandbox();

  // Security: block dangerous commands
  const dangerousPatterns = [
    /rm\s+-rf\s+\//, // rm -rf /
    /mkfs/, // filesystem format
    /dd\s+if=.*of=\/dev/, // disk write
    />\s*\/dev\/sd/, // write to disk
    /shutdown/, // shutdown
    /reboot/, // reboot
    /init\s+0/, // init 0
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(command)) {
      return "Error: This command is blocked for security reasons";
    }
  }

  try {
    const { stdout, stderr } = await execAsync(
      `cd ${JARVIS_SANDBOX} && timeout 60 ${command}`,
      {
        maxBuffer: 1024 * 1024 * 5, // 5MB
      }
    );

    const output = stdout + (stderr ? `\nStderr: ${stderr}` : "");
    return output || "Command executed successfully (no output)";
  } catch (error: unknown) {
    const execError = error as {
      stdout?: string;
      stderr?: string;
      message?: string;
    };
    if (execError.stdout || execError.stderr) {
      return `Command error:\n${execError.stderr || ""}\nOutput:\n${execError.stdout || ""}`;
    }
    return `Command error: ${execError.message || String(error)}`;
  }
}

/**
 * Read file contents
 */
export async function readFile(filePath: string): Promise<string> {
  await ensureSandbox();

  // Resolve path relative to sandbox
  const resolvedPath = filePath.startsWith("/")
    ? filePath
    : path.join(JARVIS_SANDBOX, filePath);

  try {
    const content = await fs.readFile(resolvedPath, "utf-8");

    // Limit size
    if (content.length > 50000) {
      return content.substring(0, 50000) + "\n... [truncated - file too large]";
    }

    return content;
  } catch (error) {
    return `Error reading file: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function writeFile(
  filePath: string,
  content: string
): Promise<string> {
  await ensureSandbox();

  const resolvedPath = filePath.startsWith("/")
    ? filePath
    : path.join(JARVIS_SANDBOX, filePath);

  try {
    await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
    await fs.writeFile(resolvedPath, content, "utf-8");

    const verified = await verifyFileCreated(resolvedPath);
    if (!verified) {
      return `Warning: File write reported success but verification failed: ${resolvedPath}`;
    }

    const stats = await fs.stat(resolvedPath);
    return `File written and verified: ${resolvedPath} (${stats.size} bytes)`;
  } catch (error) {
    return `Error writing file: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * List files in directory
 */
export async function listFiles(dirPath: string): Promise<string> {
  await ensureSandbox();

  // Resolve path relative to sandbox
  const resolvedPath = dirPath.startsWith("/")
    ? dirPath
    : path.join(JARVIS_SANDBOX, dirPath);

  try {
    const entries = await fs.readdir(resolvedPath, { withFileTypes: true });

    const files = entries.map(entry => {
      const type = entry.isDirectory() ? "[DIR]" : "[FILE]";
      return `${type} ${entry.name}`;
    });

    return files.length > 0 ? files.join("\n") : "Directory is empty";
  } catch (error) {
    return `Error listing files: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Calculator - precise mathematical calculations
 */
export async function calculate(expression: string): Promise<string> {
  try {
    // Use Python for precise calculations
    const code = `
import math

# Safe math functions
safe_dict = {
    'abs': abs, 'round': round, 'min': min, 'max': max,
    'sum': sum, 'pow': pow, 'sqrt': math.sqrt,
    'sin': math.sin, 'cos': math.cos, 'tan': math.tan,
    'asin': math.asin, 'acos': math.acos, 'atan': math.atan,
    'log': math.log, 'log10': math.log10, 'log2': math.log2,
    'exp': math.exp, 'floor': math.floor, 'ceil': math.ceil,
    'pi': math.pi, 'e': math.e,
    'factorial': math.factorial, 'gcd': math.gcd,
}

try:
    result = eval(${JSON.stringify(expression)}, {"__builtins__": {}}, safe_dict)
    print(f"Result: {result}")
except Exception as e:
    print(f"Error: {e}")
`;
    return await executePython(code);
  } catch (error) {
    return `Calculation error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * HTTP Request - make API calls
 */
export async function httpRequest(
  url: string,
  method: string = "GET",
  headers?: Record<string, string>,
  body?: string
): Promise<string> {
  try {
    const options: RequestInit = {
      method: method.toUpperCase(),
      headers: {
        "User-Agent": "JARVIS/1.0",
        ...headers,
      },
    };

    if (body && ["POST", "PUT", "PATCH"].includes(method.toUpperCase())) {
      options.body = body;
      if (!headers?.["Content-Type"]) {
        (options.headers as Record<string, string>)["Content-Type"] =
          "application/json";
      }
    }

    const response = await fetch(url, options);
    const contentType = response.headers.get("content-type") || "";

    let responseBody: string;
    if (contentType.includes("application/json")) {
      const json = await response.json();
      responseBody = JSON.stringify(json, null, 2);
    } else {
      responseBody = await response.text();
    }

    // Limit response size
    if (responseBody.length > 20000) {
      responseBody = responseBody.substring(0, 20000) + "\n... [truncated]";
    }

    return `Status: ${response.status} ${response.statusText}\n\nResponse:\n${responseBody}`;
  } catch (error) {
    return `HTTP error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Generate Image using AI
 */
export async function generateImageTool(prompt: string): Promise<string> {
  try {
    const result = await generateImage({ prompt });

    if (result.url) {
      return `Image generated successfully!\n\nURL: ${result.url}\n\nPrompt used: ${prompt}`;
    } else {
      return "Image generation failed - no URL returned";
    }
  } catch (error) {
    return `Image generation error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Get current date and time
 */
export function getCurrentDateTime(): string {
  const now = new Date();
  return `Current date and time: ${now.toISOString()}\nLocal: ${now.toLocaleString()}\nTimezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
}

/**
 * JSON Parse/Stringify helper
 */
export function jsonTool(
  operation: "parse" | "stringify",
  data: string
): string {
  try {
    if (operation === "parse") {
      const parsed = JSON.parse(data);
      return JSON.stringify(parsed, null, 2);
    } else {
      // Assume data is already a string representation
      const obj = JSON.parse(data);
      return JSON.stringify(obj);
    }
  } catch (error) {
    return `JSON error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Text processing utilities
 */
export function textProcess(
  operation:
    | "count_words"
    | "count_chars"
    | "count_lines"
    | "uppercase"
    | "lowercase"
    | "reverse",
  text: string
): string {
  switch (operation) {
    case "count_words":
      return `Word count: ${text.split(/\s+/).filter(w => w.length > 0).length}`;
    case "count_chars":
      return `Character count: ${text.length} (without spaces: ${text.replace(/\s/g, "").length})`;
    case "count_lines":
      return `Line count: ${text.split("\n").length}`;
    case "uppercase":
      return text.toUpperCase();
    case "lowercase":
      return text.toLowerCase();
    case "reverse":
      return text.split("").reverse().join("");
    default:
      return `Unknown operation: ${operation}`;
  }
}

/**
 * Execute SSH command on a remote host
 * This requires a host to be registered in the SSH hosts database
 */
export async function sshExecute(
  hostName: string,
  command: string,
  userId: number,
  workingDirectory?: string
): Promise<string> {
  try {
    const db = await getDb();
    if (!db) {
      return "Error: Database not available";
    }

    // Find host by name for this user
    const [host] = await db
      .select()
      .from(sshHosts)
      .where(and(eq(sshHosts.name, hostName), eq(sshHosts.userId, userId)));

    if (!host) {
      return `Error: SSH host '${hostName}' not found. Please register this host in Agent > Hosts tab first.`;
    }

    const sshManager = SSHConnectionManager.getInstance();
    const result = await sshManager.executeCommand(host.id, userId, command, {
      workingDirectory,
      timeout: 60000, // 60 second timeout
    });

    if (!result.success) {
      if (result.error?.startsWith("APPROVAL_REQUIRED:")) {
        return result.error;
      }
      return `SSH Error: ${result.error || result.stderr}`;
    }

    let output = "";
    if (result.stdout) output += result.stdout;
    if (result.stderr) output += `\nStderr: ${result.stderr}`;
    output += `\n[Exit code: ${result.exitCode}, Duration: ${result.durationMs}ms]`;

    return output || "Command executed successfully (no output)";
  } catch (error) {
    return `SSH Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Read a file from a remote host via SSH
 */
export async function sshReadFile(
  hostName: string,
  filePath: string,
  userId: number
): Promise<string> {
  const command = `cat ${JSON.stringify(filePath)}`;
  return sshExecute(hostName, command, userId);
}

/**
 * Write content to a file on a remote host via SSH
 */
export async function sshWriteFile(
  hostName: string,
  filePath: string,
  content: string,
  userId: number
): Promise<string> {
  // Use heredoc to write file content safely
  const escapedContent = content.replace(/'/g, "'" + "'" + "'" + "'");
  const command = `cat > ${JSON.stringify(filePath)} << 'RASPUTIN_EOF'\n${escapedContent}\nRASPUTIN_EOF`;
  return sshExecute(hostName, command, userId);
}

/**
 * List files on a remote host via SSH
 */
export async function sshListFiles(
  hostName: string,
  dirPath: string,
  userId: number
): Promise<string> {
  const command = `ls -la ${JSON.stringify(dirPath)}`;
  return sshExecute(hostName, command, userId);
}

/**
 * Start a long-running process in a tmux session
 */
export async function tmuxStart(
  sessionName: string,
  command: string
): Promise<string> {
  try {
    const sanitizedName = sessionName.replace(/[^a-zA-Z0-9_-]/g, "_");
    const fullSessionName = `jarvis_${sanitizedName}`;

    const checkExists = await execAsync(
      `tmux has-session -t ${fullSessionName} 2>/dev/null && echo "exists" || echo "not_exists"`
    );

    if (checkExists.stdout.trim() === "exists") {
      return `Session '${fullSessionName}' already exists. Use tmux_output to check its status or tmux_stop to stop it.`;
    }

    await execAsync(
      `tmux new-session -d -s ${fullSessionName} -c ${JARVIS_SANDBOX} "${command}"`
    );

    return `Started tmux session '${fullSessionName}' running: ${command}\nUse tmux_output('${sanitizedName}') to check output.`;
  } catch (error) {
    return `tmux error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Get output from a tmux session
 */
export async function tmuxOutput(
  sessionName: string,
  lines: number = 100
): Promise<string> {
  try {
    const fullSessionName = `jarvis_${sessionName.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

    const { stdout } = await execAsync(
      `tmux capture-pane -t ${fullSessionName} -p -S -${lines}`
    );

    return stdout || "(no output)";
  } catch (error) {
    return `tmux error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Stop a tmux session
 */
export async function tmuxStop(sessionName: string): Promise<string> {
  try {
    const fullSessionName = `jarvis_${sessionName.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

    await execAsync(`tmux kill-session -t ${fullSessionName}`);
    return `Stopped tmux session '${fullSessionName}'`;
  } catch (error) {
    return `tmux error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * List all JARVIS tmux sessions
 */
export async function tmuxList(): Promise<string> {
  try {
    const { stdout } = await execAsync(
      `tmux list-sessions -F "#{session_name}: #{session_created_string}" 2>/dev/null | grep "^jarvis_" || echo "No JARVIS sessions running"`
    );

    return stdout;
  } catch (error) {
    return "No JARVIS sessions running";
  }
}

/**
 * Send input to a tmux session
 */
export async function tmuxSend(
  sessionName: string,
  input: string
): Promise<string> {
  try {
    const fullSessionName = `jarvis_${sessionName.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

    await execAsync(`tmux send-keys -t ${fullSessionName} "${input}" Enter`);
    return `Sent input to session '${fullSessionName}'`;
  } catch (error) {
    return `tmux error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function generateUnifiedDiff(
  filePath: string,
  original: string,
  modified: string
): string {
  const originalLines = original.split("\n");
  const modifiedLines = modified.split("\n");

  const diff: string[] = [];
  diff.push(`--- ${filePath}`);
  diff.push(`+++ ${filePath}`);

  let i = 0,
    j = 0;
  let hunkStart = -1;
  let hunkLines: string[] = [];

  const flushHunk = () => {
    if (hunkLines.length > 0 && hunkStart >= 0) {
      diff.push(`@@ -${hunkStart + 1} +${hunkStart + 1} @@`);
      diff.push(...hunkLines);
      hunkLines = [];
    }
    hunkStart = -1;
  };

  while (i < originalLines.length || j < modifiedLines.length) {
    if (i < originalLines.length && j < modifiedLines.length) {
      if (originalLines[i] === modifiedLines[j]) {
        flushHunk();
        i++;
        j++;
      } else {
        if (hunkStart < 0) hunkStart = i;
        const origInMod = modifiedLines.indexOf(originalLines[i], j);
        const modInOrig = originalLines.indexOf(modifiedLines[j], i);

        if (modInOrig >= 0 && (origInMod < 0 || modInOrig <= origInMod)) {
          hunkLines.push(`-${originalLines[i]}`);
          i++;
        } else if (origInMod >= 0) {
          hunkLines.push(`+${modifiedLines[j]}`);
          j++;
        } else {
          hunkLines.push(`-${originalLines[i]}`);
          hunkLines.push(`+${modifiedLines[j]}`);
          i++;
          j++;
        }
      }
    } else if (i < originalLines.length) {
      if (hunkStart < 0) hunkStart = i;
      hunkLines.push(`-${originalLines[i]}`);
      i++;
    } else {
      if (hunkStart < 0) hunkStart = j;
      hunkLines.push(`+${modifiedLines[j]}`);
      j++;
    }
  }

  flushHunk();
  return diff.join("\n");
}

export async function previewFileEdit(
  filePath: string,
  newContent: string
): Promise<string> {
  await ensureSandbox();

  const resolvedPath = filePath.startsWith("/")
    ? filePath
    : path.join(JARVIS_SANDBOX, filePath);

  try {
    let originalContent = "";
    try {
      originalContent = await fs.readFile(resolvedPath, "utf-8");
    } catch {
      originalContent = "";
    }

    const diff = generateUnifiedDiff(resolvedPath, originalContent, newContent);
    const backupId = crypto.randomBytes(8).toString("hex");

    fileBackups.set(backupId, {
      id: backupId,
      filePath: resolvedPath,
      originalContent,
      newContent,
      timestamp: new Date(),
      diff,
    });

    const addedLines = (diff.match(/^\+[^+]/gm) || []).length;
    const removedLines = (diff.match(/^-[^-]/gm) || []).length;

    return `DIFF PREVIEW (backup_id: ${backupId})
File: ${resolvedPath}
Changes: +${addedLines} lines, -${removedLines} lines

${diff}

To apply these changes, use: apply_file_edit("${backupId}")
To discard, use: discard_file_edit("${backupId}")`;
  } catch (error) {
    return `Error generating preview: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function applyFileEdit(backupId: string): Promise<string> {
  const backup = fileBackups.get(backupId);
  if (!backup) {
    return `Error: No pending edit found with id "${backupId}". It may have been applied or discarded.`;
  }

  try {
    await fs.mkdir(path.dirname(backup.filePath), { recursive: true });
    await fs.writeFile(backup.filePath, backup.newContent, "utf-8");

    return `Successfully applied changes to ${backup.filePath}
Backup retained with id "${backupId}" for rollback if needed.
To rollback, use: rollback_file_edit("${backupId}")`;
  } catch (error) {
    return `Error applying edit: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function rollbackFileEdit(backupId: string): Promise<string> {
  const backup = fileBackups.get(backupId);
  if (!backup) {
    return `Error: No backup found with id "${backupId}".`;
  }

  try {
    await fs.writeFile(backup.filePath, backup.originalContent, "utf-8");
    fileBackups.delete(backupId);

    return `Successfully rolled back ${backup.filePath} to its original state.
Backup "${backupId}" has been removed.`;
  } catch (error) {
    return `Error rolling back: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export function discardFileEdit(backupId: string): string {
  const backup = fileBackups.get(backupId);
  if (!backup) {
    return `Error: No pending edit found with id "${backupId}".`;
  }

  fileBackups.delete(backupId);
  return `Discarded pending edit for ${backup.filePath}. No changes were made.`;
}

export function listPendingEdits(): string {
  if (fileBackups.size === 0) {
    return "No pending file edits.";
  }

  const edits = Array.from(fileBackups.values())
    .map(b => `- ${b.id}: ${b.filePath} (${b.timestamp.toISOString()})`)
    .join("\n");

  return `Pending file edits:\n${edits}`;
}

export async function searchAndReplace(
  filePath: string,
  search: string,
  replace: string,
  options?: { regex?: boolean; all?: boolean; caseSensitive?: boolean }
): Promise<string> {
  await ensureSandbox();

  const resolvedPath = filePath.startsWith("/")
    ? filePath
    : path.join(JARVIS_SANDBOX, filePath);

  try {
    const content = await fs.readFile(resolvedPath, "utf-8");

    let searchPattern: RegExp;
    if (options?.regex) {
      const flags = options?.all ? "g" : "";
      searchPattern = new RegExp(
        search,
        options?.caseSensitive ? flags : flags + "i"
      );
    } else {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const flags = options?.all ? "g" : "";
      searchPattern = new RegExp(
        escapedSearch,
        options?.caseSensitive ? flags : flags + "i"
      );
    }

    const matches = content.match(
      new RegExp(
        searchPattern.source,
        "g" + (options?.caseSensitive ? "" : "i")
      )
    );
    const matchCount = matches?.length || 0;

    if (matchCount === 0) {
      return `No matches found for "${search}" in ${resolvedPath}`;
    }

    const newContent = options?.all
      ? content.replace(
          new RegExp(
            searchPattern.source,
            "g" + (options?.caseSensitive ? "" : "i")
          ),
          replace
        )
      : content.replace(searchPattern, replace);

    const diff = generateUnifiedDiff(resolvedPath, content, newContent);
    const backupId = crypto.randomBytes(8).toString("hex");

    fileBackups.set(backupId, {
      id: backupId,
      filePath: resolvedPath,
      originalContent: content,
      newContent,
      timestamp: new Date(),
      diff,
    });

    const replacedCount = options?.all ? matchCount : 1;

    return `SEARCH AND REPLACE PREVIEW (backup_id: ${backupId})
File: ${resolvedPath}
Found: ${matchCount} match(es)
Replaced: ${replacedCount} occurrence(s)

${diff}

To apply these changes, use: apply_file_edit("${backupId}")
To discard, use: discard_file_edit("${backupId}")`;
  } catch (error) {
    return `Error in search and replace: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function insertAtLine(
  filePath: string,
  lineNumber: number,
  content: string,
  position: "before" | "after" = "after"
): Promise<string> {
  await ensureSandbox();

  const resolvedPath = filePath.startsWith("/")
    ? filePath
    : path.join(JARVIS_SANDBOX, filePath);

  try {
    const fileContent = await fs.readFile(resolvedPath, "utf-8");
    const lines = fileContent.split("\n");

    if (lineNumber < 1 || lineNumber > lines.length + 1) {
      return `Error: Line number ${lineNumber} is out of range (file has ${lines.length} lines)`;
    }

    const insertIndex = position === "before" ? lineNumber - 1 : lineNumber;
    lines.splice(insertIndex, 0, content);
    const newContent = lines.join("\n");

    const diff = generateUnifiedDiff(resolvedPath, fileContent, newContent);
    const backupId = crypto.randomBytes(8).toString("hex");

    fileBackups.set(backupId, {
      id: backupId,
      filePath: resolvedPath,
      originalContent: fileContent,
      newContent,
      timestamp: new Date(),
      diff,
    });

    return `INSERT PREVIEW (backup_id: ${backupId})
File: ${resolvedPath}
Insert ${position} line ${lineNumber}

${diff}

To apply these changes, use: apply_file_edit("${backupId}")
To discard, use: discard_file_edit("${backupId}")`;
  } catch (error) {
    return `Error inserting at line: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function deleteLines(
  filePath: string,
  startLine: number,
  endLine: number
): Promise<string> {
  await ensureSandbox();

  const resolvedPath = filePath.startsWith("/")
    ? filePath
    : path.join(JARVIS_SANDBOX, filePath);

  try {
    const fileContent = await fs.readFile(resolvedPath, "utf-8");
    const lines = fileContent.split("\n");

    if (startLine < 1 || endLine > lines.length || startLine > endLine) {
      return `Error: Invalid line range ${startLine}-${endLine} (file has ${lines.length} lines)`;
    }

    const deletedLines = lines.slice(startLine - 1, endLine);
    lines.splice(startLine - 1, endLine - startLine + 1);
    const newContent = lines.join("\n");

    const diff = generateUnifiedDiff(resolvedPath, fileContent, newContent);
    const backupId = crypto.randomBytes(8).toString("hex");

    fileBackups.set(backupId, {
      id: backupId,
      filePath: resolvedPath,
      originalContent: fileContent,
      newContent,
      timestamp: new Date(),
      diff,
    });

    return `DELETE LINES PREVIEW (backup_id: ${backupId})
File: ${resolvedPath}
Deleting lines ${startLine}-${endLine} (${endLine - startLine + 1} lines)

Deleted content:
${deletedLines.map((l, i) => `${startLine + i}: ${l}`).join("\n")}

${diff}

To apply these changes, use: apply_file_edit("${backupId}")
To discard, use: discard_file_edit("${backupId}")`;
  } catch (error) {
    return `Error deleting lines: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function replaceLines(
  filePath: string,
  startLine: number,
  endLine: number,
  newContent: string
): Promise<string> {
  await ensureSandbox();

  const resolvedPath = filePath.startsWith("/")
    ? filePath
    : path.join(JARVIS_SANDBOX, filePath);

  try {
    const fileContent = await fs.readFile(resolvedPath, "utf-8");
    const lines = fileContent.split("\n");

    if (startLine < 1 || endLine > lines.length || startLine > endLine) {
      return `Error: Invalid line range ${startLine}-${endLine} (file has ${lines.length} lines)`;
    }

    const oldLines = lines.slice(startLine - 1, endLine);
    const newLines = newContent.split("\n");
    lines.splice(startLine - 1, endLine - startLine + 1, ...newLines);
    const updatedContent = lines.join("\n");

    const diff = generateUnifiedDiff(resolvedPath, fileContent, updatedContent);
    const backupId = crypto.randomBytes(8).toString("hex");

    fileBackups.set(backupId, {
      id: backupId,
      filePath: resolvedPath,
      originalContent: fileContent,
      newContent: updatedContent,
      timestamp: new Date(),
      diff,
    });

    return `REPLACE LINES PREVIEW (backup_id: ${backupId})
File: ${resolvedPath}
Replacing lines ${startLine}-${endLine}

Old content (${oldLines.length} lines):
${oldLines.map((l, i) => `${startLine + i}: ${l}`).join("\n")}

New content (${newLines.length} lines):
${newLines.map((l, i) => `${startLine + i}: ${l}`).join("\n")}

${diff}

To apply these changes, use: apply_file_edit("${backupId}")
To discard, use: discard_file_edit("${backupId}")`;
  } catch (error) {
    return `Error replacing lines: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function findInFile(
  filePath: string,
  pattern: string,
  options?: { regex?: boolean; context?: number }
): Promise<string> {
  await ensureSandbox();

  const resolvedPath = filePath.startsWith("/")
    ? filePath
    : path.join(JARVIS_SANDBOX, filePath);

  try {
    const content = await fs.readFile(resolvedPath, "utf-8");
    const lines = content.split("\n");
    const contextLines = options?.context ?? 2;

    let searchRegex: RegExp;
    if (options?.regex) {
      searchRegex = new RegExp(pattern, "gi");
    } else {
      const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      searchRegex = new RegExp(escaped, "gi");
    }

    const matches: Array<{
      lineNumber: number;
      line: string;
      before: string[];
      after: string[];
    }> = [];

    for (let i = 0; i < lines.length; i++) {
      if (searchRegex.test(lines[i])) {
        searchRegex.lastIndex = 0;
        matches.push({
          lineNumber: i + 1,
          line: lines[i],
          before: lines.slice(Math.max(0, i - contextLines), i),
          after: lines.slice(
            i + 1,
            Math.min(lines.length, i + 1 + contextLines)
          ),
        });
      }
    }

    if (matches.length === 0) {
      return `No matches found for "${pattern}" in ${resolvedPath}`;
    }

    let result = `SEARCH RESULTS in ${resolvedPath}\n`;
    result += `Found ${matches.length} match(es) for "${pattern}"\n\n`;

    for (const match of matches.slice(0, 10)) {
      result += `--- Line ${match.lineNumber} ---\n`;
      if (match.before.length > 0) {
        match.before.forEach((l, i) => {
          result += `${match.lineNumber - match.before.length + i}: ${l}\n`;
        });
      }
      result += `>>> ${match.lineNumber}: ${match.line}\n`;
      if (match.after.length > 0) {
        match.after.forEach((l, i) => {
          result += `${match.lineNumber + 1 + i}: ${l}\n`;
        });
      }
      result += "\n";
    }

    if (matches.length > 10) {
      result += `... and ${matches.length - 10} more matches\n`;
    }

    return result;
  } catch (error) {
    return `Error searching file: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export function startDebugSession(hypothesis: string): string {
  const sessionId = crypto.randomBytes(8).toString("hex");

  const session: DebugSession = {
    id: sessionId,
    startedAt: new Date(),
    snapshots: [],
    currentStep: 0,
    hypothesis,
    attempts: [],
  };

  debugSessions.set(sessionId, session);
  activeDebugSession = sessionId;

  return `Debug session started: ${sessionId}
Hypothesis: ${hypothesis}

Use debug_snapshot() to capture state at key points.
Use debug_attempt() to log fix attempts.
Use debug_summary() to get a report of the debugging process.`;
}

export function debugSnapshot(
  label: string,
  state: Record<string, unknown>
): string {
  if (!activeDebugSession) {
    return "Error: No active debug session. Start one with start_debug_session().";
  }

  const session = debugSessions.get(activeDebugSession);
  if (!session) {
    return "Error: Debug session not found.";
  }

  const snapshotId = `snap_${session.snapshots.length + 1}`;
  const snapshot: DebugSnapshot = {
    id: snapshotId,
    label,
    timestamp: new Date(),
    state,
    stackTrace: [],
    outputs: [],
    errors: [],
  };

  session.snapshots.push(snapshot);
  session.currentStep++;

  return `Snapshot captured: ${snapshotId} - "${label}"
State keys: ${Object.keys(state).join(", ")}
Total snapshots: ${session.snapshots.length}`;
}

export function debugLogOutput(output: string): string {
  if (!activeDebugSession) {
    return "Error: No active debug session.";
  }

  const session = debugSessions.get(activeDebugSession);
  if (!session || session.snapshots.length === 0) {
    return "Error: No snapshots to attach output to. Create a snapshot first.";
  }

  const latestSnapshot = session.snapshots[session.snapshots.length - 1];
  latestSnapshot.outputs.push(output);

  return `Output logged to snapshot "${latestSnapshot.label}"`;
}

export function debugLogError(error: string): string {
  if (!activeDebugSession) {
    return "Error: No active debug session.";
  }

  const session = debugSessions.get(activeDebugSession);
  if (!session || session.snapshots.length === 0) {
    return "Error: No snapshots to attach error to.";
  }

  const latestSnapshot = session.snapshots[session.snapshots.length - 1];
  latestSnapshot.errors.push(error);

  return `Error logged to snapshot "${latestSnapshot.label}"`;
}

export function debugAttempt(
  description: string,
  result: "success" | "failure",
  error?: string
): string {
  if (!activeDebugSession) {
    return "Error: No active debug session.";
  }

  const session = debugSessions.get(activeDebugSession);
  if (!session) {
    return "Error: Debug session not found.";
  }

  session.attempts.push({ description, result, error });

  if (session.attempts.length >= 3 && result === "failure") {
    return `Attempt logged: ${description} - ${result}
WARNING: 3+ failed attempts. Consider:
1. Re-evaluating the hypothesis
2. Consulting Oracle for alternative approaches
3. Stepping back to examine assumptions`;
  }

  return `Attempt logged: ${description} - ${result}${error ? ` (${error})` : ""}
Total attempts: ${session.attempts.length}`;
}

export function debugSummary(): string {
  if (!activeDebugSession) {
    return "Error: No active debug session.";
  }

  const session = debugSessions.get(activeDebugSession);
  if (!session) {
    return "Error: Debug session not found.";
  }

  const successCount = session.attempts.filter(
    a => a.result === "success"
  ).length;
  const failureCount = session.attempts.filter(
    a => a.result === "failure"
  ).length;

  let summary = `DEBUG SESSION SUMMARY: ${session.id}
Started: ${session.startedAt.toISOString()}
Hypothesis: ${session.hypothesis}

ATTEMPTS: ${session.attempts.length} (${successCount} success, ${failureCount} failure)
`;

  for (const attempt of session.attempts) {
    summary += `  - [${attempt.result.toUpperCase()}] ${attempt.description}`;
    if (attempt.error) summary += ` (Error: ${attempt.error})`;
    summary += "\n";
  }

  summary += `\nSNAPSHOTS: ${session.snapshots.length}\n`;
  for (const snap of session.snapshots) {
    summary += `  - ${snap.id}: ${snap.label} (${snap.timestamp.toISOString()})`;
    if (snap.errors.length > 0) summary += ` [${snap.errors.length} errors]`;
    summary += "\n";
  }

  return summary;
}

export function endDebugSession(conclusion: string): string {
  if (!activeDebugSession) {
    return "Error: No active debug session.";
  }

  const session = debugSessions.get(activeDebugSession);
  if (!session) {
    return "Error: Debug session not found.";
  }

  const summary = debugSummary();
  const sessionId = activeDebugSession;
  activeDebugSession = null;

  return `${summary}
CONCLUSION: ${conclusion}

Debug session ${sessionId} ended.`;
}

export function getDebugSnapshot(snapshotId: string): string {
  if (!activeDebugSession) {
    return "Error: No active debug session.";
  }

  const session = debugSessions.get(activeDebugSession);
  if (!session) {
    return "Error: Debug session not found.";
  }

  const snapshot = session.snapshots.find(s => s.id === snapshotId);
  if (!snapshot) {
    return `Error: Snapshot "${snapshotId}" not found.`;
  }

  return `SNAPSHOT: ${snapshot.id} - ${snapshot.label}
Timestamp: ${snapshot.timestamp.toISOString()}

STATE:
${JSON.stringify(snapshot.state, null, 2)}

OUTPUTS (${snapshot.outputs.length}):
${snapshot.outputs.map((o, i) => `  ${i + 1}. ${o}`).join("\n") || "  (none)"}

ERRORS (${snapshot.errors.length}):
${snapshot.errors.map((e, i) => `  ${i + 1}. ${e}`).join("\n") || "  (none)"}`;
}

/**
 * Take a screenshot of a URL or the dev server
 */
export async function takeScreenshot(
  url: string,
  options?: { fullPage?: boolean; waitFor?: number }
): Promise<string> {
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });

    if (options?.waitFor) {
      await page.waitForTimeout(options.waitFor);
    }

    const screenshotPath = path.join(
      JARVIS_SANDBOX,
      `screenshot_${Date.now()}.png`
    );

    await page.screenshot({
      path: screenshotPath,
      fullPage: options?.fullPage ?? false,
    });

    await browser.close();

    return `Screenshot saved to: ${screenshotPath}\nYou can view this file or use it for analysis.`;
  } catch (error) {
    return `Screenshot error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Browse a page with Playwright and extract content (better than simple fetch)
 */
export async function playwrightBrowse(
  url: string,
  options?: { waitFor?: string; timeout?: number }
): Promise<string> {
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: options?.timeout ?? 30000,
    });

    if (options?.waitFor) {
      await page.waitForSelector(options.waitFor, { timeout: 10000 });
    }

    const content = await page.evaluate(() => {
      const body = document.body;
      const scripts = body.querySelectorAll("script, style, noscript");
      scripts.forEach(s => s.remove());
      return body.innerText;
    });

    const title = await page.title();
    await browser.close();

    let result = `Title: ${title}\n\nContent:\n${content}`;
    if (result.length > 15000) {
      result = result.substring(0, 15000) + "\n... [truncated]";
    }

    return result;
  } catch (error) {
    return `Browse error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

interface BrowserSessionData {
  browser: Awaited<ReturnType<typeof import("playwright").chromium.launch>>;
  page: Awaited<
    ReturnType<
      Awaited<
        ReturnType<typeof import("playwright").chromium.launch>
      >["newPage"]
    >
  >;
  consoleMessages: Array<{ type: string; text: string; timestamp: Date }>;
  networkErrors: Array<{ url: string; status: number; timestamp: Date }>;
  startedAt: Date;
}

const browserSessions: Map<string, BrowserSessionData> = new Map();

export async function browserSessionStart(
  sessionId: string,
  url: string
): Promise<string> {
  if (browserSessions.has(sessionId)) {
    return `Error: Session "${sessionId}" already exists. Use browser_session_end first.`;
  }

  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    const consoleMessages: BrowserSessionData["consoleMessages"] = [];
    const networkErrors: BrowserSessionData["networkErrors"] = [];

    page.on("console", msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date(),
      });
    });

    page.on("response", response => {
      if (response.status() >= 400) {
        networkErrors.push({
          url: response.url(),
          status: response.status(),
          timestamp: new Date(),
        });
      }
    });

    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });

    browserSessions.set(sessionId, {
      browser,
      page,
      consoleMessages,
      networkErrors,
      startedAt: new Date(),
    });

    const title = await page.title();
    return `Browser session "${sessionId}" started.
URL: ${url}
Title: ${title}
Console/network monitoring active.

Available actions: browser_click, browser_fill, browser_select, browser_navigate, browser_screenshot, browser_get_content, browser_get_logs, browser_session_end`;
  } catch (error) {
    return `Error starting browser session: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function browserClick(
  sessionId: string,
  selector: string
): Promise<string> {
  const session = browserSessions.get(sessionId);
  if (!session) {
    return `Error: No browser session "${sessionId}". Start one with browser_session_start.`;
  }

  try {
    await session.page.click(selector, { timeout: 10000 });
    await session.page
      .waitForLoadState("networkidle", { timeout: 5000 })
      .catch(() => {});

    const url = session.page.url();
    return `Clicked "${selector}". Current URL: ${url}`;
  } catch (error) {
    return `Click error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function browserFill(
  sessionId: string,
  selector: string,
  value: string
): Promise<string> {
  const session = browserSessions.get(sessionId);
  if (!session) {
    return `Error: No browser session "${sessionId}".`;
  }

  try {
    await session.page.fill(selector, value, { timeout: 10000 });
    return `Filled "${selector}" with "${value.length > 50 ? value.substring(0, 50) + "..." : value}"`;
  } catch (error) {
    return `Fill error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function browserSelect(
  sessionId: string,
  selector: string,
  value: string
): Promise<string> {
  const session = browserSessions.get(sessionId);
  if (!session) {
    return `Error: No browser session "${sessionId}".`;
  }

  try {
    await session.page.selectOption(selector, value, { timeout: 10000 });
    return `Selected "${value}" in "${selector}"`;
  } catch (error) {
    return `Select error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function browserNavigate(
  sessionId: string,
  url: string
): Promise<string> {
  const session = browserSessions.get(sessionId);
  if (!session) {
    return `Error: No browser session "${sessionId}".`;
  }

  try {
    await session.page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    const title = await session.page.title();
    return `Navigated to: ${url}\nTitle: ${title}`;
  } catch (error) {
    return `Navigate error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function browserScreenshot(
  sessionId: string,
  options?: { fullPage?: boolean; name?: string }
): Promise<string> {
  const session = browserSessions.get(sessionId);
  if (!session) {
    return `Error: No browser session "${sessionId}".`;
  }

  try {
    const filename = options?.name || `session_${sessionId}_${Date.now()}`;
    const screenshotPath = path.join(JARVIS_SANDBOX, `${filename}.png`);

    await session.page.screenshot({
      path: screenshotPath,
      fullPage: options?.fullPage ?? false,
    });

    return `Screenshot saved: ${screenshotPath}`;
  } catch (error) {
    return `Screenshot error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function browserGetContent(sessionId: string): Promise<string> {
  const session = browserSessions.get(sessionId);
  if (!session) {
    return `Error: No browser session "${sessionId}".`;
  }

  try {
    const content = await session.page.evaluate(() => {
      const body = document.body.cloneNode(true) as HTMLElement;
      const scripts = body.querySelectorAll("script, style, noscript");
      scripts.forEach(s => s.remove());
      return body.innerText;
    });

    const title = await session.page.title();
    const url = session.page.url();

    let result = `URL: ${url}\nTitle: ${title}\n\nContent:\n${content}`;
    if (result.length > 15000) {
      result = result.substring(0, 15000) + "\n... [truncated]";
    }

    return result;
  } catch (error) {
    return `Content error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export function browserGetLogs(sessionId: string): string {
  const session = browserSessions.get(sessionId);
  if (!session) {
    return `Error: No browser session "${sessionId}".`;
  }

  const recentConsole = session.consoleMessages.slice(-50);
  const recentNetwork = session.networkErrors.slice(-20);

  let result = `CONSOLE MESSAGES (${session.consoleMessages.length} total, showing last 50):\n`;
  if (recentConsole.length === 0) {
    result += "  (none)\n";
  } else {
    for (const msg of recentConsole) {
      result += `  [${msg.type.toUpperCase()}] ${msg.text}\n`;
    }
  }

  result += `\nNETWORK ERRORS (${session.networkErrors.length} total, showing last 20):\n`;
  if (recentNetwork.length === 0) {
    result += "  (none)\n";
  } else {
    for (const err of recentNetwork) {
      result += `  [${err.status}] ${err.url}\n`;
    }
  }

  return result;
}

export async function browserWaitFor(
  sessionId: string,
  selector: string,
  options?: { timeout?: number; state?: "visible" | "hidden" | "attached" }
): Promise<string> {
  const session = browserSessions.get(sessionId);
  if (!session) {
    return `Error: No browser session "${sessionId}".`;
  }

  try {
    await session.page.waitForSelector(selector, {
      timeout: options?.timeout ?? 10000,
      state: options?.state ?? "visible",
    });
    return `Element "${selector}" is now ${options?.state ?? "visible"}`;
  } catch (error) {
    return `Wait error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function browserSessionEnd(sessionId: string): Promise<string> {
  const session = browserSessions.get(sessionId);
  if (!session) {
    return `Error: No browser session "${sessionId}".`;
  }

  const consoleCount = session.consoleMessages.length;
  const errorCount = session.networkErrors.length;
  const duration = Date.now() - session.startedAt.getTime();

  await session.browser.close();
  browserSessions.delete(sessionId);

  return `Browser session "${sessionId}" ended.
Duration: ${Math.round(duration / 1000)}s
Console messages captured: ${consoleCount}
Network errors captured: ${errorCount}`;
}

export async function browserGetElements(
  sessionId: string,
  selector: string
): Promise<string> {
  const session = browserSessions.get(sessionId);
  if (!session) {
    return `Error: No browser session "${sessionId}".`;
  }

  try {
    const elements = await session.page.$$eval(selector, els =>
      els.map(el => ({
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        class: el.className || null,
        text: el.textContent?.trim().substring(0, 100) || null,
        href: (el as HTMLAnchorElement).href || null,
        type: (el as HTMLInputElement).type || null,
        value: (el as HTMLInputElement).value || null,
      }))
    );

    if (elements.length === 0) {
      return `No elements found matching "${selector}"`;
    }

    let result = `Found ${elements.length} elements matching "${selector}":\n`;
    for (let i = 0; i < Math.min(elements.length, 20); i++) {
      const el = elements[i];
      result += `  ${i + 1}. <${el.tag}`;
      if (el.id) result += ` id="${el.id}"`;
      if (el.class) result += ` class="${el.class}"`;
      if (el.type) result += ` type="${el.type}"`;
      result += `>`;
      if (el.text) result += ` "${el.text}"`;
      if (el.href) result += ` href="${el.href}"`;
      result += "\n";
    }

    if (elements.length > 20) {
      result += `  ... and ${elements.length - 20} more\n`;
    }

    return result;
  } catch (error) {
    return `Elements error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

interface BuildTestResult {
  success: boolean;
  exitCode: number;
  duration: number;
  errors: Array<{ file?: string; line?: number; message: string }>;
  warnings: Array<{ file?: string; line?: number; message: string }>;
  summary: string;
  rawOutput: string;
}

function parseTypeScriptErrors(
  output: string
): Array<{ file?: string; line?: number; message: string }> {
  const errors: Array<{ file?: string; line?: number; message: string }> = [];
  const lines = output.split("\n");

  for (const line of lines) {
    const match = line.match(/^(.+?)\((\d+),\d+\):\s*error\s+TS\d+:\s*(.+)$/);
    if (match) {
      errors.push({
        file: match[1],
        line: parseInt(match[2], 10),
        message: match[3],
      });
    }
  }

  return errors;
}

function parseVitestOutput(output: string): {
  passed: number;
  failed: number;
  errors: Array<{ file?: string; line?: number; message: string }>;
} {
  const errors: Array<{ file?: string; line?: number; message: string }> = [];
  const result = { passed: 0, failed: 0, errors };

  const summaryMatch = output.match(/Tests\s+(\d+)\s+passed.*?(\d+)\s+failed/i);
  if (summaryMatch) {
    result.passed = parseInt(summaryMatch[1], 10);
    result.failed = parseInt(summaryMatch[2], 10);
  } else {
    const passedMatch = output.match(/(\d+)\s+passed/i);
    const failedMatch = output.match(/(\d+)\s+failed/i);
    if (passedMatch) result.passed = parseInt(passedMatch[1], 10);
    if (failedMatch) result.failed = parseInt(failedMatch[1], 10);
  }

  const failBlocks = output.split(/FAIL\s+/);
  for (let i = 1; i < failBlocks.length; i++) {
    const block = failBlocks[i];
    const fileMatch = block.match(/^([^\s]+)/);
    const errorMatch = block.match(/Error:\s*(.+?)(?:\n|$)/);
    if (errorMatch) {
      result.errors.push({
        file: fileMatch?.[1],
        message: errorMatch[1],
      });
    }
  }

  return result;
}

function parseEslintOutput(
  output: string
): Array<{ file?: string; line?: number; message: string }> {
  const errors: Array<{ file?: string; line?: number; message: string }> = [];
  const lines = output.split("\n");

  let currentFile = "";
  for (const line of lines) {
    const fileMatch = line.match(/^([^\s].+\.(ts|tsx|js|jsx))$/);
    if (fileMatch) {
      currentFile = fileMatch[1];
      continue;
    }

    const errorMatch = line.match(
      /^\s*(\d+):(\d+)\s+error\s+(.+?)\s+[\w/@-]+$/
    );
    if (errorMatch && currentFile) {
      errors.push({
        file: currentFile,
        line: parseInt(errorMatch[1], 10),
        message: errorMatch[3],
      });
    }
  }

  return errors;
}

export async function runBuild(
  projectPath: string,
  command?: string
): Promise<string> {
  const buildCommand = command || "pnpm build";
  const startTime = Date.now();

  try {
    const { stdout, stderr } = await execAsync(buildCommand, {
      cwd: projectPath,
      maxBuffer: 1024 * 1024 * 10,
      timeout: 300000,
    });

    const duration = Date.now() - startTime;
    const output = stdout + stderr;

    const result: BuildTestResult = {
      success: true,
      exitCode: 0,
      duration,
      errors: [],
      warnings: [],
      summary: `Build completed successfully in ${Math.round(duration / 1000)}s`,
      rawOutput:
        output.length > 5000
          ? output.substring(0, 5000) + "\n...[truncated]"
          : output,
    };

    return formatBuildResult(result);
  } catch (error) {
    const duration = Date.now() - startTime;
    const execError = error as {
      stdout?: string;
      stderr?: string;
      code?: number;
    };
    const output = (execError.stdout || "") + (execError.stderr || "");

    const tsErrors = parseTypeScriptErrors(output);
    const eslintErrors = parseEslintOutput(output);

    const result: BuildTestResult = {
      success: false,
      exitCode: execError.code || 1,
      duration,
      errors: [...tsErrors, ...eslintErrors],
      warnings: [],
      summary: `Build failed with exit code ${execError.code || 1}`,
      rawOutput:
        output.length > 5000
          ? output.substring(0, 5000) + "\n...[truncated]"
          : output,
    };

    return formatBuildResult(result);
  }
}

export async function runTests(
  projectPath: string,
  options?: { pattern?: string; command?: string }
): Promise<string> {
  let testCommand = options?.command || "pnpm test";
  if (options?.pattern && !options?.command) {
    testCommand = `pnpm vitest run ${options.pattern}`;
  }

  const startTime = Date.now();

  try {
    const { stdout, stderr } = await execAsync(testCommand, {
      cwd: projectPath,
      maxBuffer: 1024 * 1024 * 10,
      timeout: 300000,
    });

    const duration = Date.now() - startTime;
    const output = stdout + stderr;
    const testResults = parseVitestOutput(output);

    const result: BuildTestResult = {
      success: testResults.failed === 0,
      exitCode: 0,
      duration,
      errors: testResults.errors,
      warnings: [],
      summary: `Tests: ${testResults.passed} passed, ${testResults.failed} failed (${Math.round(duration / 1000)}s)`,
      rawOutput:
        output.length > 5000
          ? output.substring(0, 5000) + "\n...[truncated]"
          : output,
    };

    return formatBuildResult(result);
  } catch (error) {
    const duration = Date.now() - startTime;
    const execError = error as {
      stdout?: string;
      stderr?: string;
      code?: number;
    };
    const output = (execError.stdout || "") + (execError.stderr || "");
    const testResults = parseVitestOutput(output);

    const result: BuildTestResult = {
      success: false,
      exitCode: execError.code || 1,
      duration,
      errors: testResults.errors,
      warnings: [],
      summary: `Tests failed: ${testResults.passed} passed, ${testResults.failed} failed`,
      rawOutput:
        output.length > 5000
          ? output.substring(0, 5000) + "\n...[truncated]"
          : output,
    };

    return formatBuildResult(result);
  }
}

export async function runTypeCheck(projectPath: string): Promise<string> {
  const startTime = Date.now();

  try {
    const { stdout, stderr } = await execAsync("pnpm check", {
      cwd: projectPath,
      maxBuffer: 1024 * 1024 * 10,
      timeout: 120000,
    });

    const duration = Date.now() - startTime;
    const output = stdout + stderr;

    const result: BuildTestResult = {
      success: true,
      exitCode: 0,
      duration,
      errors: [],
      warnings: [],
      summary: `Type check passed in ${Math.round(duration / 1000)}s`,
      rawOutput: output,
    };

    return formatBuildResult(result);
  } catch (error) {
    const duration = Date.now() - startTime;
    const execError = error as {
      stdout?: string;
      stderr?: string;
      code?: number;
    };
    const output = (execError.stdout || "") + (execError.stderr || "");
    const tsErrors = parseTypeScriptErrors(output);

    const result: BuildTestResult = {
      success: false,
      exitCode: execError.code || 1,
      duration,
      errors: tsErrors,
      warnings: [],
      summary: `Type check failed with ${tsErrors.length} errors`,
      rawOutput:
        output.length > 5000
          ? output.substring(0, 5000) + "\n...[truncated]"
          : output,
    };

    return formatBuildResult(result);
  }
}

export async function runLint(projectPath: string): Promise<string> {
  const startTime = Date.now();

  try {
    const { stdout, stderr } = await execAsync("pnpm lint", {
      cwd: projectPath,
      maxBuffer: 1024 * 1024 * 10,
      timeout: 120000,
    });

    const duration = Date.now() - startTime;
    const output = stdout + stderr;

    const result: BuildTestResult = {
      success: true,
      exitCode: 0,
      duration,
      errors: [],
      warnings: [],
      summary: `Lint passed in ${Math.round(duration / 1000)}s`,
      rawOutput: output,
    };

    return formatBuildResult(result);
  } catch (error) {
    const duration = Date.now() - startTime;
    const execError = error as {
      stdout?: string;
      stderr?: string;
      code?: number;
    };
    const output = (execError.stdout || "") + (execError.stderr || "");
    const eslintErrors = parseEslintOutput(output);

    const result: BuildTestResult = {
      success: false,
      exitCode: execError.code || 1,
      duration,
      errors: eslintErrors,
      warnings: [],
      summary: `Lint failed with ${eslintErrors.length} errors`,
      rawOutput:
        output.length > 5000
          ? output.substring(0, 5000) + "\n...[truncated]"
          : output,
    };

    return formatBuildResult(result);
  }
}

function formatBuildResult(result: BuildTestResult): string {
  let output = `${result.success ? "✓" : "✗"} ${result.summary}\n`;
  output += `Duration: ${Math.round(result.duration / 1000)}s | Exit code: ${result.exitCode}\n`;

  if (result.errors.length > 0) {
    output += `\nERRORS (${result.errors.length}):\n`;
    for (const err of result.errors.slice(0, 20)) {
      if (err.file) {
        output += `  ${err.file}`;
        if (err.line) output += `:${err.line}`;
        output += ` - ${err.message}\n`;
      } else {
        output += `  ${err.message}\n`;
      }
    }
    if (result.errors.length > 20) {
      output += `  ... and ${result.errors.length - 20} more errors\n`;
    }
  }

  if (result.warnings.length > 0) {
    output += `\nWARNINGS (${result.warnings.length}):\n`;
    for (const warn of result.warnings.slice(0, 10)) {
      output += `  ${warn.file || ""}${warn.line ? `:${warn.line}` : ""} - ${warn.message}\n`;
    }
  }

  output += `\nRAW OUTPUT:\n${result.rawOutput}`;

  return output;
}

export async function startDevServer(
  projectPath: string,
  options?: { port?: number; command?: string }
): Promise<string> {
  const port = options?.port || 5173;
  const command = options?.command || `pnpm dev --port ${port}`;
  const sessionName = `devserver_${port}`;

  const checkExists = await execAsync(
    `tmux has-session -t jarvis_${sessionName} 2>/dev/null && echo "exists" || echo "not_exists"`
  ).catch(() => ({ stdout: "not_exists" }));

  if (checkExists.stdout.trim() === "exists") {
    return `Dev server already running on port ${port}. Session: jarvis_${sessionName}`;
  }

  try {
    await execAsync(
      `tmux new-session -d -s jarvis_${sessionName} -c ${projectPath} "${command}"`
    );

    await new Promise(resolve => setTimeout(resolve, 3000));

    const serverReady = await fetch(`http://localhost:${port}`, {
      signal: AbortSignal.timeout(5000),
    })
      .then(r => r.ok)
      .catch(() => false);

    if (serverReady) {
      return `Dev server started on http://localhost:${port}
Session: jarvis_${sessionName}
Use browser_session_start to test the UI.
Use tmux_output("devserver_${port}") to check server logs.
Use tmux_stop("devserver_${port}") to stop the server.`;
    }

    return `Dev server starting on http://localhost:${port}
Session: jarvis_${sessionName}
Server may still be initializing. Check with tmux_output("devserver_${port}").`;
  } catch (error) {
    return `Error starting dev server: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function checkDevServer(port: number = 5173): Promise<string> {
  try {
    const response = await fetch(`http://localhost:${port}`, {
      signal: AbortSignal.timeout(5000),
    });

    return `Dev server status: ${response.ok ? "RUNNING" : "ERROR"}
URL: http://localhost:${port}
Status: ${response.status} ${response.statusText}`;
  } catch (error) {
    return `Dev server status: NOT RUNNING
URL: http://localhost:${port}
Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function saveBaselineScreenshot(
  sessionId: string,
  name: string
): Promise<string> {
  const session = browserSessions.get(sessionId);
  if (!session) {
    return `Error: No browser session "${sessionId}".`;
  }

  try {
    const baselineDir = path.join(JARVIS_SANDBOX, "baselines");
    await fs.mkdir(baselineDir, { recursive: true });

    const baselinePath = path.join(baselineDir, `${name}.png`);
    await session.page.screenshot({ path: baselinePath, fullPage: false });

    return `Baseline screenshot saved: ${baselinePath}
Use compare_screenshot("${sessionId}", "${name}") to compare against this baseline.`;
  } catch (error) {
    return `Error saving baseline: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function compareScreenshot(
  sessionId: string,
  baselineName: string
): Promise<string> {
  const session = browserSessions.get(sessionId);
  if (!session) {
    return `Error: No browser session "${sessionId}".`;
  }

  try {
    const baselineDir = path.join(JARVIS_SANDBOX, "baselines");
    const baselinePath = path.join(baselineDir, `${baselineName}.png`);

    try {
      await fs.access(baselinePath);
    } catch {
      return `Error: No baseline found at ${baselinePath}. Save one first with save_baseline_screenshot.`;
    }

    const currentPath = path.join(
      JARVIS_SANDBOX,
      `current_${baselineName}_${Date.now()}.png`
    );
    await session.page.screenshot({ path: currentPath, fullPage: false });

    const baselineStats = await fs.stat(baselinePath);
    const currentStats = await fs.stat(currentPath);

    const sizeDiff = Math.abs(baselineStats.size - currentStats.size);
    const sizeRatio = sizeDiff / baselineStats.size;

    const diffPath = path.join(
      JARVIS_SANDBOX,
      `diff_${baselineName}_${Date.now()}.png`
    );

    if (sizeRatio < 0.01) {
      return `VISUAL COMPARISON: LIKELY MATCH
Baseline: ${baselinePath}
Current: ${currentPath}
Size difference: ${sizeDiff} bytes (${(sizeRatio * 100).toFixed(2)}%)

Note: File sizes are nearly identical, suggesting no visual changes.
For pixel-perfect comparison, install pixelmatch: pnpm add pixelmatch pngjs`;
    }

    return `VISUAL COMPARISON: POTENTIAL DIFFERENCES DETECTED
Baseline: ${baselinePath}
Current: ${currentPath}
Size difference: ${sizeDiff} bytes (${(sizeRatio * 100).toFixed(2)}%)

Screenshots saved for manual inspection.
For pixel-perfect diff, install pixelmatch: pnpm add pixelmatch pngjs
Then re-run this comparison.`;
  } catch (error) {
    return `Comparison error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function listBaselines(): Promise<string> {
  try {
    const baselineDir = path.join(JARVIS_SANDBOX, "baselines");

    try {
      await fs.access(baselineDir);
    } catch {
      return "No baselines directory. Save a baseline first with save_baseline_screenshot.";
    }

    const files = await fs.readdir(baselineDir);
    const pngFiles = files.filter(f => f.endsWith(".png"));

    if (pngFiles.length === 0) {
      return "No baseline screenshots found.";
    }

    let result = `Baseline screenshots (${pngFiles.length}):\n`;
    for (const file of pngFiles) {
      const stats = await fs.stat(path.join(baselineDir, file));
      result += `  - ${file.replace(".png", "")} (${Math.round(stats.size / 1024)}KB, ${stats.mtime.toISOString()})\n`;
    }

    return result;
  } catch (error) {
    return `Error listing baselines: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function gitStatus(projectPath: string): Promise<string> {
  try {
    const { stdout } = await execAsync("git status --porcelain -b", {
      cwd: projectPath,
      timeout: 30000,
    });

    if (!stdout.trim()) {
      return "Working tree clean. No changes.";
    }

    const lines = stdout.trim().split("\n");
    const branchLine = lines[0];
    const changes = lines.slice(1);

    let result = `Branch: ${branchLine.replace("## ", "")}\n\n`;

    const staged: string[] = [];
    const unstaged: string[] = [];
    const untracked: string[] = [];

    for (const line of changes) {
      const index = line[0];
      const worktree = line[1];
      const file = line.substring(3);

      if (index === "?" && worktree === "?") {
        untracked.push(file);
      } else if (index !== " " && index !== "?") {
        staged.push(`${index} ${file}`);
      }
      if (worktree !== " " && worktree !== "?") {
        unstaged.push(`${worktree} ${file}`);
      }
    }

    if (staged.length > 0) {
      result += `STAGED (${staged.length}):\n${staged.map(f => `  ${f}`).join("\n")}\n\n`;
    }
    if (unstaged.length > 0) {
      result += `UNSTAGED (${unstaged.length}):\n${unstaged.map(f => `  ${f}`).join("\n")}\n\n`;
    }
    if (untracked.length > 0) {
      result += `UNTRACKED (${untracked.length}):\n${untracked.map(f => `  ${f}`).join("\n")}\n`;
    }

    return result;
  } catch (error) {
    return `Git error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function gitDiff(
  projectPath: string,
  options?: { staged?: boolean; file?: string }
): Promise<string> {
  try {
    let cmd = "git diff";
    if (options?.staged) cmd += " --staged";
    if (options?.file) cmd += ` -- ${options.file}`;
    cmd += " --stat";

    const { stdout: statOutput } = await execAsync(cmd, {
      cwd: projectPath,
      timeout: 30000,
    });

    let detailCmd = cmd.replace(" --stat", "");
    const { stdout: diffOutput } = await execAsync(detailCmd, {
      cwd: projectPath,
      timeout: 30000,
      maxBuffer: 1024 * 1024 * 5,
    });

    let result = `DIFF SUMMARY${options?.staged ? " (staged)" : ""}:\n${statOutput}\n`;

    if (diffOutput.length > 10000) {
      result += `\nDETAILED DIFF (truncated):\n${diffOutput.substring(0, 10000)}\n...[truncated]`;
    } else if (diffOutput) {
      result += `\nDETAILED DIFF:\n${diffOutput}`;
    }

    return result || "No differences found.";
  } catch (error) {
    return `Git error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function gitBranch(
  projectPath: string,
  options?: { create?: string; checkout?: string; delete?: string }
): Promise<string> {
  try {
    if (options?.create) {
      await execAsync(`git checkout -b ${options.create}`, {
        cwd: projectPath,
        timeout: 30000,
      });
      return `Created and switched to branch: ${options.create}`;
    }

    if (options?.checkout) {
      await execAsync(`git checkout ${options.checkout}`, {
        cwd: projectPath,
        timeout: 30000,
      });
      return `Switched to branch: ${options.checkout}`;
    }

    if (options?.delete) {
      await execAsync(`git branch -d ${options.delete}`, {
        cwd: projectPath,
        timeout: 30000,
      });
      return `Deleted branch: ${options.delete}`;
    }

    const { stdout } = await execAsync("git branch -vv", {
      cwd: projectPath,
      timeout: 30000,
    });

    return `BRANCHES:\n${stdout}`;
  } catch (error) {
    return `Git error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function gitCommit(
  projectPath: string,
  message: string,
  options?: { addAll?: boolean; files?: string[] }
): Promise<string> {
  try {
    if (options?.addAll) {
      await execAsync("git add -A", { cwd: projectPath, timeout: 30000 });
    } else if (options?.files && options.files.length > 0) {
      await execAsync(`git add ${options.files.join(" ")}`, {
        cwd: projectPath,
        timeout: 30000,
      });
    }

    const { stdout } = await execAsync(
      `git commit -m "${message.replace(/"/g, '\\"')}"`,
      {
        cwd: projectPath,
        timeout: 30000,
      }
    );

    return `Commit created:\n${stdout}`;
  } catch (error) {
    const execError = error as { stdout?: string; stderr?: string };
    if (execError.stdout?.includes("nothing to commit")) {
      return "Nothing to commit. Working tree clean.";
    }
    return `Git error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function gitLog(
  projectPath: string,
  options?: { count?: number; oneline?: boolean }
): Promise<string> {
  try {
    const count = options?.count || 10;
    const format = options?.oneline
      ? "--oneline"
      : "--pretty=format:'%h %s (%cr) <%an>'";

    const { stdout } = await execAsync(`git log -${count} ${format}`, {
      cwd: projectPath,
      timeout: 30000,
    });

    return `RECENT COMMITS:\n${stdout}`;
  } catch (error) {
    return `Git error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function gitPush(
  projectPath: string,
  options?: { setUpstream?: string; force?: boolean }
): Promise<string> {
  try {
    let cmd = "git push";
    if (options?.setUpstream) {
      cmd += ` -u origin ${options.setUpstream}`;
    }
    if (options?.force) {
      cmd += " --force-with-lease";
    }

    const { stdout, stderr } = await execAsync(cmd, {
      cwd: projectPath,
      timeout: 60000,
    });

    return `Push successful:\n${stdout}\n${stderr}`;
  } catch (error) {
    return `Git error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function gitPull(projectPath: string): Promise<string> {
  try {
    const { stdout, stderr } = await execAsync("git pull", {
      cwd: projectPath,
      timeout: 60000,
    });

    return `Pull successful:\n${stdout}\n${stderr}`;
  } catch (error) {
    return `Git error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function gitStash(
  projectPath: string,
  options?: { pop?: boolean; list?: boolean; message?: string }
): Promise<string> {
  try {
    if (options?.list) {
      const { stdout } = await execAsync("git stash list", {
        cwd: projectPath,
        timeout: 30000,
      });
      return stdout || "No stashes found.";
    }

    if (options?.pop) {
      const { stdout } = await execAsync("git stash pop", {
        cwd: projectPath,
        timeout: 30000,
      });
      return `Stash popped:\n${stdout}`;
    }

    let cmd = "git stash";
    if (options?.message) {
      cmd += ` push -m "${options.message.replace(/"/g, '\\"')}"`;
    }

    const { stdout } = await execAsync(cmd, {
      cwd: projectPath,
      timeout: 30000,
    });

    return `Stashed changes:\n${stdout}`;
  } catch (error) {
    return `Git error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function gitClone(
  repoUrl: string,
  outputPath: string,
  options?: { branch?: string; depth?: number }
): Promise<string> {
  try {
    let cmd = `git clone "${repoUrl}" "${outputPath}"`;
    if (options?.branch) {
      cmd = `git clone -b "${options.branch}" "${repoUrl}" "${outputPath}"`;
    }
    if (options?.depth) {
      cmd += ` --depth ${options.depth}`;
    }

    const { stdout, stderr } = await execAsync(cmd, { timeout: 300000 });
    return `Repository cloned successfully to: ${outputPath}\n${stdout}\n${stderr}`;
  } catch (error) {
    return `Git clone error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function gitInit(
  projectPath: string,
  options?: { initialBranch?: string }
): Promise<string> {
  try {
    let cmd = "git init";
    if (options?.initialBranch) {
      cmd += ` -b "${options.initialBranch}"`;
    }

    const { stdout } = await execAsync(cmd, {
      cwd: projectPath,
      timeout: 30000,
    });

    return `Git repository initialized:\n${stdout}`;
  } catch (error) {
    return `Git init error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function gitCreatePR(
  projectPath: string,
  title: string,
  body: string,
  options?: { base?: string; head?: string; draft?: boolean }
): Promise<string> {
  try {
    let cmd = `gh pr create --title "${title.replace(/"/g, '\\"')}" --body "${body.replace(/"/g, '\\"')}"`;
    if (options?.base) cmd += ` --base "${options.base}"`;
    if (options?.head) cmd += ` --head "${options.head}"`;
    if (options?.draft) cmd += " --draft";

    const { stdout, stderr } = await execAsync(cmd, {
      cwd: projectPath,
      timeout: 60000,
    });

    return `Pull request created:\n${stdout}\n${stderr}`;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("gh: command not found")) {
      return "Error: GitHub CLI (gh) not installed. Install with: brew install gh";
    }
    return `PR creation error: ${msg}`;
  }
}

export async function npmAudit(projectPath: string): Promise<string> {
  const startTime = Date.now();

  try {
    const { stdout, stderr } = await execAsync("pnpm audit --json", {
      cwd: projectPath,
      maxBuffer: 1024 * 1024 * 5,
      timeout: 120000,
    });

    const duration = Date.now() - startTime;

    try {
      const auditData = JSON.parse(stdout);
      const advisories = auditData.advisories || {};
      const metadata = auditData.metadata || {};

      let result = `NPM SECURITY AUDIT (${Math.round(duration / 1000)}s)\n`;
      result += `=`.repeat(50) + "\n\n";

      const vulnCount = Object.keys(advisories).length;
      if (vulnCount === 0) {
        result += "No vulnerabilities found.\n";
        if (metadata.dependencies) {
          result += `\nScanned ${metadata.dependencies} dependencies.\n`;
        }
        return result;
      }

      result += `VULNERABILITIES FOUND: ${vulnCount}\n\n`;

      const bySeverity: Record<string, number> = {};
      for (const adv of Object.values(advisories) as Array<{
        severity: string;
        title: string;
        module_name: string;
        patched_versions: string;
        recommendation: string;
      }>) {
        bySeverity[adv.severity] = (bySeverity[adv.severity] || 0) + 1;
      }

      result += "BY SEVERITY:\n";
      for (const [sev, count] of Object.entries(bySeverity).sort()) {
        result += `  ${sev.toUpperCase()}: ${count}\n`;
      }
      result += "\n";

      result += "DETAILS:\n";
      let shown = 0;
      for (const [, adv] of Object.entries(advisories) as Array<
        [
          string,
          {
            severity: string;
            title: string;
            module_name: string;
            patched_versions: string;
            recommendation: string;
          },
        ]
      >) {
        if (shown >= 10) {
          result += `\n... and ${vulnCount - 10} more vulnerabilities\n`;
          break;
        }
        result += `\n[${adv.severity.toUpperCase()}] ${adv.title}\n`;
        result += `  Package: ${adv.module_name}\n`;
        result += `  Patched: ${adv.patched_versions || "No patch available"}\n`;
        if (adv.recommendation) {
          result += `  Action: ${adv.recommendation}\n`;
        }
        shown++;
      }

      return result;
    } catch {
      return `NPM Audit Output:\n${stdout}\n${stderr}`;
    }
  } catch (error) {
    const execError = error as { stdout?: string; stderr?: string };
    const output = (execError.stdout || "") + (execError.stderr || "");

    if (output.includes("No dependencies found")) {
      return "No dependencies to audit.";
    }

    return `NPM Audit Error: ${error instanceof Error ? error.message : String(error)}\n\nOutput:\n${output.substring(0, 2000)}`;
  }
}

export async function securityAnalysis(projectPath: string): Promise<string> {
  const results: string[] = [];

  results.push("SECURITY ANALYSIS REPORT");
  results.push("=".repeat(50) + "\n");

  const auditResult = await npmAudit(projectPath);
  results.push("1. NPM DEPENDENCY AUDIT");
  results.push("-".repeat(30));
  results.push(auditResult);
  results.push("");

  try {
    const packageJsonPath = path.join(projectPath, "package.json");
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf-8"));
    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    results.push("2. DEPENDENCY OVERVIEW");
    results.push("-".repeat(30));
    results.push(`Total packages: ${Object.keys(deps).length}`);

    const outdatedCheck = await execAsync("pnpm outdated --json", {
      cwd: projectPath,
      timeout: 60000,
    }).catch(() => ({ stdout: "{}" }));

    try {
      const outdated = JSON.parse(outdatedCheck.stdout);
      const outdatedCount = Object.keys(outdated).length;
      if (outdatedCount > 0) {
        results.push(`Outdated packages: ${outdatedCount}`);
      }
    } catch {
      results.push("Could not check for outdated packages.");
    }
  } catch (e) {
    results.push(
      `Could not read package.json: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  results.push("");
  results.push("3. SECURITY RECOMMENDATIONS");
  results.push("-".repeat(30));
  results.push("- Run 'pnpm audit fix' to automatically fix vulnerabilities");
  results.push("- Update outdated packages regularly");
  results.push("- Review any high/critical vulnerabilities immediately");

  return results.join("\n");
}

interface DevServerInfo {
  sessionName: string;
  port?: number;
  projectPath: string;
  startedAt: number;
  status: "starting" | "running" | "stopped" | "error";
  url?: string;
}

const devServers = new Map<string, DevServerInfo>();

export function listDevServers(): string {
  if (devServers.size === 0) {
    return "No dev servers currently running.";
  }

  const servers = Array.from(devServers.entries()).map(([path, info]) => {
    return `- ${path}
    Port: ${info.port || "detecting..."}
    URL: ${info.url || "N/A"}
    Status: ${info.status}
    Started: ${new Date(info.startedAt).toLocaleString()}`;
  });

  return `Running dev servers (${devServers.size}):\n\n${servers.join("\n\n")}`;
}

export function getDevServerInfo(projectPath: string): DevServerInfo | null {
  const absPath = path.resolve(projectPath);
  return devServers.get(absPath) || null;
}

export function getAllDevServers(): DevServerInfo[] {
  return Array.from(devServers.values());
}

async function detectPortFromOutput(output: string): Promise<number | null> {
  const portPatterns = [
    /localhost:(\d+)/i,
    /127\.0\.0\.1:(\d+)/i,
    /0\.0\.0\.0:(\d+)/i,
    /port\s*:?\s*(\d+)/i,
    /running\s+on\s+.*:(\d+)/i,
    /listening\s+on\s+.*:(\d+)/i,
    /http:\/\/[^:]+:(\d+)/i,
  ];

  for (const pattern of portPatterns) {
    const match = output.match(pattern);
    if (match) {
      const port = parseInt(match[1], 10);
      if (port >= 1024 && port <= 65535) {
        return port;
      }
    }
  }
  return null;
}

async function scaffoldProjectTool(
  projectName: string,
  projectType: string,
  outputPath: string,
  database?: string,
  authentication?: string,
  features?: string[]
): Promise<string> {
  const validTypes = [
    "react",
    "nextjs",
    "vue",
    "svelte",
    "express",
    "fastapi",
    "rails",
  ];
  if (!validTypes.includes(projectType)) {
    return `Error: Invalid project type. Must be one of: ${validTypes.join(", ")}`;
  }

  const config: ScaffoldConfig = {
    projectName,
    projectType: projectType as ScaffoldConfig["projectType"],
    outputPath: outputPath || "/tmp/jarvis-projects",
    database: database as ScaffoldConfig["database"],
    authentication: authentication as ScaffoldConfig["authentication"],
    features,
  };

  const result = await scaffoldProject(config);

  if (!result.success) {
    return `Error creating project: ${result.error}`;
  }

  return `Project "${projectName}" created successfully!

Location: ${result.projectPath}
Files created: ${result.filesCreated.length}

Files:
${result.filesCreated.map(f => `  - ${f}`).join("\n")}

Next steps:
1. cd ${result.projectPath}
2. npm install (or pnpm install)
3. npm run dev`;
}

async function startDevServerTool(
  projectPath: string,
  command?: string
): Promise<string> {
  const absPath = path.resolve(projectPath);

  if (devServers.has(absPath)) {
    const existing = devServers.get(absPath)!;
    return `Dev server already running for this project.
Session: ${existing.sessionName}
Port: ${existing.port || "detecting..."}
URL: ${existing.url || "N/A"}
Status: ${existing.status}`;
  }

  const sessionName = `jarvis-dev-${Date.now()}`;
  const devCommand = command || "npm run dev";

  try {
    await execAsync(
      `tmux new-session -d -s ${sessionName} -c "${absPath}" "${devCommand}"`,
      {
        timeout: 10000,
      }
    );

    const serverInfo: DevServerInfo = {
      sessionName,
      projectPath: absPath,
      startedAt: Date.now(),
      status: "starting",
    };
    devServers.set(absPath, serverInfo);

    await new Promise(resolve => setTimeout(resolve, 3000));

    const { stdout: output } = await execAsync(
      `tmux capture-pane -t ${sessionName} -p`,
      { timeout: 5000 }
    ).catch(() => ({ stdout: "" }));

    const detectedPort = await detectPortFromOutput(output);
    if (detectedPort) {
      serverInfo.port = detectedPort;
      serverInfo.url = `http://localhost:${detectedPort}`;
      serverInfo.status = "running";
    } else {
      serverInfo.status = output ? "running" : "starting";
    }

    return `Dev server started!

Session: ${sessionName}
Project: ${absPath}
Command: ${devCommand}
Port: ${serverInfo.port || "detecting..."}
URL: ${serverInfo.url || "Check output for URL"}
Status: ${serverInfo.status}

Initial output:
${output.slice(-1000) || "(starting...)"}

Use get_dev_server_output to check status.
Use list_dev_servers to see all running servers.
Use stop_dev_server to stop when done.`;
  } catch (error) {
    return `Error starting dev server: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function stopDevServerTool(projectPath: string): Promise<string> {
  const absPath = path.resolve(projectPath);
  const server = devServers.get(absPath);

  if (!server) {
    return `No dev server found for: ${absPath}`;
  }

  try {
    await execAsync(`tmux kill-session -t ${server.sessionName}`, {
      timeout: 5000,
    });
    devServers.delete(absPath);
    return `Dev server stopped for: ${absPath}`;
  } catch (error) {
    devServers.delete(absPath);
    return `Server session ended (may have already stopped): ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function getDevServerOutputTool(projectPath: string): Promise<string> {
  const absPath = path.resolve(projectPath);
  const server = devServers.get(absPath);

  if (!server) {
    return `No dev server found for: ${absPath}`;
  }

  try {
    const { stdout } = await execAsync(
      `tmux capture-pane -t ${server.sessionName} -p`,
      { timeout: 5000 }
    );
    return `Dev server output for ${absPath}:

${stdout.slice(-2000) || "(no output)"}`;
  } catch (error) {
    return `Error getting output: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function installDependenciesTool(
  projectPath: string,
  packageManager?: string
): Promise<string> {
  const absPath = path.resolve(projectPath);
  const pm = packageManager || "pnpm";
  const validPMs = ["npm", "pnpm", "yarn", "bun"];

  if (!validPMs.includes(pm)) {
    return `Invalid package manager. Use: ${validPMs.join(", ")}`;
  }

  try {
    const { stdout, stderr } = await execAsync(`${pm} install`, {
      cwd: absPath,
      timeout: 300000,
    });

    return `Dependencies installed successfully!

${stdout}
${stderr ? `Warnings:\n${stderr}` : ""}`;
  } catch (error) {
    return `Error installing dependencies: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// ============================================================================
// DEPLOYMENT TOOLS
// ============================================================================

/**
 * Deploy to Vercel using the Vercel CLI
 */
export async function deployVercel(
  projectPath: string,
  options?: {
    prod?: boolean;
    name?: string;
    env?: Record<string, string>;
  }
): Promise<string> {
  const absPath = path.resolve(projectPath);

  try {
    // Check if vercel CLI is available
    const { stdout: vercelVersion } = await execAsync("vercel --version", {
      timeout: 10000,
    }).catch(() => ({ stdout: "" }));

    if (!vercelVersion) {
      return `Error: Vercel CLI not installed. Install with: npm i -g vercel`;
    }

    // Build the deploy command
    let cmd = "vercel";
    if (options?.prod) {
      cmd += " --prod";
    }
    if (options?.name) {
      cmd += ` --name ${options.name}`;
    }
    cmd += " --yes"; // Auto-confirm prompts

    // Set environment variables if provided
    const envVars: Record<string, string> = { ...process.env } as Record<
      string,
      string
    >;
    if (options?.env) {
      for (const [key, value] of Object.entries(options.env)) {
        envVars[key] = value;
      }
    }

    const { stdout, stderr } = await execAsync(cmd, {
      cwd: absPath,
      timeout: 300000, // 5 minutes
      env: envVars,
    });

    // Extract deployment URL from output
    const urlMatch = stdout.match(/(https:\/\/[^\s]+\.vercel\.app)/);
    const deployUrl = urlMatch ? urlMatch[1] : "URL not found in output";

    return `Vercel deployment ${options?.prod ? "(production)" : "(preview)"} completed!

Deployment URL: ${deployUrl}

Output:
${stdout}
${stderr ? `\nWarnings:\n${stderr}` : ""}`;
  } catch (error) {
    const execError = error as { stdout?: string; stderr?: string };
    return `Vercel deployment error: ${error instanceof Error ? error.message : String(error)}
    
${execError.stdout || ""}
${execError.stderr || ""}`;
  }
}

/**
 * Deploy to Railway using the Railway CLI
 */
export async function deployRailway(
  projectPath: string,
  options?: {
    service?: string;
    environment?: string;
  }
): Promise<string> {
  const absPath = path.resolve(projectPath);

  try {
    // Check if railway CLI is available
    const { stdout: railwayVersion } = await execAsync("railway --version", {
      timeout: 10000,
    }).catch(() => ({ stdout: "" }));

    if (!railwayVersion) {
      return `Error: Railway CLI not installed. Install with: npm i -g @railway/cli`;
    }

    // Build the deploy command
    let cmd = "railway up";
    if (options?.service) {
      cmd += ` --service ${options.service}`;
    }
    if (options?.environment) {
      cmd += ` --environment ${options.environment}`;
    }
    cmd += " --detach"; // Don't wait for logs

    const { stdout, stderr } = await execAsync(cmd, {
      cwd: absPath,
      timeout: 300000, // 5 minutes
    });

    return `Railway deployment initiated!

${stdout}
${stderr ? `\nInfo:\n${stderr}` : ""}

Use 'railway logs' to monitor the deployment.`;
  } catch (error) {
    const execError = error as { stdout?: string; stderr?: string };
    return `Railway deployment error: ${error instanceof Error ? error.message : String(error)}
    
${execError.stdout || ""}
${execError.stderr || ""}`;
  }
}

/**
 * Build Docker image for a project
 */
export async function dockerBuild(
  projectPath: string,
  options?: {
    tag?: string;
    dockerfile?: string;
    buildArgs?: Record<string, string>;
    platform?: string;
  }
): Promise<string> {
  const absPath = path.resolve(projectPath);

  try {
    // Check if docker is available
    const { stdout: dockerVersion } = await execAsync("docker --version", {
      timeout: 10000,
    }).catch(() => ({ stdout: "" }));

    if (!dockerVersion) {
      return `Error: Docker not installed or not running.`;
    }

    // Build the docker build command
    const projectName = path
      .basename(absPath)
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-");
    const tag = options?.tag || `${projectName}:latest`;
    let cmd = `docker build -t ${tag}`;

    if (options?.dockerfile) {
      cmd += ` -f ${options.dockerfile}`;
    }
    if (options?.platform) {
      cmd += ` --platform ${options.platform}`;
    }
    if (options?.buildArgs) {
      for (const [key, value] of Object.entries(options.buildArgs)) {
        cmd += ` --build-arg ${key}=${value}`;
      }
    }
    cmd += ` ${absPath}`;

    const { stdout, stderr } = await execAsync(cmd, {
      timeout: 600000, // 10 minutes
      maxBuffer: 1024 * 1024 * 10, // 10MB
    });

    return `Docker image built successfully!

Image: ${tag}

${stdout.slice(-3000)}
${stderr ? `\nBuild output:\n${stderr.slice(-1000)}` : ""}

Next steps:
- Run locally: docker run -p 3000:3000 ${tag}
- Push to registry: docker push ${tag}`;
  } catch (error) {
    const execError = error as { stdout?: string; stderr?: string };
    return `Docker build error: ${error instanceof Error ? error.message : String(error)}
    
${(execError.stdout || "").slice(-2000)}
${(execError.stderr || "").slice(-2000)}`;
  }
}

/**
 * Push Docker image to a registry
 */
export async function dockerPush(
  imageName: string,
  options?: {
    registry?: string;
  }
): Promise<string> {
  try {
    let fullImageName = imageName;
    if (options?.registry) {
      const imageTag = imageName.includes(":")
        ? imageName
        : `${imageName}:latest`;
      fullImageName = `${options.registry}/${imageTag}`;

      // Tag the image for the registry
      await execAsync(`docker tag ${imageName} ${fullImageName}`, {
        timeout: 30000,
      });
    }

    const { stdout, stderr } = await execAsync(`docker push ${fullImageName}`, {
      timeout: 600000, // 10 minutes
    });

    return `Docker image pushed successfully!

Image: ${fullImageName}

${stdout}
${stderr ? `\nInfo:\n${stderr}` : ""}`;
  } catch (error) {
    return `Docker push error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Generate a Dockerfile for a project based on its type
 */
export async function generateDockerfile(
  projectPath: string,
  options?: {
    projectType?: "node" | "python" | "static";
    port?: number;
  }
): Promise<string> {
  const absPath = path.resolve(projectPath);

  try {
    // Detect project type if not specified
    let projectType = options?.projectType;
    if (!projectType) {
      const packageJsonPath = path.join(absPath, "package.json");
      const requirementsTxtPath = path.join(absPath, "requirements.txt");
      const indexHtmlPath = path.join(absPath, "index.html");

      try {
        await fs.access(packageJsonPath);
        projectType = "node";
      } catch {
        try {
          await fs.access(requirementsTxtPath);
          projectType = "python";
        } catch {
          try {
            await fs.access(indexHtmlPath);
            projectType = "static";
          } catch {
            projectType = "node"; // Default to node
          }
        }
      }
    }

    const port = options?.port || 3000;
    let dockerfileContent = "";

    switch (projectType) {
      case "node":
        dockerfileContent = `# Node.js Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY pnpm-lock.yaml* ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy source and build
COPY . .
RUN pnpm build

# Production image
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy built assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE ${port}

CMD ["node", "dist/index.js"]
`;
        break;

      case "python":
        dockerfileContent = `# Python Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

EXPOSE ${port}

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "${port}"]
`;
        break;

      case "static":
        dockerfileContent = `# Static site Dockerfile
FROM nginx:alpine

# Copy static files
COPY . /usr/share/nginx/html

# Copy nginx config if exists
COPY nginx.conf /etc/nginx/conf.d/default.conf 2>/dev/null || true

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
`;
        break;
    }

    const dockerfilePath = path.join(absPath, "Dockerfile");
    await fs.writeFile(dockerfilePath, dockerfileContent, "utf-8");

    // Also generate .dockerignore
    const dockerignoreContent = `node_modules
.git
.gitignore
*.md
.env*
.vscode
.idea
dist
build
*.log
`;
    await fs.writeFile(
      path.join(absPath, ".dockerignore"),
      dockerignoreContent,
      "utf-8"
    );

    return `Dockerfile generated for ${projectType} project!

Files created:
- Dockerfile
- .dockerignore

Detected project type: ${projectType}
Configured port: ${port}

Next steps:
1. Review and customize the Dockerfile if needed
2. Build: docker build -t your-app .
3. Run: docker run -p ${port}:${port} your-app`;
  } catch (error) {
    return `Error generating Dockerfile: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Docker Compose operations
 */
export async function dockerCompose(
  projectPath: string,
  operation: "up" | "down" | "logs" | "ps" | "build",
  options?: {
    detach?: boolean;
    services?: string[];
    follow?: boolean;
  }
): Promise<string> {
  const absPath = path.resolve(projectPath);

  try {
    let cmd = "docker compose";

    switch (operation) {
      case "up":
        cmd += " up";
        if (options?.detach !== false) cmd += " -d";
        if (options?.services?.length) cmd += ` ${options.services.join(" ")}`;
        break;
      case "down":
        cmd += " down";
        break;
      case "logs":
        cmd += " logs";
        if (options?.follow) cmd += " -f";
        if (options?.services?.length) cmd += ` ${options.services.join(" ")}`;
        break;
      case "ps":
        cmd += " ps";
        break;
      case "build":
        cmd += " build";
        if (options?.services?.length) cmd += ` ${options.services.join(" ")}`;
        break;
    }

    const { stdout, stderr } = await execAsync(cmd, {
      cwd: absPath,
      timeout: 300000,
      maxBuffer: 1024 * 1024 * 5,
    });

    return `Docker Compose ${operation} completed!

${stdout}
${stderr ? `\nInfo:\n${stderr}` : ""}`;
  } catch (error) {
    return `Docker Compose error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Check deployment status/health
 */
export async function checkDeploymentHealth(
  url: string,
  options?: {
    timeout?: number;
    expectedStatus?: number;
  }
): Promise<string> {
  const timeout = options?.timeout || 10000;
  const expectedStatus = options?.expectedStatus || 200;

  try {
    const startTime = Date.now();
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeout),
    });
    const duration = Date.now() - startTime;

    const statusOk = response.status === expectedStatus;

    return `Deployment Health Check: ${statusOk ? "HEALTHY" : "UNHEALTHY"}

URL: ${url}
Status: ${response.status} ${response.statusText}
Expected: ${expectedStatus}
Response time: ${duration}ms

Headers:
${Array.from(response.headers.entries())
  .slice(0, 10)
  .map(([k, v]) => `  ${k}: ${v}`)
  .join("\n")}`;
  } catch (error) {
    return `Deployment Health Check: FAILED

URL: ${url}
Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function createEventTrigger(
  userId: number,
  name: string,
  triggerType: "webhook" | "cron" | "file_change",
  config: {
    webhookPath?: string;
    cronExpression?: string;
    watchPath?: string;
    eventTypes?: string[];
  },
  actionPrompt: string
): Promise<string> {
  try {
    if (triggerType === "webhook") {
      const endpoint = await webhookHandler.createEndpoint(userId, name, {
        description: `JARVIS trigger: ${name}`,
      });

      const trigger = await webhookHandler.createWebhookTrigger(
        userId,
        endpoint.id,
        name,
        { description: `Trigger for: ${actionPrompt.slice(0, 50)}` }
      );

      await eventExecutor.createAction(
        trigger.id,
        `${name}_action`,
        "jarvis_task",
        {
          prompt: actionPrompt,
        }
      );

      return `Event trigger created successfully!
Type: webhook
Endpoint: /api/webhooks/${endpoint.path}
Secret: ${endpoint.secret}
Events: ${(config.eventTypes || ["push", "pull_request"]).join(", ")}
Action: Will run JARVIS with prompt: "${actionPrompt.slice(0, 100)}..."`;
    }

    return `Trigger type "${triggerType}" creation not yet implemented. Use webhook for now.`;
  } catch (error) {
    return `Failed to create event trigger: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function defineMacro(
  userId: number,
  name: string,
  description: string,
  triggerPatterns: string[],
  steps: Array<{ action: string; tool: string; description?: string }>
): Promise<string> {
  try {
    const memoryService = getMemoryService();

    const procedureId = await memoryService.createProceduralMemory({
      userId,
      name,
      description,
      triggerConditions: triggerPatterns,
      prerequisites: [],
      steps: steps.map((s, i) => ({
        order: i + 1,
        action: s.action,
        description: s.description || s.action,
        toolName: s.tool,
      })),
      postConditions: [],
      errorHandlers: [],
      successRate: 100,
      executionCount: 0,
      successCount: 0,
      avgExecutionTimeMs: 0,
      isActive: true,
    });

    return `Macro "${name}" created successfully!
ID: ${procedureId}
Description: ${description}
Triggers: ${triggerPatterns.join(", ")}
Steps: ${steps.length}
${steps.map((s, i) => `  ${i + 1}. ${s.action} (${s.tool})`).join("\n")}

This macro will be suggested when tasks match the trigger patterns.`;
  } catch (error) {
    return `Failed to create macro: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function executeMacro(
  userId: number,
  macroNameOrId: string
): Promise<string> {
  try {
    const memoryService = getMemoryService();
    let procedure = await findMatchingProcedure(macroNameOrId, userId);

    if (!procedure) {
      const searchResults = await memoryService.searchProceduralMemories(
        macroNameOrId,
        { userId }
      );
      procedure = searchResults[0]?.memory || null;
    }

    if (!procedure) {
      return `Macro "${macroNameOrId}" not found. Use list_macros to see available macros.`;
    }

    const results: string[] = [];
    results.push(`Executing macro: ${procedure.name}`);

    for (const step of procedure.steps || []) {
      if (!step.toolName) continue;

      try {
        const result = await executeTool(step.toolName, { userId });
        results.push(`Step ${step.order}: ${step.action} - SUCCESS`);
        results.push(`  Output: ${result.slice(0, 200)}...`);
      } catch (error) {
        results.push(`Step ${step.order}: ${step.action} - FAILED`);
        results.push(
          `  Error: ${error instanceof Error ? error.message : String(error)}`
        );
        break;
      }
    }

    if (procedure.id) {
      await memoryService.recordProcedureExecution(procedure.id, true, 0);
    }

    return results.join("\n");
  } catch (error) {
    return `Failed to execute macro: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function githubApi(
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET",
  body?: Record<string, unknown>
): Promise<string> {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      return "Error: GITHUB_TOKEN environment variable not set";
    }

    const url = endpoint.startsWith("https://")
      ? endpoint
      : `https://api.github.com${endpoint.startsWith("/") ? endpoint : "/" + endpoint}`;

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(body && { "Content-Type": "application/json" }),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.text();
    let parsed;
    try {
      parsed = JSON.parse(data);
    } catch {
      parsed = data;
    }

    if (!response.ok) {
      return `GitHub API Error (${response.status}): ${JSON.stringify(parsed)}`;
    }

    return JSON.stringify(parsed, null, 2).slice(0, 5000);
  } catch (error) {
    return `GitHub API error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function sendSlackMessage(
  channel: string,
  message: string,
  options?: { username?: string; iconEmoji?: string }
): Promise<string> {
  try {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      return "Error: SLACK_WEBHOOK_URL environment variable not set";
    }

    const payload = {
      channel: channel.startsWith("#") ? channel : `#${channel}`,
      text: message,
      username: options?.username || "JARVIS",
      icon_emoji: options?.iconEmoji || ":robot_face:",
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      return `Slack error: ${text}`;
    }

    return `Message sent to ${channel} successfully`;
  } catch (error) {
    return `Slack error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function sendEmail(
  to: string,
  subject: string,
  body: string,
  options?: { html?: boolean }
): Promise<string> {
  try {
    const smtpUrl = process.env.SMTP_URL;
    const fromEmail = process.env.SMTP_FROM || "jarvis@rasputin.local";

    if (!smtpUrl) {
      const sendgridKey = process.env.SENDGRID_API_KEY;
      if (sendgridKey) {
        const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sendgridKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: to }] }],
            from: { email: fromEmail },
            subject,
            content: [
              {
                type: options?.html ? "text/html" : "text/plain",
                value: body,
              },
            ],
          }),
        });

        if (!response.ok) {
          const text = await response.text();
          return `SendGrid error: ${text}`;
        }

        return `Email sent to ${to} successfully via SendGrid`;
      }

      return "Error: No email provider configured. Set SMTP_URL or SENDGRID_API_KEY";
    }

    return `Email would be sent to ${to} (SMTP sending not yet implemented)`;
  } catch (error) {
    return `Email error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function createGitHubIssue(
  repo: string,
  title: string,
  body: string,
  options?: { labels?: string[]; assignees?: string[] }
): Promise<string> {
  try {
    const result = await githubApi(`/repos/${repo}/issues`, "POST", {
      title,
      body,
      labels: options?.labels,
      assignees: options?.assignees,
    });

    const parsed = JSON.parse(result);
    if (parsed.html_url) {
      return `Issue created: ${parsed.html_url}`;
    }
    return result;
  } catch (error) {
    return `Failed to create issue: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function createGitHubPR(
  repo: string,
  title: string,
  body: string,
  head: string,
  base: string = "main"
): Promise<string> {
  try {
    const result = await githubApi(`/repos/${repo}/pulls`, "POST", {
      title,
      body,
      head,
      base,
    });

    const parsed = JSON.parse(result);
    if (parsed.html_url) {
      return `PR created: ${parsed.html_url}`;
    }
    return result;
  } catch (error) {
    return `Failed to create PR: ${error instanceof Error ? error.message : String(error)}`;
  }
}

interface OperationConfidence {
  tool: string;
  operation: string;
  confidence: number;
  factors: string[];
  verificationRequired: boolean;
  suggestedVerification?: string;
}

const HIGH_RISK_TOOLS = new Set([
  "write_file",
  "execute_shell",
  "execute_python",
  "ssh_execute",
  "ssh_write_file",
  "git_commit",
  "git_push",
  "deploy_vercel",
  "deploy_railway",
  "docker_push",
  "send_email",
  "create_github_pr",
]);

const VERIFICATION_MAP: Record<string, string> = {
  write_file: "read_file",
  git_commit: "git_status",
  git_push: "git_log",
  deploy_vercel: "check_deployment_health",
  deploy_railway: "check_deployment_health",
  ssh_write_file: "ssh_read_file",
  create_github_issue: "github_api",
  create_github_pr: "github_api",
};

export function assessOperationConfidence(
  toolName: string,
  input: Record<string, unknown>,
  previousResults: string[]
): OperationConfidence {
  const factors: string[] = [];
  let confidence = 80;

  if (HIGH_RISK_TOOLS.has(toolName)) {
    confidence -= 20;
    factors.push("High-risk operation");
  }

  if (previousResults.some(r => r.toLowerCase().includes("error"))) {
    confidence -= 15;
    factors.push("Previous errors in session");
  }

  if (!input || Object.keys(input).length === 0) {
    confidence -= 10;
    factors.push("Missing input parameters");
  }

  if (toolName.startsWith("ssh_") || toolName.includes("remote")) {
    confidence -= 10;
    factors.push("Remote operation");
  }

  if (toolName.includes("delete") || toolName.includes("remove")) {
    confidence -= 25;
    factors.push("Destructive operation");
  }

  confidence = Math.max(0, Math.min(100, confidence));

  return {
    tool: toolName,
    operation: `${toolName}(${JSON.stringify(input).slice(0, 50)}...)`,
    confidence,
    factors,
    verificationRequired: confidence < 60 || HIGH_RISK_TOOLS.has(toolName),
    suggestedVerification: VERIFICATION_MAP[toolName],
  };
}

export async function selfVerify(
  operation: string,
  expectedOutcome: string,
  actualResult: string
): Promise<string> {
  const checks: string[] = [];
  let passed = 0;
  let failed = 0;

  if (actualResult.toLowerCase().includes("error")) {
    checks.push("FAIL: Result contains error indicators");
    failed++;
  } else {
    checks.push("PASS: No error indicators in result");
    passed++;
  }

  if (
    actualResult.toLowerCase().includes("success") ||
    actualResult.toLowerCase().includes("completed") ||
    actualResult.toLowerCase().includes("created")
  ) {
    checks.push("PASS: Success indicators present");
    passed++;
  }

  if (actualResult.length < 10) {
    checks.push("WARN: Very short response - may indicate failure");
  }

  const keywordsToCheck = expectedOutcome
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 4);
  const matchedKeywords = keywordsToCheck.filter(kw =>
    actualResult.toLowerCase().includes(kw)
  );
  if (matchedKeywords.length > keywordsToCheck.length / 2) {
    checks.push(
      `PASS: Expected keywords found (${matchedKeywords.length}/${keywordsToCheck.length})`
    );
    passed++;
  } else if (keywordsToCheck.length > 0) {
    checks.push(
      `WARN: Few expected keywords found (${matchedKeywords.length}/${keywordsToCheck.length})`
    );
  }

  const overallStatus = failed === 0 ? "VERIFIED" : "VERIFICATION_FAILED";
  const confidenceScore = Math.round((passed / (passed + failed + 0.01)) * 100);

  return `Self-Verification Report for: ${operation}

Status: ${overallStatus}
Confidence: ${confidenceScore}%

Checks:
${checks.map(c => `  ${c}`).join("\n")}

Expected: ${expectedOutcome.slice(0, 100)}...
Actual: ${actualResult.slice(0, 200)}...`;
}

export async function assessTaskConfidence(
  taskDescription: string,
  toolsUsed: string[],
  results: string[]
): Promise<string> {
  let totalConfidence = 100;
  const factors: string[] = [];

  const riskyToolsUsed = toolsUsed.filter(t => HIGH_RISK_TOOLS.has(t));
  if (riskyToolsUsed.length > 0) {
    totalConfidence -= riskyToolsUsed.length * 10;
    factors.push(`${riskyToolsUsed.length} high-risk tools used`);
  }

  const errorCount = results.filter(r =>
    r.toLowerCase().includes("error")
  ).length;
  if (errorCount > 0) {
    totalConfidence -= errorCount * 15;
    factors.push(`${errorCount} tool errors encountered`);
  }

  if (toolsUsed.length > 10) {
    totalConfidence -= 10;
    factors.push("Many tools used - complex operation");
  }

  const successIndicators = results.filter(
    r =>
      r.toLowerCase().includes("success") ||
      r.toLowerCase().includes("completed")
  ).length;

  if (successIndicators > results.length / 2) {
    totalConfidence += 10;
    factors.push("High success indicator ratio");
  }

  totalConfidence = Math.max(0, Math.min(100, totalConfidence));

  let recommendation = "";
  if (totalConfidence >= 80) {
    recommendation = "High confidence - task likely completed successfully";
  } else if (totalConfidence >= 50) {
    recommendation = "Moderate confidence - recommend manual verification";
  } else {
    recommendation = "Low confidence - task may have failed, review required";
  }

  return `Task Confidence Assessment

Task: ${taskDescription.slice(0, 100)}...
Overall Confidence: ${totalConfidence}%
Recommendation: ${recommendation}

Factors:
${factors.map(f => `  - ${f}`).join("\n") || "  - No specific factors identified"}

Tools Used: ${toolsUsed.join(", ")}
Results Analyzed: ${results.length}`;
}

export async function listMacros(userId: number): Promise<string> {
  try {
    const memoryService = getMemoryService();
    const searchResults = await memoryService.searchProceduralMemories("", {
      userId,
      limit: 50,
    });

    if (searchResults.length === 0) {
      return "No macros defined. Use define_macro to create one.";
    }

    const formatted = searchResults
      .map(r => {
        const p = r.memory;
        return `- ${p.name} (${p.successRate}% success, ${p.executionCount} runs)\n  ${p.description}\n  Triggers: ${(p.triggerConditions || []).join(", ")}`;
      })
      .join("\n\n");

    return `Available Macros (${searchResults.length}):\n\n${formatted}`;
  } catch (error) {
    return `Failed to list macros: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function listEventTriggers(userId: number): Promise<string> {
  try {
    const endpoints = await webhookHandler.getUserEndpoints(userId);

    if (endpoints.length === 0) {
      return "No event triggers configured. Use create_event_trigger to set one up.";
    }

    const formatted = endpoints
      .map(
        ep =>
          `- ${ep.name} (${ep.isEnabled ? "enabled" : "disabled"})\n  Path: /api/webhooks/${ep.path}\n  Created: ${ep.createdAt}`
      )
      .join("\n\n");

    return `Event Triggers (${endpoints.length}):\n\n${formatted}`;
  } catch (error) {
    return `Failed to list triggers: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function searchMemory(
  userId: number,
  query: string,
  memoryTypes?: string[],
  limit?: number
): Promise<string> {
  try {
    const memoryService = getMemoryService();
    const results = await memoryService.search({
      query,
      userId,
      memoryTypes: memoryTypes as ("episodic" | "semantic" | "procedural")[],
      limit: limit || 10,
    });

    if (results.length === 0) {
      return `No memories found for query: "${query}"`;
    }

    const formatted = results.map(r => {
      const mem = r.memory as any;
      return `[${r.memoryType}] (${(r.relevanceScore * 100).toFixed(0)}% match)
  ${mem.title || mem.name || mem.subject || "Untitled"}
  ${mem.description || `${mem.predicate || ""} ${mem.object || ""}`}`;
    });

    return `Found ${results.length} memories:\n\n${formatted.join("\n\n")}`;
  } catch (error) {
    return `Memory search failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function storeMemory(
  userId: number,
  memoryType: "episodic" | "semantic" | "procedural",
  content: string | Record<string, unknown>
): Promise<string> {
  try {
    const memoryService = getMemoryService();

    // Normalize content - if string, convert to object with sensible structure
    const normalizedContent: Record<string, unknown> =
      typeof content === "string"
        ? { text: content, description: content }
        : content;

    if (memoryType === "episodic") {
      // For episodic: use text/description as title and description
      const text =
        (normalizedContent.text as string) ||
        (normalizedContent.description as string) ||
        JSON.stringify(normalizedContent);
      const id = await memoryService.createEpisodicMemory({
        userId,
        memoryType: (normalizedContent.memoryType as any) || "interaction",
        title:
          (normalizedContent.title as string) || text.slice(0, 100) || "Memory",
        description:
          (normalizedContent.description as string) || text || "No description",
        context: (normalizedContent.context as string) || "Stored via JARVIS",
        importance: (normalizedContent.importance as number) || 50,
        tags: (normalizedContent.tags as string[]) || [],
      });
      return `Episodic memory stored with ID: ${id}. Content: "${text.slice(0, 50)}..."`;
    }

    if (memoryType === "semantic") {
      // For semantic: try to parse "X is Y" patterns or use full text
      const text =
        (normalizedContent.text as string) ||
        (normalizedContent.description as string) ||
        "";

      // Try to extract subject/predicate/object from text like "The capital of France is Paris"
      let subject = normalizedContent.subject as string;
      let predicate = normalizedContent.predicate as string;
      let object = normalizedContent.object as string;

      if (!subject || !object) {
        // Simple pattern matching for "X is Y" or "The X of Y is Z" patterns
        const isMatch = text.match(/^(.+?)\s+is\s+(.+)$/i);
        const ofMatch = text.match(/^[Tt]he\s+(.+?)\s+of\s+(.+?)\s+is\s+(.+)$/);

        if (ofMatch) {
          // "The capital of France is Paris" -> subject: France, predicate: capital, object: Paris
          subject = subject || ofMatch[2];
          predicate = predicate || ofMatch[1];
          object = object || ofMatch[3];
        } else if (isMatch) {
          // "France is a country" -> subject: France, predicate: is, object: a country
          subject = subject || isMatch[1];
          predicate = predicate || "is";
          object = object || isMatch[2];
        } else {
          // Fallback: use text as the fact
          subject = subject || text.slice(0, 50) || "fact";
          predicate = predicate || "states";
          object = object || text || "unknown";
        }
      }

      const id = await memoryService.createSemanticMemory({
        userId,
        category: (normalizedContent.category as any) || "domain_knowledge",
        subject,
        predicate,
        object,
        confidence: (normalizedContent.confidence as number) || 80,
        source: (normalizedContent.source as string) || "JARVIS memory storage",
        isValid: true,
      });
      return `Semantic memory stored with ID: ${id}. Fact: "${subject}" ${predicate} "${object}"`;
    }

    if (memoryType === "procedural") {
      // For procedural: parse description as steps if not provided
      const text =
        (normalizedContent.text as string) ||
        (normalizedContent.description as string) ||
        "";
      const id = await memoryService.createProceduralMemory({
        userId,
        name:
          (normalizedContent.name as string) ||
          text.slice(0, 50) ||
          "Procedure",
        description: (normalizedContent.description as string) || text,
        triggerConditions:
          (normalizedContent.triggerConditions as string[]) || [],
        steps: (normalizedContent.steps as any[]) || [
          { action: "execute", description: text },
        ],
        isActive: true,
        successRate: 100,
        executionCount: 0,
        successCount: 0,
        avgExecutionTimeMs: 0,
      });
      return `Procedural memory stored with ID: ${id}. Procedure: "${text.slice(0, 50)}..."`;
    }

    return `Invalid memory type: ${memoryType}`;
  } catch (error) {
    return `Failed to store memory: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function getMemoryStats(userId: number): Promise<string> {
  try {
    const memoryService = getMemoryService();
    const stats = await memoryService.getStats(userId);

    return `Memory Statistics:
- Episodic memories: ${stats.totalEpisodic}
- Semantic memories: ${stats.totalSemantic}
- Procedural memories: ${stats.totalProcedural}
- Total embeddings: ${stats.totalEmbeddings}
- Learning events: ${stats.totalLearningEvents}
- Training data points: ${stats.totalTrainingData}`;
  } catch (error) {
    return `Failed to get memory stats: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function spawnSpecializedAgent(
  userId: number,
  agentType: AgentType,
  name: string,
  task: string
): Promise<string> {
  try {
    const agent = await agentManager.spawnAgent(userId, {
      type: agentType,
      name,
    });
    const result = await agentManager.executeAgent(agent.id, task);

    if (result.success) {
      return `Agent "${name}" (${agentType}) completed task:

${result.output}

Execution time: ${result.executionTimeMs}ms
Tokens used: ${result.tokensUsed}`;
    } else {
      return `Agent "${name}" failed: ${result.error}`;
    }
  } catch (error) {
    return `Failed to spawn agent: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function listActiveAgents(userId: number): Promise<string> {
  try {
    const agents = await agentManager.listAgents(userId);

    if (agents.length === 0) {
      return "No active agents. Use spawn_agent to create one.";
    }

    const formatted = agents.map(
      a =>
        `- ${a.name} (${a.agentType}): ${a.status}
    Messages: ${a.messagesProcessed} | Tools: ${a.toolCallsMade} | Tokens: ${a.tokensUsed}`
    );

    return `Active Agents (${agents.length}):\n\n${formatted.join("\n\n")}`;
  } catch (error) {
    return `Failed to list agents: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function delegateToAgent(
  userId: number,
  agentType: AgentType,
  task: string
): Promise<string> {
  try {
    const agent = await agentManager.spawnAgent(userId, {
      type: agentType,
      name: `${agentType}-${Date.now()}`,
    });

    const result = await agentManager.executeAgent(agent.id, task);

    await agentManager.terminateAgent(agent.id);

    if (result.success) {
      return `${agentType} agent completed task:\n\n${result.output}`;
    } else {
      return `${agentType} agent failed: ${result.error}`;
    }
  } catch (error) {
    return `Delegation failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function selfReview(
  originalTask: string,
  proposedResponse: string,
  toolsUsed: string[]
): Promise<string> {
  try {
    const { invokeLLM } = await import("../../_core/llm");

    const reviewPrompt = `Review this response before delivering to user.

ORIGINAL TASK:
${originalTask}

PROPOSED RESPONSE:
${proposedResponse}

TOOLS USED: ${toolsUsed.join(", ") || "none"}

Review criteria:
1. Does it fully address the original task?
2. Is the information accurate and complete?
3. Are there any errors or inconsistencies?
4. Is the response clear and well-organized?
5. Are there any obvious improvements?

Respond with JSON:
{
  "approved": true/false,
  "confidence": 0-100,
  "issues": ["list of issues if any"],
  "suggestions": ["list of improvements if any"],
  "revisedResponse": "only if major revision needed, otherwise null"
}`;

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are a quality assurance reviewer. Be critical but fair. Only reject if there are significant issues.",
        },
        { role: "user", content: reviewPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "self_review",
          strict: true,
          schema: {
            type: "object",
            properties: {
              approved: { type: "boolean" },
              confidence: { type: "number" },
              issues: { type: "array", items: { type: "string" } },
              suggestions: { type: "array", items: { type: "string" } },
              revisedResponse: { type: ["string", "null"] },
            },
            required: [
              "approved",
              "confidence",
              "issues",
              "suggestions",
              "revisedResponse",
            ],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== "string") {
      return `Review passed (unable to parse review response)`;
    }

    const review = JSON.parse(content);

    if (review.approved) {
      return `Self-review PASSED (${review.confidence}% confidence)
${review.suggestions.length > 0 ? `\nSuggestions for future:\n${review.suggestions.map((s: string) => `- ${s}`).join("\n")}` : ""}`;
    } else {
      return `Self-review FLAGGED ISSUES:
${review.issues.map((i: string) => `- ${i}`).join("\n")}

Confidence: ${review.confidence}%
${review.revisedResponse ? `\nRevised response:\n${review.revisedResponse}` : ""}`;
    }
  } catch (error) {
    return `Self-review error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function spawnAgentTeam(
  query: string,
  onProgress?: (message: string) => void
): Promise<string> {
  try {
    const callbacks: TeamCallback = {
      onPlanCreated: subtasks => {
        onProgress?.(
          `Plan created: ${subtasks.length} subtasks\n${subtasks.map(s => `  - ${s.assignedAgent}: ${s.description}`).join("\n")}`
        );
      },
      onAgentStart: (agent, subtask) => {
        onProgress?.(`${agent} starting: ${subtask.description}`);
      },
      onAgentProgress: (agent, message) => {
        onProgress?.(`${agent}: ${message}`);
      },
      onAgentComplete: (agent, _subtask, result) => {
        onProgress?.(`${agent} complete: ${result.substring(0, 100)}...`);
      },
      onAgentError: (agent, _subtask, error) => {
        onProgress?.(`${agent} error: ${error}`);
      },
      onTeamMessage: message => {
        onProgress?.(`${message.from} -> ${message.to}: ${message.content}`);
      },
      onSynthesisStart: () => {
        onProgress?.(`Synthesizing results from all agents...`);
      },
      onComplete: result => {
        onProgress?.(`Team task complete! Result length: ${result.length}`);
      },
      onError: error => {
        onProgress?.(`Team error: ${error}`);
      },
    };

    const result = await runAgentTeam(query, callbacks);
    return `Agent Team Result:\n\n${result}`;
  } catch (error) {
    return `Agent team error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function databaseQuery(
  querySql: string,
  _params?: unknown[]
): Promise<string> {
  try {
    const normalizedSql = querySql.trim().toLowerCase();
    if (
      !normalizedSql.startsWith("select") &&
      !normalizedSql.startsWith("show") &&
      !normalizedSql.startsWith("describe") &&
      !normalizedSql.startsWith("explain")
    ) {
      return "Error: Only SELECT, SHOW, DESCRIBE, and EXPLAIN queries are allowed for safety.";
    }

    const dangerousPatterns = [
      /;\s*(drop|delete|update|insert|alter|create|truncate)/i,
      /into\s+outfile/i,
      /load_file/i,
    ];
    for (const pattern of dangerousPatterns) {
      if (pattern.test(querySql)) {
        return "Error: Query contains potentially dangerous patterns.";
      }
    }

    const db = await getDb();
    if (!db) {
      return "Error: Database not available.";
    }
    const result = await db.execute(querySql);
    const rows = (result as unknown[])[0] as unknown[];

    if (!rows || rows.length === 0) {
      return "Query executed successfully. No rows returned.";
    }

    const limitedRows = rows.slice(0, 100);
    const jsonResult = JSON.stringify(limitedRows, null, 2);

    if (jsonResult.length > 10000) {
      return `Query returned ${rows.length} rows. First 100 rows (truncated):\n${jsonResult.substring(0, 10000)}...`;
    }

    return `Query returned ${rows.length} rows:\n${jsonResult}`;
  } catch (error) {
    return `Database query error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function analyzeScreenshot(
  imagePathOrUrl: string,
  question: string
): Promise<string> {
  return analyzeImage(imagePathOrUrl, question);
}

export async function analyzeImage(
  imagePathOrUrl: string,
  question: string
): Promise<string> {
  try {
    const { invokeLLM } = await import("../../_core/llm");

    let imageContent: { type: "image_url"; image_url: { url: string } };

    if (imagePathOrUrl.startsWith("http")) {
      imageContent = {
        type: "image_url",
        image_url: { url: imagePathOrUrl },
      };
    } else {
      const imageBuffer = await fs.readFile(imagePathOrUrl);
      const base64 = imageBuffer.toString("base64");
      const ext = path.extname(imagePathOrUrl).slice(1) || "png";
      const mimeType = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
      imageContent = {
        type: "image_url",
        image_url: { url: `data:${mimeType};base64,${base64}` },
      };
    }

    const response = await invokeLLM({
      messages: [
        {
          role: "user",
          content: [imageContent, { type: "text", text: question }],
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    return typeof content === "string" ? content : "Failed to analyze image";
  } catch (error) {
    return `Image analysis error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function compareImages(
  image1: string,
  image2: string,
  focusArea?: string
): Promise<string> {
  try {
    const { invokeLLM } = await import("../../_core/llm");

    const loadImage = async (
      imagePath: string
    ): Promise<{ type: "image_url"; image_url: { url: string } }> => {
      if (imagePath.startsWith("http")) {
        return { type: "image_url", image_url: { url: imagePath } };
      }
      const imageBuffer = await fs.readFile(imagePath);
      const base64 = imageBuffer.toString("base64");
      const ext = path.extname(imagePath).slice(1) || "png";
      const mimeType = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
      return {
        type: "image_url",
        image_url: { url: `data:${mimeType};base64,${base64}` },
      };
    };

    const img1Content = await loadImage(image1);
    const img2Content = await loadImage(image2);

    const focusPrompt = focusArea
      ? `Focus especially on ${focusArea} differences.`
      : "";

    const response = await invokeLLM({
      messages: [
        {
          role: "user",
          content: [
            img1Content,
            img2Content,
            {
              type: "text",
              text: `Compare these two images and describe the differences between them. ${focusPrompt}

Please provide:
1. Overall similarity assessment
2. Key differences found
3. Elements that are the same
4. Any potential issues or concerns`,
            },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    return typeof content === "string" ? content : "Failed to compare images";
  } catch (error) {
    return `Image comparison error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function extractTextFromImage(imagePath: string): Promise<string> {
  return analyzeImage(
    imagePath,
    "Extract ALL text visible in this image. Return the text exactly as it appears, preserving layout where possible. Include all text from headers, buttons, labels, body text, captions, watermarks, etc."
  );
}

export async function readPdf(
  pdfPath: string,
  pages?: string
): Promise<string> {
  await ensureSandbox();

  const resolvedPath = pdfPath.startsWith("/")
    ? pdfPath
    : path.join(JARVIS_SANDBOX, pdfPath);

  try {
    const { execAsync } = await import("util").then(u => ({
      execAsync: u.promisify(exec),
    }));

    let pageArg = "";
    if (pages && pages !== "all") {
      if (pages.includes("-")) {
        const [start, end] = pages.split("-");
        pageArg = `-f ${start} -l ${end}`;
      } else if (pages.includes(",")) {
        pageArg = `-f ${pages.split(",")[0]} -l ${pages.split(",").pop()}`;
      } else {
        pageArg = `-f ${pages} -l ${pages}`;
      }
    }

    const { stdout, stderr } = await execAsync(
      `pdftotext ${pageArg} "${resolvedPath}" - 2>&1 || cat "${resolvedPath}" | strings | head -500`,
      { maxBuffer: 1024 * 1024 * 5, timeout: 60000 }
    );

    const output = stdout || stderr;

    if (!output || output.trim().length === 0) {
      return "Could not extract text from PDF. The PDF may be image-based. Try using analyze_document with a question instead.";
    }

    if (output.length > 50000) {
      return (
        output.substring(0, 50000) + "\n\n... [truncated - PDF text too long]"
      );
    }

    return output;
  } catch (error) {
    return `PDF read error: ${error instanceof Error ? error.message : String(error)}. Note: pdftotext may not be installed. Install with: apt-get install poppler-utils`;
  }
}

export async function analyzeDocument(
  documentPath: string,
  question: string
): Promise<string> {
  await ensureSandbox();

  const resolvedPath = documentPath.startsWith("/")
    ? documentPath
    : path.join(JARVIS_SANDBOX, documentPath);

  try {
    const ext = path.extname(resolvedPath).toLowerCase();

    if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"].includes(ext)) {
      return analyzeImage(resolvedPath, question);
    }

    if (ext === ".pdf") {
      const textContent = await readPdf(resolvedPath);

      if (
        textContent.includes("Could not extract") ||
        textContent.trim().length < 100
      ) {
        return analyzeImage(
          resolvedPath,
          `This is a PDF document. ${question}`
        );
      }

      const { invokeLLM } = await import("../../_core/llm");
      const response = await invokeLLM({
        messages: [
          {
            role: "user",
            content: `Here is the content of a PDF document:\n\n${textContent.substring(0, 30000)}\n\n---\n\nQuestion: ${question}`,
          },
        ],
      });

      const content = response.choices[0]?.message?.content;
      return typeof content === "string"
        ? content
        : "Failed to analyze document";
    }

    const textContent = await fs.readFile(resolvedPath, "utf-8");
    const { invokeLLM } = await import("../../_core/llm");
    const response = await invokeLLM({
      messages: [
        {
          role: "user",
          content: `Here is the content of a document:\n\n${textContent.substring(0, 30000)}\n\n---\n\nQuestion: ${question}`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    return typeof content === "string" ? content : "Failed to analyze document";
  } catch (error) {
    return `Document analysis error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function convertDocument(
  inputPath: string,
  outputFormat: string,
  outputPath?: string
): Promise<string> {
  await ensureSandbox();

  const resolvedInput = inputPath.startsWith("/")
    ? inputPath
    : path.join(JARVIS_SANDBOX, inputPath);

  try {
    const ext = path.extname(resolvedInput).toLowerCase();
    let content: string;

    if (ext === ".pdf") {
      content = await readPdf(resolvedInput);
    } else {
      content = await fs.readFile(resolvedInput, "utf-8");
    }

    let converted: string;
    switch (outputFormat.toLowerCase()) {
      case "text":
      case "txt":
        converted = content
          .replace(/<[^>]+>/g, "")
          .replace(/\s+/g, " ")
          .trim();
        break;

      case "markdown":
      case "md":
        converted = content;
        if (ext === ".html" || ext === ".htm") {
          converted = content
            .replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n\n")
            .replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n\n")
            .replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n\n")
            .replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n")
            .replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**")
            .replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**")
            .replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*")
            .replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*")
            .replace(/<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)")
            .replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n")
            .replace(/<[^>]+>/g, "")
            .trim();
        }
        break;

      case "html":
        if (ext === ".md" || ext === ".markdown") {
          converted = content
            .replace(/^### (.*$)/gim, "<h3>$1</h3>")
            .replace(/^## (.*$)/gim, "<h2>$1</h2>")
            .replace(/^# (.*$)/gim, "<h1>$1</h1>")
            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
            .replace(/\*(.*?)\*/g, "<em>$1</em>")
            .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
            .replace(/^- (.*$)/gim, "<li>$1</li>")
            .replace(/\n\n/g, "</p><p>")
            .replace(/^/, "<p>")
            .replace(/$/, "</p>");
        } else {
          converted = `<pre>${content
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")}</pre>`;
        }
        break;

      case "json":
        converted = JSON.stringify(
          {
            source: inputPath,
            format: ext,
            content: content,
            wordCount: content.split(/\s+/).length,
            charCount: content.length,
          },
          null,
          2
        );
        break;

      default:
        return `Unsupported output format: ${outputFormat}. Supported: text, markdown, html, json`;
    }

    if (outputPath) {
      const resolvedOutput = outputPath.startsWith("/")
        ? outputPath
        : path.join(JARVIS_SANDBOX, outputPath);
      await fs.writeFile(resolvedOutput, converted, "utf-8");
      return `Document converted and saved to: ${resolvedOutput}`;
    }

    if (converted.length > 10000) {
      return converted.substring(0, 10000) + "\n\n... [truncated]";
    }

    return converted;
  } catch (error) {
    return `Document conversion error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function transcribeAudio(
  audioPath: string,
  language?: string
): Promise<string> {
  await ensureSandbox();

  const resolvedPath = audioPath.startsWith("/")
    ? audioPath
    : path.join(JARVIS_SANDBOX, audioPath);

  try {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return "Error: OPENAI_API_KEY not set. Audio transcription requires OpenAI Whisper API.";
    }

    const audioBuffer = await fs.readFile(resolvedPath);
    const ext = path.extname(resolvedPath).slice(1) || "mp3";

    const formData = new FormData();
    const uint8Array = new Uint8Array(audioBuffer);
    const blob = new Blob([uint8Array], { type: `audio/${ext}` });
    formData.append("file", blob, path.basename(resolvedPath));
    formData.append("model", "whisper-1");
    if (language) {
      formData.append("language", language);
    }

    const response = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return `Transcription API error: ${response.status} - ${errorText}`;
    }

    const result = await response.json();
    return `Transcription:\n\n${result.text}`;
  } catch (error) {
    return `Audio transcription error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function extractAudioFromVideo(
  videoPath: string,
  outputPath?: string
): Promise<string> {
  await ensureSandbox();

  const resolvedVideo = videoPath.startsWith("/")
    ? videoPath
    : path.join(JARVIS_SANDBOX, videoPath);

  const baseName = path.basename(resolvedVideo, path.extname(resolvedVideo));
  const resolvedOutput =
    outputPath ||
    path.join(JARVIS_SANDBOX, `${baseName}_audio_${Date.now()}.mp3`);

  try {
    const { stdout, stderr } = await execAsync(
      `ffmpeg -i "${resolvedVideo}" -vn -acodec libmp3lame -q:a 2 "${resolvedOutput}" -y`,
      { timeout: 300000 }
    );

    const exists = await verifyFileCreated(resolvedOutput);
    if (!exists) {
      return `Error: Audio extraction may have failed. ffmpeg output: ${stderr || stdout}`;
    }

    const stats = await fs.stat(resolvedOutput);
    return `Audio extracted successfully!
Output: ${resolvedOutput}
Size: ${Math.round(stats.size / 1024)} KB

Use transcribe_audio("${resolvedOutput}") to get the text transcription.`;
  } catch (error) {
    return `Audio extraction error: ${error instanceof Error ? error.message : String(error)}. Note: ffmpeg must be installed.`;
  }
}

export async function generateSpeech(
  text: string,
  outputPath: string,
  voice?: string
): Promise<string> {
  await ensureSandbox();

  const resolvedOutput = outputPath.startsWith("/")
    ? outputPath
    : path.join(JARVIS_SANDBOX, outputPath);

  try {
    const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (elevenLabsKey) {
      const voiceId = voice || "21m00Tcm4TlvDq8ikWAM";
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": elevenLabsKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text,
            model_id: "eleven_monolingual_v1",
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }

      const audioBuffer = Buffer.from(await response.arrayBuffer());
      await fs.writeFile(resolvedOutput, audioBuffer);

      return `Speech generated and saved to: ${resolvedOutput}`;
    }

    if (openaiKey) {
      const selectedVoice = voice || "alloy";
      const validVoices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];
      if (!validVoices.includes(selectedVoice)) {
        return `Invalid voice. Choose from: ${validVoices.join(", ")}`;
      }

      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "tts-1",
          input: text,
          voice: selectedVoice,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return `OpenAI TTS error: ${response.status} - ${errorText}`;
      }

      const audioBuffer = Buffer.from(await response.arrayBuffer());
      await fs.writeFile(resolvedOutput, audioBuffer);

      return `Speech generated and saved to: ${resolvedOutput}`;
    }

    return "Error: No TTS API key configured. Set ELEVENLABS_API_KEY or OPENAI_API_KEY.";
  } catch (error) {
    return `Speech generation error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  switch (name) {
    case "spawn_agent_team":
      return spawnAgentTeam(input.query as string);
    case "database_query":
      return databaseQuery(
        input.sql as string,
        input.params as unknown[] | undefined
      );
    case "analyze_screenshot":
      return analyzeScreenshot(
        input.imagePathOrUrl as string,
        input.question as string
      );
    case "analyze_image":
      return analyzeImage(
        input.imagePathOrUrl as string,
        input.question as string
      );
    case "compare_images":
      return compareImages(
        input.image1 as string,
        input.image2 as string,
        input.focusArea as string | undefined
      );
    case "extract_text_from_image":
      return extractTextFromImage(input.imagePath as string);
    case "read_pdf":
      return readPdf(
        input.pdfPath as string,
        input.pages as string | undefined
      );
    case "analyze_document":
      return analyzeDocument(
        input.documentPath as string,
        input.question as string
      );
    case "convert_document":
      return convertDocument(
        input.inputPath as string,
        input.outputFormat as string,
        input.outputPath as string | undefined
      );
    case "transcribe_audio":
      return transcribeAudio(
        input.audioPath as string,
        input.language as string | undefined
      );
    case "extract_audio_from_video":
      return extractAudioFromVideo(
        input.videoPath as string,
        input.outputPath as string | undefined
      );
    case "generate_speech":
      return generateSpeech(
        input.text as string,
        input.outputPath as string,
        input.voice as string | undefined
      );
    case "create_event_trigger":
      return createEventTrigger(
        input.userId as number,
        input.name as string,
        input.triggerType as "webhook" | "cron" | "file_change",
        { eventTypes: input.eventTypes as string[] | undefined },
        input.actionPrompt as string
      );
    case "list_event_triggers":
      return listEventTriggers(input.userId as number);
    case "define_macro":
      return defineMacro(
        input.userId as number,
        input.name as string,
        input.description as string,
        input.triggerPatterns as string[],
        input.steps as Array<{
          action: string;
          tool: string;
          description?: string;
        }>
      );
    case "execute_macro":
      return executeMacro(
        input.userId as number,
        input.macroNameOrId as string
      );
    case "list_macros":
      return listMacros(input.userId as number);
    case "search_memory":
      return searchMemory(
        input.userId as number,
        input.query as string,
        input.memoryTypes as string[] | undefined,
        input.limit as number | undefined
      );
    case "store_memory":
      return storeMemory(
        input.userId as number,
        input.memoryType as "episodic" | "semantic" | "procedural",
        input.content as Record<string, unknown>
      );
    case "get_memory_stats":
      return getMemoryStats(input.userId as number);
    case "connect_mcp_server":
      return connectMCPServer(
        input.name as string,
        input.command as string,
        input.args as string[] | undefined,
        input.env as Record<string, string> | undefined
      );
    case "call_mcp_tool":
      return callMCPTool(
        input.server as string,
        input.tool as string,
        input.arguments as Record<string, unknown>
      );
    case "list_mcp_tools":
      return listMCPTools();
    case "list_mcp_servers":
      return listMCPServers();
    case "spawn_agent":
      return spawnSpecializedAgent(
        input.userId as number,
        (input.agentType || input.type) as AgentType,
        (input.name || input.agentId) as string,
        input.task as string
      );
    case "list_agents":
      return listActiveAgents(input.userId as number);
    case "delegate_to_agent":
      return delegateToAgent(
        input.userId as number,
        input.agentType as AgentType,
        input.task as string
      );
    case "self_review":
      return selfReview(
        input.originalTask as string,
        input.proposedResponse as string,
        (input.toolsUsed as string[]) || []
      );
    case "github_api":
      return githubApi(
        input.endpoint as string,
        (input.method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE") || "GET",
        input.body as Record<string, unknown> | undefined
      );
    case "create_github_issue":
    case "github_create_issue":
      return createGitHubIssue(
        input.repo as string,
        input.title as string,
        input.body as string,
        {
          labels: input.labels as string[] | undefined,
          assignees: input.assignees as string[] | undefined,
        }
      );
    case "create_github_pr":
    case "github_create_pr":
      return createGitHubPR(
        input.repo as string,
        input.title as string,
        input.body as string,
        input.head as string,
        (input.base as string) || "main"
      );
    case "send_slack_message":
    case "slack_message":
      return sendSlackMessage(
        input.channel as string,
        input.message as string,
        {
          username: input.username as string | undefined,
          iconEmoji: input.iconEmoji as string | undefined,
        }
      );
    case "send_email":
      return sendEmail(
        input.to as string,
        input.subject as string,
        input.body as string,
        { html: input.html as boolean | undefined }
      );
    case "self_verify":
      return selfVerify(
        input.operation as string,
        input.expectedOutcome as string,
        input.actualResult as string
      );
    case "assess_task_confidence":
      return assessTaskConfidence(
        input.taskDescription as string,
        input.toolsUsed as string[],
        input.results as string[]
      );
    case "web_search":
      return webSearch(input.query as string);
    case "searxng_search":
      return searxngSearch(input.query as string, {
        engines: input.engines as string | undefined,
        categories: input.categories as string | undefined,
      });
    case "browse_url":
      return browseUrl(input.url as string);
    case "execute_python":
      return executePython(input.code as string);
    case "execute_javascript":
      return executeJavaScript(input.code as string);
    case "run_shell":
    case "execute_shell":
    case "shell":
      return runShell(input.command as string);
    case "read_file":
      return readFile(input.path as string);
    case "write_file":
      return writeFile(input.path as string, input.content as string);
    case "list_files":
      return listFiles(input.path as string);
    case "calculate":
      return calculate(input.expression as string);
    case "http_request":
      return httpRequest(
        input.url as string,
        input.method as string,
        input.headers as Record<string, string>,
        input.body as string
      );
    case "generate_image":
      return generateImageTool(input.prompt as string);
    case "get_datetime":
      return getCurrentDateTime();
    case "json_tool":
      return jsonTool(
        input.operation as "parse" | "stringify",
        input.data as string
      );
    case "text_process":
      return textProcess(
        input.operation as
          | "count_words"
          | "count_chars"
          | "count_lines"
          | "uppercase"
          | "lowercase"
          | "reverse",
        input.text as string
      );
    case "ssh_execute":
      return sshExecute(
        (input.hostName || input.host) as string,
        input.command as string,
        input.userId as number,
        input.workingDirectory as string | undefined
      );
    case "ssh_read_file":
      return sshReadFile(
        (input.hostName || input.host) as string,
        input.path as string,
        input.userId as number
      );
    case "ssh_write_file":
      return sshWriteFile(
        (input.hostName || input.host) as string,
        input.path as string,
        input.content as string,
        input.userId as number
      );
    case "ssh_list_files":
      return sshListFiles(
        (input.hostName || input.host) as string,
        input.path as string,
        input.userId as number
      );
    case "screenshot":
      return takeScreenshot(input.url as string, {
        fullPage: input.fullPage as boolean | undefined,
        waitFor: input.waitFor as number | undefined,
      });
    case "playwright_browse":
      return playwrightBrowse(input.url as string, {
        waitFor: input.waitFor as string | undefined,
        timeout: input.timeout as number | undefined,
      });
    case "browser_session_start":
      return browserSessionStart(
        input.sessionId as string,
        input.url as string
      );
    case "browser_click":
      return browserClick(input.sessionId as string, input.selector as string);
    case "browser_fill":
      return browserFill(
        input.sessionId as string,
        input.selector as string,
        input.value as string
      );
    case "browser_select":
      return browserSelect(
        input.sessionId as string,
        input.selector as string,
        input.value as string
      );
    case "browser_navigate":
      return browserNavigate(input.sessionId as string, input.url as string);
    case "browser_screenshot":
      return browserScreenshot(input.sessionId as string, {
        fullPage: input.fullPage as boolean | undefined,
        name: input.name as string | undefined,
      });
    case "browser_get_content":
      return browserGetContent(input.sessionId as string);
    case "browser_get_logs":
      return browserGetLogs(input.sessionId as string);
    case "browser_wait_for":
      return browserWaitFor(
        input.sessionId as string,
        input.selector as string,
        {
          timeout: input.timeout as number | undefined,
          state: input.state as "visible" | "hidden" | "attached" | undefined,
        }
      );
    case "browser_get_elements":
      return browserGetElements(
        input.sessionId as string,
        input.selector as string
      );
    case "browser_session_end":
      return browserSessionEnd(input.sessionId as string);
    case "run_build":
      return runBuild(
        input.projectPath as string,
        input.command as string | undefined
      );
    case "run_tests":
      return runTests(input.projectPath as string, {
        pattern: input.pattern as string | undefined,
        command: input.command as string | undefined,
      });
    case "run_type_check":
    case "run_typecheck":
      return runTypeCheck(input.projectPath as string);
    case "run_lint":
      return runLint(input.projectPath as string);
    case "start_dev_server":
      return startDevServer(input.projectPath as string, {
        port: input.port as number | undefined,
        command: input.command as string | undefined,
      });
    case "check_dev_server":
      return checkDevServer(input.port as number | undefined);
    case "save_baseline_screenshot":
      return saveBaselineScreenshot(
        input.sessionId as string,
        input.name as string
      );
    case "compare_screenshot":
      return compareScreenshot(
        input.sessionId as string,
        input.baselineName as string
      );
    case "list_baselines":
      return listBaselines();
    case "git_status":
      return gitStatus(input.projectPath as string);
    case "git_diff":
      return gitDiff(input.projectPath as string, {
        staged: input.staged as boolean | undefined,
        file: input.file as string | undefined,
      });
    case "git_branch":
      return gitBranch(input.projectPath as string, {
        create: input.create as string | undefined,
        checkout: input.checkout as string | undefined,
        delete: input.delete as string | undefined,
      });
    case "git_commit":
      return gitCommit(input.projectPath as string, input.message as string, {
        addAll: input.addAll as boolean | undefined,
        files: input.files as string[] | undefined,
      });
    case "git_log":
      return gitLog(input.projectPath as string, {
        count: input.count as number | undefined,
        oneline: input.oneline as boolean | undefined,
      });
    case "git_push":
      return gitPush(input.projectPath as string, {
        setUpstream: input.setUpstream as string | undefined,
        force: input.force as boolean | undefined,
      });
    case "git_pull":
      return gitPull(input.projectPath as string);
    case "git_stash":
      return gitStash(input.projectPath as string, {
        pop: input.pop as boolean | undefined,
        list: input.list as boolean | undefined,
        message: input.message as string | undefined,
      });
    case "git_clone":
      return gitClone(input.repoUrl as string, input.outputPath as string, {
        branch: input.branch as string | undefined,
        depth: input.depth as number | undefined,
      });
    case "git_init":
      return gitInit(input.projectPath as string, {
        initialBranch: input.initialBranch as string | undefined,
      });
    case "git_create_pr":
      return gitCreatePR(
        input.projectPath as string,
        input.title as string,
        input.body as string,
        {
          base: input.base as string | undefined,
          head: input.head as string | undefined,
          draft: input.draft as boolean | undefined,
        }
      );
    case "tmux_start":
      return tmuxStart(input.sessionName as string, input.command as string);
    case "tmux_output":
      return tmuxOutput(
        input.sessionName as string,
        input.lines as number | undefined
      );
    case "tmux_stop":
      return tmuxStop(input.sessionName as string);
    case "tmux_list":
      return tmuxList();
    case "tmux_send":
      return tmuxSend(input.sessionName as string, input.input as string);
    case "preview_file_edit":
      return previewFileEdit(input.path as string, input.content as string);
    case "apply_file_edit":
      return applyFileEdit(input.backupId as string);
    case "rollback_file_edit":
      return rollbackFileEdit(input.backupId as string);
    case "discard_file_edit":
      return discardFileEdit(input.backupId as string);
    case "list_pending_edits":
      return listPendingEdits();
    case "search_and_replace":
      return searchAndReplace(
        input.path as string,
        input.search as string,
        input.replace as string,
        {
          regex: input.regex as boolean | undefined,
          all: input.all as boolean | undefined,
          caseSensitive: input.caseSensitive as boolean | undefined,
        }
      );
    case "insert_at_line":
      return insertAtLine(
        input.path as string,
        input.lineNumber as number,
        input.content as string,
        (input.position as "before" | "after") || "after"
      );
    case "delete_lines":
      return deleteLines(
        input.path as string,
        input.startLine as number,
        input.endLine as number
      );
    case "replace_lines":
      return replaceLines(
        input.path as string,
        input.startLine as number,
        input.endLine as number,
        input.newContent as string
      );
    case "find_in_file":
      return findInFile(input.path as string, input.pattern as string, {
        regex: input.regex as boolean | undefined,
        context: input.context as number | undefined,
      });
    case "start_debug_session":
      return startDebugSession(input.hypothesis as string);
    case "debug_snapshot":
      return debugSnapshot(
        input.label as string,
        input.state as Record<string, unknown>
      );
    case "debug_log_output":
      return debugLogOutput(input.output as string);
    case "debug_log_error":
      return debugLogError(input.error as string);
    case "debug_attempt":
      return debugAttempt(
        input.description as string,
        input.result as "success" | "failure",
        input.error as string | undefined
      );
    case "debug_summary":
      return debugSummary();
    case "end_debug_session":
      return endDebugSession(input.conclusion as string);
    case "get_debug_snapshot":
      return getDebugSnapshot(input.snapshotId as string);
    case "npm_audit":
      return npmAudit(input.projectPath as string);
    case "security_analysis":
      return securityAnalysis(input.projectPath as string);
    case "scaffold_project":
      return scaffoldProjectTool(
        (input.projectName || input.name) as string,
        (input.projectType || input.template || input.type) as string,
        (input.outputPath || input.path || "/tmp/jarvis-projects") as string,
        input.database as string | undefined,
        input.authentication as string | undefined,
        input.features as string[] | undefined
      );
    case "start_dev_server":
      return startDevServerTool(
        input.projectPath as string,
        input.command as string | undefined
      );
    case "stop_dev_server":
      return stopDevServerTool(input.projectPath as string);
    case "get_dev_server_output":
      return getDevServerOutputTool(input.projectPath as string);
    case "list_dev_servers":
      return listDevServers();
    case "install_dependencies":
      return installDependenciesTool(
        input.projectPath as string,
        input.packageManager as string | undefined
      );
    case "deploy_vercel":
      return deployVercel(input.projectPath as string, {
        prod: input.prod as boolean | undefined,
        name: input.name as string | undefined,
        env: input.env as Record<string, string> | undefined,
      });
    case "deploy_railway":
      return deployRailway(input.projectPath as string, {
        service: input.service as string | undefined,
        environment: input.environment as string | undefined,
      });
    case "docker_build":
      return dockerBuild(input.projectPath as string, {
        tag: input.tag as string | undefined,
        dockerfile: input.dockerfile as string | undefined,
        buildArgs: input.buildArgs as Record<string, string> | undefined,
        platform: input.platform as string | undefined,
      });
    case "docker_push":
      return dockerPush(input.imageName as string, {
        registry: input.registry as string | undefined,
      });
    case "generate_dockerfile":
      return generateDockerfile(input.projectPath as string, {
        projectType: input.projectType as
          | "node"
          | "python"
          | "static"
          | undefined,
        port: input.port as number | undefined,
      });
    case "docker_compose":
      return dockerCompose(
        input.projectPath as string,
        input.operation as "up" | "down" | "logs" | "ps" | "build",
        {
          detach: input.detach as boolean | undefined,
          services: input.services as string[] | undefined,
          follow: input.follow as boolean | undefined,
        }
      );
    case "check_deployment_health":
      return checkDeploymentHealth(input.url as string, {
        timeout: input.timeout as number | undefined,
        expectedStatus: input.expectedStatus as number | undefined,
      });
    default:
      if (name.startsWith("self_")) {
        return executeSelfEvolutionTool(name, input, input.userId as number);
      }
      return `Unknown tool: ${name}`;
  }
}

/**
 * Get list of available tools with descriptions
 */
export function getAvailableTools(): Array<{
  name: string;
  description: string;
  parameters: Record<
    string,
    { type: string; description: string; required?: boolean }
  >;
}> {
  return [
    {
      name: "web_search",
      description:
        "Search the web for information using Perplexity Sonar. Returns relevant results with sources.",
      parameters: {
        query: {
          type: "string",
          description: "The search query",
          required: true,
        },
      },
    },
    {
      name: "browse_url",
      description: "Fetch and extract text content from a URL.",
      parameters: {
        url: {
          type: "string",
          description: "The URL to browse",
          required: true,
        },
      },
    },
    {
      name: "execute_python",
      description:
        "Execute Python code in a sandboxed environment. Has access to standard library and common packages.",
      parameters: {
        code: {
          type: "string",
          description: "The Python code to execute",
          required: true,
        },
      },
    },
    {
      name: "execute_javascript",
      description:
        "Execute JavaScript/Node.js code in a sandboxed environment.",
      parameters: {
        code: {
          type: "string",
          description: "The JavaScript code to execute",
          required: true,
        },
      },
    },
    {
      name: "run_shell",
      description:
        "Run a shell command in the sandbox. Some dangerous commands are blocked.",
      parameters: {
        command: {
          type: "string",
          description: "The shell command to run",
          required: true,
        },
      },
    },
    {
      name: "read_file",
      description: "Read the contents of a file.",
      parameters: {
        path: {
          type: "string",
          description: "Path to the file (relative to sandbox or absolute)",
          required: true,
        },
      },
    },
    {
      name: "write_file",
      description:
        "Write content to a file. Creates parent directories if needed.",
      parameters: {
        path: {
          type: "string",
          description: "Path to the file",
          required: true,
        },
        content: {
          type: "string",
          description: "Content to write",
          required: true,
        },
      },
    },
    {
      name: "list_files",
      description: "List files and directories in a path.",
      parameters: {
        path: {
          type: "string",
          description: "Directory path to list",
          required: true,
        },
      },
    },
    {
      name: "search_and_replace",
      description:
        "Search for text or regex pattern in a file and replace with new content. Generates a preview diff that must be applied with apply_file_edit.",
      parameters: {
        path: {
          type: "string",
          description: "Path to the file",
          required: true,
        },
        search: {
          type: "string",
          description: "Text or regex pattern to search for",
          required: true,
        },
        replace: {
          type: "string",
          description: "Replacement text",
          required: true,
        },
        regex: {
          type: "boolean",
          description: "Treat search as regex pattern (default: false)",
          required: false,
        },
        all: {
          type: "boolean",
          description: "Replace all occurrences (default: false, first only)",
          required: false,
        },
        caseSensitive: {
          type: "boolean",
          description: "Case-sensitive search (default: false)",
          required: false,
        },
      },
    },
    {
      name: "insert_at_line",
      description:
        "Insert content at a specific line number. Generates a preview diff that must be applied with apply_file_edit.",
      parameters: {
        path: {
          type: "string",
          description: "Path to the file",
          required: true,
        },
        lineNumber: {
          type: "number",
          description: "Line number to insert at",
          required: true,
        },
        content: {
          type: "string",
          description: "Content to insert",
          required: true,
        },
        position: {
          type: "string",
          description: "Insert 'before' or 'after' the line (default: after)",
          required: false,
        },
      },
    },
    {
      name: "delete_lines",
      description:
        "Delete a range of lines from a file. Generates a preview diff that must be applied with apply_file_edit.",
      parameters: {
        path: {
          type: "string",
          description: "Path to the file",
          required: true,
        },
        startLine: {
          type: "number",
          description: "First line to delete (1-indexed)",
          required: true,
        },
        endLine: {
          type: "number",
          description: "Last line to delete (inclusive)",
          required: true,
        },
      },
    },
    {
      name: "replace_lines",
      description:
        "Replace a range of lines with new content. Generates a preview diff that must be applied with apply_file_edit.",
      parameters: {
        path: {
          type: "string",
          description: "Path to the file",
          required: true,
        },
        startLine: {
          type: "number",
          description: "First line to replace (1-indexed)",
          required: true,
        },
        endLine: {
          type: "number",
          description: "Last line to replace (inclusive)",
          required: true,
        },
        newContent: {
          type: "string",
          description: "New content to insert (can be multiple lines)",
          required: true,
        },
      },
    },
    {
      name: "find_in_file",
      description:
        "Search for a pattern in a file and return matches with line numbers and context.",
      parameters: {
        path: {
          type: "string",
          description: "Path to the file",
          required: true,
        },
        pattern: {
          type: "string",
          description: "Text or regex pattern to search for",
          required: true,
        },
        regex: {
          type: "boolean",
          description: "Treat pattern as regex (default: false)",
          required: false,
        },
        context: {
          type: "number",
          description: "Lines of context to show around matches (default: 2)",
          required: false,
        },
      },
    },
    {
      name: "calculate",
      description:
        "Perform mathematical calculations. Supports basic arithmetic, trigonometry, logarithms, etc.",
      parameters: {
        expression: {
          type: "string",
          description:
            "Mathematical expression to evaluate (e.g., 'sqrt(16) + pow(2, 3)')",
          required: true,
        },
      },
    },
    {
      name: "http_request",
      description: "Make an HTTP request to an API endpoint.",
      parameters: {
        url: {
          type: "string",
          description: "The URL to request",
          required: true,
        },
        method: {
          type: "string",
          description: "HTTP method (GET, POST, PUT, DELETE, etc.)",
          required: false,
        },
        headers: {
          type: "object",
          description: "Request headers as key-value pairs",
          required: false,
        },
        body: {
          type: "string",
          description: "Request body (for POST, PUT, PATCH)",
          required: false,
        },
      },
    },
    {
      name: "generate_image",
      description: "Generate an image using AI based on a text prompt.",
      parameters: {
        prompt: {
          type: "string",
          description: "Description of the image to generate",
          required: true,
        },
      },
    },
    {
      name: "get_datetime",
      description: "Get the current date and time.",
      parameters: {},
    },
    {
      name: "json_tool",
      description: "Parse or stringify JSON data.",
      parameters: {
        operation: {
          type: "string",
          description: "'parse' or 'stringify'",
          required: true,
        },
        data: {
          type: "string",
          description: "The JSON string to process",
          required: true,
        },
      },
    },
    {
      name: "text_process",
      description: "Process text with various operations.",
      parameters: {
        operation: {
          type: "string",
          description:
            "Operation: count_words, count_chars, count_lines, uppercase, lowercase, reverse",
          required: true,
        },
        text: {
          type: "string",
          description: "The text to process",
          required: true,
        },
      },
    },
    {
      name: "ssh_execute",
      description:
        "Execute a command on a registered remote SSH host. Use this to run commands on servers you have configured in the Hosts tab. Requires host name (not hostname/IP).",
      parameters: {
        host: {
          type: "string",
          description:
            "The name of the registered SSH host (e.g., 'rasputin', 'production-server')",
          required: true,
        },
        command: {
          type: "string",
          description: "The shell command to execute on the remote host",
          required: true,
        },
        workingDirectory: {
          type: "string",
          description: "Optional working directory for the command",
          required: false,
        },
      },
    },
    {
      name: "ssh_read_file",
      description:
        "Read the contents of a file from a registered remote SSH host.",
      parameters: {
        host: {
          type: "string",
          description: "The name of the registered SSH host",
          required: true,
        },
        path: {
          type: "string",
          description: "Absolute path to the file on the remote host",
          required: true,
        },
      },
    },
    {
      name: "ssh_write_file",
      description: "Write content to a file on a registered remote SSH host.",
      parameters: {
        host: {
          type: "string",
          description: "The name of the registered SSH host",
          required: true,
        },
        path: {
          type: "string",
          description: "Absolute path to the file on the remote host",
          required: true,
        },
        content: {
          type: "string",
          description: "Content to write to the file",
          required: true,
        },
      },
    },
    {
      name: "ssh_list_files",
      description:
        "List files and directories on a registered remote SSH host.",
      parameters: {
        host: {
          type: "string",
          description: "The name of the registered SSH host",
          required: true,
        },
        path: {
          type: "string",
          description: "Directory path to list on the remote host",
          required: true,
        },
      },
    },
    {
      name: "send_email",
      description:
        "Send an email. Requires SENDGRID_API_KEY or SMTP_URL env var.",
      parameters: {
        to: {
          type: "string",
          description: "Recipient email address",
          required: true,
        },
        subject: {
          type: "string",
          description: "Email subject",
          required: true,
        },
        body: {
          type: "string",
          description: "Email body",
          required: true,
        },
        html: {
          type: "boolean",
          description: "Send as HTML email",
          required: false,
        },
      },
    },
    {
      name: "self_verify",
      description:
        "Verify that an operation completed successfully by comparing expected vs actual outcome.",
      parameters: {
        operation: {
          type: "string",
          description: "Description of the operation performed",
          required: true,
        },
        expectedOutcome: {
          type: "string",
          description: "What was expected to happen",
          required: true,
        },
        actualResult: {
          type: "string",
          description: "The actual result/output from the operation",
          required: true,
        },
      },
    },
    {
      name: "assess_task_confidence",
      description:
        "Assess overall confidence in task completion based on tools used and results.",
      parameters: {
        taskDescription: {
          type: "string",
          description: "Description of the task",
          required: true,
        },
        toolsUsed: {
          type: "array",
          description: "List of tool names used during the task",
          required: true,
        },
        results: {
          type: "array",
          description: "List of results/outputs from each tool",
          required: true,
        },
      },
    },
    ...getSelfEvolutionTools(),
    // === GIT TOOLS ===
    {
      name: "git_status",
      description:
        "Get the git status of a project, showing modified, staged, and untracked files.",
      parameters: {
        projectPath: {
          type: "string",
          description: "Path to the git repository",
          required: true,
        },
      },
    },
    {
      name: "git_diff",
      description:
        "Show git diff for a project. Can compare staged, unstaged, or specific commits.",
      parameters: {
        projectPath: {
          type: "string",
          description: "Path to the git repository",
          required: true,
        },
        staged: {
          type: "boolean",
          description: "Show staged changes only (default: false)",
          required: false,
        },
        file: {
          type: "string",
          description: "Specific file to diff",
          required: false,
        },
      },
    },
    {
      name: "git_branch",
      description: "List, create, or switch git branches.",
      parameters: {
        projectPath: {
          type: "string",
          description: "Path to the git repository",
          required: true,
        },
        action: {
          type: "string",
          description: "'list', 'create', 'checkout', or 'delete'",
          required: true,
        },
        branchName: {
          type: "string",
          description: "Branch name (required for create/checkout/delete)",
          required: false,
        },
      },
    },
    {
      name: "git_commit",
      description: "Create a git commit with all staged changes.",
      parameters: {
        projectPath: {
          type: "string",
          description: "Path to the git repository",
          required: true,
        },
        message: {
          type: "string",
          description: "Commit message",
          required: true,
        },
        addAll: {
          type: "boolean",
          description: "Stage all changes before committing (default: false)",
          required: false,
        },
      },
    },
    {
      name: "git_log",
      description: "Show git commit history.",
      parameters: {
        projectPath: {
          type: "string",
          description: "Path to the git repository",
          required: true,
        },
        limit: {
          type: "number",
          description: "Number of commits to show (default: 10)",
          required: false,
        },
      },
    },
    {
      name: "git_push",
      description: "Push commits to a remote repository.",
      parameters: {
        projectPath: {
          type: "string",
          description: "Path to the git repository",
          required: true,
        },
        remote: {
          type: "string",
          description: "Remote name (default: origin)",
          required: false,
        },
        branch: {
          type: "string",
          description: "Branch to push (default: current branch)",
          required: false,
        },
      },
    },
    {
      name: "git_pull",
      description: "Pull changes from a remote repository.",
      parameters: {
        projectPath: {
          type: "string",
          description: "Path to the git repository",
          required: true,
        },
      },
    },
    {
      name: "git_stash",
      description: "Stash or restore uncommitted changes.",
      parameters: {
        projectPath: {
          type: "string",
          description: "Path to the git repository",
          required: true,
        },
        action: {
          type: "string",
          description: "'save', 'pop', 'list', or 'drop'",
          required: true,
        },
        message: {
          type: "string",
          description: "Stash message (for save action)",
          required: false,
        },
      },
    },
    {
      name: "git_clone",
      description: "Clone a git repository.",
      parameters: {
        repoUrl: {
          type: "string",
          description: "URL of the repository to clone",
          required: true,
        },
        targetPath: {
          type: "string",
          description: "Local path to clone into",
          required: true,
        },
      },
    },
    {
      name: "git_init",
      description: "Initialize a new git repository.",
      parameters: {
        projectPath: {
          type: "string",
          description: "Path to initialize as a git repository",
          required: true,
        },
      },
    },
    {
      name: "git_create_pr",
      description: "Create a GitHub pull request using the gh CLI.",
      parameters: {
        projectPath: {
          type: "string",
          description: "Path to the git repository",
          required: true,
        },
        title: {
          type: "string",
          description: "PR title",
          required: true,
        },
        body: {
          type: "string",
          description: "PR description",
          required: true,
        },
        base: {
          type: "string",
          description: "Base branch (default: main)",
          required: false,
        },
      },
    },
    // === DEPLOYMENT TOOLS ===
    {
      name: "deploy_vercel",
      description: "Deploy a project to Vercel. Requires VERCEL_TOKEN env var.",
      parameters: {
        projectPath: {
          type: "string",
          description: "Path to the project to deploy",
          required: true,
        },
        prod: {
          type: "boolean",
          description:
            "Deploy to production (default: false, deploys to preview)",
          required: false,
        },
      },
    },
    {
      name: "deploy_railway",
      description:
        "Deploy a project to Railway. Requires RAILWAY_TOKEN env var.",
      parameters: {
        projectPath: {
          type: "string",
          description: "Path to the project to deploy",
          required: true,
        },
      },
    },
    {
      name: "docker_build",
      description: "Build a Docker image from a Dockerfile.",
      parameters: {
        projectPath: {
          type: "string",
          description: "Path to the project with Dockerfile",
          required: true,
        },
        imageName: {
          type: "string",
          description: "Name for the Docker image",
          required: true,
        },
        tag: {
          type: "string",
          description: "Image tag (default: latest)",
          required: false,
        },
      },
    },
    {
      name: "docker_push",
      description: "Push a Docker image to a registry.",
      parameters: {
        imageName: {
          type: "string",
          description:
            "Full image name including registry (e.g., docker.io/user/app:tag)",
          required: true,
        },
      },
    },
    {
      name: "docker_compose",
      description: "Run docker-compose commands (up, down, logs, ps).",
      parameters: {
        projectPath: {
          type: "string",
          description: "Path to the project with docker-compose.yml",
          required: true,
        },
        action: {
          type: "string",
          description: "'up', 'down', 'logs', 'ps', or 'restart'",
          required: true,
        },
        detach: {
          type: "boolean",
          description: "Run in detached mode for 'up' (default: true)",
          required: false,
        },
      },
    },
    {
      name: "generate_dockerfile",
      description:
        "Generate a Dockerfile for a project based on its framework/language.",
      parameters: {
        projectPath: {
          type: "string",
          description: "Path to the project",
          required: true,
        },
        framework: {
          type: "string",
          description:
            "Framework: 'node', 'python', 'react', 'nextjs', 'express', 'fastapi'",
          required: true,
        },
      },
    },
    {
      name: "check_deployment_health",
      description: "Check the health of a deployed application by URL.",
      parameters: {
        url: {
          type: "string",
          description: "URL of the deployed application",
          required: true,
        },
        expectedStatus: {
          type: "number",
          description: "Expected HTTP status code (default: 200)",
          required: false,
        },
      },
    },
    // === DEV TOOLS ===
    {
      name: "run_build",
      description:
        "Run the build command for a project (npm run build, pnpm build, etc.).",
      parameters: {
        projectPath: {
          type: "string",
          description: "Path to the project",
          required: true,
        },
      },
    },
    {
      name: "run_tests",
      description: "Run tests for a project (npm test, pytest, etc.).",
      parameters: {
        projectPath: {
          type: "string",
          description: "Path to the project",
          required: true,
        },
        testFile: {
          type: "string",
          description: "Specific test file to run",
          required: false,
        },
      },
    },
    {
      name: "run_typecheck",
      description: "Run TypeScript type checking on a project.",
      parameters: {
        projectPath: {
          type: "string",
          description: "Path to the project",
          required: true,
        },
      },
    },
    {
      name: "run_lint",
      description: "Run linting (ESLint, Prettier) on a project.",
      parameters: {
        projectPath: {
          type: "string",
          description: "Path to the project",
          required: true,
        },
      },
    },
    {
      name: "start_dev_server",
      description:
        "Start a development server for a project in the background.",
      parameters: {
        projectPath: {
          type: "string",
          description: "Path to the project",
          required: true,
        },
        port: {
          type: "number",
          description: "Port to run on (default: auto-detect)",
          required: false,
        },
      },
    },
    {
      name: "check_dev_server",
      description: "Check if a dev server is running on a port.",
      parameters: {
        port: {
          type: "number",
          description: "Port to check (default: 5173)",
          required: false,
        },
      },
    },
    // === BROWSER AUTOMATION TOOLS ===
    {
      name: "browser_session_start",
      description:
        "Start a new browser automation session. Returns a session ID for subsequent operations.",
      parameters: {
        url: {
          type: "string",
          description: "Initial URL to navigate to",
          required: true,
        },
        headless: {
          type: "boolean",
          description: "Run in headless mode (default: true)",
          required: false,
        },
      },
    },
    {
      name: "browser_click",
      description: "Click an element in the browser session.",
      parameters: {
        sessionId: {
          type: "string",
          description: "Browser session ID",
          required: true,
        },
        selector: {
          type: "string",
          description: "CSS selector or text content to click",
          required: true,
        },
      },
    },
    {
      name: "browser_fill",
      description: "Fill a form field in the browser session.",
      parameters: {
        sessionId: {
          type: "string",
          description: "Browser session ID",
          required: true,
        },
        selector: {
          type: "string",
          description: "CSS selector for the input field",
          required: true,
        },
        value: {
          type: "string",
          description: "Value to fill",
          required: true,
        },
      },
    },
    {
      name: "browser_navigate",
      description: "Navigate to a URL in the browser session.",
      parameters: {
        sessionId: {
          type: "string",
          description: "Browser session ID",
          required: true,
        },
        url: {
          type: "string",
          description: "URL to navigate to",
          required: true,
        },
      },
    },
    {
      name: "browser_screenshot",
      description: "Take a screenshot of the current page.",
      parameters: {
        sessionId: {
          type: "string",
          description: "Browser session ID",
          required: true,
        },
        fullPage: {
          type: "boolean",
          description: "Capture full page (default: false, viewport only)",
          required: false,
        },
      },
    },
    {
      name: "browser_get_content",
      description: "Get the text content of the current page.",
      parameters: {
        sessionId: {
          type: "string",
          description: "Browser session ID",
          required: true,
        },
      },
    },
    {
      name: "browser_wait_for",
      description: "Wait for an element to appear on the page.",
      parameters: {
        sessionId: {
          type: "string",
          description: "Browser session ID",
          required: true,
        },
        selector: {
          type: "string",
          description: "CSS selector to wait for",
          required: true,
        },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds (default: 30000)",
          required: false,
        },
      },
    },
    {
      name: "browser_session_end",
      description: "End a browser automation session and clean up resources.",
      parameters: {
        sessionId: {
          type: "string",
          description: "Browser session ID to close",
          required: true,
        },
      },
    },
    // === DATABASE TOOL ===
    {
      name: "database_query",
      description:
        "Execute a SQL query on the application database. Use with caution - prefer SELECT queries.",
      parameters: {
        query: {
          type: "string",
          description: "SQL query to execute",
          required: true,
        },
        params: {
          type: "array",
          description: "Query parameters for prepared statements",
          required: false,
        },
      },
    },
    // === INTEGRATION TOOLS ===
    {
      name: "slack_message",
      description:
        "Send a message to a Slack channel. Requires SLACK_WEBHOOK_URL env var.",
      parameters: {
        channel: {
          type: "string",
          description: "Slack channel name (e.g., #general)",
          required: true,
        },
        message: {
          type: "string",
          description: "Message to send",
          required: true,
        },
      },
    },
    {
      name: "github_create_issue",
      description: "Create a GitHub issue. Requires GITHUB_TOKEN env var.",
      parameters: {
        repo: {
          type: "string",
          description: "Repository in format owner/repo",
          required: true,
        },
        title: {
          type: "string",
          description: "Issue title",
          required: true,
        },
        body: {
          type: "string",
          description: "Issue body/description",
          required: true,
        },
        labels: {
          type: "array",
          description: "Labels to add to the issue",
          required: false,
        },
      },
    },
    {
      name: "github_create_pr",
      description:
        "Create a GitHub pull request. Requires GITHUB_TOKEN env var.",
      parameters: {
        repo: {
          type: "string",
          description: "Repository in format owner/repo",
          required: true,
        },
        title: {
          type: "string",
          description: "PR title",
          required: true,
        },
        body: {
          type: "string",
          description: "PR description",
          required: true,
        },
        head: {
          type: "string",
          description: "Branch containing changes",
          required: true,
        },
        base: {
          type: "string",
          description: "Base branch to merge into (default: main)",
          required: false,
        },
      },
    },
    {
      name: "github_api",
      description: "Make a GitHub API request. Requires GITHUB_TOKEN env var.",
      parameters: {
        endpoint: {
          type: "string",
          description: "API endpoint (e.g., /repos/owner/repo/issues)",
          required: true,
        },
        method: {
          type: "string",
          description: "HTTP method (default: GET)",
          required: false,
        },
        body: {
          type: "object",
          description: "Request body for POST/PUT/PATCH",
          required: false,
        },
      },
    },
    // === BACKGROUND/TMUX TOOLS ===
    {
      name: "tmux_start",
      description:
        "Start a long-running process in a tmux session (e.g., dev servers, watchers).",
      parameters: {
        sessionName: {
          type: "string",
          description: "Name for the tmux session",
          required: true,
        },
        command: {
          type: "string",
          description: "Command to run",
          required: true,
        },
        workingDirectory: {
          type: "string",
          description: "Working directory for the command",
          required: false,
        },
      },
    },
    {
      name: "tmux_output",
      description: "Get the recent output from a tmux session.",
      parameters: {
        sessionName: {
          type: "string",
          description: "Name of the tmux session",
          required: true,
        },
        lines: {
          type: "number",
          description: "Number of lines to retrieve (default: 50)",
          required: false,
        },
      },
    },
    {
      name: "tmux_send",
      description: "Send input to a running tmux session.",
      parameters: {
        sessionName: {
          type: "string",
          description: "Name of the tmux session",
          required: true,
        },
        input: {
          type: "string",
          description: "Input to send",
          required: true,
        },
        pressEnter: {
          type: "boolean",
          description: "Press Enter after input (default: true)",
          required: false,
        },
      },
    },
    {
      name: "tmux_stop",
      description: "Stop and kill a tmux session.",
      parameters: {
        sessionName: {
          type: "string",
          description: "Name of the tmux session to stop",
          required: true,
        },
      },
    },
    {
      name: "tmux_list",
      description: "List all active tmux sessions.",
      parameters: {},
    },
    // === AGENT TEAMS ===
    {
      name: "spawn_agent_team",
      description:
        "Spawn a team of specialized AI agents to work on a complex task in parallel. Use for tasks that benefit from multiple perspectives or parallel execution.",
      parameters: {
        task: {
          type: "string",
          description: "The task to delegate to the agent team",
          required: true,
        },
        teamSize: {
          type: "number",
          description: "Number of agents in the team (default: 3, max: 5)",
          required: false,
        },
        agentTypes: {
          type: "array",
          description:
            "Types of agents to include: 'code', 'research', 'sysadmin', 'data', 'reviewer'",
          required: false,
        },
      },
    },
    // === EVENT/MACRO TOOLS ===
    {
      name: "create_event_trigger",
      description:
        "Create an event trigger that runs a JARVIS task when conditions are met.",
      parameters: {
        name: {
          type: "string",
          description: "Name of the trigger",
          required: true,
        },
        triggerType: {
          type: "string",
          description: "'webhook', 'cron', or 'condition'",
          required: true,
        },
        condition: {
          type: "string",
          description: "Cron expression or condition definition",
          required: true,
        },
        taskPrompt: {
          type: "string",
          description: "The JARVIS task to run when triggered",
          required: true,
        },
      },
    },
    {
      name: "define_macro",
      description:
        "Define a reusable macro (sequence of tool calls) that can be executed later.",
      parameters: {
        name: {
          type: "string",
          description: "Name of the macro",
          required: true,
        },
        description: {
          type: "string",
          description: "What the macro does",
          required: true,
        },
        steps: {
          type: "array",
          description: "Array of tool calls to execute in sequence",
          required: true,
        },
      },
    },
    {
      name: "execute_macro",
      description: "Execute a previously defined macro.",
      parameters: {
        name: {
          type: "string",
          description: "Name of the macro to execute",
          required: true,
        },
        params: {
          type: "object",
          description: "Parameters to pass to the macro",
          required: false,
        },
      },
    },
    {
      name: "list_macros",
      description: "List all defined macros for the current user.",
      parameters: {},
    },
    {
      name: "list_event_triggers",
      description: "List all event triggers for the current user.",
      parameters: {},
    },
    {
      name: "search_memory",
      description:
        "Search your persistent memory for relevant experiences, knowledge, or procedures. Use this to recall past learnings.",
      parameters: {
        query: {
          type: "string",
          description: "What to search for in memory",
          required: true,
        },
        memoryTypes: {
          type: "array",
          description:
            "Types of memory to search: episodic (experiences), semantic (facts), procedural (how-to)",
          required: false,
        },
        limit: {
          type: "number",
          description: "Maximum results to return (default: 10)",
          required: false,
        },
      },
    },
    {
      name: "store_memory",
      description:
        "Store important information in persistent memory for future recall. Accepts simple text or structured objects.",
      parameters: {
        memoryType: {
          type: "string",
          description:
            "Type: episodic (experience/event), semantic (fact like 'X is Y'), procedural (how-to steps)",
          required: true,
        },
        content: {
          type: "string",
          description:
            "Memory content. Can be plain text like 'The capital of France is Paris' (auto-parsed) or JSON object with fields: {subject, predicate, object} for semantic, {title, description} for episodic, {name, steps} for procedural",
          required: true,
        },
      },
    },
    {
      name: "get_memory_stats",
      description: "Get statistics about your persistent memory system.",
      parameters: {},
    },
    {
      name: "connect_mcp_server",
      description:
        "Connect to an MCP (Model Context Protocol) server to access external tools like Slack, Jira, databases, etc.",
      parameters: {
        name: {
          type: "string",
          description: "Unique name for this server connection",
          required: true,
        },
        command: {
          type: "string",
          description:
            "Command to start the MCP server (e.g., npx, uvx, docker)",
          required: true,
        },
        args: {
          type: "array",
          description: "Command arguments",
          required: false,
        },
        env: {
          type: "object",
          description: "Environment variables for the server",
          required: false,
        },
      },
    },
    {
      name: "call_mcp_tool",
      description: "Call a tool from a connected MCP server.",
      parameters: {
        server: {
          type: "string",
          description: "Name of the connected MCP server",
          required: true,
        },
        tool: {
          type: "string",
          description: "Name of the tool to call",
          required: true,
        },
        arguments: {
          type: "object",
          description: "Arguments to pass to the tool",
          required: true,
        },
      },
    },
    {
      name: "list_mcp_tools",
      description: "List all available tools from connected MCP servers.",
      parameters: {},
    },
    {
      name: "list_mcp_servers",
      description: "List all connected MCP servers and their status.",
      parameters: {},
    },
    {
      name: "spawn_agent",
      description:
        "Spawn a specialized agent to work on a specific task. Use for complex work requiring expertise.",
      parameters: {
        type: {
          type: "string",
          description:
            "Agent type: code (programming), research (web research), sysadmin (servers), data (analysis), worker (general)",
          required: true,
        },
        name: {
          type: "string",
          description:
            "Unique name for this agent instance (e.g., 'DataFinder', 'CodeReviewer')",
          required: true,
        },
        task: {
          type: "string",
          description: "The task for the agent to complete",
          required: true,
        },
      },
    },
    {
      name: "list_agents",
      description:
        "List all active agents and their status for the current user.",
      parameters: {},
    },
    {
      name: "delegate_to_agent",
      description:
        "Quickly delegate a task to a specialized agent. The agent runs and terminates after completing.",
      parameters: {
        agentType: {
          type: "string",
          description: "Type: code, research, sysadmin, data, worker",
          required: true,
        },
        task: {
          type: "string",
          description: "The task to delegate",
          required: true,
        },
      },
    },
    {
      name: "self_review",
      description:
        "Review your own response before delivering. Use for complex or important tasks to ensure quality.",
      parameters: {
        originalTask: {
          type: "string",
          description: "The original user task/question",
          required: true,
        },
        proposedResponse: {
          type: "string",
          description: "Your proposed response to review",
          required: true,
        },
        toolsUsed: {
          type: "array",
          description: "List of tools used in completing the task",
          required: false,
        },
      },
    },
    // === SECURITY TOOLS ===
    {
      name: "npm_audit",
      description:
        "Run npm audit to check for security vulnerabilities in dependencies.",
      parameters: {
        projectPath: {
          type: "string",
          description: "Path to the project",
          required: true,
        },
      },
    },
    {
      name: "security_analysis",
      description:
        "Run a security analysis on a project checking for common vulnerabilities.",
      parameters: {
        projectPath: {
          type: "string",
          description: "Path to the project to analyze",
          required: true,
        },
      },
    },
    // === VISION/IMAGE ANALYSIS TOOLS ===
    {
      name: "analyze_image",
      description:
        "Analyze an image using AI vision capabilities. Can describe images, extract text (OCR), identify objects, analyze UI screenshots, read charts/graphs, and answer questions about visual content.",
      parameters: {
        imagePathOrUrl: {
          type: "string",
          description: "Path to local image file or URL of image to analyze",
          required: true,
        },
        question: {
          type: "string",
          description:
            "Question to ask about the image (e.g., 'What text is in this image?', 'Describe this UI', 'What are the values in this chart?')",
          required: true,
        },
      },
    },
    {
      name: "compare_images",
      description:
        "Compare two images and describe the differences. Useful for visual regression testing, before/after comparisons, and change detection.",
      parameters: {
        image1: {
          type: "string",
          description: "Path or URL of the first image",
          required: true,
        },
        image2: {
          type: "string",
          description: "Path or URL of the second image",
          required: true,
        },
        focusArea: {
          type: "string",
          description:
            "Specific aspect to focus on (e.g., 'layout', 'colors', 'text', 'overall')",
          required: false,
        },
      },
    },
    {
      name: "extract_text_from_image",
      description:
        "Extract all text content from an image using OCR (Optical Character Recognition). Returns structured text found in the image.",
      parameters: {
        imagePath: {
          type: "string",
          description: "Path to the image file",
          required: true,
        },
      },
    },
    // === PDF/DOCUMENT PROCESSING TOOLS ===
    {
      name: "read_pdf",
      description:
        "Extract text content from a PDF file. Can optionally extract from specific pages.",
      parameters: {
        pdfPath: {
          type: "string",
          description: "Path to the PDF file",
          required: true,
        },
        pages: {
          type: "string",
          description:
            "Page range to extract (e.g., '1-5', '1,3,5', 'all'). Default: all",
          required: false,
        },
      },
    },
    {
      name: "analyze_document",
      description:
        "Analyze a document (PDF, image, or text file) and answer questions about its content. Uses vision for PDFs with images/charts.",
      parameters: {
        documentPath: {
          type: "string",
          description: "Path to the document",
          required: true,
        },
        question: {
          type: "string",
          description: "Question to answer about the document",
          required: true,
        },
      },
    },
    {
      name: "convert_document",
      description:
        "Convert a document between formats (PDF to text, Markdown to HTML, etc.).",
      parameters: {
        inputPath: {
          type: "string",
          description: "Path to the input document",
          required: true,
        },
        outputFormat: {
          type: "string",
          description: "Output format: 'text', 'markdown', 'html', 'json'",
          required: true,
        },
        outputPath: {
          type: "string",
          description:
            "Path for the output file (optional, returns content if not provided)",
          required: false,
        },
      },
    },
    // === AUDIO/VIDEO PROCESSING TOOLS ===
    {
      name: "transcribe_audio",
      description:
        "Transcribe audio from a file to text using speech-to-text. Supports common audio formats (mp3, wav, m4a, webm, ogg).",
      parameters: {
        audioPath: {
          type: "string",
          description: "Path to the audio file",
          required: true,
        },
        language: {
          type: "string",
          description:
            "Language code (e.g., 'en', 'es', 'ja'). Default: auto-detect",
          required: false,
        },
      },
    },
    {
      name: "extract_audio_from_video",
      description:
        "Extract the audio track from a video file for transcription or processing.",
      parameters: {
        videoPath: {
          type: "string",
          description: "Path to the video file",
          required: true,
        },
        outputPath: {
          type: "string",
          description:
            "Path for the output audio file (default: same name with .mp3)",
          required: false,
        },
      },
    },
    {
      name: "generate_speech",
      description:
        "Convert text to speech audio using text-to-speech. Creates an audio file from text input.",
      parameters: {
        text: {
          type: "string",
          description: "Text to convert to speech",
          required: true,
        },
        outputPath: {
          type: "string",
          description: "Path for the output audio file",
          required: true,
        },
        voice: {
          type: "string",
          description:
            "Voice to use (default: 'alloy'). Options: alloy, echo, fable, onyx, nova, shimmer",
          required: false,
        },
      },
    },
  ];
}
