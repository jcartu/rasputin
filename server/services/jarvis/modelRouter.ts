import {
  classifyTask,
  type TaskType,
  type TaskClassification,
} from "./taskClassifier";

export interface ModelPerformance {
  modelId: string;
  taskType: TaskType;
  totalTasks: number;
  successCount: number;
  failureCount: number;
  avgDurationMs: number;
  avgTokens: number;
  lastUsed: number;
  successRate: number;
}

export interface RoutingDecision {
  selectedModel: string;
  taskClassification: TaskClassification;
  fallbackModels: string[];
  reasoning: string;
}

const performanceCache = new Map<string, ModelPerformance>();

function getPerformanceKey(modelId: string, taskType: TaskType): string {
  return `${modelId}:${taskType}`;
}

export function recordModelPerformance(
  modelId: string,
  taskType: TaskType,
  success: boolean,
  durationMs: number,
  tokens: number
): void {
  const key = getPerformanceKey(modelId, taskType);
  const existing = performanceCache.get(key);

  if (existing) {
    const newTotal = existing.totalTasks + 1;
    const newSuccess = existing.successCount + (success ? 1 : 0);
    const newFailure = existing.failureCount + (success ? 0 : 1);

    performanceCache.set(key, {
      ...existing,
      totalTasks: newTotal,
      successCount: newSuccess,
      failureCount: newFailure,
      avgDurationMs:
        (existing.avgDurationMs * existing.totalTasks + durationMs) / newTotal,
      avgTokens: (existing.avgTokens * existing.totalTasks + tokens) / newTotal,
      lastUsed: Date.now(),
      successRate: newSuccess / newTotal,
    });
  } else {
    performanceCache.set(key, {
      modelId,
      taskType,
      totalTasks: 1,
      successCount: success ? 1 : 0,
      failureCount: success ? 0 : 1,
      avgDurationMs: durationMs,
      avgTokens: tokens,
      lastUsed: Date.now(),
      successRate: success ? 1 : 0,
    });
  }
}

export function getModelPerformance(
  modelId: string,
  taskType: TaskType
): ModelPerformance | null {
  return performanceCache.get(getPerformanceKey(modelId, taskType)) || null;
}

export function getAllPerformanceStats(): ModelPerformance[] {
  return Array.from(performanceCache.values());
}

export function getPerformanceForTaskType(
  taskType: TaskType
): ModelPerformance[] {
  return Array.from(performanceCache.values())
    .filter(p => p.taskType === taskType)
    .sort((a, b) => {
      const scoreA = a.successRate * 0.6 + (1 / (a.avgDurationMs + 1)) * 0.4;
      const scoreB = b.successRate * 0.6 + (1 / (b.avgDurationMs + 1)) * 0.4;
      return scoreB - scoreA;
    });
}

function rankModelsByPerformance(
  candidateModels: string[],
  taskType: TaskType
): string[] {
  const modelsWithPerf = candidateModels.map(modelId => {
    const perf = getModelPerformance(modelId, taskType);
    return {
      modelId,
      score: perf
        ? perf.successRate * 0.6 +
          (1 / (perf.avgDurationMs / 1000 + 1)) * 0.3 +
          Math.min(perf.totalTasks / 10, 1) * 0.1
        : 0.5,
      hasData: !!perf,
    };
  });

  modelsWithPerf.sort((a, b) => {
    if (a.hasData && !b.hasData) return -1;
    if (!a.hasData && b.hasData) return 1;
    return b.score - a.score;
  });

  return modelsWithPerf.map(m => m.modelId);
}

export function routeTask(task: string): RoutingDecision {
  const classification = classifyTask(task);
  const candidateModels = classification.suggestedModels;

  const rankedModels = rankModelsByPerformance(
    candidateModels,
    classification.type
  );

  const selectedModel = rankedModels[0];
  const fallbackModels = rankedModels.slice(1);

  const perf = getModelPerformance(selectedModel, classification.type);
  let reasoning = classification.reasoning;

  if (perf && perf.totalTasks >= 3) {
    reasoning += ` Selected ${selectedModel} based on ${(perf.successRate * 100).toFixed(0)}% success rate over ${perf.totalTasks} similar tasks.`;
  } else {
    reasoning += ` Selected ${selectedModel} as default for ${classification.type} tasks.`;
  }

  return {
    selectedModel,
    taskClassification: classification,
    fallbackModels,
    reasoning,
  };
}

export function selectFallbackModel(
  currentModel: string,
  fallbackModels: string[],
  taskType: TaskType
): string | null {
  const remainingFallbacks = fallbackModels.filter(m => m !== currentModel);

  if (remainingFallbacks.length === 0) {
    return null;
  }

  const ranked = rankModelsByPerformance(remainingFallbacks, taskType);
  return ranked[0] || null;
}

export function formatRoutingReport(decision: RoutingDecision): string {
  const lines: string[] = [
    `[Model Router] Task Type: ${decision.taskClassification.type} (${(decision.taskClassification.confidence * 100).toFixed(0)}% confidence)`,
    `[Model Router] Selected: ${decision.selectedModel}`,
    `[Model Router] Fallbacks: ${decision.fallbackModels.join(", ")}`,
  ];
  return lines.join("\n");
}

export function clearPerformanceCache(): void {
  performanceCache.clear();
}

export function getRoutingStats(): {
  totalDecisions: number;
  taskTypeDistribution: Record<TaskType, number>;
  topModelsPerType: Record<TaskType, string[]>;
} {
  const allPerf = getAllPerformanceStats();
  const taskTypeDistribution: Record<TaskType, number> = {
    code: 0,
    research: 0,
    analysis: 0,
    creative: 0,
    fast: 0,
    general: 0,
  };

  const topModelsPerType: Record<TaskType, string[]> = {
    code: [],
    research: [],
    analysis: [],
    creative: [],
    fast: [],
    general: [],
  };

  let totalDecisions = 0;

  for (const perf of allPerf) {
    taskTypeDistribution[perf.taskType] += perf.totalTasks;
    totalDecisions += perf.totalTasks;
  }

  const taskTypes: TaskType[] = [
    "code",
    "research",
    "analysis",
    "creative",
    "fast",
    "general",
  ];

  for (const taskType of taskTypes) {
    const perfsForType = getPerformanceForTaskType(taskType);
    topModelsPerType[taskType] = perfsForType.slice(0, 3).map(p => p.modelId);
  }

  return {
    totalDecisions,
    taskTypeDistribution,
    topModelsPerType,
  };
}
