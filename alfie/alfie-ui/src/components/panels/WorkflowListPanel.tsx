'use client';

import { useEffect, useState } from 'react';
import { Play, Trash2, Plus, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWorkflowStore, type Workflow, type WorkflowTemplate } from '@/lib/workflowStore';
import { cn } from '@/lib/utils';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  active: 'bg-green-100 text-green-800',
  paused: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-blue-100 text-blue-800',
  failed: 'bg-red-100 text-red-800',
};

export function WorkflowListPanel() {
  const { workflows, templates, loadWorkflows, loadTemplates, executeWorkflow, deleteWorkflow, createFromTemplate } = useWorkflowStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeData = async () => {
      setIsLoading(true);
      await Promise.all([loadWorkflows(), loadTemplates()]);
      setIsLoading(false);
    };
    initializeData();
  }, [loadWorkflows, loadTemplates]);

  const handleExecute = async (workflowId: string) => {
    await executeWorkflow(workflowId);
  };

  const handleDelete = async (workflowId: string) => {
    if (confirm('Are you sure you want to delete this workflow?')) {
      await deleteWorkflow(workflowId);
    }
  };

  const handleCreateFromTemplate = async (templateId: string) => {
    await createFromTemplate(templateId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-xs text-muted-foreground">Loading workflows...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-2"
        onClick={() => {
          const newWorkflow = {
            id: `workflow-${Date.now()}`,
            name: 'New Workflow',
            description: '',
            nodes: [],
            edges: [],
            status: 'draft' as const,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          console.log('Create new workflow:', newWorkflow);
        }}
      >
        <Plus className="w-3.5 h-3.5" />
        <span className="text-xs">New Workflow</span>
      </Button>

      {workflows.length > 0 ? (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase">Saved Workflows</h4>
          <div className="space-y-2">
            {workflows.map((workflow) => (
              <div
                key={workflow.id}
                className="flex items-center justify-between gap-2 p-2 rounded-lg border border-border hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{workflow.name}</p>
                  <Badge
                    variant="secondary"
                    className={cn('text-xs mt-1', statusColors[workflow.status] || statusColors.draft)}
                  >
                    {workflow.status}
                  </Badge>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleExecute(workflow.id)}
                    title="Execute workflow"
                  >
                    <Play className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(workflow.id)}
                    title="Delete workflow"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground">No workflows yet</p>
        </div>
      )}

      {templates.length > 0 && (
        <div className="space-y-2 border-t border-border pt-4">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase">Templates</h4>
          <div className="space-y-2">
            {templates.map((template) => (
              <div
                key={template.id}
                className="flex items-center justify-between gap-2 p-2 rounded-lg border border-border hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{template.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{template.description}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleCreateFromTemplate(template.id)}
                  title="Use this template"
                >
                  <Zap className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
