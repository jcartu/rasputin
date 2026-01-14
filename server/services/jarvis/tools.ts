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
import { getDb, createAgentFile } from "../../db";
import { sshHosts } from "../../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { getCachedResult, setCachedResult } from "../knowledgeCache";
import * as crypto from "crypto";
import { scaffoldProject, type ScaffoldConfig } from "../webApp/scaffolder";
import type { UILibrary } from "../webApp/uiComponents";
import { generateSchemaFromDescription } from "../webApp/schemaGenerator";
import {
  getTemplateByType,
  listTemplates,
  renderTemplate,
  validateTemplateVariables,
  type TemplateType,
} from "../webApp/documentTemplates";
import {
  getSelfEvolutionTools,
  executeSelfEvolutionTool,
} from "../selfEvolution/tools";
import {
  getSuggestedTasks,
  analyzeTaskPatterns,
  predictNextTasks,
} from "./predictiveTask";
import {
  proactiveMonitor,
  startProactiveMonitor,
  stopProactiveMonitor,
  type MonitorConfig,
} from "./proactiveMonitor";
import { runAgentTeam, type TeamCallback } from "./agentTeams";
import { webhookHandler } from "../events/webhookHandler";
import { eventExecutor } from "../events/eventExecutor";
import {
  createProcedureFromTask,
  findMatchingProcedure,
} from "./memoryIntegration";
import { generateConsensus } from "../consensus";
import { generateSynthesis } from "../synthesis";
import { SpeedTier } from "../../../shared/rasputin";
import {
  generateSearchQueries,
  scoreSourceCredibility,
  extractCitations,
  detectConflicts,
  formatResearchReport,
  shouldDeepen,
  generateFollowUpQueries,
  type ResearchSource,
  type Citation,
  type ResearchConflict,
  type DeepResearchResult,
} from "./deepResearch";
import { getMemoryService } from "../memory";
import {
  connectMCPServer,
  callMCPTool,
  listMCPTools,
  listMCPServers,
} from "../mcp/client";
import { agentManager } from "../multiAgent/agentManager";
import type { AgentType } from "../multiAgent/types";
import {
  executeInSandbox,
  executePythonInSandbox,
  executeNodeInSandbox,
  executeShellInSandbox,
  getSandboxStatus,
} from "../sandbox";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from "docx";
import PptxGenJS from "pptxgenjs";
import ExcelJS from "exceljs";
import {
  getDynamicTools,
  isDynamicTool,
  executeDynamicTool,
  loadDynamicToolsFromDatabase,
} from "../selfEvolution/toolGenerator";
import { getDesktopDaemon, parseAction, type Action } from "../desktop";
import { runVisionLoop, type VisionLoopConfig } from "../vision";

const execAsync = promisify(exec);
const USE_DOCKER_SANDBOX = process.env.USE_SANDBOX !== "false";

const MIME_TYPES: Record<string, string> = {
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".ts": "application/typescript",
  ".json": "application/json",
  ".xml": "application/xml",
  ".csv": "text/csv",
  ".pdf": "application/pdf",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".pptx":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".zip": "application/zip",
};

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

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

const JARVIS_SANDBOX = process.env.JARVIS_SANDBOX || "/tmp/jarvis-workspace";

async function ensureSandbox(): Promise<void> {
  try {
    await fs.mkdir(JARVIS_SANDBOX, { recursive: true });
  } catch {
    // Directory may already exist
  }
}

function resolveSandboxPath(filePath: string): string {
  if (filePath === "/workspace" || filePath.startsWith("/workspace/")) {
    return path.join(JARVIS_SANDBOX, filePath.replace(/^\/workspace\/?/, ""));
  }
  if (
    filePath.startsWith(JARVIS_SANDBOX + "/") ||
    filePath === JARVIS_SANDBOX
  ) {
    return filePath;
  }
  if (filePath.startsWith("/tmp/jarvis-workspace/")) {
    return filePath;
  }
  if (filePath.startsWith("/tmp/")) {
    const relativePath = filePath.replace(/^\/tmp\//, "");
    return path.join(JARVIS_SANDBOX, relativePath);
  }
  if (filePath.startsWith("/")) {
    return path.join(JARVIS_SANDBOX, filePath.substring(1));
  }
  // Strip jarvis-workspace prefix to avoid double-nesting
  const stripped = filePath.replace(/^jarvis-workspace\/?/, "");
  return path.join(JARVIS_SANDBOX, stripped);
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

const DEEP_RESEARCH_TIMEOUT_MS = 90_000;
const SEARCH_TIMEOUT_MS = 30_000;

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T
): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>(resolve => {
    timeoutId = setTimeout(() => resolve(fallback), ms);
  });
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch {
    clearTimeout(timeoutId!);
    return fallback;
  }
}

export async function deepResearch(
  topic: string,
  depth: number = 2,
  maxIterations: number = 3
): Promise<string> {
  const startTime = Date.now();
  const allSources: ResearchSource[] = [];
  const allCitations: Citation[] = [];
  const allConflicts: ResearchConflict[] = [];
  const iterationSummaries: string[] = [];
  let totalQueries = 0;
  let currentIteration = 0;
  let currentQuery = topic;

  while (currentIteration < maxIterations) {
    const remainingTime = DEEP_RESEARCH_TIMEOUT_MS - (Date.now() - startTime);
    if (remainingTime < 20_000) break;

    const queries = generateSearchQueries(currentQuery);
    const maxQueriesThisIteration = Math.min(
      queries.length,
      currentIteration === 0 ? depth + 2 : 2
    );
    totalQueries += maxQueriesThisIteration;

    const searchPromises = queries
      .slice(0, maxQueriesThisIteration)
      .map(async query => {
        const searchResult = await withTimeout(
          webSearch(query),
          SEARCH_TIMEOUT_MS,
          ""
        );
        if (!searchResult) return [];

        const urlMatches = searchResult.match(/https?:\/\/[^\s\]]+/g) || [];
        return urlMatches.slice(0, 3).map(url => {
          const { score, reason } = scoreSourceCredibility(url);
          return {
            url,
            title: url.split("/").slice(2, 3).join(""),
            snippet: searchResult.slice(0, 200),
            domain: new URL(url).hostname,
            credibilityScore: score,
            credibilityReason: reason,
            retrievedAt: Date.now(),
          } as ResearchSource;
        });
      });

    const searchResults = await withTimeout(
      Promise.all(searchPromises),
      remainingTime - 15_000,
      []
    );

    const iterationSources: ResearchSource[] = [];
    for (const resultSources of searchResults) {
      iterationSources.push(...resultSources);
    }

    const newSources = iterationSources.filter(
      s => !allSources.some(existing => existing.url === s.url)
    );
    allSources.push(...newSources);

    let iterationSynthesis = "";
    const synthesisTimeRemaining =
      DEEP_RESEARCH_TIMEOUT_MS - (Date.now() - startTime);

    if (synthesisTimeRemaining > 10_000 && newSources.length > 0) {
      try {
        const SONAR_API_KEY = process.env.SONAR_API_KEY || "";
        const synthesisResponse = await withTimeout(
          fetch("https://api.perplexity.ai/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SONAR_API_KEY}`,
            },
            body: JSON.stringify({
              model: "sonar-pro",
              messages: [
                {
                  role: "system",
                  content:
                    "You are a research synthesizer. Provide a comprehensive summary with citations. Note any gaps or areas needing more research. Identify conflicting claims.",
                },
                {
                  role: "user",
                  content: `Synthesize research on: ${currentQuery}\n\nIteration ${currentIteration + 1}/${maxIterations}\n\nNew sources:\n${newSources.map(s => `- ${s.url} (${s.credibilityReason})`).join("\n")}\n\n${currentIteration > 0 ? `Previous findings:\n${iterationSummaries.slice(-1).join("\n")}` : ""}`,
                },
              ],
              max_tokens: 2048,
            }),
          }),
          synthesisTimeRemaining - 5_000,
          null
        );

        if (synthesisResponse) {
          const data = await synthesisResponse.json();
          iterationSynthesis =
            data.choices?.[0]?.message?.content || "Unable to synthesize";
        }
      } catch {
        iterationSynthesis = "";
      }
    }

    if (!iterationSynthesis) {
      iterationSynthesis =
        `Iteration ${currentIteration + 1}: Found ${newSources.length} new sources on "${currentQuery}". Top sources:\n` +
        newSources
          .sort((a, b) => b.credibilityScore - a.credibilityScore)
          .slice(0, 3)
          .map(s => `- ${s.url} (${(s.credibilityScore * 100).toFixed(0)}%)`)
          .join("\n");
    }

    iterationSummaries.push(iterationSynthesis);

    const iterationCitations = extractCitations(iterationSynthesis, newSources);
    const iterationConflicts = detectConflicts(iterationCitations);
    allCitations.push(...iterationCitations);
    allConflicts.push(...iterationConflicts);

    currentIteration++;

    const unansweredQuestions = countUnansweredQuestions(iterationSynthesis);
    if (
      !shouldDeepen(
        currentIteration,
        maxIterations,
        allConflicts.length,
        unansweredQuestions
      )
    ) {
      break;
    }

    const followUps = generateFollowUpQueries(
      topic,
      iterationSynthesis,
      iterationConflicts
    );
    if (followUps.length === 0) {
      break;
    }

    currentQuery = followUps[0];
  }

  const uniqueSources = allSources.filter(
    (s, i, arr) => arr.findIndex(x => x.url === s.url) === i
  );

  const sourceCitationCount = new Map<string, number>();
  for (const citation of allCitations) {
    for (const source of citation.sources) {
      sourceCitationCount.set(
        source.url,
        (sourceCitationCount.get(source.url) || 0) + 1
      );
    }
  }

  for (const source of uniqueSources) {
    const citationCount = sourceCitationCount.get(source.url) || 0;
    if (citationCount > 1) {
      source.credibilityScore = Math.min(
        1.0,
        source.credibilityScore + citationCount * 0.02
      );
      source.credibilityReason += ` (cited ${citationCount}x)`;
    }
  }

  let finalSynthesis = iterationSummaries.join("\n\n---\n\n");
  if (currentIteration > 1) {
    finalSynthesis = `## Research Overview (${currentIteration} iterations)\n\n${finalSynthesis}`;
  }

  const uniqueConflicts = allConflicts.filter(
    (c, i, arr) => arr.findIndex(x => x.topic === c.topic) === i
  );

  const result: DeepResearchResult = {
    query: topic,
    sources: uniqueSources,
    citations: allCitations,
    conflicts: uniqueConflicts,
    synthesis: finalSynthesis,
    depth,
    totalQueries,
    researchTimeMs: Date.now() - startTime,
  };

  return formatResearchReport(result);
}

function countUnansweredQuestions(synthesis: string): number {
  const gapIndicators = [
    /\bunknown\b/gi,
    /\bunclear\b/gi,
    /\buncertain\b/gi,
    /\bmore research\b/gi,
    /\bneeds? (more |further )?investigation\b/gi,
    /\binsufficient (data|evidence|information)\b/gi,
    /\bno (clear |definitive )?(answer|consensus)\b/gi,
    /\?/g,
  ];

  let count = 0;
  for (const pattern of gapIndicators) {
    const matches = synthesis.match(pattern);
    if (matches) count += matches.length;
  }
  return Math.min(count, 10);
}

/**
 * Query multiple AI models in parallel and get a consensus answer.
 * Uses RASPUTIN's consensus mode to gather perspectives from GPT-5, Claude, Gemini, Grok, etc.
 */
export async function queryConsensus(
  query: string,
  speedTier: SpeedTier = "normal"
): Promise<string> {
  const startTime = Date.now();

  try {
    const result = await generateConsensus({
      query,
      speedTier,
      conversationHistory: [],
    });

    const modelSummaries = result.modelResponses
      .filter(r => r.status === "completed")
      .map(r => `**${r.modelName}**: ${r.content?.slice(0, 500)}...`)
      .join("\n\n");

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

    return `# Consensus Query Result

## Summary
${result.summary}

## Agreement Level
${result.agreementPercentage.toFixed(0)}% agreement across ${result.modelResponses.length} models

## Individual Model Responses
${modelSummaries}

## Stats
- Duration: ${durationSec}s
- Total tokens: ${result.totalTokens}
- Cost: $${result.totalCost.toFixed(4)}
- Speed tier: ${speedTier}`;
  } catch (error) {
    return `Error running consensus query: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Run a deep synthesis pipeline that gathers web data, queries multiple models,
 * extracts information, detects gaps, and produces a comprehensive synthesis.
 */
export async function querySynthesis(
  query: string,
  speedTier: SpeedTier = "normal"
): Promise<string> {
  const startTime = Date.now();

  try {
    const result = await generateSynthesis({
      query,
      speedTier,
      conversationHistory: [],
    });

    const stagesSummary = result.stages
      .map(s => `- ${s.stageName}: ${s.status} (${s.durationMs || 0}ms)`)
      .join("\n");

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

    return `# Synthesis Pipeline Result

## Final Synthesis
${result.finalSynthesis}

## Pipeline Stages
${stagesSummary}

## Web Search Results
${result.webSearchResults?.slice(0, 1000) || "No web search performed"}...

## Gaps Identified
${result.gapsIdentified?.length ? result.gapsIdentified.join("\n- ") : "None identified"}

## Conflicts Resolved
${result.conflictsResolved?.length ? result.conflictsResolved.join("\n- ") : "None identified"}

## Stats
- Duration: ${durationSec}s
- Total tokens: ${result.totalTokens}
- Cost: $${result.totalCost.toFixed(4)}
- Models queried: ${result.proposerResponses?.length || 0}
- Speed tier: ${speedTier}`;
  } catch (error) {
    return `Error running synthesis pipeline: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function executePython(code: string): Promise<string> {
  if (USE_DOCKER_SANDBOX) {
    const status = await getSandboxStatus();
    if (status.dockerAvailable && status.imageBuilt) {
      // Ensure sandbox directory exists on host for volume mounting
      await ensureSandbox();
      const result = await executePythonInSandbox(code, {
        timeoutMs: 30000,
        workspacePath: JARVIS_SANDBOX, // Mount shared workspace
      });
      if (result.success) {
        const output =
          result.stdout + (result.stderr ? `\nStderr: ${result.stderr}` : "");
        return output || "Code executed successfully (no output)";
      }
      return `Execution error:\n${result.stderr || result.error || ""}\nOutput:\n${result.stdout || ""}`;
    }
  }

  await ensureSandbox();

  const filename = `script_${Date.now()}.py`;
  const filepath = path.join(JARVIS_SANDBOX, filename);

  try {
    await fs.writeFile(filepath, code, "utf-8");

    const { stdout, stderr } = await execAsync(
      `cd ${JARVIS_SANDBOX} && timeout 30 python3 ${filename}`,
      { maxBuffer: 1024 * 1024 }
    );

    await fs.unlink(filepath).catch(() => {});

    const output = stdout + (stderr ? `\nStderr: ${stderr}` : "");
    return output || "Code executed successfully (no output)";
  } catch (error: unknown) {
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

export async function executeJavaScript(code: string): Promise<string> {
  if (USE_DOCKER_SANDBOX) {
    const status = await getSandboxStatus();
    if (status.dockerAvailable && status.imageBuilt) {
      await ensureSandbox();
      const result = await executeNodeInSandbox(code, {
        timeoutMs: 30000,
        workspacePath: JARVIS_SANDBOX,
      });
      if (result.success) {
        const output =
          result.stdout + (result.stderr ? `\nStderr: ${result.stderr}` : "");
        return output || "Code executed successfully (no output)";
      }
      return `Execution error:\n${result.stderr || result.error || ""}\nOutput:\n${result.stdout || ""}`;
    }
  }

  await ensureSandbox();

  const filename = `script_${Date.now()}.mjs`;
  const filepath = path.join(JARVIS_SANDBOX, filename);

  try {
    await fs.writeFile(filepath, code, "utf-8");

    const { stdout, stderr } = await execAsync(
      `cd ${JARVIS_SANDBOX} && timeout 30 node ${filename}`,
      { maxBuffer: 1024 * 1024 }
    );

    await fs.unlink(filepath).catch(() => {});

    const output = stdout + (stderr ? `\nStderr: ${stderr}` : "");
    return output || "Code executed successfully (no output)";
  } catch (error: unknown) {
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

export async function runShell(command: string): Promise<string> {
  if (USE_DOCKER_SANDBOX) {
    const status = await getSandboxStatus();
    if (status.dockerAvailable && status.imageBuilt) {
      await ensureSandbox();
      const result = await executeShellInSandbox(command, {
        timeoutMs: 60000,
        workspacePath: JARVIS_SANDBOX,
      });
      if (result.success) {
        const output =
          result.stdout + (result.stderr ? `\nStderr: ${result.stderr}` : "");
        return output || "Command executed successfully (no output)";
      }
      return `Command error:\n${result.stderr || result.error || ""}\nOutput:\n${result.stdout || ""}`;
    }
  }

  await ensureSandbox();

  const dangerousPatterns = [
    /rm\s+-rf\s+\//,
    /mkfs/,
    /dd\s+if=.*of=\/dev/,
    />\s*\/dev\/sd/,
    /shutdown/,
    /reboot/,
    /init\s+0/,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(command)) {
      return "Error: This command is blocked for security reasons";
    }
  }

  try {
    const { stdout, stderr } = await execAsync(
      `cd ${JARVIS_SANDBOX} && timeout 60 ${command}`,
      { maxBuffer: 1024 * 1024 * 5 }
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

  const resolvedPath = resolveSandboxPath(filePath);

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
  content: string,
  options?: { taskId?: number; userId?: number }
): Promise<string> {
  await ensureSandbox();

  const resolvedPath = resolveSandboxPath(filePath);

  try {
    await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
    await fs.writeFile(resolvedPath, content, "utf-8");

    const verified = await verifyFileCreated(resolvedPath);
    if (!verified) {
      return `Warning: File write reported success but verification failed: ${resolvedPath}`;
    }

    const stats = await fs.stat(resolvedPath);

    // Register file to database if taskId and userId provided
    if (options?.taskId && options?.userId) {
      try {
        await createAgentFile({
          taskId: options.taskId,
          userId: options.userId,
          fileName: path.basename(resolvedPath),
          filePath: resolvedPath,
          mimeType: getMimeType(resolvedPath),
          fileSize: stats.size,
          source: "generated",
        });
      } catch (dbError) {
        console.warn(
          "[writeFile] Failed to register file to database:",
          dbError
        );
        // Don't fail the write if DB registration fails
      }
    }

    return `File written and verified: ${resolvedPath} (${stats.size} bytes)`;
  } catch (error) {
    return `Error writing file: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function writeDocx(
  filePath: string,
  content: string,
  title?: string,
  options?: { taskId?: number; userId?: number }
): Promise<string> {
  await ensureSandbox();

  const resolvedPath = resolveSandboxPath(filePath);

  const finalPath = resolvedPath.endsWith(".docx")
    ? resolvedPath
    : resolvedPath + ".docx";

  try {
    await fs.mkdir(path.dirname(finalPath), { recursive: true });

    const children: Paragraph[] = [];

    if (title) {
      children.push(
        new Paragraph({
          text: title,
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
        })
      );
      children.push(new Paragraph({ text: "" }));
    }

    const lines = content.split("\n");
    for (const line of lines) {
      if (line.startsWith("# ")) {
        children.push(
          new Paragraph({
            text: line.substring(2),
            heading: HeadingLevel.HEADING_1,
          })
        );
      } else if (line.startsWith("## ")) {
        children.push(
          new Paragraph({
            text: line.substring(3),
            heading: HeadingLevel.HEADING_2,
          })
        );
      } else if (line.startsWith("### ")) {
        children.push(
          new Paragraph({
            text: line.substring(4),
            heading: HeadingLevel.HEADING_3,
          })
        );
      } else if (line.startsWith("- ") || line.startsWith("* ")) {
        children.push(
          new Paragraph({
            text: line.substring(2),
            bullet: { level: 0 },
          })
        );
      } else if (line.trim() === "") {
        children.push(new Paragraph({ text: "" }));
      } else {
        const runs: TextRun[] = [];
        let remaining = line;

        while (remaining.length > 0) {
          const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
          const italicMatch = remaining.match(/\*(.+?)\*/);

          if (boldMatch && boldMatch.index === 0) {
            runs.push(new TextRun({ text: boldMatch[1], bold: true }));
            remaining = remaining.substring(boldMatch[0].length);
          } else if (
            italicMatch &&
            italicMatch.index === 0 &&
            !remaining.startsWith("**")
          ) {
            runs.push(new TextRun({ text: italicMatch[1], italics: true }));
            remaining = remaining.substring(italicMatch[0].length);
          } else {
            const nextBold = remaining.indexOf("**");
            const nextItalic = remaining.indexOf("*");
            let endIdx = remaining.length;

            if (nextBold > 0) endIdx = Math.min(endIdx, nextBold);
            if (nextItalic > 0 && !remaining.startsWith("**"))
              endIdx = Math.min(endIdx, nextItalic);

            runs.push(new TextRun({ text: remaining.substring(0, endIdx) }));
            remaining = remaining.substring(endIdx);
          }
        }

        children.push(new Paragraph({ children: runs }));
      }
    }

    const doc = new Document({
      sections: [{ children }],
    });

    const buffer = await Packer.toBuffer(doc);
    await fs.writeFile(finalPath, buffer);

    const stats = await fs.stat(finalPath);

    if (options?.taskId && options?.userId) {
      try {
        await createAgentFile({
          taskId: options.taskId,
          userId: options.userId,
          fileName: path.basename(finalPath),
          filePath: finalPath,
          mimeType: getMimeType(finalPath),
          fileSize: stats.size,
          source: "generated",
        });
      } catch (dbError) {
        console.warn(
          "[writeDocx] Failed to register file to database:",
          dbError
        );
      }
    }

    return `Word document created: ${finalPath} (${stats.size} bytes, ${lines.length} lines)`;
  } catch (error) {
    return `Error creating Word document: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Slide definition for PPTX generation
 */
interface SlideDefinition {
  title?: string;
  subtitle?: string;
  content?: string | string[];
  notes?: string;
  layout?: "title" | "content" | "section" | "blank";
  image?: { path: string; x?: number; y?: number; w?: number; h?: number };
}

/**
 * Create a PowerPoint presentation (.pptx) from slide definitions
 */
export async function writePptx(
  filePath: string,
  slides: SlideDefinition[] | unknown,
  options?: {
    title?: string;
    author?: string;
    subject?: string;
    taskId?: number;
    userId?: number;
  }
): Promise<string> {
  await ensureSandbox();

  const resolvedPath = resolveSandboxPath(filePath);

  const finalPath = resolvedPath.endsWith(".pptx")
    ? resolvedPath
    : resolvedPath + ".pptx";

  let slideArray: SlideDefinition[];
  if (typeof slides === "string") {
    try {
      slideArray = JSON.parse(slides) as SlideDefinition[];
    } catch {
      return `Error: slides must be a valid array. Received string that couldn't be parsed as JSON.`;
    }
  } else if (!Array.isArray(slides)) {
    return `Error: slides must be an array. Received: ${typeof slides}`;
  } else {
    slideArray = slides as SlideDefinition[];
  }

  if (slideArray.length === 0) {
    return `Error: slides array cannot be empty. Provide at least one slide.`;
  }

  try {
    await fs.mkdir(path.dirname(finalPath), { recursive: true });

    const pptx = new PptxGenJS();

    // Set presentation metadata
    if (options?.title) pptx.title = options.title;
    if (options?.author) pptx.author = options.author;
    if (options?.subject) pptx.subject = options.subject;
    pptx.company = "RASPUTIN JARVIS";

    // Define master slide layouts
    pptx.defineSlideMaster({
      title: "TITLE_SLIDE",
      background: { color: "1e3a5f" },
      objects: [
        {
          placeholder: {
            options: {
              name: "title",
              type: "title",
              x: 0.5,
              y: 2.5,
              w: 9,
              h: 1.5,
            },
            text: "(title)",
          },
        },
        {
          placeholder: {
            options: {
              name: "subtitle",
              type: "body",
              x: 0.5,
              y: 4,
              w: 9,
              h: 1,
            },
            text: "(subtitle)",
          },
        },
      ],
    });

    for (let i = 0; i < slideArray.length; i++) {
      const slideData = slideArray[i];
      const slide = pptx.addSlide();

      // Determine slide layout and styling
      const isFirstSlide = i === 0;
      const isSectionSlide = slideData.layout === "section";
      const isBlankSlide = slideData.layout === "blank";

      if (isFirstSlide || slideData.layout === "title") {
        // Title slide styling
        slide.background = { color: "1e3a5f" };

        if (slideData.title) {
          slide.addText(slideData.title, {
            x: 0.5,
            y: 2.2,
            w: 9,
            h: 1.2,
            fontSize: 44,
            bold: true,
            color: "FFFFFF",
            align: "center",
          });
        }

        if (slideData.subtitle) {
          slide.addText(slideData.subtitle, {
            x: 0.5,
            y: 3.5,
            w: 9,
            h: 0.8,
            fontSize: 24,
            color: "B8D4E8",
            align: "center",
          });
        }
      } else if (isSectionSlide) {
        // Section divider slide
        slide.background = { color: "2d5a7b" };

        if (slideData.title) {
          slide.addText(slideData.title, {
            x: 0.5,
            y: 2.5,
            w: 9,
            h: 1,
            fontSize: 36,
            bold: true,
            color: "FFFFFF",
            align: "center",
          });
        }
      } else if (!isBlankSlide) {
        // Content slide
        if (slideData.title) {
          slide.addText(slideData.title, {
            x: 0.5,
            y: 0.3,
            w: 9,
            h: 0.8,
            fontSize: 28,
            bold: true,
            color: "1e3a5f",
          });
        }

        if (slideData.content) {
          const contentItems = Array.isArray(slideData.content)
            ? slideData.content
            : slideData.content.split("\n").filter(line => line.trim());

          // Check if content is bullet points
          const hasBullets = contentItems.some(
            item =>
              item.trim().startsWith("-") ||
              item.trim().startsWith("•") ||
              item.trim().startsWith("*")
          );

          if (hasBullets || contentItems.length > 1) {
            // Render as bullet list
            const bulletItems = contentItems.map(item => {
              const text = item
                .trim()
                .replace(/^[-•*]\s*/, "")
                .trim();
              return { text, options: { bullet: true, indentLevel: 0 } };
            });

            slide.addText(
              bulletItems.map(item => ({
                text: item.text,
                options: {
                  bullet: { type: "bullet" },
                  fontSize: 18,
                  color: "333333",
                  paraSpaceBefore: 8,
                  paraSpaceAfter: 8,
                },
              })),
              {
                x: 0.5,
                y: 1.3,
                w: 9,
                h: 4.5,
                valign: "top",
              }
            );
          } else {
            // Render as paragraph
            slide.addText(contentItems.join("\n"), {
              x: 0.5,
              y: 1.3,
              w: 9,
              h: 4.5,
              fontSize: 18,
              color: "333333",
              valign: "top",
            });
          }
        }
      }

      // Add image if provided
      if (slideData.image) {
        try {
          const imgPath = slideData.image.path.startsWith("/")
            ? slideData.image.path
            : path.join(JARVIS_SANDBOX, slideData.image.path);

          slide.addImage({
            path: imgPath,
            x: slideData.image.x ?? 3,
            y: slideData.image.y ?? 2,
            w: slideData.image.w ?? 4,
            h: slideData.image.h ?? 3,
          });
        } catch {
          // Skip image if it can't be loaded
        }
      }

      // Add speaker notes if provided
      if (slideData.notes) {
        slide.addNotes(slideData.notes);
      }
    }

    await pptx.writeFile({ fileName: finalPath });

    const stats = await fs.stat(finalPath);

    if (options?.taskId && options?.userId) {
      try {
        await createAgentFile({
          taskId: options.taskId,
          userId: options.userId,
          fileName: path.basename(finalPath),
          filePath: finalPath,
          mimeType: getMimeType(finalPath),
          fileSize: stats.size,
          source: "generated",
        });
      } catch (dbError) {
        console.warn(
          "[writePptx] Failed to register file to database:",
          dbError
        );
      }
    }

    return `PowerPoint presentation created: ${finalPath} (${stats.size} bytes, ${slideArray.length} slides)`;
  } catch (error) {
    return `Error creating PowerPoint: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Sheet definition for XLSX generation
 */
interface SheetDefinition {
  name: string;
  headers?: string[];
  data?: (string | number | boolean | null)[][];
  columnWidths?: number[];
  formulas?: Array<{
    cell: string;
    formula: string;
  }>;
  styles?: {
    headerStyle?: {
      bold?: boolean;
      fill?: string;
      color?: string;
    };
  };
}

/**
 * Create an Excel spreadsheet (.xlsx) from sheet definitions
 */
export async function writeXlsx(
  filePath: string,
  sheets: SheetDefinition[] | unknown,
  options?: {
    creator?: string;
    title?: string;
    taskId?: number;
    userId?: number;
  }
): Promise<string> {
  await ensureSandbox();

  const resolvedPath = resolveSandboxPath(filePath);

  const finalPath = resolvedPath.endsWith(".xlsx")
    ? resolvedPath
    : resolvedPath + ".xlsx";

  let sheetArray: SheetDefinition[];
  if (typeof sheets === "string") {
    try {
      sheetArray = JSON.parse(sheets) as SheetDefinition[];
    } catch {
      return `Error: sheets must be a valid array. Received string that couldn't be parsed as JSON.`;
    }
  } else if (!Array.isArray(sheets)) {
    return `Error: sheets must be an array. Received: ${typeof sheets}`;
  } else {
    sheetArray = sheets as SheetDefinition[];
  }

  if (sheetArray.length === 0) {
    return `Error: sheets array cannot be empty. Provide at least one sheet.`;
  }

  try {
    await fs.mkdir(path.dirname(finalPath), { recursive: true });

    const workbook = new ExcelJS.Workbook();

    // Set workbook metadata
    workbook.creator = options?.creator || "RASPUTIN JARVIS";
    workbook.created = new Date();
    workbook.modified = new Date();
    if (options?.title) {
      workbook.title = options.title;
    }

    for (const sheetDef of sheetArray) {
      const worksheet = workbook.addWorksheet(sheetDef.name);

      // Set column widths if provided
      if (sheetDef.columnWidths) {
        sheetDef.columnWidths.forEach((width, index) => {
          worksheet.getColumn(index + 1).width = width;
        });
      }

      // Add headers if provided
      if (sheetDef.headers && sheetDef.headers.length > 0) {
        const headerRow = worksheet.addRow(sheetDef.headers);

        // Style headers
        headerRow.eachCell(cell => {
          cell.font = {
            bold: sheetDef.styles?.headerStyle?.bold ?? true,
            color: {
              argb: sheetDef.styles?.headerStyle?.color || "FFFFFFFF",
            },
          };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: {
              argb: sheetDef.styles?.headerStyle?.fill || "FF1e3a5f",
            },
          };
          cell.alignment = { horizontal: "center", vertical: "middle" };
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        });

        // Auto-fit column widths based on headers if not specified
        if (!sheetDef.columnWidths) {
          sheetDef.headers.forEach((header, index) => {
            const column = worksheet.getColumn(index + 1);
            column.width = Math.max(header.length + 2, 10);
          });
        }
      }

      // Add data rows
      if (sheetDef.data && sheetDef.data.length > 0) {
        for (const rowData of sheetDef.data) {
          const row = worksheet.addRow(rowData);

          // Add light styling to data rows
          row.eachCell(cell => {
            cell.border = {
              top: { style: "thin", color: { argb: "FFE0E0E0" } },
              left: { style: "thin", color: { argb: "FFE0E0E0" } },
              bottom: { style: "thin", color: { argb: "FFE0E0E0" } },
              right: { style: "thin", color: { argb: "FFE0E0E0" } },
            };
          });
        }

        // Update column widths based on data if not specified
        if (!sheetDef.columnWidths && !sheetDef.headers) {
          const maxCols = Math.max(...sheetDef.data.map(row => row.length));
          for (let i = 0; i < maxCols; i++) {
            const maxLength = Math.max(
              ...sheetDef.data.map(row =>
                row[i] != null ? String(row[i]).length : 0
              )
            );
            worksheet.getColumn(i + 1).width = Math.max(maxLength + 2, 10);
          }
        }
      }

      // Add formulas if provided
      if (sheetDef.formulas && sheetDef.formulas.length > 0) {
        for (const formulaDef of sheetDef.formulas) {
          const cell = worksheet.getCell(formulaDef.cell);
          cell.value = { formula: formulaDef.formula };
          cell.font = { bold: true };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFF9C4" },
          };
        }
      }

      // Freeze the header row
      if (sheetDef.headers && sheetDef.headers.length > 0) {
        worksheet.views = [{ state: "frozen", ySplit: 1 }];
      }
    }

    await workbook.xlsx.writeFile(finalPath);

    const stats = await fs.stat(finalPath);
    const sheetNames = sheetArray.map(s => s.name).join(", ");
    const totalRows = sheetArray.reduce(
      (sum, s) => sum + (s.data?.length || 0) + (s.headers ? 1 : 0),
      0
    );

    if (options?.taskId && options?.userId) {
      try {
        await createAgentFile({
          taskId: options.taskId,
          userId: options.userId,
          fileName: path.basename(finalPath),
          filePath: finalPath,
          mimeType: getMimeType(finalPath),
          fileSize: stats.size,
          source: "generated",
        });
      } catch (dbError) {
        console.warn(
          "[writeXlsx] Failed to register file to database:",
          dbError
        );
      }
    }

    return `Excel spreadsheet created: ${finalPath} (${stats.size} bytes, ${sheetArray.length} sheet(s): ${sheetNames}, ${totalRows} total rows)`;
  } catch (error) {
    return `Error creating Excel spreadsheet: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function listFiles(dirPath: string): Promise<string> {
  await ensureSandbox();

  const resolvedPath = resolveSandboxPath(dirPath);

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
 * Also saves image to JARVIS workspace for sandbox accessibility
 */
export async function generateImageTool(prompt: string): Promise<string> {
  try {
    await ensureSandbox();
    const result = await generateImage({ prompt });

    if (result.url) {
      // Try to download and save the image to the workspace for sandbox access
      let workspacePath: string | undefined;
      let base64Data: string | undefined;

      try {
        // If it's a local file path, read it directly
        if (result.url.includes("/generated/")) {
          const filename = result.url.split("/generated/")[1];
          if (filename) {
            const localPath = path.join(
              process.cwd(),
              "public",
              "generated",
              filename
            );
            const buffer = await fs.readFile(localPath);
            base64Data = buffer.toString("base64");

            // Also save to workspace
            const wsFilename = `image_${Date.now()}_${crypto.randomBytes(4).toString("hex")}.png`;
            workspacePath = path.join(JARVIS_SANDBOX, wsFilename);
            await fs.writeFile(workspacePath, buffer);
          }
        } else {
          // Fetch from URL
          const imageResponse = await fetch(result.url);
          if (imageResponse.ok) {
            const buffer = Buffer.from(await imageResponse.arrayBuffer());
            base64Data = buffer.toString("base64");

            const wsFilename = `image_${Date.now()}_${crypto.randomBytes(4).toString("hex")}.png`;
            workspacePath = path.join(JARVIS_SANDBOX, wsFilename);
            await fs.writeFile(workspacePath, buffer);
          }
        }
      } catch (downloadError) {
        console.error(
          "[generateImageTool] Error processing image:",
          downloadError
        );
      }

      const pathInfo = workspacePath
        ? `\nWorkspace path: ${workspacePath}`
        : "\nNote: Image could not be saved to workspace (use URL instead)";

      // Return both URL and base64 data URL for reliable display
      const dataUrl = base64Data
        ? `data:image/png;base64,${base64Data}`
        : undefined;

      return `Image generated successfully!\n\nURL: ${result.url}${dataUrl ? `\nData URL: ${dataUrl}` : ""}${pathInfo}\n\nPrompt used: ${prompt}`;
    } else {
      return "Image generation failed - no URL returned";
    }
  } catch (error) {
    return `Image generation error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

type ChartData = {
  label: string;
  value: number;
  color?: string;
};

type FlowchartNode = {
  id: string;
  label: string;
  type?: "start" | "end" | "process" | "decision";
};

type FlowchartEdge = {
  from: string;
  to: string;
  label?: string;
};

type TimelineEvent = {
  date: string;
  title: string;
  description?: string;
};

type StatCard = {
  label: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
};

type ScatterPoint = {
  x: number;
  y: number;
  label?: string;
  color?: string;
  size?: number;
};

type RichReportSection = {
  type:
    | "heading"
    | "paragraph"
    | "list"
    | "image"
    | "table"
    | "pie_chart"
    | "bar_chart"
    | "line_chart"
    | "scatter_chart"
    | "area_chart"
    | "gauge_chart"
    | "donut_chart"
    | "flowchart"
    | "timeline"
    | "stat_cards"
    | "progress_bar"
    | "callout"
    | "quote"
    | "comparison"
    | "code";
  level?: number;
  content?: string;
  imagePrompt?: string;
  items?: string[];
  rows?: string[][];
  chartData?: ChartData[];
  chartTitle?: string;
  scatterPoints?: ScatterPoint[];
  xAxisLabel?: string;
  yAxisLabel?: string;
  gaugeValue?: number;
  gaugeMax?: number;
  gaugeLabel?: string;
  flowNodes?: FlowchartNode[];
  flowEdges?: FlowchartEdge[];
  timelineEvents?: TimelineEvent[];
  statCards?: StatCard[];
  progress?: number;
  progressLabel?: string;
  calloutType?: "info" | "warning" | "success" | "error";
  quoteAuthor?: string;
  comparisonItems?: Array<{
    name: string;
    features: Record<string, boolean | string>;
  }>;
  language?: string;
};

type RichReportOptions = {
  title: string;
  subtitle?: string;
  sections: RichReportSection[];
  style?: "medical" | "business" | "technical" | "modern" | "executive";
  includeTableOfContents?: boolean;
  headerImage?: string;
  author?: string;
  date?: string;
};

const CHART_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f43f5e",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
];

let chartIdCounter = 0;

function generateEChartsDiv(
  chartType: string,
  data: ChartData[] | ScatterPoint[],
  title?: string,
  options?: {
    xAxisLabel?: string;
    yAxisLabel?: string;
    gaugeValue?: number;
    gaugeMax?: number;
    gaugeLabel?: string;
  }
): string {
  const chartId = `chart_${++chartIdCounter}_${Date.now()}`;
  const height = chartType === "gauge" ? "280px" : "350px";

  let echartsOption: Record<string, unknown>;

  switch (chartType) {
    case "pie":
      echartsOption = {
        title: title
          ? { text: title, left: "center", textStyle: { fontSize: 16 } }
          : undefined,
        tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
        legend: { orient: "vertical", right: 10, top: "center" },
        series: [
          {
            type: "pie",
            radius: "65%",
            center: ["40%", "50%"],
            data: (data as ChartData[]).map((d, i) => ({
              name: d.label,
              value: d.value,
              itemStyle: {
                color: d.color || CHART_COLORS[i % CHART_COLORS.length],
              },
            })),
            emphasis: {
              itemStyle: {
                shadowBlur: 10,
                shadowOffsetX: 0,
                shadowColor: "rgba(0,0,0,0.5)",
              },
            },
            animationType: "scale",
            animationEasing: "elasticOut",
          },
        ],
      };
      break;

    case "donut":
      echartsOption = {
        title: title
          ? { text: title, left: "center", textStyle: { fontSize: 16 } }
          : undefined,
        tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
        legend: { orient: "vertical", right: 10, top: "center" },
        series: [
          {
            type: "pie",
            radius: ["45%", "70%"],
            center: ["40%", "50%"],
            avoidLabelOverlap: false,
            itemStyle: {
              borderRadius: 10,
              borderColor: "#fff",
              borderWidth: 2,
            },
            label: {
              show: true,
              position: "center",
              fontSize: 24,
              fontWeight: "bold",
              formatter: () =>
                (data as ChartData[])
                  .reduce((s, d) => s + d.value, 0)
                  .toString(),
            },
            emphasis: { label: { show: true, fontSize: 28 } },
            labelLine: { show: false },
            data: (data as ChartData[]).map((d, i) => ({
              name: d.label,
              value: d.value,
              itemStyle: {
                color: d.color || CHART_COLORS[i % CHART_COLORS.length],
              },
            })),
            animationType: "scale",
            animationEasing: "elasticOut",
          },
        ],
      };
      break;

    case "bar":
      echartsOption = {
        title: title
          ? { text: title, left: "center", textStyle: { fontSize: 16 } }
          : undefined,
        tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
        grid: { left: "3%", right: "4%", bottom: "15%", containLabel: true },
        xAxis: {
          type: "category",
          data: (data as ChartData[]).map(d => d.label),
          axisLabel: { rotate: 30, interval: 0 },
        },
        yAxis: { type: "value", name: options?.yAxisLabel },
        series: [
          {
            type: "bar",
            data: (data as ChartData[]).map((d, i) => ({
              value: d.value,
              itemStyle: {
                color: d.color || CHART_COLORS[i % CHART_COLORS.length],
                borderRadius: [4, 4, 0, 0],
              },
            })),
            animationDelay: (idx: number) => idx * 50,
          },
        ],
      };
      break;

    case "line":
      echartsOption = {
        title: title
          ? { text: title, left: "center", textStyle: { fontSize: 16 } }
          : undefined,
        tooltip: { trigger: "axis" },
        grid: { left: "3%", right: "4%", bottom: "10%", containLabel: true },
        xAxis: {
          type: "category",
          data: (data as ChartData[]).map(d => d.label),
          boundaryGap: false,
        },
        yAxis: { type: "value", name: options?.yAxisLabel },
        series: [
          {
            type: "line",
            data: (data as ChartData[]).map(d => d.value),
            smooth: true,
            symbol: "circle",
            symbolSize: 8,
            lineStyle: { width: 3, color: "#6366f1" },
            itemStyle: { color: "#6366f1" },
            areaStyle: {
              color: {
                type: "linear",
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: "rgba(99,102,241,0.4)" },
                  { offset: 1, color: "rgba(99,102,241,0.05)" },
                ],
              },
            },
          },
        ],
      };
      break;

    case "area":
      echartsOption = {
        title: title
          ? { text: title, left: "center", textStyle: { fontSize: 16 } }
          : undefined,
        tooltip: { trigger: "axis" },
        grid: { left: "3%", right: "4%", bottom: "10%", containLabel: true },
        xAxis: {
          type: "category",
          data: (data as ChartData[]).map(d => d.label),
          boundaryGap: false,
        },
        yAxis: { type: "value" },
        series: [
          {
            type: "line",
            data: (data as ChartData[]).map(d => d.value),
            smooth: true,
            symbol: "none",
            lineStyle: { width: 2, color: "#8b5cf6" },
            areaStyle: {
              color: {
                type: "linear",
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: "rgba(139,92,246,0.6)" },
                  { offset: 0.5, color: "rgba(139,92,246,0.3)" },
                  { offset: 1, color: "rgba(139,92,246,0.05)" },
                ],
              },
            },
          },
        ],
      };
      break;

    case "scatter":
      echartsOption = {
        title: title
          ? { text: title, left: "center", textStyle: { fontSize: 16 } }
          : undefined,
        tooltip: {
          trigger: "item",
          formatter: (p: { data: number[] }) => `(${p.data[0]}, ${p.data[1]})`,
        },
        grid: { left: "3%", right: "4%", bottom: "10%", containLabel: true },
        xAxis: { type: "value", name: options?.xAxisLabel, scale: true },
        yAxis: { type: "value", name: options?.yAxisLabel, scale: true },
        series: [
          {
            type: "scatter",
            symbolSize: 12,
            data: (data as ScatterPoint[]).map((p, i) => ({
              value: [p.x, p.y],
              itemStyle: {
                color: p.color || CHART_COLORS[i % CHART_COLORS.length],
              },
            })),
            animationDelay: (idx: number) => idx * 20,
          },
        ],
      };
      break;

    case "gauge":
      const gaugeVal = options?.gaugeValue ?? 0;
      const gaugeMax = options?.gaugeMax ?? 100;
      const pct = gaugeVal / gaugeMax;
      const gaugeColor =
        pct >= 0.75
          ? "#22c55e"
          : pct >= 0.5
            ? "#eab308"
            : pct >= 0.25
              ? "#f97316"
              : "#ef4444";
      echartsOption = {
        title: title
          ? {
              text: title,
              left: "center",
              top: 10,
              textStyle: { fontSize: 16 },
            }
          : undefined,
        series: [
          {
            type: "gauge",
            startAngle: 180,
            endAngle: 0,
            min: 0,
            max: gaugeMax,
            radius: "90%",
            center: ["50%", "70%"],
            progress: {
              show: true,
              width: 18,
              itemStyle: { color: gaugeColor },
            },
            axisLine: { lineStyle: { width: 18, color: [[1, "#e5e7eb"]] } },
            axisTick: { show: false },
            splitLine: { show: false },
            axisLabel: { show: true, distance: 25, fontSize: 12 },
            pointer: { show: false },
            detail: {
              valueAnimation: true,
              fontSize: 32,
              fontWeight: "bold",
              offsetCenter: [0, "-10%"],
              formatter: "{value}",
              color: "#1f2937",
            },
            title: { offsetCenter: [0, "20%"], fontSize: 14, color: "#6b7280" },
            data: [{ value: gaugeVal, name: options?.gaugeLabel || "" }],
          },
        ],
      };
      break;

    default:
      return `<div style="color: red;">Unknown chart type: ${chartType}</div>`;
  }

  return `<div id="${chartId}" style="width: 100%; height: ${height}; margin: 20px auto;"></div>
<script>
(function() {
  var chart = echarts.init(document.getElementById('${chartId}'));
  chart.setOption(${JSON.stringify(echartsOption)});
  window.addEventListener('resize', function() { chart.resize(); });
})();
</script>`;
}

function generateFlowchartSVG(
  nodes: FlowchartNode[],
  edges: FlowchartEdge[]
): string {
  const nodeWidth = 140;
  const nodeHeight = 50;
  const verticalGap = 80;
  const horizontalGap = 180;

  const nodeMap = new Map<
    string,
    { x: number; y: number; node: FlowchartNode }
  >();
  let row = 0;
  const processed = new Set<string>();

  function getNodeShape(node: FlowchartNode, x: number, y: number): string {
    const colors = {
      start: { fill: "#22c55e", stroke: "#16a34a" },
      end: { fill: "#ef4444", stroke: "#dc2626" },
      process: { fill: "#3b82f6", stroke: "#2563eb" },
      decision: { fill: "#f59e0b", stroke: "#d97706" },
    };
    const c = colors[node.type || "process"];

    if (node.type === "start" || node.type === "end") {
      return `<ellipse cx="${x + nodeWidth / 2}" cy="${y + nodeHeight / 2}" rx="${nodeWidth / 2}" ry="${nodeHeight / 2}" fill="${c.fill}" stroke="${c.stroke}" stroke-width="2"/>
        <text x="${x + nodeWidth / 2}" y="${y + nodeHeight / 2 + 5}" text-anchor="middle" fill="white" font-size="13" font-weight="bold">${node.label}</text>`;
    }
    if (node.type === "decision") {
      const cx = x + nodeWidth / 2;
      const cy = y + nodeHeight / 2;
      return `<polygon points="${cx},${y} ${x + nodeWidth},${cy} ${cx},${y + nodeHeight} ${x},${cy}" fill="${c.fill}" stroke="${c.stroke}" stroke-width="2"/>
        <text x="${cx}" y="${cy + 5}" text-anchor="middle" fill="white" font-size="12" font-weight="bold">${node.label}</text>`;
    }
    return `<rect x="${x}" y="${y}" width="${nodeWidth}" height="${nodeHeight}" rx="8" fill="${c.fill}" stroke="${c.stroke}" stroke-width="2"/>
      <text x="${x + nodeWidth / 2}" y="${y + nodeHeight / 2 + 5}" text-anchor="middle" fill="white" font-size="13" font-weight="bold">${node.label}</text>`;
  }

  const startNodes = nodes.filter(n => n.type === "start");
  let queue = startNodes.length > 0 ? startNodes : [nodes[0]];
  let col = 0;

  while (queue.length > 0 && processed.size < nodes.length) {
    const nextQueue: FlowchartNode[] = [];
    col = 0;
    for (const node of queue) {
      if (!processed.has(node.id)) {
        const x = 50 + col * horizontalGap;
        const y = 30 + row * verticalGap;
        nodeMap.set(node.id, { x, y, node });
        processed.add(node.id);

        const outEdges = edges.filter(e => e.from === node.id);
        for (const edge of outEdges) {
          const targetNode = nodes.find(n => n.id === edge.to);
          if (targetNode && !processed.has(targetNode.id)) {
            nextQueue.push(targetNode);
          }
        }
        col++;
      }
    }
    queue = nextQueue;
    row++;
  }

  for (const node of nodes) {
    if (!processed.has(node.id)) {
      const x = 50 + (processed.size % 3) * horizontalGap;
      const y = 30 + row * verticalGap;
      nodeMap.set(node.id, { x, y, node });
      processed.add(node.id);
    }
  }

  const width = Math.max(400, col * horizontalGap + 100);
  const height = Math.max(200, row * verticalGap + 100);

  const edgesSvg = edges
    .map(edge => {
      const from = nodeMap.get(edge.from);
      const to = nodeMap.get(edge.to);
      if (!from || !to) return "";

      const x1 = from.x + nodeWidth / 2;
      const y1 = from.y + nodeHeight;
      const x2 = to.x + nodeWidth / 2;
      const y2 = to.y;

      const midY = (y1 + y2) / 2;
      const path = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;

      return `<path d="${path}" fill="none" stroke="#94a3b8" stroke-width="2" marker-end="url(#arrowhead)"/>
      ${edge.label ? `<text x="${(x1 + x2) / 2 + 10}" y="${midY}" font-size="11" fill="#666">${edge.label}</text>` : ""}`;
    })
    .join("");

  const nodesSvg = Array.from(nodeMap.values())
    .map(({ x, y, node }) => getNodeShape(node, x, y))
    .join("");

  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="max-width: 100%; margin: 20px auto; display: block;">
    <defs>
      <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8"/>
      </marker>
    </defs>
    ${edgesSvg}
    ${nodesSvg}
  </svg>`;
}

function generateTimelineSVG(events: TimelineEvent[]): string {
  const width = 600;
  const eventHeight = 80;
  const height = events.length * eventHeight + 40;

  const timelineEvents = events
    .map((event, i) => {
      const y = 20 + i * eventHeight;
      const isLeft = i % 2 === 0;
      const textX = isLeft ? width / 2 - 30 : width / 2 + 30;
      const textAnchor = isLeft ? "end" : "start";
      const color = CHART_COLORS[i % CHART_COLORS.length];

      return `
      <circle cx="${width / 2}" cy="${y + 20}" r="12" fill="${color}" stroke="white" stroke-width="3"/>
      <text x="${textX}" y="${y + 15}" text-anchor="${textAnchor}" font-size="13" font-weight="bold" fill="#333">${event.title}</text>
      <text x="${textX}" y="${y + 32}" text-anchor="${textAnchor}" font-size="11" fill="#888">${event.date}</text>
      ${event.description ? `<text x="${textX}" y="${y + 48}" text-anchor="${textAnchor}" font-size="11" fill="#666">${event.description.slice(0, 50)}${event.description.length > 50 ? "..." : ""}</text>` : ""}
    `;
    })
    .join("");

  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="max-width: 700px; margin: 20px auto; display: block;">
    <line x1="${width / 2}" y1="0" x2="${width / 2}" y2="${height}" stroke="#e5e7eb" stroke-width="4"/>
    ${timelineEvents}
  </svg>`;
}

function generateStatCardsSVG(cards: StatCard[]): string {
  const cardWidth = 180;
  const cardHeight = 100;
  const gap = 20;
  const cols = Math.min(cards.length, 4);
  const rows = Math.ceil(cards.length / cols);
  const width = cols * (cardWidth + gap) - gap + 40;
  const height = rows * (cardHeight + gap) - gap + 40;

  const cardsSvg = cards
    .map((card, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = 20 + col * (cardWidth + gap);
      const y = 20 + row * (cardHeight + gap);
      const changeColor =
        card.changeType === "positive"
          ? "#22c55e"
          : card.changeType === "negative"
            ? "#ef4444"
            : "#6b7280";
      const changeSymbol =
        card.changeType === "positive"
          ? "↑"
          : card.changeType === "negative"
            ? "↓"
            : "";

      return `
      <rect x="${x}" y="${y}" width="${cardWidth}" height="${cardHeight}" rx="12" fill="white" stroke="#e5e7eb" stroke-width="1"/>
      <text x="${x + cardWidth / 2}" y="${y + 30}" text-anchor="middle" font-size="12" fill="#6b7280">${card.label}</text>
      <text x="${x + cardWidth / 2}" y="${y + 60}" text-anchor="middle" font-size="24" font-weight="bold" fill="#1f2937">${card.value}</text>
      ${card.change ? `<text x="${x + cardWidth / 2}" y="${y + 85}" text-anchor="middle" font-size="12" fill="${changeColor}">${changeSymbol} ${card.change}</text>` : ""}
    `;
    })
    .join("");

  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="max-width: 100%; margin: 20px auto; display: block; background: #f9fafb; border-radius: 16px;">
    ${cardsSvg}
  </svg>`;
}

function generateProgressBarSVG(progress: number, label?: string): string {
  const width = 400;
  const height = 60;
  const barHeight = 20;
  const clampedProgress = Math.max(0, Math.min(100, progress));
  const color =
    clampedProgress >= 75
      ? "#22c55e"
      : clampedProgress >= 50
        ? "#eab308"
        : clampedProgress >= 25
          ? "#f97316"
          : "#ef4444";

  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="max-width: 500px; margin: 15px auto; display: block;">
    ${label ? `<text x="0" y="15" font-size="13" fill="#374151">${label}</text>` : ""}
    <rect x="0" y="25" width="${width}" height="${barHeight}" rx="10" fill="#e5e7eb"/>
    <rect x="0" y="25" width="${(clampedProgress / 100) * width}" height="${barHeight}" rx="10" fill="${color}"/>
    <text x="${width / 2}" y="40" text-anchor="middle" font-size="12" font-weight="bold" fill="white">${clampedProgress}%</text>
  </svg>`;
}

const REPORT_STYLES: Record<string, string> = {
  medical: `
    body { font-family: 'Georgia', serif; line-height: 1.8; color: #2c3e50; max-width: 900px; margin: 0 auto; padding: 40px; }
    h1 { color: #1a5276; border-bottom: 3px solid #3498db; padding-bottom: 15px; }
    h2 { color: #2874a6; margin-top: 40px; border-left: 4px solid #3498db; padding-left: 15px; }
    h3 { color: #2e86ab; }
    .image-container { text-align: center; margin: 30px 0; padding: 20px; background: #f8f9fa; border-radius: 10px; }
    .image-container img { max-width: 100%; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
    .image-caption { font-style: italic; color: #666; margin-top: 10px; font-size: 0.9em; }
    .highlight { background: #e8f4f8; padding: 15px; border-radius: 8px; border-left: 4px solid #3498db; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; border: 1px solid #ddd; text-align: left; }
    th { background: #3498db; color: white; }
    tr:nth-child(even) { background: #f8f9fa; }
    ul { padding-left: 25px; }
    li { margin: 8px 0; }
  `,
  business: `
    body { font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 900px; margin: 0 auto; padding: 40px; }
    h1 { color: #1a1a2e; font-weight: 300; font-size: 2.5em; border-bottom: 2px solid #e94560; }
    h2 { color: #16213e; font-weight: 400; }
    h3 { color: #0f3460; }
    .image-container { text-align: center; margin: 30px 0; }
    .image-container img { max-width: 100%; border: 1px solid #eee; }
    .image-caption { color: #666; font-size: 0.85em; margin-top: 8px; }
    .highlight { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    th, td { padding: 15px; border: none; border-bottom: 1px solid #eee; }
    th { background: #1a1a2e; color: white; text-transform: uppercase; font-size: 0.85em; letter-spacing: 1px; }
  `,
  technical: `
    body { font-family: 'SF Mono', 'Consolas', monospace; line-height: 1.7; color: #e0e0e0; background: #1e1e1e; max-width: 900px; margin: 0 auto; padding: 40px; }
    h1 { color: #4fc3f7; border-bottom: 2px solid #4fc3f7; }
    h2 { color: #81d4fa; }
    h3 { color: #b3e5fc; }
    .image-container { text-align: center; margin: 30px 0; background: #2d2d2d; padding: 20px; border-radius: 8px; }
    .image-container img { max-width: 100%; border-radius: 4px; }
    .image-caption { color: #888; font-size: 0.9em; }
    code { background: #2d2d2d; padding: 2px 6px; border-radius: 4px; }
    pre { background: #2d2d2d; padding: 15px; border-radius: 8px; overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; border: 1px solid #444; }
    th { background: #333; color: #4fc3f7; }
  `,
  modern: `
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.7; color: #1f2937; max-width: 900px; margin: 0 auto; padding: 40px; }
    h1 { font-size: 2.5em; font-weight: 800; background: linear-gradient(135deg, #6366f1, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    h2 { font-size: 1.8em; color: #4f46e5; margin-top: 50px; }
    h3 { font-size: 1.3em; color: #6366f1; }
    .image-container { text-align: center; margin: 40px 0; }
    .image-container img { max-width: 100%; border-radius: 16px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); }
    .image-caption { color: #6b7280; font-size: 0.9em; margin-top: 12px; }
    .highlight { background: linear-gradient(135deg, #f0f9ff, #e0f2fe); padding: 20px; border-radius: 12px; border: 1px solid #bae6fd; }
    table { width: 100%; border-collapse: separate; border-spacing: 0; margin: 20px 0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    th, td { padding: 16px; }
    th { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; font-weight: 600; }
    tr:nth-child(even) { background: #f9fafb; }
    ul { list-style: none; padding-left: 0; }
    li { padding: 8px 0; padding-left: 24px; position: relative; }
    li::before { content: '→'; position: absolute; left: 0; color: #6366f1; }
  `,
  executive: `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Source+Sans+Pro:wght@300;400;600&display=swap');
    body { font-family: 'Source Sans Pro', sans-serif; line-height: 1.8; color: #1a1a1a; max-width: 900px; margin: 0 auto; padding: 60px 40px; background: #fafafa; }
    h1 { font-family: 'Playfair Display', serif; font-size: 3em; font-weight: 700; color: #0d1b2a; margin-bottom: 10px; letter-spacing: -1px; }
    h2 { font-family: 'Playfair Display', serif; font-size: 1.8em; color: #1b263b; margin-top: 50px; padding-bottom: 10px; border-bottom: 2px solid #415a77; }
    h3 { font-size: 1.3em; color: #415a77; font-weight: 600; }
    .image-container { text-align: center; margin: 40px 0; padding: 30px; background: white; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    .image-container img { max-width: 100%; border-radius: 4px; }
    .image-caption { color: #778da9; font-size: 0.9em; margin-top: 15px; font-style: italic; }
    .highlight { background: white; padding: 25px; border-radius: 8px; border: 1px solid #e0e1dd; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
    table { width: 100%; border-collapse: collapse; margin: 30px 0; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 15px rgba(0,0,0,0.08); }
    th, td { padding: 16px 20px; text-align: left; }
    th { background: #0d1b2a; color: white; font-weight: 600; text-transform: uppercase; font-size: 0.85em; letter-spacing: 1px; }
    tr:nth-child(even) { background: #f8f9fa; }
    td { border-bottom: 1px solid #e9ecef; }
    ul { padding-left: 0; list-style: none; }
    li { padding: 12px 0; padding-left: 30px; position: relative; border-bottom: 1px solid #f0f0f0; }
    li::before { content: '■'; position: absolute; left: 0; color: #415a77; font-size: 0.6em; top: 17px; }
    blockquote { background: white; border-left: 4px solid #415a77; margin: 30px 0; padding: 25px 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
  `,
};

export async function createRichReport(
  filePath: string,
  options: RichReportOptions,
  taskOptions?: { taskId?: number; userId?: number }
): Promise<string> {
  await ensureSandbox();
  const resolvedPath = resolveSandboxPath(filePath);
  const htmlPath = resolvedPath.endsWith(".html")
    ? resolvedPath
    : resolvedPath + ".html";

  const generatedImages: Map<string, string> = new Map();
  const imageErrors: string[] = [];

  for (const section of options.sections) {
    if (section.type === "image" && section.imagePrompt) {
      try {
        console.info(
          `[RichReport] Generating image: ${section.imagePrompt.slice(0, 50)}...`
        );
        const result = await generateImage({ prompt: section.imagePrompt });
        if (result.url) {
          let base64Data: string | null = null;

          try {
            const imageResponse = await fetch(result.url);
            if (imageResponse.ok) {
              const buffer = Buffer.from(await imageResponse.arrayBuffer());
              base64Data = buffer.toString("base64");
            }
          } catch {
            if (result.url.includes("/generated/")) {
              try {
                const localPath = path.join(
                  process.cwd(),
                  "public",
                  `generated/${result.url.split("/generated/")[1]}`
                );
                const buffer = await fs.readFile(localPath);
                base64Data = buffer.toString("base64");
              } catch {
                base64Data = null;
              }
            }
          }

          if (base64Data) {
            generatedImages.set(
              section.imagePrompt,
              `data:image/png;base64,${base64Data}`
            );
          } else {
            generatedImages.set(section.imagePrompt, result.url);
          }
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        imageErrors.push(`Failed to generate "${section.imagePrompt}": ${msg}`);
        console.error(`[RichReport] Image generation failed: ${msg}`);
      }
    }
  }

  const style =
    REPORT_STYLES[options.style || "modern"] || REPORT_STYLES.modern;

  let htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(options.title)}</title>
  <script src="https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"></script>
  <style>${style}</style>
</head>
<body>
  <h1>${escapeHtml(options.title)}</h1>
`;

  if (options.includeTableOfContents) {
    const headings = options.sections.filter(
      s => s.type === "heading" && s.level && s.level <= 2
    );
    if (headings.length > 0) {
      htmlContent += `  <nav class="toc"><h2>Table of Contents</h2><ul>`;
      headings.forEach((h, i) => {
        const indent = h.level === 2 ? "margin-left: 20px;" : "";
        htmlContent += `<li style="${indent}"><a href="#section-${i}">${escapeHtml(h.content || "")}</a></li>`;
      });
      htmlContent += `</ul></nav>\n`;
    }
  }

  let sectionIndex = 0;
  for (const section of options.sections) {
    switch (section.type) {
      case "heading":
        const tag = `h${Math.min(section.level || 2, 6)}`;
        const id =
          section.level && section.level <= 2
            ? ` id="section-${sectionIndex++}"`
            : "";
        htmlContent += `  <${tag}${id}>${escapeHtml(section.content || "")}</${tag}>\n`;
        break;

      case "paragraph":
        htmlContent += `  <p>${formatMarkdownInline(section.content || "")}</p>\n`;
        break;

      case "list":
        htmlContent += `  <ul>\n`;
        (section.items || []).forEach(item => {
          htmlContent += `    <li>${formatMarkdownInline(item)}</li>\n`;
        });
        htmlContent += `  </ul>\n`;
        break;

      case "image":
        const imgSrc = generatedImages.get(section.imagePrompt || "");
        if (imgSrc) {
          htmlContent += `  <div class="image-container">\n`;
          htmlContent += `    <img src="${imgSrc}" alt="${escapeHtml(section.content || section.imagePrompt || "")}">\n`;
          if (section.content) {
            htmlContent += `    <p class="image-caption">${escapeHtml(section.content)}</p>\n`;
          }
          htmlContent += `  </div>\n`;
        } else {
          htmlContent += `  <div class="image-container" style="background: #fee; border: 2px dashed #c00; padding: 40px;">\n`;
          htmlContent += `    <p style="color: #c00;">⚠️ Image could not be generated</p>\n`;
          htmlContent += `    <p style="font-size: 0.9em; color: #666;">Prompt: ${escapeHtml(section.imagePrompt || "")}</p>\n`;
          htmlContent += `  </div>\n`;
        }
        break;

      case "table":
        if (section.rows && section.rows.length > 0) {
          htmlContent += `  <table>\n`;
          const [header, ...rows] = section.rows;
          htmlContent += `    <thead><tr>${header.map(h => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>\n`;
          htmlContent += `    <tbody>\n`;
          rows.forEach(row => {
            htmlContent += `      <tr>${row.map(c => `<td>${escapeHtml(c)}</td>`).join("")}</tr>\n`;
          });
          htmlContent += `    </tbody>\n  </table>\n`;
        }
        break;

      case "pie_chart":
        if (section.chartData && section.chartData.length > 0) {
          htmlContent += generateEChartsDiv(
            "pie",
            section.chartData,
            section.chartTitle
          );
        }
        break;

      case "donut_chart":
        if (section.chartData && section.chartData.length > 0) {
          htmlContent += generateEChartsDiv(
            "donut",
            section.chartData,
            section.chartTitle
          );
        }
        break;

      case "bar_chart":
        if (section.chartData && section.chartData.length > 0) {
          htmlContent += generateEChartsDiv(
            "bar",
            section.chartData,
            section.chartTitle,
            {
              yAxisLabel: section.yAxisLabel,
            }
          );
        }
        break;

      case "line_chart":
        if (section.chartData && section.chartData.length > 0) {
          htmlContent += generateEChartsDiv(
            "line",
            section.chartData,
            section.chartTitle,
            {
              yAxisLabel: section.yAxisLabel,
            }
          );
        }
        break;

      case "area_chart":
        if (section.chartData && section.chartData.length > 0) {
          htmlContent += generateEChartsDiv(
            "area",
            section.chartData,
            section.chartTitle
          );
        }
        break;

      case "scatter_chart":
        if (section.scatterPoints && section.scatterPoints.length > 0) {
          htmlContent += generateEChartsDiv(
            "scatter",
            section.scatterPoints,
            section.chartTitle,
            {
              xAxisLabel: section.xAxisLabel,
              yAxisLabel: section.yAxisLabel,
            }
          );
        }
        break;

      case "gauge_chart":
        htmlContent += generateEChartsDiv("gauge", [], section.chartTitle, {
          gaugeValue: section.gaugeValue,
          gaugeMax: section.gaugeMax,
          gaugeLabel: section.gaugeLabel,
        });
        break;

      case "flowchart":
        if (section.flowNodes && section.flowNodes.length > 0) {
          htmlContent += `  <div class="flowchart-container" style="text-align: center; margin: 30px 0; overflow-x: auto;">\n`;
          htmlContent += generateFlowchartSVG(
            section.flowNodes,
            section.flowEdges || []
          );
          htmlContent += `  </div>\n`;
        }
        break;

      case "timeline":
        if (section.timelineEvents && section.timelineEvents.length > 0) {
          htmlContent += `  <div class="timeline-container" style="margin: 30px 0;">\n`;
          htmlContent += generateTimelineSVG(section.timelineEvents);
          htmlContent += `  </div>\n`;
        }
        break;

      case "stat_cards":
        if (section.statCards && section.statCards.length > 0) {
          htmlContent += `  <div class="stat-cards-container" style="margin: 30px 0;">\n`;
          htmlContent += generateStatCardsSVG(section.statCards);
          htmlContent += `  </div>\n`;
        }
        break;

      case "progress_bar":
        htmlContent += `  <div class="progress-container" style="margin: 20px 0;">\n`;
        htmlContent += generateProgressBarSVG(
          section.progress || 0,
          section.progressLabel
        );
        htmlContent += `  </div>\n`;
        break;

      case "callout":
        const calloutColors = {
          info: { bg: "#eff6ff", border: "#3b82f6", icon: "ℹ️" },
          warning: { bg: "#fffbeb", border: "#f59e0b", icon: "⚠️" },
          success: { bg: "#f0fdf4", border: "#22c55e", icon: "✅" },
          error: { bg: "#fef2f2", border: "#ef4444", icon: "❌" },
        };
        const calloutStyle = calloutColors[section.calloutType || "info"];
        htmlContent += `  <div class="callout" style="background: ${calloutStyle.bg}; border-left: 4px solid ${calloutStyle.border}; padding: 20px; margin: 20px 0; border-radius: 8px;">\n`;
        htmlContent += `    <span style="font-size: 1.2em; margin-right: 10px;">${calloutStyle.icon}</span>\n`;
        htmlContent += `    <span>${formatMarkdownInline(section.content || "")}</span>\n`;
        htmlContent += `  </div>\n`;
        break;

      case "quote":
        htmlContent += `  <blockquote style="border-left: 4px solid #6366f1; padding: 20px 30px; margin: 30px 0; background: #f8fafc; font-style: italic; font-size: 1.1em;">\n`;
        htmlContent += `    <p style="margin: 0;">"${escapeHtml(section.content || "")}"</p>\n`;
        if (section.quoteAuthor) {
          htmlContent += `    <footer style="margin-top: 10px; font-style: normal; font-size: 0.9em; color: #666;">— ${escapeHtml(section.quoteAuthor)}</footer>\n`;
        }
        htmlContent += `  </blockquote>\n`;
        break;

      case "comparison":
        if (section.comparisonItems && section.comparisonItems.length > 0) {
          const features = Object.keys(
            section.comparisonItems[0]?.features || {}
          );
          htmlContent += `  <table class="comparison-table" style="width: 100%; border-collapse: collapse; margin: 20px 0;">\n`;
          htmlContent += `    <thead><tr><th style="text-align: left; padding: 12px; background: #1f2937; color: white;">Feature</th>`;
          section.comparisonItems.forEach(item => {
            htmlContent += `<th style="text-align: center; padding: 12px; background: #1f2937; color: white;">${escapeHtml(item.name)}</th>`;
          });
          htmlContent += `</tr></thead>\n    <tbody>\n`;
          features.forEach((feature, i) => {
            const bg = i % 2 === 0 ? "#f9fafb" : "white";
            htmlContent += `      <tr style="background: ${bg};"><td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(feature)}</td>`;
            section.comparisonItems!.forEach(item => {
              const val = item.features[feature];
              const display =
                typeof val === "boolean"
                  ? val
                    ? "✅"
                    : "❌"
                  : escapeHtml(String(val));
              htmlContent += `<td style="text-align: center; padding: 12px; border-bottom: 1px solid #e5e7eb;">${display}</td>`;
            });
            htmlContent += `</tr>\n`;
          });
          htmlContent += `    </tbody>\n  </table>\n`;
        }
        break;

      case "code":
        const lang = section.language || "text";
        htmlContent += `  <pre style="background: #1f2937; color: #e5e7eb; padding: 20px; border-radius: 8px; overflow-x: auto; font-family: 'SF Mono', Consolas, monospace; font-size: 14px;"><code class="language-${lang}">${escapeHtml(section.content || "")}</code></pre>\n`;
        break;
    }
  }

  const authorDate = [
    options.author,
    options.date || new Date().toLocaleDateString(),
  ]
    .filter(Boolean)
    .join(" • ");

  htmlContent += `
  <footer style="margin-top: 60px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 0.85em;">
    <p>Generated by RASPUTIN AI${authorDate ? ` • ${authorDate}` : ""}</p>
  </footer>
</body>
</html>`;

  try {
    await fs.mkdir(path.dirname(htmlPath), { recursive: true });
    await fs.writeFile(htmlPath, htmlContent, "utf-8");

    if (taskOptions?.taskId && taskOptions?.userId) {
      try {
        const stats = await fs.stat(htmlPath);
        await createAgentFile({
          taskId: taskOptions.taskId,
          userId: taskOptions.userId,
          fileName: path.basename(htmlPath),
          filePath: htmlPath,
          mimeType: getMimeType(htmlPath),
          fileSize: stats.size,
          source: "generated",
        });
      } catch {}
    }

    const imageCount = generatedImages.size;
    const errorNote =
      imageErrors.length > 0
        ? `\n\n⚠️ ${imageErrors.length} image(s) failed to generate:\n${imageErrors.join("\n")}`
        : "";

    return `Rich report created successfully!\n\nPath: ${htmlPath}\nTitle: ${options.title}\nSections: ${options.sections.length}\nImages generated: ${imageCount}\nStyle: ${options.style || "modern"}${errorNote}\n\nThe report is a self-contained HTML file with embedded images that can be opened in any browser and exported to PDF using the browser's print function (Ctrl/Cmd+P → Save as PDF).`;
  } catch (error) {
    return `Error creating rich report: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatMarkdownInline(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

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
  features?: string[],
  uiLibrary?: string,
  uiTheme?: string,
  uiComponents?: string[],
  testing?: boolean,
  testCoverage?: boolean,
  docker?: boolean,
  dockerCompose?: boolean,
  dockerServices?: string[]
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

  const validUILibraries = ["shadcn", "radix", "headless", "none"];
  if (uiLibrary && !validUILibraries.includes(uiLibrary)) {
    return `Error: Invalid UI library. Must be one of: ${validUILibraries.join(", ")}`;
  }

  const config: ScaffoldConfig = {
    projectName,
    projectType: projectType as ScaffoldConfig["projectType"],
    outputPath: outputPath || "/tmp/jarvis-projects",
    database: database as ScaffoldConfig["database"],
    authentication: authentication as ScaffoldConfig["authentication"],
    features,
  };

  if (uiLibrary && uiLibrary !== "none") {
    config.ui = {
      library: uiLibrary as UILibrary,
      theme: (uiTheme as "light" | "dark" | "system") || "system",
      components: uiComponents,
    };
  }

  if (testing) {
    config.testing = testCoverage ? { coverage: true } : true;
  }

  if (docker) {
    const { COMMON_DOCKER_SERVICES } = await import("../webApp/dockerSetup.js");
    const services = dockerServices
      ?.map(s => COMMON_DOCKER_SERVICES[s])
      .filter(Boolean);
    config.docker = {
      includeDocker: true,
      includeCompose: dockerCompose !== false,
      services,
    };
  }

  const result = await scaffoldProject(config);

  if (!result.success) {
    return `Error creating project: ${result.error}`;
  }

  let output = `Project "${projectName}" created successfully!

Location: ${result.projectPath}
Files created: ${result.filesCreated.length}`;

  if (config.ui) {
    output += `\nUI Library: ${config.ui.library} with ${config.ui.theme} theme`;
  }

  if (config.testing) {
    output += `\nTesting: Configured with sample tests`;
  }

  if (config.docker) {
    output += `\nDocker: Configured with Dockerfile and docker-compose.yml`;
  }

  output += `

Files:
${result.filesCreated.map(f => `  - ${f}`).join("\n")}

Next steps:
1. cd ${result.projectPath}
2. npm install (or pnpm install)
3. npm run dev${testing ? "\n4. npm test (to run tests)" : ""}${docker ? "\n5. docker-compose up --build (to run in container)" : ""}`;

  return output;
}

async function generateSchemaTool(
  description: string,
  databaseType?: string,
  outputPath?: string
): Promise<string> {
  const validDbTypes = ["mysql", "postgresql", "sqlite"];
  const dbType = (databaseType || "mysql") as "mysql" | "postgresql" | "sqlite";
  if (!validDbTypes.includes(dbType)) {
    return `Error: Invalid database type. Must be one of: ${validDbTypes.join(", ")}`;
  }

  const result = await generateSchemaFromDescription(description, dbType);

  if (!result.success) {
    return `Error generating schema: ${result.error}`;
  }

  const schemaContent = result.schema;
  const entitiesSummary = result.entities
    .map(e => `  - ${e.name} (${e.fields.length} fields)`)
    .join("\n");

  if (outputPath) {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, schemaContent, "utf-8");
    return `Database schema generated successfully!

Output file: ${outputPath}
Database type: ${dbType}
Entities created:
${entitiesSummary}

The schema file has been written and is ready to use with Drizzle ORM.
Run 'pnpm db:push' or equivalent to apply the schema to your database.`;
  }

  return `Database schema generated successfully!

Database type: ${dbType}
Entities created:
${entitiesSummary}

Generated Schema:
\`\`\`typescript
${schemaContent}
\`\`\``;
}

function listDocumentTemplates(): string {
  const templates = listTemplates();
  const lines = templates.map(
    t => `- **${t.type}** (${t.format}): ${t.name} - ${t.description}`
  );
  return `Available document templates:\n\n${lines.join("\n")}`;
}

function getDocumentTemplate(templateType: string): string {
  const template = getTemplateByType(templateType as TemplateType);
  if (!template) {
    const available = listTemplates()
      .map(t => t.type)
      .join(", ");
    return `Unknown template type: ${templateType}. Available: ${available}`;
  }

  const variables = template.variables
    .map(v => {
      const req = v.required ? "(required)" : "(optional)";
      const def = v.defaultValue ? ` [default: ${v.defaultValue}]` : "";
      const ex = v.example ? ` e.g. "${v.example}"` : "";
      return `  - ${v.name} ${req}${def}: ${v.description}${ex}`;
    })
    .join("\n");

  return `Template: ${template.name}
Type: ${template.type}
Format: ${template.format}
Description: ${template.description}

Variables:
${variables}

Structure Preview:
\`\`\`
${template.structure.substring(0, 500)}${template.structure.length > 500 ? "..." : ""}
\`\`\``;
}

async function renderDocumentTemplate(
  templateType: string,
  variables: Record<string, unknown>,
  outputPath?: string
): Promise<string> {
  const template = getTemplateByType(templateType as TemplateType);
  if (!template) {
    const available = listTemplates()
      .map(t => t.type)
      .join(", ");
    return `Unknown template type: ${templateType}. Available: ${available}`;
  }

  const validation = validateTemplateVariables(
    templateType as TemplateType,
    variables
  );
  if (!validation.valid) {
    return `Template validation failed:\n${validation.errors.join("\n")}`;
  }

  const { content, missingRequired } = renderTemplate(template, variables);

  if (missingRequired.length > 0) {
    return `Missing required variables: ${missingRequired.join(", ")}`;
  }

  if (outputPath) {
    await ensureSandbox();
    const resolvedPath = resolveSandboxPath(outputPath);
    await fs.mkdir(path.dirname(resolvedPath), { recursive: true });

    if (template.format === "docx") {
      return writeDocx(resolvedPath, content, variables["title"] as string);
    } else if (template.format === "html") {
      const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${variables["title"] || template.name}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; }
    h1 { border-bottom: 2px solid #333; padding-bottom: 0.5rem; }
    h2 { color: #333; margin-top: 2rem; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
    th { background: #f5f5f5; }
    code { background: #f0f0f0; padding: 0.2rem 0.4rem; border-radius: 3px; }
    pre { background: #f0f0f0; padding: 1rem; overflow-x: auto; }
  </style>
</head>
<body>
${markdownToHtml(content)}
</body>
</html>`;
      await fs.writeFile(resolvedPath, htmlContent, "utf-8");
      const stats = await fs.stat(resolvedPath);
      return `Document created: ${resolvedPath} (${stats.size} bytes, HTML format)`;
    } else {
      await fs.writeFile(resolvedPath, content, "utf-8");
      const stats = await fs.stat(resolvedPath);
      return `Document created: ${resolvedPath} (${stats.size} bytes, ${template.format} format)`;
    }
  }

  return `Rendered ${template.name} (${template.format}):\n\n${content}`;
}

function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(.+)$/gm, line => {
      if (line.startsWith("<")) return line;
      return `<p>${line}</p>`;
    })
    .replace(/<p><\/p>/g, "")
    .replace(/<p>(<[hul])/g, "$1")
    .replace(/(<\/[hul][^>]*>)<\/p>/g, "$1");
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

export async function getPredictedTasks(userId: number): Promise<string> {
  try {
    const suggestions = await getSuggestedTasks(userId);

    if (suggestions.length === 0) {
      return "No task predictions available yet. Complete more tasks to enable predictions.";
    }

    const lines = suggestions.map((s, i) => {
      const confidence = Math.round(s.confidence * 100);
      return `${i + 1}. ${s.suggestion}
   Confidence: ${confidence}%
   Reason: ${s.reason}`;
    });

    return `Predicted/Suggested Tasks:\n\n${lines.join("\n\n")}`;
  } catch (error) {
    return `Failed to get predictions: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function getTaskPatterns(userId: number): Promise<string> {
  try {
    const patterns = await analyzeTaskPatterns(userId);

    if (patterns.length === 0) {
      return "No task patterns detected yet. Complete more tasks to enable pattern analysis.";
    }

    const lines = patterns.slice(0, 10).map((p, i) => {
      const freq = (p.frequency * 30).toFixed(1);
      const interval = formatIntervalMs(p.averageInterval);
      const confidence = Math.round(p.confidence * 100);
      return `${i + 1}. Pattern: "${p.pattern}"
   Frequency: ~${freq} times/month
   Avg interval: ${interval}
   Confidence: ${confidence}%
   Keywords: ${p.contextTriggers.slice(0, 5).join(", ")}`;
    });

    return `Detected Task Patterns:\n\n${lines.join("\n\n")}`;
  } catch (error) {
    return `Failed to analyze patterns: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function formatIntervalMs(ms: number): string {
  const hours = ms / (1000 * 60 * 60);
  if (hours < 24) return `${Math.round(hours)} hours`;
  const days = hours / 24;
  if (days < 7) return `${Math.round(days)} days`;
  const weeks = days / 7;
  return `${Math.round(weeks)} weeks`;
}

export async function getProactiveMonitorStatus(): Promise<string> {
  try {
    const status = await proactiveMonitor.getStatus();
    return `Proactive Monitor Status:
- Running: ${status.running ? "Yes" : "No"}
- Enabled: ${status.config.enabled ? "Yes" : "No"}
- Check Interval: ${status.config.checkIntervalMs / 1000 / 60} minutes
- Auto-trigger Threshold: ${Math.round(status.config.autoTriggerThreshold * 100)}%
- Alert Threshold: ${Math.round(status.config.alertThreshold * 100)}%
- Max Auto-triggers/Day: ${status.config.maxAutoTriggersPerDay}
- Monitored Users: ${status.monitoredUsersCount}
- Total Alerts: ${status.alertsCount}
- Last Check: ${status.lastCheckTime?.toISOString() || "Never"}`;
  } catch (error) {
    return `Failed to get monitor status: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function configureProactiveMonitor(
  config: Partial<MonitorConfig>
): Promise<string> {
  try {
    await proactiveMonitor.updateConfig(config);
    const status = await proactiveMonitor.getStatus();

    const changes = Object.entries(config)
      .map(([k, v]) => `  ${k}: ${v}`)
      .join("\n");

    return `Proactive Monitor configuration updated:
${changes}

Current Status:
- Running: ${status.running ? "Yes" : "No"}
- Monitored Users: ${status.monitoredUsersCount}`;
  } catch (error) {
    return `Failed to configure monitor: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function getProactiveAlerts(
  userId?: number,
  limit: number = 20
): Promise<string> {
  try {
    const alerts = proactiveMonitor.getAlerts(userId, limit);

    if (alerts.length === 0) {
      return "No proactive alerts found.";
    }

    const lines = alerts.map((a, i) => {
      const confidence = Math.round(a.confidence * 100);
      const time = a.createdAt.toLocaleString();
      return `${i + 1}. [${a.suggestedAction.toUpperCase()}] ${a.taskDescription}
   Confidence: ${confidence}%
   Reason: ${a.reason}
   Time: ${time}${userId ? "" : `\n   User: ${a.userId}`}`;
    });

    return `Proactive Alerts (${alerts.length}):\n\n${lines.join("\n\n")}`;
  } catch (error) {
    return `Failed to get alerts: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function getUserInsights(userId: number): Promise<string> {
  try {
    const insights = await proactiveMonitor.getUserInsights(userId);

    const patternSummary =
      insights.patterns.length > 0
        ? insights.patterns
            .slice(0, 5)
            .map(
              p =>
                `  - "${p.pattern}" (${Math.round(p.confidence * 100)}% confidence)`
            )
            .join("\n")
        : "  No patterns detected yet";

    const predictionSummary =
      insights.predictions.length > 0
        ? insights.predictions
            .slice(0, 5)
            .map(
              p =>
                `  - ${p.taskDescription} (${Math.round(p.confidence * 100)}%)`
            )
            .join("\n")
        : "  No predictions available";

    const alertSummary =
      insights.recentAlerts.length > 0
        ? insights.recentAlerts
            .slice(0, 3)
            .map(a => `  - [${a.suggestedAction}] ${a.taskDescription}`)
            .join("\n")
        : "  No recent alerts";

    const monitoringStatus = insights.userData
      ? `Monitored since last check: ${insights.userData.lastCheck.toLocaleString()}
Auto-triggers today: ${insights.userData.autoTriggersToday}
Alerts sent today: ${insights.userData.alertsSent}`
      : "User not currently monitored";

    return `User Insights for User ${userId}:

Detected Patterns:
${patternSummary}

Predicted Next Tasks:
${predictionSummary}

Recent Alerts:
${alertSummary}

Monitoring Status:
${monitoringStatus}`;
  } catch (error) {
    return `Failed to get user insights: ${error instanceof Error ? error.message : String(error)}`;
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

async function executeDesktopAction(
  actionInput: Action | string,
  taskId: number,
  userId: number,
  sessionId: string
): Promise<string> {
  try {
    const daemon = getDesktopDaemon();
    const status = daemon.getStatus();

    if (!status.running) {
      await daemon.start();
    }

    const action: Action =
      typeof actionInput === "string" ? parseAction(actionInput) : actionInput;

    const result = await daemon.executeAction(action, {
      taskId,
      userId,
      sessionId,
    });

    if (result.success) {
      let response = `Desktop action ${action.type} completed successfully.`;
      if (result.postStateRef) {
        response += `\nPost-action screenshot: ${result.postStateRef}`;
      }
      if (result.result) {
        response += `\nResult: ${JSON.stringify(result.result)}`;
      }
      response += `\nDuration: ${result.durationMs}ms`;
      return response;
    } else {
      return `Desktop action ${action.type} failed: ${result.error}`;
    }
  } catch (error) {
    return `Desktop action error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function executeVisionAutomate(
  goal: string,
  taskId: number,
  userId: number,
  sessionId: string,
  maxIterations?: number
): Promise<string> {
  try {
    const config: VisionLoopConfig = {
      taskId,
      userId,
      sessionId,
      goal,
      maxIterations: maxIterations || 30,
    };

    const result = await runVisionLoop(config);

    if (result.success) {
      return `Vision automation completed successfully!
Goal: ${goal}
Iterations: ${result.iterations}
Final state: ${result.finalState || "Goal achieved"}
Actions taken: ${result.actionHistory.length}

Action history:
${result.actionHistory.map((a, i) => `${i + 1}. ${a}`).join("\n")}`;
    } else {
      return `Vision automation failed after ${result.iterations} iterations.
Goal: ${goal}
Error: ${result.error}
Actions attempted: ${result.actionHistory.length}

Action history:
${result.actionHistory.map((a, i) => `${i + 1}. ${a}`).join("\n")}`;
    }
  } catch (error) {
    return `Vision automation error: ${error instanceof Error ? error.message : String(error)}`;
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
    case "get_predicted_tasks":
      return getPredictedTasks(input.userId as number);
    case "get_task_patterns":
      return getTaskPatterns(input.userId as number);
    case "get_proactive_monitor_status":
      return getProactiveMonitorStatus();
    case "configure_proactive_monitor":
      return configureProactiveMonitor(input.config as Partial<MonitorConfig>);
    case "get_proactive_alerts":
      return getProactiveAlerts(
        input.userId as number | undefined,
        input.limit as number | undefined
      );
    case "get_user_insights":
      return getUserInsights(input.userId as number);
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
    case "deep_research":
      return deepResearch(input.topic as string, (input.depth as number) || 2);
    case "query_consensus":
      return queryConsensus(
        input.query as string,
        (input.speed_tier as SpeedTier) || "normal"
      );
    case "query_synthesis":
      return querySynthesis(
        input.query as string,
        (input.speed_tier as SpeedTier) || "normal"
      );
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
      return writeFile(input.path as string, input.content as string, {
        taskId: input.taskId as number | undefined,
        userId: input.userId as number | undefined,
      });
    case "write_docx":
      return writeDocx(
        input.path as string,
        input.content as string,
        input.title as string | undefined,
        {
          taskId: input.taskId as number | undefined,
          userId: input.userId as number | undefined,
        }
      );
    case "write_pptx":
      return writePptx(
        input.path as string,
        input.slides as SlideDefinition[],
        {
          title: input.title as string | undefined,
          author: input.author as string | undefined,
          subject: input.subject as string | undefined,
          taskId: input.taskId as number | undefined,
          userId: input.userId as number | undefined,
        }
      );
    case "write_xlsx":
      return writeXlsx(
        input.path as string,
        input.sheets as SheetDefinition[],
        {
          creator: input.creator as string | undefined,
          title: input.title as string | undefined,
          taskId: input.taskId as number | undefined,
          userId: input.userId as number | undefined,
        }
      );
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
    case "create_rich_report":
      return createRichReport(
        input.path as string,
        {
          title: input.title as string,
          sections: input.sections as RichReportSection[],
          style: input.style as "medical" | "business" | "technical" | "modern",
          includeTableOfContents: input.includeTableOfContents as boolean,
        },
        {
          taskId: input.taskId as number | undefined,
          userId: input.userId as number | undefined,
        }
      );
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
        input.features as string[] | undefined,
        input.uiLibrary as string | undefined,
        input.uiTheme as string | undefined,
        input.uiComponents as string[] | undefined,
        input.testing as boolean | undefined,
        input.testCoverage as boolean | undefined,
        input.docker as boolean | undefined,
        input.dockerCompose as boolean | undefined,
        input.dockerServices as string[] | undefined
      );
    case "generate_schema":
      return generateSchemaTool(
        input.description as string,
        input.databaseType as string | undefined,
        input.outputPath as string | undefined
      );
    case "list_document_templates":
      return listDocumentTemplates();
    case "get_document_template":
      return getDocumentTemplate(input.templateType as string);
    case "render_document_template":
      return renderDocumentTemplate(
        input.templateType as string,
        input.variables as Record<string, unknown>,
        input.outputPath as string | undefined
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
    case "desktop_action":
      return executeDesktopAction(
        input.action as Action | string,
        input.taskId as number,
        input.userId as number,
        input.sessionId as string
      );
    case "vision_automate":
      return executeVisionAutomate(
        input.goal as string,
        input.taskId as number,
        input.userId as number,
        input.sessionId as string,
        input.maxIterations as number | undefined
      );
    default:
      if (name.startsWith("self_")) {
        return executeSelfEvolutionTool(name, input, input.userId as number);
      }
      if (isDynamicTool(name)) {
        return executeDynamicTool(name, input);
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
    {
      type: string;
      description: string;
      required?: boolean;
      items?: { type: string };
    }
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
      name: "write_docx",
      description:
        "Create a Microsoft Word document (.docx) from text/markdown content. Use this instead of write_file when the user needs a document that opens in Word, Google Docs, or other office applications.",
      parameters: {
        path: {
          type: "string",
          description: "Path for the .docx file (extension added if missing)",
          required: true,
        },
        content: {
          type: "string",
          description:
            "Content to write. Supports markdown formatting: # headings, **bold**, *italic*, - bullet points",
          required: true,
        },
        title: {
          type: "string",
          description: "Optional document title (appears at top, centered)",
          required: false,
        },
      },
    },
    {
      name: "write_pptx",
      description:
        "Create a Microsoft PowerPoint presentation (.pptx) from slide definitions. Each slide can have a title, subtitle, content (text or bullet points), speaker notes, and images. Use this when the user needs a presentation.",
      parameters: {
        path: {
          type: "string",
          description: "Path for the .pptx file (extension added if missing)",
          required: true,
        },
        slides: {
          type: "array",
          description:
            "Array of slide objects. Each slide: {title?: string, subtitle?: string, content?: string|string[], notes?: string, layout?: 'title'|'content'|'section'|'blank', image?: {path, x?, y?, w?, h?}}",
          required: true,
          items: { type: "object" },
        },
        title: {
          type: "string",
          description: "Presentation title (metadata)",
          required: false,
        },
        author: {
          type: "string",
          description: "Presentation author (metadata)",
          required: false,
        },
        subject: {
          type: "string",
          description: "Presentation subject (metadata)",
          required: false,
        },
      },
    },
    {
      name: "write_xlsx",
      description:
        "Create a Microsoft Excel spreadsheet (.xlsx) with multiple sheets, headers, data, formulas, and styling. Use this when the user needs a spreadsheet for data analysis, reports, or structured data.",
      parameters: {
        path: {
          type: "string",
          description: "Path for the .xlsx file (extension added if missing)",
          required: true,
        },
        sheets: {
          type: "array",
          description:
            "Array of sheet definitions. Each sheet: {name: string, headers?: string[], data?: (string|number|boolean|null)[][], columnWidths?: number[], formulas?: [{cell: string, formula: string}], styles?: {headerStyle?: {bold?, fill?, color?}}}",
          required: true,
          items: { type: "object" },
        },
        creator: {
          type: "string",
          description: "Spreadsheet creator (metadata)",
          required: false,
        },
        title: {
          type: "string",
          description: "Spreadsheet title (metadata)",
          required: false,
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
      name: "create_rich_report",
      description:
        "Create a STUNNING professional HTML report with SVG charts, diagrams, and optional AI-generated images. ALWAYS USE THIS for reports, analyses, and documents that need visual elements. Supports: pie/bar/line charts, flowcharts, timelines, stat cards, progress bars, callouts, quotes, comparison tables, code blocks, and AI images. Output is a self-contained HTML file that exports perfectly to PDF. MUCH BETTER than plain markdown.",
      parameters: {
        path: {
          type: "string",
          description:
            "Output file path (e.g., /tmp/jarvis-workspace/report.html)",
          required: true,
        },
        title: {
          type: "string",
          description: "Report title",
          required: true,
        },
        subtitle: {
          type: "string",
          description: "Optional subtitle",
          required: false,
        },
        author: {
          type: "string",
          description: "Author name for footer",
          required: false,
        },
        style: {
          type: "string",
          description:
            "Visual style: 'medical', 'business', 'technical', 'modern', or 'executive' (default: modern)",
          required: false,
        },
        includeTableOfContents: {
          type: "boolean",
          description: "Include table of contents (default: false)",
          required: false,
        },
        sections: {
          type: "array",
          description: `Array of section objects. Section types and their fields:
- heading: {type:'heading', level:1-6, content:'text'}
- paragraph: {type:'paragraph', content:'text with **bold** and *italic*'}
- list: {type:'list', items:['item1','item2']}
- table: {type:'table', rows:[['Header1','Header2'],['row1col1','row1col2']]}
- pie_chart: {type:'pie_chart', chartTitle:'Title', chartData:[{label:'A',value:30},{label:'B',value:70}]}
- bar_chart: {type:'bar_chart', chartTitle:'Title', chartData:[{label:'Q1',value:100},{label:'Q2',value:150}]}
- line_chart: {type:'line_chart', chartTitle:'Trend', chartData:[{label:'Jan',value:10},{label:'Feb',value:25}]}
- flowchart: {type:'flowchart', flowNodes:[{id:'1',label:'Start',type:'start'},{id:'2',label:'Process',type:'process'}], flowEdges:[{from:'1',to:'2'}]}
- timeline: {type:'timeline', timelineEvents:[{date:'2024-01',title:'Event 1'},{date:'2024-06',title:'Event 2'}]}
- stat_cards: {type:'stat_cards', statCards:[{label:'Revenue',value:'$1.2M',change:'+15%',changeType:'positive'}]}
- progress_bar: {type:'progress_bar', progress:75, progressLabel:'Completion'}
- callout: {type:'callout', calloutType:'info|warning|success|error', content:'Important note'}
- quote: {type:'quote', content:'Quote text', quoteAuthor:'Author Name'}
- comparison: {type:'comparison', comparisonItems:[{name:'Option A',features:{Price:'$99',Speed:true}},{name:'Option B',features:{Price:'$149',Speed:false}}]}
- code: {type:'code', language:'python', content:'print("hello")'}
- image: {type:'image', imagePrompt:'AI prompt for image generation', content:'Caption'}`,
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
          items: { type: "string" },
          description: "List of tool names used during the task",
          required: true,
        },
        results: {
          type: "array",
          items: { type: "string" },
          description: "List of results/outputs from each tool",
          required: true,
        },
      },
    },
    // === DESKTOP AUTOMATION ===
    {
      name: "desktop_action",
      description:
        "Execute desktop automation actions using xdotool. Supports mouse clicks, keyboard input, window management, screenshots, and more. The action can be provided as JSON or will be parsed from a JSON string.",
      parameters: {
        action: {
          type: "object",
          description:
            "Action object with type and parameters. Types: CLICK (point, target, button, double, modifiers), TYPE (text, clear, submit), KEY (key, modifiers, hold, release), SCROLL (direction, amount, point), MOVE (point, smooth), DRAG (from, to, button), SCREENSHOT (region, format), WAIT (waitFor, durationMs, element), WINDOW (operation, window, position, size), LAUNCH (app, args, cwd, waitForWindow), CLIPBOARD (operation, text), ASSERT (assertType, target, point, color)",
          required: true,
        },
        taskId: {
          type: "number",
          description: "Task ID for logging",
          required: true,
        },
        userId: {
          type: "number",
          description: "User ID for logging",
          required: true,
        },
        sessionId: {
          type: "string",
          description: "Session ID for logging",
          required: true,
        },
      },
    },
    {
      name: "vision_automate",
      description:
        "Automate desktop tasks using vision-action loop. Takes a screenshot, uses Claude to analyze it, determines next action, executes it, and repeats until goal is achieved. Best for complex GUI automation where element positions are unknown.",
      parameters: {
        goal: {
          type: "string",
          description:
            "Natural language description of what to achieve (e.g., 'Open Firefox and navigate to google.com')",
          required: true,
        },
        taskId: {
          type: "number",
          description: "Task ID for logging",
          required: true,
        },
        userId: {
          type: "number",
          description: "User ID for logging",
          required: true,
        },
        sessionId: {
          type: "string",
          description: "Session ID for logging",
          required: true,
        },
        maxIterations: {
          type: "number",
          description: "Maximum iterations before giving up (default: 30)",
          required: false,
        },
      },
    },
    // === DATABASE SCHEMA TOOLS ===
    {
      name: "generate_schema",
      description:
        "Generate a Drizzle ORM database schema from a natural language description. Analyzes the description using AI to extract entities, fields, and relationships, then generates TypeScript code compatible with Drizzle ORM.",
      parameters: {
        description: {
          type: "string",
          description:
            "Natural language description of the data model (e.g., 'A blog platform with users, posts, comments, and tags. Users can author multiple posts. Posts can have many comments. Posts can have multiple tags.')",
          required: true,
        },
        databaseType: {
          type: "string",
          description:
            "Target database type: 'mysql', 'postgresql', or 'sqlite' (default: mysql)",
          required: false,
        },
        outputPath: {
          type: "string",
          description:
            "Optional file path to write the schema. If not provided, returns the schema as text.",
          required: false,
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
          items: { type: "string" },
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
          items: { type: "string" },
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
          items: { type: "string" },
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
          items: { type: "object" },
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
          items: { type: "string" },
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
      name: "get_predicted_tasks",
      description:
        "Get predicted/suggested tasks based on user patterns and history. Analyzes past tasks to predict what the user might want to do next.",
      parameters: {},
    },
    {
      name: "get_task_patterns",
      description:
        "Analyze and display detected patterns in user task history. Shows frequency, intervals, and keywords for recurring task types.",
      parameters: {},
    },
    {
      name: "get_proactive_monitor_status",
      description:
        "Get the current status of the proactive monitoring system. Shows if it's running, configuration settings, and statistics.",
      parameters: {},
    },
    {
      name: "configure_proactive_monitor",
      description:
        "Configure the proactive monitoring system. Can enable/disable monitoring, set thresholds for auto-triggering tasks, and configure quiet hours.",
      parameters: {
        config: {
          type: "object",
          description:
            "Configuration object with: enabled (bool), checkIntervalMs (number), autoTriggerThreshold (0-1), alertThreshold (0-1), maxAutoTriggersPerDay (number), quietHoursStart (0-23), quietHoursEnd (0-23)",
          required: true,
        },
      },
    },
    {
      name: "get_proactive_alerts",
      description:
        "Get proactive alerts generated by the monitoring system. Shows tasks that were auto-triggered, notified, or suggested based on predictions.",
      parameters: {
        userId: {
          type: "number",
          description: "Filter alerts by user ID (optional)",
          required: false,
        },
        limit: {
          type: "number",
          description: "Maximum number of alerts to return (default: 20)",
          required: false,
        },
      },
    },
    {
      name: "get_user_insights",
      description:
        "Get comprehensive insights about a user's task patterns, predictions, and monitoring status. Useful for understanding user behavior and proactive assistance.",
      parameters: {
        userId: {
          type: "number",
          description: "The user ID to get insights for",
          required: true,
        },
      },
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
          items: { type: "string" },
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
          items: { type: "string" },
          description: "List of tool names used during the task",
          required: true,
        },
        results: {
          type: "array",
          items: { type: "string" },
          description: "List of results/outputs from each tool",
          required: true,
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
    {
      name: "deep_research",
      description:
        "Perform multi-source deep research on a topic. Runs multiple search queries, tracks citations with URLs, scores source credibility, and identifies conflicting information. Use this for comprehensive research tasks instead of single web_search calls.",
      parameters: {
        topic: {
          type: "string",
          description: "The research topic or question",
          required: true,
        },
        depth: {
          type: "number",
          description:
            "Research depth (1=quick, 2=standard, 3=thorough). Default: 2",
          required: false,
        },
      },
    },
    {
      name: "query_consensus",
      description:
        "Query multiple frontier AI models (GPT-5, Claude, Gemini, Grok, etc.) in parallel and get a synthesized consensus answer. Use this when you need diverse perspectives, want to verify accuracy across models, or when the question is complex/controversial. Returns individual model responses plus an agreement percentage and unified summary.",
      parameters: {
        query: {
          type: "string",
          description: "The question or topic to get consensus on",
          required: true,
        },
        speed_tier: {
          type: "string",
          description:
            "Speed/quality tier: 'fast' (Gemini Flash, Cerebras), 'normal' (GPT-5, Claude Sonnet, Grok), or 'max' (GPT-5.2 Pro, Claude Opus, Gemini Pro). Default: 'normal'",
          required: false,
        },
      },
    },
    {
      name: "query_synthesis",
      description:
        "Run a comprehensive 5-stage synthesis pipeline: (1) web search for current data, (2) parallel model queries, (3) information extraction, (4) gap detection, (5) meta-synthesis. Use this for research questions requiring thorough analysis, current information, and identification of knowledge gaps. More comprehensive than deep_research or query_consensus alone.",
      parameters: {
        query: {
          type: "string",
          description: "The research question or topic for synthesis",
          required: true,
        },
        speed_tier: {
          type: "string",
          description:
            "Speed/quality tier: 'fast', 'normal', or 'max'. Higher tiers use more capable models. Default: 'normal'",
          required: false,
        },
      },
    },
    {
      name: "task_complete",
      description:
        "Signal that the task is complete. Call this when you have finished the requested task and want to provide a final summary. IMPORTANT: You MUST call this tool when the task is done.",
      parameters: {
        summary: {
          type: "string",
          description:
            "A comprehensive summary of what was accomplished, including key results and any files created",
          required: true,
        },
        artifacts: {
          type: "array",
          description:
            "Optional array of artifact objects (files, outputs) created during the task",
          required: false,
          items: { type: "object" },
        },
      },
    },
    // === PROJECT SCAFFOLDING TOOLS ===
    {
      name: "scaffold_project",
      description:
        "Scaffold a new web application project with production-ready structure. Supports React, Next.js, Vue, Svelte, Express, FastAPI, and Rails. Optionally includes database setup, authentication, and UI component libraries (shadcn/ui, Radix, Headless UI).",
      parameters: {
        projectName: {
          type: "string",
          description: "Name of the project (used for directory name)",
          required: true,
        },
        projectType: {
          type: "string",
          description:
            "Framework type: 'react', 'nextjs', 'vue', 'svelte', 'express', 'fastapi', or 'rails'",
          required: true,
        },
        outputPath: {
          type: "string",
          description:
            "Parent directory for the project (default: /tmp/jarvis-projects)",
          required: false,
        },
        database: {
          type: "string",
          description:
            "Database to set up: 'postgresql', 'mysql', 'mongodb', or 'sqlite'",
          required: false,
        },
        authentication: {
          type: "string",
          description: "Auth system to include: 'jwt', 'oauth', or 'session'",
          required: false,
        },
        features: {
          type: "array",
          items: { type: "string" },
          description:
            "Additional features to include (e.g., 'testing', 'docker', 'ci')",
          required: false,
        },
        uiLibrary: {
          type: "string",
          description:
            "UI component library: 'shadcn' (shadcn/ui with Tailwind), 'radix' (Radix UI primitives), 'headless' (Headless UI), or 'none'. Default: none",
          required: false,
        },
        uiTheme: {
          type: "string",
          description:
            "UI theme mode: 'light', 'dark', or 'system'. Default: system",
          required: false,
        },
        uiComponents: {
          type: "array",
          items: { type: "string" },
          description:
            "Specific UI components to include (for shadcn: 'button', 'card', 'input', 'label', 'badge', etc.)",
          required: false,
        },
        testing: {
          type: "boolean",
          description:
            "Include test setup with sample tests. Sets up vitest (React/Vue/Svelte), jest (Next.js/Express), pytest (FastAPI), or minitest (Rails).",
          required: false,
        },
        testCoverage: {
          type: "boolean",
          description:
            "Include test coverage configuration (requires testing: true).",
          required: false,
        },
        docker: {
          type: "boolean",
          description:
            "Include Docker containerization (Dockerfile, .dockerignore). Generates production-ready multi-stage builds for each framework.",
          required: false,
        },
        dockerCompose: {
          type: "boolean",
          description:
            "Include docker-compose.yml for orchestration (requires docker: true). Default: true when docker is enabled.",
          required: false,
        },
        dockerServices: {
          type: "array",
          items: { type: "string" },
          description:
            "Additional Docker services to include in docker-compose: 'postgres', 'mysql', 'redis', 'mongodb'",
          required: false,
        },
      },
    },
    {
      name: "list_document_templates",
      description:
        "List all available document templates. Use this to see what pre-defined templates are available for creating professional documents like business reports, meeting notes, invoices, SOWs, API docs, etc.",
      parameters: {},
    },
    {
      name: "get_document_template",
      description:
        "Get detailed information about a specific document template including required variables and structure preview.",
      parameters: {
        templateType: {
          type: "string",
          description:
            "Template type: business_report, technical_doc, meeting_notes, project_proposal, status_update, research_summary, executive_brief, invoice, sow, api_doc",
          required: true,
        },
      },
    },
    {
      name: "render_document_template",
      description:
        "Render a document using a pre-defined template. Provide the template type and variable values to generate a professional document. Optionally save to file.",
      parameters: {
        templateType: {
          type: "string",
          description:
            "Template type: business_report, technical_doc, meeting_notes, project_proposal, status_update, research_summary, executive_brief, invoice, sow, api_doc",
          required: true,
        },
        variables: {
          type: "object",
          description:
            "Variable values for the template. Use get_document_template to see required/optional variables.",
          required: true,
        },
        outputPath: {
          type: "string",
          description:
            "Optional file path to save the rendered document. Format determined by template (docx, html, markdown).",
          required: false,
        },
      },
    },
    ...getDynamicTools().map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    })),
  ];
}

export async function initializeDynamicTools(): Promise<number> {
  return loadDynamicToolsFromDatabase();
}
