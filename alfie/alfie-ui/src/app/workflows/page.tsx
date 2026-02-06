'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Plus,
  Play,
  Pause,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  FileEdit,
  Zap,
  LayoutTemplate,
} from 'lucide-react';
import { useWorkflowStore, Workflow, WorkflowTemplate } from '@/lib/workflowStore';

const statusColors: Record<string, { bg: string; text: string; icon: typeof Clock }> = {
  draft: { bg: 'bg-zinc-500/20', text: 'text-zinc-400', icon: FileEdit },
  active: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', icon: Play },
  paused: { bg: 'bg-amber-500/20', text: 'text-amber-400', icon: Pause },
  completed: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: CheckCircle2 },
  failed: { bg: 'bg-red-500/20', text: 'text-red-400', icon: XCircle },
};

export default function WorkflowsPage() {
  const router = useRouter();
  const [showTemplates, setShowTemplates] = useState(false);
  const {
    workflows,
    templates,
    isLoading,
    loadWorkflows,
    loadTemplates,
    loadWorkflow,
    newWorkflow,
    deleteWorkflow,
    updateWorkflowStatus,
    createFromTemplate,
  } = useWorkflowStore();

  useEffect(() => {
    loadWorkflows();
    loadTemplates();
  }, [loadWorkflows, loadTemplates]);

  const handleNewWorkflow = () => {
    newWorkflow();
    router.push('/workflows/builder');
  };

  const handleEditWorkflow = (workflow: Workflow) => {
    loadWorkflow(workflow);
    router.push('/workflows/builder');
  };

  const handleCreateFromTemplate = async (template: WorkflowTemplate) => {
    const workflow = await createFromTemplate(template.id);
    if (workflow) {
      loadWorkflow(workflow);
      router.push('/workflows/builder');
    }
  };

  const handleToggleStatus = async (workflow: Workflow) => {
    const newStatus = workflow.status === 'active' ? 'paused' : 'active';
    await updateWorkflowStatus(workflow.id, newStatus);
  };

  return (
    <div className="min-h-screen bg-zinc-950 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Workflows</h1>
            <p className="text-zinc-400 mt-1">Automate tasks with visual workflows</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowTemplates(!showTemplates)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
            >
              <LayoutTemplate className="w-4 h-4" />
              Templates
            </button>
            <button
              type="button"
              onClick={handleNewWorkflow}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Workflow
            </button>
          </div>
        </div>

        {showTemplates && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-8"
          >
            <h2 className="text-lg font-semibold text-white mb-4">Start from a Template</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((template) => (
                <motion.button
                  key={template.id}
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleCreateFromTemplate(template)}
                  className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-emerald-500/50 text-left transition-all"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-emerald-500/20">
                      <Zap className="w-4 h-4 text-emerald-400" />
                    </div>
                    <h3 className="font-semibold text-white">{template.name}</h3>
                  </div>
                  <p className="text-sm text-zinc-400">{template.description}</p>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : workflows.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-800 flex items-center justify-center">
              <Zap className="w-8 h-8 text-zinc-600" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">No workflows yet</h2>
            <p className="text-zinc-400 mb-6">Create your first workflow to automate tasks</p>
            <button
              type="button"
              onClick={handleNewWorkflow}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create Workflow
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {workflows.map((workflow) => {
              const status = statusColors[workflow.status] || statusColors.draft;
              const StatusIcon = status.icon;
              
              return (
                <motion.div
                  key={workflow.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${status.bg}`}>
                        <StatusIcon className={`w-5 h-5 ${status.text}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">{workflow.name}</h3>
                        <p className="text-sm text-zinc-500">
                          {workflow.description || 'No description'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${status.bg} ${status.text}`}>
                        {workflow.status}
                      </span>
                      
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(workflow)}
                        className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
                        title={workflow.status === 'active' ? 'Pause' : 'Activate'}
                      >
                        {workflow.status === 'active' ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => handleEditWorkflow(workflow)}
                        className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
                        title="Edit"
                      >
                        <FileEdit className="w-4 h-4" />
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => deleteWorkflow(workflow.id)}
                        className="p-2 rounded-lg text-zinc-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="mt-3 pt-3 border-t border-zinc-800 flex items-center gap-4 text-xs text-zinc-500">
                    <span>Created: {new Date(workflow.createdAt).toLocaleDateString()}</span>
                    <span>Updated: {new Date(workflow.updatedAt).toLocaleDateString()}</span>
                    {workflow.webhookId && (
                      <span className="text-emerald-400">Webhook enabled</span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
