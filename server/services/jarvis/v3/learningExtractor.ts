/**
 * JARVIS v3 Learning Extractor
 * Extracts patterns, skills, and knowledge from tool executions
 * for storage in the memory system
 */

import type {
  AgentType,
  ToolCategory,
  LearningPayload,
  ToolResult,
  ExecutionContext,
} from "./types";
import type {
  EpisodicMemory,
  SemanticMemory,
  ProceduralMemory,
  LearningEvent,
  ProcedureStep,
} from "../../memory/types";

export interface ExtractedLearning {
  episodic?: Omit<EpisodicMemory, "id" | "createdAt" | "updatedAt">;
  semantic?: Omit<SemanticMemory, "id" | "createdAt" | "updatedAt">[];
  procedural?: Omit<ProceduralMemory, "id" | "createdAt" | "updatedAt">;
  learningEvent?: Omit<LearningEvent, "id" | "createdAt">;
  rawPayload: LearningPayload;
}

export interface ToolExecutionRecord {
  toolName: string;
  category: ToolCategory;
  params: Record<string, unknown>;
  result: ToolResult;
  context: ExecutionContext;
  agentType?: AgentType;
}

/**
 * Extracts learning from a tool execution
 */
export function extractLearningFromExecution(
  record: ToolExecutionRecord
): ExtractedLearning {
  const { toolName, category, params, result, context, agentType } = record;

  const inputSummary = summarize(JSON.stringify(params), 200);
  const outputSummary = summarize(result.output, 500);
  const patterns = extractCategoryPatterns(category, params, result);
  const insights = generateInsights(toolName, params, result);

  const rawPayload: LearningPayload = {
    type: "tool_execution",
    toolName,
    taskContext: `Task ${context.taskId} in session ${context.sessionId}`,
    inputSummary,
    outputSummary,
    success: result.success,
    durationMs: result.durationMs || 0,
    patterns,
    insights,
    timestamp: Date.now(),
  };

  const learning: ExtractedLearning = { rawPayload };

  if (shouldCreateEpisodicMemory(result, patterns)) {
    learning.episodic = createEpisodicFromExecution(
      record,
      inputSummary,
      outputSummary,
      insights
    );
  }

  const semanticFacts = extractSemanticFacts(record, patterns);
  if (semanticFacts.length > 0) {
    learning.semantic = semanticFacts;
  }

  if (shouldCreateProceduralMemory(record)) {
    learning.procedural = createProceduralFromExecution(record, patterns);
  }

  learning.learningEvent = createLearningEvent(
    record,
    patterns,
    insights,
    agentType
  );

  return learning;
}

/**
 * Determine if this execution warrants an episodic memory
 */
function shouldCreateEpisodicMemory(
  result: ToolResult,
  patterns: string[]
): boolean {
  if (!result.success) return true;
  if (patterns.length >= 2) return true;
  if (result.durationMs && result.durationMs > 10000) return true;
  return false;
}

/**
 * Determine if this execution represents a skill worth storing
 */
function shouldCreateProceduralMemory(record: ToolExecutionRecord): boolean {
  const { result, category, params } = record;

  if (!result.success) return false;

  const skillCategories: ToolCategory[] = [
    "code",
    "git",
    "docker",
    "ssh",
    "scaffold",
    "database",
  ];

  if (!skillCategories.includes(category)) return false;

  return Object.keys(params).length >= 2;
}

/**
 * Create episodic memory from tool execution
 */
function createEpisodicFromExecution(
  record: ToolExecutionRecord,
  inputSummary: string,
  outputSummary: string,
  insights: string[]
): Omit<EpisodicMemory, "id" | "createdAt" | "updatedAt"> {
  const { toolName, category, result, context } = record;

  return {
    userId: context.userId,
    taskId: context.taskId,
    memoryType: result.success ? "task_success" : "task_failure",
    title: `${toolName} ${result.success ? "succeeded" : "failed"}`,
    description: `Used ${toolName} (${category}) with input: ${inputSummary}`,
    context: `Task ${context.taskId}, Session ${context.sessionId}`,
    action: `Executed ${toolName}`,
    outcome: outputSummary,
    lessons: insights,
    entities: extractEntities(record),
    tags: [toolName, category, result.success ? "success" : "failure"],
    importance: calculateImportance(record),
    accessCount: 0,
  };
}

/**
 * Extract semantic facts from execution
 */
function extractSemanticFacts(
  record: ToolExecutionRecord,
  patterns: string[]
): Omit<SemanticMemory, "id" | "createdAt" | "updatedAt">[] {
  const facts: Omit<SemanticMemory, "id" | "createdAt" | "updatedAt">[] = [];
  const { toolName, category: _category, params, result, context } = record;

  for (const pattern of patterns) {
    const [type, value] = pattern.split(":");
    if (!type || !value) continue;

    switch (type) {
      case "file_type":
        facts.push({
          userId: context.userId,
          category: "file_structure",
          subject: toolName,
          predicate: "works_with",
          object: `.${value} files`,
          confidence: 0.9,
          source: "tool_execution",
          sourceTaskId: context.taskId,
          isValid: true,
        });
        break;

      case "domain":
        facts.push({
          userId: context.userId,
          category: "api_info",
          subject: toolName,
          predicate: "accessed",
          object: value,
          confidence: 0.95,
          source: "tool_execution",
          sourceTaskId: context.taskId,
          isValid: true,
        });
        break;

      case "host":
        facts.push({
          userId: context.userId,
          category: "system_info",
          subject: "ssh",
          predicate: "connected_to",
          object: value,
          confidence: 1.0,
          source: "tool_execution",
          sourceTaskId: context.taskId,
          isValid: true,
        });
        break;

      case "query_type":
        facts.push({
          userId: context.userId,
          category: "domain_knowledge",
          subject: toolName,
          predicate: "executed",
          object: `${value} query`,
          confidence: 1.0,
          source: "tool_execution",
          sourceTaskId: context.taskId,
          isValid: true,
        });
        break;
    }
  }

  if (result.success) {
    facts.push({
      userId: context.userId,
      category: "domain_knowledge",
      subject: toolName,
      predicate: "can_handle",
      object: describeParams(params),
      confidence: 0.85,
      source: "tool_execution",
      sourceTaskId: context.taskId,
      isValid: true,
    });
  }

  return facts;
}

/**
 * Create procedural memory (skill) from execution
 */
function createProceduralFromExecution(
  record: ToolExecutionRecord,
  patterns: string[]
): Omit<ProceduralMemory, "id" | "createdAt" | "updatedAt"> {
  const { toolName, category, params, result, context } = record;

  const steps: ProcedureStep[] = [
    {
      order: 1,
      action: "prepare",
      description: `Gather required parameters for ${toolName}`,
      expectedOutcome: "Parameters validated",
    },
    {
      order: 2,
      action: "execute",
      description: `Call ${toolName} with: ${describeParams(params)}`,
      toolName,
      expectedOutcome: result.success ? "Success" : "May fail",
    },
    {
      order: 3,
      action: "verify",
      description: `Verify ${toolName} output`,
      expectedOutcome: "Output matches expectations",
    },
  ];

  return {
    userId: context.userId,
    name: `${toolName}_procedure`,
    description: `How to use ${toolName} for ${category} operations`,
    triggerConditions: patterns.filter(
      p => p.startsWith("file_type:") || p.startsWith("domain:")
    ),
    prerequisites: Object.keys(params).map(k => `Requires ${k}`),
    steps,
    postConditions: [result.success ? "Operation completed" : "May need retry"],
    successRate: result.success ? 1.0 : 0.0,
    executionCount: 1,
    successCount: result.success ? 1 : 0,
    avgExecutionTimeMs: result.durationMs || 0,
    sourceTaskId: context.taskId,
    isActive: true,
  };
}

/**
 * Create learning event from execution
 */
function createLearningEvent(
  record: ToolExecutionRecord,
  patterns: string[],
  insights: string[],
  agentType?: AgentType
): Omit<LearningEvent, "id" | "createdAt"> {
  const { toolName, result, context } = record;

  let eventType: LearningEvent["eventType"];
  if (!result.success) {
    eventType = "error_learned";
  } else if (patterns.length > 0) {
    eventType = "pattern_detected";
  } else {
    eventType = "skill_improved";
  }

  return {
    userId: context.userId,
    taskId: context.taskId,
    eventType,
    summary: `${result.success ? "Successful" : "Failed"} ${toolName} execution`,
    content: {
      toolName,
      patterns,
      insights,
      agentType,
      durationMs: result.durationMs,
    },
    confidence: result.success ? 0.9 : 0.7,
    applied: false,
  };
}

/**
 * Extract category-specific patterns
 */
function extractCategoryPatterns(
  category: ToolCategory,
  params: Record<string, unknown>,
  result: ToolResult
): string[] {
  const patterns: string[] = [];

  switch (category) {
    case "code":
    case "file":
      if (typeof params.filePath === "string") {
        const ext = params.filePath.split(".").pop();
        if (ext) patterns.push(`file_type:${ext}`);

        const dir = params.filePath.split("/").slice(0, -1).join("/");
        if (dir) patterns.push(`directory:${dir}`);
      }
      if (typeof params.content === "string") {
        const lines = params.content.split("\n").length;
        if (lines > 100) patterns.push("size:large");
        else if (lines > 20) patterns.push("size:medium");
        else patterns.push("size:small");
      }
      break;

    case "web":
    case "research":
      if (typeof params.url === "string") {
        try {
          const url = new URL(params.url);
          patterns.push(`domain:${url.hostname}`);
          patterns.push(`protocol:${url.protocol.replace(":", "")}`);
        } catch {
          void 0;
        }
      }
      if (typeof params.query === "string") {
        const words = params.query.split(/\s+/).length;
        if (words > 10) patterns.push("query:complex");
        else patterns.push("query:simple");
      }
      break;

    case "git":
      if (typeof params.repoPath === "string") {
        patterns.push(`repo:${params.repoPath}`);
      }
      if (typeof params.branch === "string") {
        patterns.push(`branch:${params.branch}`);
      }
      if (typeof params.message === "string") {
        const msgType = params.message.split(":")[0]?.toLowerCase();
        if (
          msgType &&
          ["feat", "fix", "docs", "refactor", "test"].includes(msgType)
        ) {
          patterns.push(`commit_type:${msgType}`);
        }
      }
      break;

    case "ssh":
      if (typeof params.host === "string") {
        patterns.push(`host:${params.host}`);
      }
      if (typeof params.command === "string") {
        const cmd = params.command.split(" ")[0];
        if (cmd) patterns.push(`command:${cmd}`);
      }
      break;

    case "database":
      if (typeof params.query === "string") {
        const queryType = params.query.trim().split(" ")[0]?.toUpperCase();
        if (queryType) patterns.push(`query_type:${queryType}`);
      }
      break;

    case "docker":
      if (typeof params.image === "string") {
        patterns.push(`image:${params.image}`);
      }
      if (typeof params.command === "string") {
        patterns.push(`docker_cmd:${params.command}`);
      }
      break;

    case "browser":
      if (typeof params.url === "string") {
        try {
          const url = new URL(params.url);
          patterns.push(`domain:${url.hostname}`);
        } catch {
          void 0;
        }
      }
      if (typeof params.action === "string") {
        patterns.push(`browser_action:${params.action}`);
      }
      break;
  }

  patterns.push(`outcome:${result.success ? "success" : "failure"}`);
  patterns.push(`category:${category}`);

  return patterns;
}

/**
 * Generate insights from tool execution
 */
function generateInsights(
  toolName: string,
  params: Record<string, unknown>,
  result: ToolResult
): string[] {
  const insights: string[] = [];

  if (result.durationMs) {
    if (result.durationMs > 30000) {
      insights.push(
        `${toolName} took ${Math.round(result.durationMs / 1000)}s - consider optimization`
      );
    } else if (result.durationMs < 100) {
      insights.push(
        `${toolName} completed very quickly (${result.durationMs}ms)`
      );
    }
  }

  if (!result.success && result.error) {
    const error = result.error.toLowerCase();

    if (error.includes("timeout")) {
      insights.push(
        "Operation timed out - consider increasing timeout or chunking"
      );
    }
    if (error.includes("permission") || error.includes("denied")) {
      insights.push("Permission denied - may need elevated access");
    }
    if (error.includes("not found") || error.includes("404")) {
      insights.push("Resource not found - verify path/URL exists");
    }
    if (error.includes("rate limit") || error.includes("429")) {
      insights.push("Rate limited - implement backoff or caching");
    }
    if (error.includes("authentication") || error.includes("401")) {
      insights.push("Authentication failed - verify credentials");
    }
    if (error.includes("memory") || error.includes("heap")) {
      insights.push("Memory issue - reduce batch size or optimize");
    }
  }

  if (result.success) {
    const outputLength = result.output?.length || 0;
    if (outputLength > 10000) {
      insights.push("Large output generated - consider summarizing");
    }
  }

  return insights;
}

/**
 * Extract entities from execution record
 */
function extractEntities(record: ToolExecutionRecord): string[] {
  const entities: string[] = [record.toolName, record.category];
  const { params } = record;

  if (typeof params.filePath === "string") {
    entities.push(params.filePath);
  }
  if (typeof params.url === "string") {
    entities.push(params.url);
  }
  if (typeof params.host === "string") {
    entities.push(params.host);
  }
  if (typeof params.repoPath === "string") {
    entities.push(params.repoPath);
  }

  return Array.from(new Set(entities));
}

/**
 * Calculate importance score (0-10) based on execution
 */
function calculateImportance(record: ToolExecutionRecord): number {
  const { category, result, params } = record;
  let importance = 5;

  const highImportanceCategories: ToolCategory[] = [
    "git",
    "docker",
    "ssh",
    "database",
    "scaffold",
  ];

  if (highImportanceCategories.includes(category)) importance += 2;
  if (!result.success) importance += 2;
  if (Object.keys(params).length > 3) importance += 1;
  if (result.durationMs && result.durationMs > 10000) importance += 1;

  return Math.min(10, Math.max(1, importance));
}

/**
 * Summarize text to max length
 */
function summarize(text: string, maxLength: number): string {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

/**
 * Describe parameters in human-readable form
 */
function describeParams(params: Record<string, unknown>): string {
  const keys = Object.keys(params);
  if (keys.length === 0) return "no parameters";
  if (keys.length === 1) return `${keys[0]}`;
  if (keys.length <= 3) return keys.join(", ");
  return `${keys.slice(0, 3).join(", ")} (+${keys.length - 3} more)`;
}

/**
 * Batch multiple executions and extract aggregate learnings
 */
export function extractBatchLearning(records: ToolExecutionRecord[]): {
  patterns: Map<string, number>;
  insights: string[];
  toolStats: Map<
    string,
    { success: number; failure: number; avgDuration: number }
  >;
} {
  const patterns = new Map<string, number>();
  const allInsights: string[] = [];
  const toolStats = new Map<
    string,
    {
      success: number;
      failure: number;
      avgDuration: number;
      totalDuration: number;
      count: number;
    }
  >();

  for (const record of records) {
    const learning = extractLearningFromExecution(record);

    for (const pattern of learning.rawPayload.patterns || []) {
      patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
    }

    if (learning.rawPayload.insights) {
      allInsights.push(...learning.rawPayload.insights);
    }

    const stats = toolStats.get(record.toolName) || {
      success: 0,
      failure: 0,
      avgDuration: 0,
      totalDuration: 0,
      count: 0,
    };

    if (record.result.success) {
      stats.success++;
    } else {
      stats.failure++;
    }
    stats.totalDuration += record.result.durationMs || 0;
    stats.count++;
    stats.avgDuration = stats.totalDuration / stats.count;

    toolStats.set(record.toolName, stats);
  }

  const uniqueInsights = Array.from(new Set(allInsights));

  const cleanStats = new Map<
    string,
    { success: number; failure: number; avgDuration: number }
  >();
  Array.from(toolStats.entries()).forEach(([tool, stats]) => {
    cleanStats.set(tool, {
      success: stats.success,
      failure: stats.failure,
      avgDuration: Math.round(stats.avgDuration),
    });
  });

  return {
    patterns,
    insights: uniqueInsights,
    toolStats: cleanStats,
  };
}
