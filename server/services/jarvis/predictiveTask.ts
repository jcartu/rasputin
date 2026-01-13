import { getDb } from "../../db";
import { agentTasks } from "../../../drizzle/schema";
import { eq, desc, and, gte } from "drizzle-orm";
import { getMemoryService } from "../memory";

export interface TaskPattern {
  pattern: string;
  frequency: number;
  lastOccurrence: Date;
  averageInterval: number;
  contextTriggers: string[];
  confidence: number;
}

export interface PredictedTask {
  taskDescription: string;
  confidence: number;
  triggerReason: string;
  suggestedTime?: Date;
  relatedPatterns: string[];
}

export interface UserTaskContext {
  recentTasks: string[];
  timeOfDay: string;
  dayOfWeek: string;
  recentTopics: string[];
}

const TIME_WINDOWS = {
  morning: { start: 6, end: 12 },
  afternoon: { start: 12, end: 17 },
  evening: { start: 17, end: 21 },
  night: { start: 21, end: 6 },
};

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour >= TIME_WINDOWS.morning.start && hour < TIME_WINDOWS.morning.end)
    return "morning";
  if (hour >= TIME_WINDOWS.afternoon.start && hour < TIME_WINDOWS.afternoon.end)
    return "afternoon";
  if (hour >= TIME_WINDOWS.evening.start && hour < TIME_WINDOWS.evening.end)
    return "evening";
  return "night";
}

function getDayOfWeek(): string {
  const days = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  return days[new Date().getDay()];
}

export async function analyzeTaskPatterns(
  userId: number
): Promise<TaskPattern[]> {
  const db = await getDb();
  if (!db) return [];

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentTasks = await db
    .select({
      query: agentTasks.query,
      createdAt: agentTasks.createdAt,
      status: agentTasks.status,
    })
    .from(agentTasks)
    .where(
      and(
        eq(agentTasks.userId, userId),
        gte(agentTasks.createdAt, thirtyDaysAgo)
      )
    )
    .orderBy(desc(agentTasks.createdAt))
    .limit(200);

  if (recentTasks.length < 5) return [];

  const patternMap = new Map<
    string,
    { count: number; dates: Date[]; keywords: Set<string> }
  >();

  for (const task of recentTasks) {
    const normalized = normalizeTaskPrompt(task.query);
    const pattern = extractPattern(normalized);

    if (!patternMap.has(pattern)) {
      patternMap.set(pattern, { count: 0, dates: [], keywords: new Set() });
    }

    const entry = patternMap.get(pattern)!;
    entry.count++;
    if (task.createdAt) entry.dates.push(new Date(task.createdAt));
    extractKeywords(task.query).forEach(kw => entry.keywords.add(kw));
  }

  const patterns: TaskPattern[] = [];

  for (const [pattern, data] of Array.from(patternMap.entries())) {
    if (data.count < 2) continue;

    const sortedDates = data.dates.sort(
      (a: Date, b: Date) => a.getTime() - b.getTime()
    );
    let totalInterval = 0;
    for (let i = 1; i < sortedDates.length; i++) {
      totalInterval += sortedDates[i].getTime() - sortedDates[i - 1].getTime();
    }
    const averageInterval =
      sortedDates.length > 1
        ? totalInterval / (sortedDates.length - 1)
        : 24 * 60 * 60 * 1000;

    const frequency = data.count / 30;
    const confidence = Math.min(
      0.95,
      (data.count / recentTasks.length) * 2 + frequency * 0.5
    );

    patterns.push({
      pattern,
      frequency,
      lastOccurrence: sortedDates[sortedDates.length - 1],
      averageInterval,
      contextTriggers: Array.from(data.keywords),
      confidence,
    });
  }

  return patterns.sort((a, b) => b.confidence - a.confidence).slice(0, 20);
}

export async function predictNextTasks(
  userId: number,
  context?: Partial<UserTaskContext>
): Promise<PredictedTask[]> {
  const patterns = await analyzeTaskPatterns(userId);
  if (patterns.length === 0) return [];

  const now = new Date();
  const timeOfDay = context?.timeOfDay || getTimeOfDay();
  const dayOfWeek = context?.dayOfWeek || getDayOfWeek();

  const predictions: PredictedTask[] = [];

  for (const pattern of patterns) {
    const timeSinceLastTask = now.getTime() - pattern.lastOccurrence.getTime();
    const expectedNextTime =
      pattern.lastOccurrence.getTime() + pattern.averageInterval;

    const timeRelevance =
      timeSinceLastTask >= pattern.averageInterval * 0.8 ? 0.3 : 0;
    const frequencyBonus =
      pattern.frequency > 0.5 ? 0.2 : pattern.frequency > 0.2 ? 0.1 : 0;

    const adjustedConfidence = Math.min(
      0.95,
      pattern.confidence + timeRelevance + frequencyBonus
    );

    if (adjustedConfidence < 0.3) continue;

    let triggerReason = `Pattern detected: ${pattern.pattern}`;
    if (timeSinceLastTask >= pattern.averageInterval) {
      triggerReason = `Recurring task overdue (avg interval: ${formatInterval(pattern.averageInterval)})`;
    } else if (pattern.frequency > 0.5) {
      triggerReason = `Frequent task (${(pattern.frequency * 30).toFixed(0)} times/month)`;
    }

    predictions.push({
      taskDescription: expandPattern(pattern.pattern),
      confidence: adjustedConfidence,
      triggerReason,
      suggestedTime:
        timeSinceLastTask < pattern.averageInterval
          ? new Date(expectedNextTime)
          : undefined,
      relatedPatterns: pattern.contextTriggers.slice(0, 5),
    });
  }

  const contextMatches = await findContextualPredictions(userId, {
    timeOfDay,
    dayOfWeek,
    recentTopics: context?.recentTopics || [],
    recentTasks: context?.recentTasks || [],
  });

  predictions.push(...contextMatches);

  return predictions.sort((a, b) => b.confidence - a.confidence).slice(0, 10);
}

async function findContextualPredictions(
  userId: number,
  context: UserTaskContext
): Promise<PredictedTask[]> {
  const memoryService = getMemoryService();
  const predictions: PredictedTask[] = [];

  if (context.recentTopics.length > 0) {
    const query = context.recentTopics.join(" ");
    const relatedMemories = await memoryService.search({
      query,
      userId,
      limit: 5,
      memoryTypes: ["procedural"],
    });

    for (const mem of relatedMemories) {
      if (mem.memory && "name" in mem.memory) {
        predictions.push({
          taskDescription: `Follow up: ${mem.memory.name}`,
          confidence: Math.min(0.7, mem.relevanceScore * 0.8),
          triggerReason: `Related to recent topic: ${context.recentTopics[0]}`,
          relatedPatterns: context.recentTopics,
        });
      }
    }
  }

  return predictions;
}

function normalizeTaskPrompt(prompt: string): string {
  return prompt
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractPattern(normalized: string): string {
  const actionVerbs = [
    "create",
    "generate",
    "write",
    "build",
    "analyze",
    "research",
    "search",
    "find",
    "update",
    "fix",
    "deploy",
    "test",
    "review",
    "summarize",
    "report",
  ];

  const words = normalized.split(" ");
  const patternParts: string[] = [];

  for (const word of words) {
    if (actionVerbs.includes(word)) {
      patternParts.push(word);
    } else if (word.length > 4 && !isCommonWord(word)) {
      patternParts.push(word);
    }

    if (patternParts.length >= 4) break;
  }

  return patternParts.join(" ") || normalized.slice(0, 50);
}

function extractKeywords(prompt: string): string[] {
  const words = prompt
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/);
  return words.filter(w => w.length > 3 && !isCommonWord(w)).slice(0, 10);
}

function isCommonWord(word: string): boolean {
  const common = new Set([
    "the",
    "and",
    "for",
    "that",
    "with",
    "this",
    "from",
    "have",
    "will",
    "about",
    "what",
    "when",
    "where",
    "which",
    "their",
    "there",
    "would",
    "could",
    "should",
    "please",
    "need",
    "want",
    "like",
    "just",
    "more",
    "some",
    "make",
    "into",
    "been",
    "also",
    "than",
    "them",
    "then",
    "your",
  ]);
  return common.has(word);
}

function expandPattern(pattern: string): string {
  const words = pattern.split(" ");
  const verb = words[0];

  const verbExpansions: Record<string, string> = {
    create: "Create/generate",
    generate: "Generate/create",
    write: "Write/compose",
    build: "Build/develop",
    analyze: "Analyze/examine",
    research: "Research/investigate",
    search: "Search for",
    find: "Find/locate",
    update: "Update/modify",
    fix: "Fix/resolve",
    deploy: "Deploy/release",
    test: "Test/verify",
    review: "Review/check",
    summarize: "Summarize/recap",
    report: "Report on/document",
  };

  if (verbExpansions[verb]) {
    words[0] = verbExpansions[verb];
  }

  return words.join(" ");
}

function formatInterval(ms: number): string {
  const hours = ms / (1000 * 60 * 60);
  if (hours < 24) return `${Math.round(hours)} hours`;
  const days = hours / 24;
  if (days < 7) return `${Math.round(days)} days`;
  const weeks = days / 7;
  return `${Math.round(weeks)} weeks`;
}

export async function getSuggestedTasks(userId: number): Promise<
  Array<{
    suggestion: string;
    confidence: number;
    reason: string;
  }>
> {
  const predictions = await predictNextTasks(userId);
  return predictions.map(p => ({
    suggestion: p.taskDescription,
    confidence: p.confidence,
    reason: p.triggerReason,
  }));
}

export async function recordTaskForLearning(
  userId: number,
  prompt: string,
  wasSuccessful: boolean,
  _duration?: number
): Promise<void> {
  const memoryService = getMemoryService();

  if (wasSuccessful) {
    const pattern = extractPattern(normalizeTaskPrompt(prompt));
    const keywords = extractKeywords(prompt);

    await memoryService.createEpisodicMemory({
      userId,
      title: `Successful task: ${pattern}`,
      description: `User performed task: ${prompt.slice(0, 200)}`,
      memoryType: "task_success",
      context: JSON.stringify({ pattern, keywords }),
      importance: 50,
    });
  }
}
