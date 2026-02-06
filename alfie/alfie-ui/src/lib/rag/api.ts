import type {
  Pipeline,
  PipelineNode,
  PipelineConnection,
  ValidationResult,
  ExecutionMetrics,
  TestCase,
  PipelineTemplate,
  NodeType,
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}/api/rag${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `API error: ${response.status}`);
  }

  return response.json();
}

export async function listPipelines(): Promise<Pipeline[]> {
  const data = await fetchAPI<{ pipelines: Pipeline[] }>('/pipelines');
  return data.pipelines;
}

export async function getPipeline(id: string): Promise<Pipeline> {
  const data = await fetchAPI<{ pipeline: Pipeline }>(`/pipelines/${id}`);
  return data.pipeline;
}

export async function createPipeline(name: string, description?: string): Promise<Pipeline> {
  const data = await fetchAPI<{ pipeline: Pipeline }>('/pipelines', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });
  return data.pipeline;
}

export async function updatePipeline(id: string, updates: Partial<Pipeline>): Promise<Pipeline> {
  const data = await fetchAPI<{ pipeline: Pipeline }>(`/pipelines/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  return data.pipeline;
}

export async function deletePipeline(id: string): Promise<void> {
  await fetchAPI(`/pipelines/${id}`, { method: 'DELETE' });
}

export async function addNode(
  pipelineId: string,
  type: NodeType,
  config?: Record<string, unknown>,
  position?: { x: number; y: number }
): Promise<PipelineNode> {
  const data = await fetchAPI<{ node: PipelineNode }>(`/pipelines/${pipelineId}/nodes`, {
    method: 'POST',
    body: JSON.stringify({ type, config, position }),
  });
  return data.node;
}

export async function updateNode(
  pipelineId: string,
  nodeId: string,
  updates: Partial<PipelineNode>
): Promise<PipelineNode> {
  const data = await fetchAPI<{ node: PipelineNode }>(
    `/pipelines/${pipelineId}/nodes/${nodeId}`,
    {
      method: 'PUT',
      body: JSON.stringify(updates),
    }
  );
  return data.node;
}

export async function deleteNode(pipelineId: string, nodeId: string): Promise<void> {
  await fetchAPI(`/pipelines/${pipelineId}/nodes/${nodeId}`, { method: 'DELETE' });
}

export async function addConnection(
  pipelineId: string,
  sourceNodeId: string,
  targetNodeId: string,
  sourcePort?: string,
  targetPort?: string
): Promise<PipelineConnection> {
  const data = await fetchAPI<{ connection: PipelineConnection }>(
    `/pipelines/${pipelineId}/connections`,
    {
      method: 'POST',
      body: JSON.stringify({ sourceNodeId, targetNodeId, sourcePort, targetPort }),
    }
  );
  return data.connection;
}

export async function deleteConnection(pipelineId: string, connectionId: string): Promise<void> {
  await fetchAPI(`/pipelines/${pipelineId}/connections/${connectionId}`, { method: 'DELETE' });
}

export async function validatePipeline(pipelineId: string): Promise<ValidationResult> {
  const data = await fetchAPI<{ validation: ValidationResult }>(
    `/pipelines/${pipelineId}/validate`,
    { method: 'POST' }
  );
  return data.validation;
}

export async function executePipeline(
  pipelineId: string,
  options: { source?: string; query?: string }
): Promise<{ success: boolean; results: unknown[]; metrics: ExecutionMetrics }> {
  return fetchAPI(`/pipelines/${pipelineId}/execute`, {
    method: 'POST',
    body: JSON.stringify(options),
  });
}

export async function abortPipeline(pipelineId: string): Promise<{ aborted: boolean }> {
  return fetchAPI(`/pipelines/${pipelineId}/abort`, { method: 'POST' });
}

export async function runTests(
  pipelineId: string,
  testCases: Array<{ name: string; query: string; expectedResults?: Record<string, unknown> }>
): Promise<{ totalTests: number; passed: number; failed: number; results: TestCase[] }> {
  return fetchAPI(`/pipelines/${pipelineId}/test`, {
    method: 'POST',
    body: JSON.stringify({ testCases }),
  });
}

export async function duplicatePipeline(pipelineId: string, name?: string): Promise<Pipeline> {
  const data = await fetchAPI<{ pipeline: Pipeline }>(`/pipelines/${pipelineId}/duplicate`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  return data.pipeline;
}

export async function getTemplates(): Promise<PipelineTemplate[]> {
  const data = await fetchAPI<{ templates: PipelineTemplate[] }>('/templates');
  return data.templates;
}

export async function applyTemplate(templateId: string, name?: string): Promise<Pipeline> {
  const data = await fetchAPI<{ pipeline: Pipeline }>(`/templates/${templateId}/apply`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  return data.pipeline;
}

export async function testVectorStoreConnection(
  type: string,
  config: Record<string, unknown>
): Promise<{ healthy: boolean; store: string; error?: string }> {
  return fetchAPI('/vector-stores/test', {
    method: 'POST',
    body: JSON.stringify({ type, config }),
  });
}

export async function getNodeTypes(): Promise<Record<string, string>> {
  const data = await fetchAPI<{ nodeTypes: Record<string, string> }>('/config/node-types');
  return data.nodeTypes;
}

export async function getChunkingStrategies(): Promise<Record<string, string>> {
  const data = await fetchAPI<{ strategies: Record<string, string> }>('/config/chunking-strategies');
  return data.strategies;
}

export async function getEmbeddingModels(): Promise<Record<string, string>> {
  const data = await fetchAPI<{ models: Record<string, string> }>('/config/embedding-models');
  return data.models;
}

export async function getVectorStores(): Promise<Record<string, string>> {
  const data = await fetchAPI<{ stores: Record<string, string> }>('/config/vector-stores');
  return data.stores;
}

export async function getRetrievalAlgorithms(): Promise<Record<string, string>> {
  const data = await fetchAPI<{ algorithms: Record<string, string> }>('/config/retrieval-algorithms');
  return data.algorithms;
}

export async function getRerankerModels(): Promise<Record<string, string>> {
  const data = await fetchAPI<{ models: Record<string, string> }>('/config/reranker-models');
  return data.models;
}
