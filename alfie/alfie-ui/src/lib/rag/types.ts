export type NodeType =
  | 'document_loader'
  | 'chunker'
  | 'embedder'
  | 'vector_store'
  | 'retriever'
  | 'reranker'
  | 'output';

export type DocumentLoaderType =
  | 'pdf'
  | 'text'
  | 'markdown'
  | 'html'
  | 'json'
  | 'csv'
  | 'docx'
  | 'web_scraper'
  | 'github'
  | 'notion'
  | 'confluence'
  | 's3'
  | 'gcs';

export type ChunkingStrategy =
  | 'fixed_size'
  | 'recursive'
  | 'semantic'
  | 'sentence'
  | 'paragraph'
  | 'markdown_header'
  | 'code_aware'
  | 'custom';

export type EmbeddingModel =
  | 'text-embedding-ada-002'
  | 'text-embedding-3-small'
  | 'text-embedding-3-large'
  | 'embed-english-v3.0'
  | 'embed-multilingual-v3.0'
  | 'embed-english-light-v3.0'
  | 'BAAI/bge-small-en-v1.5'
  | 'BAAI/bge-base-en-v1.5'
  | 'BAAI/bge-large-en-v1.5'
  | 'intfloat/e5-small-v2'
  | 'intfloat/e5-base-v2'
  | 'intfloat/e5-large-v2'
  | 'hkunlp/instructor-large'
  | 'voyage-02'
  | 'voyage-code-02'
  | 'ollama'
  | 'sentence-transformers';

export type VectorStoreType =
  | 'qdrant'
  | 'pinecone'
  | 'weaviate'
  | 'milvus'
  | 'chroma'
  | 'pgvector'
  | 'redis'
  | 'elasticsearch'
  | 'memory';

export type RetrievalAlgorithm =
  | 'similarity'
  | 'mmr'
  | 'hybrid'
  | 'multi_query'
  | 'contextual_compression'
  | 'ensemble'
  | 'self_query'
  | 'parent_document'
  | 'time_weighted';

export type RerankerModel =
  | 'cohere-rerank-english-v3.0'
  | 'cohere-rerank-multilingual-v3.0'
  | 'BAAI/bge-reranker-base'
  | 'BAAI/bge-reranker-large'
  | 'cross-encoder/ms-marco-MiniLM-L-6-v2'
  | 'flashrank'
  | 'jina-reranker-v1-base-en'
  | 'none';

export type PipelineStatus =
  | 'draft'
  | 'validating'
  | 'valid'
  | 'invalid'
  | 'running'
  | 'completed'
  | 'failed'
  | 'paused';

export interface Position {
  x: number;
  y: number;
}

export interface PipelineNode {
  id: string;
  type: NodeType;
  name: string;
  config: Record<string, unknown>;
  position: Position;
  connections: {
    inputs: string[];
    outputs: string[];
  };
  metadata: {
    createdAt: string;
    updatedAt: string;
  };
}

export interface PipelineConnection {
  id: string;
  source: {
    nodeId: string;
    port: string;
  };
  target: {
    nodeId: string;
    port: string;
  };
}

export interface PipelineMetrics {
  lastRunAt: string | null;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  averageLatency: number;
}

export interface Pipeline {
  id: string;
  name: string;
  description: string;
  version: string;
  status: PipelineStatus;
  nodes: PipelineNode[];
  connections: PipelineConnection[];
  settings: {
    parallelExecution: boolean;
    errorHandling: 'stop' | 'continue' | 'retry';
    retryAttempts: number;
    timeout: number;
    logging: {
      level: string;
      includeTimings: boolean;
    };
  };
  metadata: {
    createdAt: string;
    updatedAt: string;
    createdBy: string | null;
    tags: string[];
  };
  metrics: PipelineMetrics;
}

export interface ExecutionMetrics {
  startTime: number | null;
  endTime: number | null;
  duration: number;
  nodesExecuted: number;
  documentsProcessed: number;
  chunksCreated: number;
  embeddingsGenerated: number;
  vectorsStored: number;
  retrievalQueries: number;
  rerankingCalls: number;
  tokenUsage: {
    embedding: number;
    completion: number;
    total: number;
  };
  costs: {
    embedding: number;
    storage: number;
    retrieval: number;
    total: number;
  };
  errors: Array<{ message: string; stack?: string }>;
  warnings: string[];
  nodeMetrics: Record<string, { duration: number; type: string; name: string }>;
}

export interface TestCase {
  id: string;
  name: string;
  query: string;
  expectedResults: {
    minRelevantDocs: number;
    expectedTopics: string[];
    excludedTopics: string[];
    minScore: number;
    maxLatency: number;
  };
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  result: {
    passed: boolean;
    executionResult?: unknown;
    error?: string;
    duration: number;
    evaluation?: Record<string, unknown>;
  } | null;
  metrics: ExecutionMetrics | null;
}

export interface ValidationResult {
  valid: boolean;
  errors: Array<{ rule: string; message: string; nodeId?: string }>;
  warnings: Array<{ rule: string; message: string; nodeId?: string }>;
}

export interface PipelineTemplate {
  id: string;
  name: string;
  description: string;
  nodes: Array<{ type: NodeType; config: Record<string, unknown> }>;
}

export const NODE_COLORS: Record<NodeType, string> = {
  document_loader: '#3b82f6',
  chunker: '#8b5cf6',
  embedder: '#ec4899',
  vector_store: '#f59e0b',
  retriever: '#10b981',
  reranker: '#06b6d4',
  output: '#6366f1',
};

export const NODE_ICONS: Record<NodeType, string> = {
  document_loader: 'FileText',
  chunker: 'Scissors',
  embedder: 'Cpu',
  vector_store: 'Database',
  retriever: 'Search',
  reranker: 'ArrowUpDown',
  output: 'Send',
};

export const NODE_LABELS: Record<NodeType, string> = {
  document_loader: 'Document Loader',
  chunker: 'Text Chunker',
  embedder: 'Embedder',
  vector_store: 'Vector Store',
  retriever: 'Retriever',
  reranker: 'Reranker',
  output: 'Output',
};
