import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Node, Edge, Connection, addEdge, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange } from '@xyflow/react';

export type NodeType = 'trigger' | 'condition' | 'action' | 'loop';
export type TriggerType = 'manual' | 'schedule' | 'webhook' | 'fileWatcher';
export type ActionType = 'httpRequest' | 'runScript' | 'sendNotification' | 'transformData' | 'delay';
export type LoopType = 'forEach' | 'while' | 'counter';
export type WorkflowStatus = 'draft' | 'active' | 'paused' | 'completed' | 'failed';

export interface WorkflowNodeData extends Record<string, unknown> {
  label: string;
  nodeType: NodeType;
  config: Record<string, unknown>;
  description?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  nodes: Node<WorkflowNodeData>[];
  edges: Edge[];
  status: WorkflowStatus;
  webhookId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed';
  source: string;
  startedAt: string;
  finishedAt?: string;
  steps: ExecutionStep[];
  error?: string;
}

export interface ExecutionStep {
  nodeId: string;
  type: string;
  status: 'completed' | 'failed';
  startedAt: string;
  finishedAt: string;
  result?: unknown;
  error?: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  trigger: { type: string; cron?: string; paths?: string[]; events?: string[] };
  nodes: unknown[];
  startNodeId: string;
}

interface WorkflowState {
  nodes: Node<WorkflowNodeData>[];
  edges: Edge[];
  selectedNodeId: string | null;
  workflows: Workflow[];
  currentWorkflowId: string | null;
  executions: WorkflowExecution[];
  templates: WorkflowTemplate[];
  isLoading: boolean;
  isSaving: boolean;

  onNodesChange: (changes: NodeChange<Node<WorkflowNodeData>>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (node: Node<WorkflowNodeData>) => void;
  updateNode: (nodeId: string, data: Partial<WorkflowNodeData>) => void;
  deleteNode: (nodeId: string) => void;
  selectNode: (nodeId: string | null) => void;

  newWorkflow: () => void;
  loadWorkflow: (workflow: Workflow) => void;
  saveWorkflow: (name?: string) => Promise<Workflow | null>;
  updateWorkflowStatus: (workflowId: string, status: WorkflowStatus) => Promise<void>;
  deleteWorkflow: (workflowId: string) => Promise<void>;

  executeWorkflow: (workflowId: string) => Promise<WorkflowExecution | null>;
  loadExecutions: (workflowId: string) => Promise<void>;

  loadWorkflows: () => Promise<void>;
  loadTemplates: () => Promise<void>;
  createFromTemplate: (templateId: string) => Promise<Workflow | null>;
  setLoading: (loading: boolean) => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const useWorkflowStore = create<WorkflowState>()(
  persist(
    (set, get) => ({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      workflows: [],
      currentWorkflowId: null,
      executions: [],
      templates: [],
      isLoading: false,
      isSaving: false,

      onNodesChange: (changes) => {
        set({ nodes: applyNodeChanges(changes, get().nodes) });
      },

      onEdgesChange: (changes) => {
        set({ edges: applyEdgeChanges(changes, get().edges) });
      },

      onConnect: (connection) => {
        set({ edges: addEdge({ ...connection, animated: true }, get().edges) });
      },

      addNode: (node) => {
        set({ nodes: [...get().nodes, node] });
      },

      updateNode: (nodeId, data) => {
        set({
          nodes: get().nodes.map((node) =>
            node.id === nodeId
              ? { ...node, data: { ...node.data, ...data } }
              : node
          ),
        });
      },

      deleteNode: (nodeId) => {
        set({
          nodes: get().nodes.filter((node) => node.id !== nodeId),
          edges: get().edges.filter(
            (edge) => edge.source !== nodeId && edge.target !== nodeId
          ),
          selectedNodeId: get().selectedNodeId === nodeId ? null : get().selectedNodeId,
        });
      },

      selectNode: (nodeId) => {
        set({ selectedNodeId: nodeId });
      },

      newWorkflow: () => {
        set({
          nodes: [],
          edges: [],
          selectedNodeId: null,
          currentWorkflowId: null,
        });
      },

      loadWorkflow: (workflow) => {
        set({
          nodes: workflow.nodes,
          edges: workflow.edges,
          currentWorkflowId: workflow.id,
          selectedNodeId: null,
        });
      },

      saveWorkflow: async (name) => {
        const state = get();
        set({ isSaving: true });
        
        try {
          const workflowData = {
            name: name || 'Untitled Workflow',
            nodes: state.nodes.map((n) => ({
              id: n.id,
              type: n.data.nodeType,
              config: n.data.config,
              next: state.edges.find((e) => e.source === n.id)?.target,
              onTrue: n.data.nodeType === 'condition' 
                ? state.edges.find((e) => e.source === n.id && e.sourceHandle === 'true')?.target 
                : undefined,
              onFalse: n.data.nodeType === 'condition'
                ? state.edges.find((e) => e.source === n.id && e.sourceHandle === 'false')?.target
                : undefined,
            })),
            startNodeId: state.nodes.find((n) => n.data.nodeType === 'trigger')?.id,
            trigger: state.nodes.find((n) => n.data.nodeType === 'trigger')?.data.config,
          };

          const method = state.currentWorkflowId ? 'PUT' : 'POST';
          const url = state.currentWorkflowId
            ? `${API_BASE}/api/workflows/${state.currentWorkflowId}`
            : `${API_BASE}/api/workflows`;

          const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(workflowData),
          });

          if (!response.ok) throw new Error('Failed to save workflow');

          const { workflow } = await response.json();
          
          set({
            currentWorkflowId: workflow.id,
            workflows: state.currentWorkflowId
              ? state.workflows.map((w) => (w.id === workflow.id ? workflow : w))
              : [workflow, ...state.workflows],
          });

          return workflow;
        } catch (error) {
          console.error('Save workflow error:', error);
          return null;
        } finally {
          set({ isSaving: false });
        }
      },

      updateWorkflowStatus: async (workflowId, status) => {
        try {
          const response = await fetch(`${API_BASE}/api/workflows/${workflowId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state: status }),
          });

          if (!response.ok) throw new Error('Failed to update workflow');

          const { workflow } = await response.json();
          set({
            workflows: get().workflows.map((w) =>
              w.id === workflowId ? { ...w, status: workflow.state } : w
            ),
          });
        } catch (error) {
          console.error('Update workflow status error:', error);
        }
      },

      deleteWorkflow: async (workflowId) => {
        try {
          const response = await fetch(`${API_BASE}/api/workflows/${workflowId}`, {
            method: 'DELETE',
          });

          if (!response.ok) throw new Error('Failed to delete workflow');

          set({
            workflows: get().workflows.filter((w) => w.id !== workflowId),
            currentWorkflowId:
              get().currentWorkflowId === workflowId ? null : get().currentWorkflowId,
          });
        } catch (error) {
          console.error('Delete workflow error:', error);
        }
      },

      executeWorkflow: async (workflowId) => {
        try {
          const response = await fetch(
            `${API_BASE}/api/workflows/${workflowId}/execute`,
            { method: 'POST', headers: { 'Content-Type': 'application/json' } }
          );

          if (!response.ok) throw new Error('Failed to execute workflow');

          const { execution } = await response.json();
          set({ executions: [execution, ...get().executions] });
          return execution;
        } catch (error) {
          console.error('Execute workflow error:', error);
          return null;
        }
      },

      loadExecutions: async (workflowId) => {
        try {
          const response = await fetch(
            `${API_BASE}/api/workflows/${workflowId}/executions`
          );
          if (!response.ok) throw new Error('Failed to load executions');

          const { executions } = await response.json();
          set({ executions });
        } catch (error) {
          console.error('Load executions error:', error);
        }
      },

      loadWorkflows: async () => {
        set({ isLoading: true });
        try {
          const response = await fetch(`${API_BASE}/api/workflows`);
          if (!response.ok) throw new Error('Failed to load workflows');

          const { workflows } = await response.json();
          set({ workflows });
        } catch (error) {
          console.error('Load workflows error:', error);
        } finally {
          set({ isLoading: false });
        }
      },

      loadTemplates: async () => {
        try {
          const response = await fetch(`${API_BASE}/api/workflows/templates`);
          if (!response.ok) throw new Error('Failed to load templates');

          const { templates } = await response.json();
          set({ templates });
        } catch (error) {
          console.error('Load templates error:', error);
        }
      },

      createFromTemplate: async (templateId) => {
        try {
          const response = await fetch(
            `${API_BASE}/api/workflows/from-template/${templateId}`,
            { method: 'POST', headers: { 'Content-Type': 'application/json' } }
          );

          if (!response.ok) throw new Error('Failed to create from template');

          const { workflow } = await response.json();
          set({ workflows: [workflow, ...get().workflows] });
          return workflow;
        } catch (error) {
          console.error('Create from template error:', error);
          return null;
        }
      },

      setLoading: (loading) => set({ isLoading: loading }),
    }),
    {
      name: 'alfie-workflow-storage',
      partialize: (state) => ({
        workflows: state.workflows,
      }),
    }
  )
);
