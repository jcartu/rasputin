import { useState, useEffect, useRef, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Terminal,
  Activity,
  Zap,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Brain,
  Search,
  Globe,
  Code,
  FileText,
  FolderOpen,
  Calculator,
  Image as ImageIcon,
  ChevronRight,
  Hash,
  Play,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { StreamingState, StreamingStep } from "@/hooks/useJarvisStream";

interface LogEntry {
  id: string;
  timestamp: number;
  type:
    | "thinking"
    | "tool-start"
    | "tool-end"
    | "tool-error"
    | "info"
    | "success"
    | "error"
    | "memory";
  message: string;
  toolName?: string;
}

const TOOL_ICONS: Record<string, React.ReactNode> = {
  web_search: <Search className="h-3 w-3" />,
  browse_url: <Globe className="h-3 w-3" />,
  execute_python: <Code className="h-3 w-3 text-yellow-400" />,
  execute_javascript: <Code className="h-3 w-3 text-yellow-300" />,
  run_shell: <Terminal className="h-3 w-3" />,
  execute_shell: <Terminal className="h-3 w-3" />,
  read_file: <FileText className="h-3 w-3" />,
  write_file: <FileText className="h-3 w-3" />,
  list_files: <FolderOpen className="h-3 w-3" />,
  calculate: <Calculator className="h-3 w-3" />,
  http_request: <Globe className="h-3 w-3" />,
  generate_image: <ImageIcon className="h-3 w-3" />,
  get_datetime: <Clock className="h-3 w-3" />,
  scaffold_project: <FolderOpen className="h-3 w-3 text-green-400" />,
  start_dev_server: <Zap className="h-3 w-3 text-cyan-400" />,
  stop_dev_server: <Zap className="h-3 w-3 text-red-400" />,
  install_dependencies: <Terminal className="h-3 w-3 text-purple-400" />,
  git_clone: <Code className="h-3 w-3 text-orange-400" />,
  task_complete: <CheckCircle2 className="h-3 w-3 text-green-400" />,
};

function getLogColor(type: LogEntry["type"]) {
  switch (type) {
    case "error":
    case "tool-error":
      return "text-red-400";
    case "success":
      return "text-green-400";
    case "tool-start":
      return "text-cyan-400";
    case "tool-end":
      return "text-green-400";
    case "thinking":
      return "text-purple-400";
    case "memory":
      return "text-amber-400";
    default:
      return "text-muted-foreground";
  }
}

function getLogPrefix(type: LogEntry["type"]) {
  switch (type) {
    case "error":
    case "tool-error":
      return "ERR";
    case "success":
      return "OK ";
    case "tool-start":
      return "EXE";
    case "tool-end":
      return "FIN";
    case "thinking":
      return "THK";
    case "memory":
      return "MEM";
    default:
      return "LOG";
  }
}

function FlyingLogs({
  logs,
  isActive,
}: {
  logs: LogEntry[];
  isActive: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  return (
    <div className="relative h-80 bg-black/90 rounded-lg border border-cyan-500/20 overflow-hidden font-mono text-[11px] shadow-lg shadow-cyan-500/5">
      <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border-b border-cyan-500/20">
        <Terminal className="h-3 w-3 text-cyan-400" />
        <span className="text-cyan-400/80 font-medium">Intelligence Feed</span>
        {isActive && (
          <span className="ml-auto flex items-center gap-1.5 text-green-400 text-[10px] uppercase tracking-wider">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            Live
          </span>
        )}
      </div>

      <div
        ref={scrollRef}
        className="h-[calc(100%-36px)] overflow-y-auto p-2 space-y-1"
        onScroll={e => {
          const target = e.target as HTMLDivElement;
          const isAtBottom =
            target.scrollHeight - target.scrollTop <= target.clientHeight + 20;
          setAutoScroll(isAtBottom);
        }}
      >
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground/40">
            <Terminal className="h-6 w-6 mb-2 opacity-20" />
            <p className="text-[10px]">Awaiting neural activity...</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {logs.map((log, index) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -50, scale: 0.8 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 500,
                  damping: 30,
                  delay: index === logs.length - 1 ? 0 : 0,
                }}
                className={`flex gap-1.5 leading-tight py-0.5 px-1 rounded ${getLogColor(log.type)} ${
                  index === logs.length - 1 && isActive
                    ? "bg-cyan-500/10"
                    : "hover:bg-white/5"
                }`}
              >
                <span className="text-muted-foreground/40 shrink-0 select-none text-[10px]">
                  {new Date(log.timestamp).toLocaleTimeString("en-US", {
                    hour12: false,
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
                <span className="text-muted-foreground/60 shrink-0 select-none text-[10px]">
                  [{getLogPrefix(log.type)}]
                </span>
                <span className="break-words font-medium opacity-90 min-w-0 overflow-hidden">
                  {log.message}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        )}

        {isActive && (
          <motion.div
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="flex items-center gap-1 text-cyan-400 mt-1"
          >
            <span className="inline-block w-2 h-4 bg-cyan-400" />
          </motion.div>
        )}
      </div>
    </div>
  );
}

function ToolExecutionCard({ step }: { step: StreamingStep }) {
  if (step.type !== "tool" || !step.tool) return null;

  const { tool } = step;
  const isRunning = tool.status === "running";
  const isFailed = tool.status === "failed";

  const Icon = TOOL_ICONS[tool.name] || <Zap className="h-3 w-3" />;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`
        group relative flex items-center gap-2 p-2 rounded-md border text-xs
        transition-all duration-200 overflow-hidden
        ${
          isRunning
            ? "bg-primary/5 border-primary/20 shadow-[0_0_10px_-5px_var(--primary)]"
            : isFailed
              ? "bg-red-500/5 border-red-500/20"
              : "bg-secondary/30 border-border hover:bg-secondary/50"
        }
      `}
    >
      <div
        className={`
        p-1 rounded flex items-center justify-center shrink-0
        ${
          isRunning
            ? "bg-primary/10 text-primary"
            : isFailed
              ? "bg-red-500/10 text-red-400"
              : "bg-secondary text-muted-foreground"
        }
      `}
      >
        {isRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : Icon}
      </div>

      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium truncate text-sm">{tool.name}</span>
          <span className="text-[10px] text-muted-foreground font-mono shrink-0">
            {tool.durationMs
              ? `${(tool.durationMs / 1000).toFixed(2)}s`
              : tool.startTime
                ? "Running..."
                : ""}
          </span>
        </div>
        {Object.keys(tool.input).length > 0 && (
          <div className="text-[10px] text-muted-foreground opacity-70 mt-0.5 font-mono break-all line-clamp-2">
            {JSON.stringify(tool.input)}
          </div>
        )}
      </div>

      <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </motion.div>
  );
}

interface JarvisThinkingPanelProps {
  state: StreamingState;
}

export function JarvisThinkingPanel({ state }: JarvisThinkingPanelProps) {
  const logHistoryRef = useRef<LogEntry[]>([]);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const lastTaskIdRef = useRef<number | null>(null);

  const logs = useMemo(() => {
    if (state.taskId !== null && state.taskId !== lastTaskIdRef.current) {
      if (lastTaskIdRef.current !== null && logHistoryRef.current.length > 0) {
        logHistoryRef.current.push({
          id: `separator-${Date.now()}`,
          timestamp: Date.now(),
          type: "info",
          message: "─── New Task ───",
        });
      }
      lastTaskIdRef.current = state.taskId;
    }

    state.steps.forEach(step => {
      if (step.type === "thinking" && step.content) {
        const id = `${step.id}-thk`;
        if (!seenIdsRef.current.has(id)) {
          seenIdsRef.current.add(id);
          logHistoryRef.current.push({
            id,
            timestamp: step.timestamp,
            type: "thinking",
            message:
              step.content.slice(0, 100) +
              (step.content.length > 100 ? "..." : ""),
          });
        }
      }

      if (step.type === "tool" && step.tool) {
        const startId = `${step.id}-start`;
        if (!seenIdsRef.current.has(startId)) {
          seenIdsRef.current.add(startId);
          logHistoryRef.current.push({
            id: startId,
            timestamp: step.tool.startTime,
            type: "tool-start",
            message: `Executing ${step.tool.name}...`,
            toolName: step.tool.name,
          });
        }

        if (step.tool.status !== "running" && step.tool.endTime) {
          const endId = `${step.id}-end`;
          if (!seenIdsRef.current.has(endId)) {
            seenIdsRef.current.add(endId);
            logHistoryRef.current.push({
              id: endId,
              timestamp: step.tool.endTime,
              type: step.tool.status === "failed" ? "tool-error" : "tool-end",
              message:
                step.tool.status === "failed"
                  ? `Tool ${step.tool.name} failed`
                  : `Tool ${step.tool.name} completed (${step.tool.durationMs}ms)`,
              toolName: step.tool.name,
            });
          }
        }
      }

      if (step.type === "memory" && step.content) {
        const memId = `${step.id}-mem`;
        if (!seenIdsRef.current.has(memId)) {
          seenIdsRef.current.add(memId);
          logHistoryRef.current.push({
            id: memId,
            timestamp: step.timestamp,
            type: "memory",
            message: step.content,
          });
        }
      }
    });

    return [...logHistoryRef.current].sort((a, b) => a.timestamp - b.timestamp);
  }, [state.steps, state.taskId]);

  const [elapsedTime, setElapsedTime] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (state.isStreaming && !startTimeRef.current) {
      startTimeRef.current = Date.now();
    } else if (!state.isStreaming && !state.success && !state.error) {
      startTimeRef.current = null;
      setElapsedTime(0);
    }

    if (state.isStreaming) {
      const interval = setInterval(() => {
        if (startTimeRef.current) {
          setElapsedTime(Date.now() - startTimeRef.current);
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [state.isStreaming, state.success, state.error]);

  const stats = useMemo(() => {
    const tools = state.steps.filter(s => s.type === "tool" && s.tool);
    return {
      totalTools: tools.length,
      completedTools: tools.filter(s => s.tool?.status === "completed").length,
      failedTools: tools.filter(s => s.tool?.status === "failed").length,
      thinkingSteps: state.steps.filter(s => s.type === "thinking").length,
    };
  }, [state.steps]);

  const recentTools = useMemo(() => {
    return state.steps
      .filter(s => s.type === "tool")
      .slice(-5)
      .reverse();
  }, [state.steps]);

  return (
    <div className="h-full flex flex-col bg-background/50 backdrop-blur-sm">
      <div className="p-3 border-b border-border bg-background/80">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-primary" />
            <h3 className="font-medium text-sm text-foreground tracking-tight">
              Mission Control
            </h3>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono">
            {state.isStreaming ? (
              <Badge
                variant="outline"
                className="border-primary/50 text-primary animate-pulse gap-1 text-[10px] px-1.5 py-0"
              >
                <Activity className="h-2.5 w-2.5" />
                RUNNING
              </Badge>
            ) : state.success ? (
              <Badge
                variant="outline"
                className="border-green-500/50 text-green-500 gap-1 text-[10px] px-1.5 py-0"
              >
                <CheckCircle2 className="h-2.5 w-2.5" />
                COMPLETE
              </Badge>
            ) : state.error ? (
              <Badge
                variant="outline"
                className="border-red-500/50 text-red-500 gap-1 text-[10px] px-1.5 py-0"
              >
                <XCircle className="h-2.5 w-2.5" />
                FAILED
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-muted-foreground gap-1 text-[10px] px-1.5 py-0"
              >
                <Clock className="h-2.5 w-2.5" />
                IDLE
              </Badge>
            )}
            <span className="text-muted-foreground">
              {((state.durationMs || elapsedTime) / 1000).toFixed(1)}s
            </span>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Progress</span>
            <span>
              Iteration {state.currentIteration} / {state.maxIterations}
            </span>
          </div>
          <Progress
            value={(state.currentIteration / state.maxIterations) * 100}
            className="h-1"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              <Terminal className="h-3 w-3" />
              Flying Logs
            </div>
            <FlyingLogs logs={logs} isActive={state.isStreaming} />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              <Play className="h-3 w-3" />
              Recent Execution
            </div>
            {recentTools.length === 0 ? (
              <div className="text-center py-4 border border-dashed border-border rounded-lg">
                <Zap className="h-5 w-5 mx-auto mb-1.5 text-muted-foreground/30" />
                <p className="text-[10px] text-muted-foreground">
                  No tools executed yet
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <AnimatePresence mode="popLayout">
                  {recentTools.map(step => (
                    <ToolExecutionCard key={step.id} step={step} />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      <div className="p-2 border-t border-border bg-secondary/20">
        <div className="grid grid-cols-3 gap-1.5 text-[9px] text-muted-foreground">
          <div className="flex flex-col items-center justify-center p-1.5 rounded bg-background border border-border">
            <Hash className="h-2.5 w-2.5 mb-0.5 opacity-50" />
            <span className="font-mono text-foreground font-medium text-base leading-none">
              {stats.totalTools}
            </span>
            <span className="mt-0.5">Tools</span>
          </div>
          <div className="flex flex-col items-center justify-center p-1.5 rounded bg-background border border-border">
            <Brain className="h-2.5 w-2.5 mb-0.5 opacity-50" />
            <span className="font-mono text-foreground font-medium text-base leading-none">
              {stats.thinkingSteps}
            </span>
            <span className="mt-0.5">Thinking</span>
          </div>
          <div className="flex flex-col items-center justify-center p-1.5 rounded bg-background border border-border">
            <CheckCircle2 className="h-2.5 w-2.5 mb-0.5 opacity-50" />
            <span className="font-mono text-foreground font-medium text-base leading-none">
              {stats.completedTools}
            </span>
            <span className="mt-0.5">Success</span>
          </div>
        </div>
      </div>
    </div>
  );
}
