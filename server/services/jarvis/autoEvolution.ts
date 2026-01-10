import { getCapabilityRegistry } from "../selfEvolution/capabilityRegistry";
import { getDb } from "../../db";
import { learningEvents } from "../../../drizzle/schema";
import type { CapabilityGap } from "../selfEvolution/types";

export interface TaskOutcome {
  success: boolean;
  query: string;
  error?: string;
  toolsUsed: string[];
  toolsFailed: string[];
  iterationsUsed: number;
  tokensUsed: number;
  durationMs: number;
}

export interface FailurePattern {
  pattern: string;
  frequency: number;
  toolsInvolved: string[];
  commonErrors: string[];
  firstSeen: Date;
  lastSeen: Date;
}

export interface EvolutionSuggestion {
  type: "new_skill" | "improve_tool" | "add_fallback" | "documentation";
  priority: "high" | "medium" | "low" | "critical";
  description: string;
  rationale: string;
  estimatedImpact: string;
}

interface FailureRecord {
  query: string;
  error: string;
  toolsFailed: string[];
  timestamp: Date;
}

const recentFailures: FailureRecord[] = [];
const MAX_FAILURE_HISTORY = 100;
const PATTERN_THRESHOLD = 3;

export async function postTaskEvolution(
  outcome: TaskOutcome,
  userId?: number
): Promise<EvolutionSuggestion[]> {
  const suggestions: EvolutionSuggestion[] = [];

  if (!outcome.success) {
    recordFailure(outcome);

    const gap = await detectCapabilityGap(outcome);
    if (gap) {
      suggestions.push({
        type: "new_skill",
        priority: gap.priority,
        description: gap.description,
        rationale: `Task failed: ${outcome.error?.slice(0, 100) || "Unknown error"}`,
        estimatedImpact: "Would prevent similar failures",
      });
    }

    const registry = getCapabilityRegistry();
    for (const tool of outcome.toolsFailed) {
      const cap = registry.getByTool(tool);
      if (cap) {
        await registry.recordUsage(cap.id, false, outcome.query);
      }
    }
  } else {
    const registry = getCapabilityRegistry();
    for (const tool of outcome.toolsUsed) {
      const cap = registry.getByTool(tool);
      if (cap) {
        await registry.recordUsage(cap.id, true, outcome.query);
      }
    }
  }

  const patterns = detectFailurePatterns();
  for (const pattern of patterns) {
    if (pattern.frequency >= PATTERN_THRESHOLD) {
      suggestions.push(...suggestImprovementsForPattern(pattern));
    }
  }

  if (userId && suggestions.length > 0) {
    await recordEvolutionSuggestions(userId, suggestions);
  }

  return suggestions;
}

function recordFailure(outcome: TaskOutcome): void {
  recentFailures.push({
    query: outcome.query,
    error: outcome.error || "Unknown error",
    toolsFailed: outcome.toolsFailed,
    timestamp: new Date(),
  });

  if (recentFailures.length > MAX_FAILURE_HISTORY) {
    recentFailures.shift();
  }
}

async function detectCapabilityGap(
  outcome: TaskOutcome
): Promise<CapabilityGap | null> {
  const registry = getCapabilityRegistry();

  const errorLower = (outcome.error || "").toLowerCase();
  const queryLower = outcome.query.toLowerCase();

  if (
    errorLower.includes("modulenotfounderror") ||
    (errorLower.includes("module") && errorLower.includes("not found"))
  ) {
    const moduleMatch = outcome.error?.match(
      /no module named ['"]?([a-zA-Z0-9_-]+)['"]?/i
    );
    if (moduleMatch) {
      return registry.recordGap(
        `Missing Python/JS module: ${moduleMatch[1]}`,
        outcome.query,
        "medium"
      );
    }
  }

  if (
    errorLower.includes("api") &&
    (errorLower.includes("key") || errorLower.includes("auth"))
  ) {
    return registry.recordGap(
      "API authentication failure - missing or invalid credentials",
      outcome.query,
      "high"
    );
  }

  if (errorLower.includes("timeout") || errorLower.includes("timed out")) {
    return registry.recordGap(
      "Operation timeout - need more efficient approach or longer timeout",
      outcome.query,
      "medium"
    );
  }

  if (
    errorLower.includes("permission") ||
    errorLower.includes("access denied")
  ) {
    return registry.recordGap(
      "Permission/access issue - need elevated permissions or alternative approach",
      outcome.query,
      "medium"
    );
  }

  if (errorLower.includes("rate limit") || errorLower.includes("429")) {
    return registry.recordGap(
      "Rate limiting encountered - need throttling or alternative API",
      outcome.query,
      "medium"
    );
  }

  if (outcome.toolsFailed.length > 0) {
    const failedToolsStr = outcome.toolsFailed.join(", ");
    return registry.recordGap(
      `Tools failed: ${failedToolsStr} - need fallback strategies`,
      outcome.query,
      "medium"
    );
  }

  const existingCapability = registry.canDo(queryLower);
  if (!existingCapability.capable) {
    return registry.recordGap(
      `No capability matches task: ${outcome.query.slice(0, 100)}`,
      outcome.query,
      "low"
    );
  }

  return null;
}

function detectFailurePatterns(): FailurePattern[] {
  const patterns: Map<string, FailurePattern> = new Map();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const recentOnly = recentFailures.filter(f => f.timestamp > cutoff);

  const toolFailureCounts: Map<string, number> = new Map();
  for (const failure of recentOnly) {
    for (const tool of failure.toolsFailed) {
      toolFailureCounts.set(tool, (toolFailureCounts.get(tool) || 0) + 1);
    }
  }

  toolFailureCounts.forEach((count, tool) => {
    if (count >= PATTERN_THRESHOLD) {
      const toolFailures = recentOnly.filter(f => f.toolsFailed.includes(tool));

      const errorSet = new Set<string>();
      toolFailures.forEach(f => errorSet.add(f.error.slice(0, 50)));

      const patternKey = `tool_${tool}`;
      patterns.set(patternKey, {
        pattern: `Tool "${tool}" failing repeatedly`,
        frequency: count,
        toolsInvolved: [tool],
        commonErrors: Array.from(errorSet).slice(0, 5),
        firstSeen: toolFailures[0].timestamp,
        lastSeen: toolFailures[toolFailures.length - 1].timestamp,
      });
    }
  });

  const errorCategories: Map<string, FailureRecord[]> = new Map();
  for (const failure of recentOnly) {
    const category = categorizeError(failure.error);
    if (!errorCategories.has(category)) {
      errorCategories.set(category, []);
    }
    errorCategories.get(category)!.push(failure);
  }

  errorCategories.forEach((failures, category) => {
    if (failures.length >= PATTERN_THRESHOLD) {
      const patternKey = `error_${category}`;
      const allTools = failures.flatMap(f => f.toolsFailed);
      const uniqueToolsSet = new Set(allTools);

      const errorSet = new Set<string>();
      failures.forEach(f => errorSet.add(f.error.slice(0, 50)));

      patterns.set(patternKey, {
        pattern: `Repeated ${category} errors`,
        frequency: failures.length,
        toolsInvolved: Array.from(uniqueToolsSet),
        commonErrors: Array.from(errorSet).slice(0, 5),
        firstSeen: failures[0].timestamp,
        lastSeen: failures[failures.length - 1].timestamp,
      });
    }
  });

  return Array.from(patterns.values());
}

function categorizeError(error: string): string {
  const lower = error.toLowerCase();

  if (lower.includes("timeout") || lower.includes("timed out")) {
    return "timeout";
  }
  if (lower.includes("permission") || lower.includes("access denied")) {
    return "permission";
  }
  if (lower.includes("not found") || lower.includes("enoent")) {
    return "not_found";
  }
  if (lower.includes("rate limit") || lower.includes("429")) {
    return "rate_limit";
  }
  if (lower.includes("syntax") || lower.includes("parse")) {
    return "syntax";
  }
  if (lower.includes("network") || lower.includes("connection")) {
    return "network";
  }
  if (
    lower.includes("auth") ||
    lower.includes("401") ||
    lower.includes("403")
  ) {
    return "auth";
  }

  return "unknown";
}

function suggestImprovementsForPattern(
  pattern: FailurePattern
): EvolutionSuggestion[] {
  const suggestions: EvolutionSuggestion[] = [];

  if (pattern.pattern.includes("Tool") && pattern.pattern.includes("failing")) {
    const tool = pattern.toolsInvolved[0];

    suggestions.push({
      type: "add_fallback",
      priority: "high",
      description: `Add fallback strategy for ${tool}`,
      rationale: `${tool} has failed ${pattern.frequency} times in the last 24 hours`,
      estimatedImpact: `Would reduce failures by ~${Math.round(pattern.frequency * 0.7)} per day`,
    });
  }

  if (pattern.pattern.includes("timeout")) {
    suggestions.push({
      type: "improve_tool",
      priority: "medium",
      description: "Implement chunked processing for long operations",
      rationale: `Timeout errors occurring ${pattern.frequency} times`,
      estimatedImpact: "Would allow completion of long-running tasks",
    });
  }

  if (pattern.pattern.includes("rate_limit")) {
    suggestions.push({
      type: "improve_tool",
      priority: "high",
      description: "Add rate limiting and request queuing",
      rationale: `Rate limits hit ${pattern.frequency} times`,
      estimatedImpact: "Would prevent API blocks and improve reliability",
    });
  }

  if (pattern.pattern.includes("auth")) {
    suggestions.push({
      type: "documentation",
      priority: "medium",
      description: "Document required API credentials and setup",
      rationale: `Auth errors occurring ${pattern.frequency} times`,
      estimatedImpact: "Would help users configure APIs correctly",
    });
  }

  if (pattern.pattern.includes("not_found")) {
    suggestions.push({
      type: "improve_tool",
      priority: "medium",
      description:
        "Add path validation and auto-creation for missing directories",
      rationale: `File not found errors occurring ${pattern.frequency} times`,
      estimatedImpact: "Would reduce file operation failures",
    });
  }

  return suggestions;
}

async function recordEvolutionSuggestions(
  userId: number,
  suggestions: EvolutionSuggestion[]
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const highPriority = suggestions.filter(s => s.priority === "high");
  if (highPriority.length === 0) return;

  try {
    await db.insert(learningEvents).values({
      userId,
      eventType: "pattern_detected",
      summary: `Auto-detected ${suggestions.length} improvement opportunities`,
      content: { suggestions },
      confidence: 80,
      createdAt: new Date(),
    });
  } catch {
    return;
  }
}

export async function getRecentFailureStats(hours: number = 24): Promise<{
  totalFailures: number;
  byTool: Record<string, number>;
  byErrorType: Record<string, number>;
  patterns: FailurePattern[];
}> {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  const recentOnly = recentFailures.filter(f => f.timestamp > cutoff);

  const byTool: Record<string, number> = {};
  const byErrorType: Record<string, number> = {};

  for (const failure of recentOnly) {
    for (const tool of failure.toolsFailed) {
      byTool[tool] = (byTool[tool] || 0) + 1;
    }

    const errorType = categorizeError(failure.error);
    byErrorType[errorType] = (byErrorType[errorType] || 0) + 1;
  }

  return {
    totalFailures: recentOnly.length,
    byTool,
    byErrorType,
    patterns: detectFailurePatterns(),
  };
}

export function clearFailureHistory(): void {
  recentFailures.length = 0;
}

export async function runScheduledEvolutionCheck(
  userId: number
): Promise<EvolutionSuggestion[]> {
  const patterns = detectFailurePatterns();
  const suggestions: EvolutionSuggestion[] = [];

  for (const pattern of patterns) {
    suggestions.push(...suggestImprovementsForPattern(pattern));
  }

  const registry = getCapabilityRegistry();
  const gaps = registry.getGaps();

  for (const gap of gaps.filter(g => g.status === "identified")) {
    suggestions.push({
      type: "new_skill",
      priority: gap.priority,
      description: `Address capability gap: ${gap.description}`,
      rationale: `Gap detected: ${gap.context?.slice(0, 100) || "Unknown context"}`,
      estimatedImpact: "Would expand capabilities",
    });
  }

  const summary = registry.getSummary();
  for (const cap of summary.lowConfidence) {
    suggestions.push({
      type: "improve_tool",
      priority: "low",
      description: `Improve reliability of ${cap.name}`,
      rationale: `Confidence only ${Math.round(cap.confidence * 100)}%`,
      estimatedImpact: "Would improve success rate",
    });
  }

  if (suggestions.length > 0) {
    await recordEvolutionSuggestions(userId, suggestions);
  }

  return suggestions;
}
