import { 
  NodeType, 
  PipelineStatus, 
  TestStatus, 
  ValidationRules,
  createMetrics 
} from './types.js';
import { createVectorStore } from './vectorStores/index.js';
import { createChunker } from './chunkers/index.js';
import { createEmbedder } from './embedders/index.js';
import { createRetriever } from './retrievers/index.js';
import { createReranker } from './rerankers/index.js';
import fs from 'fs/promises';
import path from 'path';

export class PipelineEngine {
  constructor() {
    this.pipelines = new Map();
    this.runningPipelines = new Map();
  }

  registerPipeline(pipeline) {
    this.pipelines.set(pipeline.id, pipeline);
    return pipeline;
  }

  getPipeline(pipelineId) {
    return this.pipelines.get(pipelineId);
  }

  listPipelines() {
    return Array.from(this.pipelines.values());
  }

  deletePipeline(pipelineId) {
    return this.pipelines.delete(pipelineId);
  }

  validate(pipeline) {
    const errors = [];
    const warnings = [];

    const nodes = pipeline.nodes || [];
    const connections = pipeline.connections || [];

    const hasDocumentLoader = nodes.some(n => n.type === NodeType.DOCUMENT_LOADER);
    if (!hasDocumentLoader) {
      errors.push({
        rule: ValidationRules.HAS_DOCUMENT_LOADER,
        message: 'Pipeline must have at least one document loader',
      });
    }

    const nodeIds = new Set(nodes.map(n => n.id));
    const connectedNodes = new Set();
    
    for (const conn of connections) {
      connectedNodes.add(conn.source.nodeId);
      connectedNodes.add(conn.target.nodeId);

      if (!nodeIds.has(conn.source.nodeId)) {
        errors.push({
          rule: 'invalid_connection',
          message: `Connection references non-existent source node: ${conn.source.nodeId}`,
        });
      }
      if (!nodeIds.has(conn.target.nodeId)) {
        errors.push({
          rule: 'invalid_connection',
          message: `Connection references non-existent target node: ${conn.target.nodeId}`,
        });
      }
    }

    for (const node of nodes) {
      if (nodes.length > 1 && !connectedNodes.has(node.id)) {
        warnings.push({
          rule: ValidationRules.NODE_CONNECTED,
          message: `Node "${node.name}" (${node.id}) is not connected to the pipeline`,
          nodeId: node.id,
        });
      }
    }

    const nodeOrder = this.getNodeOrder(nodes, connections);
    const vectorStoreIndex = nodeOrder.findIndex(n => n.type === NodeType.VECTOR_STORE);
    const embedderIndex = nodeOrder.findIndex(n => n.type === NodeType.EMBEDDER);
    const retrieverIndex = nodeOrder.findIndex(n => n.type === NodeType.RETRIEVER);

    if (vectorStoreIndex !== -1 && embedderIndex !== -1 && embedderIndex > vectorStoreIndex) {
      errors.push({
        rule: ValidationRules.EMBEDDER_BEFORE_STORE,
        message: 'Embedder must come before vector store in the pipeline',
      });
    }

    if (retrieverIndex !== -1 && vectorStoreIndex !== -1 && vectorStoreIndex > retrieverIndex) {
      errors.push({
        rule: ValidationRules.STORE_BEFORE_RETRIEVER,
        message: 'Vector store must come before retriever in the pipeline',
      });
    }

    const hasCycle = this.detectCycle(nodes, connections);
    if (hasCycle) {
      errors.push({
        rule: ValidationRules.NO_CYCLES,
        message: 'Pipeline contains circular dependencies',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  getNodeOrder(nodes, connections) {
    const graph = new Map();
    const inDegree = new Map();
    
    for (const node of nodes) {
      graph.set(node.id, []);
      inDegree.set(node.id, 0);
    }

    for (const conn of connections) {
      const targets = graph.get(conn.source.nodeId) || [];
      targets.push(conn.target.nodeId);
      graph.set(conn.source.nodeId, targets);
      inDegree.set(conn.target.nodeId, (inDegree.get(conn.target.nodeId) || 0) + 1);
    }

    const queue = [];
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) queue.push(nodeId);
    }

    const order = [];
    while (queue.length > 0) {
      const nodeId = queue.shift();
      const node = nodes.find(n => n.id === nodeId);
      if (node) order.push(node);

      for (const targetId of graph.get(nodeId) || []) {
        inDegree.set(targetId, inDegree.get(targetId) - 1);
        if (inDegree.get(targetId) === 0) {
          queue.push(targetId);
        }
      }
    }

    return order;
  }

  detectCycle(nodes, connections) {
    const visited = new Set();
    const recursionStack = new Set();
    const graph = new Map();

    for (const node of nodes) {
      graph.set(node.id, []);
    }
    for (const conn of connections) {
      const targets = graph.get(conn.source.nodeId) || [];
      targets.push(conn.target.nodeId);
      graph.set(conn.source.nodeId, targets);
    }

    const dfs = (nodeId) => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      for (const neighbor of graph.get(nodeId) || []) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recursionStack.has(neighbor)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        if (dfs(node.id)) return true;
      }
    }

    return false;
  }

  async execute(pipelineId, options = {}) {
    const pipeline = this.getPipeline(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline not found: ${pipelineId}`);
    }

    const validation = this.validate(pipeline);
    if (!validation.valid) {
      throw new Error(`Pipeline validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    const metrics = createMetrics();
    metrics.startTime = Date.now();

    pipeline.status = PipelineStatus.RUNNING;
    this.runningPipelines.set(pipelineId, { pipeline, metrics, aborted: false });

    try {
      const context = {
        documents: [],
        chunks: [],
        embeddings: [],
        vectors: [],
        results: [],
        vectorStore: null,
        embedder: null,
        metrics,
      };

      const nodeOrder = this.getNodeOrder(pipeline.nodes, pipeline.connections);

      for (const node of nodeOrder) {
        if (this.runningPipelines.get(pipelineId)?.aborted) {
          throw new Error('Pipeline execution aborted');
        }

        const nodeStartTime = Date.now();
        await this.executeNode(node, context, options);
        
        metrics.nodeMetrics[node.id] = {
          duration: Date.now() - nodeStartTime,
          type: node.type,
          name: node.name,
        };
        metrics.nodesExecuted++;
      }

      metrics.endTime = Date.now();
      metrics.duration = metrics.endTime - metrics.startTime;
      
      pipeline.status = PipelineStatus.COMPLETED;
      pipeline.metrics.lastRunAt = new Date().toISOString();
      pipeline.metrics.totalRuns++;
      pipeline.metrics.successfulRuns++;
      pipeline.metrics.averageLatency = 
        (pipeline.metrics.averageLatency * (pipeline.metrics.totalRuns - 1) + metrics.duration) / 
        pipeline.metrics.totalRuns;

      return {
        success: true,
        pipelineId,
        results: context.results,
        metrics,
      };

    } catch (error) {
      metrics.endTime = Date.now();
      metrics.duration = metrics.endTime - metrics.startTime;
      metrics.errors.push({ message: error.message, stack: error.stack });
      
      pipeline.status = PipelineStatus.FAILED;
      pipeline.metrics.totalRuns++;
      pipeline.metrics.failedRuns++;

      return {
        success: false,
        pipelineId,
        error: error.message,
        metrics,
      };

    } finally {
      this.runningPipelines.delete(pipelineId);
    }
  }

  async executeNode(node, context, options) {
    const executors = {
      [NodeType.DOCUMENT_LOADER]: () => this.executeDocumentLoader(node, context, options),
      [NodeType.CHUNKER]: () => this.executeChunker(node, context),
      [NodeType.EMBEDDER]: () => this.executeEmbedder(node, context),
      [NodeType.VECTOR_STORE]: () => this.executeVectorStore(node, context),
      [NodeType.RETRIEVER]: () => this.executeRetriever(node, context, options),
      [NodeType.RERANKER]: () => this.executeReranker(node, context, options),
      [NodeType.OUTPUT]: () => this.executeOutput(node, context),
    };

    const executor = executors[node.type];
    if (!executor) {
      throw new Error(`Unknown node type: ${node.type}`);
    }

    return executor();
  }

  async executeDocumentLoader(node, context, options) {
    const config = node.config;
    const source = options.source || config.source;

    if (!source) {
      throw new Error('Document source not specified');
    }

    const loaders = {
      pdf: () => this.loadPDF(source),
      text: () => this.loadText(source),
      markdown: () => this.loadText(source),
      html: () => this.loadHTML(source),
      json: () => this.loadJSON(source),
      csv: () => this.loadCSV(source),
    };

    const loader = loaders[config.loaderType];
    if (!loader) {
      const content = await this.loadText(source);
      context.documents.push({ content, metadata: { source } });
      context.metrics.documentsProcessed++;
      return;
    }

    const documents = await loader();
    context.documents.push(...(Array.isArray(documents) ? documents : [documents]));
    context.metrics.documentsProcessed += context.documents.length;
  }

  async loadText(source) {
    if (source.startsWith('http://') || source.startsWith('https://')) {
      const response = await fetch(source);
      const content = await response.text();
      return { content, metadata: { source, type: 'url' } };
    }
    
    const content = await fs.readFile(source, 'utf-8');
    return { content, metadata: { source: path.basename(source), path: source, type: 'file' } };
  }

  async loadPDF(source) {
    return { content: `PDF content from ${source}`, metadata: { source, type: 'pdf' } };
  }

  async loadHTML(source) {
    const raw = await this.loadText(source);
    const content = raw.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return { content, metadata: { ...raw.metadata, type: 'html' } };
  }

  async loadJSON(source) {
    const raw = await this.loadText(source);
    const data = JSON.parse(raw.content);
    const content = JSON.stringify(data, null, 2);
    return { content, metadata: { ...raw.metadata, type: 'json' } };
  }

  async loadCSV(source) {
    const raw = await this.loadText(source);
    return { content: raw.content, metadata: { ...raw.metadata, type: 'csv' } };
  }

  async executeChunker(node, context) {
    const chunker = createChunker(node.config);
    
    for (const doc of context.documents) {
      const chunks = chunker.chunk(doc.content, doc.metadata);
      context.chunks.push(...chunks);
    }

    context.metrics.chunksCreated = context.chunks.length;
  }

  async executeEmbedder(node, context) {
    const embedder = createEmbedder(node.config);
    await embedder.initialize();
    
    context.embedder = embedder;
    
    const texts = context.chunks.map(chunk => chunk.content);
    const embeddings = await embedder.embedBatch(texts, (progress) => {
      context.metrics.embeddingsGenerated = progress.processed;
    });

    context.embeddings = embeddings;
    context.vectors = context.chunks.map((chunk, i) => ({
      id: `vec_${Date.now()}_${i}`,
      vector: embeddings[i],
      metadata: chunk.metadata,
    }));

    context.metrics.embeddingsGenerated = embeddings.length;
    context.metrics.tokenUsage.embedding = texts.reduce((sum, t) => sum + Math.ceil(t.length / 4), 0);
  }

  async executeVectorStore(node, context) {
    const store = createVectorStore(node.config.type, node.config);
    await store.initialize(context.embedder?.getDimensions());
    
    context.vectorStore = store;

    if (context.vectors.length > 0) {
      await store.upsert(context.vectors);
      context.metrics.vectorsStored = context.vectors.length;
    }
  }

  async executeRetriever(node, context, options) {
    if (!context.vectorStore) {
      throw new Error('No vector store available for retrieval');
    }
    if (!context.embedder) {
      throw new Error('No embedder available for query embedding');
    }

    const query = options.query;
    if (!query) {
      return;
    }

    const retriever = createRetriever(context.vectorStore, context.embedder, node.config);
    const results = await retriever.retrieve(query);
    
    context.results = results;
    context.metrics.retrievalQueries++;
  }

  async executeReranker(node, context, options) {
    if (context.results.length === 0) {
      return;
    }

    const query = options.query;
    if (!query) {
      return;
    }

    const reranker = createReranker(node.config);
    await reranker.initialize();
    
    const rerankedResults = await reranker.rerank(query, context.results);
    context.results = rerankedResults.map(r => r.document);
    context.metrics.rerankingCalls++;
  }

  async executeOutput(node, context) {
    const config = node.config;

    context.results = context.results.map(result => ({
      ...result,
      score: config.includeScores ? result.score : undefined,
      metadata: config.includeMetadata ? result.metadata : undefined,
    }));
  }

  abort(pipelineId) {
    const running = this.runningPipelines.get(pipelineId);
    if (running) {
      running.aborted = true;
      return true;
    }
    return false;
  }

  async runTests(pipelineId, testCases) {
    const results = [];

    for (const testCase of testCases) {
      testCase.status = TestStatus.RUNNING;
      const startTime = Date.now();

      try {
        const executionResult = await this.execute(pipelineId, { query: testCase.query });
        const duration = Date.now() - startTime;

        const passed = this.evaluateTestCase(testCase, executionResult, duration);
        
        testCase.status = passed ? TestStatus.PASSED : TestStatus.FAILED;
        testCase.result = {
          passed,
          executionResult,
          duration,
          evaluation: this.getTestEvaluation(testCase, executionResult, duration),
        };
        testCase.metrics = executionResult.metrics;

      } catch (error) {
        testCase.status = TestStatus.FAILED;
        testCase.result = {
          passed: false,
          error: error.message,
          duration: Date.now() - startTime,
        };
      }

      results.push(testCase);
    }

    return {
      totalTests: testCases.length,
      passed: results.filter(t => t.status === TestStatus.PASSED).length,
      failed: results.filter(t => t.status === TestStatus.FAILED).length,
      results,
    };
  }

  evaluateTestCase(testCase, executionResult, duration) {
    const expected = testCase.expectedResults;
    const results = executionResult.results || [];

    if (results.length < expected.minRelevantDocs) {
      return false;
    }

    if (duration > expected.maxLatency) {
      return false;
    }

    if (expected.minScore && results.length > 0) {
      const avgScore = results.reduce((sum, r) => sum + (r.score || 0), 0) / results.length;
      if (avgScore < expected.minScore) {
        return false;
      }
    }

    return true;
  }

  getTestEvaluation(testCase, executionResult, duration) {
    const expected = testCase.expectedResults;
    const results = executionResult.results || [];

    return {
      documentCount: {
        expected: expected.minRelevantDocs,
        actual: results.length,
        passed: results.length >= expected.minRelevantDocs,
      },
      latency: {
        expected: expected.maxLatency,
        actual: duration,
        passed: duration <= expected.maxLatency,
      },
      score: results.length > 0 ? {
        expected: expected.minScore,
        actual: results.reduce((sum, r) => sum + (r.score || 0), 0) / results.length,
        passed: !expected.minScore || 
          (results.reduce((sum, r) => sum + (r.score || 0), 0) / results.length) >= expected.minScore,
      } : null,
    };
  }
}

export const pipelineEngine = new PipelineEngine();

export default pipelineEngine;
