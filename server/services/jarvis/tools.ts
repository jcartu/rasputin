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

export async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  switch (name) {
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
      name: "git_clone",
      description: "Clone a Git repository to a local directory.",
      parameters: {
        repoUrl: {
          type: "string",
          description: "URL of the Git repository to clone",
          required: true,
        },
        outputPath: {
          type: "string",
          description: "Local directory to clone into",
          required: true,
        },
        branch: {
          type: "string",
          description: "Specific branch to clone",
          required: false,
        },
        depth: {
          type: "number",
          description: "Create a shallow clone with specified depth",
          required: false,
        },
      },
    },
    {
      name: "git_init",
      description: "Initialize a new Git repository in a directory.",
      parameters: {
        projectPath: {
          type: "string",
          description: "Path to initialize Git repository",
          required: true,
        },
        initialBranch: {
          type: "string",
          description: "Name for the initial branch (default: main)",
          required: false,
        },
      },
    },
    {
      name: "git_create_pr",
      description:
        "Create a GitHub Pull Request using the GitHub CLI (gh). Requires gh to be installed and authenticated.",
      parameters: {
        projectPath: {
          type: "string",
          description: "Path to the Git repository",
          required: true,
        },
        title: {
          type: "string",
          description: "PR title",
          required: true,
        },
        body: {
          type: "string",
          description: "PR description/body",
          required: true,
        },
        base: {
          type: "string",
          description: "Base branch (default: main)",
          required: false,
        },
        head: {
          type: "string",
          description: "Head branch (default: current branch)",
          required: false,
        },
        draft: {
          type: "boolean",
          description: "Create as draft PR",
          required: false,
        },
      },
    },
    {
      name: "npm_audit",
      description:
        "Run npm/pnpm security audit on a project to find vulnerable dependencies. Returns severity breakdown and remediation steps.",
      parameters: {
        projectPath: {
          type: "string",
          description: "Path to the project directory containing package.json",
          required: true,
        },
      },
    },
    {
      name: "security_analysis",
      description:
        "Comprehensive security analysis of a project including dependency audit, outdated package check, and security recommendations.",
      parameters: {
        projectPath: {
          type: "string",
          description: "Path to the project directory to analyze",
          required: true,
        },
      },
    },
    {
      name: "scaffold_project",
      description:
        "Create a new web application project with proper structure, config files, and boilerplate. Supports React, Next.js, Vue, Svelte, Express, FastAPI, and Rails.",
      parameters: {
        projectName: {
          type: "string",
          description: "Name of the project (will be used as folder name)",
          required: true,
        },
        projectType: {
          type: "string",
          description:
            "Type of project: react, nextjs, vue, svelte, express, fastapi, or rails",
          required: true,
        },
        outputPath: {
          type: "string",
          description:
            "Directory where the project will be created (default: /tmp/jarvis-projects)",
          required: false,
        },
        database: {
          type: "string",
          description: "Database type: postgresql, mysql, mongodb, or sqlite",
          required: false,
        },
        authentication: {
          type: "string",
          description: "Auth type: jwt, oauth, or session",
          required: false,
        },
        features: {
          type: "array",
          description: "List of features to include",
          required: false,
        },
      },
    },
    {
      name: "start_dev_server",
      description:
        "Start a development server for a project in the background. Returns session info for monitoring.",
      parameters: {
        projectPath: {
          type: "string",
          description: "Path to the project directory",
          required: true,
        },
        command: {
          type: "string",
          description: "Custom dev command (default: npm run dev)",
          required: false,
        },
      },
    },
    {
      name: "stop_dev_server",
      description: "Stop a running development server.",
      parameters: {
        projectPath: {
          type: "string",
          description: "Path to the project directory",
          required: true,
        },
      },
    },
    {
      name: "get_dev_server_output",
      description: "Get recent output from a running development server.",
      parameters: {
        projectPath: {
          type: "string",
          description: "Path to the project directory",
          required: true,
        },
      },
    },
    {
      name: "list_dev_servers",
      description:
        "List all currently running development servers with their ports and URLs.",
      parameters: {},
    },
    {
      name: "install_dependencies",
      description:
        "Install project dependencies using npm, pnpm, yarn, or bun.",
      parameters: {
        projectPath: {
          type: "string",
          description: "Path to the project directory",
          required: true,
        },
        packageManager: {
          type: "string",
          description:
            "Package manager to use: npm, pnpm, yarn, or bun (default: pnpm)",
          required: false,
        },
      },
    },
    {
      name: "deploy_vercel",
      description:
        "Deploy a project to Vercel. Requires Vercel CLI installed and authenticated.",
      parameters: {
        projectPath: {
          type: "string",
          description: "Path to the project directory",
          required: true,
        },
        prod: {
          type: "boolean",
          description: "Deploy to production (default: preview deployment)",
          required: false,
        },
        name: {
          type: "string",
          description: "Custom project name on Vercel",
          required: false,
        },
        env: {
          type: "object",
          description: "Environment variables to set during deployment",
          required: false,
        },
      },
    },
    {
      name: "deploy_railway",
      description:
        "Deploy a project to Railway. Requires Railway CLI installed and authenticated.",
      parameters: {
        projectPath: {
          type: "string",
          description: "Path to the project directory",
          required: true,
        },
        service: {
          type: "string",
          description: "Railway service name",
          required: false,
        },
        environment: {
          type: "string",
          description: "Target environment (e.g., production, staging)",
          required: false,
        },
      },
    },
    {
      name: "docker_build",
      description:
        "Build a Docker image for a project. Requires Docker installed.",
      parameters: {
        projectPath: {
          type: "string",
          description: "Path to the project directory containing Dockerfile",
          required: true,
        },
        tag: {
          type: "string",
          description: "Image tag (default: project-name:latest)",
          required: false,
        },
        dockerfile: {
          type: "string",
          description: "Path to Dockerfile (default: ./Dockerfile)",
          required: false,
        },
        buildArgs: {
          type: "object",
          description: "Build arguments as key-value pairs",
          required: false,
        },
        platform: {
          type: "string",
          description: "Target platform (e.g., linux/amd64, linux/arm64)",
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
          description: "Name of the image to push",
          required: true,
        },
        registry: {
          type: "string",
          description:
            "Registry URL (e.g., ghcr.io/username, docker.io/username)",
          required: false,
        },
      },
    },
    {
      name: "generate_dockerfile",
      description:
        "Generate a Dockerfile for a project based on its type (Node.js, Python, or static).",
      parameters: {
        projectPath: {
          type: "string",
          description: "Path to the project directory",
          required: true,
        },
        projectType: {
          type: "string",
          description:
            "Project type: node, python, or static (auto-detected if not specified)",
          required: false,
        },
        port: {
          type: "number",
          description: "Port to expose (default: 3000)",
          required: false,
        },
      },
    },
    {
      name: "docker_compose",
      description: "Run Docker Compose commands (up, down, logs, ps, build).",
      parameters: {
        projectPath: {
          type: "string",
          description: "Path to directory containing docker-compose.yml",
          required: true,
        },
        operation: {
          type: "string",
          description: "Operation: up, down, logs, ps, or build",
          required: true,
        },
        detach: {
          type: "boolean",
          description: "Run in detached mode (for 'up' operation)",
          required: false,
        },
        services: {
          type: "array",
          description: "Specific services to operate on",
          required: false,
        },
        follow: {
          type: "boolean",
          description: "Follow log output (for 'logs' operation)",
          required: false,
        },
      },
    },
    {
      name: "check_deployment_health",
      description:
        "Check if a deployed application is healthy by making an HTTP request.",
      parameters: {
        url: {
          type: "string",
          description: "URL to check",
          required: true,
        },
        timeout: {
          type: "number",
          description: "Request timeout in milliseconds (default: 10000)",
          required: false,
        },
        expectedStatus: {
          type: "number",
          description: "Expected HTTP status code (default: 200)",
          required: false,
        },
      },
    },
    ...getSelfEvolutionTools(),
  ];
}
