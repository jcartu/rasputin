import { QdrantClient } from "@qdrant/js-client-rest";

const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333";
const VECTOR_SIZE = process.env.OPENAI_API_KEY ? 1536 : 768;

let qdrantClient: QdrantClient | null = null;

function getClient(): QdrantClient {
  if (!qdrantClient) {
    qdrantClient = new QdrantClient({ url: QDRANT_URL });
  }
  return qdrantClient;
}

function getCollectionName(userId: number): string {
  return `user_${userId}_memories`;
}

export async function ensureUserCollection(userId: number): Promise<string> {
  const client = getClient();
  const collectionName = getCollectionName(userId);

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
        field_name: "memoryType",
        field_schema: "keyword",
      });

      await client.createPayloadIndex(collectionName, {
        field_name: "memoryId",
        field_schema: "integer",
      });

      console.info(`[Qdrant] Created collection: ${collectionName}`);
    }

    return collectionName;
  } catch (error) {
    console.error(
      `[Qdrant] Failed to ensure collection for user ${userId}:`,
      error
    );
    throw error;
  }
}

export interface MemoryPayload {
  memoryType: "episodic" | "semantic" | "procedural";
  memoryId: number;
  sourceText: string;
  title?: string;
  subject?: string;
  predicate?: string;
  object?: string;
  createdAt: string;
}

export async function upsertVector(
  userId: number,
  id: string,
  vector: number[],
  payload: MemoryPayload
): Promise<void> {
  const client = getClient();
  const collectionName = await ensureUserCollection(userId);

  await client.upsert(collectionName, {
    wait: true,
    points: [
      {
        id,
        vector,
        payload: payload as unknown as Record<string, unknown>,
      },
    ],
  });
}

export async function searchVectors(
  userId: number,
  queryVector: number[],
  options: {
    limit?: number;
    memoryTypes?: Array<"episodic" | "semantic" | "procedural">;
    scoreThreshold?: number;
  } = {}
): Promise<Array<{ id: string; score: number; payload: MemoryPayload }>> {
  const client = getClient();
  const collectionName = await ensureUserCollection(userId);

  const { limit = 10, memoryTypes, scoreThreshold = 0.3 } = options;

  const filter: { must: Array<{ key: string; match: { any: string[] } }> } = {
    must: [],
  };

  if (memoryTypes && memoryTypes.length > 0) {
    filter.must.push({
      key: "memoryType",
      match: { any: memoryTypes },
    });
  }

  const results = await client.search(collectionName, {
    vector: queryVector,
    limit,
    score_threshold: scoreThreshold,
    filter: filter.must.length > 0 ? filter : undefined,
    with_payload: true,
  });

  return results.map(r => ({
    id: r.id as string,
    score: r.score,
    payload: r.payload as unknown as MemoryPayload,
  }));
}

export async function deleteVector(userId: number, id: string): Promise<void> {
  const client = getClient();
  const collectionName = getCollectionName(userId);

  try {
    await client.delete(collectionName, {
      wait: true,
      points: [id],
    });
  } catch {
    void 0;
  }
}

export async function deleteByMemoryId(
  userId: number,
  memoryType: string,
  memoryId: number
): Promise<void> {
  const client = getClient();
  const collectionName = getCollectionName(userId);

  try {
    await client.delete(collectionName, {
      wait: true,
      filter: {
        must: [
          { key: "memoryType", match: { value: memoryType } },
          { key: "memoryId", match: { value: memoryId } },
        ],
      },
    });
  } catch {
    void 0;
  }
}

export async function getUserCollectionInfo(userId: number): Promise<{
  vectorCount: number;
  status: string;
}> {
  const client = getClient();
  const collectionName = getCollectionName(userId);

  try {
    const info = await client.getCollection(collectionName);
    return {
      vectorCount: info.points_count || 0,
      status: info.status,
    };
  } catch {
    return { vectorCount: 0, status: "not_created" };
  }
}

export async function deleteUserCollection(userId: number): Promise<void> {
  const client = getClient();
  const collectionName = getCollectionName(userId);

  try {
    await client.deleteCollection(collectionName);
    console.info(`[Qdrant] Deleted collection: ${collectionName}`);
  } catch {
    void 0;
  }
}

export async function listAllCollections(): Promise<string[]> {
  const client = getClient();
  const collections = await client.getCollections();
  return collections.collections.map(c => c.name);
}
