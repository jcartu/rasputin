/**
 * JARVIS Orchestrator - The Brain
 * Uses direct API connections (Anthropic, Cerebras, Gemini, Grok) for autonomous task execution
 */

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
} from "./performanceTracking";

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

For CURRENT DATA (prices, weather, news):
  1. http_request to a known API (preferred - more reliable)
     - Crypto: https://api.coinbase.com/v2/prices/BTC-USD/spot
     - Weather: https://wttr.in/CityName?format=j1
  2. web_search (fallback if no direct API)
  3. browse_url to a specific data page (last resort)

For SECURITY ANALYSIS (ALWAYS use specialized tools first!):
  1. npm_audit tool - REQUIRED for vulnerability scanning
  2. security_analysis tool - for comprehensive security report
  3. read_file package.json for manual review

For FILE CREATION:
  1. write_file for text/code files (.txt, .md, .py, .js, etc.)
  2. write_docx for Word documents (.docx) - USE THIS for reports/documents user will open in Word
  3. read_file to VERIFY content was created correctly
  4. For code: execute the file to test it works

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
  1. self_comprehensive_introspection - ALWAYS USE THIS FIRST
     - Returns status, capabilities, skills, and memory stats in ONE call
     - Much faster than calling multiple self_* tools separately
  2. Only use individual self_* tools if you need SPECIFIC deep details
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
VERIFICATION (before marking task complete):

For FILE tasks:
  - read_file to confirm content is correct
  - list_files to confirm file exists

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

NEVER mark complete without verification!
`;

function getJarvisSystemPrompt(): string {
  return `You are JARVIS, an autonomous AI agent assistant with advanced capabilities. Today's date is ${getCurrentDateString()}.

CORE CAPABILITIES:
- Web search and browsing (with automatic fallbacks)
- Code execution (Python, JavaScript, shell commands)
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

interface ToolExecutionContext {
  failedTools: Map<string, number>;
  lastToolOutputs: Map<string, string>;
  attemptedCalls: Set<string>;
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
  const errorPatterns = [
    /^Error:/i,
    /error:/i,
    /failed/i,
    /exception/i,
    /ENOENT/,
    /ECONNREFUSED/,
    /timeout/i,
    /not found/i,
    /permission denied/i,
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
        if (executionContext.attemptedCalls.has(callHash)) {
          return {
            tc,
            output: `[Skipped] Identical call to "${tc.name}" was already attempted this session.`,
            isError: true,
          };
        }
        executionContext.attemptedCalls.add(callHash);

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
  if (executionContext.attemptedCalls.has(callHash)) {
    return {
      tc,
      output: `[Skipped] Identical call to "${tc.name}" was already attempted this session. Try a different approach.`,
      isError: true,
    };
  }
  executionContext.attemptedCalls.add(callHash);

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
      model: "claude-opus-4-5-20251101",
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
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
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

// Main LLM call function with provider selection and fallback
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

  for (const provider of providers) {
    if (!provider.hasKey) continue;

    try {
      console.info(`[JARVIS] Calling ${provider.name} API...`);
      const streamCallback =
        onChunk && provider.supportsStreaming ? onChunk : undefined;
      console.info(
        `[JARVIS] Streaming enabled: ${!!streamCallback}, provider supports: ${provider.supportsStreaming}`
      );
      const result = await provider.fn(messages, systemPrompt, streamCallback);
      console.info(`[JARVIS] ${provider.name} call successful`);
      return result;
    } catch (error) {
      console.error(`[JARVIS] ${provider.name} failed:`, error);
    }
  }

  throw new Error("All LLM providers failed");
}

export interface OrchestratorOptions {
  maxIterations?: number;
  memoryContext?: string;
  procedureGuidance?: string;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  userId?: number;
  enableMemoryInjection?: boolean;
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
    maxIterations = 15,
    memoryContext = "",
    procedureGuidance = "",
    conversationHistory = [],
  } = options;
  const messages: OpenRouterMessage[] = [];

  for (const msg of conversationHistory) {
    messages.push({ role: msg.role, content: msg.content });
  }

  const complexity = assessComplexity(task);
  const executionPlan = createExecutionPlan(task);
  const planPrompt = formatPlanForPrompt(executionPlan);

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
    const perfGuidance = await getPerformanceGuidance(options.userId, task);
    if (perfGuidance) {
      taskWithContext += perfGuidance;
    }
  }

  messages.push({ role: "user", content: taskWithContext });

  let iterations = 0;
  let isComplete = false;

  const systemPrompt = getJarvisSystemPrompt() + memoryContext;

  const executionContext: ToolExecutionContext = {
    failedTools: new Map(),
    lastToolOutputs: new Map(),
    attemptedCalls: new Set(),
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
  };

  while (!isComplete && iterations < maxIterations) {
    const iterationStartTime = Date.now();

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
          executionContext.progressTracker.stage = "complete";
          const input = taskCompleteCall.input as {
            summary: string;
            artifacts?: unknown[];
          };
          const result: ToolResult = {
            toolCallId: taskCompleteCall.id,
            output: input.summary,
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

          callbacks.onComplete(input.summary, input.artifacts);
          isComplete = true;
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

            const result: ToolResult = {
              toolCallId: tc.id,
              output,
              isError,
            };
            callbacks.onToolResult(result);

            messages.push({
              role: "tool",
              content: output,
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

      callbacks.onError(`Orchestrator error: ${errorMsg}`);
      throw error;
    }
  }

  if (!isComplete) {
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
      toolsUsed: Array.from(executionContext.evolutionTracker.toolsUsed),
      toolsFailed: Array.from(executionContext.evolutionTracker.toolsFailed),
      iterationsUsed: iterations,
      tokensUsed: executionContext.tokenEstimate,
      durationMs: Date.now() - executionContext.evolutionTracker.startTime,
    };
    postTaskEvolution(taskOutcome, options.userId).catch(() => {});

    callbacks.onError(
      "Task exceeded maximum iterations. Please try breaking it into smaller steps."
    );
  }
}
