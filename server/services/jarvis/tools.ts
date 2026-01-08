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

const execAsync = promisify(exec);

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

// Sandbox directory for JARVIS operations
const JARVIS_SANDBOX = "/home/ubuntu/jarvis-workspace";

// Ensure sandbox directory exists
async function ensureSandbox(): Promise<void> {
  try {
    await fs.mkdir(JARVIS_SANDBOX, { recursive: true });
  } catch {
    // Directory may already exist
  }
}

/**
 * Web Search using Perplexity Sonar
 */
export async function webSearch(query: string): Promise<string> {
  const cached = await getCachedResult(query, "web_search", 24);
  if (cached) {
    return `[CACHED] ${cached}`;
  }

  if (!SONAR_API_KEY) {
    const searxngResult = await searxngSearch(query);
    if (!searxngResult.startsWith("SearXNG error")) {
      await setCachedResult(query, "searxng", searxngResult);
      return `[FALLBACK:SearXNG] ${searxngResult}`;
    }
    return "Error: No search providers available (Perplexity API key not configured, SearXNG unavailable)";
  }

  try {
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
          {
            role: "user",
            content: query,
          },
        ],
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const searxngResult = await searxngSearch(query);
      if (!searxngResult.startsWith("SearXNG error")) {
        await setCachedResult(query, "searxng", searxngResult);
        return `[FALLBACK:SearXNG] ${searxngResult}`;
      }
      return `Search error: ${await response.text()}`;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "No results found";

    const citations = data.citations || [];
    let result = content;
    if (citations.length > 0) {
      result = `${content}\n\nSources:\n${citations.map((c: string, i: number) => `${i + 1}. ${c}`).join("\n")}`;
    }

    await setCachedResult(query, "web_search", result);
    return result;
  } catch (error) {
    const searxngResult = await searxngSearch(query);
    if (!searxngResult.startsWith("SearXNG error")) {
      await setCachedResult(query, "searxng", searxngResult);
      return `[FALLBACK:SearXNG] ${searxngResult}`;
    }
    return `Search error: ${error instanceof Error ? error.message : String(error)}`;
  }
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

/**
 * Write file contents
 */
export async function writeFile(
  filePath: string,
  content: string
): Promise<string> {
  await ensureSandbox();

  // Resolve path relative to sandbox
  const resolvedPath = filePath.startsWith("/")
    ? filePath
    : path.join(JARVIS_SANDBOX, filePath);

  try {
    // Ensure parent directory exists
    await fs.mkdir(path.dirname(resolvedPath), { recursive: true });

    await fs.writeFile(resolvedPath, content, "utf-8");
    return `File written successfully: ${resolvedPath}`;
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
        const parts = result.error.split(":");
        return `APPROVAL_REQUIRED: This command requires your approval before execution.\nApproval ID: ${parts[1]}\nReason: ${parts[2]}\n\nPlease approve this action in the Hosts tab or respond with 'approve' to continue.`;
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

/**
 * Execute a tool by name
 */
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
    default:
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
  ];
}
