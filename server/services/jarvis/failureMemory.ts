import { getMemoryService } from "../memory";
import type { ClassifiedError, ErrorClass } from "./errorClassification";

export interface FailureRecord {
  taskId: number;
  toolName: string;
  errorClass: ErrorClass;
  signature: string;
  message: string;
  timestamp: Date;
  context?: Record<string, unknown>;
}

export interface FailurePattern {
  signature: string;
  toolName: string;
  errorClass: ErrorClass;
  occurrenceCount: number;
  lastOccurrence: Date;
  avoidTools: string[];
  preferredAlternatives: string[];
  mitigation?: string;
}

export interface FailureContext {
  recentFailures: FailureRecord[];
  matchingPatterns: FailurePattern[];
  toolsToAvoid: string[];
  suggestedAlternatives: string[];
}

const recentFailuresCache = new Map<number, FailureRecord[]>();
const patternCache = new Map<string, FailurePattern>();

export async function recordFailure(
  userId: number,
  taskId: number,
  classified: ClassifiedError,
  context?: Record<string, unknown>
): Promise<void> {
  const record: FailureRecord = {
    taskId,
    toolName: classified.toolName || "unknown",
    errorClass: classified.class,
    signature: classified.signature,
    message: classified.message,
    timestamp: new Date(),
    context,
  };

  const userFailures = recentFailuresCache.get(userId) || [];
  userFailures.push(record);
  if (userFailures.length > 100) {
    userFailures.shift();
  }
  recentFailuresCache.set(userId, userFailures);

  updatePatternFromFailure(classified);

  try {
    const memoryService = await getMemoryService();
    if (memoryService) {
      await memoryService.createEpisodicMemory({
        userId,
        taskId,
        memoryType: "task_failure",
        title: `Failure: ${classified.toolName} - ${classified.class}`,
        description: classified.message,
        outcome: "failed",
        tags: [
          `tool:${classified.toolName}`,
          `errorClass:${classified.class}`,
          `signature:${classified.signature}`,
        ],
        lessons: [buildLessonFromFailure(classified)],
        importance: 0.6,
      });
    }
  } catch (err) {
    console.error("[FailureMemory] Failed to store episodic memory:", err);
  }
}

function updatePatternFromFailure(classified: ClassifiedError): void {
  const existing = patternCache.get(classified.signature);

  if (existing) {
    existing.occurrenceCount++;
    existing.lastOccurrence = new Date();
  } else {
    patternCache.set(classified.signature, {
      signature: classified.signature,
      toolName: classified.toolName || "unknown",
      errorClass: classified.class,
      occurrenceCount: 1,
      lastOccurrence: new Date(),
      avoidTools: [classified.toolName || "unknown"],
      preferredAlternatives: getDefaultAlternatives(classified.toolName || ""),
      mitigation: getMitigationSuggestion(classified.class),
    });
  }
}

function buildLessonFromFailure(classified: ClassifiedError): string {
  const lessons: Record<ErrorClass, string> = {
    timeout: `Tool ${classified.toolName} timed out - consider using a faster alternative or increasing timeout`,
    rate_limit: `Hit rate limit on ${classified.toolName} - add delay or use alternative provider`,
    auth_error: `Authentication failed for ${classified.toolName} - check API key configuration`,
    not_found: `Resource not found when using ${classified.toolName} - verify inputs exist`,
    validation_error: `Invalid input for ${classified.toolName} - validate parameters before calling`,
    network_error: `Network issue with ${classified.toolName} - may need retry or offline alternative`,
    code_error: `Code execution error in ${classified.toolName} - review and fix the code`,
    unknown: `Unknown error in ${classified.toolName} - investigate further`,
  };
  return lessons[classified.class];
}

function getDefaultAlternatives(toolName: string): string[] {
  const alternatives: Record<string, string[]> = {
    web_search: ["searxng_search", "browse_url", "http_request"],
    searxng_search: ["web_search", "browse_url"],
    browse_url: ["http_request", "web_search"],
    execute_python: ["execute_node", "execute_shell"],
    execute_node: ["execute_python", "execute_shell"],
    http_request: ["browse_url", "web_search"],
    generate_image: ["write_file"],
  };
  return alternatives[toolName] || [];
}

function getMitigationSuggestion(errorClass: ErrorClass): string {
  const mitigations: Record<ErrorClass, string> = {
    timeout: "Increase timeout or use a simpler approach",
    rate_limit: "Wait before retrying or switch to alternative tool",
    auth_error: "Verify API credentials are correctly configured",
    not_found: "Check that the requested resource exists before accessing",
    validation_error: "Validate and sanitize inputs before tool call",
    network_error: "Check network connectivity or use cached/local data",
    code_error: "Review code for syntax and logic errors",
    unknown: "Investigate the specific error message",
  };
  return mitigations[errorClass];
}

export async function getFailureContext(
  userId: number,
  taskId: number,
  toolName?: string
): Promise<FailureContext> {
  const userFailures = recentFailuresCache.get(userId) || [];

  const recentFailures = userFailures
    .filter(f => {
      const isRecent = Date.now() - f.timestamp.getTime() < 3600000;
      const matchesTool = !toolName || f.toolName === toolName;
      return isRecent && matchesTool;
    })
    .slice(-10);

  const matchingPatterns: FailurePattern[] = [];
  const toolsToAvoid = new Set<string>();
  const suggestedAlternatives = new Set<string>();

  for (const failure of recentFailures) {
    const pattern = patternCache.get(failure.signature);
    if (pattern) {
      matchingPatterns.push(pattern);
      pattern.avoidTools.forEach(t => toolsToAvoid.add(t));
      pattern.preferredAlternatives.forEach(t => suggestedAlternatives.add(t));
    }
  }

  return {
    recentFailures,
    matchingPatterns,
    toolsToAvoid: Array.from(toolsToAvoid),
    suggestedAlternatives: Array.from(suggestedAlternatives),
  };
}

export function hasRecentFailure(
  userId: number,
  toolName: string,
  withinMs: number = 60000
): boolean {
  const userFailures = recentFailuresCache.get(userId) || [];
  const cutoff = Date.now() - withinMs;

  return userFailures.some(
    f => f.toolName === toolName && f.timestamp.getTime() > cutoff
  );
}

export function getFailureCount(
  userId: number,
  toolName: string,
  withinMs: number = 300000
): number {
  const userFailures = recentFailuresCache.get(userId) || [];
  const cutoff = Date.now() - withinMs;

  return userFailures.filter(
    f => f.toolName === toolName && f.timestamp.getTime() > cutoff
  ).length;
}

export function clearFailuresForTask(userId: number, taskId: number): void {
  const userFailures = recentFailuresCache.get(userId) || [];
  const filtered = userFailures.filter(f => f.taskId !== taskId);
  recentFailuresCache.set(userId, filtered);
}
