import { getDb } from "../db";
import { knowledgeCache } from "../../drizzle/schema";
import { eq, and, desc, sql, gt } from "drizzle-orm";
import * as crypto from "crypto";

type CacheSource =
  | "web_search"
  | "searxng"
  | "browse"
  | "api"
  | "documentation"
  | "llm_response";

function generateCacheKey(query: string, source: CacheSource): string {
  const hash = crypto.createHash("sha256");
  hash.update(`${source}:${query.toLowerCase().trim()}`);
  return hash.digest("hex").substring(0, 32);
}

export async function getCachedResult(
  query: string,
  source: CacheSource,
  maxAgeHours: number = 24
): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;

  const cacheKey = generateCacheKey(query, source);
  const minTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

  const results = await db
    .select()
    .from(knowledgeCache)
    .where(
      and(
        eq(knowledgeCache.cacheKey, cacheKey),
        gt(knowledgeCache.createdAt, minTime)
      )
    )
    .limit(1);

  if (results.length === 0) return null;

  await db
    .update(knowledgeCache)
    .set({
      hitCount: sql`${knowledgeCache.hitCount} + 1`,
      lastAccessedAt: new Date(),
    })
    .where(eq(knowledgeCache.id, results[0].id));

  return results[0].content;
}

export async function setCachedResult(
  query: string,
  source: CacheSource,
  content: string,
  userId?: number,
  metadata?: Record<string, unknown>,
  ttlHours: number = 168
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const cacheKey = generateCacheKey(query, source);
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  const existing = await db
    .select({ id: knowledgeCache.id })
    .from(knowledgeCache)
    .where(eq(knowledgeCache.cacheKey, cacheKey))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(knowledgeCache)
      .set({
        content,
        metadata,
        expiresAt,
        lastAccessedAt: new Date(),
      })
      .where(eq(knowledgeCache.id, existing[0].id));
  } else {
    await db.insert(knowledgeCache).values({
      userId,
      cacheKey,
      query,
      source,
      content,
      metadata,
      expiresAt,
      hitCount: 0,
    });
  }
}

export async function searchCache(
  searchQuery: string,
  limit: number = 5
): Promise<Array<{ query: string; content: string; source: string }>> {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      query: knowledgeCache.query,
      content: knowledgeCache.content,
      source: knowledgeCache.source,
    })
    .from(knowledgeCache)
    .where(sql`${knowledgeCache.query} LIKE ${`%${searchQuery}%`}`)
    .orderBy(desc(knowledgeCache.hitCount))
    .limit(limit);

  return results;
}

export async function cleanupExpiredCache(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const result = await db
    .delete(knowledgeCache)
    .where(
      and(
        sql`${knowledgeCache.expiresAt} IS NOT NULL`,
        sql`${knowledgeCache.expiresAt} < NOW()`
      )
    );

  return result[0]?.affectedRows || 0;
}

export async function getCacheStats(): Promise<{
  totalEntries: number;
  totalHits: number;
  bySource: Record<string, number>;
}> {
  const db = await getDb();
  if (!db) {
    return { totalEntries: 0, totalHits: 0, bySource: {} };
  }

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(knowledgeCache);

  const hitsResult = await db
    .select({ total: sql<number>`COALESCE(SUM(hitCount), 0)` })
    .from(knowledgeCache);

  const bySourceResult = await db
    .select({
      source: knowledgeCache.source,
      count: sql<number>`count(*)`,
    })
    .from(knowledgeCache)
    .groupBy(knowledgeCache.source);

  const bySource: Record<string, number> = {};
  for (const row of bySourceResult) {
    bySource[row.source] = row.count;
  }

  return {
    totalEntries: countResult[0]?.count || 0,
    totalHits: hitsResult[0]?.total || 0,
    bySource,
  };
}

export function generateLLMCacheKey(
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>
): string {
  const hash = crypto.createHash("sha256");
  const msgSummary = messages
    .map(m => `${m.role}:${m.content.slice(0, 500)}`)
    .join("|");
  hash.update(`llm:${systemPrompt.slice(0, 200)}:${msgSummary}`);
  return hash.digest("hex").substring(0, 32);
}

export async function getCachedLLMResponse(
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  maxAgeMinutes: number = 30
): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;

  const cacheKey = generateLLMCacheKey(systemPrompt, messages);
  const minTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000);

  const results = await db
    .select()
    .from(knowledgeCache)
    .where(
      and(
        eq(knowledgeCache.cacheKey, cacheKey),
        eq(knowledgeCache.source, "llm_response"),
        gt(knowledgeCache.createdAt, minTime)
      )
    )
    .limit(1);

  if (results.length === 0) return null;

  await db
    .update(knowledgeCache)
    .set({
      hitCount: sql`${knowledgeCache.hitCount} + 1`,
      lastAccessedAt: new Date(),
    })
    .where(eq(knowledgeCache.id, results[0].id));

  console.info("[LLMCache] Cache hit for orchestrator response");
  return results[0].content;
}

export async function setCachedLLMResponse(
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  response: string,
  ttlMinutes: number = 60
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const cacheKey = generateLLMCacheKey(systemPrompt, messages);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
  const query = messages
    .map(m => m.content)
    .join(" ")
    .slice(0, 500);

  const existing = await db
    .select({ id: knowledgeCache.id })
    .from(knowledgeCache)
    .where(eq(knowledgeCache.cacheKey, cacheKey))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(knowledgeCache)
      .set({
        content: response,
        expiresAt,
        lastAccessedAt: new Date(),
      })
      .where(eq(knowledgeCache.id, existing[0].id));
  } else {
    await db.insert(knowledgeCache).values({
      cacheKey,
      query,
      source: "llm_response",
      content: response,
      expiresAt,
      hitCount: 0,
    });
  }
}
