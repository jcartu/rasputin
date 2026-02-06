'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { X, Clock, FileText, Layers, Zap, Database, Search, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRAGStore } from '@/lib/rag/store';

interface PipelineMetricsPanelProps {
  onClose: () => void;
}

export function PipelineMetricsPanel({ onClose }: PipelineMetricsPanelProps) {
  const { executionMetrics } = useRAGStore();

  if (!executionMetrics) {
    return (
      <motion.div
        initial={{ x: 300, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 300, opacity: 0 }}
        className="w-80 border-l bg-card p-4 flex flex-col gap-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Execution Metrics</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">No execution data available. Run the pipeline to see metrics.</p>
      </motion.div>
    );
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(2)}m`;
  };

  const metrics = [
    {
      icon: Clock,
      label: 'Duration',
      value: formatDuration(executionMetrics.duration),
    },
    {
      icon: FileText,
      label: 'Documents Processed',
      value: executionMetrics.documentsProcessed,
    },
    {
      icon: Layers,
      label: 'Chunks Created',
      value: executionMetrics.chunksCreated,
    },
    {
      icon: Zap,
      label: 'Embeddings Generated',
      value: executionMetrics.embeddingsGenerated,
    },
    {
      icon: Database,
      label: 'Vectors Stored',
      value: executionMetrics.vectorsStored,
    },
    {
      icon: Search,
      label: 'Retrieval Queries',
      value: executionMetrics.retrievalQueries,
    },
  ];

  return (
    <motion.div
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 300, opacity: 0 }}
      className="w-80 border-l bg-card p-4 flex flex-col gap-4 overflow-y-auto"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Execution Metrics</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-3">
        {metrics.map(({ icon: Icon, label, value }) => (
          <Card key={label} className="p-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-lg font-semibold">{value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {executionMetrics.tokenUsage && (
        <Card className="p-3">
          <h4 className="text-sm font-medium mb-2">Token Usage</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Embedding</span>
              <span>{executionMetrics.tokenUsage.embedding.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Completion</span>
              <span>{executionMetrics.tokenUsage.completion.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-medium pt-1 border-t">
              <span>Total</span>
              <span>{executionMetrics.tokenUsage.total.toLocaleString()}</span>
            </div>
          </div>
        </Card>
      )}

      {executionMetrics.costs && executionMetrics.costs.total > 0 && (
        <Card className="p-3">
          <h4 className="text-sm font-medium mb-2">Estimated Costs</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Embedding</span>
              <span>${executionMetrics.costs.embedding.toFixed(4)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Storage</span>
              <span>${executionMetrics.costs.storage.toFixed(4)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Retrieval</span>
              <span>${executionMetrics.costs.retrieval.toFixed(4)}</span>
            </div>
            <div className="flex justify-between font-medium pt-1 border-t">
              <span>Total</span>
              <span>${executionMetrics.costs.total.toFixed(4)}</span>
            </div>
          </div>
        </Card>
      )}

      {Object.keys(executionMetrics.nodeMetrics).length > 0 && (
        <Card className="p-3">
          <h4 className="text-sm font-medium mb-2">Node Performance</h4>
          <div className="space-y-2">
            {Object.entries(executionMetrics.nodeMetrics).map(([nodeId, nodeMetric]) => (
              <div key={nodeId} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground truncate max-w-[150px]">
                  {nodeMetric.name}
                </span>
                <Badge variant="secondary">{formatDuration(nodeMetric.duration)}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {executionMetrics.errors.length > 0 && (
        <Card className="p-3 border-red-500/50">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <h4 className="text-sm font-medium text-red-500">Errors</h4>
          </div>
          <div className="space-y-1">
            {executionMetrics.errors.map((error, i) => (
              <p key={i} className="text-xs text-red-400">
                {error.message}
              </p>
            ))}
          </div>
        </Card>
      )}

      {executionMetrics.warnings.length > 0 && (
        <Card className="p-3 border-yellow-500/50">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <h4 className="text-sm font-medium text-yellow-500">Warnings</h4>
          </div>
          <div className="space-y-1">
            {executionMetrics.warnings.map((warning, i) => (
              <p key={i} className="text-xs text-yellow-400">
                {warning}
              </p>
            ))}
          </div>
        </Card>
      )}
    </motion.div>
  );
}
