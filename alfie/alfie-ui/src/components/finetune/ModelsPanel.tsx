'use client';

import { useState } from 'react';
import { useFineTuneStore, ModelVersion } from '@/lib/finetune-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Plus,
  CheckCircle,
  GitBranch,
  Tag,
  Calendar,
  Sparkles,
  Copy,
} from 'lucide-react';

export function ModelsPanel() {
  const {
    versions,
    jobs,
    selectedVersion,
    selectVersion,
    registerVersion,
    activateVersion,
    isLoading,
  } = useFineTuneStore();

  const [isRegisterDialogOpen, setIsRegisterDialogOpen] = useState(false);
  const [newModelId, setNewModelId] = useState('');
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newTags, setNewTags] = useState('');

  const succeededJobs = jobs.filter(j => j.status === 'succeeded' && j.fineTunedModel);

  const handleRegister = async () => {
    if (!newModelId.trim() || !newName.trim()) return;
    
    await registerVersion({
      modelId: newModelId,
      name: newName,
      description: newDescription,
      tags: newTags.split(',').map(t => t.trim()).filter(Boolean),
    });
    
    setIsRegisterDialogOpen(false);
    setNewModelId('');
    setNewName('');
    setNewDescription('');
    setNewTags('');
  };

  const handleActivate = async (id: string) => {
    await activateVersion(id);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="h-full flex">
      <div className="w-80 border-r flex flex-col">
        <div className="p-4 border-b">
          <Dialog open={isRegisterDialogOpen} onOpenChange={setIsRegisterDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Register Model
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Register Model Version</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {succeededJobs.length > 0 && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm font-medium mb-2">Recent fine-tuned models:</p>
                    {succeededJobs.slice(0, 3).map(job => (
                      <button
                        key={job.id}
                        type="button"
                        onClick={() => setNewModelId(job.fineTunedModel || '')}
                        className="w-full text-left text-xs p-2 rounded hover:bg-background transition-colors font-mono truncate"
                      >
                        {job.fineTunedModel}
                      </button>
                    ))}
                  </div>
                )}
                
                <div>
                  <label className="text-sm font-medium block mb-1">Model ID</label>
                  <Input
                    value={newModelId}
                    onChange={(e) => setNewModelId(e.target.value)}
                    placeholder="ft:gpt-4o-mini:org:name:id"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    The OpenAI model ID from a completed fine-tuning job
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium block mb-1">Version Name</label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="v1.0 - Customer Support"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium block mb-1">Description</label>
                  <Input
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Trained on support conversations"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium block mb-1">Tags (comma-separated)</label>
                  <Input
                    value={newTags}
                    onChange={(e) => setNewTags(e.target.value)}
                    placeholder="production, support, v1"
                  />
                </div>

                <Button
                  onClick={handleRegister}
                  disabled={!newModelId.trim() || !newName.trim() || isLoading}
                  className="w-full"
                >
                  Register Version
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {versions.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4 text-center">
                No model versions registered yet
              </p>
            ) : (
              versions.map((version) => (
                <button
                  key={version.id}
                  type="button"
                  onClick={() => selectVersion(version)}
                  className={`w-full p-3 text-left rounded-lg transition-colors ${
                    selectedVersion?.id === version.id
                      ? 'bg-primary/10 border border-primary/30'
                      : 'hover:bg-muted'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {version.isActive && (
                          <Sparkles className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                        )}
                        <p className="font-medium text-sm truncate">{version.name}</p>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono truncate">
                        {version.modelId.slice(0, 30)}...
                      </p>
                    </div>
                    {version.isActive && (
                      <Badge variant="default" className="text-xs bg-yellow-500">
                        Active
                      </Badge>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 overflow-auto">
        {selectedVersion ? (
          <div className="p-6 space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  {selectedVersion.isActive && (
                    <Sparkles className="h-5 w-5 text-yellow-500" />
                  )}
                  <h2 className="text-xl font-bold">{selectedVersion.name}</h2>
                </div>
                <p className="text-muted-foreground text-sm mt-1">
                  {selectedVersion.description || 'No description'}
                </p>
              </div>
              {!selectedVersion.isActive && (
                <Button
                  onClick={() => handleActivate(selectedVersion.id)}
                  disabled={isLoading}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Set as Active
                </Button>
              )}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Model ID</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm bg-muted px-3 py-2 rounded font-mono">
                    {selectedVersion.modelId}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(selectedVersion.modelId)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Created
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm">
                    {new Date(selectedVersion.createdAt).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <GitBranch className="h-4 w-4" />
                    Base Model
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm font-mono">
                    {selectedVersion.baseModel || '-'}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedVersion.isActive ? (
                    <Badge variant="default" className="bg-yellow-500">Active</Badge>
                  ) : (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </CardContent>
              </Card>
            </div>

            {selectedVersion.tags.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Tag className="h-5 w-5" />
                    Tags
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {selectedVersion.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedVersion.metrics?.summary && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Training Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Final Training Loss</p>
                      <p className="text-lg font-medium">
                        {selectedVersion.metrics.summary.finalTrainingLoss?.toFixed(4)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Min Training Loss</p>
                      <p className="text-lg font-medium">
                        {selectedVersion.metrics.summary.minTrainingLoss?.toFixed(4)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Avg Training Loss</p>
                      <p className="text-lg font-medium">
                        {selectedVersion.metrics.summary.avgTrainingLoss?.toFixed(4)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Steps</p>
                      <p className="text-lg font-medium">
                        {selectedVersion.metrics.summary.totalSteps}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <GitBranch className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Select a Model Version</h3>
              <p className="text-muted-foreground text-sm">
                Choose a version from the list or register a new one
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
