'use client';

import { useState, useEffect } from 'react';
import { useFineTuneStore } from '@/lib/finetune-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Plus,
  XCircle,
  Activity,
  CheckCircle,
  Clock,
  Cpu,
  TrendingDown,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

export function JobsPanel() {
  const {
    jobs,
    datasets,
    supportedModels,
    presets,
    selectedJob,
    selectJob,
    createJob,
    cancelJob,
    getJobProgress,
    fetchJobs,
    isLoading,
  } = useFineTuneStore();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedDatasetId, setSelectedDatasetId] = useState('');
  const [selectedModel, setSelectedModel] = useState('gpt-4o-mini-2024-07-18');
  const [selectedPreset, setSelectedPreset] = useState('balanced');
  const [suffix, setSuffix] = useState('');
  const [progressData, setProgressData] = useState<{ chartData: unknown; summary: unknown } | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchJobs();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  useEffect(() => {
    if (selectedJob && ['running', 'validating_files'].includes(selectedJob.status)) {
      const fetchProgress = async () => {
        try {
          const progress = await getJobProgress(selectedJob.id);
          setProgressData(progress);
        } catch {
        }
      };
      fetchProgress();
      const interval = setInterval(fetchProgress, 15000);
      return () => clearInterval(interval);
    }
  }, [selectedJob, getJobProgress]);

  const uploadedDatasets = datasets.filter(d => d.status === 'uploaded');

  const datasetOptions = uploadedDatasets.map(d => ({
    value: d.id,
    label: `${d.name} (${d.stats.totalExamples} examples)`,
  }));

  const modelOptions = supportedModels.map(m => ({ value: m, label: m }));

  const presetOptions = Object.entries(presets).map(([key, preset]) => ({
    value: key,
    label: preset.name,
  }));

  const handleCreateJob = async () => {
    if (!selectedDatasetId) return;

    const preset = presets[selectedPreset];
    await createJob({
      datasetId: selectedDatasetId,
      baseModel: selectedModel,
      suffix: suffix || undefined,
      hyperparameters: preset?.params,
    });
    setIsCreateDialogOpen(false);
    setSelectedDatasetId('');
    setSuffix('');
  };

  const handleCancelJob = async (id: string) => {
    if (confirm('Cancel this training job?')) {
      await cancelJob(id);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'succeeded':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
      case 'validating_files':
        return <Activity className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-gray-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'succeeded':
        return 'default';
      case 'failed':
        return 'destructive';
      case 'running':
      case 'validating_files':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const chartData = progressData?.chartData as { 
    labels?: string[]; 
    datasets?: Array<{ label: string; data: number[] }>;
  } | undefined;

  const formattedChartData = chartData?.labels?.map((label: string, idx: number) => ({
    name: label,
    trainingLoss: chartData.datasets?.[0]?.data?.[idx],
    validationLoss: chartData.datasets?.[1]?.data?.[idx],
  })) || [];

  return (
    <div className="h-full flex">
      <div className="w-80 border-r flex flex-col">
        <div className="p-4 border-b">
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full" disabled={uploadedDatasets.length === 0}>
                <Plus className="h-4 w-4 mr-2" />
                New Training Job
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create Training Job</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium block mb-1">Dataset</label>
                  <Select
                    value={selectedDatasetId}
                    onValueChange={setSelectedDatasetId}
                    options={datasetOptions}
                    placeholder="Select dataset"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium block mb-1">Base Model</label>
                  <Select
                    value={selectedModel}
                    onValueChange={setSelectedModel}
                    options={modelOptions}
                    placeholder="Select model"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium block mb-1">Hyperparameter Preset</label>
                  <Select
                    value={selectedPreset}
                    onValueChange={setSelectedPreset}
                    options={presetOptions}
                    placeholder="Select preset"
                  />
                  {presets[selectedPreset] && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {presets[selectedPreset].description}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium block mb-1">Model Suffix (optional)</label>
                  <Input
                    value={suffix}
                    onChange={(e) => setSuffix(e.target.value)}
                    placeholder="my-custom-model"
                  />
                </div>

                <Button
                  onClick={handleCreateJob}
                  disabled={!selectedDatasetId || isLoading}
                  className="w-full"
                >
                  Start Training
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          {uploadedDatasets.length === 0 && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Upload a dataset first to start training
            </p>
          )}
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {jobs.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4 text-center">
                No training jobs yet
              </p>
            ) : (
              jobs.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => selectJob(job)}
                  className={`w-full p-3 text-left rounded-lg transition-colors ${
                    selectedJob?.id === job.id
                      ? 'bg-primary/10 border border-primary/30'
                      : 'hover:bg-muted'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(job.status)}
                      <div>
                        <p className="font-medium text-sm font-mono">
                          {job.id.slice(0, 16)}...
                        </p>
                        <p className="text-xs text-muted-foreground">{job.baseModel}</p>
                      </div>
                    </div>
                    <Badge variant={getStatusColor(job.status)} className="text-xs">
                      {job.status}
                    </Badge>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 overflow-auto">
        {selectedJob ? (
          <div className="p-6 space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(selectedJob.status)}
                  <h2 className="text-xl font-bold font-mono">{selectedJob.id}</h2>
                </div>
                <p className="text-muted-foreground text-sm mt-1">
                  Base model: {selectedJob.baseModel}
                </p>
              </div>
              {['running', 'validating_files', 'queued'].includes(selectedJob.status) && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleCancelJob(selectedJob.id)}
                  disabled={isLoading}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge variant={getStatusColor(selectedJob.status)} className="text-sm">
                    {selectedJob.status}
                  </Badge>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Trained Tokens
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {selectedJob.trainedTokens?.toLocaleString() || '-'}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Created
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm">
                    {new Date(selectedJob.createdAt).toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            </div>

            {selectedJob.fineTunedModel && (
              <Card className="border-green-500/30 bg-green-500/5">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    Fine-Tuned Model Ready
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <code className="text-sm bg-muted px-2 py-1 rounded">
                    {selectedJob.fineTunedModel}
                  </code>
                </CardContent>
              </Card>
            )}

            {selectedJob.error && (
              <Card className="border-destructive/30 bg-destructive/5">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-destructive">
                    <XCircle className="h-5 w-5" />
                    Training Failed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-destructive">{selectedJob.error.message}</p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingDown className="h-5 w-5" />
                  Training Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                {formattedChartData.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={formattedChartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="name" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="trainingLoss"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          dot={false}
                          name="Training Loss"
                        />
                        <Line
                          type="monotone"
                          dataKey="validationLoss"
                          stroke="hsl(var(--destructive))"
                          strokeWidth={2}
                          dot={false}
                          name="Validation Loss"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    {['running', 'validating_files'].includes(selectedJob.status) ? (
                      <div className="text-center">
                        <Activity className="h-8 w-8 mx-auto mb-2 animate-pulse" />
                        <p>Training in progress...</p>
                        <p className="text-xs">Metrics will appear as training proceeds</p>
                      </div>
                    ) : (
                      <p>No training metrics available</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Hyperparameters</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Epochs</p>
                    <p className="font-medium">{selectedJob.hyperparameters.n_epochs}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Batch Size</p>
                    <p className="font-medium">{selectedJob.hyperparameters.batch_size}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Learning Rate Multiplier</p>
                    <p className="font-medium">
                      {selectedJob.hyperparameters.learning_rate_multiplier}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Cpu className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Select a Training Job</h3>
              <p className="text-muted-foreground text-sm">
                Choose a job from the list or start a new one
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
