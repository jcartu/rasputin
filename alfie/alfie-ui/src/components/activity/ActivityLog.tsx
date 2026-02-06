'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import {
  Activity,
  X,
  Download,
  Trash2,
  Filter,
  Wrench,
  Globe,
  FileText,
  Search,
  Bot,
  Brain,
  Wifi,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  GripVertical,
  Minimize2,
  Maximize2,
} from 'lucide-react';
import { useActivityStore, type ActivityEvent, type ActivityEventType, type ActivityStatus } from '@/lib/activityStore';
import { cn } from '@/lib/utils';

const EVENT_ICONS: Record<ActivityEventType, React.ComponentType<{ className?: string }>> = {
  tool: Wrench,
  api: Globe,
  file: FileText,
  search: Search,
  model: Bot,
  memory: Brain,
  websocket: Wifi,
  thinking: Loader2,
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
  thinking: 'text-orange-400',
  background: 'text-slate-400',
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

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

interface ActivityEntryProps {
  event: ActivityEvent;
}

function ActivityEntry({ event }: ActivityEntryProps) {
  const [expanded, setExpanded] = useState(false);
  const Icon = EVENT_ICONS[event.type];
  const StatusIcon = STATUS_ICONS[event.status];
  const iconColor = EVENT_COLORS[event.type];
  const statusColor = STATUS_COLORS[event.status];

  const handleToggle = () => {
    if (event.details) setExpanded(!expanded);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className="border-b border-white/5 last:border-0"
    >
      <button
        type="button"
        className={cn(
          'flex items-start gap-2 p-2 hover:bg-white/5 transition-colors w-full text-left',
          event.details && 'cursor-pointer'
        )}
        onClick={handleToggle}
      >
        <div className={cn('mt-0.5 flex-shrink-0', iconColor)}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-white/90 truncate">
              {event.title}
            </span>
            {event.duration !== undefined && (
              <span className="text-[10px] text-white/40 font-mono">
                {formatDuration(event.duration)}
              </span>
            )}
          </div>
          {event.description && (
            <p className="text-[10px] text-white/50 truncate mt-0.5">
              {event.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[10px] text-white/30 font-mono">
            {formatTimestamp(event.timestamp instanceof Date ? event.timestamp : new Date(event.timestamp))}
          </span>
          <div className={cn(statusColor)}>
            <StatusIcon className={cn('w-3.5 h-3.5', event.status === 'running' && 'animate-spin')} />
          </div>
        </div>
      </button>

      <AnimatePresence>
        {expanded && event.details && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <pre className="text-[10px] text-white/50 bg-black/20 p-2 mx-2 mb-2 rounded overflow-auto max-h-32 font-mono">
              {JSON.stringify(event.details, null, 2)}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface FilterDropdownProps {
  activeTypes: ActivityEventType[];
  onToggleType: (type: ActivityEventType) => void;
}

function FilterDropdown({ activeTypes, onToggleType }: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const allTypes: ActivityEventType[] = ['tool', 'api', 'file', 'search', 'model', 'memory', 'websocket', 'thinking', 'background'];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'p-1.5 rounded-md transition-colors',
          activeTypes.length < allTypes.length ? 'bg-violet-500/20 text-violet-400' : 'hover:bg-white/10 text-white/60'
        )}
        title="Filter events"
      >
        <Filter className="w-3.5 h-3.5" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-10 cursor-default"
              onClick={() => setOpen(false)}
              aria-label="Close filter dropdown"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className="absolute right-0 top-full mt-1 z-20 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl p-2 min-w-[140px]"
            >
              {allTypes.map((type) => {
                const Icon = EVENT_ICONS[type];
                const color = EVENT_COLORS[type];
                const isActive = activeTypes.includes(type);
                return (
                  <button
                    type="button"
                    key={type}
                    onClick={() => onToggleType(type)}
                    className={cn(
                      'flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs capitalize transition-colors',
                      isActive ? 'bg-white/10 text-white' : 'text-white/40 hover:bg-white/5'
                    )}
                  >
                    <Icon className={cn('w-3.5 h-3.5', isActive && color)} />
                    {type}
                  </button>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ActivityLog() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const containerRef = useRef<HTMLDivElement>(null);
  
  const {
    isVisible,
    isCollapsed,
    position,
    filter,
    setVisible,
    toggleCollapsed,
    setPosition,
    setFilter,
    clearEvents,
    exportLog,
    getFilteredEvents,
  } = useActivityStore();

  const filteredEvents = getFilteredEvents();

  const prevEventsCountRef = useRef(filteredEvents.length);
  useEffect(() => {
    if (filteredEvents.length !== prevEventsCountRef.current) {
      prevEventsCountRef.current = filteredEvents.length;
      if (scrollRef.current && !isCollapsed) {
        scrollRef.current.scrollTop = 0;
      }
    }
  }, [filteredEvents, isCollapsed]);

  const handleExport = useCallback(() => {
    const data = exportLog();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alfie-activity-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportLog]);

  const handleToggleType = useCallback((type: ActivityEventType) => {
    const currentTypes = filter.types;
    const newTypes = currentTypes.includes(type)
      ? currentTypes.filter((t) => t !== type)
      : [...currentTypes, type];
    setFilter({ types: newTypes.length > 0 ? newTypes : [type] });
  }, [filter.types, setFilter]);

  const handleDragEnd = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPosition({ x: rect.left, y: rect.top });
    }
  }, [setPosition]);

  if (!isVisible) return null;

  const defaultPosition = { 
    x: typeof window !== 'undefined' ? window.innerWidth - 416 : 0, 
    y: typeof window !== 'undefined' ? window.innerHeight - 316 : 0 
  };
  
  const initialPosition = position.x >= 0 ? position : defaultPosition;

  return (
    <motion.div
      ref={containerRef}
      drag
      dragControls={dragControls}
      dragMomentum={false}
      dragElastic={0}
      onDragEnd={handleDragEnd}
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      style={{
        position: 'fixed',
        left: initialPosition.x,
        top: initialPosition.y,
        width: 400,
        zIndex: 9999,
      }}
      className={cn(
        'rounded-xl overflow-hidden shadow-2xl',
        'bg-slate-900/80 backdrop-blur-xl',
        'border border-white/10',
        'ring-1 ring-violet-500/20'
      )}
    >
      <div
        onPointerDown={(e) => dragControls.start(e)}
        className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-violet-600/20 to-cyan-600/20 border-b border-white/10 cursor-move select-none"
      >
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-white/40" />
          <Activity className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-medium text-white/90">Activity Log</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/60">
            {filteredEvents.length}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <FilterDropdown
            activeTypes={filter.types}
            onToggleType={handleToggleType}
          />
          <button
            type="button"
            onClick={handleExport}
            className="p-1.5 rounded-md hover:bg-white/10 text-white/60 transition-colors"
            title="Export log"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={clearEvents}
            className="p-1.5 rounded-md hover:bg-white/10 text-white/60 transition-colors"
            title="Clear log"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={toggleCollapsed}
            className="p-1.5 rounded-md hover:bg-white/10 text-white/60 transition-colors"
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => setVisible(false)}
            className="p-1.5 rounded-md hover:bg-white/10 text-white/60 transition-colors"
            title="Close (Cmd+L)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 268 }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              ref={scrollRef}
              className="h-[268px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
            >
              <AnimatePresence mode="popLayout">
                {filteredEvents.length > 0 ? (
                  filteredEvents.map((event) => (
                    <ActivityEntry key={event.id} event={event} />
                  ))
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center h-full text-white/30"
                  >
                    <Activity className="w-8 h-8 mb-2 opacity-50" />
                    <span className="text-xs">No activity yet</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div 
        className="absolute inset-0 pointer-events-none rounded-xl"
        style={{
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 0 40px rgba(139, 92, 246, 0.1)',
        }}
      />
    </motion.div>
  );
}
