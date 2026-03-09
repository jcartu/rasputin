import { Embedder } from '../rag/embedders/index.js';
import { QdrantStore } from '../rag/vectorStores/qdrant.js';

const COLLECTION_NAME = 'alfie_documents';
const EMBEDDING_MODEL = 'text-embedding-3-small';
const SCORE_THRESHOLD = 0.7;

let embedder = null;
let vectorStore = null;
let initializePromise = null;

function chunkText(text, chunkSize = 1000, overlap = 200) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end);
    if (chunk.trim()) {
      chunks.push(chunk);
    }
    start += chunkSize - overlap;
  }
  return chunks;
}

async function ensureInitialized() {
  if (embedder && vectorStore) {
    return { embedder, vectorStore };
  }

  if (!initializePromise) {
    initializePromise = (async () => {
      embedder = new Embedder({ model: EMBEDDING_MODEL });
      await embedder.initialize();

      vectorStore = new QdrantStore({
        collectionName: COLLECTION_NAME,
        dimensions: embedder.getDimensions(),
      });
      await vectorStore.initialize(embedder.getDimensions());

      return { embedder, vectorStore };
    })();
  }

  return initializePromise;
}

export async function initialize() {
  return ensureInitialized();
}

export async function embedDocument(documentId, text, metadata = {}) {
  if (!documentId) {
    throw new Error('documentId is required');
  }
  if (!text || !text.trim()) {
    throw new Error('text is required');
  }

  const { embedder: activeEmbedder, vectorStore: activeStore } = await ensureInitialized();

  const chunks = chunkText(text);
  if (chunks.length === 0) {
    return { success: true, documentId, chunks: 0 };
  }

  const embeddings = await activeEmbedder.embedBatch(chunks);
  const timestamp = new Date().toISOString();

  const vectors = chunks.map((chunk, index) => ({
    id: `${documentId}:${index}`,
    vector: embeddings[index],
    metadata: {
      ...metadata,
      documentId,
      chunkIndex: index,
      text: chunk,
      source: metadata?.source || metadata?.path || metadata?.filename,
      timestamp,
    },
  }));

  const result = await activeStore.upsert(vectors);
  return { success: true, documentId, chunks: chunks.length, result };
}

export async function retrieveContext(query, topK = 5) {
  if (!query || !query.trim()) {
    return [];
  }

  const { embedder: activeEmbedder, vectorStore: activeStore } = await ensureInitialized();

  const vectorCount = await activeStore.count();
  if (vectorCount === 0) {
    return [];
  }

  const queryVector = await activeEmbedder.embedQuery(query);
  const results = await activeStore.search(queryVector, {
    topK,
    scoreThreshold: SCORE_THRESHOLD,
    includeMetadata: true,
  });

  return results
    .filter(result => result.score >= SCORE_THRESHOLD && result.metadata?.text)
    .map(result => ({
      text: result.metadata.text,
      score: result.score,
      metadata: result.metadata,
    }));
}

export async function deleteDocument(documentId) {
  if (!documentId) {
    throw new Error('documentId is required');
  }

  const { vectorStore: activeStore } = await ensureInitialized();
  const result = await activeStore.deleteByFilter({ documentId });
  return { success: true, documentId, result };
}

export async function healthCheck() {
  if (!vectorStore) {
    vectorStore = new QdrantStore({ collectionName: COLLECTION_NAME });
  }
  return vectorStore.healthCheck();
}

export default {
  initialize,
  embedDocument,
  retrieveContext,
  deleteDocument,
  healthCheck,
};
