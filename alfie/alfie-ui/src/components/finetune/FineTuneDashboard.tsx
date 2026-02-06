'use client';

import { useEffect } from 'react';
import { useFineTuneStore } from '@/lib/finetune-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Database, Cpu, GitBranch, TestTube, Activity, CheckCircle, XCircle, Clock } from 'lucide-react';
import { DatasetManager } from './DatasetManager';
import { JobsPanel } from './JobsPanel';
import { ModelsPanel } from './ModelsPanel';
import { EvaluationsPanel } from './EvaluationsPanel';

export function FineTuneDashboard() {
  const {
    dashboard,
    activeTab,
    setActiveTab,
    fetchDashboard,
    fetchDatasets,
    fetchJobs,
    fetchVersions,
    fetchEvaluations,
    fetchPresets,
    fetchSupportedModels,
    isLoading,
    error,
  } = useFineTuneStore();

  useEffect(() => {
    fetchDashboard();
    fetchPresets();
    fetchSupportedModels();
  }, [fetchDashboard, fetchPresets, fetchSupportedModels]);

  useEffect(() => {
    if (activeTab === 'datasets') fetchDatasets();
    if (activeTab === 'jobs') fetchJobs();
    if (activeTab === 'models') fetchVersions();
    if (activeTab === 'evaluations') fetchEvaluations();
  }, [activeTab, fetchDatasets, fetchJobs, fetchVersions, fetchEvaluations]);

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case 'succeeded':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
      case 'validating_files':
        return <Activity className="h-4 w-4 text-blue-500 animate-pulse" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="border-b px-6 py-4">
        <h1 className="text-2xl font-bold">Model Fine-Tuning</h1>
        <p className="text-muted-foreground text-sm">
          Create custom models trained on your data
        </p>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-3 bg-destructive/10 border border-destructive/30 rounded-md text-destructive text-sm">
          {error}
        </div>
      )}

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as typeof activeTab)}
        className="flex-1 flex flex-col"
      >
        <TabsList className="mx-6 mt-4 w-fit">
          <TabsTrigger value="dashboard" className="gap-2">
            <Activity className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="datasets" className="gap-2">
            <Database className="h-4 w-4" />
            Datasets
          </TabsTrigger>
          <TabsTrigger value="jobs" className="gap-2">
            <Cpu className="h-4 w-4" />
            Jobs
          </TabsTrigger>
          <TabsTrigger value="models" className="gap-2">
            <GitBranch className="h-4 w-4" />
            Models
          </TabsTrigger>
          <TabsTrigger value="evaluations" className="gap-2">
            <TestTube className="h-4 w-4" />
            Evaluations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="flex-1 p-6 overflow-auto">
          {isLoading && !dashboard ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : dashboard ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Datasets
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dashboard.datasets.total}</div>
                    <p className="text-xs text-muted-foreground">
                      {dashboard.datasets.validated} validated • {dashboard.datasets.totalExamples} examples
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Training Jobs
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dashboard.jobs.total}</div>
                    <div className="flex gap-2 mt-1">
                      {dashboard.jobs.running > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          <Activity className="h-3 w-3 mr-1 animate-pulse" />
                          {dashboard.jobs.running} running
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs text-green-600">
                        {dashboard.jobs.succeeded} succeeded
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Fine-Tuned Models
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dashboard.models.total}</div>
                    <p className="text-xs text-muted-foreground">
                      {dashboard.models.active} active
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-sm">Connected to OpenAI</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recent Jobs</CardTitle>
                </CardHeader>
                <CardContent>
                  {dashboard.recentJobs.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No training jobs yet</p>
                  ) : (
                    <div className="space-y-2">
                      {dashboard.recentJobs.map((job) => (
                        <div
                          key={job.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                        >
                          <div className="flex items-center gap-3">
                            <StatusIcon status={job.status} />
                            <div>
                              <p className="font-medium text-sm">{job.id.slice(0, 20)}...</p>
                              <p className="text-xs text-muted-foreground">{job.baseModel}</p>
                            </div>
                          </div>
                          <Badge variant={job.status === 'succeeded' ? 'default' : 'secondary'}>
                            {job.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('datasets')}
                      className="w-full p-3 text-left rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Database className="h-5 w-5 text-blue-500" />
                        <div>
                          <p className="font-medium text-sm">Create Dataset</p>
                          <p className="text-xs text-muted-foreground">
                            Build training data from sessions or import JSONL
                          </p>
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('jobs')}
                      className="w-full p-3 text-left rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Cpu className="h-5 w-5 text-purple-500" />
                        <div>
                          <p className="font-medium text-sm">Start Training</p>
                          <p className="text-xs text-muted-foreground">
                            Launch a new fine-tuning job with OpenAI
                          </p>
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('evaluations')}
                      className="w-full p-3 text-left rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <TestTube className="h-5 w-5 text-green-500" />
                        <div>
                          <p className="font-medium text-sm">Run Evaluation</p>
                          <p className="text-xs text-muted-foreground">
                            Test model performance against a dataset
                          </p>
                        </div>
                      </div>
                    </button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Getting Started</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ol className="space-y-3 text-sm">
                      <li className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs">
                          1
                        </span>
                        <div>
                          <p className="font-medium">Create a Dataset</p>
                          <p className="text-muted-foreground text-xs">
                            Build from chat sessions or import JSONL files
                          </p>
                        </div>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs">
                          2
                        </span>
                        <div>
                          <p className="font-medium">Validate & Upload</p>
                          <p className="text-muted-foreground text-xs">
                            Check for errors and upload to OpenAI
                          </p>
                        </div>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs">
                          3
                        </span>
                        <div>
                          <p className="font-medium">Start Training</p>
                          <p className="text-muted-foreground text-xs">
                            Configure hyperparameters and launch
                          </p>
                        </div>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs">
                          4
                        </span>
                        <div>
                          <p className="font-medium">Evaluate & Deploy</p>
                          <p className="text-muted-foreground text-xs">
                            Test performance and activate the model
                          </p>
                        </div>
                      </li>
                    </ol>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="datasets" className="flex-1 overflow-hidden">
          <DatasetManager />
        </TabsContent>

        <TabsContent value="jobs" className="flex-1 overflow-hidden">
          <JobsPanel />
        </TabsContent>

        <TabsContent value="models" className="flex-1 overflow-hidden">
          <ModelsPanel />
        </TabsContent>

        <TabsContent value="evaluations" className="flex-1 overflow-hidden">
          <EvaluationsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
