import type { ClassifiedError, ErrorClass } from "./errorClassification";
import {
  getFailureContext,
  hasRecentFailure,
  getFailureCount,
} from "./failureMemory";

export interface FallbackDecisionContext {
  userId: number;
  taskId: number;
  toolName: string;
  classified: ClassifiedError;
  failedTools: Map<string, number>;
  recentlyTried: Set<string>;
}

export interface FallbackPlan {
  shouldRetry: boolean;
  retryAfterMs?: number;
  nextTools: string[];
  systemNote?: string;
  skipTool: boolean;
}

const TOOL_ALTERNATIVES: Record<string, string[]> = {
  web_search: ["searxng_search", "browse_url", "http_request"],
  searxng_search: ["web_search", "browse_url", "http_request"],
  browse_url: ["http_request", "web_search"],
  http_request: ["browse_url", "web_search"],
  execute_python: ["execute_node", "execute_shell"],
  execute_node: ["execute_python", "execute_shell"],
  execute_shell: ["execute_python", "execute_node"],
  generate_image: ["write_file"],
  read_file: ["list_files", "execute_shell"],
  write_file: ["execute_shell"],
};

const ERROR_CLASS_POLICIES: Record<
  ErrorClass,
  {
    shouldRetry: boolean;
    maxRetries: number;
    baseDelayMs: number;
    fallbackStrategy: "switch_tool" | "switch_provider" | "skip" | "abort";
  }
> = {
  timeout: {
    shouldRetry: true,
    maxRetries: 2,
    baseDelayMs: 2000,
    fallbackStrategy: "switch_tool",
  },
  rate_limit: {
    shouldRetry: true,
    maxRetries: 3,
    baseDelayMs: 5000,
    fallbackStrategy: "switch_provider",
  },
  network_error: {
    shouldRetry: true,
    maxRetries: 2,
    baseDelayMs: 3000,
    fallbackStrategy: "switch_tool",
  },
  auth_error: {
    shouldRetry: false,
    maxRetries: 0,
    baseDelayMs: 0,
    fallbackStrategy: "abort",
  },
  not_found: {
    shouldRetry: false,
    maxRetries: 0,
    baseDelayMs: 0,
    fallbackStrategy: "switch_tool",
  },
  validation_error: {
    shouldRetry: false,
    maxRetries: 0,
    baseDelayMs: 0,
    fallbackStrategy: "skip",
  },
  code_error: {
    shouldRetry: false,
    maxRetries: 0,
    baseDelayMs: 0,
    fallbackStrategy: "skip",
  },
  unknown: {
    shouldRetry: true,
    maxRetries: 1,
    baseDelayMs: 1000,
    fallbackStrategy: "switch_tool",
  },
};

export async function decideFallback(
  ctx: FallbackDecisionContext
): Promise<FallbackPlan> {
  const policy = ERROR_CLASS_POLICIES[ctx.classified.class];
  const failureContext = await getFailureContext(
    ctx.userId,
    ctx.taskId,
    ctx.toolName
  );

  const attemptCount = ctx.failedTools.get(ctx.toolName) || 0;
  const shouldRetry = policy.shouldRetry && attemptCount < policy.maxRetries;

  if (shouldRetry) {
    const delay = policy.baseDelayMs * Math.pow(2, attemptCount);
    return {
      shouldRetry: true,
      retryAfterMs: ctx.classified.retryAfterMs || delay,
      nextTools: [],
      skipTool: false,
    };
  }

  const alternatives = TOOL_ALTERNATIVES[ctx.toolName] || [];
  const availableAlternatives = alternatives.filter(tool => {
    if (ctx.recentlyTried.has(tool)) return false;
    if (failureContext.toolsToAvoid.includes(tool)) return false;
    if (hasRecentFailure(ctx.userId, tool, 60000)) return false;
    return true;
  });

  if (failureContext.suggestedAlternatives.length > 0) {
    for (const suggested of failureContext.suggestedAlternatives) {
      if (
        !availableAlternatives.includes(suggested) &&
        !ctx.recentlyTried.has(suggested)
      ) {
        availableAlternatives.unshift(suggested);
      }
    }
  }

  const systemNote = buildSystemNote(
    ctx.classified,
    failureContext.matchingPatterns.length
  );

  if (policy.fallbackStrategy === "abort") {
    return {
      shouldRetry: false,
      nextTools: [],
      systemNote: `CRITICAL: ${ctx.classified.class} error - cannot proceed with ${ctx.toolName}. ${systemNote}`,
      skipTool: true,
    };
  }

  return {
    shouldRetry: false,
    nextTools: availableAlternatives.slice(0, 3),
    systemNote,
    skipTool: availableAlternatives.length === 0,
  };
}

function buildSystemNote(
  classified: ClassifiedError,
  patternCount: number
): string {
  const notes: string[] = [];

  if (patternCount > 0) {
    notes.push(
      `This failure pattern has occurred ${patternCount} time(s) before.`
    );
  }

  const classNotes: Record<ErrorClass, string> = {
    timeout: "Consider using a simpler or faster approach.",
    rate_limit: "Wait before retrying or use an alternative service.",
    network_error:
      "Network may be unstable. Consider cached or local alternatives.",
    auth_error: "Authentication failed. Check credentials before retrying.",
    not_found: "Resource does not exist. Verify the path or create it first.",
    validation_error: "Input was invalid. Fix the parameters before retrying.",
    code_error: "Code execution failed. Review and fix the code.",
    unknown: "An unexpected error occurred.",
  };

  notes.push(classNotes[classified.class]);

  return notes.join(" ");
}

export function rankToolsByReliability(
  tools: string[],
  userId: number,
  windowMs: number = 300000
): string[] {
  return [...tools].sort((a, b) => {
    const failuresA = getFailureCount(userId, a, windowMs);
    const failuresB = getFailureCount(userId, b, windowMs);
    return failuresA - failuresB;
  });
}

export function shouldAbortTask(
  userId: number,
  consecutiveFailures: number,
  lastError: ClassifiedError
): boolean {
  if (lastError.class === "auth_error") return true;
  if (consecutiveFailures >= 5) return true;
  if (getFailureCount(userId, lastError.toolName || "", 60000) >= 3)
    return true;
  return false;
}
