/**
 * RAG Pipeline for Codebase Understanding
 *
 * Provides:
 * - Codebase indexing with semantic chunking
 * - Vector embeddings for code search
 * - Semantic search over code
 * - Code context retrieval for AI queries
 */

export * from "./types";
export {
  codebaseIndexer,
  codebaseIndexer as ragIndexer,
  CodebaseIndexer,
} from "./indexer";
export { codeSearch, codeSearch as ragSearch, CodeSearch } from "./search";
export {
  generateEmbedding,
  generateEmbeddings,
  cosineSimilarity,
  findTopK,
  clearEmbeddingCache,
  getCacheStats,
} from "./embeddings";
