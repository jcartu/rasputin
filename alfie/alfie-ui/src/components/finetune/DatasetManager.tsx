'use client';

import { useState } from 'react';
import { useFineTuneStore, Dataset } from '@/lib/finetune-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Plus,
  Trash2,
  Upload,
  CheckCircle,
  AlertCircle,
  FileText,
  Database,
  RefreshCw,
} from 'lucide-react';

export function DatasetManager() {
  const {
    datasets,
    selectedDataset,
    selectDataset,
    createDataset,
    deleteDataset,
    validateDataset,
    uploadDataset,
    buildFromSessions,
    isLoading,
  } = useFineTuneStore();

  const [newDatasetName, setNewDatasetName] = useState('');
  const [newDatasetDescription, setNewDatasetDescription] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isBuildDialogOpen, setIsBuildDialogOpen] = useState(false);
  const [buildName, setBuildName] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful AI assistant.');

  const handleCreate = async () => {
    if (!newDatasetName.trim()) return;
    await createDataset(newDatasetName, newDatasetDescription);
    setNewDatasetName('');
    setNewDatasetDescription('');
    setIsCreateDialogOpen(false);
  };

  const handleBuildFromSessions = async () => {
    if (!buildName.trim()) return;
    await buildFromSessions(buildName, [], {
      systemPrompt,
      includeSystemPrompt: true,
      minMessageLength: 10,
      maxExamples: 500,
    });
    setBuildName('');
    setIsBuildDialogOpen(false);
  };

  const handleValidate = async (id: string) => {
    await validateDataset(id);
  };

  const handleUpload = async (id: string) => {
    await uploadDataset(id);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this dataset?')) {
      await deleteDataset(id);
    }
  };

  const getStatusBadge = (dataset: Dataset) => {
    switch (dataset.status) {
      case 'validated':
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            Validated
          </Badge>
        );
      case 'invalid':
        return (
          <Badge variant="destructive">
            <AlertCircle className="h-3 w-3 mr-1" />
            Invalid
          </Badge>
        );
      case 'uploaded':
        return (
          <Badge variant="default" className="bg-blue-500">
            <Upload className="h-3 w-3 mr-1" />
            Uploaded
          </Badge>
        );
      default:
        return <Badge variant="secondary">Draft</Badge>;
    }
  };

  return (
    <div className="h-full flex">
      <div className="w-80 border-r flex flex-col">
        <div className="p-4 border-b flex gap-2">
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="flex-1">
                <Plus className="h-4 w-4 mr-1" />
                Create
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Dataset</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Name</label>
                  <Input
                    value={newDatasetName}
                    onChange={(e) => setNewDatasetName(e.target.value)}
                    placeholder="My Training Dataset"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Input
                    value={newDatasetDescription}
                    onChange={(e) => setNewDatasetDescription(e.target.value)}
                    placeholder="Optional description"
                  />
                </div>
                <Button onClick={handleCreate} disabled={!newDatasetName.trim() || isLoading}>
                  Create Dataset
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isBuildDialogOpen} onOpenChange={setIsBuildDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="flex-1">
                <Database className="h-4 w-4 mr-1" />
                Build
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Build from Sessions</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Dataset Name</label>
                  <Input
                    value={buildName}
                    onChange={(e) => setBuildName(e.target.value)}
                    placeholder="Session-based Dataset"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">System Prompt</label>
                  <Input
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    placeholder="You are a helpful AI assistant."
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  This will extract conversation examples from your chat sessions
                </p>
                <Button onClick={handleBuildFromSessions} disabled={!buildName.trim() || isLoading}>
                  Build Dataset
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {datasets.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4 text-center">
                No datasets yet. Create one to get started.
              </p>
            ) : (
              datasets.map((dataset) => (
                <button
                  key={dataset.id}
                  type="button"
                  onClick={() => selectDataset(dataset)}
                  className={`w-full p-3 text-left rounded-lg transition-colors ${
                    selectedDataset?.id === dataset.id
                      ? 'bg-primary/10 border border-primary/30'
                      : 'hover:bg-muted'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{dataset.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {dataset.stats.totalExamples} examples • {dataset.stats.totalTokens} tokens
                      </p>
                    </div>
                    {getStatusBadge(dataset)}
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 overflow-auto">
        {selectedDataset ? (
          <div className="p-6 space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold">{selectedDataset.name}</h2>
                <p className="text-muted-foreground text-sm">
                  {selectedDataset.description || 'No description'}
                </p>
              </div>
              <div className="flex gap-2">
                {selectedDataset.status === 'draft' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleValidate(selectedDataset.id)}
                    disabled={isLoading}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Validate
                  </Button>
                )}
                {selectedDataset.status === 'validated' && !selectedDataset.openaiFileId && (
                  <Button
                    size="sm"
                    onClick={() => handleUpload(selectedDataset.id)}
                    disabled={isLoading}
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    Upload to OpenAI
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDelete(selectedDataset.id)}
                  disabled={isLoading}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Examples
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{selectedDataset.stats.totalExamples}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Tokens
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {selectedDataset.stats.totalTokens.toLocaleString()}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Avg Tokens/Example
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {selectedDataset.stats.avgTokensPerExample}
                  </div>
                </CardContent>
              </Card>
            </div>

            {selectedDataset.validation && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Validation Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {selectedDataset.validation.errors.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-destructive mb-2">Errors</h4>
                        <ul className="space-y-1">
                          {selectedDataset.validation.errors.map((err, i) => (
                            <li key={i} className="text-sm text-destructive flex items-start gap-2">
                              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                              {err}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {selectedDataset.validation.warnings.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-yellow-600 mb-2">Warnings</h4>
                        <ul className="space-y-1">
                          {selectedDataset.validation.warnings.map((warn, i) => (
                            <li
                              key={i}
                              className="text-sm text-yellow-600 flex items-start gap-2"
                            >
                              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                              {warn}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {selectedDataset.validation.valid && (
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="h-5 w-5" />
                        <span className="font-medium">Dataset is valid and ready for training</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Examples Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  {selectedDataset.examples.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No examples yet</p>
                  ) : (
                    <div className="space-y-4">
                      {selectedDataset.examples.slice(0, 10).map((example) => (
                        <div
                          key={example.id}
                          className="p-3 rounded-lg border bg-muted/30"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-mono text-muted-foreground">
                              {example.id}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              ~{example.estimatedTokens} tokens
                            </span>
                          </div>
                          <div className="space-y-2">
                            {example.messages.map((msg, i) => (
                              <div key={i} className="text-sm">
                                <span
                                  className={`font-medium ${
                                    msg.role === 'user'
                                      ? 'text-blue-500'
                                      : msg.role === 'assistant'
                                      ? 'text-green-500'
                                      : 'text-purple-500'
                                  }`}
                                >
                                  {msg.role}:
                                </span>{' '}
                                <span className="text-muted-foreground">
                                  {msg.content.slice(0, 100)}
                                  {msg.content.length > 100 && '...'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                      {selectedDataset.examples.length > 10 && (
                        <p className="text-center text-sm text-muted-foreground">
                          ... and {selectedDataset.examples.length - 10} more examples
                        </p>
                      )}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Select a Dataset</h3>
              <p className="text-muted-foreground text-sm">
                Choose a dataset from the list or create a new one
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
