import { QdrantClient as QdrantRestClient } from "@qdrant/js-client-rest";
import type { QdrantClient, QdrantSearchResult } from "./types";

const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333";
const VECTOR_SIZE = 1536;

let qdrantRestClient: QdrantRestClient | null = null;

function getRestClient(): QdrantRestClient {
  if (!qdrantRestClient) {
    qdrantRestClient = new QdrantRestClient({ url: QDRANT_URL });
  }
  return qdrantRestClient;
}

function getToolCollectionName(baseCollection: string, userId: number): string {
  return `jarvis_${userId}_${baseCollection}`;
}

async function ensureCollection(collectionName: string): Promise<void> {
  const client = getRestClient();

  try {
    const collections = await client.getCollections();
    const exists = collections.collections.some(c => c.name === collectionName);

    if (!exists) {
      await client.createCollection(collectionName, {
        vectors: {
          size: VECTOR_SIZE,
          distance: "Cosine",
        },
      });

      await client.createPayloadIndex(collectionName, {
        field_name: "toolName",
        field_schema: "keyword",
      });

      await client.createPayloadIndex(collectionName, {
        field_name: "taskId",
        field_schema: "integer",
      });

      await client.createPayloadIndex(collectionName, {
        field_name: "timestamp",
        field_schema: "integer",
      });
    }
  } catch (error) {
    console.error(
      `[Qdrant] Failed to ensure collection ${collectionName}:`,
      error
    );
  }
}

export class V3QdrantClient implements QdrantClient {
  private userId: number;
  private collectionCache: Set<string> = new Set();

  constructor(userId: number) {
    this.userId = userId;
  }

  async search(
    collection: string,
    query: {
      vector: number[];
      filter?: Record<string, unknown>;
      limit?: number;
    }
  ): Promise<QdrantSearchResult[]> {
    const client = getRestClient();
    const collectionName = getToolCollectionName(collection, this.userId);

    if (!this.collectionCache.has(collectionName)) {
      await ensureCollection(collectionName);
      this.collectionCache.add(collectionName);
    }

    try {
      const results = await client.search(collectionName, {
        vector: query.vector,
        limit: query.limit || 10,
        filter: query.filter as Parameters<typeof client.search>[1]["filter"],
        with_payload: true,
      });

      return results.map(r => ({
        id: String(r.id),
        score: r.score,
        payload: (r.payload || {}) as Record<string, unknown>,
      }));
    } catch (error) {
      console.error(`[Qdrant] Search failed in ${collectionName}:`, error);
      return [];
    }
  }

  async upsert(
    collection: string,
    point: {
      id: string;
      vector: number[];
      payload: Record<string, unknown>;
    }
  ): Promise<void> {
    const client = getRestClient();
    const collectionName = getToolCollectionName(collection, this.userId);

    if (!this.collectionCache.has(collectionName)) {
      await ensureCollection(collectionName);
      this.collectionCache.add(collectionName);
    }

    try {
      await client.upsert(collectionName, {
        wait: true,
        points: [
          {
            id: point.id,
            vector: point.vector,
            payload: point.payload,
          },
        ],
      });
    } catch (error) {
      console.error(`[Qdrant] Upsert failed in ${collectionName}:`, error);
    }
  }

  async delete(collection: string, ids: string[]): Promise<void> {
    const client = getRestClient();
    const collectionName = getToolCollectionName(collection, this.userId);

    try {
      await client.delete(collectionName, {
        wait: true,
        points: ids,
      });
    } catch (error) {
      console.error(`[Qdrant] Delete failed in ${collectionName}:`, error);
    }
  }
}

const globalQdrantClients: Map<number, V3QdrantClient> = new Map();

export function getGlobalQdrantClient(userId: number): QdrantClient {
  let client = globalQdrantClients.get(userId);
  if (!client) {
    client = new V3QdrantClient(userId);
    globalQdrantClients.set(userId, client);
  }
  return client;
}

export function resetGlobalQdrantClients(): void {
  globalQdrantClients.clear();
}

export function createNoOpQdrantClient(): QdrantClient {
  return {
    search: async () => [],
    upsert: async () => {},
    delete: async () => {},
  };
}
