/**
 * Embeddings Service
 * Generates vector embeddings for code chunks using OpenAI or fallback to pseudo-embeddings
 */

const embeddingCache = new Map<string, number[]>();
const MAX_CACHE_SIZE = 10000;

async function callOpenAIEmbedding(
  text: string,
  model: string
): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: text.slice(0, 8000),
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI embedding failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

async function callOllamaEmbedding(text: string): Promise<number[]> {
  const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";

  const response = await fetch(`${ollamaUrl}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "nomic-embed-text",
      prompt: text.slice(0, 8000),
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama embedding failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.embedding;
}

export async function generateEmbedding(
  text: string,
  model: string = "text-embedding-3-small"
): Promise<number[]> {
  const cacheKey = `${model}:${hashText(text)}`;
  const cached = embeddingCache.get(cacheKey);
  if (cached) return cached;

  let embedding: number[];

  try {
    if (process.env.OPENAI_API_KEY) {
      embedding = await callOpenAIEmbedding(text, model);
    } else {
      embedding = await callOllamaEmbedding(text);
    }
  } catch (error) {
    console.warn("[Embeddings] API embedding failed, using fallback:", error);
    embedding = generatePseudoEmbedding(text);
  }

  // Normalize embedding for cosine similarity
  embedding = normalizeEmbedding(embedding);

  if (embeddingCache.size >= MAX_CACHE_SIZE) {
    const keysToDelete = Array.from(embeddingCache.keys()).slice(0, 1000);
    keysToDelete.forEach(k => embeddingCache.delete(k));
  }
  embeddingCache.set(cacheKey, embedding);

  return embedding;
}

/**
 * Normalize embedding to unit length for cosine similarity
 */
function normalizeEmbedding(embedding: number[]): number[] {
  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (norm === 0) return embedding;
  return embedding.map(val => val / norm);
}

/**
 * Generate embeddings for multiple texts in batch
 */
export async function generateEmbeddings(
  texts: string[],
  model: string = "text-embedding-3-small"
): Promise<number[][]> {
  return Promise.all(texts.map(text => generateEmbedding(text, model)));
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

/**
 * Find top-k most similar embeddings
 */
export function findTopK(
  queryEmbedding: number[],
  embeddings: Array<{ id: number; embedding: number[] }>,
  k: number = 10
): Array<{ id: number; score: number }> {
  const scores = embeddings.map(item => ({
    id: item.id,
    score: cosineSimilarity(queryEmbedding, item.embedding),
  }));

  return scores.sort((a, b) => b.score - a.score).slice(0, k);
}

/**
 * Generate a pseudo-embedding based on text features
 * This is a placeholder - in production, use actual embedding models
 */
function generatePseudoEmbedding(text: string): number[] {
  const dimension = 1536;
  const embedding = new Array(dimension).fill(0);

  // Normalize text
  const normalized = text.toLowerCase();

  // Character-based features
  for (let i = 0; i < normalized.length; i++) {
    const charCode = normalized.charCodeAt(i);
    const idx = (charCode * (i + 1)) % dimension;
    embedding[idx] += 1 / Math.sqrt(normalized.length);
  }

  // Word-based features
  const words = normalized.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const hash = hashWord(word);
    const idx = hash % dimension;
    embedding[idx] += 1 / Math.sqrt(words.length);

    // Bigram features
    if (i > 0) {
      const bigram = words[i - 1] + " " + word;
      const bigramHash = hashWord(bigram);
      const bigramIdx = bigramHash % dimension;
      embedding[bigramIdx] += 0.5 / Math.sqrt(words.length);
    }
  }

  // Normalize the embedding
  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (norm > 0) {
    for (let i = 0; i < dimension; i++) {
      embedding[i] /= norm;
    }
  }

  return embedding;
}

/**
 * Simple hash function for text
 */
function hashText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

/**
 * Simple hash function for words
 */
function hashWord(word: string): number {
  let hash = 5381;
  for (let i = 0; i < word.length; i++) {
    hash = (hash << 5) + hash + word.charCodeAt(i);
  }
  return Math.abs(hash);
}

/**
 * Clear the embedding cache
 */
export function clearEmbeddingCache(): void {
  embeddingCache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; maxSize: number } {
  return {
    size: embeddingCache.size,
    maxSize: MAX_CACHE_SIZE,
  };
}
