import express from 'express';
import { pipelineEngine } from '../rag/pipelineEngine.js';
import { 
  createPipeline, 
  createNode, 
  createConnection, 
  createTestCase,
  NodeType,
  ChunkingStrategy,
  EmbeddingModel,
  VectorStoreType,
  RetrievalAlgorithm,
  RerankerModel,
} from '../rag/types.js';
import { testVectorStoreConnection } from '../rag/vectorStores/index.js';

const router = express.Router();

router.get('/pipelines', (req, res) => {
  const pipelines = pipelineEngine.listPipelines();
  res.json({ 
    pipelines: pipelines.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      status: p.status,
      nodeCount: p.nodes.length,
      metrics: p.metrics,
      metadata: p.metadata,
    })),
    count: pipelines.length,
  });
});

router.post('/pipelines', (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Pipeline name required' });
    }

    const pipeline = createPipeline(name, description);
    pipelineEngine.registerPipeline(pipeline);

    res.status(201).json({ pipeline });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/pipelines/:id', (req, res) => {
  const pipeline = pipelineEngine.getPipeline(req.params.id);
  if (!pipeline) {
    return res.status(404).json({ error: 'Pipeline not found' });
  }
  res.json({ pipeline });
});

router.put('/pipelines/:id', (req, res) => {
  const pipeline = pipelineEngine.getPipeline(req.params.id);
  if (!pipeline) {
    return res.status(404).json({ error: 'Pipeline not found' });
  }

  const { name, description, settings, nodes, connections } = req.body;
  
  if (name) pipeline.name = name;
  if (description !== undefined) pipeline.description = description;
  if (settings) pipeline.settings = { ...pipeline.settings, ...settings };
  if (nodes) pipeline.nodes = nodes;
  if (connections) pipeline.connections = connections;
  
  pipeline.metadata.updatedAt = new Date().toISOString();

  res.json({ pipeline });
});

router.delete('/pipelines/:id', (req, res) => {
  const deleted = pipelineEngine.deletePipeline(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Pipeline not found' });
  }
  res.json({ success: true });
});

router.post('/pipelines/:id/nodes', (req, res) => {
  const pipeline = pipelineEngine.getPipeline(req.params.id);
  if (!pipeline) {
    return res.status(404).json({ error: 'Pipeline not found' });
  }

  const { type, name, config, position } = req.body;
  if (!type) {
    return res.status(400).json({ error: 'Node type required' });
  }

  const node = createNode(type, { name, config, position });
  pipeline.nodes.push(node);
  pipeline.metadata.updatedAt = new Date().toISOString();

  res.status(201).json({ node });
});

router.put('/pipelines/:pipelineId/nodes/:nodeId', (req, res) => {
  const pipeline = pipelineEngine.getPipeline(req.params.pipelineId);
  if (!pipeline) {
    return res.status(404).json({ error: 'Pipeline not found' });
  }

  const nodeIndex = pipeline.nodes.findIndex(n => n.id === req.params.nodeId);
  if (nodeIndex === -1) {
    return res.status(404).json({ error: 'Node not found' });
  }

  const { name, config, position } = req.body;
  const node = pipeline.nodes[nodeIndex];

  if (name) node.name = name;
  if (config) node.config = { ...node.config, ...config };
  if (position) node.position = position;
  node.metadata.updatedAt = new Date().toISOString();

  pipeline.metadata.updatedAt = new Date().toISOString();

  res.json({ node });
});

router.delete('/pipelines/:pipelineId/nodes/:nodeId', (req, res) => {
  const pipeline = pipelineEngine.getPipeline(req.params.pipelineId);
  if (!pipeline) {
    return res.status(404).json({ error: 'Pipeline not found' });
  }

  const nodeIndex = pipeline.nodes.findIndex(n => n.id === req.params.nodeId);
  if (nodeIndex === -1) {
    return res.status(404).json({ error: 'Node not found' });
  }

  pipeline.nodes.splice(nodeIndex, 1);
  pipeline.connections = pipeline.connections.filter(
    c => c.source.nodeId !== req.params.nodeId && c.target.nodeId !== req.params.nodeId
  );
  pipeline.metadata.updatedAt = new Date().toISOString();

  res.json({ success: true });
});

router.post('/pipelines/:id/connections', (req, res) => {
  const pipeline = pipelineEngine.getPipeline(req.params.id);
  if (!pipeline) {
    return res.status(404).json({ error: 'Pipeline not found' });
  }

  const { sourceNodeId, sourcePort, targetNodeId, targetPort } = req.body;
  if (!sourceNodeId || !targetNodeId) {
    return res.status(400).json({ error: 'Source and target node IDs required' });
  }

  const sourceExists = pipeline.nodes.some(n => n.id === sourceNodeId);
  const targetExists = pipeline.nodes.some(n => n.id === targetNodeId);
  
  if (!sourceExists || !targetExists) {
    return res.status(400).json({ error: 'Source or target node not found' });
  }

  const connection = createConnection(sourceNodeId, sourcePort, targetNodeId, targetPort);
  pipeline.connections.push(connection);
  pipeline.metadata.updatedAt = new Date().toISOString();

  res.status(201).json({ connection });
});

router.delete('/pipelines/:pipelineId/connections/:connectionId', (req, res) => {
  const pipeline = pipelineEngine.getPipeline(req.params.pipelineId);
  if (!pipeline) {
    return res.status(404).json({ error: 'Pipeline not found' });
  }

  const connIndex = pipeline.connections.findIndex(c => c.id === req.params.connectionId);
  if (connIndex === -1) {
    return res.status(404).json({ error: 'Connection not found' });
  }

  pipeline.connections.splice(connIndex, 1);
  pipeline.metadata.updatedAt = new Date().toISOString();

  res.json({ success: true });
});

router.post('/pipelines/:id/validate', (req, res) => {
  const pipeline = pipelineEngine.getPipeline(req.params.id);
  if (!pipeline) {
    return res.status(404).json({ error: 'Pipeline not found' });
  }

  const validation = pipelineEngine.validate(pipeline);
  res.json({ validation });
});

router.post('/pipelines/:id/execute', async (req, res) => {
  const pipeline = pipelineEngine.getPipeline(req.params.id);
  if (!pipeline) {
    return res.status(404).json({ error: 'Pipeline not found' });
  }

  try {
    const { source, query, options } = req.body;
    const result = await pipelineEngine.execute(req.params.id, { source, query, ...options });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/pipelines/:id/abort', (req, res) => {
  const aborted = pipelineEngine.abort(req.params.id);
  res.json({ aborted });
});

router.post('/pipelines/:id/test', async (req, res) => {
  const pipeline = pipelineEngine.getPipeline(req.params.id);
  if (!pipeline) {
    return res.status(404).json({ error: 'Pipeline not found' });
  }

  try {
    const { testCases } = req.body;
    if (!testCases || !Array.isArray(testCases)) {
      return res.status(400).json({ error: 'Test cases array required' });
    }

    const formattedCases = testCases.map(tc => 
      createTestCase(tc.name, tc.query, tc.expectedResults)
    );

    const results = await pipelineEngine.runTests(req.params.id, formattedCases);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/pipelines/:id/duplicate', (req, res) => {
  const pipeline = pipelineEngine.getPipeline(req.params.id);
  if (!pipeline) {
    return res.status(404).json({ error: 'Pipeline not found' });
  }

  const { name } = req.body;
  const duplicated = createPipeline(name || `${pipeline.name} (Copy)`, pipeline.description);
  
  duplicated.nodes = pipeline.nodes.map(node => ({
    ...node,
    id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  }));

  const oldToNewIds = new Map();
  pipeline.nodes.forEach((oldNode, i) => {
    oldToNewIds.set(oldNode.id, duplicated.nodes[i].id);
  });

  duplicated.connections = pipeline.connections.map(conn => ({
    ...conn,
    id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    source: { ...conn.source, nodeId: oldToNewIds.get(conn.source.nodeId) },
    target: { ...conn.target, nodeId: oldToNewIds.get(conn.target.nodeId) },
  }));

  duplicated.settings = { ...pipeline.settings };
  duplicated.metadata.tags = [...pipeline.metadata.tags];

  pipelineEngine.registerPipeline(duplicated);
  res.status(201).json({ pipeline: duplicated });
});

router.get('/config/node-types', (req, res) => {
  res.json({ nodeTypes: NodeType });
});

router.get('/config/chunking-strategies', (req, res) => {
  res.json({ strategies: ChunkingStrategy });
});

router.get('/config/embedding-models', (req, res) => {
  res.json({ models: EmbeddingModel });
});

router.get('/config/vector-stores', (req, res) => {
  res.json({ stores: VectorStoreType });
});

router.get('/config/retrieval-algorithms', (req, res) => {
  res.json({ algorithms: RetrievalAlgorithm });
});

router.get('/config/reranker-models', (req, res) => {
  res.json({ models: RerankerModel });
});

router.post('/vector-stores/test', async (req, res) => {
  try {
    const { type, config } = req.body;
    if (!type) {
      return res.status(400).json({ error: 'Vector store type required' });
    }

    const result = await testVectorStoreConnection(type, config);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message, healthy: false });
  }
});

router.get('/templates', (req, res) => {
  const templates = [
    {
      id: 'basic-rag',
      name: 'Basic RAG Pipeline',
      description: 'Simple document ingestion with retrieval',
      nodes: [
        { type: NodeType.DOCUMENT_LOADER, config: { loaderType: 'text' } },
        { type: NodeType.CHUNKER, config: { strategy: ChunkingStrategy.RECURSIVE, chunkSize: 1000 } },
        { type: NodeType.EMBEDDER, config: { model: EmbeddingModel.OPENAI_3_SMALL } },
        { type: NodeType.VECTOR_STORE, config: { type: VectorStoreType.QDRANT } },
        { type: NodeType.RETRIEVER, config: { algorithm: RetrievalAlgorithm.SIMILARITY, topK: 5 } },
      ],
    },
    {
      id: 'advanced-rag',
      name: 'Advanced RAG with Reranking',
      description: 'Full pipeline with hybrid search and reranking',
      nodes: [
        { type: NodeType.DOCUMENT_LOADER, config: { loaderType: 'pdf' } },
        { type: NodeType.CHUNKER, config: { strategy: ChunkingStrategy.SEMANTIC, chunkSize: 1500 } },
        { type: NodeType.EMBEDDER, config: { model: EmbeddingModel.OPENAI_3_LARGE } },
        { type: NodeType.VECTOR_STORE, config: { type: VectorStoreType.PINECONE } },
        { type: NodeType.RETRIEVER, config: { algorithm: RetrievalAlgorithm.HYBRID, topK: 10 } },
        { type: NodeType.RERANKER, config: { model: RerankerModel.COHERE_RERANK, topN: 3 } },
      ],
    },
    {
      id: 'local-rag',
      name: 'Local RAG (No Cloud)',
      description: 'Fully local pipeline using HuggingFace and Qdrant',
      nodes: [
        { type: NodeType.DOCUMENT_LOADER, config: { loaderType: 'markdown' } },
        { type: NodeType.CHUNKER, config: { strategy: ChunkingStrategy.MARKDOWN_HEADER } },
        { type: NodeType.EMBEDDER, config: { model: EmbeddingModel.HF_BGE_BASE } },
        { type: NodeType.VECTOR_STORE, config: { type: VectorStoreType.QDRANT, connection: { url: 'http://localhost:6333' } } },
        { type: NodeType.RETRIEVER, config: { algorithm: RetrievalAlgorithm.MMR, topK: 5, mmrLambda: 0.7 } },
      ],
    },
  ];

  res.json({ templates });
});

router.post('/templates/:id/apply', (req, res) => {
  const templates = {
    'basic-rag': {
      nodes: [
        { type: NodeType.DOCUMENT_LOADER, config: { loaderType: 'text' } },
        { type: NodeType.CHUNKER, config: { strategy: ChunkingStrategy.RECURSIVE, chunkSize: 1000 } },
        { type: NodeType.EMBEDDER, config: { model: EmbeddingModel.OPENAI_3_SMALL } },
        { type: NodeType.VECTOR_STORE, config: { type: VectorStoreType.QDRANT } },
        { type: NodeType.RETRIEVER, config: { algorithm: RetrievalAlgorithm.SIMILARITY, topK: 5 } },
      ],
    },
  };

  const template = templates[req.params.id];
  if (!template) {
    return res.status(404).json({ error: 'Template not found' });
  }

  const { name } = req.body;
  const pipeline = createPipeline(name || `Pipeline from ${req.params.id}`);
  
  const nodeIds = [];
  template.nodes.forEach((nodeConfig, i) => {
    const node = createNode(nodeConfig.type, { 
      config: nodeConfig.config,
      position: { x: 100, y: 100 + i * 150 },
    });
    pipeline.nodes.push(node);
    nodeIds.push(node.id);
  });

  for (let i = 0; i < nodeIds.length - 1; i++) {
    const connection = createConnection(nodeIds[i], 'output', nodeIds[i + 1], 'input');
    pipeline.connections.push(connection);
  }

  pipelineEngine.registerPipeline(pipeline);
  res.status(201).json({ pipeline });
});

export default router;
