'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Scissors,
  Cpu,
  Database,
  Search,
  ArrowUpDown,
  Send,
  Plus,
  Play,
  Pause,
  Save,
  Trash2,
  Settings,
  TestTube,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Loader2,
  Copy,
  Download,
  Upload,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useRAGStore } from '@/lib/rag/store';
import type { NodeType, PipelineNode, Position, PipelineConnection } from '@/lib/rag/types';
import { NODE_COLORS, NODE_LABELS, NODE_ICONS } from '@/lib/rag/types';
import { PipelineNodeComponent } from './PipelineNode';
import { NodeConfigPanel } from './NodeConfigPanel';
import { PipelineMetricsPanel } from './PipelineMetrics';
import { TestRunner } from './TestRunner';
import * as api from '@/lib/rag/api';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  FileText,
  Scissors,
  Cpu,
  Database,
  Search,
  ArrowUpDown,
  Send,
};

const NODE_PALETTE: { type: NodeType; label: string; icon: string; color: string }[] = [
  { type: 'document_loader', label: 'Document Loader', icon: 'FileText', color: NODE_COLORS.document_loader },
  { type: 'chunker', label: 'Text Chunker', icon: 'Scissors', color: NODE_COLORS.chunker },
  { type: 'embedder', label: 'Embedder', icon: 'Cpu', color: NODE_COLORS.embedder },
  { type: 'vector_store', label: 'Vector Store', icon: 'Database', color: NODE_COLORS.vector_store },
  { type: 'retriever', label: 'Retriever', icon: 'Search', color: NODE_COLORS.retriever },
  { type: 'reranker', label: 'Reranker', icon: 'ArrowUpDown', color: NODE_COLORS.reranker },
  { type: 'output', label: 'Output', icon: 'Send', color: NODE_COLORS.output },
];

interface DragState {
  isDragging: boolean;
  nodeType: NodeType | null;
  startPos: Position | null;
  currentPos: Position | null;
}

export function RAGBuilder() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    nodeType: null,
    startPos: null,
    currentPos: null,
  });
  const [connectionDrag, setConnectionDrag] = useState<{
    sourceId: string;
    startPos: Position;
    currentPos: Position;
  } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showMetrics, setShowMetrics] = useState(false);
  const [showTests, setShowTests] = useState(false);

  const {
    currentPipelineId,
    selectedNodeId,
    isExecuting,
    validationResult,
    setSelectedNode,
    getCurrentPipeline,
    addNode,
    updateNodePosition,
    deleteNode,
    addConnection,
    deleteConnection,
    setExecuting,
    setExecutionMetrics,
    setValidationResult,
  } = useRAGStore();

  const pipeline = getCurrentPipeline();

  const handleDragStart = useCallback((e: React.DragEvent, nodeType: NodeType) => {
    e.dataTransfer.setData('nodeType', nodeType);
    setDragState({
      isDragging: true,
      nodeType,
      startPos: { x: e.clientX, y: e.clientY },
      currentPos: { x: e.clientX, y: e.clientY },
    });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragState((prev) => ({
      ...prev,
      currentPos: { x: e.clientX, y: e.clientY },
    }));
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      const nodeType = e.dataTransfer.getData('nodeType') as NodeType;

      if (!nodeType || !pipeline || !canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const position = {
        x: (e.clientX - rect.left - pan.x) / zoom,
        y: (e.clientY - rect.top - pan.y) / zoom,
      };

      try {
        const node = await api.addNode(pipeline.id, nodeType, undefined, position);
        addNode(pipeline.id, node);
      } catch (error) {
        console.error('Failed to add node:', error);
      }

      setDragState({
        isDragging: false,
        nodeType: null,
        startPos: null,
        currentPos: null,
      });
    },
    [pipeline, pan, zoom, addNode]
  );

  const handleNodeDrag = useCallback(
    (nodeId: string, position: Position) => {
      if (pipeline) {
        updateNodePosition(pipeline.id, nodeId, position);
      }
    },
    [pipeline, updateNodePosition]
  );

  const handleConnectionStart = useCallback((nodeId: string, position: Position) => {
    setConnectionDrag({
      sourceId: nodeId,
      startPos: position,
      currentPos: position,
    });
  }, []);

  const handleConnectionEnd = useCallback(
    async (targetNodeId: string) => {
      if (!connectionDrag || !pipeline) return;

      const sourceId = connectionDrag.sourceId;
      if (sourceId === targetNodeId) {
        setConnectionDrag(null);
        return;
      }

      try {
        const connection = await api.addConnection(pipeline.id, sourceId, targetNodeId);
        addConnection(pipeline.id, connection);
      } catch (error) {
        console.error('Failed to create connection:', error);
      }

      setConnectionDrag(null);
    },
    [connectionDrag, pipeline, addConnection]
  );

  const handleDeleteNode = useCallback(
    async (nodeId: string) => {
      if (!pipeline) return;

      try {
        await api.deleteNode(pipeline.id, nodeId);
        deleteNode(pipeline.id, nodeId);
      } catch (error) {
        console.error('Failed to delete node:', error);
      }
    },
    [pipeline, deleteNode]
  );

  const handleDeleteConnection = useCallback(
    async (connectionId: string) => {
      if (!pipeline) return;

      try {
        await api.deleteConnection(pipeline.id, connectionId);
        deleteConnection(pipeline.id, connectionId);
      } catch (error) {
        console.error('Failed to delete connection:', error);
      }
    },
    [pipeline, deleteConnection]
  );

  const handleValidate = useCallback(async () => {
    if (!pipeline) return;

    try {
      const result = await api.validatePipeline(pipeline.id);
      setValidationResult(result);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  }, [pipeline, setValidationResult]);

  const handleExecute = useCallback(async () => {
    if (!pipeline) return;

    setExecuting(true);
    setExecutionMetrics(null);

    try {
      const result = await api.executePipeline(pipeline.id, {});
      setExecutionMetrics(result.metrics);
      setShowMetrics(true);
    } catch (error) {
      console.error('Execution failed:', error);
    } finally {
      setExecuting(false);
    }
  }, [pipeline, setExecuting, setExecutionMetrics]);

  const handleAbort = useCallback(async () => {
    if (!pipeline) return;

    try {
      await api.abortPipeline(pipeline.id);
      setExecuting(false);
    } catch (error) {
      console.error('Failed to abort:', error);
    }
  }, [pipeline, setExecuting]);

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (connectionDrag) {
        setConnectionDrag((prev) =>
          prev
            ? {
                ...prev,
                currentPos: { x: e.clientX, y: e.clientY },
              }
            : null
        );
      }

      if (isPanning) {
        setPan((prev) => ({
          x: prev.x + e.movementX,
          y: prev.y + e.movementY,
        }));
      }
    },
    [connectionDrag, isPanning]
  );

  const handleCanvasMouseUp = useCallback(() => {
    if (connectionDrag) {
      setConnectionDrag(null);
    }
    setIsPanning(false);
  }, [connectionDrag]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom((prev) => Math.min(Math.max(prev * delta, 0.25), 2));
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedNodeId && pipeline) {
        handleDeleteNode(selectedNodeId);
      }
      if (e.key === 'Escape') {
        setSelectedNode(null);
        setConnectionDrag(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, pipeline, handleDeleteNode, setSelectedNode]);

  if (!pipeline) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>Select or create a pipeline to start building</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex h-full">
        <div className="w-64 border-r bg-card p-4 flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-medium mb-2">Pipeline Nodes</h3>
            <div className="space-y-2">
              {NODE_PALETTE.map(({ type, label, icon, color }) => {
                const IconComponent = ICON_MAP[icon];
                return (
                  <div
                    key={type}
                    draggable
                    onDragStart={(e) => handleDragStart(e, type)}
                    className={cn(
                      'flex items-center gap-2 p-2 rounded-lg cursor-grab',
                      'bg-background border hover:border-primary/50 transition-colors'
                    )}
                    style={{ borderLeftColor: color, borderLeftWidth: 3 }}
                  >
                    <IconComponent className="h-4 w-4" style={{ color }} />
                    <span className="text-sm">{label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex-1" />

          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={handleValidate}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Validate
            </Button>

            {isExecuting ? (
              <Button variant="destructive" size="sm" className="w-full" onClick={handleAbort}>
                <Pause className="h-4 w-4 mr-2" />
                Stop
              </Button>
            ) : (
              <Button
                size="sm"
                className="w-full"
                onClick={handleExecute}
                disabled={validationResult?.valid === false}
              >
                <Play className="h-4 w-4 mr-2" />
                Execute
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => setShowTests(true)}
            >
              <TestTube className="h-4 w-4 mr-2" />
              Run Tests
            </Button>
          </div>

          {validationResult && (
            <Card className="p-3">
              <div className="flex items-center gap-2 mb-2">
                {validationResult.valid ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                )}
                <span className="text-sm font-medium">
                  {validationResult.valid ? 'Valid' : 'Invalid'}
                </span>
              </div>
              {validationResult.errors.length > 0 && (
                <div className="space-y-1">
                  {validationResult.errors.map((error, i) => (
                    <p key={i} className="text-xs text-red-500">
                      {error.message}
                    </p>
                  ))}
                </div>
              )}
              {validationResult.warnings.length > 0 && (
                <div className="space-y-1 mt-2">
                  {validationResult.warnings.map((warning, i) => (
                    <p key={i} className="text-xs text-yellow-500">
                      {warning.message}
                    </p>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>

        <div className="flex-1 relative overflow-hidden">
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
            <Badge variant="outline">{pipeline.name}</Badge>
            <Badge variant="secondary">{pipeline.nodes.length} nodes</Badge>
            {isExecuting && (
              <Badge variant="default" className="animate-pulse">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Running
              </Badge>
            )}
          </div>

          <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setZoom((z) => Math.min(z * 1.2, 2))}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setZoom((z) => Math.max(z * 0.8, 0.25))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <div
            ref={canvasRef}
            className="absolute inset-0 bg-[radial-gradient(circle,#333_1px,transparent_1px)] [background-size:20px_20px]"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseDown={(e) => {
              if (e.target === canvasRef.current) {
                setIsPanning(true);
                setSelectedNode(null);
              }
            }}
            onWheel={handleWheel}
          >
            <div
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: '0 0',
              }}
            >
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {pipeline.connections.map((connection) => {
                  const sourceNode = pipeline.nodes.find((n) => n.id === connection.source.nodeId);
                  const targetNode = pipeline.nodes.find((n) => n.id === connection.target.nodeId);

                  if (!sourceNode || !targetNode) return null;

                  const sourceX = sourceNode.position.x + 200;
                  const sourceY = sourceNode.position.y + 40;
                  const targetX = targetNode.position.x;
                  const targetY = targetNode.position.y + 40;

                  const midX = (sourceX + targetX) / 2;

                  return (
                    <g key={connection.id}>
                      <path
                        d={`M ${sourceX} ${sourceY} C ${midX} ${sourceY}, ${midX} ${targetY}, ${targetX} ${targetY}`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        className="text-muted-foreground"
                      />
                      <circle
                        cx={targetX}
                        cy={targetY}
                        r={4}
                        fill="currentColor"
                        className="text-muted-foreground cursor-pointer pointer-events-auto hover:text-red-500"
                        onClick={() => handleDeleteConnection(connection.id)}
                      />
                    </g>
                  );
                })}

                {connectionDrag && canvasRef.current && (
                  <path
                    d={`M ${connectionDrag.startPos.x - canvasRef.current.getBoundingClientRect().left} ${
                      connectionDrag.startPos.y - canvasRef.current.getBoundingClientRect().top
                    } L ${connectionDrag.currentPos.x - canvasRef.current.getBoundingClientRect().left} ${
                      connectionDrag.currentPos.y - canvasRef.current.getBoundingClientRect().top
                    }`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeDasharray="4"
                    className="text-primary"
                  />
                )}
              </svg>

              <AnimatePresence>
                {pipeline.nodes.map((node) => (
                  <PipelineNodeComponent
                    key={node.id}
                    node={node}
                    isSelected={selectedNodeId === node.id}
                    onSelect={() => setSelectedNode(node.id)}
                    onDrag={(pos) => handleNodeDrag(node.id, pos)}
                    onConnectionStart={handleConnectionStart}
                    onConnectionEnd={() => handleConnectionEnd(node.id)}
                    onDelete={() => handleDeleteNode(node.id)}
                    onConfigure={() => {
                      setSelectedNode(node.id);
                      setShowConfig(true);
                    }}
                  />
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {showConfig && selectedNodeId && (
            <NodeConfigPanel
              nodeId={selectedNodeId}
              onClose={() => setShowConfig(false)}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showMetrics && (
            <PipelineMetricsPanel onClose={() => setShowMetrics(false)} />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showTests && (
            <TestRunner onClose={() => setShowTests(false)} />
          )}
        </AnimatePresence>
      </div>
    </TooltipProvider>
  );
}
