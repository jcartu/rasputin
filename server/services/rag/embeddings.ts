/**
 * Embeddings Service
 * Generates vector embeddings for code chunks
 */

import { invokeLLM } from "../../_core/llm";

// Simple in-memory cache for embeddings
const embeddingCache = new Map<string, number[]>();
const MAX_CACHE_SIZE = 10000;

/**
 * Generate embedding for text using the configured model
 */
export async function generateEmbedding(
  text: string,
  model: string = "text-embedding-3-small"
): Promise<number[]> {
  // Check cache first
  const cacheKey = `${model}:${hashText(text)}`;
  const cached = embeddingCache.get(cacheKey);
  if (cached) return cached;

  try {
    // For now, we'll use a simple hash-based pseudo-embedding
    // In production, this would call an actual embedding API
    const embedding = generatePseudoEmbedding(text);

    // Cache the result
    if (embeddingCache.size >= MAX_CACHE_SIZE) {
      // Remove oldest entries
      const keysToDelete = Array.from(embeddingCache.keys()).slice(0, 1000);
      keysToDelete.forEach(k => embeddingCache.delete(k));
    }
    embeddingCache.set(cacheKey, embedding);

    return embedding;
  } catch (error) {
    console.error("[Embeddings] Failed to generate embedding:", error);
    // Return a zero vector as fallback
    return new Array(1536).fill(0);
  }
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
