import { getDb } from "../../db";
import { trainingData } from "../../../drizzle/schema";
import { eq, and, gte, lte, inArray, desc } from "drizzle-orm";
import type {
  TrainingExample,
  TrainingDataFilter,
  DatasetStats,
  DataType,
  ChatMLConversation,
} from "./types";

const QUALITY_THRESHOLD = 70;
const MIN_OUTPUT_LENGTH = 50;

interface TaskTrace {
  taskId: number;
  prompt: string;
  systemPrompt?: string;
  iterations: Array<{
    thinking: string;
    toolCalls: Array<{
      name: string;
      arguments: Record<string, unknown>;
      result: string;
    }>;
    response?: string;
  }>;
  finalResult: string;
  success: boolean;
  iterationCount: number;
}

export async function collectTrainingData(
  taskId: number,
  trace: TaskTrace
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  if (!trace.success || trace.iterationCount > 10) {
    return 0;
  }

  const examples: TrainingExample[] = [];
  const qualityScore = calculateQualityScore(trace);

  if (qualityScore < QUALITY_THRESHOLD) {
    return 0;
  }

  const conversationExample = createConversationExample(taskId, trace);
  if (conversationExample) {
    examples.push({ ...conversationExample, qualityScore });
  }

  const toolExamples = createToolUsageExamples(taskId, trace);
  examples.push(...toolExamples.map(e => ({ ...e, qualityScore })));

  if (trace.iterations.some(it => it.thinking && it.thinking.length > 100)) {
    const reasoningExample = createReasoningExample(taskId, trace);
    if (reasoningExample) {
      examples.push({ ...reasoningExample, qualityScore });
    }
  }

  let insertedCount = 0;
  for (const example of examples) {
    if (example.output.length < MIN_OUTPUT_LENGTH) continue;

    try {
      await db.insert(trainingData).values({
        taskId: example.taskId,
        dataType: example.dataType,
        input: example.input,
        output: example.output,
        qualityScore: example.qualityScore,
        usedForTraining: 0,
        metadata: example.metadata ?? {},
      });
      insertedCount++;
    } catch (error) {
      console.error("[DataCollector] Failed to insert example:", error);
    }
  }

  return insertedCount;
}

function calculateQualityScore(trace: TaskTrace): number {
  let score = 50;

  if (trace.success) score += 20;

  if (trace.iterationCount <= 3) score += 15;
  else if (trace.iterationCount <= 5) score += 10;
  else if (trace.iterationCount <= 8) score += 5;

  const hasToolUsage = trace.iterations.some(it => it.toolCalls.length > 0);
  if (hasToolUsage) score += 10;

  const hasReasoning = trace.iterations.some(
    it => it.thinking && it.thinking.length > 100
  );
  if (hasReasoning) score += 5;

  return Math.min(100, score);
}

function createConversationExample(
  taskId: number,
  trace: TaskTrace
): TrainingExample | null {
  const conversation: ChatMLConversation = {
    messages: [],
  };

  if (trace.systemPrompt) {
    conversation.messages.push({
      role: "system",
      content: trace.systemPrompt,
    });
  }

  conversation.messages.push({
    role: "user",
    content: trace.prompt,
  });

  for (const iteration of trace.iterations) {
    if (iteration.thinking) {
      conversation.messages.push({
        role: "assistant",
        content: `<thinking>${iteration.thinking}</thinking>`,
      });
    }

    for (const toolCall of iteration.toolCalls) {
      const toolCallId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      conversation.messages.push({
        role: "assistant",
        content: "",
        toolCalls: [
          {
            id: toolCallId,
            type: "function",
            function: {
              name: toolCall.name,
              arguments: JSON.stringify(toolCall.arguments),
            },
          },
        ],
      });

      conversation.messages.push({
        role: "tool",
        content: toolCall.result,
        name: toolCall.name,
        toolCallId,
      });
    }

    if (iteration.response) {
      conversation.messages.push({
        role: "assistant",
        content: iteration.response,
      });
    }
  }

  if (trace.finalResult) {
    conversation.messages.push({
      role: "assistant",
      content: trace.finalResult,
    });
  }

  if (conversation.messages.length < 3) return null;

  return {
    taskId,
    dataType: "conversation",
    input: JSON.stringify(conversation.messages.slice(0, -1)),
    output: JSON.stringify(
      conversation.messages[conversation.messages.length - 1]
    ),
    qualityScore: 0,
    metadata: {
      messageCount: conversation.messages.length,
      hasToolCalls: trace.iterations.some(it => it.toolCalls.length > 0),
    },
  };
}

function createToolUsageExamples(
  taskId: number,
  trace: TaskTrace
): TrainingExample[] {
  const examples: TrainingExample[] = [];

  for (const iteration of trace.iterations) {
    for (const toolCall of iteration.toolCalls) {
      const context = {
        task: trace.prompt,
        thinking: iteration.thinking || "",
      };

      examples.push({
        taskId,
        dataType: "tool_usage",
        input: JSON.stringify(context),
        output: JSON.stringify({
          tool: toolCall.name,
          arguments: toolCall.arguments,
        }),
        qualityScore: 0,
        metadata: {
          toolName: toolCall.name,
          resultLength: toolCall.result.length,
        },
      });
    }
  }

  return examples;
}

function createReasoningExample(
  taskId: number,
  trace: TaskTrace
): TrainingExample | null {
  const reasoningSteps = trace.iterations
    .filter(it => it.thinking && it.thinking.length > 50)
    .map(it => it.thinking);

  if (reasoningSteps.length === 0) return null;

  return {
    taskId,
    dataType: "reasoning",
    input: JSON.stringify({ task: trace.prompt }),
    output: JSON.stringify({
      steps: reasoningSteps,
      conclusion: trace.finalResult,
    }),
    qualityScore: 0,
    metadata: {
      stepCount: reasoningSteps.length,
    },
  };
}

export async function getTrainingData(
  filter: TrainingDataFilter
): Promise<TrainingExample[]> {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];

  if (filter.minQualityScore) {
    conditions.push(gte(trainingData.qualityScore, filter.minQualityScore));
  }

  if (filter.dataTypes && filter.dataTypes.length > 0) {
    conditions.push(inArray(trainingData.dataType, filter.dataTypes));
  }

  if (filter.taskIds && filter.taskIds.length > 0) {
    conditions.push(inArray(trainingData.taskId, filter.taskIds));
  }

  if (filter.afterDate) {
    conditions.push(gte(trainingData.createdAt, filter.afterDate));
  }

  if (filter.beforeDate) {
    conditions.push(lte(trainingData.createdAt, filter.beforeDate));
  }

  if (filter.excludeUsedForTraining) {
    conditions.push(eq(trainingData.usedForTraining, 0));
  }

  const query = db
    .select()
    .from(trainingData)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(trainingData.qualityScore));

  if (filter.limit) {
    query.limit(filter.limit);
  }

  const results = await query;

  return results.map(r => ({
    id: r.id,
    taskId: r.taskId,
    dataType: r.dataType as DataType,
    input: r.input,
    output: r.output,
    qualityScore: r.qualityScore,
    metadata: r.metadata ?? undefined,
    createdAt: r.createdAt ?? undefined,
  }));
}

export async function markDataAsUsed(
  ids: number[],
  trainingRunId: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db
    .update(trainingData)
    .set({
      usedForTraining: 1,
      trainingRunId,
    })
    .where(inArray(trainingData.id, ids));
}

export async function getDatasetStats(
  filter?: TrainingDataFilter
): Promise<DatasetStats> {
  const db = await getDb();
  if (!db) {
    return {
      totalExamples: 0,
      byDataType: {
        conversation: 0,
        tool_usage: 0,
        reasoning: 0,
        code_generation: 0,
        error_recovery: 0,
      },
      averageQualityScore: 0,
      averageInputLength: 0,
      averageOutputLength: 0,
      totalTokensEstimate: 0,
      oldestExample: new Date(),
      newestExample: new Date(),
    };
  }

  const data = await getTrainingData(filter ?? {});

  if (data.length === 0) {
    return {
      totalExamples: 0,
      byDataType: {
        conversation: 0,
        tool_usage: 0,
        reasoning: 0,
        code_generation: 0,
        error_recovery: 0,
      },
      averageQualityScore: 0,
      averageInputLength: 0,
      averageOutputLength: 0,
      totalTokensEstimate: 0,
      oldestExample: new Date(),
      newestExample: new Date(),
    };
  }

  const byDataType: Record<DataType, number> = {
    conversation: 0,
    tool_usage: 0,
    reasoning: 0,
    code_generation: 0,
    error_recovery: 0,
  };

  let totalQuality = 0;
  let totalInputLen = 0;
  let totalOutputLen = 0;
  let oldest = new Date();
  let newest = new Date(0);

  for (const example of data) {
    byDataType[example.dataType]++;
    totalQuality += example.qualityScore;
    totalInputLen += example.input.length;
    totalOutputLen += example.output.length;

    if (example.createdAt) {
      if (example.createdAt < oldest) oldest = example.createdAt;
      if (example.createdAt > newest) newest = example.createdAt;
    }
  }

  const totalChars = totalInputLen + totalOutputLen;
  const tokensEstimate = Math.floor(totalChars / 4);

  return {
    totalExamples: data.length,
    byDataType,
    averageQualityScore: Math.round(totalQuality / data.length),
    averageInputLength: Math.round(totalInputLen / data.length),
    averageOutputLength: Math.round(totalOutputLen / data.length),
    totalTokensEstimate: tokensEstimate,
    oldestExample: oldest,
    newestExample: newest,
  };
}

export async function exportToJsonl(
  filter: TrainingDataFilter,
  outputPath: string
): Promise<number> {
  const fs = await import("fs/promises");
  const data = await getTrainingData(filter);

  const lines: string[] = [];
  for (const example of data) {
    let parsedInput: unknown;
    let parsedOutput: unknown;

    try {
      parsedInput = JSON.parse(example.input);
    } catch {
      parsedInput = example.input;
    }

    try {
      parsedOutput = JSON.parse(example.output);
    } catch {
      parsedOutput = example.output;
    }

    const jsonlEntry = {
      messages: Array.isArray(parsedInput)
        ? [...parsedInput, parsedOutput]
        : [
            { role: "user", content: JSON.stringify(parsedInput) },
            { role: "assistant", content: JSON.stringify(parsedOutput) },
          ],
    };

    lines.push(JSON.stringify(jsonlEntry));
  }

  await fs.writeFile(outputPath, lines.join("\n"), "utf-8");
  return data.length;
}
