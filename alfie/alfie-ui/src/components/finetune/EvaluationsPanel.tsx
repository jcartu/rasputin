'use client';

import { useState } from 'react';
import { useFineTuneStore, Evaluation } from '@/lib/finetune-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Plus,
  TestTube,
  CheckCircle,
  XCircle,
  Activity,
  BarChart3,
  Target,
} from 'lucide-react';

export function EvaluationsPanel() {
  const {
    evaluations,
    datasets,
    versions,
    createEvaluation,
    isLoading,
  } = useFineTuneStore();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState('');
  const [selectedDatasetId, setSelectedDatasetId] = useState('');
  const [evalName, setEvalName] = useState('');
  const [selectedEval, setSelectedEval] = useState<Evaluation | null>(null);

  const validatedDatasets = datasets.filter(d => d.status === 'validated' || d.status === 'uploaded');
  
  const modelOptions = versions.map(v => ({
    value: v.modelId,
    label: v.name,
  }));
  
  const datasetOptions = validatedDatasets.map(d => ({
    value: d.id,
    label: `${d.name} (${d.stats.totalExamples} examples)`,
  }));

  const handleCreateEvaluation = async () => {
    if (!selectedModelId || !selectedDatasetId) return;
    
    await createEvaluation({
      modelId: selectedModelId,
      testDatasetId: selectedDatasetId,
      name: evalName || 'Evaluation',
    });
    
    setIsCreateDialogOpen(false);
    setSelectedModelId('');
    setSelectedDatasetId('');
    setEvalName('');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <Activity className="h-4 w-4 text-blue-500 animate-pulse" />;
      default:
        return <Activity className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 0.8) return 'text-green-500';
    if (accuracy >= 0.6) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="h-full flex">
      <div className="w-80 border-r flex flex-col">
        <div className="p-4 border-b">
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button
                className="w-full"
                disabled={versions.length === 0 || validatedDatasets.length === 0}
              >
                <Plus className="h-4 w-4 mr-2" />
                New Evaluation
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create Evaluation</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium block mb-1">Model to Evaluate</label>
                  <Select
                    value={selectedModelId}
                    onValueChange={setSelectedModelId}
                    options={modelOptions}
                    placeholder="Select model"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium block mb-1">Test Dataset</label>
                  <Select
                    value={selectedDatasetId}
                    onValueChange={setSelectedDatasetId}
                    options={datasetOptions}
                    placeholder="Select test dataset"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    The model will be tested against this dataset
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium block mb-1">Evaluation Name</label>
                  <Input
                    value={evalName}
                    onChange={(e) => setEvalName(e.target.value)}
                    placeholder="My Evaluation"
                  />
                </div>

                <Button
                  onClick={handleCreateEvaluation}
                  disabled={!selectedModelId || !selectedDatasetId || isLoading}
                  className="w-full"
                >
                  Start Evaluation
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          {(versions.length === 0 || validatedDatasets.length === 0) && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              {versions.length === 0 
                ? 'Register a model version first' 
                : 'Create a validated dataset first'}
            </p>
          )}
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {evaluations.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4 text-center">
                No evaluations yet
              </p>
            ) : (
              evaluations.map((evaluation) => (
                <button
                  key={evaluation.id}
                  type="button"
                  onClick={() => setSelectedEval(evaluation)}
                  className={`w-full p-3 text-left rounded-lg transition-colors ${
                    selectedEval?.id === evaluation.id
                      ? 'bg-primary/10 border border-primary/30'
                      : 'hover:bg-muted'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(evaluation.status)}
                      <div>
                        <p className="font-medium text-sm">{evaluation.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(evaluation.startedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {evaluation.metrics && (
                      <span className={`text-sm font-medium ${getAccuracyColor(evaluation.metrics.accuracy)}`}>
                        {(evaluation.metrics.accuracy * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 overflow-auto">
        {selectedEval ? (
          <div className="p-6 space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(selectedEval.status)}
                  <h2 className="text-xl font-bold">{selectedEval.name}</h2>
                </div>
                <p className="text-muted-foreground text-sm mt-1">
                  Started: {new Date(selectedEval.startedAt).toLocaleString()}
                </p>
              </div>
              <Badge variant={selectedEval.status === 'completed' ? 'default' : 'secondary'}>
                {selectedEval.status}
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Model ID
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <code className="text-xs font-mono">{selectedEval.modelId}</code>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Test Dataset
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <code className="text-xs font-mono">{selectedEval.testDatasetId}</code>
                </CardContent>
              </Card>
            </div>

            {selectedEval.metrics && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="text-center">
                      <div className={`text-3xl font-bold ${getAccuracyColor(selectedEval.metrics.accuracy)}`}>
                        {(selectedEval.metrics.accuracy * 100).toFixed(1)}%
                      </div>
                      <p className="text-sm text-muted-foreground">Accuracy</p>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold">
                        {selectedEval.metrics.passRate}
                      </div>
                      <p className="text-sm text-muted-foreground">Pass Rate</p>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold">
                        {(selectedEval.metrics.avgSimilarity * 100).toFixed(0)}%
                      </div>
                      <p className="text-sm text-muted-foreground">Avg Similarity</p>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold">
                        {selectedEval.results.length}
                      </div>
                      <p className="text-sm text-muted-foreground">Tests Run</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedEval.status === 'running' && (
              <Card>
                <CardContent className="py-8">
                  <div className="text-center">
                    <Activity className="h-12 w-12 mx-auto text-blue-500 animate-pulse mb-4" />
                    <p className="text-lg font-medium">Evaluation in Progress</p>
                    <p className="text-muted-foreground text-sm">
                      {selectedEval.results.length} tests completed
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedEval.results.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Test Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    <div className="space-y-3">
                      {selectedEval.results.slice(0, 20).map((result) => (
                        <div
                          key={result.exampleId}
                          className={`p-3 rounded-lg border ${
                            result.passed
                              ? 'border-green-500/30 bg-green-500/5'
                              : 'border-red-500/30 bg-red-500/5'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-mono">{result.exampleId}</span>
                            <div className="flex items-center gap-2">
                              {result.similarity !== undefined && (
                                <span className="text-xs text-muted-foreground">
                                  {(result.similarity * 100).toFixed(0)}% similar
                                </span>
                              )}
                              {result.passed ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500" />
                              )}
                            </div>
                          </div>
                          {result.error && (
                            <p className="text-xs text-red-500">{result.error}</p>
                          )}
                          {result.actualResponse && (
                            <div className="text-xs">
                              <p className="text-muted-foreground mb-1">Response:</p>
                              <p className="line-clamp-2">{result.actualResponse}</p>
                            </div>
                          )}
                        </div>
                      ))}
                      {selectedEval.results.length > 20 && (
                        <p className="text-center text-sm text-muted-foreground">
                          ... and {selectedEval.results.length - 20} more results
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <TestTube className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Select an Evaluation</h3>
              <p className="text-muted-foreground text-sm">
                Choose an evaluation from the list or create a new one
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
