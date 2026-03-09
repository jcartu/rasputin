import { AnimatePresence, motion } from 'framer-motion';
import { Brain, CheckCircle2, Clock, Loader2, X, XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useResearchStore } from '@/lib/researchStore';
import { cn } from '@/lib/utils';

type ResearchQueryStatus = 'pending' | 'running' | 'completed' | 'error';

type ResearchQuery = {
  id: string;
  query: string;
  status: ResearchQueryStatus;
  result?: string;
};

type ResearchPanelProps = {
  queries: ResearchQuery[];
  isActive: boolean;
  onClose: () => void;
};

const STATUS_STYLES: Record<ResearchQueryStatus, {
  label: string;
  icon: typeof Clock;
  iconClass: string;
  pillClass: string;
}> = {
  pending: {
    label: 'Queued',
    icon: Clock,
    iconClass: 'text-muted-foreground',
    pillClass: 'bg-muted/50 text-muted-foreground border-muted/40',
  },
  running: {
    label: 'Running',
    icon: Loader2,
    iconClass: 'text-primary',
    pillClass: 'bg-primary/10 text-primary border-primary/30',
  },
  completed: {
    label: 'Complete',
    icon: CheckCircle2,
    iconClass: 'text-emerald-500',
    pillClass: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
  },
  error: {
    label: 'Error',
    icon: XCircle,
    iconClass: 'text-rose-500',
    pillClass: 'bg-rose-500/10 text-rose-500 border-rose-500/30',
  },
};

export function ResearchPanel({ queries, isActive, onClose }: ResearchPanelProps) {
  const synthesis = useResearchStore((state) => state.synthesis);
  const total = queries.length;
  const completed = queries.filter((query) => query.status === 'completed').length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
  const allComplete = total > 0 && completed === total;

  return (
    <Card
      variant="glass"
      className={cn(
        'relative overflow-hidden border-primary/20 bg-gradient-to-br from-background/80 via-background/60 to-background/40',
        !isActive && 'pointer-events-none opacity-60'
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.12),_transparent_55%)]" />
      <div className="relative space-y-5 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Wide Research</p>
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-foreground">Parallel query tracker</h3>
              <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                {progress}%
              </span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close research panel">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted/40">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-primary via-accent to-primary"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {completed} of {total} queries complete
          </p>
        </div>

        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {queries.map((query) => {
              const status = STATUS_STYLES[query.status];
              const Icon = status.icon;

              return (
                <motion.div
                  key={query.id}
                  layout
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -12, scale: 0.98 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="rounded-2xl border border-border/60 bg-card/80 p-4 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full border border-border/40 bg-background/70">
                      <Icon
                        className={cn(
                          'h-4 w-4',
                          status.iconClass,
                          query.status === 'running' && 'animate-spin'
                        )}
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">{query.query}</p>
                        <span
                          className={cn(
                            'rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                            status.pillClass
                          )}
                        >
                          {status.label}
                        </span>
                      </div>
                      {query.status === 'completed' && query.result ? (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {query.result}
                        </p>
                      ) : null}
                      {query.status === 'running' ? (
                        <p className="text-xs text-muted-foreground">Scanning sources and extracting highlights...</p>
                      ) : null}
                      {query.status === 'pending' ? (
                        <p className="text-xs text-muted-foreground">Queued for retrieval.</p>
                      ) : null}
                      {query.status === 'error' ? (
                        <p className="text-xs text-rose-500">Encountered an error. Retrying soon.</p>
                      ) : null}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {allComplete ? (
          <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-primary/20 bg-primary/5 p-4"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Brain className="h-4 w-4 text-primary" />
              {synthesis ? 'Synthesis complete' : 'Synthesizing results...'}
            </div>
            {synthesis ? (
              <p className="mt-2 text-sm text-muted-foreground line-clamp-4">{synthesis}</p>
            ) : null}
          </motion.div>
        ) : null}
      </div>
    </Card>
  );
}
