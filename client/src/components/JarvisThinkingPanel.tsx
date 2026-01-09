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
    | "error";
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
    <div className="relative h-64 bg-black/80 rounded-lg border border-border overflow-hidden font-mono text-xs shadow-inner">
      <div className="flex items-center gap-2 px-3 py-2 bg-secondary/50 border-b border-border">
        <Terminal className="h-3 w-3 text-primary" />
        <span className="text-muted-foreground font-medium">System Logs</span>
        {isActive && (
          <span className="ml-auto flex items-center gap-1 text-green-400 text-[10px] uppercase tracking-wider">
            <Activity className="h-3 w-3 animate-pulse" />
            Live
          </span>
        )}
      </div>

      <div
        ref={scrollRef}
        className="h-[calc(100%-32px)] overflow-y-auto p-3 space-y-1"
        onScroll={e => {
          const target = e.target as HTMLDivElement;
          const isAtBottom =
            target.scrollHeight - target.scrollTop <= target.clientHeight + 20;
          setAutoScroll(isAtBottom);
        }}
      >
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground/40">
            <Terminal className="h-8 w-8 mb-2 opacity-20" />
            <p>Waiting for output...</p>
          </div>
        ) : (
          logs.map(log => (
            <div
              key={log.id}
              className={`flex gap-2 animate-in slide-in-from-bottom-1 duration-150 ${getLogColor(
                log.type
              )}`}
            >
              <span className="text-muted-foreground/40 shrink-0 select-none">
                {new Date(log.timestamp).toLocaleTimeString("en-US", {
                  hour12: false,
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
              <span className="text-muted-foreground/60 shrink-0 select-none">
                [{getLogPrefix(log.type)}]
              </span>
              <span className="break-all font-medium opacity-90">
                {log.message}
              </span>
            </div>
          ))
        )}

        {isActive && (
          <div className="flex items-center gap-1 text-primary mt-1">
            <span className="animate-pulse">_</span>
          </div>
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
        group relative flex items-center gap-3 p-2.5 rounded-md border text-sm
        transition-all duration-200
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
        p-1.5 rounded-md flex items-center justify-center
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

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="font-medium truncate">{tool.name}</span>
          <span className="text-[10px] text-muted-foreground font-mono">
            {tool.durationMs
              ? `${(tool.durationMs / 1000).toFixed(2)}s`
              : tool.startTime
                ? "Running..."
                : ""}
          </span>
        </div>
        {Object.keys(tool.input).length > 0 && (
          <div className="text-xs text-muted-foreground truncate opacity-70 mt-0.5 font-mono">
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
  const logs = useMemo(() => {
    const entries: LogEntry[] = [];

    state.steps.forEach(step => {
      if (step.type === "thinking" && step.content) {
        entries.push({
          id: `${step.id}-thk`,
          timestamp: step.timestamp,
          type: "thinking",
          message:
            step.content.slice(0, 100) +
            (step.content.length > 100 ? "..." : ""),
        });
      }

      if (step.type === "tool" && step.tool) {
        entries.push({
          id: `${step.id}-start`,
          timestamp: step.tool.startTime,
          type: "tool-start",
          message: `Executing ${step.tool.name}...`,
          toolName: step.tool.name,
        });

        if (step.tool.status !== "running" && step.tool.endTime) {
          entries.push({
            id: `${step.id}-end`,
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
    });

    return entries.sort((a, b) => a.timestamp - b.timestamp);
  }, [state.steps]);

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
      <div className="p-4 border-b border-border bg-background/80">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <h3 className="font-medium text-foreground tracking-tight">
              Mission Control
            </h3>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            {state.isStreaming ? (
              <Badge
                variant="outline"
                className="border-primary/50 text-primary animate-pulse gap-1"
              >
                <Activity className="h-3 w-3" />
                RUNNING
              </Badge>
            ) : state.success ? (
              <Badge
                variant="outline"
                className="border-green-500/50 text-green-500 gap-1"
              >
                <CheckCircle2 className="h-3 w-3" />
                COMPLETE
              </Badge>
            ) : state.error ? (
              <Badge
                variant="outline"
                className="border-red-500/50 text-red-500 gap-1"
              >
                <XCircle className="h-3 w-3" />
                FAILED
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground gap-1">
                <Clock className="h-3 w-3" />
                IDLE
              </Badge>
            )}
            <span className="text-muted-foreground">
              {((state.durationMs || elapsedTime) / 1000).toFixed(1)}s
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>
              Iteration {state.currentIteration} / {state.maxIterations}
            </span>
          </div>
          <Progress
            value={(state.currentIteration / state.maxIterations) * 100}
            className="h-1.5"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <Terminal className="h-3 w-3" />
              Flying Logs
            </div>
            <FlyingLogs logs={logs} isActive={state.isStreaming} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <Play className="h-3 w-3" />
              Recent Execution
            </div>
            {recentTools.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-border rounded-lg">
                <Zap className="h-6 w-6 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">
                  No tools executed yet
                </p>
              </div>
            ) : (
              <div className="space-y-2">
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

      <div className="p-3 border-t border-border bg-secondary/20">
        <div className="grid grid-cols-3 gap-2 text-[10px] text-muted-foreground">
          <div className="flex flex-col items-center justify-center p-2 rounded bg-background border border-border">
            <Hash className="h-3 w-3 mb-1 opacity-50" />
            <span className="font-mono text-foreground font-medium text-lg leading-none">
              {stats.totalTools}
            </span>
            <span>Tools Called</span>
          </div>
          <div className="flex flex-col items-center justify-center p-2 rounded bg-background border border-border">
            <Brain className="h-3 w-3 mb-1 opacity-50" />
            <span className="font-mono text-foreground font-medium text-lg leading-none">
              {stats.thinkingSteps}
            </span>
            <span>Thinking Steps</span>
          </div>
          <div className="flex flex-col items-center justify-center p-2 rounded bg-background border border-border">
            <CheckCircle2 className="h-3 w-3 mb-1 opacity-50" />
            <span className="font-mono text-foreground font-medium text-lg leading-none">
              {stats.completedTools}
            </span>
            <span>Success Rate</span>
          </div>
        </div>
      </div>
    </div>
  );
}
