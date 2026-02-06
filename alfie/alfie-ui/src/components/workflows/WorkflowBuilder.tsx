'use client';

import { useCallback, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlowProvider,
  Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Save,
  Play,
  Plus,
  Zap,
  GitBranch,
  Box,
  Repeat,
  X,
  Clock,
  Webhook,
  FolderOpen,
  Globe,
  Terminal,
  Bell,
  Wand2,
  Timer,
  List,
  Hash,
} from 'lucide-react';
import { useWorkflowStore, WorkflowNodeData } from '@/lib/workflowStore';
import TriggerNode from './nodes/TriggerNode';
import ActionNode from './nodes/ActionNode';
import ConditionNode from './nodes/ConditionNode';
import LoopNode from './nodes/LoopNode';

const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  condition: ConditionNode,
  loop: LoopNode,
};

const nodeCategories = [
  {
    title: 'Triggers',
    color: 'emerald',
    items: [
      { type: 'trigger', label: 'Manual', icon: Zap, config: { triggerType: 'manual' } },
      { type: 'trigger', label: 'Schedule', icon: Clock, config: { triggerType: 'schedule', cron: '0 * * * *' } },
      { type: 'trigger', label: 'Webhook', icon: Webhook, config: { triggerType: 'webhook' } },
      { type: 'trigger', label: 'File Watcher', icon: FolderOpen, config: { triggerType: 'fileWatcher', paths: [] } },
    ],
  },
  {
    title: 'Actions',
    color: 'blue',
    items: [
      { type: 'action', label: 'HTTP Request', icon: Globe, config: { actionType: 'httpRequest', method: 'GET', url: '' } },
      { type: 'action', label: 'Run Script', icon: Terminal, config: { actionType: 'runScript', command: '' } },
      { type: 'action', label: 'Notification', icon: Bell, config: { actionType: 'sendNotification', message: '' } },
      { type: 'action', label: 'Transform', icon: Wand2, config: { actionType: 'transformData', expression: 'payload' } },
      { type: 'action', label: 'Delay', icon: Timer, config: { actionType: 'delay', ms: 1000 } },
    ],
  },
  {
    title: 'Conditions',
    color: 'amber',
    items: [
      { type: 'condition', label: 'If/Else', icon: GitBranch, config: { conditionType: 'expression', expression: 'true' } },
      { type: 'condition', label: 'Compare', icon: GitBranch, config: { conditionType: 'compare', left: '', operator: '==', right: '' } },
    ],
  },
  {
    title: 'Loops',
    color: 'purple',
    items: [
      { type: 'loop', label: 'For Each', icon: List, config: { loopType: 'forEach', itemsPath: 'payload.items' } },
      { type: 'loop', label: 'While', icon: Repeat, config: { loopType: 'while', conditionExpression: 'true' } },
      { type: 'loop', label: 'Counter', icon: Hash, config: { loopType: 'counter', from: 0, to: 10, step: 1 } },
    ],
  },
];

function WorkflowBuilderInner() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [showPalette, setShowPalette] = useState(true);
  const [workflowName, setWorkflowName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const {
    nodes,
    edges,
    selectedNodeId,
    currentWorkflowId,
    isSaving,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    selectNode,
    saveWorkflow,
    executeWorkflow,
  } = useWorkflowStore();

  const onDragStart = useCallback(
    (event: React.DragEvent, nodeType: string, label: string, config: Record<string, unknown>) => {
      event.dataTransfer.setData('application/reactflow', JSON.stringify({ nodeType, label, config }));
      event.dataTransfer.effectAllowed = 'move';
    },
    []
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const data = event.dataTransfer.getData('application/reactflow');
      if (!data) return;

      const { nodeType, label, config } = JSON.parse(data);
      const bounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!bounds) return;

      const position = {
        x: event.clientX - bounds.left - 90,
        y: event.clientY - bounds.top - 30,
      };

      const newNode: Node<WorkflowNodeData> = {
        id: `${nodeType}-${Date.now()}`,
        type: nodeType,
        position,
        data: {
          label,
          nodeType: nodeType as 'trigger' | 'condition' | 'action' | 'loop',
          config,
        },
      };

      addNode(newNode);
    },
    [addNode]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      selectNode(node.id);
    },
    [selectNode]
  );

  const onPaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  const handleSave = async () => {
    const result = await saveWorkflow(workflowName || undefined);
    if (result) {
      setShowSaveDialog(false);
      setWorkflowName('');
    }
  };

  const handleExecute = async () => {
    if (currentWorkflowId) {
      await executeWorkflow(currentWorkflowId);
    }
  };

  return (
    <div className="h-full w-full flex bg-zinc-950">
      <AnimatePresence>
        {showPalette && (
          <motion.div
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            className="w-64 border-r border-zinc-800 bg-zinc-900/50 overflow-y-auto"
          >
            <div className="p-4">
              <h2 className="text-lg font-semibold text-white mb-4">Nodes</h2>
              
              {nodeCategories.map((category) => (
                <div key={category.title} className="mb-6">
                  <h3 className={`text-xs font-medium text-${category.color}-400 uppercase tracking-wider mb-2`}>
                    {category.title}
                  </h3>
                  <div className="space-y-2">
                    {category.items.map((item) => (
                      <button
                        type="button"
                        key={item.label}
                        draggable
                        onDragStart={(e) => onDragStart(e, item.type, item.label, item.config)}
                        className={`
                          flex items-center gap-3 p-3 rounded-lg cursor-grab w-full text-left
                          bg-zinc-800/50 border border-zinc-700/50
                          hover:bg-zinc-800 hover:border-${category.color}-500/50
                          transition-all duration-200
                        `}
                      >
                        <item.icon className={`w-4 h-4 text-${category.color}-400`} />
                        <span className="text-sm text-zinc-300">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div ref={reactFlowWrapper} className="flex-1 h-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onDragOver={onDragOver}
          onDrop={onDrop}
          nodeTypes={nodeTypes}
          fitView
          className="bg-zinc-950"
        >
          <Background color="#27272a" gap={20} />
          <Controls className="!bg-zinc-800 !border-zinc-700 !rounded-lg [&>button]:!bg-zinc-800 [&>button]:!border-zinc-700 [&>button]:!text-zinc-400 [&>button:hover]:!bg-zinc-700" />
          <MiniMap
            className="!bg-zinc-900 !border-zinc-700 !rounded-lg"
            nodeColor={(node) => {
              const colors: Record<string, string> = {
                trigger: '#10b981',
                action: '#3b82f6',
                condition: '#f59e0b',
                loop: '#a855f7',
              };
              return colors[node.type || ''] || '#71717a';
            }}
          />

          <Panel position="top-left" className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPalette(!showPalette)}
              className="p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors"
            >
              {showPalette ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </button>
          </Panel>

          <Panel position="top-right" className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSaveDialog(true)}
              disabled={isSaving || nodes.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={handleExecute}
              disabled={!currentWorkflowId}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4" />
              Run
            </button>
          </Panel>
        </ReactFlow>
      </div>

      <AnimatePresence>
        {showSaveDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowSaveDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-96"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-white mb-4">Save Workflow</h3>
              <input
                type="text"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                placeholder="Workflow name..."
                className="w-full px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
              />
              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setShowSaveDialog(false)}
                  className="px-4 py-2 rounded-lg text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function WorkflowBuilder() {
  return (
    <ReactFlowProvider>
      <WorkflowBuilderInner />
    </ReactFlowProvider>
  );
}
