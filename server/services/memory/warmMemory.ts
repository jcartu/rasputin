import { getDb } from "../../db";
import { episodicMemories, semanticMemories } from "../../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { getOllamaClient } from "../localLLM/ollama";
import { getVLLMClient } from "../localLLM/vllm";

const SUMMARY_MODEL = "llama-4-70b-awq";
const BATCH_SIZE = 10;
const SUMMARY_MAX_TOKENS = 512;

interface MemoryForSummary {
  id: number;
  title: string;
  description: string;
  memoryType: string;
  createdAt: Date;
}

interface ExtractedKnowledge {
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  category:
    | "system_info"
    | "user_info"
    | "domain_knowledge"
    | "api_info"
    | "file_structure"
    | "configuration"
    | "relationship"
    | "definition";
}

async function extractKnowledgeWithLocalLLM(
  memories: MemoryForSummary[]
): Promise<ExtractedKnowledge[]> {
  const memoryText = memories
    .map(
      (m, i) =>
        `${i + 1}. [${m.memoryType}] ${m.title || "Untitled"}\n   ${(m.description || "").slice(0, 500)}`
    )
    .join("\n\n");

  const prompt = `Extract structured knowledge from these memories as subject-predicate-object triples.

MEMORIES:
${memoryText}

Extract key facts as JSON array:
[
  {
    "subject": "entity or concept",
    "predicate": "relationship or attribute",
    "object": "value or related entity",
    "confidence": 0-100,
    "category": "system_info|user_info|domain_knowledge|api_info|file_structure|configuration|relationship|definition"
  }
]

Focus on extracting:
- User preferences and patterns
- System configurations discovered
- Successful approaches and solutions
- Error patterns and resolutions

Return at most 5 high-value facts.`;

  let response: string;

  try {
    const vllmClient = getVLLMClient();
    if (await vllmClient.isHealthy()) {
      const result = await vllmClient.chat({
        model: SUMMARY_MODEL,
        messages: [{ role: "user", content: prompt }],
        maxTokens: SUMMARY_MAX_TOKENS,
        temperature: 0.3,
        responseFormat: { type: "json_object" },
      });
      response = result.choices[0]?.message.content || "[]";
    } else {
      const ollamaClient = getOllamaClient();
      if (await ollamaClient.isHealthy()) {
        const result = await ollamaClient.chat({
          model: "llama3.3:70b",
          messages: [{ role: "user", content: prompt }],
          maxTokens: SUMMARY_MAX_TOKENS,
          temperature: 0.3,
          responseFormat: { type: "json_object" },
        });
        response = result.choices[0]?.message.content || "[]";
      } else {
        console.warn("[WarmMemory] No local LLM available");
        return [];
      }
    }

    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (k: unknown) =>
        k &&
        typeof k === "object" &&
        "subject" in k &&
        "predicate" in k &&
        "object" in k
    ) as ExtractedKnowledge[];
  } catch (error) {
    console.error("[WarmMemory] Failed to extract knowledge:", error);
    return [];
  }
}

export async function consolidateMemories(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const recentMemories = await db
    .select({
      id: episodicMemories.id,
      title: episodicMemories.title,
      description: episodicMemories.description,
      memoryType: episodicMemories.memoryType,
      createdAt: episodicMemories.createdAt,
    })
    .from(episodicMemories)
    .where(eq(episodicMemories.userId, userId))
    .orderBy(desc(episodicMemories.createdAt))
    .limit(BATCH_SIZE * 3);

  if (recentMemories.length < 3) {
    return 0;
  }

  const batches: (typeof recentMemories)[] = [];
  for (let i = 0; i < recentMemories.length; i += BATCH_SIZE) {
    batches.push(recentMemories.slice(i, i + BATCH_SIZE));
  }

  let knowledgeCreated = 0;

  for (const batch of batches) {
    try {
      const knowledge = await extractKnowledgeWithLocalLLM(batch);

      for (const k of knowledge) {
        await db.insert(semanticMemories).values({
          userId,
          category: k.category,
          subject: k.subject,
          predicate: k.predicate,
          object: k.object,
          confidence: k.confidence,
          source: "memory_consolidation",
        });
        knowledgeCreated++;
      }
    } catch (error) {
      console.error(
        `[WarmMemory] Failed to process batch of ${batch.length} memories:`,
        error
      );
    }
  }

  console.info(
    `[WarmMemory] Created ${knowledgeCreated} semantic facts for user ${userId}`
  );
  return knowledgeCreated;
}

export async function getWarmContext(
  userId: number,
  _query: string,
  limit: number = 5
): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];

  const semanticFacts = await db
    .select({
      subject: semanticMemories.subject,
      predicate: semanticMemories.predicate,
      object: semanticMemories.object,
      category: semanticMemories.category,
      confidence: semanticMemories.confidence,
    })
    .from(semanticMemories)
    .where(eq(semanticMemories.userId, userId))
    .orderBy(desc(semanticMemories.confidence))
    .limit(limit);

  return semanticFacts.map(
    f =>
      `[${f.category}] ${f.subject} ${f.predicate} ${f.object} (${f.confidence}%)`
  );
}

export async function runMemoryConsolidationJob(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const users = await db
    .selectDistinct({ userId: episodicMemories.userId })
    .from(episodicMemories);

  for (const user of users) {
    if (user.userId === null) continue;
    try {
      await consolidateMemories(user.userId);
    } catch (error) {
      console.error(`[WarmMemory] Failed for user ${user.userId}:`, error);
    }
  }
}
