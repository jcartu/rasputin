import { create } from 'zustand';
import type {
  Pipeline,
  PipelineNode,
  PipelineConnection,
  Position,
  NodeType,
  ValidationResult,
  ExecutionMetrics,
  TestCase,
  PipelineTemplate,
} from './types';

interface RAGState {
  pipelines: Pipeline[];
  currentPipelineId: string | null;
  selectedNodeId: string | null;
  isDragging: boolean;
  draggedNodeType: NodeType | null;
  isExecuting: boolean;
  executionMetrics: ExecutionMetrics | null;
  validationResult: ValidationResult | null;
  testResults: TestCase[] | null;
  templates: PipelineTemplate[];

  setCurrentPipeline: (id: string | null) => void;
  setSelectedNode: (id: string | null) => void;
  setDragging: (isDragging: boolean, nodeType?: NodeType | null) => void;
  setExecuting: (isExecuting: boolean) => void;
  setExecutionMetrics: (metrics: ExecutionMetrics | null) => void;
  setValidationResult: (result: ValidationResult | null) => void;
  setTestResults: (results: TestCase[] | null) => void;

  addPipeline: (pipeline: Pipeline) => void;
  updatePipeline: (id: string, updates: Partial<Pipeline>) => void;
  deletePipeline: (id: string) => void;
  setPipelines: (pipelines: Pipeline[]) => void;
  setTemplates: (templates: PipelineTemplate[]) => void;

  addNode: (pipelineId: string, node: PipelineNode) => void;
  updateNode: (pipelineId: string, nodeId: string, updates: Partial<PipelineNode>) => void;
  updateNodePosition: (pipelineId: string, nodeId: string, position: Position) => void;
  deleteNode: (pipelineId: string, nodeId: string) => void;

  addConnection: (pipelineId: string, connection: PipelineConnection) => void;
  deleteConnection: (pipelineId: string, connectionId: string) => void;

  getCurrentPipeline: () => Pipeline | null;
  getSelectedNode: () => PipelineNode | null;
}

export const useRAGStore = create<RAGState>((set, get) => ({
  pipelines: [],
  currentPipelineId: null,
  selectedNodeId: null,
  isDragging: false,
  draggedNodeType: null,
  isExecuting: false,
  executionMetrics: null,
  validationResult: null,
  testResults: null,
  templates: [],

  setCurrentPipeline: (id) => set({ currentPipelineId: id, selectedNodeId: null }),
  setSelectedNode: (id) => set({ selectedNodeId: id }),
  setDragging: (isDragging, nodeType = null) => set({ isDragging, draggedNodeType: nodeType }),
  setExecuting: (isExecuting) => set({ isExecuting }),
  setExecutionMetrics: (metrics) => set({ executionMetrics: metrics }),
  setValidationResult: (result) => set({ validationResult: result }),
  setTestResults: (results) => set({ testResults: results }),

  addPipeline: (pipeline) =>
    set((state) => ({ pipelines: [...state.pipelines, pipeline] })),

  updatePipeline: (id, updates) =>
    set((state) => ({
      pipelines: state.pipelines.map((p) =>
        p.id === id ? { ...p, ...updates, metadata: { ...p.metadata, updatedAt: new Date().toISOString() } } : p
      ),
    })),

  deletePipeline: (id) =>
    set((state) => ({
      pipelines: state.pipelines.filter((p) => p.id !== id),
      currentPipelineId: state.currentPipelineId === id ? null : state.currentPipelineId,
    })),

  setPipelines: (pipelines) => set({ pipelines }),
  setTemplates: (templates) => set({ templates }),

  addNode: (pipelineId, node) =>
    set((state) => ({
      pipelines: state.pipelines.map((p) =>
        p.id === pipelineId ? { ...p, nodes: [...p.nodes, node] } : p
      ),
    })),

  updateNode: (pipelineId, nodeId, updates) =>
    set((state) => ({
      pipelines: state.pipelines.map((p) =>
        p.id === pipelineId
          ? {
              ...p,
              nodes: p.nodes.map((n) =>
                n.id === nodeId
                  ? { ...n, ...updates, metadata: { ...n.metadata, updatedAt: new Date().toISOString() } }
                  : n
              ),
            }
          : p
      ),
    })),

  updateNodePosition: (pipelineId, nodeId, position) =>
    set((state) => ({
      pipelines: state.pipelines.map((p) =>
        p.id === pipelineId
          ? {
              ...p,
              nodes: p.nodes.map((n) => (n.id === nodeId ? { ...n, position } : n)),
            }
          : p
      ),
    })),

  deleteNode: (pipelineId, nodeId) =>
    set((state) => ({
      pipelines: state.pipelines.map((p) =>
        p.id === pipelineId
          ? {
              ...p,
              nodes: p.nodes.filter((n) => n.id !== nodeId),
              connections: p.connections.filter(
                (c) => c.source.nodeId !== nodeId && c.target.nodeId !== nodeId
              ),
            }
          : p
      ),
      selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
    })),

  addConnection: (pipelineId, connection) =>
    set((state) => ({
      pipelines: state.pipelines.map((p) =>
        p.id === pipelineId ? { ...p, connections: [...p.connections, connection] } : p
      ),
    })),

  deleteConnection: (pipelineId, connectionId) =>
    set((state) => ({
      pipelines: state.pipelines.map((p) =>
        p.id === pipelineId
          ? { ...p, connections: p.connections.filter((c) => c.id !== connectionId) }
          : p
      ),
    })),

  getCurrentPipeline: () => {
    const state = get();
    return state.pipelines.find((p) => p.id === state.currentPipelineId) || null;
  },

  getSelectedNode: () => {
    const state = get();
    const pipeline = state.pipelines.find((p) => p.id === state.currentPipelineId);
    if (!pipeline) return null;
    return pipeline.nodes.find((n) => n.id === state.selectedNodeId) || null;
  },
}));
