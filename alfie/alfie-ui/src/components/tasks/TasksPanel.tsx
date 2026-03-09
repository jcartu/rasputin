'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, CheckCircle2, XCircle, Clock, AlertCircle,
  ChevronDown, ChevronRight, Share2, Zap, ArrowLeft,
  Brain, Wrench, Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/apiClient';
import { formatDistanceToNow } from 'date-fns';

interface AgentStep {
  id: string;
  task_id: string;
  step_number: number;
  type: string;
  tool_name: string | null;
  tool_input: Record<string, unknown> | null;
  tool_output: Record<string, unknown> | null;
  thinking: string | null;
  tokens_used: number;
  duration_ms: number;
  status: string;
  error: string | null;
  created_at: string;
}

interface AgentTask {
  id: string;
  user_id: string;
  status: string;
  task_type: string;
  input: string;
  output: string | null;
  error: string | null;
  progress: number;
  current_step: number;
  max_steps: number;
  model: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  completed: { icon: CheckCircle2, color: 'text-green-400', label: 'Completed' },
  failed: { icon: XCircle, color: 'text-red-400', label: 'Failed' },
  running: { icon: Loader2, color: 'text-blue-400', label: 'Running' },
  pending: { icon: Clock, color: 'text-yellow-400', label: 'Pending' },
  cancelled: { icon: AlertCircle, color: 'text-muted-foreground', label: 'Cancelled' },
  thinking: { icon: Brain, color: 'text-purple-400', label: 'Thinking' },
  acting: { icon: Wrench, color: 'text-orange-400', label: 'Acting' },
  observing: { icon: Eye, color: 'text-cyan-400', label: 'Observing' },
};

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] || STATUS_CONFIG.pending;
}

export function TasksPanel() {
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<AgentTask | null>(null);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [sharing, setSharing] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/agent/tasks?limit=50');
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch (e) {
      console.error('Failed to load tasks:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const loadDetail = useCallback(async (task: AgentTask) => {
    setSelectedTask(task);
    setDetailLoading(true);
    setExpandedSteps(new Set());
    try {
      const res = await apiFetch(`/api/agent/${task.id}`);
      if (res.ok) {
        const data = await res.json();
        setSteps(data.steps || []);
        if (data.task) setSelectedTask(data.task);
      }
    } catch (e) {
      console.error('Failed to load task detail:', e);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const toggleStep = useCallback((stepId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  }, []);

  const handleShare = useCallback(async (taskId: string) => {
    setSharing(taskId);
    try {
      const res = await apiFetch(`/api/agent/${taskId}/share`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        const url = `${window.location.origin}/share/task/${data.token}`;
        await navigator.clipboard.writeText(url);
      }
    } catch (e) {
      console.error('Failed to share task:', e);
    } finally {
      setSharing(null);
    }
  }, []);

  if (selectedTask) {
    const config = getStatusConfig(selectedTask.status);
    const StatusIcon = config.icon;

    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="border-b border-border/50 bg-card/50 backdrop-blur-sm p-6">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 mb-3 -ml-2"
            onClick={() => setSelectedTask(null)}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Tasks
          </Button>
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <StatusIcon className={cn('w-5 h-5', config.color, selectedTask.status === 'running' && 'animate-spin')} />
                <Badge variant="secondary" className="text-xs">{config.label}</Badge>
                {selectedTask.model && (
                  <Badge variant="outline" className="text-[10px]">{selectedTask.model}</Badge>
                )}
              </div>
              <p className="text-sm mt-2 line-clamp-2">{selectedTask.input}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 ml-4"
              onClick={() => handleShare(selectedTask.id)}
              disabled={sharing === selectedTask.id}
            >
              {sharing === selectedTask.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
              Share
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-4">
            {selectedTask.output && (
              <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4">
                <p className="text-xs font-medium text-green-400 mb-2">Output</p>
                <p className="text-sm whitespace-pre-wrap">{selectedTask.output}</p>
              </div>
            )}
            {selectedTask.error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4">
                <p className="text-xs font-medium text-red-400 mb-2">Error</p>
                <p className="text-sm whitespace-pre-wrap">{selectedTask.error}</p>
              </div>
            )}

            <div>
              <h3 className="text-sm font-medium mb-3">
                Steps ({steps.length})
              </h3>
              {detailLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : steps.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No steps recorded</p>
              ) : (
                <div className="space-y-2">
                  {steps.map((step) => {
                    const stepConfig = getStatusConfig(step.type === 'tool_call' ? 'acting' : step.type === 'thinking' ? 'thinking' : 'observing');
                    const StepIcon = stepConfig.icon;
                    const isExpanded = expandedSteps.has(step.id);
                    return (
                      <div key={step.id} className="rounded-lg border border-border/50 bg-card/30">
                        <button
                          type="button"
                          className="w-full flex items-center gap-3 p-3 text-left"
                          onClick={() => toggleStep(step.id)}
                        >
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                          <StepIcon className={cn('w-4 h-4 shrink-0', stepConfig.color)} />
                          <span className="text-sm font-medium flex-1">
                            Step {step.step_number}
                            {step.tool_name && <span className="text-muted-foreground font-normal ml-2">{step.tool_name}</span>}
                          </span>
                          {step.duration_ms > 0 && (
                            <span className="text-[10px] text-muted-foreground">{(step.duration_ms / 1000).toFixed(1)}s</span>
                          )}
                        </button>
                        {isExpanded && (
                          <div className="px-3 pb-3 pt-0 space-y-2 border-t border-border/30 mt-0">
                            {step.thinking && (
                              <div className="mt-2">
                                <p className="text-[10px] uppercase text-muted-foreground mb-1">Thinking</p>
                                <p className="text-xs whitespace-pre-wrap bg-muted/20 rounded p-2">{step.thinking}</p>
                              </div>
                            )}
                            {step.tool_input && (
                              <div>
                                <p className="text-[10px] uppercase text-muted-foreground mb-1">Input</p>
                                <pre className="text-xs overflow-x-auto bg-muted/20 rounded p-2">{JSON.stringify(step.tool_input, null, 2)}</pre>
                              </div>
                            )}
                            {step.tool_output && (
                              <div>
                                <p className="text-[10px] uppercase text-muted-foreground mb-1">Output</p>
                                <pre className="text-xs overflow-x-auto bg-muted/20 rounded p-2 max-h-48">{typeof step.tool_output === 'string' ? step.tool_output : JSON.stringify(step.tool_output, null, 2)}</pre>
                              </div>
                            )}
                            {step.error && (
                              <div>
                                <p className="text-[10px] uppercase text-red-400 mb-1">Error</p>
                                <p className="text-xs text-red-400 bg-red-500/10 rounded p-2">{step.error}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="border-b border-border/50 bg-card/50 backdrop-blur-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold gradient-text">Agent Tasks</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Browse and inspect agent task execution history
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadTasks} className="gap-1.5">
            <Zap className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Zap className="w-12 h-12 mb-4 opacity-30" />
              <p className="font-medium">No agent tasks yet</p>
              <p className="text-sm mt-1">Run an agent task from chat or skills to see it here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => {
                const config = getStatusConfig(task.status);
                const StatusIcon = config.icon;
                return (
                  <button
                    key={task.id}
                    type="button"
                    className="w-full rounded-xl border border-border/50 bg-card/50 p-4 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 text-left"
                    onClick={() => loadDetail(task)}
                  >
                    <div className="flex items-start gap-3">
                      <StatusIcon className={cn('w-5 h-5 mt-0.5 shrink-0', config.color, task.status === 'running' && 'animate-spin')} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm line-clamp-1">{task.input}</p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <Badge variant="secondary" className="text-[10px]">{config.label}</Badge>
                          {task.model && (
                            <span className="text-[10px] text-muted-foreground">{task.model}</span>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            Step {task.current_step}/{task.max_steps}
                          </span>
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
