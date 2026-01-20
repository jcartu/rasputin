/**
 * JARVIS Orchestrator - The Brain
 * Uses direct API connections (Anthropic, Cerebras, Gemini, Grok) for autonomous task execution
 */

import * as fs from "fs/promises";
import { getAvailableTools } from "./tools";
import {
  createExecutionPlan,
  formatPlanForPrompt,
  assessComplexity,
} from "./strategicPlanner";
import {
  validateToolOutput,
  enhanceErrorOutput,
  formatValidationMessage,
  isDefiniteError,
  type ToolValidationResult,
} from "./toolValidation";
import { postTaskEvolution, type TaskOutcome } from "./autoEvolution";
import {
  classifyError,
  shouldRetry,
  getRetryDelay,
  formatErrorForLog,
  type ClassifiedError,
} from "./errorClassification";
import { recordFailure, getFailureContext } from "./failureMemory";
import { decideFallback } from "./fallbackPolicy";
import {
  createInitialState,
  updateStrategy,
  generateStrategyPrompt,
  shouldForceComplete,
  type StrategyState,
} from "./strategySwitching";
import {
  recordTaskPerformance,
  getPerformanceGuidance,
  formatPerformanceReport,
  getOptimizedPromptContext,
} from "./performanceTracking";
import {
  routeTask,
  recordModelPerformance,
  formatRoutingReport,
  type RoutingDecision,
} from "./modelRouter";
import {
  validateTaskQuality,
  generateQualityImprovementPrompt,
  determineEscalationStrategy,
  type TaskContext,
  type FileInfo,
} from "./qualityAssurance";
import { getEventLogger, getSharedMemoryBus, connectRedis } from "../bus";
import {
  routeRequest as routeToProvider,
  type RoutingContext,
} from "./intelligentRouter";
import { getCachedLLMResponse, setCachedLLMResponse } from "../knowledgeCache";
import {
  getGlobalSwarmOrchestrator,
  createFrontierExecutor,
  analyzeTask as analyzeTaskV3,
  type ExecutionContext as V3ExecutionContext,
} from "./v3";
import {
  getGlobalMemoryClient,
  type V3MemoryIntegration,
} from "./v3/memoryIntegration";
import { extractLearningFromExecution } from "./v3/learningExtractor";
import type { ToolCategory } from "./v3/types";

// Get API keys from environment - Direct connections, no OpenRouter middleman
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY || "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const XAI_API_KEY = process.env.XAI_API_KEY || "";

// V3 Swarm Mode - enables multi-agent orchestration with frontier APIs
// Default ON - set JARVIS_SWARM_MODE=false to disable
const SWARM_MODE_ENABLED = process.env.JARVIS_SWARM_MODE !== "false";

// Inference provider type
type InferenceProvider = "anthropic" | "cerebras" | "gemini" | "grok";

// Current provider - default to Cerebras for speed, fallback to Anthropic for complex tasks
let currentProvider: InferenceProvider = "cerebras";

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

function buildJarvisTools(): OpenRouterTool[] {
  return getAvailableTools().map(tool => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: "object" as const,
        properties: Object.fromEntries(
          Object.entries(tool.parameters).map(([key, val]) => {
            const prop: Record<string, unknown> = {
              type: val.type,
              description: val.description,
            };
            // Gemini requires 'items' field for array types
            if (val.type === "array") {
              prop.items = val.items || { type: "string" };
            }
            return [key, prop];
          })
        ),
        required: Object.entries(tool.parameters)
          .filter(([, val]) => val.required)
          .map(([key]) => key),
      },
    },
  }));
}

const JARVIS_TOOLS: OpenRouterTool[] = buildJarvisTools();

function getCurrentDateString(): string {
  const now = new Date();
  return now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const TOOL_SELECTION_GUIDE = `
TOOL SELECTION GUIDE (use the RIGHT tool for each task):

For CREATING NEW PROJECTS:
  1. scaffold_project - Creates complete project structure with config files
     - Supports: react, nextjs, vue, svelte, express, fastapi, rails
     - Example: scaffold_project("my-app", "react", "/tmp/projects")
  2. Then: install_dependencies to install packages
  3. Then: start_dev_server to run it

For WEATHER DATA:
  ALWAYS use get_weather tool - it has multiple fallback APIs and beautiful formatting!
  Example: get_weather("Paris, France")

For OTHER CURRENT DATA (prices, news, etc.):
  1. http_request to a known API (preferred - more reliable)
     - Crypto: https://api.coinbase.com/v2/prices/BTC-USD/spot
  2. web_search (fallback if no direct API)
  3. browse_url to a specific data page (last resort)

For SECURITY ANALYSIS (ALWAYS use specialized tools first!):
  1. npm_audit tool - REQUIRED for vulnerability scanning
  2. security_analysis tool - for comprehensive security report
  3. read_file package.json for manual review

For FILE CREATION:
  1. write_file for plain text/code files (.txt, .py, .js, etc.)
  2. create_rich_report for REPORTS with visuals - USE THIS for ANY report, analysis, or document that benefits from charts, diagrams, images, or professional formatting. Creates stunning HTML with:
     - SVG pie/bar/line charts (no API needed!)
     - Flowcharts, timelines, stat cards
     - AI-generated images embedded
     - Progress bars, callouts, quotes, comparison tables
     - Professional styling (medical/business/executive/technical/modern)
     - Exports perfectly to PDF via browser print
  3. write_docx for Word documents (.docx) when user specifically needs Word format
  4. read_file to VERIFY content was created correctly
  5. For code: execute the file to test it works
  
  IMPORTANT: For reports, analyses, forecasts, summaries, medical explanations, business plans, etc - ALWAYS use create_rich_report instead of plain markdown!

For RUNNING SHELL COMMANDS:
  1. run_shell - Execute any shell command
  2. For background processes: use tmux_start instead

For DEV SERVER MANAGEMENT:
  1. start_dev_server - Start server in background
  2. get_dev_server_output - Check server logs
  3. stop_dev_server - Stop when done

For GIT OPERATIONS:
  1. git_init - Initialize new repo
  2. git_clone - Clone existing repo
  3. git_status - See current state
  4. git_diff - Review changes
  5. git_commit - Commit changes
  6. git_push/git_pull - Sync with remote
  7. git_create_pr - Create GitHub pull request

For SELF-INTROSPECTION (status, capabilities, skills):
  - self_comprehensive_introspection - Get status, capabilities, skills, memory stats in ONE call
  - Individual self_* tools available if you need specific deep details
  - Note: If introspection tools fail, summarize your known capabilities from context
`;

const FAILURE_RECOVERY_PROTOCOL = `
FAILURE RECOVERY (when a tool fails):

Step 1: Identify WHY it failed
  - API error? Try alternative API or tool
  - File not found? Check path, create directory
  - Permission denied? Try different approach
  - Timeout? Retry with longer timeout or smaller task

Step 2: Try ALTERNATIVE tools (max 2 fallbacks)
  Tool Failed          | Try Instead
  ---------------------|---------------------------
  web_search           | http_request to API, browse_url
  http_request         | browse_url, playwright_browse
  execute_python       | execute_javascript, execute_shell
  write_file           | execute_shell with echo/cat
  npm_audit            | execute_shell 'pnpm audit'

Step 3: If all alternatives fail
  - Explain what you tried
  - Suggest what the user could do manually
  - NEVER just say "I couldn't do it" without details
`;

const VERIFICATION_PROTOCOL = `
MANDATORY VERIFICATION PROTOCOL (BLOCKING - task_complete will be REJECTED without this):

CRITICAL: If user requested FILE OUTPUT (MD, document, report, etc.):
  1. You MUST call write_file to save the content - execute_python creating strings does NOT save files!
  2. EXCEPTION: create_rich_report automatically verifies file creation - no additional verification needed!
  3. For write_file: You MUST call read_file to VERIFY content BEFORE calling task_complete

For FILE tasks:
  - If using create_rich_report: Just call the tool and then task_complete (it self-verifies)
  - If using write_file: Call write_file, then read_file to confirm, then task_complete
  - DO NOT call list_files after create_rich_report - it wastes time and the tool confirms success

For CODE tasks:
  - Execute the code to verify it runs
  - Check output matches expectations
  - Run tests if available

For SERVER tasks:
  - check_dev_server or http_request to verify response
  - Check for errors in tmux_output

For SEARCH tasks:
  - Verify the information answers the question
  - Cross-reference if critical

WARNING: Calling task_complete without verification when files were requested = TASK FAILURE.
The user will receive nothing. You MUST save files with write_file, not just generate content in memory.
`;

function getJarvisSystemPrompt(): string {
  return `You are JARVIS, an autonomous AI agent assistant with advanced capabilities. Today's date is ${getCurrentDateString()}.

CORE CAPABILITIES:
- Web search and browsing (with automatic fallbacks)
- Code execution (Python, JavaScript, shell commands)
  IMPORTANT: execute_python has a networkEnabled parameter. Set networkEnabled=true when Python code needs to fetch data from the internet (API calls, HTTP requests, web scraping)
- File management (read, write, list files)
- HTTP API requests (for current data like prices)
- Image generation and analysis (vision, screenshots)
- Security analysis (npm_audit, security_analysis)
- SSH access to remote servers
- Git operations (status, diff, commit, push, pull)
- PDF reading and document analysis
- Audio transcription and text-to-speech

ADVANCED CAPABILITIES:
- Persistent Memory: search_memory, store_memory to recall and learn from past experiences
- Multi-Agent Teams: spawn_agent_team for complex tasks, delegate_to_agent for specialized work
- Agent Types: code, research, sysadmin, data, worker - each with domain expertise
- MCP Integration: connect_mcp_server for external tools (Slack, Jira, databases)
- Self-Review: Use self_review for important tasks before delivering final response

MULTI-MODEL INTELLIGENCE (query_consensus, query_synthesis):
- query_consensus: Query GPT-5, Claude, Gemini, Grok in PARALLEL, get agreement % and unified answer
  USE WHEN: Need diverse perspectives, verifying accuracy, complex/controversial topics, comparing viewpoints
  EXAMPLE: "What are the pros and cons of microservices?" → Get 5+ model perspectives
  
- query_synthesis: Full 5-stage pipeline (web search → parallel models → extract → gaps → synthesize)
  USE WHEN: Research requiring current web data, comprehensive analysis, identifying knowledge gaps
  EXAMPLE: "Latest developments in quantum computing 2026" → Web + multi-model + gap analysis
  
DECISION GUIDE for multi-model tools:
- Simple factual question → web_search or single API call
- Need current + verified data → query_synthesis (includes web search)
- Need multiple expert opinions → query_consensus
- Deep dive research → deep_research (multi-source) OR query_synthesis (multi-model + web)
- Controversial/subjective topics → query_consensus (see where models agree/disagree)

${TOOL_SELECTION_GUIDE}

${FAILURE_RECOVERY_PROTOCOL}

${VERIFICATION_PROTOCOL}

EXECUTION PATTERN:
1. Plan: Break complex tasks into steps
2. Recall: Check memory for relevant past experiences (search_memory)
3. Execute: Use the RIGHT tool for each step
4. Delegate: For complex subtasks, use spawn_agent or delegate_to_agent
5. Verify: Confirm each step succeeded
6. Learn: Store important learnings (store_memory)
7. Review: For critical tasks, use self_review before completing
8. Complete: Only when verified, use task_complete

PRIORITIZATION - DELIVER VALUE FIRST:
When a task has both ESSENTIAL and OPTIONAL components:
- ESSENTIAL = core answer/explanation the user needs (e.g., "explain what's wrong")
- OPTIONAL = enhancements like diagrams, visualizations, formatting
ALWAYS deliver the ESSENTIAL answer FIRST before attempting OPTIONAL items.
If image generation or other expensive tools fail, STILL COMPLETE THE TASK with text-based answer.
Example: "Explain my MRI and provide diagrams" → Explain MRI findings FIRST → THEN attempt diagrams
If diagrams fail after 1 attempt, complete task with text explanation + note "diagrams unavailable"

CRITICAL - DELIVERABLE WRITING STRATEGY:
When the user requests MULTIPLE FILES or DELIVERABLES:
- Write EACH file as soon as you have enough information for it
- Do NOT wait until all research is complete to start writing
- Example: If asked for "2 MD files", write File 1 after initial research, then continue for File 2
- NEVER spend 80% of iterations researching and only 20% writing
- Target: 3-4 research iterations MAX before writing the first deliverable

SPEED OPTIMIZATION:
- For self-analysis tasks (analyzing your own code/capabilities): Use self_introspection and self_index_code directly
- AVOID query_synthesis for tasks about YOUR OWN CODE - you already have direct access
- query_synthesis is for EXTERNAL research requiring web data + multi-model consensus
- For code analysis: self_search_code → self_index_code → write_file (fast path)
- For capability audits: self_comprehensive_introspection → write_file (fast path)

You have access to a sandboxed environment for code execution.
Work autonomously until verified complete, then use task_complete.
Always provide a comprehensive summary of what you accomplished AND verified.`;
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

export type TaskStage =
  | "initializing"
  | "planning"
  | "executing"
  | "verifying"
  | "recovering"
  | "complete"
  | "error";

export interface TaskProgress {
  stage: TaskStage;
  stageProgress: number;
  overallProgress: number;
  currentAction: string;
  toolsCompleted: number;
  toolsTotal: number;
  iterationsCurrent: number;
  iterationsMax: number;
  tokensUsed: number;
  tokensBudget: number;
  estimatedTimeRemainingMs?: number;
  partialResults?: string[];
}

export interface OrchestratorCallbacks {
  onThinking: (thought: string) => void;
  onThinkingChunk?: (chunk: string) => void;
  onToolCall: (toolCall: ToolCall) => void;
  onToolResult: (result: ToolResult) => void;
  onComplete: (summary: string, artifacts?: unknown[]) => void;
  onError: (error: string) => void;
  onIteration?: (iteration: number, maxIterations: number) => void;
  onProgress?: (progress: TaskProgress) => void;
}

const TOOL_ALTERNATIVES: Record<string, string[]> = {
  web_search: ["searxng_search", "http_request", "browse_url"],
  http_request: ["browse_url", "playwright_browse"],
  execute_python: ["execute_javascript", "execute_shell"],
  execute_javascript: ["execute_python", "execute_shell"],
  browse_url: ["playwright_browse", "http_request"],
  npm_audit: ["security_analysis", "execute_shell"],
};

const EXPENSIVE_TOOLS = new Set([
  "generate_image",
  "playwright_browse",
  "screenshot",
  "browser_session_start",
]);
const MAX_EXPENSIVE_TOOL_RETRIES = 1;

const MAX_IDENTICAL_CALLS_PER_APPROACH = 2;
export const MAX_ITERATIONS = 25;
export const MAX_TASK_DURATION_MS = 15 * 60 * 1000;
export const MAX_TOOL_DURATION_MS = 3 * 60 * 1000;

interface ToolExecutionContext {
  failedTools: Map<string, number>;
  lastToolOutputs: Map<string, string>;
  attemptedCalls: Map<string, number>;
  tokenEstimate: number;
  tokenBudget: number;
  consecutiveFailures: number;
  lastFailureTime: number;
  approachPivots: number;
  failedApproaches: string[];
  progressTracker: ProgressTracker;
  evolutionTracker: EvolutionTracker;
  strategyState: StrategyState;
  signatureFailures: Map<string, number>;
  lastClassifiedError?: ClassifiedError;
  userId?: number;
  taskId?: number;
  qaRetryCount: number;
  wasEscalated: boolean;
  memoryClient?: V3MemoryIntegration;
  offloadedOutputs: Map<string, string>;
}

interface EvolutionTracker {
  toolsUsed: Set<string>;
  toolsFailed: Set<string>;
  startTime: number;
  lastError?: string;
}

interface ProgressTracker {
  stage: TaskStage;
  startTime: number;
  phaseStartTimes: Map<TaskStage, number>;
  toolsCompletedThisIteration: number;
  toolsTotalThisIteration: number;
  iterationDurations: number[];
  partialResults: string[];
}

function createProgressTracker(): ProgressTracker {
  return {
    stage: "initializing",
    startTime: Date.now(),
    phaseStartTimes: new Map([["initializing", Date.now()]]),
    toolsCompletedThisIteration: 0,
    toolsTotalThisIteration: 0,
    iterationDurations: [],
    partialResults: [],
  };
}

function calculateEstimatedTimeRemaining(
  tracker: ProgressTracker,
  currentIteration: number,
  maxIterations: number
): number | undefined {
  if (tracker.iterationDurations.length < 2) return undefined;

  const avgDuration =
    tracker.iterationDurations.reduce((a, b) => a + b, 0) /
    tracker.iterationDurations.length;
  const remainingIterations = maxIterations - currentIteration;

  return Math.round(avgDuration * remainingIterations * 0.7);
}

function buildProgress(
  tracker: ProgressTracker,
  context: ToolExecutionContext,
  currentIteration: number,
  maxIterations: number,
  currentAction: string
): TaskProgress {
  const iterationProgress =
    maxIterations > 0 ? (currentIteration / maxIterations) * 100 : 0;

  const toolProgress =
    tracker.toolsTotalThisIteration > 0
      ? (tracker.toolsCompletedThisIteration /
          tracker.toolsTotalThisIteration) *
        100
      : 0;

  let stageWeight = 0;
  switch (tracker.stage) {
    case "initializing":
      stageWeight = 0;
      break;
    case "planning":
      stageWeight = 10;
      break;
    case "executing":
      stageWeight = 50;
      break;
    case "verifying":
      stageWeight = 85;
      break;
    case "recovering":
      stageWeight = 70;
      break;
    case "complete":
      stageWeight = 100;
      break;
    case "error":
      stageWeight = iterationProgress;
      break;
  }

  const overallProgress = Math.min(
    99,
    Math.round(stageWeight * 0.4 + iterationProgress * 0.4 + toolProgress * 0.2)
  );

  return {
    stage: tracker.stage,
    stageProgress: Math.round(toolProgress),
    overallProgress,
    currentAction,
    toolsCompleted: tracker.toolsCompletedThisIteration,
    toolsTotal: tracker.toolsTotalThisIteration,
    iterationsCurrent: currentIteration,
    iterationsMax: maxIterations,
    tokensUsed: context.tokenEstimate,
    tokensBudget: context.tokenBudget,
    estimatedTimeRemainingMs: calculateEstimatedTimeRemaining(
      tracker,
      currentIteration,
      maxIterations
    ),
    partialResults:
      tracker.partialResults.length > 0
        ? tracker.partialResults.slice(-5)
        : undefined,
  };
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

const MAX_CONTEXT_TOKENS = 150000;
const LARGE_OUTPUT_THRESHOLD = 4000;
const RAG_RETRIEVAL_LIMIT = 5;

function summarizeToolOutput(output: string, maxLen: number = 500): string {
  if (output.length <= maxLen) return output;
  const firstPart = output.slice(0, maxLen / 2);
  const lastPart = output.slice(-maxLen / 4);
  return `${firstPart}\n\n[...truncated ${output.length - maxLen} chars, full output stored in memory...]\n\n${lastPart}`;
}

async function offloadLargeToolOutput(
  toolName: string,
  toolCallId: string,
  output: string,
  context: ToolExecutionContext,
  taskContext: string
): Promise<string> {
  if (!context.memoryClient || output.length < LARGE_OUTPUT_THRESHOLD) {
    return output;
  }

  const toolCategory = inferToolCategory(toolName);

  try {
    await context.memoryClient.recordExecution({
      toolName,
      category: toolCategory,
      params: {},
      result: {
        success: true,
        output,
        durationMs: 0,
      },
      context: {
        sessionId: `task-${context.taskId || Date.now()}`,
        userId: context.userId || 0,
        taskId: context.taskId || Date.now(),
        params: {},
        startTime: Date.now(),
        leaseManager: {
          acquire: async () => true,
          release: async () => {},
          isHeld: async () => false,
          extend: async () => true,
        },
        qdrant: {
          search: async () => [],
          upsert: async () => {},
          delete: async () => {},
        },
        redis: {
          xadd: async () => "0-0",
          xread: async () => [],
          get: async () => null,
          set: async () => {},
          publish: async () => 0,
        },
      },
    });

    context.offloadedOutputs.set(toolCallId, `${toolName}:${Date.now()}`);
    console.info(
      `[JARVIS-RAG] Offloaded large output from ${toolName} (${output.length} chars) to memory`
    );

    return summarizeToolOutput(output);
  } catch (err) {
    console.warn(`[JARVIS-RAG] Failed to offload output:`, err);
    return output;
  }
}

function inferToolCategory(toolName: string): ToolCategory {
  if (
    toolName.includes("file") ||
    toolName.includes("read") ||
    toolName.includes("write")
  )
    return "file";
  if (toolName.includes("git")) return "git";
  if (toolName.includes("ssh")) return "ssh";
  if (toolName.includes("docker")) return "docker";
  if (toolName.includes("web") || toolName.includes("browse")) return "web";
  if (toolName.includes("search") || toolName.includes("research"))
    return "research";
  if (toolName.includes("database") || toolName.includes("query"))
    return "database";
  if (toolName.includes("execute") || toolName.includes("python"))
    return "code";
  if (toolName.includes("scaffold")) return "scaffold";
  return "system";
}

async function retrieveRelevantContext(
  task: string,
  memoryClient: V3MemoryIntegration | undefined
): Promise<string> {
  if (!memoryClient) return "";

  try {
    const learnings = await memoryClient.searchRelevantLearnings(task, {
      limit: RAG_RETRIEVAL_LIMIT,
    });

    if (learnings.length === 0) return "";

    const contextParts = learnings
      .filter(l => l.relevance > 0.3)
      .map(l => {
        const prefix =
          l.type === "procedural"
            ? "[Procedure]"
            : l.type === "semantic"
              ? "[Fact]"
              : "[Experience]";
        return `${prefix} ${l.content.slice(0, 300)}`;
      });

    if (contextParts.length === 0) return "";

    return `\n\n--- RETRIEVED MEMORY CONTEXT ---\n${contextParts.join("\n")}\n--- END MEMORY CONTEXT ---`;
  } catch (err) {
    console.warn("[JARVIS-RAG] Failed to retrieve context:", err);
    return "";
  }
}

async function trimMessagesToFitContextWithRAG(
  messages: OpenRouterMessage[],
  systemPrompt: string,
  task: string,
  memoryClient: V3MemoryIntegration | undefined
): Promise<OpenRouterMessage[]> {
  const systemTokens = estimateTokens(systemPrompt);
  const availableTokens = MAX_CONTEXT_TOKENS - systemTokens;

  let totalTokens = 0;
  for (const msg of messages) {
    const content =
      typeof msg.content === "string"
        ? msg.content
        : JSON.stringify(msg.content);
    totalTokens += estimateTokens(content);
  }

  if (totalTokens <= availableTokens) {
    return messages;
  }

  console.warn(
    `[JARVIS-RAG] Context too large (${totalTokens} tokens), using RAG-enhanced trimming`
  );

  const trimmed: OpenRouterMessage[] = [];
  let usedTokens = 0;

  if (messages.length > 0) {
    const firstContent =
      typeof messages[0].content === "string"
        ? messages[0].content
        : JSON.stringify(messages[0].content);
    usedTokens += estimateTokens(firstContent);
    trimmed.push(messages[0]);
  }

  const retrievedContext = await retrieveRelevantContext(task, memoryClient);
  const contextNote = retrievedContext
    ? `[Earlier context was compressed to memory. Relevant learnings retrieved below.]${retrievedContext}`
    : "[Earlier context was trimmed. Relevant past learnings will be retrieved as needed.]";

  const trimNote = {
    role: "user" as const,
    content: contextNote,
  };
  usedTokens += estimateTokens(trimNote.content);
  trimmed.push(trimNote);

  const recentMessages: OpenRouterMessage[] = [];
  for (let i = messages.length - 1; i > 0; i--) {
    const msg = messages[i];
    const content =
      typeof msg.content === "string"
        ? msg.content
        : JSON.stringify(msg.content);
    const msgTokens = estimateTokens(content);

    if (usedTokens + msgTokens > availableTokens) {
      break;
    }

    usedTokens += msgTokens;
    recentMessages.unshift(msg);
  }

  return [...trimmed, ...recentMessages];
}

function trimMessagesToFitContext(
  messages: OpenRouterMessage[],
  systemPrompt: string
): OpenRouterMessage[] {
  const systemTokens = estimateTokens(systemPrompt);
  const availableTokens = MAX_CONTEXT_TOKENS - systemTokens;

  let totalTokens = 0;
  for (const msg of messages) {
    const content =
      typeof msg.content === "string"
        ? msg.content
        : JSON.stringify(msg.content);
    totalTokens += estimateTokens(content);
  }

  if (totalTokens <= availableTokens) {
    return messages;
  }

  console.warn(
    `[JARVIS] Context too large (${totalTokens} tokens), trimming to ${availableTokens}`
  );

  const trimmed: OpenRouterMessage[] = [];
  let usedTokens = 0;

  if (messages.length > 0) {
    const firstContent =
      typeof messages[0].content === "string"
        ? messages[0].content
        : JSON.stringify(messages[0].content);
    usedTokens += estimateTokens(firstContent);
    trimmed.push(messages[0]);
  }

  const trimNote = {
    role: "user" as const,
    content:
      "[Context trimmed for token limits. Earlier conversation history has been removed to stay within model limits. Please continue with the current task.]",
  };
  usedTokens += estimateTokens(trimNote.content);
  trimmed.push(trimNote);

  const recentMessages: OpenRouterMessage[] = [];
  for (let i = messages.length - 1; i > 0; i--) {
    const msg = messages[i];
    const content =
      typeof msg.content === "string"
        ? msg.content
        : JSON.stringify(msg.content);
    const msgTokens = estimateTokens(content);

    if (usedTokens + msgTokens > availableTokens) {
      break;
    }

    usedTokens += msgTokens;
    recentMessages.unshift(msg);
  }

  return [...trimmed, ...recentMessages];
}

function calculateBackoffDelay(failures: number): number {
  const baseDelay = 500;
  const maxDelay = 10000;
  return Math.min(baseDelay * Math.pow(2, failures - 1), maxDelay);
}

function summarizeFailedApproach(
  toolCalls: ToolCall[],
  errors: string[]
): string {
  const tools = toolCalls.map(tc => tc.name).join(", ");
  const errorSummary = errors.slice(0, 2).join("; ");
  return `Tools: [${tools}] - Errors: ${errorSummary}`;
}

function hashToolCall(name: string, input: Record<string, unknown>): string {
  const normalized = JSON.stringify(
    { name, input },
    Object.keys({ name, input }).sort()
  );
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return `${name}:${hash.toString(16)}`;
}

function getAlternativeTool(
  failedTool: string,
  context: ToolExecutionContext
): string | null {
  const alternatives = TOOL_ALTERNATIVES[failedTool] || [];
  for (const alt of alternatives) {
    const failCount = context.failedTools.get(alt) || 0;
    if (failCount < 2) {
      return alt;
    }
  }
  return null;
}

function isToolResultError(output: string): boolean {
  const successIndicators = [
    /successfully/i,
    /completed/i,
    /created:/i,
    /written/i,
    /\d+ files indexed/i,
    /## .+ Report/i,
  ];
  if (successIndicators.some(p => p.test(output))) {
    return false;
  }

  const errorPatterns = [
    /^Error:/im,
    /^failed to /im,
    /^ENOENT/m,
    /^ECONNREFUSED/m,
    /^permission denied/im,
    /Traceback \(most recent call last\)/,
    /SyntaxError:/,
    /TypeError:/,
    /ReferenceError:/,
    /fatal error/i,
  ];
  return errorPatterns.some(p => p.test(output));
}

function suggestVerificationTool(
  toolName: string,
  input: Record<string, unknown>
): { tool: string; input: Record<string, unknown> } | null {
  switch (toolName) {
    case "write_file":
      return {
        tool: "read_file",
        input: { path: input.path },
      };
    case "tmux_start":
      return {
        tool: "tmux_output",
        input: { sessionName: input.sessionName, lines: 20 },
      };
    case "start_dev_server":
      return {
        tool: "check_dev_server",
        input: { port: input.port || 5173 },
      };
    case "git_commit":
      return {
        tool: "git_status",
        input: { projectPath: input.projectPath },
      };
    case "execute_shell":
    case "execute_python":
    case "execute_javascript":
      return null;
    default:
      return null;
  }
}

const PARALLELIZABLE_TOOLS = new Set([
  "web_search",
  "searxng_search",
  "browse_url",
  "read_file",
  "list_files",
  "calculate",
  "http_request",
  "get_datetime",
  "json_tool",
  "text_process",
  "ssh_read_file",
  "ssh_list_files",
  "screenshot",
  "playwright_browse",
  "git_status",
  "git_diff",
  "git_log",
  "database_query",
  "analyze_screenshot",
  "self_how_am_i_doing",
  "self_what_can_i_do",
  "self_list_skills",
  "self_suggest_improvement",
  "self_search_code",
  "self_get_symbol",
  "self_what_do_i_know",
  "self_modification_history",
  "get_memory_stats",
  "recall_memory",
]);

function canRunInParallel(toolName: string): boolean {
  return PARALLELIZABLE_TOOLS.has(toolName);
}

async function executeToolsInParallel(
  toolCalls: ToolCall[],
  executeToolFn: (
    name: string,
    input: Record<string, unknown>
  ) => Promise<string>,
  executionContext: ToolExecutionContext,
  _callbacks: OrchestratorCallbacks
): Promise<
  Array<{
    tc: ToolCall;
    output: string;
    isError: boolean;
    validation?: ToolValidationResult;
  }>
> {
  const parallelizable = toolCalls.filter(tc => canRunInParallel(tc.name));
  const sequential = toolCalls.filter(tc => !canRunInParallel(tc.name));

  const results: Array<{
    tc: ToolCall;
    output: string;
    isError: boolean;
    validation?: ToolValidationResult;
  }> = [];

  if (parallelizable.length > 1) {
    const parallelResults = await Promise.all(
      parallelizable.map(async tc => {
        const callHash = hashToolCall(tc.name, tc.input);
        const callCount = executionContext.attemptedCalls.get(callHash) || 0;
        const maxRetries = EXPENSIVE_TOOLS.has(tc.name)
          ? MAX_EXPENSIVE_TOOL_RETRIES
          : MAX_IDENTICAL_CALLS_PER_APPROACH;
        if (callCount >= maxRetries) {
          const reason = EXPENSIVE_TOOLS.has(tc.name)
            ? `"${tc.name}" is an expensive/slow tool and failed. Skip diagram generation and focus on delivering the core text-based answer.`
            : `Identical call to "${tc.name}" was already attempted ${callCount} times this approach. Try a different approach.`;
          return {
            tc,
            output: `[Skipped] ${reason}`,
            isError: true,
          };
        }
        executionContext.attemptedCalls.set(callHash, callCount + 1);

        try {
          const output = await executeToolFn(tc.name, tc.input);
          const validation = validateToolOutput(tc.name, tc.input, output);
          const isError =
            isToolResultError(output) ||
            isDefiniteError(output) ||
            !validation.valid ||
            validation.confidence < 50;

          if (isError) {
            const failCount =
              (executionContext.failedTools.get(tc.name) || 0) + 1;
            executionContext.failedTools.set(tc.name, failCount);

            const enhancedOutput = enhanceErrorOutput(
              tc.name,
              tc.input,
              output
            );
            const validationMsg = formatValidationMessage(tc.name, validation);
            const finalOutput = validationMsg
              ? `${enhancedOutput}\n\n${validationMsg}`
              : enhancedOutput;

            return { tc, output: finalOutput, isError: true, validation };
          } else {
            executionContext.lastToolOutputs.set(tc.name, output);
            const finalOutput =
              validation.warnings.length > 0
                ? `${output}\n\n[Warnings: ${validation.warnings.join(", ")}]`
                : output;
            return { tc, output: finalOutput, isError: false, validation };
          }
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          const failCount =
            (executionContext.failedTools.get(tc.name) || 0) + 1;
          executionContext.failedTools.set(tc.name, failCount);
          const enhancedOutput = enhanceErrorOutput(
            tc.name,
            tc.input,
            `Error: ${errorMsg}`
          );
          return { tc, output: enhancedOutput, isError: true };
        }
      })
    );
    results.push(...parallelResults);
  } else {
    for (const tc of parallelizable) {
      const result = await executeSingleTool(
        tc,
        executeToolFn,
        executionContext
      );
      results.push(result);
    }
  }

  for (const tc of sequential) {
    const result = await executeSingleTool(tc, executeToolFn, executionContext);
    results.push(result);
  }

  return results;
}

async function executeSingleTool(
  tc: ToolCall,
  executeToolFn: (
    name: string,
    input: Record<string, unknown>
  ) => Promise<string>,
  executionContext: ToolExecutionContext
): Promise<{
  tc: ToolCall;
  output: string;
  isError: boolean;
  validation?: ToolValidationResult;
}> {
  const callHash = hashToolCall(tc.name, tc.input);
  const callCount = executionContext.attemptedCalls.get(callHash) || 0;
  const maxRetries = EXPENSIVE_TOOLS.has(tc.name)
    ? MAX_EXPENSIVE_TOOL_RETRIES
    : MAX_IDENTICAL_CALLS_PER_APPROACH;
  if (callCount >= maxRetries) {
    const reason = EXPENSIVE_TOOLS.has(tc.name)
      ? `"${tc.name}" is an expensive/slow tool and failed. Skip diagram generation and focus on delivering the core text-based answer.`
      : `Identical call to "${tc.name}" was already attempted ${callCount} times this approach. Try a different approach.`;
    return {
      tc,
      output: `[Skipped] ${reason}`,
      isError: true,
    };
  }
  executionContext.attemptedCalls.set(callHash, callCount + 1);

  let output: string;
  let isError = false;
  let validation: ToolValidationResult | undefined;

  try {
    output = await executeToolFn(tc.name, tc.input);

    validation = validateToolOutput(tc.name, tc.input, output);

    if (isToolResultError(output) || isDefiniteError(output)) {
      isError = true;

      const classified = classifyError({
        toolName: tc.name,
        output,
      });

      console.info(`[JARVIS] ${formatErrorForLog(classified)}`);

      executionContext.lastClassifiedError = classified;
      const sigCount =
        (executionContext.signatureFailures.get(classified.signature) || 0) + 1;
      executionContext.signatureFailures.set(classified.signature, sigCount);

      executionContext.strategyState = updateStrategy(
        executionContext.strategyState,
        {
          classified,
          consecutiveFailures: executionContext.consecutiveFailures,
          sameSignatureCount: sigCount,
          lastToolName: tc.name,
        }
      );

      const failCount = (executionContext.failedTools.get(tc.name) || 0) + 1;
      executionContext.failedTools.set(tc.name, failCount);

      output = enhanceErrorOutput(tc.name, tc.input, output);
      output += `\n\n[Error Class: ${classified.class.toUpperCase()}]`;

      const altTool = getAlternativeTool(tc.name, executionContext);
      if (
        altTool &&
        failCount <= 2 &&
        !executionContext.strategyState.toolBlacklist.has(altTool)
      ) {
        output += `\n\n[JARVIS] Tool "${tc.name}" failed. Suggesting alternative: "${altTool}"`;
      }

      const strategyNote = generateStrategyPrompt(
        executionContext.strategyState
      );
      if (strategyNote) {
        output += `\n${strategyNote}`;
      }
    } else if (!validation.valid || validation.confidence < 50) {
      isError = true;
      const failCount = (executionContext.failedTools.get(tc.name) || 0) + 1;
      executionContext.failedTools.set(tc.name, failCount);

      const validationMsg = formatValidationMessage(tc.name, validation);
      if (validationMsg) {
        output += `\n\n${validationMsg}`;
      }

      const altTool = getAlternativeTool(tc.name, executionContext);
      if (altTool && failCount <= 2) {
        output += `\n\n[JARVIS] Consider using "${altTool}" as an alternative.`;
      }
    } else {
      executionContext.lastToolOutputs.set(tc.name, output);

      if (validation.warnings.length > 0) {
        output += `\n\n[Warnings: ${validation.warnings.join(", ")}]`;
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === "ApprovalRequiredError") {
      throw error;
    }
    const errorMsg = error instanceof Error ? error.message : String(error);
    output = `Error: ${errorMsg}`;
    isError = true;

    const classified = classifyError({
      toolName: tc.name,
      output,
      error,
    });

    console.info(`[JARVIS] ${formatErrorForLog(classified)}`);

    executionContext.lastClassifiedError = classified;
    const sigCount =
      (executionContext.signatureFailures.get(classified.signature) || 0) + 1;
    executionContext.signatureFailures.set(classified.signature, sigCount);

    executionContext.strategyState = updateStrategy(
      executionContext.strategyState,
      {
        classified,
        consecutiveFailures: executionContext.consecutiveFailures,
        sameSignatureCount: sigCount,
        lastToolName: tc.name,
      }
    );

    output = enhanceErrorOutput(tc.name, tc.input, output);
    output += `\n\n[Error Class: ${classified.class.toUpperCase()}]`;

    if (classified.retryable) {
      output += ` (retryable after ${classified.retryAfterMs || 1000}ms)`;
    }

    const failCount = (executionContext.failedTools.get(tc.name) || 0) + 1;
    executionContext.failedTools.set(tc.name, failCount);

    const altTool = getAlternativeTool(tc.name, executionContext);
    if (altTool && !executionContext.strategyState.toolBlacklist.has(altTool)) {
      output += `\n\n[JARVIS] Consider using "${altTool}" as an alternative.`;
    }

    const strategyNote = generateStrategyPrompt(executionContext.strategyState);
    if (strategyNote) {
      output += `\n${strategyNote}`;
    }
  }

  return { tc, output, isError, validation };
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
  else if (tier === "local")
    setInferenceProvider("anthropic"); // fallback to anthropic
  else if (tier === "cloud") setInferenceProvider("anthropic");
  else setInferenceProvider("anthropic");
}

export function getInferenceTier(): string {
  return currentProvider;
}

// Convert messages to Anthropic format
function toAnthropicMessages(messages: OpenRouterMessage[]): Array<{
  role: string;
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
}> {
  return messages.map(msg => {
    if (msg.role === "tool") {
      return {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: msg.tool_call_id || "",
            content:
              typeof msg.content === "string"
                ? msg.content
                : JSON.stringify(msg.content),
          },
        ],
      };
    }

    if (
      msg.role === "assistant" &&
      msg.tool_calls &&
      msg.tool_calls.length > 0
    ) {
      const contentBlocks: Array<{
        type: string;
        text?: string;
        id?: string;
        name?: string;
        input?: Record<string, unknown>;
      }> = [];

      if (
        msg.content &&
        typeof msg.content === "string" &&
        msg.content.trim()
      ) {
        contentBlocks.push({ type: "text", text: msg.content.trim() });
      }

      for (const tc of msg.tool_calls) {
        contentBlocks.push({
          type: "tool_use",
          id: tc.id,
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments || "{}"),
        });
      }

      return {
        role: "assistant",
        content: contentBlocks,
      };
    }

    const content =
      typeof msg.content === "string"
        ? msg.content
        : JSON.stringify(msg.content);
    return {
      role: msg.role === "assistant" ? "assistant" : "user",
      content: msg.role === "assistant" ? content.trim() : content,
    };
  });
}

// Convert tools to Anthropic format
function toAnthropicTools(
  tools: OpenRouterTool[]
): Array<{ name: string; description: string; input_schema: object }> {
  return tools.map(t => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters,
  }));
}

// Call Anthropic Claude API directly with streaming support
async function callAnthropic(
  messages: OpenRouterMessage[],
  systemPrompt: string,
  onChunk?: (chunk: string) => void
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
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 8192,
      system: systemPrompt,
      messages: anthropicMessages,
      tools: anthropicTools,
      stream: !!onChunk,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${error}`);
  }

  if (onChunk && response.body) {
    const toolCalls: OpenRouterToolCall[] = [];
    let textContent = "";
    let responseId = "";
    let stopReason = "stop";
    const toolInputBuffers: Map<number, string> = new Map();
    const toolBlocks: Map<number, { id: string; name: string; input: string }> =
      new Map();

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
              responseId = event.message?.id || "";
              break;
            case "content_block_start":
              if (event.content_block?.type === "tool_use") {
                toolBlocks.set(event.index, {
                  id: event.content_block.id,
                  name: event.content_block.name,
                  input: "",
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
            case "content_block_stop":
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
            case "message_delta":
              if (event.delta?.stop_reason) {
                stopReason =
                  event.delta.stop_reason === "end_turn"
                    ? "stop"
                    : event.delta.stop_reason;
              }
              break;
          }
        } catch {
          // Ignore parse errors for malformed chunks
        }
      }
    }

    return {
      id: responseId,
      choices: [
        {
          message: {
            role: "assistant",
            content: textContent || null,
            tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
          },
          finish_reason: stopReason,
        },
      ],
    };
  }

  const data = await response.json();

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
          arguments: JSON.stringify(block.input),
        },
      });
    }
  }

  return {
    id: data.id,
    choices: [
      {
        message: {
          role: "assistant",
          content: textContent || null,
          tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
        },
        finish_reason:
          data.stop_reason === "end_turn" ? "stop" : data.stop_reason || "stop",
      },
    ],
  };
}

// Call Cerebras API (OpenAI-compatible)
async function callCerebras(
  messages: OpenRouterMessage[],
  systemPrompt: string,
  _onChunk?: (chunk: string) => void
): Promise<OpenRouterResponse> {
  const response = await fetch("https://api.cerebras.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CEREBRAS_API_KEY}`,
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
  systemPrompt: string,
  _onChunk?: (chunk: string) => void
): Promise<OpenRouterResponse> {
  // Convert to Gemini format
  const geminiContents = messages.map(msg => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [
      {
        text:
          typeof msg.content === "string"
            ? msg.content
            : JSON.stringify(msg.content),
      },
    ],
  }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: geminiContents,
        tools: [
          {
            functionDeclarations: JARVIS_TOOLS.map(t => ({
              name: t.function.name,
              description: t.function.description,
              parameters: t.function.parameters,
            })),
          },
        ],
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
          arguments: JSON.stringify(part.functionCall.args),
        },
      });
    }
  }

  return {
    id: `gemini_${Date.now()}`,
    choices: [
      {
        message: {
          role: "assistant",
          content: textContent || null,
          tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
        },
        finish_reason: candidate?.finishReason || "stop",
      },
    ],
  };
}

// Call Grok (xAI) API - OpenAI-compatible
async function callGrok(
  messages: OpenRouterMessage[],
  systemPrompt: string,
  _onChunk?: (chunk: string) => void
): Promise<OpenRouterResponse> {
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "grok-4.1",
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

const LLM_MAX_RETRIES = 3;
const LLM_BASE_DELAY_MS = 1000;
const LLM_MAX_DELAY_MS = 10000;

function calculateBackoff(attempt: number): number {
  const delay = LLM_BASE_DELAY_MS * Math.pow(2, attempt);
  const jitter = Math.random() * 500;
  return Math.min(delay + jitter, LLM_MAX_DELAY_MS);
}

async function callLLM(
  messages: OpenRouterMessage[],
  systemPrompt: string,
  onChunk?: (chunk: string) => void
): Promise<OpenRouterResponse> {
  const providers: Array<{
    name: InferenceProvider;
    fn: (
      m: OpenRouterMessage[],
      s: string,
      c?: (chunk: string) => void
    ) => Promise<OpenRouterResponse>;
    hasKey: boolean;
    supportsStreaming: boolean;
  }> = [
    {
      name: "anthropic",
      fn: callAnthropic,
      hasKey: !!ANTHROPIC_API_KEY,
      supportsStreaming: true,
    },
    {
      name: "cerebras",
      fn: callCerebras,
      hasKey: !!CEREBRAS_API_KEY,
      supportsStreaming: false,
    },
    {
      name: "gemini",
      fn: callGemini,
      hasKey: !!GEMINI_API_KEY,
      supportsStreaming: false,
    },
    {
      name: "grok",
      fn: callGrok,
      hasKey: !!XAI_API_KEY,
      supportsStreaming: false,
    },
  ];

  const currentIdx = providers.findIndex(p => p.name === currentProvider);
  if (currentIdx > 0) {
    const [current] = providers.splice(currentIdx, 1);
    providers.unshift(current);
  }

  const errors: string[] = [];

  for (const provider of providers) {
    if (!provider.hasKey) continue;

    for (let attempt = 0; attempt < LLM_MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          const backoff = calculateBackoff(attempt);
          console.info(
            `[JARVIS] Retry ${attempt}/${LLM_MAX_RETRIES} for ${provider.name} after ${backoff}ms`
          );
          await new Promise(resolve => setTimeout(resolve, backoff));
        }

        console.info(
          `[JARVIS] Calling ${provider.name} API (attempt ${attempt + 1})...`
        );
        const streamCallback =
          onChunk && provider.supportsStreaming ? onChunk : undefined;
        const result = await provider.fn(
          messages,
          systemPrompt,
          streamCallback
        );
        console.info(`[JARVIS] ${provider.name} call successful`);
        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`${provider.name}[${attempt + 1}]: ${errorMsg}`);

        const isRateLimit =
          errorMsg.includes("rate") ||
          errorMsg.includes("429") ||
          errorMsg.includes("quota");
        const isTransient =
          errorMsg.includes("timeout") ||
          errorMsg.includes("ECONNRESET") ||
          errorMsg.includes("502") ||
          errorMsg.includes("503");

        if (!isRateLimit && !isTransient && attempt < LLM_MAX_RETRIES - 1) {
          console.error(
            `[JARVIS] ${provider.name} permanent error, skipping retries:`,
            errorMsg
          );
          break;
        }

        console.error(
          `[JARVIS] ${provider.name} attempt ${attempt + 1} failed:`,
          errorMsg
        );
      }
    }
  }

  throw new Error(
    `All LLM providers failed after retries. Errors: ${errors.slice(-5).join("; ")}`
  );
}

export interface OrchestratorOptions {
  maxIterations?: number;
  memoryContext?: string;
  procedureGuidance?: string;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  userId?: number;
  taskId?: number;
  sessionId?: string;
  enableMemoryInjection?: boolean;
  useSwarmMode?: boolean;
}

export async function runOrchestrator(
  task: string,
  callbacks: OrchestratorCallbacks,
  executeToolFn: (
    name: string,
    input: Record<string, unknown>
  ) => Promise<string>,
  options: OrchestratorOptions = {}
): Promise<void> {
  const {
    maxIterations = MAX_ITERATIONS,
    memoryContext = "",
    procedureGuidance = "",
    conversationHistory = [],
    useSwarmMode = SWARM_MODE_ENABLED,
  } = options;
  const messages: OpenRouterMessage[] = [];

  const eventLogger = getEventLogger();
  const taskId = options.taskId || Date.now();
  const userId = options.userId || 0;
  const sessionId = options.sessionId || `session-${Date.now()}`;

  try {
    await connectRedis();
  } catch (err) {
    console.warn(
      "[JARVIS] Redis connection failed, continuing without event bus:",
      err
    );
  }

  await eventLogger.logTaskStart(taskId, task, { userId, sessionId });

  if (useSwarmMode) {
    try {
      callbacks.onThinking?.(
        "Using swarm mode with frontier APIs for multi-agent coordination..."
      );

      const swarm = getGlobalSwarmOrchestrator();
      const analysis = await swarm.analyzeAndPlan(task);

      callbacks.onThinking?.(
        `Task analysis: ${analysis.primaryAgent} agent (${analysis.estimatedComplexity}), ` +
          `multi-agent: ${analysis.requiresMultiAgent}`
      );

      const v3Context: V3ExecutionContext = {
        sessionId,
        userId,
        taskId: typeof taskId === "number" ? taskId : Date.now(),
        params: {},
        startTime: Date.now(),
        leaseManager: {
          acquire: async () => true,
          release: async () => {},
          isHeld: async () => false,
          extend: async () => true,
        },
        qdrant: {
          search: async () => [],
          upsert: async () => {},
          delete: async () => {},
        },
        redis: {
          xadd: async () => "0-0",
          xread: async () => [],
          get: async () => null,
          set: async () => {},
          publish: async () => 0,
        },
      };

      const executor = createFrontierExecutor(executeToolFn, {
        enableConsensus: true,
        swarmOrchestrator: swarm,
        onToolCall: tc =>
          callbacks.onToolCall({ id: tc.id, name: tc.name, input: tc.input }),
        onToolResult: tr =>
          callbacks.onToolResult({
            toolCallId: tr.toolCallId,
            output: tr.output,
            isError: tr.isError,
          }),
        onThinking: thought => callbacks.onThinking?.(thought),
        onThinkingChunk: chunk => callbacks.onThinkingChunk?.(chunk),
      });
      const result = await swarm.executeSwarmTask(task, v3Context, executor);

      if (result.success) {
        callbacks.onComplete?.(result.output, [
          {
            type: "swarm_result",
            agentsUsed: result.agentsUsed,
            tasksCompleted: result.tasksCompleted,
            tasksFailed: result.tasksFailed,
            durationMs: result.totalDurationMs,
            learningsExtracted: result.learningsExtracted,
          },
        ]);
      } else {
        callbacks.onError?.(result.output);
      }

      await eventLogger.logTaskEnd(
        typeof taskId === "number" ? taskId : Date.now(),
        {
          success: result.success,
          summary: `Swarm: ${result.agentsUsed.join(", ")} (${result.totalDurationMs}ms)`,
        },
        { userId, sessionId }
      );

      return;
    } catch (swarmError) {
      console.warn(
        "[JARVIS] Swarm mode failed, falling back to standard orchestrator:",
        swarmError
      );
      callbacks.onThinking?.(
        "Swarm mode encountered an error, falling back to standard mode..."
      );
    }
  }

  for (const msg of conversationHistory) {
    messages.push({ role: msg.role, content: msg.content });
  }

  const complexity = assessComplexity(task);
  const executionPlan = createExecutionPlan(task);
  const planPrompt = formatPlanForPrompt(executionPlan);

  const routingDecision = routeTask(task);
  callbacks.onThinking?.(formatRoutingReport(routingDecision));

  // Route to appropriate provider based on model selection
  // Complex tasks need smarter models, not fast Cerebras
  const selectedModel = routingDecision.selectedModel.toLowerCase();
  if (
    selectedModel.includes("claude") ||
    selectedModel.includes("opus") ||
    selectedModel.includes("sonnet")
  ) {
    setInferenceProvider("anthropic");
  } else if (selectedModel.includes("gemini")) {
    setInferenceProvider("gemini");
  } else if (selectedModel.includes("grok")) {
    setInferenceProvider("grok");
  } else if (
    selectedModel.includes("cerebras") ||
    selectedModel.includes("llama") ||
    selectedModel.includes("qwen")
  ) {
    setInferenceProvider("cerebras");
  } else {
    setInferenceProvider("anthropic");
  }

  // Override: Complex tasks ALWAYS use Anthropic for quality
  if (complexity === "complex") {
    setInferenceProvider("anthropic");
    console.info(
      `[JARVIS] Complex task detected - forcing Anthropic for quality`
    );
  }

  console.info(
    `[JARVIS] Routed to ${currentProvider} based on selected model: ${routingDecision.selectedModel}`
  );

  let taskWithContext = task;
  if (procedureGuidance) {
    taskWithContext += `\n\n${procedureGuidance}`;
  }
  if (planPrompt && complexity !== "simple") {
    taskWithContext += `\n\n${planPrompt}`;
    callbacks.onThinking?.(
      `Task complexity: ${complexity}. Created ${executionPlan.phases.length}-phase execution plan.`
    );
  }

  if (options.userId) {
    const optimizedContext = await getOptimizedPromptContext(
      options.userId,
      task
    );
    if (optimizedContext) {
      taskWithContext += optimizedContext;
    }
  }

  messages.push({ role: "user", content: taskWithContext });

  let iterations = 0;
  let isComplete = false;

  const systemPrompt = getJarvisSystemPrompt() + memoryContext;

  const memoryClient = userId ? await getGlobalMemoryClient(userId) : undefined;

  const executionContext: ToolExecutionContext = {
    failedTools: new Map(),
    lastToolOutputs: new Map(),
    attemptedCalls: new Map(),
    tokenEstimate: 0,
    tokenBudget: 500000,
    consecutiveFailures: 0,
    lastFailureTime: 0,
    approachPivots: 0,
    failedApproaches: [],
    progressTracker: createProgressTracker(),
    evolutionTracker: {
      toolsUsed: new Set(),
      toolsFailed: new Set(),
      startTime: Date.now(),
    },
    strategyState: createInitialState(),
    signatureFailures: new Map(),
    qaRetryCount: 0,
    wasEscalated: false,
    memoryClient,
    offloadedOutputs: new Map(),
  };

  while (!isComplete && iterations < maxIterations) {
    const iterationStartTime = Date.now();

    const taskDurationMs =
      Date.now() - executionContext.evolutionTracker.startTime;
    if (taskDurationMs >= MAX_TASK_DURATION_MS) {
      executionContext.progressTracker.stage = "error";
      const durationMin = Math.round(taskDurationMs / 60000);
      callbacks.onProgress?.(
        buildProgress(
          executionContext.progressTracker,
          executionContext,
          iterations,
          maxIterations,
          "Task duration limit exceeded"
        )
      );
      callbacks.onThinking?.(
        `\n🛑 Task duration limit exceeded (${durationMin} minutes). Force completing to prevent runaway tasks.`
      );

      const partialResults = executionContext.progressTracker.partialResults;
      const finalSummary = `Task was automatically stopped after ${durationMin} minutes. ${partialResults.length > 0 ? `Partial progress: ${partialResults.slice(-3).join("; ")}` : "The task may be incomplete."}`;
      callbacks.onComplete(finalSummary);

      await eventLogger.logTaskEnd(
        taskId,
        {
          success: false,
          summary: finalSummary,
          error: "duration_limit_exceeded",
        },
        { userId, sessionId }
      );
      return;
    }

    if (executionContext.tokenEstimate >= executionContext.tokenBudget) {
      executionContext.progressTracker.stage = "error";
      callbacks.onProgress?.(
        buildProgress(
          executionContext.progressTracker,
          executionContext,
          iterations,
          maxIterations,
          "Token budget exceeded"
        )
      );
      callbacks.onThinking?.(
        `\n🛑 Token budget exceeded (~${Math.round(executionContext.tokenEstimate / 1000)}k tokens). Stopping to prevent runaway costs.`
      );
      break;
    }

    iterations++;

    if (callbacks.onIteration) {
      callbacks.onIteration(iterations, maxIterations);
    }

    const remainingIterations = maxIterations - iterations;
    if (remainingIterations <= 3 && remainingIterations > 0) {
      const urgencyMessage = `⚠️ ITERATION BUDGET WARNING: Only ${remainingIterations} iteration(s) remaining!
You MUST call task_complete NOW with a summary of what you've accomplished.
If the task is incomplete, summarize what was done and what remains.
Do NOT continue working - call task_complete immediately.`;

      const lastMessage = messages[messages.length - 1];
      const lastContent =
        typeof lastMessage?.content === "string" ? lastMessage.content : "";
      const alreadyUrgent = lastContent.includes("ITERATION BUDGET WARNING");

      if (lastMessage?.role !== "user" || !alreadyUrgent) {
        messages.push({ role: "user", content: urgencyMessage });
        callbacks.onThinking?.(
          `\n⏰ Approaching iteration limit (${iterations}/${maxIterations}). Urging task completion...`
        );
      }
    }

    executionContext.progressTracker.stage =
      iterations === 1 ? "planning" : "executing";
    callbacks.onProgress?.(
      buildProgress(
        executionContext.progressTracker,
        executionContext,
        iterations,
        maxIterations,
        iterations === 1 ? "Analyzing task..." : "Processing..."
      )
    );

    try {
      const trimmedMessages = await trimMessagesToFitContextWithRAG(
        messages,
        systemPrompt,
        task,
        executionContext.memoryClient
      );
      if (trimmedMessages.length < messages.length) {
        messages.length = 0;
        messages.push(...trimmedMessages);
      }

      const response = await callLLM(
        messages,
        systemPrompt,
        callbacks.onThinkingChunk
      );

      const choice = response.choices[0];
      if (!choice) {
        throw new Error("No response from model");
      }

      const assistantMessage = choice.message;

      const promptTokens = estimateTokens(
        messages
          .map(m => (typeof m.content === "string" ? m.content : ""))
          .join("")
      );
      const responseTokens = estimateTokens(assistantMessage.content || "");
      executionContext.tokenEstimate += promptTokens + responseTokens;

      if (executionContext.tokenEstimate > executionContext.tokenBudget * 0.9) {
        callbacks.onThinking?.(
          `\n⚠️ Token budget warning: ~${Math.round(executionContext.tokenEstimate / 1000)}k tokens used (90% of budget)`
        );
      }
      const toolCalls: ToolCall[] = [];

      if (assistantMessage.content && !callbacks.onThinkingChunk) {
        callbacks.onThinking(assistantMessage.content);
      }

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

      messages.push({
        role: "assistant",
        content: assistantMessage.content || "",
        tool_calls: assistantMessage.tool_calls,
      });

      if (toolCalls.length > 0) {
        const taskCompleteCall = toolCalls.find(
          tc => tc.name === "task_complete"
        );
        if (taskCompleteCall) {
          // Validate file deliverables before accepting completion
          const fileKeywords =
            /\b(file|md|markdown|document|report|save|write|create.*file|output.*file|kick.*out|give.*me)\b/i;
          const taskRequestsFiles = fileKeywords.test(task);
          const fileWriteTools = [
            "write_file",
            "write_docx",
            "write_pptx",
            "write_xlsx",
            "create_rich_report",
          ];
          const usedFileWrite = fileWriteTools.some(tool =>
            executionContext.evolutionTracker.toolsUsed.has(tool)
          );

          // Check for scaffold/portal tasks that require the scaffold tool
          const scaffoldKeywords =
            /\b(scaffold|portal|bilateral.*trade|trade.*portal|business.*portal)\b/i;
          const taskRequestsScaffold = scaffoldKeywords.test(task);
          const scaffoldTools = [
            "scaffold_business_portal",
            "scaffold_project",
            "build_bilateral_portal_swarm",
          ];
          const usedScaffoldTool = scaffoldTools.some(tool =>
            executionContext.evolutionTracker.toolsUsed.has(tool)
          );

          if (taskRequestsScaffold && !usedScaffoldTool) {
            const rejectMessage = `⚠️ TASK COMPLETION REJECTED: You were asked to scaffold/create a portal but never called scaffold_business_portal or scaffold_project.
You CANNOT simulate or fake the scaffold tool's output - it creates real files on disk.
You MUST call the actual scaffold tool. Please do so now.`;

            callbacks.onThinking?.(rejectMessage);

            messages.push({
              role: "tool",
              content: rejectMessage,
              tool_call_id: taskCompleteCall.id,
            });

            continue;
          }

          if (taskRequestsFiles && !usedFileWrite) {
            // Reject premature completion - files were requested but not written
            const rejectMessage = `⚠️ TASK COMPLETION REJECTED: You were asked to create file output but never called write_file or create_rich_report.
Creating content in execute_python does NOT save files! You must either:
- Use create_rich_report for reports with charts/visuals (preferred)
- Use write_file with a path like /tmp/jarvis-workspace/filename.md

Please save the content now.`;

            callbacks.onThinking?.(rejectMessage);

            messages.push({
              role: "tool",
              content: rejectMessage,
              tool_call_id: taskCompleteCall.id,
            });

            continue;
          }

          const taskCompleteInput = taskCompleteCall.input as {
            summary: string;
            artifacts?: unknown[];
          };

          const filesWritten: FileInfo[] = [];
          const toolOutputEntries = Array.from(
            executionContext.lastToolOutputs.entries()
          );
          for (const [toolName, output] of toolOutputEntries) {
            if (toolName === "write_file" && typeof output === "string") {
              const pathMatch = output.match(
                /(?:wrote|created|saved).*?([\/\w.-]+\.\w+)/i
              );
              if (pathMatch) {
                filesWritten.push({
                  path: pathMatch[1],
                  size: output.length,
                  type: pathMatch[1].split(".").pop() || "unknown",
                });
              }
            }
            if (
              toolName === "create_rich_report" &&
              typeof output === "string"
            ) {
              const pathMatch = output.match(/Path:\s*([^\n]+\.html)/i);
              if (pathMatch) {
                const filePath = pathMatch[1].trim();
                let fileSize = 0;
                try {
                  const stats = await fs.stat(filePath);
                  fileSize = stats.size;
                } catch {
                  // File stat failed, use output length as estimate
                  fileSize = output.length;
                }
                filesWritten.push({
                  path: filePath,
                  size: fileSize,
                  type: "html",
                });
              }
            }
          }

          const qaContext: TaskContext = {
            task,
            complexity,
            iterations,
            toolsUsed: Array.from(executionContext.evolutionTracker.toolsUsed),
            filesWritten,
            summary: taskCompleteInput.summary,
            userId: options.userId,
          };

          const qualityCheck = await validateTaskQuality(qaContext);

          if (!qualityCheck.passed && iterations < maxIterations - 1) {
            executionContext.qaRetryCount++;

            const escalationStrategy = determineEscalationStrategy(
              qualityCheck,
              qaContext,
              executionContext.qaRetryCount
            );

            if (
              escalationStrategy.escalateModel &&
              !executionContext.wasEscalated
            ) {
              setInferenceProvider("anthropic");
              executionContext.wasEscalated = true;
              console.info(
                `[QA] ESCALATING to Anthropic after ${executionContext.qaRetryCount} QA failures`
              );
              callbacks.onThinking?.(
                `\n⚡ Escalating to enhanced model for quality improvement...`
              );
            }

            const qaRejectMessage = generateQualityImprovementPrompt(
              qualityCheck,
              escalationStrategy
            );
            callbacks.onThinking?.(`\n${qaRejectMessage}`);
            console.info(
              `[QA] Task completion REJECTED (attempt ${executionContext.qaRetryCount}): ` +
                `score=${qualityCheck.score}, issues=${qualityCheck.issues.length}, ` +
                `escalated=${executionContext.wasEscalated}`
            );

            messages.push({
              role: "tool",
              content: qaRejectMessage,
              tool_call_id: taskCompleteCall.id,
            });

            continue;
          }

          if (qualityCheck.score < 100) {
            callbacks.onThinking?.(
              `\n📊 Quality Score: ${qualityCheck.score}/100 ` +
                `(${qualityCheck.issues.filter(i => i.severity === "warning").length} warnings)`
            );
          }

          executionContext.progressTracker.stage = "complete";
          const result: ToolResult = {
            toolCallId: taskCompleteCall.id,
            output: taskCompleteInput.summary,
            isError: false,
          };
          callbacks.onToolResult(result);
          callbacks.onProgress?.(
            buildProgress(
              executionContext.progressTracker,
              executionContext,
              iterations,
              maxIterations,
              "Task completed"
            )
          );

          const taskDuration =
            Date.now() - executionContext.evolutionTracker.startTime;

          const taskOutcome: TaskOutcome = {
            success: true,
            query: task,
            toolsUsed: Array.from(executionContext.evolutionTracker.toolsUsed),
            toolsFailed: Array.from(
              executionContext.evolutionTracker.toolsFailed
            ),
            iterationsUsed: iterations,
            tokensUsed: executionContext.tokenEstimate,
            durationMs: taskDuration,
          };
          postTaskEvolution(taskOutcome, options.userId).catch(() => {});

          if (options.userId) {
            const perfComparison = await recordTaskPerformance(
              options.userId,
              task,
              taskDuration,
              true,
              iterations
            );
            if (perfComparison.previousDuration) {
              callbacks.onThinking?.(
                `\n📊 ${formatPerformanceReport(perfComparison)}`
              );
            }
          }

          recordModelPerformance(
            routingDecision.selectedModel,
            routingDecision.taskClassification.type,
            true,
            taskDuration,
            executionContext.tokenEstimate
          );

          callbacks.onComplete(
            taskCompleteInput.summary,
            taskCompleteInput.artifacts
          );
          isComplete = true;

          await eventLogger.logTaskEnd(
            taskId,
            { success: true, summary: taskCompleteInput.summary },
            { userId, sessionId }
          );
        } else {
          executionContext.progressTracker.toolsCompletedThisIteration = 0;
          executionContext.progressTracker.toolsTotalThisIteration =
            toolCalls.length;

          callbacks.onProgress?.(
            buildProgress(
              executionContext.progressTracker,
              executionContext,
              iterations,
              maxIterations,
              `Executing ${toolCalls.length} tool${toolCalls.length > 1 ? "s" : ""}...`
            )
          );

          const toolResults = await executeToolsInParallel(
            toolCalls,
            executeToolFn,
            executionContext,
            callbacks
          );

          const errors: string[] = [];
          let hasSuccess = false;

          for (const { tc, output, isError } of toolResults) {
            executionContext.progressTracker.toolsCompletedThisIteration++;

            const processedOutput = isError
              ? output
              : await offloadLargeToolOutput(
                  tc.name,
                  tc.id,
                  output,
                  executionContext,
                  task
                );

            const result: ToolResult = {
              toolCallId: tc.id,
              output: processedOutput,
              isError,
            };
            callbacks.onToolResult(result);

            messages.push({
              role: "tool",
              content: processedOutput,
              tool_call_id: tc.id,
            });

            executionContext.evolutionTracker.toolsUsed.add(tc.name);
            if (isError) {
              errors.push(output.slice(0, 100));
              executionContext.evolutionTracker.toolsFailed.add(tc.name);
              executionContext.evolutionTracker.lastError = output.slice(
                0,
                500
              );
            } else {
              hasSuccess = true;
              if (output.length > 50 && output.length < 500) {
                executionContext.progressTracker.partialResults.push(
                  `${tc.name}: ${output.slice(0, 200)}${output.length > 200 ? "..." : ""}`
                );
              }
            }

            callbacks.onProgress?.(
              buildProgress(
                executionContext.progressTracker,
                executionContext,
                iterations,
                maxIterations,
                `Completed ${tc.name}`
              )
            );
          }

          if (hasSuccess) {
            executionContext.consecutiveFailures = 0;
          } else {
            executionContext.consecutiveFailures++;
            executionContext.lastFailureTime = Date.now();

            if (executionContext.consecutiveFailures >= 3) {
              executionContext.progressTracker.stage = "recovering";
              const failedApproach = summarizeFailedApproach(toolCalls, errors);
              executionContext.failedApproaches.push(failedApproach);
              executionContext.approachPivots++;
              executionContext.attemptedCalls.clear();

              const backoffMs = calculateBackoffDelay(
                executionContext.consecutiveFailures
              );

              callbacks.onProgress?.(
                buildProgress(
                  executionContext.progressTracker,
                  executionContext,
                  iterations,
                  maxIterations,
                  `Recovering from failures, pivoting approach...`
                )
              );

              callbacks.onThinking?.(
                `\n⚠️ ${executionContext.consecutiveFailures} consecutive failures. ` +
                  `Pivoting approach (attempt #${executionContext.approachPivots}). ` +
                  `Waiting ${backoffMs}ms before retry...`
              );

              await new Promise(resolve => setTimeout(resolve, backoffMs));

              const pivotGuidance = `
IMPORTANT: Your last ${executionContext.consecutiveFailures} attempts have failed. 
Failed approaches so far:
${executionContext.failedApproaches.map((a, i) => `${i + 1}. ${a}`).join("\n")}

You MUST try a DIFFERENT approach. Consider:
- Using alternative tools
- Breaking the task into smaller steps
- Verifying prerequisites before proceeding
- Asking clarifying questions if the task is unclear

Do NOT repeat the same tool calls with the same inputs.`;

              messages.push({
                role: "user",
                content: pivotGuidance,
              });

              executionContext.consecutiveFailures = 0;
            }
          }

          const iterationDuration = Date.now() - iterationStartTime;
          executionContext.progressTracker.iterationDurations.push(
            iterationDuration
          );
        }
      } else if (choice.finish_reason === "stop") {
        executionContext.progressTracker.stage = "complete";
        callbacks.onProgress?.(
          buildProgress(
            executionContext.progressTracker,
            executionContext,
            iterations,
            maxIterations,
            "Task completed"
          )
        );
        callbacks.onComplete(assistantMessage.content || "Task completed.", []);
        isComplete = true;

        await eventLogger.logTaskEnd(
          taskId,
          {
            success: true,
            summary: assistantMessage.content || "Task completed",
          },
          { userId, sessionId }
        );
      }
    } catch (error) {
      executionContext.progressTracker.stage = "error";
      callbacks.onProgress?.(
        buildProgress(
          executionContext.progressTracker,
          executionContext,
          iterations,
          maxIterations,
          "Error occurred"
        )
      );
      const errorMsg = error instanceof Error ? error.message : String(error);

      const taskOutcome: TaskOutcome = {
        success: false,
        query: task,
        error: errorMsg,
        toolsUsed: Array.from(executionContext.evolutionTracker.toolsUsed),
        toolsFailed: Array.from(executionContext.evolutionTracker.toolsFailed),
        iterationsUsed: iterations,
        tokensUsed: executionContext.tokenEstimate,
        durationMs: Date.now() - executionContext.evolutionTracker.startTime,
      };
      postTaskEvolution(taskOutcome, options.userId).catch(() => {});

      recordModelPerformance(
        routingDecision.selectedModel,
        routingDecision.taskClassification.type,
        false,
        Date.now() - executionContext.evolutionTracker.startTime,
        executionContext.tokenEstimate
      );

      callbacks.onError(`Orchestrator error: ${errorMsg}`);

      await eventLogger.logTaskEnd(
        taskId,
        { success: false, error: errorMsg },
        { userId, sessionId }
      );

      throw error;
    }
  }

  if (!isComplete) {
    const toolsUsed = executionContext.evolutionTracker.toolsUsed;
    const toolsFailed = executionContext.evolutionTracker.toolsFailed;
    const hasSubstantialWork = toolsUsed.size >= 2;
    const hasPositiveOutputs = executionContext.lastToolOutputs.size >= 1;

    if (hasSubstantialWork && hasPositiveOutputs) {
      executionContext.progressTracker.stage = "complete";

      const lastOutputs = Array.from(
        executionContext.lastToolOutputs.entries()
      ).slice(-5);
      const outputSummary = lastOutputs
        .map(([tool, output]) => {
          const truncated =
            output.length > 200 ? output.slice(0, 200) + "..." : output;
          return `- ${tool}: ${truncated}`;
        })
        .join("\n");

      const autoSummary = `Task completed (auto-finalized at iteration limit).
Tools used: ${Array.from(toolsUsed).join(", ")}

Recent outputs:
${outputSummary}`;

      callbacks.onProgress?.(
        buildProgress(
          executionContext.progressTracker,
          executionContext,
          iterations,
          maxIterations,
          "Auto-completed at iteration limit"
        )
      );

      const taskOutcome: TaskOutcome = {
        success: true,
        query: task,
        toolsUsed: Array.from(toolsUsed),
        toolsFailed: Array.from(toolsFailed),
        iterationsUsed: iterations,
        tokensUsed: executionContext.tokenEstimate,
        durationMs: Date.now() - executionContext.evolutionTracker.startTime,
      };
      postTaskEvolution(taskOutcome, options.userId).catch(() => {});

      recordModelPerformance(
        routingDecision.selectedModel,
        routingDecision.taskClassification.type,
        true,
        Date.now() - executionContext.evolutionTracker.startTime,
        executionContext.tokenEstimate
      );

      callbacks.onComplete(autoSummary, []);

      await eventLogger.logTaskEnd(
        taskId,
        { success: true, summary: "Auto-completed at iteration limit" },
        { userId, sessionId }
      );
    } else {
      executionContext.progressTracker.stage = "error";
      callbacks.onProgress?.(
        buildProgress(
          executionContext.progressTracker,
          executionContext,
          iterations,
          maxIterations,
          "Max iterations exceeded"
        )
      );

      const taskOutcome: TaskOutcome = {
        success: false,
        query: task,
        error: "Max iterations exceeded",
        toolsUsed: Array.from(toolsUsed),
        toolsFailed: Array.from(toolsFailed),
        iterationsUsed: iterations,
        tokensUsed: executionContext.tokenEstimate,
        durationMs: Date.now() - executionContext.evolutionTracker.startTime,
      };
      postTaskEvolution(taskOutcome, options.userId).catch(() => {});

      callbacks.onError(
        "Task exceeded maximum iterations. Please try breaking it into smaller steps."
      );

      await eventLogger.logTaskEnd(
        taskId,
        { success: false, error: "Max iterations exceeded" },
        { userId, sessionId }
      );
    }
  }
}
