'use client';

import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { useRAGStore } from '@/lib/rag/store';
import * as api from '@/lib/rag/api';

interface NodeConfigPanelProps {
  nodeId: string;
  onClose: () => void;
}

const CHUNKING_STRATEGIES = [
  { value: 'fixed_size', label: 'Fixed Size' },
  { value: 'recursive', label: 'Recursive' },
  { value: 'semantic', label: 'Semantic' },
  { value: 'sentence', label: 'Sentence' },
  { value: 'paragraph', label: 'Paragraph' },
  { value: 'markdown_header', label: 'Markdown Header' },
  { value: 'code_aware', label: 'Code Aware' },
];

const EMBEDDING_MODELS = [
  { value: 'text-embedding-3-small', label: 'OpenAI Ada 3 Small' },
  { value: 'text-embedding-3-large', label: 'OpenAI Ada 3 Large' },
  { value: 'text-embedding-ada-002', label: 'OpenAI Ada 002' },
  { value: 'embed-english-v3.0', label: 'Cohere English v3' },
  { value: 'embed-multilingual-v3.0', label: 'Cohere Multilingual v3' },
  { value: 'BAAI/bge-small-en-v1.5', label: 'BGE Small' },
  { value: 'BAAI/bge-base-en-v1.5', label: 'BGE Base' },
  { value: 'BAAI/bge-large-en-v1.5', label: 'BGE Large' },
];

const VECTOR_STORES = [
  { value: 'qdrant', label: 'Qdrant' },
  { value: 'pinecone', label: 'Pinecone' },
  { value: 'weaviate', label: 'Weaviate' },
  { value: 'chroma', label: 'Chroma' },
  { value: 'pgvector', label: 'PGVector' },
];

const RETRIEVAL_ALGORITHMS = [
  { value: 'similarity', label: 'Similarity Search' },
  { value: 'mmr', label: 'MMR (Max Marginal Relevance)' },
  { value: 'hybrid', label: 'Hybrid Search' },
  { value: 'multi_query', label: 'Multi-Query' },
  { value: 'ensemble', label: 'Ensemble' },
];

const RERANKER_MODELS = [
  { value: 'cohere-rerank-english-v3.0', label: 'Cohere Rerank English' },
  { value: 'cohere-rerank-multilingual-v3.0', label: 'Cohere Rerank Multilingual' },
  { value: 'BAAI/bge-reranker-base', label: 'BGE Reranker Base' },
  { value: 'BAAI/bge-reranker-large', label: 'BGE Reranker Large' },
  { value: 'none', label: 'No Reranking' },
];

const DOCUMENT_LOADERS = [
  { value: 'pdf', label: 'PDF' },
  { value: 'text', label: 'Text' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'html', label: 'HTML' },
  { value: 'json', label: 'JSON' },
  { value: 'csv', label: 'CSV' },
  { value: 'web_scraper', label: 'Web Scraper' },
];

export function NodeConfigPanel({ nodeId, onClose }: NodeConfigPanelProps) {
  const { getCurrentPipeline, updateNode } = useRAGStore();
  const pipeline = getCurrentPipeline();
  const node = pipeline?.nodes.find((n) => n.id === nodeId);

  const handleConfigChange = useCallback(
    async (key: string, value: unknown) => {
      if (!pipeline || !node) return;

      const updatedConfig = { ...node.config, [key]: value };

      try {
        await api.updateNode(pipeline.id, nodeId, { config: updatedConfig });
        updateNode(pipeline.id, nodeId, { config: updatedConfig });
      } catch (error) {
        console.error('Failed to update node config:', error);
      }
    },
    [pipeline, node, nodeId, updateNode]
  );

  const handleNameChange = useCallback(
    async (name: string) => {
      if (!pipeline || !node) return;

      try {
        await api.updateNode(pipeline.id, nodeId, { name });
        updateNode(pipeline.id, nodeId, { name });
      } catch (error) {
        console.error('Failed to update node name:', error);
      }
    },
    [pipeline, node, nodeId, updateNode]
  );

  if (!node) return null;

  const renderConfigFields = () => {
    switch (node.type) {
      case 'document_loader':
        return (
          <>
            <div className="space-y-2">
              <Label>Loader Type</Label>
              <Select
                value={(node.config.loaderType as string) || 'text'}
                onValueChange={(v) => handleConfigChange('loaderType', v)}
                options={DOCUMENT_LOADERS}
              />
            </div>
            <div className="space-y-2">
              <Label>Source Path / URL</Label>
              <Input
                value={(node.config.source as string) || ''}
                onChange={(e) => handleConfigChange('source', e.target.value)}
                placeholder="/path/to/documents or https://..."
              />
            </div>
          </>
        );

      case 'chunker':
        return (
          <>
            <div className="space-y-2">
              <Label>Chunking Strategy</Label>
              <Select
                value={(node.config.strategy as string) || 'recursive'}
                onValueChange={(v) => handleConfigChange('strategy', v)}
                options={CHUNKING_STRATEGIES}
              />
            </div>
            <div className="space-y-2">
              <Label>Chunk Size: {(node.config.chunkSize as number) || 1000}</Label>
              <Slider
                value={(node.config.chunkSize as number) || 1000}
                min={100}
                max={4000}
                step={100}
                onValueChange={(v) => handleConfigChange('chunkSize', v)}
              />
            </div>
            <div className="space-y-2">
              <Label>Chunk Overlap: {(node.config.chunkOverlap as number) || 200}</Label>
              <Slider
                value={(node.config.chunkOverlap as number) || 200}
                min={0}
                max={1000}
                step={50}
                onValueChange={(v) => handleConfigChange('chunkOverlap', v)}
              />
            </div>
          </>
        );

      case 'embedder':
        return (
          <>
            <div className="space-y-2">
              <Label>Embedding Model</Label>
              <Select
                value={(node.config.model as string) || 'text-embedding-3-small'}
                onValueChange={(v) => handleConfigChange('model', v)}
                options={EMBEDDING_MODELS}
              />
            </div>
            <div className="space-y-2">
              <Label>Batch Size: {(node.config.batchSize as number) || 100}</Label>
              <Slider
                value={(node.config.batchSize as number) || 100}
                min={10}
                max={500}
                step={10}
                onValueChange={(v) => handleConfigChange('batchSize', v)}
              />
            </div>
          </>
        );

      case 'vector_store':
        return (
          <>
            <div className="space-y-2">
              <Label>Vector Store</Label>
              <Select
                value={(node.config.type as string) || 'qdrant'}
                onValueChange={(v) => handleConfigChange('type', v)}
                options={VECTOR_STORES}
              />
            </div>
            <div className="space-y-2">
              <Label>Collection Name</Label>
              <Input
                value={(node.config.collectionName as string) || 'default'}
                onChange={(e) => handleConfigChange('collectionName', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Connection URL</Label>
              <Input
                value={((node.config.connection as Record<string, string>)?.url as string) || 'http://localhost:6333'}
                onChange={(e) =>
                  handleConfigChange('connection', {
                    ...(node.config.connection as Record<string, string>),
                    url: e.target.value,
                  })
                }
              />
            </div>
          </>
        );

      case 'retriever':
        return (
          <>
            <div className="space-y-2">
              <Label>Retrieval Algorithm</Label>
              <Select
                value={(node.config.algorithm as string) || 'similarity'}
                onValueChange={(v) => handleConfigChange('algorithm', v)}
                options={RETRIEVAL_ALGORITHMS}
              />
            </div>
            <div className="space-y-2">
              <Label>Top K Results: {(node.config.topK as number) || 5}</Label>
              <Slider
                value={(node.config.topK as number) || 5}
                min={1}
                max={20}
                step={1}
                onValueChange={(v) => handleConfigChange('topK', v)}
              />
            </div>
            <div className="space-y-2">
              <Label>Score Threshold: {((node.config.scoreThreshold as number) || 0).toFixed(2)}</Label>
              <Slider
                value={((node.config.scoreThreshold as number) || 0) * 100}
                min={0}
                max={100}
                step={5}
                onValueChange={(v) => handleConfigChange('scoreThreshold', v / 100)}
              />
            </div>
            {(node.config.algorithm === 'mmr') && (
              <div className="space-y-2">
                <Label>MMR Lambda: {((node.config.mmrLambda as number) || 0.5).toFixed(2)}</Label>
                <Slider
                  value={((node.config.mmrLambda as number) || 0.5) * 100}
                  min={0}
                  max={100}
                  step={10}
                  onValueChange={(v) => handleConfigChange('mmrLambda', v / 100)}
                />
              </div>
            )}
          </>
        );

      case 'reranker':
        return (
          <>
            <div className="space-y-2">
              <Label>Reranker Model</Label>
              <Select
                value={(node.config.model as string) || 'cohere-rerank-english-v3.0'}
                onValueChange={(v) => handleConfigChange('model', v)}
                options={RERANKER_MODELS}
              />
            </div>
            <div className="space-y-2">
              <Label>Top N Results: {(node.config.topN as number) || 3}</Label>
              <Slider
                value={(node.config.topN as number) || 3}
                min={1}
                max={10}
                step={1}
                onValueChange={(v) => handleConfigChange('topN', v)}
              />
            </div>
          </>
        );

      case 'output':
        return (
          <>
            <div className="flex items-center justify-between">
              <Label>Include Scores</Label>
              <Switch
                checked={(node.config.includeScores as boolean) !== false}
                onCheckedChange={(v) => handleConfigChange('includeScores', v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Include Metadata</Label>
              <Switch
                checked={(node.config.includeMetadata as boolean) !== false}
                onCheckedChange={(v) => handleConfigChange('includeMetadata', v)}
              />
            </div>
          </>
        );

      default:
        return <p className="text-sm text-muted-foreground">No configuration available</p>;
    }
  };

  return (
    <motion.div
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 300, opacity: 0 }}
      className="w-80 border-l bg-card p-4 flex flex-col gap-4 overflow-y-auto"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Node Configuration</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-2">
        <Label>Node Name</Label>
        <Input
          value={node.name}
          onChange={(e) => handleNameChange(e.target.value)}
        />
      </div>

      <Card className="p-4 space-y-4">{renderConfigFields()}</Card>
    </motion.div>
  );
}
