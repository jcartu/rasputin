'use client';

import React, { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Scissors,
  Cpu,
  Database,
  Search,
  ArrowUpDown,
  Send,
  Settings,
  Trash2,
  GripVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { PipelineNode, Position, NodeType } from '@/lib/rag/types';
import { NODE_COLORS, NODE_LABELS } from '@/lib/rag/types';

const ICON_MAP: Record<NodeType, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  document_loader: FileText,
  chunker: Scissors,
  embedder: Cpu,
  vector_store: Database,
  retriever: Search,
  reranker: ArrowUpDown,
  output: Send,
};

interface PipelineNodeProps {
  node: PipelineNode;
  isSelected: boolean;
  onSelect: () => void;
  onDrag: (position: Position) => void;
  onConnectionStart: (nodeId: string, position: Position) => void;
  onConnectionEnd: () => void;
  onDelete: () => void;
  onConfigure: () => void;
}

export function PipelineNodeComponent({
  node,
  isSelected,
  onSelect,
  onDrag,
  onConnectionStart,
  onConnectionEnd,
  onDelete,
  onConfigure,
}: PipelineNodeProps) {
  const [isDragging, setIsDragging] = useState(false);
  const nodeRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<Position | null>(null);
  const nodeStart = useRef<Position | null>(null);

  const IconComponent = ICON_MAP[node.type];
  const color = NODE_COLORS[node.type];

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      
      onSelect();
      setIsDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY };
      nodeStart.current = { ...node.position };

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!dragStart.current || !nodeStart.current) return;

        const dx = moveEvent.clientX - dragStart.current.x;
        const dy = moveEvent.clientY - dragStart.current.y;

        onDrag({
          x: nodeStart.current.x + dx,
          y: nodeStart.current.y + dy,
        });
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        dragStart.current = null;
        nodeStart.current = null;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [node.position, onDrag, onSelect]
  );

  const handleOutputPortMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!nodeRef.current) return;

      const rect = nodeRef.current.getBoundingClientRect();
      onConnectionStart(node.id, {
        x: rect.right,
        y: rect.top + rect.height / 2,
      });
    },
    [node.id, onConnectionStart]
  );

  const handleInputPortMouseUp = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onConnectionEnd();
    },
    [onConnectionEnd]
  );

  return (
    <motion.div
      ref={nodeRef}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      style={{
        position: 'absolute',
        left: node.position.x,
        top: node.position.y,
      }}
      className={cn(
        'w-[200px] rounded-lg border-2 bg-card shadow-lg select-none',
        isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border',
        isDragging && 'opacity-80'
      )}
    >
      <div
        className="flex items-center gap-2 p-3 cursor-move"
        onMouseDown={handleMouseDown}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            onSelect();
          }
        }}
      >
        <div
          className="p-1.5 rounded"
          style={{ backgroundColor: `${color}20` }}
        >
          <IconComponent className="h-4 w-4" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{node.name}</p>
          <p className="text-xs text-muted-foreground">{NODE_LABELS[node.type]}</p>
        </div>
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="flex items-center justify-between px-3 pb-2 pt-1 border-t">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={(e) => {
            e.stopPropagation();
            onConfigure();
          }}
        >
          <Settings className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-destructive hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {node.type !== 'document_loader' && (
        <div
          className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 bg-background cursor-pointer hover:scale-125 transition-transform"
          style={{ borderColor: color }}
          onMouseUp={handleInputPortMouseUp}
          role="button"
          tabIndex={0}
          aria-label="Input port"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              onConnectionEnd();
            }
          }}
        />
      )}

      {node.type !== 'output' && (
        <div
          className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 bg-background cursor-pointer hover:scale-125 transition-transform"
          style={{ borderColor: color }}
          onMouseDown={handleOutputPortMouseDown}
          role="button"
          tabIndex={0}
          aria-label="Output port"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              if (!nodeRef.current) return;
              const rect = nodeRef.current.getBoundingClientRect();
              onConnectionStart(node.id, {
                x: rect.right,
                y: rect.top + rect.height / 2,
              });
            }
          }}
        />
      )}
    </motion.div>
  );
}
