'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Brain,
  Terminal,
  Globe,
  FileText,
  Monitor,
  Check,
  X,
  Clock,
  Eye,
  Zap,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface TaskStep {
  stepNumber: number;
  type: string;
  toolName: string | null;
  toolInput: Record<string, unknown> | null;
  toolOutput: string | null;
  thinking: string | null;
  tokensUsed: number | null;
  durationMs: number | null;
  status: string;
  error: string | null;
  createdAt: string;
}

interface SharedTaskData {
  task: {
    status: string;
    taskType: string;
    input: string;
    output: string | null;
    error: string | null;
    progress: number;
    currentStep: number;
    maxSteps: number;
    model: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
    completedAt: string | null;
  };
  steps: TaskStep[];
  share: {
    createdAt: string;
    expiresAt: string | null;
    viewCount: number;
  };
}

const TOOL_ICONS: Record<string, typeof Terminal> = {
  execute_code: Terminal,
  web_search: Globe,
  file_operations: FileText,
  browser: Monitor,
};

const STATUS_COLORS: Record<string, string> = {
  completed: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  failed: 'text-red-400 bg-red-500/10 border-red-500/30',
  cancelled: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  running: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
};

export default function SharedTaskReplayPage() {
  const params = useParams();
  const token = params.token as string;

  const [data, setData] = useState<SharedTaskData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function fetchTask() {
      try {
        const res = await fetch(`${API_BASE}/api/shared/task/${token}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Not found' }));
          setError(err.error || `HTTP ${res.status}`);
          return;
        }
        const result = await res.json();
        setData(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    if (token) fetchTask();
  }, [token]);

  const totalSteps = data?.steps.length ?? 0;

  const playStep = useCallback(() => {
    setCurrentStepIndex((prev) => {
      const next = prev + 1;
      if (next >= totalSteps) {
        setIsPlaying(false);
        return prev;
      }
      setExpandedSteps((s) => new Set([...s, next]));
      return next;
    });
  }, [totalSteps]);

  useEffect(() => {
    if (isPlaying) {
      const baseDelay = 1200;
      timerRef.current = setTimeout(playStep, baseDelay / playbackSpeed);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, playStep, playbackSpeed]);

  const handlePlay = () => {
    if (currentStepIndex >= totalSteps - 1) {
      setCurrentStepIndex(-1);
      setExpandedSteps(new Set());
    }
    setIsPlaying(true);
  };

  const handlePause = () => setIsPlaying(false);

  const handleNext = () => {
    if (currentStepIndex < totalSteps - 1) {
      const next = currentStepIndex + 1;
      setCurrentStepIndex(next);
      setExpandedSteps((s) => new Set([...s, next]));
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const toggleStepExpanded = (index: number) => {
    setExpandedSteps((s) => {
      const next = new Set(s);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const cycleSpeed = () => {
    setPlaybackSpeed((s) => (s >= 4 ? 0.5 : s * 2));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <Sparkles className="w-8 h-8 text-primary" />
          </motion.div>
          <p className="text-muted-foreground">Loading shared task...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <X className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Task Not Found</h1>
          <p className="text-muted-foreground">{error || 'This shared task does not exist or has expired.'}</p>
        </div>
      </div>
    );
  }

  const { task, steps, share } = data;
  const visibleSteps = steps.slice(0, currentStepIndex + 1);
  const progress = totalSteps > 0 ? ((currentStepIndex + 1) / totalSteps) * 100 : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold gradient-text">ALFIE Agent Replay</h1>
              <p className="text-xs text-muted-foreground">
                {share.viewCount} views &middot; Shared {new Date(share.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <Badge variant="outline" className={cn('text-xs', STATUS_COLORS[task.status] || '')}>
            {task.status}
          </Badge>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="rounded-xl border border-border/50 bg-card/50 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-muted-foreground">Task Input</p>
              <p className="text-foreground mt-1">{task.input}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(task.createdAt).toLocaleString()}
            </span>
            {task.model && (
              <span className="flex items-center gap-1">
                <Brain className="w-3 h-3" />
                {task.model}
              </span>
            )}
            <span>{steps.length} steps</span>
          </div>
        </div>

        <div className="rounded-xl border border-border/50 bg-card/50 p-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handlePrev} disabled={currentStepIndex <= 0}>
                <SkipBack className="w-4 h-4" />
              </Button>
              {isPlaying ? (
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handlePause}>
                  <Pause className="w-4 h-4" />
                </Button>
              ) : (
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handlePlay}>
                  <Play className="w-4 h-4" />
                </Button>
              )}
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleNext} disabled={currentStepIndex >= totalSteps - 1}>
                <SkipForward className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex-1">
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>

            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs font-mono" onClick={cycleSpeed}>
              {playbackSpeed}x
            </Button>

            <span className="text-xs text-muted-foreground tabular-nums w-16 text-right">
              {Math.max(0, currentStepIndex + 1)}/{totalSteps}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {visibleSteps.map((step, i) => {
              const isExpanded = expandedSteps.has(i);
              const isCurrent = i === currentStepIndex;
              const ToolIcon = (step.toolName && TOOL_ICONS[step.toolName]) || Terminal;

              return (
                <motion.div
                  key={`step-${step.stepNumber}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={cn(
                    'rounded-xl border bg-card/50 overflow-hidden transition-colors',
                    isCurrent ? 'border-primary/50 shadow-[0_0_15px_hsl(var(--primary)/0.1)]' : 'border-border/50'
                  )}
                >
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors text-left"
                    onClick={() => toggleStepExpanded(i)}
                  >
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                      step.type === 'thinking' ? 'bg-violet-500/10' : step.status === 'completed' ? 'bg-emerald-500/10' : 'bg-blue-500/10'
                    )}>
                      {step.type === 'thinking' ? (
                        <Brain className={cn('w-4 h-4', isCurrent && isPlaying ? 'animate-pulse' : '', 'text-violet-400')} />
                      ) : step.status === 'completed' ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : step.status === 'error' ? (
                        <X className="w-4 h-4 text-red-400" />
                      ) : (
                        <ToolIcon className="w-4 h-4 text-blue-400" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-foreground">
                        {step.type === 'thinking' ? 'Thinking' : step.toolName || 'Tool Call'}
                      </span>
                      <span className="text-xs text-muted-foreground ml-2">Step {step.stepNumber}</span>
                    </div>

                    {step.durationMs != null && (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {step.durationMs < 1000 ? `${step.durationMs}ms` : `${(step.durationMs / 1000).toFixed(1)}s`}
                      </span>
                    )}

                    {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-3 pb-3 space-y-2 border-t border-border/30 pt-2">
                          {step.thinking && (
                            <div>
                              <span className="text-xs text-muted-foreground">Thinking:</span>
                              <pre className="mt-1 p-2 rounded-lg bg-muted/30 text-sm text-foreground/80 whitespace-pre-wrap max-h-48 overflow-y-auto">
                                {step.thinking}
                              </pre>
                            </div>
                          )}
                          {step.toolInput && (
                            <div>
                              <span className="text-xs text-muted-foreground">Input:</span>
                              <pre className="mt-1 p-2 rounded-lg bg-muted/30 text-xs overflow-x-auto max-h-32">
                                {JSON.stringify(step.toolInput, null, 2)}
                              </pre>
                            </div>
                          )}
                          {step.toolOutput && (
                            <div>
                              <span className="text-xs text-muted-foreground">Output:</span>
                              <pre className="mt-1 p-2 rounded-lg bg-muted/20 text-xs overflow-x-auto max-h-48 border-l-2 border-emerald-500/30">
                                {step.toolOutput.slice(0, 3000)}
                              </pre>
                            </div>
                          )}
                          {step.error && (
                            <div className="p-2 rounded-lg bg-red-500/5 border border-red-500/20 text-xs text-red-400">
                              {step.error}
                            </div>
                          )}
                          {step.tokensUsed != null && (
                            <span className="text-xs text-muted-foreground">{step.tokensUsed.toLocaleString()} tokens</span>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {currentStepIndex >= totalSteps - 1 && task.output && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <Check className="w-5 h-5 text-emerald-400" />
              <span className="text-sm font-medium text-emerald-400">Task Output</span>
            </div>
            <div className="text-sm text-foreground/90 whitespace-pre-wrap">
              {task.output}
            </div>
          </motion.div>
        )}

        {currentStepIndex >= totalSteps - 1 && task.error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-red-500/30 bg-red-500/5 p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <X className="w-5 h-5 text-red-400" />
              <span className="text-sm font-medium text-red-400">Task Failed</span>
            </div>
            <div className="text-sm text-red-400/80">
              {task.error}
            </div>
          </motion.div>
        )}
      </div>

      <footer className="border-t border-border/50 mt-12 py-6">
        <div className="max-w-4xl mx-auto px-4 text-center text-xs text-muted-foreground">
          Powered by <span className="gradient-text font-medium">ALFIE</span> &middot; AI Assistant Platform
        </div>
      </footer>
    </div>
  );
}
