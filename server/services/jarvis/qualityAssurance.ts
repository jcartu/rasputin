import { getDb } from "../../db";
import { agentTasks } from "../../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";

const QUALITY_THRESHOLDS = {
  simple: {
    minOutputBytes: 50,
    minIterations: 1,
    maxIterations: 5,
    minToolsUsed: 0,
  },
  moderate: {
    minOutputBytes: 500,
    minIterations: 2,
    maxIterations: 10,
    minToolsUsed: 1,
  },
  complex: {
    minOutputBytes: 2000,
    minIterations: 3,
    maxIterations: 15,
    minToolsUsed: 3,
  },
};

const FILE_SIZE_EXPECTATIONS: Record<string, { min: number; warn: number }> = {
  md: { min: 500, warn: 200 },
  markdown: { min: 500, warn: 200 },
  docx: { min: 1000, warn: 500 },
  xlsx: { min: 500, warn: 200 },
  pptx: { min: 2000, warn: 1000 },
  json: { min: 100, warn: 50 },
  html: { min: 200, warn: 100 },
  py: { min: 100, warn: 50 },
  js: { min: 100, warn: 50 },
  ts: { min: 100, warn: 50 },
};

export interface QualityCheck {
  passed: boolean;
  score: number;
  issues: QualityIssue[];
  recommendations: string[];
  shouldRetry: boolean;
  shouldEscalate: boolean;
}

export interface QualityIssue {
  severity: "critical" | "warning" | "info";
  category: "size" | "completeness" | "regression" | "consistency" | "depth";
  message: string;
  details?: string;
}

export interface TaskContext {
  task: string;
  complexity: "simple" | "moderate" | "complex";
  iterations: number;
  toolsUsed: string[];
  filesWritten: FileInfo[];
  summary: string;
  userId?: number;
}

export interface FileInfo {
  path: string;
  size: number;
  type: string;
}

export async function validateTaskQuality(
  context: TaskContext
): Promise<QualityCheck> {
  const issues: QualityIssue[] = [];
  const recommendations: string[] = [];
  let score = 100;

  const sizeCheck = checkOutputSize(context);
  issues.push(...sizeCheck.issues);
  score -= sizeCheck.penalty;
  recommendations.push(...sizeCheck.recommendations);

  const depthCheck = checkTaskDepth(context);
  issues.push(...depthCheck.issues);
  score -= depthCheck.penalty;
  recommendations.push(...depthCheck.recommendations);

  const fileCheck = checkFileDeliverables(context);
  issues.push(...fileCheck.issues);
  score -= fileCheck.penalty;
  recommendations.push(...fileCheck.recommendations);

  const regressionCheck = await checkForRegression(context);
  issues.push(...regressionCheck.issues);
  score -= regressionCheck.penalty;
  recommendations.push(...regressionCheck.recommendations);

  const consistencyCheck = checkConsistency(context);
  issues.push(...consistencyCheck.issues);
  score -= consistencyCheck.penalty;
  recommendations.push(...consistencyCheck.recommendations);

  const criticalIssues = issues.filter(i => i.severity === "critical");
  const warningIssues = issues.filter(i => i.severity === "warning");

  const shouldRetry = criticalIssues.length > 0 || score < 50;
  const shouldEscalate = score < 30 || criticalIssues.length > 2;

  console.info(
    `[QA] Task quality score: ${score}/100, ` +
      `${criticalIssues.length} critical, ${warningIssues.length} warnings`
  );

  return {
    passed: score >= 60 && criticalIssues.length === 0,
    score: Math.max(0, score),
    issues,
    recommendations: Array.from(new Set(recommendations)),
    shouldRetry,
    shouldEscalate,
  };
}

function checkOutputSize(context: TaskContext): {
  issues: QualityIssue[];
  penalty: number;
  recommendations: string[];
} {
  const issues: QualityIssue[] = [];
  const recommendations: string[] = [];
  let penalty = 0;

  const threshold = QUALITY_THRESHOLDS[context.complexity];
  const summarySize = context.summary?.length || 0;
  const totalFileSize = context.filesWritten.reduce(
    (sum, f) => sum + f.size,
    0
  );
  const totalOutput = summarySize + totalFileSize;

  if (summarySize < 50) {
    issues.push({
      severity: "warning",
      category: "size",
      message: "Summary is suspiciously short",
      details: `Summary is only ${summarySize} characters`,
    });
    penalty += 10;
    recommendations.push(
      "Provide a more detailed summary of what was accomplished"
    );
  }

  if (totalOutput < threshold.minOutputBytes) {
    const severity =
      totalOutput < threshold.minOutputBytes / 4 ? "critical" : "warning";
    issues.push({
      severity,
      category: "size",
      message: `Output too small for ${context.complexity} task`,
      details: `Expected at least ${threshold.minOutputBytes} bytes, got ${totalOutput}`,
    });
    penalty += severity === "critical" ? 30 : 15;
    recommendations.push(
      `A ${context.complexity} task should produce more substantial output`
    );
  }

  for (const file of context.filesWritten) {
    const ext = file.path.split(".").pop()?.toLowerCase() || "";
    const expectation = FILE_SIZE_EXPECTATIONS[ext];

    if (expectation) {
      if (file.size < expectation.min) {
        const severity = file.size < expectation.warn ? "critical" : "warning";
        issues.push({
          severity,
          category: "size",
          message: `File ${file.path} is unusually small`,
          details: `${file.size} bytes, expected at least ${expectation.min}`,
        });
        penalty += severity === "critical" ? 25 : 10;
        recommendations.push(`Review and expand content in ${file.path}`);
      }
    }
  }

  return { issues, penalty, recommendations };
}

function checkTaskDepth(context: TaskContext): {
  issues: QualityIssue[];
  penalty: number;
  recommendations: string[];
} {
  const issues: QualityIssue[] = [];
  const recommendations: string[] = [];
  let penalty = 0;

  const threshold = QUALITY_THRESHOLDS[context.complexity];

  if (context.iterations < threshold.minIterations) {
    issues.push({
      severity: "warning",
      category: "depth",
      message: `Task completed too quickly for ${context.complexity} complexity`,
      details: `Only ${context.iterations} iterations, expected at least ${threshold.minIterations}`,
    });
    penalty += 15;
    recommendations.push("Consider whether more thorough analysis is needed");
  }

  if (context.toolsUsed.length < threshold.minToolsUsed) {
    issues.push({
      severity: "warning",
      category: "depth",
      message: `Few tools used for ${context.complexity} task`,
      details: `Only ${context.toolsUsed.length} tools, expected at least ${threshold.minToolsUsed}`,
    });
    penalty += 10;
    recommendations.push("Consider using more tools for comprehensive results");
  }

  const taskLower = context.task.toLowerCase();

  if (
    (taskLower.includes("research") ||
      taskLower.includes("find") ||
      taskLower.includes("look up")) &&
    !context.toolsUsed.some(t => t.includes("search") || t.includes("browse"))
  ) {
    issues.push({
      severity: "warning",
      category: "depth",
      message: "Research task completed without web search",
    });
    penalty += 10;
    recommendations.push("Use web_search or browse_url for research tasks");
  }

  if (
    (taskLower.includes("your own code") ||
      taskLower.includes("your capabilities") ||
      taskLower.includes("what can you do")) &&
    !context.toolsUsed.some(
      t => t.includes("introspection") || t.includes("index")
    )
  ) {
    issues.push({
      severity: "warning",
      category: "depth",
      message: "Self-analysis task without introspection tools",
    });
    penalty += 15;
    recommendations.push(
      "Use self_introspection or self_index_code for self-analysis"
    );
  }

  return { issues, penalty, recommendations };
}

function checkFileDeliverables(context: TaskContext): {
  issues: QualityIssue[];
  penalty: number;
  recommendations: string[];
} {
  const issues: QualityIssue[] = [];
  const recommendations: string[] = [];
  let penalty = 0;

  const filePatterns: Array<{
    pattern: RegExp;
    type: string;
    count?: number;
  }> = [
    {
      pattern:
        /\b(create|write|produce|generate|save|make)\b.*\b(file|document|md|markdown)\b/i,
      type: "document",
    },
    {
      pattern: /\btwo\s+(files|documents|mds?|markdowns?)\b/i,
      type: "multiple",
      count: 2,
    },
    { pattern: /\bthree\s+(files|documents)\b/i, type: "multiple", count: 3 },
    { pattern: /\breport\b/i, type: "report" },
    { pattern: /\bplan\b/i, type: "plan" },
  ];

  for (const { pattern, type, count } of filePatterns) {
    if (pattern.test(context.task)) {
      if (type === "multiple" && count) {
        if (context.filesWritten.length < count) {
          issues.push({
            severity: "critical",
            category: "completeness",
            message: `Task requested ${count} files but only ${context.filesWritten.length} were created`,
          });
          penalty += 25;
          recommendations.push(`Create all ${count} requested files`);
        }
      } else if (context.filesWritten.length === 0) {
        issues.push({
          severity: "critical",
          category: "completeness",
          message: "Task requested file output but no files were written",
        });
        penalty += 30;
        recommendations.push("Use write_file to create the requested output");
      }
    }
  }

  for (const file of context.filesWritten) {
    if (file.size === 0) {
      issues.push({
        severity: "critical",
        category: "completeness",
        message: `File ${file.path} is empty`,
      });
      penalty += 20;
      recommendations.push(`Add content to ${file.path}`);
    }
  }

  return { issues, penalty, recommendations };
}

async function checkForRegression(context: TaskContext): Promise<{
  issues: QualityIssue[];
  penalty: number;
  recommendations: string[];
}> {
  const issues: QualityIssue[] = [];
  const recommendations: string[] = [];
  let penalty = 0;

  if (!context.userId) {
    return { issues, penalty, recommendations };
  }

  try {
    const db = await getDb();
    if (!db) {
      return { issues, penalty, recommendations };
    }

    const keywords = extractKeywords(context.task);
    if (keywords.length === 0) {
      return { issues, penalty, recommendations };
    }

    const pastTasks = await db
      .select({
        id: agentTasks.id,
        query: agentTasks.query,
        result: agentTasks.result,
        iterationCount: agentTasks.iterationCount,
        status: agentTasks.status,
      })
      .from(agentTasks)
      .where(
        and(
          eq(agentTasks.userId, context.userId),
          eq(agentTasks.status, "completed")
        )
      )
      .orderBy(desc(agentTasks.createdAt))
      .limit(50);

    const similarTasks = pastTasks.filter(t => {
      const taskKeywords = extractKeywords(t.query);
      const overlap = keywords.filter(k => taskKeywords.includes(k));
      return overlap.length >= 2;
    });

    if (similarTasks.length === 0) {
      return { issues, penalty, recommendations };
    }

    const avgResultSize =
      similarTasks.reduce(
        (sum: number, t: { result: string | null }) =>
          sum + (t.result?.length || 0),
        0
      ) / similarTasks.length;

    const avgIterations =
      similarTasks.reduce(
        (sum: number, t: { iterationCount: number | null }) =>
          sum + (t.iterationCount || 1),
        0
      ) / similarTasks.length;

    const currentResultSize = context.summary?.length || 0;

    if (avgResultSize > 0 && currentResultSize < avgResultSize * 0.2) {
      issues.push({
        severity: "critical",
        category: "regression",
        message: "Significant quality regression detected",
        details: `Current output (${currentResultSize} chars) is <20% of average similar tasks (${Math.round(avgResultSize)} chars)`,
      });
      penalty += 25;
      recommendations.push(
        "Output is much smaller than similar past tasks. Expand the response."
      );
    } else if (avgResultSize > 0 && currentResultSize < avgResultSize * 0.5) {
      issues.push({
        severity: "warning",
        category: "regression",
        message: "Potential quality regression",
        details: `Current output is smaller than average for similar tasks`,
      });
      penalty += 10;
    }

    if (avgIterations > 3 && context.iterations < avgIterations * 0.3) {
      issues.push({
        severity: "warning",
        category: "regression",
        message: "Task completed with fewer iterations than similar past tasks",
        details: `${context.iterations} iterations vs average ${Math.round(avgIterations)}`,
      });
      penalty += 10;
    }
  } catch (error) {
    console.error("[QA] Regression check failed:", error);
  }

  return { issues, penalty, recommendations };
}

function checkConsistency(context: TaskContext): {
  issues: QualityIssue[];
  penalty: number;
  recommendations: string[];
} {
  const issues: QualityIssue[] = [];
  const recommendations: string[] = [];
  let penalty = 0;

  const taskLower = context.task.toLowerCase();
  const summaryLower = context.summary?.toLowerCase() || "";

  const deliverables = [
    { pattern: /\bplan\b/, check: "plan" },
    { pattern: /\banalysis\b/, check: "analy" },
    { pattern: /\breport\b/, check: "report" },
    { pattern: /\bsummary\b/, check: "summar" },
    { pattern: /\blist\b/, check: "list" },
    { pattern: /\bcompar/, check: "compar" },
  ];

  for (const { pattern, check } of deliverables) {
    if (pattern.test(taskLower) && !summaryLower.includes(check)) {
      const fileHasIt = context.filesWritten.some(f =>
        f.path.toLowerCase().includes(check)
      );
      if (!fileHasIt) {
        issues.push({
          severity: "info",
          category: "consistency",
          message: `Task requested "${check}" but it may not be in output`,
        });
        penalty += 5;
      }
    }
  }

  const multiPartPatterns = [
    { pattern: /first.*second/i, parts: 2 },
    { pattern: /\band\s+then\b/i, parts: 2 },
    { pattern: /\balso\b/i, parts: 2 },
    { pattern: /\bthree\s+things\b/i, parts: 3 },
  ];

  for (const { pattern, parts } of multiPartPatterns) {
    if (pattern.test(context.task)) {
      if (
        context.filesWritten.length < parts &&
        context.complexity === "complex"
      ) {
        issues.push({
          severity: "warning",
          category: "consistency",
          message: `Multi-part task may not have all parts completed`,
          details: `Task appears to have ${parts}+ parts`,
        });
        penalty += 10;
        recommendations.push("Ensure all parts of the request are addressed");
      }
    }
  }

  return { issues, penalty, recommendations };
}

function extractKeywords(task: string): string[] {
  const stopWords = new Set([
    "the",
    "a",
    "an",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
    "may",
    "might",
    "must",
    "shall",
    "can",
    "to",
    "of",
    "in",
    "for",
    "on",
    "with",
    "at",
    "by",
    "from",
    "as",
    "into",
    "through",
    "during",
    "before",
    "after",
    "above",
    "below",
    "between",
    "under",
    "again",
    "further",
    "then",
    "once",
    "here",
    "there",
    "when",
    "where",
    "why",
    "how",
    "all",
    "each",
    "few",
    "more",
    "most",
    "other",
    "some",
    "such",
    "no",
    "nor",
    "not",
    "only",
    "own",
    "same",
    "so",
    "than",
    "too",
    "very",
    "just",
    "and",
    "but",
    "if",
    "or",
    "because",
    "until",
    "while",
    "this",
    "that",
    "these",
    "those",
    "it",
    "its",
    "i",
    "me",
    "my",
    "you",
    "your",
    "we",
    "our",
    "they",
    "them",
    "their",
    "what",
  ]);

  return task
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word))
    .slice(0, 10);
}

export interface EscalationStrategy {
  escalateModel: boolean;
  requiredTools: string[];
  minIterationsRemaining: number;
  forceToolSequence: string[];
}

export function determineEscalationStrategy(
  check: QualityCheck,
  context: TaskContext,
  currentAttempt: number
): EscalationStrategy {
  const strategy: EscalationStrategy = {
    escalateModel: false,
    requiredTools: [],
    minIterationsRemaining: 3,
    forceToolSequence: [],
  };

  const criticalCount = check.issues.filter(
    i => i.severity === "critical"
  ).length;

  if (currentAttempt >= 2 || check.score < 40 || criticalCount >= 2) {
    strategy.escalateModel = true;
  }

  const sizeIssues = check.issues.filter(i => i.category === "size");
  const depthIssues = check.issues.filter(i => i.category === "depth");
  const completenessIssues = check.issues.filter(
    i => i.category === "completeness"
  );

  if (completenessIssues.length > 0) {
    strategy.requiredTools.push("write_file");
    strategy.forceToolSequence.push("write_file", "list_files");
  }

  if (depthIssues.some(i => i.message.includes("web search"))) {
    strategy.requiredTools.push("web_search");
  }

  if (depthIssues.some(i => i.message.includes("introspection"))) {
    strategy.requiredTools.push("self_introspection");
  }

  if (context.complexity === "complex") {
    strategy.minIterationsRemaining = Math.max(
      5,
      strategy.minIterationsRemaining
    );
  }

  if (sizeIssues.some(i => i.severity === "critical")) {
    strategy.forceToolSequence.push("execute_python", "write_file");
  }

  return strategy;
}

export function generateQualityImprovementPrompt(
  check: QualityCheck,
  strategy?: EscalationStrategy
): string {
  const criticalIssues = check.issues.filter(i => i.severity === "critical");
  const warnings = check.issues.filter(i => i.severity === "warning");

  let prompt = `⚠️ QUALITY CHECK FAILED (Score: ${check.score}/100)\n\n`;

  if (criticalIssues.length > 0) {
    prompt += `CRITICAL ISSUES (must fix):\n`;
    for (const issue of criticalIssues) {
      prompt += `- ${issue.message}`;
      if (issue.details) prompt += ` (${issue.details})`;
      prompt += `\n`;
    }
    prompt += `\n`;
  }

  if (warnings.length > 0) {
    prompt += `WARNINGS:\n`;
    for (const issue of warnings) {
      prompt += `- ${issue.message}\n`;
    }
    prompt += `\n`;
  }

  if (check.recommendations.length > 0) {
    prompt += `RECOMMENDATIONS:\n`;
    for (const rec of check.recommendations) {
      prompt += `- ${rec}\n`;
    }
  }

  prompt += `\nPlease address these issues and complete the task properly. Do NOT call task_complete until quality requirements are met.`;

  if (strategy) {
    if (strategy.requiredTools.length > 0) {
      prompt += `\n\nREQUIRED TOOLS (must use before task_complete):\n`;
      for (const tool of strategy.requiredTools) {
        prompt += `- ${tool}\n`;
      }
    }

    if (strategy.forceToolSequence.length > 0) {
      prompt += `\nRECOMMENDED SEQUENCE:\n`;
      prompt += strategy.forceToolSequence
        .map((t, i) => `${i + 1}. ${t}`)
        .join("\n");
    }

    if (strategy.escalateModel) {
      prompt += `\n\n⚡ ESCALATION: Using enhanced reasoning model for this retry.`;
    }
  }

  return prompt;
}

export async function recordQualityMetrics(
  taskId: number,
  check: QualityCheck,
  context: TaskContext
): Promise<void> {
  try {
    console.info(
      `[QA] Task ${taskId} quality metrics: ` +
        `score=${check.score}, passed=${check.passed}, ` +
        `complexity=${context.complexity}, iterations=${context.iterations}, ` +
        `files=${context.filesWritten.length}, tools=${context.toolsUsed.length}`
    );
  } catch (error) {
    console.error("[QA] Failed to record quality metrics:", error);
  }
}
