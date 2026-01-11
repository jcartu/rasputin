import { getDb } from "../../db";
import { learningEvents, proceduralMemories } from "../../../drizzle/schema";
import { eq, and, desc, sql, like } from "drizzle-orm";

export interface TaskPerformance {
  taskSignature: string;
  executionCount: number;
  averageDuration: number;
  lastDuration: number;
  bestDuration: number;
  successRate: number;
  isImproving: boolean;
  improvementPercent: number;
}

export interface PerformanceComparison {
  currentDuration: number;
  previousDuration?: number;
  averageDuration?: number;
  isImprovement: boolean;
  improvementPercent: number;
  recommendation?: string;
}

const performanceCache = new Map<string, TaskPerformance[]>();

function generateTaskSignature(query: string): string {
  const normalized = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 3)
    .sort()
    .join("_");

  return normalized.slice(0, 100);
}

export async function recordTaskPerformance(
  userId: number,
  taskQuery: string,
  duration: number,
  success: boolean,
  iterations: number
): Promise<PerformanceComparison> {
  const signature = generateTaskSignature(taskQuery);
  const userKey = `${userId}:${signature}`;

  let performances = performanceCache.get(userKey) || [];

  const previousPerformance = performances[performances.length - 1];

  const newPerformance: TaskPerformance = {
    taskSignature: signature,
    executionCount: (previousPerformance?.executionCount || 0) + 1,
    averageDuration: calculateNewAverage(
      previousPerformance?.averageDuration || duration,
      duration,
      previousPerformance?.executionCount || 0
    ),
    lastDuration: duration,
    bestDuration: Math.min(
      previousPerformance?.bestDuration || duration,
      duration
    ),
    successRate: calculateSuccessRate(
      previousPerformance?.successRate || 100,
      success,
      previousPerformance?.executionCount || 0
    ),
    isImproving: false,
    improvementPercent: 0,
  };

  if (previousPerformance) {
    const improvement =
      ((previousPerformance.lastDuration - duration) /
        previousPerformance.lastDuration) *
      100;
    newPerformance.isImproving = improvement > 0;
    newPerformance.improvementPercent = improvement;
  }

  performances.push(newPerformance);
  if (performances.length > 10) {
    performances = performances.slice(-10);
  }
  performanceCache.set(userKey, performances);

  const comparison: PerformanceComparison = {
    currentDuration: duration,
    previousDuration: previousPerformance?.lastDuration,
    averageDuration: newPerformance.averageDuration,
    isImprovement: newPerformance.isImproving,
    improvementPercent: newPerformance.improvementPercent,
  };

  if (newPerformance.isImproving && newPerformance.improvementPercent > 10) {
    comparison.recommendation =
      "Performance improved significantly. Consider saving this approach as a procedure.";
  } else if (
    !newPerformance.isImproving &&
    newPerformance.improvementPercent < -20
  ) {
    comparison.recommendation =
      "Performance regressed. Review recent changes or consult memory for better approaches.";
  }

  return comparison;
}

function calculateNewAverage(
  currentAvg: number,
  newValue: number,
  count: number
): number {
  return (currentAvg * count + newValue) / (count + 1);
}

function calculateSuccessRate(
  currentRate: number,
  success: boolean,
  count: number
): number {
  const successValue = success ? 100 : 0;
  return (currentRate * count + successValue) / (count + 1);
}

export async function getTaskPerformanceHistory(
  userId: number,
  taskQuery: string
): Promise<TaskPerformance | null> {
  const signature = generateTaskSignature(taskQuery);
  const userKey = `${userId}:${signature}`;

  const performances = performanceCache.get(userKey);
  if (!performances || performances.length === 0) {
    return null;
  }

  return performances[performances.length - 1];
}

export async function getSimilarTaskPerformance(
  userId: number,
  taskQuery: string
): Promise<TaskPerformance[]> {
  const signature = generateTaskSignature(taskQuery);
  const signatureWords = signature.split("_");

  const results: TaskPerformance[] = [];

  for (const [key, performances] of Array.from(performanceCache.entries())) {
    if (!key.startsWith(`${userId}:`)) continue;

    const storedSignature = key.split(":")[1];
    const storedWords = storedSignature.split("_");

    const overlap = signatureWords.filter(w => storedWords.includes(w)).length;
    const similarity =
      overlap / Math.max(signatureWords.length, storedWords.length);

    if (similarity > 0.5 && performances.length > 0) {
      results.push(performances[performances.length - 1]);
    }
  }

  return results.sort((a, b) => b.successRate - a.successRate);
}

export function formatPerformanceReport(
  comparison: PerformanceComparison
): string {
  const parts: string[] = [];

  parts.push(`Duration: ${(comparison.currentDuration / 1000).toFixed(1)}s`);

  if (comparison.previousDuration) {
    const diff = comparison.currentDuration - comparison.previousDuration;
    const diffStr =
      diff > 0
        ? `+${(diff / 1000).toFixed(1)}s`
        : `${(diff / 1000).toFixed(1)}s`;
    parts.push(`vs previous: ${diffStr}`);
  }

  if (comparison.averageDuration) {
    parts.push(`avg: ${(comparison.averageDuration / 1000).toFixed(1)}s`);
  }

  if (comparison.isImprovement) {
    parts.push(`IMPROVED ${comparison.improvementPercent.toFixed(0)}%`);
  } else if (comparison.improvementPercent < -10) {
    parts.push(`SLOWER ${Math.abs(comparison.improvementPercent).toFixed(0)}%`);
  }

  return parts.join(" | ");
}

export async function getPerformanceGuidance(
  userId: number,
  taskQuery: string
): Promise<string> {
  const history = await getTaskPerformanceHistory(userId, taskQuery);
  const similar = await getSimilarTaskPerformance(userId, taskQuery);

  if (!history && similar.length === 0) {
    return "";
  }

  const sections: string[] = [];

  if (history) {
    sections.push(
      `Previous execution: ${(history.lastDuration / 1000).toFixed(1)}s`
    );
    sections.push(`Best time: ${(history.bestDuration / 1000).toFixed(1)}s`);
    sections.push(`Success rate: ${history.successRate.toFixed(0)}%`);
  }

  if (similar.length > 0) {
    const bestSimilar = similar[0];
    sections.push(
      `Similar tasks avg: ${(bestSimilar.averageDuration / 1000).toFixed(1)}s`
    );
  }

  return sections.length > 0
    ? `\n[Performance Context: ${sections.join(" | ")}]`
    : "";
}
