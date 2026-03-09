'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Zap,
  Search,
  Pencil,
  Eye,
  ChevronUp,
  ChevronDown,
  Activity,
  Loader2,
  CheckCircle2,
  XCircle,
  Wrench,
  Globe,
  FileText,
  Bot,
  Wifi,
  Clock,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { useActivityPhase, type ActivityPhase } from '@/hooks/useActivityPhase';
import { useActivityStore, type ActivityEventType, type ActivityStatus, type ActivityEvent } from '@/lib/activityStore';
import { cn } from '@/lib/utils';

const PHASE_CONFIG: Record<
  ActivityPhase['type'],
  { icon: React.ComponentType<{ className?: string }>; color: string; bg: string; label: string; gradient: string }
> = {
  think: { icon: Brain, color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Reasoning', gradient: 'from-amber-500/20 to-amber-600/5' },
  act: { icon: Zap, color: 'text-violet-400', bg: 'bg-violet-400/10', label: 'Executing', gradient: 'from-violet-500/20 to-violet-600/5' },
  search: { icon: Search, color: 'text-emerald-400', bg: 'bg-emerald-400/10', label: 'Searching', gradient: 'from-emerald-500/20 to-emerald-600/5' },
  stream: { icon: Pencil, color: 'text-primary', bg: 'bg-primary/10', label: 'Writing', gradient: 'from-primary/20 to-primary/5' },
  observe: { icon: Eye, color: 'text-cyan-400', bg: 'bg-cyan-400/10', label: 'Analyzing', gradient: 'from-cyan-500/20 to-cyan-600/5' },
};

const EVENT_ICONS: Record<ActivityEventType, React.ComponentType<{ className?: string }>> = {
  tool: Wrench,
  api: Globe,
  file: FileText,
  search: Search,
  model: Bot,
  memory: Brain,
  websocket: Wifi,
  thinking: Brain,
  background: Clock,
};

const EVENT_COLORS: Record<ActivityEventType, string> = {
  tool: 'text-violet-400',
  api: 'text-blue-400',
  file: 'text-amber-400',
  search: 'text-emerald-400',
  model: 'text-cyan-400',
  memory: 'text-pink-400',
  websocket: 'text-green-400',
  thinking: 'text-amber-400',
  background: 'text-slate-400',
};

const EVENT_BG: Record<ActivityEventType, string> = {
  tool: 'bg-violet-500/10',
  api: 'bg-blue-500/10',
  file: 'bg-amber-500/10',
  search: 'bg-emerald-500/10',
  model: 'bg-cyan-500/10',
  memory: 'bg-pink-500/10',
  websocket: 'bg-green-500/10',
  thinking: 'bg-amber-500/10',
  background: 'bg-slate-500/10',
};

const STATUS_ICONS: Record<ActivityStatus, React.ComponentType<{ className?: string }>> = {
  running: Loader2,
  success: CheckCircle2,
  error: XCircle,
};

const STATUS_COLORS: Record<ActivityStatus, string> = {
  running: 'text-blue-400',
  success: 'text-emerald-400',
  error: 'text-red-400',
};

function relativeTime(date: Date | string): string {
  const now = Date.now();
  const then = date instanceof Date ? date.getTime() : new Date(date).getTime();
  const diff = Math.max(0, Math.floor((now - then) / 1000));
  if (diff < 5) return 'now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function AnimatedDots() {
  return (
    <span className="inline-flex w-5 ml-0.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
          className="text-muted-foreground"
        >
          .
        </motion.span>
      ))}
    </span>
  );
}

function PhaseStep({ type, isActive, isCompleted }: { type: ActivityPhase['type']; isActive: boolean; isCompleted: boolean }) {
  const config = PHASE_CONFIG[type];
  const Icon = config.icon;

  return (
    <div className="flex flex-col items-center gap-1">
      <motion.div
        animate={isActive ? { scale: [1, 1.15, 1] } : {}}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300',
          isActive ? cn(config.bg, 'ring-1', `ring-${type === 'think' ? 'amber' : type === 'search' ? 'emerald' : type === 'act' ? 'violet' : type === 'stream' ? 'primary' : 'cyan'}-500/30`) :
          isCompleted ? 'bg-emerald-500/10' : 'bg-white/[0.03]'
        )}
      >
        {isCompleted ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        ) : (
          <Icon className={cn('w-4 h-4', isActive ? config.color : 'text-white/20')} />
        )}
      </motion.div>
      <span className={cn(
        'text-[9px] font-medium uppercase tracking-wider',
        isActive ? config.color : isCompleted ? 'text-emerald-400/60' : 'text-white/20'
      )}>
        {config.label}
      </span>
    </div>
  );
}

interface RichEventRowProps {
  event: ActivityEvent;
  index: number;
}

function RichEventRow({ event, index }: RichEventRowProps) {
  const Icon = EVENT_ICONS[event.type];
  const StatusIcon = STATUS_ICONS[event.status];
  const iconColor = EVENT_COLORS[event.type];
  const iconBg = EVENT_BG[event.type];
  const statusColor = STATUS_COLORS[event.status];

  return (
    <motion.div
      initial={{ opacity: 0, x: -16, y: 4 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.3, ease: 'easeOut' }}
      className="group/event"
    >
      <div className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.02]">
        <div className="flex flex-col items-center gap-1 pt-0.5">
          <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', iconBg)}>
            <Icon className={cn('w-3.5 h-3.5', iconColor)} />
          </div>
          {index < 14 && (
            <div className="w-px h-3 bg-white/[0.06]" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-medium text-white/80 truncate flex-1">
              {event.title}
            </span>
            <div className={cn('flex-shrink-0', statusColor)}>
              <StatusIcon className={cn('w-3.5 h-3.5', event.status === 'running' && 'animate-spin')} />
            </div>
          </div>

          {event.description && (
            <p className="text-[11px] text-white/35 mt-0.5 line-clamp-2 leading-relaxed">
              {event.description}
            </p>
          )}

          <div className="flex items-center gap-3 mt-1">
            <span className="text-[10px] text-white/20 font-mono tabular-nums">
              {relativeTime(event.timestamp)}
            </span>
            {event.duration !== undefined && (
              <span className="text-[10px] text-white/20 font-mono tabular-nums">
                {formatDuration(event.duration)}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function ActivityMonitor() {
  const { phase, isActive } = useActivityPhase();
  const events = useActivityStore((s) => s.events);

  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const userCollapsedRef = useRef(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const runningCount = useMemo(
    () => events.filter((e) => e.status === 'running').length,
    [events]
  );

  const completedCount = useMemo(
    () => events.filter((e) => e.status === 'success').length,
    [events]
  );

  const displayEvents = useMemo(() => events.slice(0, 15), [events]);

  const latestThinkingContent = useMemo(() => {
    const thinkingEvent = events.find((e) => e.type === 'thinking' && e.description);
    return thinkingEvent?.description || null;
  }, [events]);

  const activePhaseType = phase?.type || null;

  const completedPhases = useMemo(() => {
    const phases = new Set<string>();
    const seenTypes = new Set<string>();
    for (const event of events) {
      seenTypes.add(event.type);
      if (event.status === 'success') {
        if (event.type === 'thinking') phases.add('think');
        if (event.type === 'search') phases.add('search');
        if (event.type === 'tool') phases.add('act');
        if (event.type === 'model') phases.add('stream');
      }
    }
    if (seenTypes.has('thinking') && activePhaseType && activePhaseType !== 'think') {
      phases.add('think');
    }
    if (seenTypes.has('search') && activePhaseType && activePhaseType !== 'search') {
      phases.add('search');
    }
    if (activePhaseType === 'observe' || (seenTypes.has('tool') && activePhaseType === 'stream')) {
      phases.add('observe');
    }
    return phases;
  }, [events, activePhaseType]);

  useEffect(() => {
    if (isActive) {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      if (!isVisible) {
        userCollapsedRef.current = false;
        setIsExpanded(true);
      }
      setIsVisible(true);
    } else {
      hideTimerRef.current = setTimeout(() => {
        setIsVisible(false);
        setIsExpanded(false);
        userCollapsedRef.current = false;
      }, 8000);
    }

    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [isActive, isVisible]);

  const prevEventCountRef = useRef(events.length);
  useEffect(() => {
    if (events.length !== prevEventCountRef.current) {
      prevEventCountRef.current = events.length;
      if (isExpanded && scrollRef.current) {
        scrollRef.current.scrollTop = 0;
      }
    }
  });

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => {
      if (prev) userCollapsedRef.current = true;
      return !prev;
    });
  }, []);

  if (!isVisible) return null;

  const config = phase ? PHASE_CONFIG[phase.type] : null;
  const PhaseIcon = config?.icon || Activity;

  return (
    <div className="my-4">
      <AnimatePresence mode="wait">
        <motion.div
          key={isExpanded ? 'expanded' : 'pill'}
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          className="w-full"
        >
          {isExpanded ? (
            <div className={cn(
              'rounded-2xl overflow-hidden',
              'bg-slate-950/90 backdrop-blur-2xl',
              'border border-white/[0.08]',
              'shadow-2xl shadow-black/40',
              'ring-1 ring-white/[0.04]'
            )}>
              {/* Header with phase indicator */}
              <div className={cn(
                'flex items-center justify-between px-4 py-3',
                'border-b border-white/[0.06]',
                'bg-gradient-to-r',
                config?.gradient || 'from-primary/10 to-transparent'
              )}>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <motion.div
                      animate={isActive ? { rotate: [0, 360] } : {}}
                      transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                    >
                      <Terminal className="w-4 h-4 text-primary" />
                    </motion.div>
                    <span className="text-sm font-semibold text-white/90">
                      ALFIE Sandbox
                    </span>
                  </div>

                  {isActive && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-1.5"
                    >
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                      </span>
                      <span className="text-[11px] font-medium text-emerald-400">Live</span>
                    </motion.div>
                  )}

                  {runningCount > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary/80 font-medium tabular-nums">
                      {runningCount} active
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {completedCount > 0 && (
                    <span className="text-[10px] text-white/30 font-mono tabular-nums">
                      {completedCount} completed
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={toggleExpanded}
                    className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white/60 transition-all"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Phase timeline */}
              <div className="flex items-center justify-center gap-6 px-4 py-3 border-b border-white/[0.04] bg-white/[0.01]">
                {(['think', 'search', 'act', 'stream', 'observe'] as const).map((phaseType, i) => (
                  <div key={phaseType} className="flex items-center gap-6">
                    <PhaseStep
                      type={phaseType}
                      isActive={activePhaseType === phaseType}
                      isCompleted={completedPhases.has(phaseType)}
                    />
                    {i < 4 && (
                      <div className={cn(
                        'w-8 h-px',
                        completedPhases.has(phaseType) ? 'bg-emerald-500/30' : 'bg-white/[0.06]'
                      )} />
                    )}
                  </div>
                ))}
              </div>

              {/* Current phase detail */}
              {phase && (
                <motion.div
                  key={phase.type}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={cn(
                    'px-4 py-2.5 border-b border-white/[0.04]',
                    'bg-gradient-to-r',
                    config?.gradient || 'from-primary/5 to-transparent'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <PhaseIcon className={cn('w-4 h-4', config?.color)} />
                    <span className={cn('text-sm font-medium', config?.color)}>
                      {phase.label}
                      <AnimatedDots />
                    </span>
                    {phase.detail && (
                      <span className="text-xs text-white/30 truncate ml-2">
                        {phase.detail}
                      </span>
                    )}
                  </div>
                </motion.div>
              )}

              {latestThinkingContent && activePhaseType === 'think' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-4 py-2 border-b border-white/[0.04] bg-amber-500/[0.03]"
                >
                  <p className="text-[11px] text-amber-300/50 italic leading-relaxed line-clamp-3">
                    &ldquo;{latestThinkingContent}&rdquo;
                  </p>
                </motion.div>
              )}

              {/* Event stream */}
              <div
                ref={scrollRef}
                className="max-h-[320px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
              >
                {displayEvents.length > 0 ? (
                  <div className="py-1">
                    {displayEvents.map((event, i) => (
                      <RichEventRow key={event.id} event={event} index={i} />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-white/20">
                    <Sparkles className="w-8 h-8 mb-2 opacity-30" />
                    <span className="text-xs">Waiting for activity...</span>
                  </div>
                )}
              </div>

              {/* Bottom shimmer */}
              {isActive && (
                <div className="h-[2px] overflow-hidden bg-white/[0.02]">
                  <motion.div
                    className={cn(
                      'h-full w-1/4 rounded-full',
                      phase?.type === 'think' ? 'bg-gradient-to-r from-amber-500/60 via-amber-400/80 to-amber-500/60' :
                      phase?.type === 'search' ? 'bg-gradient-to-r from-emerald-500/60 via-emerald-400/80 to-emerald-500/60' :
                      phase?.type === 'act' ? 'bg-gradient-to-r from-violet-500/60 via-violet-400/80 to-violet-500/60' :
                      'bg-gradient-to-r from-primary/60 via-violet-400/80 to-primary/60'
                    )}
                    animate={{ x: ['-100%', '500%'] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
                  />
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={toggleExpanded}
              className={cn(
                'relative flex items-center gap-3 w-full px-4 py-3 rounded-2xl',
                'backdrop-blur-xl',
                'bg-slate-950/80 border border-white/[0.08]',
                'shadow-lg shadow-black/20',
                'hover:bg-slate-950/90 hover:border-white/[0.12]',
                'transition-all duration-200 cursor-pointer',
                'group'
              )}
            >
              <motion.div
                animate={isActive ? { scale: [1, 1.12, 1] } : {}}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                className={cn(
                  'flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center',
                  config?.bg || 'bg-primary/10'
                )}
              >
                <PhaseIcon
                  className={cn('w-4.5 h-4.5', config?.color || 'text-primary')}
                />
              </motion.div>

              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white/80">
                    {phase?.label || 'Working'}
                    <AnimatedDots />
                  </span>
                  {isActive && (
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                    </span>
                  )}
                </div>
                {phase?.detail && (
                  <span className="text-[11px] text-white/30 truncate block">
                    {phase.detail}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {runningCount > 1 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary/80 font-medium tabular-nums">
                    {runningCount}
                  </span>
                )}
                <ChevronUp className="w-4 h-4 text-white/30 group-hover:text-white/50 transition-colors" />
              </div>

              <div className="absolute bottom-0 left-0 right-0 h-[2px] overflow-hidden rounded-b-2xl">
                <motion.div
                  className={cn(
                    'h-full w-1/3 rounded-full',
                    phase?.type === 'think' ? 'bg-amber-500/50' :
                    phase?.type === 'search' ? 'bg-emerald-400/50' :
                    phase?.type === 'act' ? 'bg-violet-400/50' :
                    'bg-primary/50'
                  )}
                  animate={{ x: ['-100%', '400%'] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                />
              </div>
            </button>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
