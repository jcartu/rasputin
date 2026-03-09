'use client';

import { X, Brain, Wrench, Eye, Loader2 } from 'lucide-react';
import { useAgentStore } from '@/lib/agentStore';
import { Button } from '@/components/ui/button';

const STATUS_CONFIG: Record<string, { icon: typeof Brain; label: string; color: string }> = {
  pending: { icon: Loader2, label: 'Starting...', color: 'text-muted-foreground' },
  running: { icon: Loader2, label: 'Running...', color: 'text-primary' },
  thinking: { icon: Brain, label: 'Thinking...', color: 'text-violet-400' },
  acting: { icon: Wrench, label: 'Executing tool...', color: 'text-blue-400' },
  observing: { icon: Eye, label: 'Observing results...', color: 'text-emerald-400' },
};

export function AgentProgress() {
  const activeTask = useAgentStore((s) => s.activeTask);
  const isRunning = useAgentStore((s) => s.isRunning);
  const cancelTask = useAgentStore((s) => s.cancelTask);

  if (!activeTask || (!isRunning && activeTask.status !== 'completed' && activeTask.status !== 'failed')) return null;

  const config = STATUS_CONFIG[activeTask.status] || STATUS_CONFIG.running;
  const Icon = config.icon;
  const isActive = isRunning && !['completed', 'failed', 'cancelled'].includes(activeTask.status);

  return (
    <div className="border-b border-border bg-card/50 px-4 py-2 flex items-center gap-3">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Icon className={`w-4 h-4 ${config.color} ${isActive ? 'animate-pulse' : ''}`} />
        <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
        <span className="text-xs text-muted-foreground">
          Step {activeTask.iteration}/{activeTask.maxIterations}
        </span>
      </div>
      <div className="flex-1 max-w-xs">
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
            style={{ width: `${activeTask.progress}%` }}
          />
        </div>
      </div>
      <span className="text-xs text-muted-foreground w-8 text-right">{activeTask.progress}%</span>
      {isActive && (
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => cancelTask()}>
          <X className="w-3 h-3" />
        </Button>
      )}
    </div>
  );
}
