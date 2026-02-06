/**
 * RAG Pipeline Types and Interfaces
 * 
 * Comprehensive type definitions for the RAG pipeline builder system
 */

// Pipeline Node Types
export const NodeType = {
  DOCUMENT_LOADER: 'document_loader',
  CHUNKER: 'chunker',
  EMBEDDER: 'embedder',
  VECTOR_STORE: 'vector_store',
  RETRIEVER: 'retriever',
  RERANKER: 'reranker',
  OUTPUT: 'output',
};

// Document Loader Types
export const DocumentLoaderType = {
  PDF: 'pdf',
  TEXT: 'text',
  MARKDOWN: 'markdown',
  HTML: 'html',
  JSON: 'json',
  CSV: 'csv',
  DOCX: 'docx',
  WEB_SCRAPER: 'web_scraper',
  GITHUB: 'github',
  NOTION: 'notion',
  CONFLUENCE: 'confluence',
  S3: 's3',
  GCS: 'gcs',
};

// Chunking Strategies
export const ChunkingStrategy = {
  FIXED_SIZE: 'fixed_size',
  RECURSIVE: 'recursive',
  SEMANTIC: 'semantic',
  SENTENCE: 'sentence',
  PARAGRAPH: 'paragraph',
  MARKDOWN_HEADER: 'markdown_header',
  CODE_AWARE: 'code_aware',
  CUSTOM: 'custom',
};

// Embedding Models
export const EmbeddingModel = {
  // OpenAI
  OPENAI_ADA_002: 'text-embedding-ada-002',
  OPENAI_3_SMALL: 'text-embedding-3-small',
  OPENAI_3_LARGE: 'text-embedding-3-large',
  // Cohere
  COHERE_EMBED_ENGLISH_V3: 'embed-english-v3.0',
  COHERE_EMBED_MULTILINGUAL_V3: 'embed-multilingual-v3.0',
  COHERE_EMBED_ENGLISH_LIGHT_V3: 'embed-english-light-v3.0',
  // HuggingFace
  HF_BGE_SMALL: 'BAAI/bge-small-en-v1.5',
  HF_BGE_BASE: 'BAAI/bge-base-en-v1.5',
  HF_BGE_LARGE: 'BAAI/bge-large-en-v1.5',
  HF_E5_SMALL: 'intfloat/e5-small-v2',
  HF_E5_BASE: 'intfloat/e5-base-v2',
  HF_E5_LARGE: 'intfloat/e5-large-v2',
  HF_INSTRUCTOR: 'hkunlp/instructor-large',
  // Voyage AI
  VOYAGE_02: 'voyage-02',
  VOYAGE_CODE_02: 'voyage-code-02',
  // Local
  LOCAL_OLLAMA: 'ollama',
  LOCAL_SENTENCE_TRANSFORMERS: 'sentence-transformers',
};

// Vector Store Types
export const VectorStoreType = {
  QDRANT: 'qdrant',
  PINECONE: 'pinecone',
  WEAVIATE: 'weaviate',
  MILVUS: 'milvus',
  CHROMA: 'chroma',
  PGVECTOR: 'pgvector',
  REDIS: 'redis',
  ELASTICSEARCH: 'elasticsearch',
  MEMORY: 'memory',
};

// Retrieval Algorithms
export const RetrievalAlgorithm = {
  SIMILARITY: 'similarity',
  MMR: 'mmr', // Maximal Marginal Relevance
  HYBRID: 'hybrid',
  MULTI_QUERY: 'multi_query',
  CONTEXTUAL_COMPRESSION: 'contextual_compression',
  ENSEMBLE: 'ensemble',
  SELF_QUERY: 'self_query',
  PARENT_DOCUMENT: 'parent_document',
  TIME_WEIGHTED: 'time_weighted',
};

// Reranking Models
export const RerankerModel = {
  COHERE_RERANK: 'cohere-rerank-english-v3.0',
  COHERE_RERANK_MULTILINGUAL: 'cohere-rerank-multilingual-v3.0',
  BGE_RERANKER_BASE: 'BAAI/bge-reranker-base',
  BGE_RERANKER_LARGE: 'BAAI/bge-reranker-large',
  CROSS_ENCODER: 'cross-encoder/ms-marco-MiniLM-L-6-v2',
  FLASHRANK: 'flashrank',
  JINA_RERANKER: 'jina-reranker-v1-base-en',
  NONE: 'none',
};

// Distance Metrics
export const DistanceMetric = {
  COSINE: 'cosine',
  EUCLIDEAN: 'euclidean',
  DOT_PRODUCT: 'dot_product',
  MANHATTAN: 'manhattan',
};

// Pipeline Status
export const PipelineStatus = {
  DRAFT: 'draft',
  VALIDATING: 'validating',
  VALID: 'valid',
  INVALID: 'invalid',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  PAUSED: 'paused',
};

// Test Result Status
export const TestStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  PASSED: 'passed',
  FAILED: 'failed',
  SKIPPED: 'skipped',
};

/**
 * Create a new pipeline node
 */
export function createNode(type, config = {}) {
  return {
    id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    name: config.name || getDefaultNodeName(type),
    config: config.config || getDefaultConfig(type),
    position: config.position || { x: 0, y: 0 },
    connections: {
      inputs: [],
      outputs: [],
    },
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Get default node name
 */
function getDefaultNodeName(type) {
  const names = {
    [NodeType.DOCUMENT_LOADER]: 'Document Loader',
    [NodeType.CHUNKER]: 'Text Chunker',
    [NodeType.EMBEDDER]: 'Embedding Model',
    [NodeType.VECTOR_STORE]: 'Vector Store',
    [NodeType.RETRIEVER]: 'Retriever',
    [NodeType.RERANKER]: 'Reranker',
    [NodeType.OUTPUT]: 'Output',
  };
  return names[type] || 'Unknown Node';
}

/**
 * Get default configuration for node type
 */
function getDefaultConfig(type) {
  const configs = {
    [NodeType.DOCUMENT_LOADER]: {
      loaderType: DocumentLoaderType.PDF,
      source: '',
      options: {
        recursive: false,
        maxDepth: 3,
        fileTypes: ['.pdf', '.txt', '.md'],
        encoding: 'utf-8',
      },
    },
    [NodeType.CHUNKER]: {
      strategy: ChunkingStrategy.RECURSIVE,
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: ['\n\n', '\n', '. ', ' '],
      keepSeparator: true,
      lengthFunction: 'character',
    },
    [NodeType.EMBEDDER]: {
      model: EmbeddingModel.OPENAI_3_SMALL,
      dimensions: null, // Auto-detect
      batchSize: 100,
      showProgress: true,
      retryAttempts: 3,
      apiKey: null, // Uses env var
    },
    [NodeType.VECTOR_STORE]: {
      type: VectorStoreType.QDRANT,
      collectionName: 'default',
      distanceMetric: DistanceMetric.COSINE,
      connection: {
        url: 'http://localhost:6333',
        apiKey: null,
      },
      indexConfig: {
        hnsw: {
          m: 16,
          efConstruction: 100,
        },
      },
    },
    [NodeType.RETRIEVER]: {
      algorithm: RetrievalAlgorithm.SIMILARITY,
      topK: 5,
      scoreThreshold: 0.7,
      filter: null,
      mmrLambda: 0.5, // For MMR
      fetchK: 20, // For MMR
      includeMetadata: true,
    },
    [NodeType.RERANKER]: {
      model: RerankerModel.COHERE_RERANK,
      topN: 3,
      returnDocuments: true,
      apiKey: null,
    },
    [NodeType.OUTPUT]: {
      format: 'json',
      includeScores: true,
      includeMetadata: true,
      maxTokens: null,
    },
  };
  return configs[type] || {};
}

/**
 * Create a new pipeline
 */
export function createPipeline(name, description = '') {
  return {
    id: `pipeline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    description,
    version: '1.0.0',
    status: PipelineStatus.DRAFT,
    nodes: [],
    connections: [],
    settings: {
      parallelExecution: false,
      errorHandling: 'stop', // 'stop', 'continue', 'retry'
      retryAttempts: 3,
      timeout: 300000, // 5 minutes
      logging: {
        level: 'info',
        includeTimings: true,
      },
    },
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: null,
      tags: [],
    },
    metrics: {
      lastRunAt: null,
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      averageLatency: 0,
    },
  };
}

/**
 * Create a connection between nodes
 */
export function createConnection(sourceNodeId, sourcePort, targetNodeId, targetPort) {
  return {
    id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    source: {
      nodeId: sourceNodeId,
      port: sourcePort || 'output',
    },
    target: {
      nodeId: targetNodeId,
      port: targetPort || 'input',
    },
  };
}

/**
 * Pipeline validation rules
 */
export const ValidationRules = {
  // Node must have at least one connection
  NODE_CONNECTED: 'node_connected',
  // Pipeline must have at least one document loader
  HAS_DOCUMENT_LOADER: 'has_document_loader',
  // Pipeline must have embedder before vector store
  EMBEDDER_BEFORE_STORE: 'embedder_before_store',
  // Pipeline must have vector store before retriever
  STORE_BEFORE_RETRIEVER: 'store_before_retriever',
  // No circular dependencies
  NO_CYCLES: 'no_cycles',
  // All required config fields present
  CONFIG_COMPLETE: 'config_complete',
};

/**
 * Metrics structure for pipeline execution
 */
export function createMetrics() {
  return {
    startTime: null,
    endTime: null,
    duration: 0,
    nodesExecuted: 0,
    documentsProcessed: 0,
    chunksCreated: 0,
    embeddingsGenerated: 0,
    vectorsStored: 0,
    retrievalQueries: 0,
    rerankingCalls: 0,
    tokenUsage: {
      embedding: 0,
      completion: 0,
      total: 0,
    },
    costs: {
      embedding: 0,
      storage: 0,
      retrieval: 0,
      total: 0,
    },
    errors: [],
    warnings: [],
    nodeMetrics: {},
  };
}

/**
 * Test case structure
 */
export function createTestCase(name, query, expectedResults = {}) {
  return {
    id: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    query,
    expectedResults: {
      minRelevantDocs: expectedResults.minRelevantDocs || 1,
      expectedTopics: expectedResults.expectedTopics || [],
      excludedTopics: expectedResults.excludedTopics || [],
      minScore: expectedResults.minScore || 0.5,
      maxLatency: expectedResults.maxLatency || 5000,
    },
    status: TestStatus.PENDING,
    result: null,
    metrics: null,
  };
}

export default {
  NodeType,
  DocumentLoaderType,
  ChunkingStrategy,
  EmbeddingModel,
  VectorStoreType,
  RetrievalAlgorithm,
  RerankerModel,
  DistanceMetric,
  PipelineStatus,
  TestStatus,
  ValidationRules,
  createNode,
  createPipeline,
  createConnection,
  createMetrics,
  createTestCase,
};
