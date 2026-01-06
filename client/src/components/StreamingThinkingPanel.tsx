import { useState, useEffect, useRef, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Zap,
  Sparkles,
  Search,
  FileSearch,
  AlertTriangle,
  FileText,
  Terminal,
  Activity,
} from "lucide-react";
import type { QueryMode, SynthesisStage } from "../../../shared/rasputin";

// ============================================================================
// Types
// ============================================================================

interface ModelStatus {
  modelId: string;
  modelName: string;
  status: "pending" | "streaming" | "completed" | "error";
  content: string;
  latencyMs?: number;
  tokenCount?: number;
  cost?: number;
  errorMessage?: string;
}

interface PipelineStageStatus {
  stage: SynthesisStage;
  status: "pending" | "running" | "completed" | "error";
  output?: string;
}

interface LogEntry {
  id: string;
  timestamp: number;
  type: "info" | "model" | "stage" | "error" | "success" | "stream";
  message: string;
  modelId?: string;
  stage?: SynthesisStage;
}

interface StreamingThinkingPanelProps {
  mode: QueryMode;
  modelStatuses: Map<string, ModelStatus>;
  pipelineStages: PipelineStageStatus[];
  consensusInProgress: boolean;
  isProcessing: boolean;
  streamingLogs?: LogEntry[];
}

// ============================================================================
// Constants
// ============================================================================

const STAGE_CONFIG: Record<
  SynthesisStage,
  { icon: typeof Search; label: string; color: string }
> = {
  web_search: { icon: Search, label: "Web Search", color: "text-blue-400" },
  parallel_proposers: {
    icon: Zap,
    label: "Proposer Models",
    color: "text-primary",
  },
  information_extraction: {
    icon: FileSearch,
    label: "Information Extraction",
    color: "text-yellow-400",
  },
  gap_detection: {
    icon: AlertTriangle,
    label: "Gap Detection",
    color: "text-orange-400",
  },
  meta_synthesis: {
    icon: Sparkles,
    label: "Meta-Synthesis",
    color: "text-pink-400",
  },
};

// ============================================================================
// Flying Logs Component
// ============================================================================

function FlyingLogs({
  logs,
  isActive,
}: {
  logs: LogEntry[];
  isActive: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const getLogColor = (type: LogEntry["type"]) => {
    switch (type) {
      case "error":
        return "text-red-400";
      case "success":
        return "text-green-400";
      case "model":
        return "text-primary";
      case "stage":
        return "text-purple-400";
      case "stream":
        return "text-cyan-400";
      default:
        return "text-muted-foreground";
    }
  };

  const getLogPrefix = (type: LogEntry["type"]) => {
    switch (type) {
      case "error":
        return "ERR";
      case "success":
        return "OK ";
      case "model":
        return "MDL";
      case "stage":
        return "STG";
      case "stream":
        return ">>>";
      default:
        return "LOG";
    }
  };

  return (
    <div className="relative h-48 bg-black/80 rounded-lg border border-border overflow-hidden font-mono text-xs">
      {/* Terminal header */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary/50 border-b border-border">
        <Terminal className="h-3 w-3 text-primary" />
        <span className="text-muted-foreground">Live Stream</span>
        {isActive && (
          <span className="ml-auto flex items-center gap-1 text-green-400">
            <Activity className="h-3 w-3 animate-pulse" />
            Active
          </span>
        )}
      </div>

      {/* Logs container */}
      <div
        ref={scrollRef}
        className="h-[calc(100%-28px)] overflow-y-auto p-2 space-y-0.5"
        onScroll={e => {
          const target = e.target as HTMLDivElement;
          const isAtBottom =
            target.scrollHeight - target.scrollTop <= target.clientHeight + 10;
          setAutoScroll(isAtBottom);
        }}
      >
        {logs.length === 0 ? (
          <div className="text-muted-foreground/50 text-center py-4">
            Waiting for activity...
          </div>
        ) : (
          logs.map((log, index) => (
            <div
              key={log.id}
              className={`flex gap-2 animate-in slide-in-from-bottom-1 duration-150 ${getLogColor(log.type)}`}
              style={{ animationDelay: `${index * 10}ms` }}
            >
              <span className="text-muted-foreground/60 shrink-0">
                {new Date(log.timestamp).toLocaleTimeString("en-US", {
                  hour12: false,
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
              <span className="text-muted-foreground/80 shrink-0">
                [{getLogPrefix(log.type)}]
              </span>
              <span className="break-all">{log.message}</span>
            </div>
          ))
        )}

        {/* Blinking cursor */}
        {isActive && (
          <div className="flex items-center gap-1 text-primary">
            <span className="animate-pulse">▌</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Model Card with Streaming Content
// ============================================================================

function StreamingModelCard({ model }: { model: ModelStatus }) {
  const [displayContent, setDisplayContent] = useState("");
  const contentRef = useRef(model.content);

  // Animate content streaming
  useEffect(() => {
    if (model.status === "streaming" && model.content !== contentRef.current) {
      const newContent = model.content;
      contentRef.current = newContent;

      // Show last 150 characters with typing effect
      const displayText = newContent.slice(-150);
      setDisplayContent(displayText);
    } else if (model.status === "completed") {
      setDisplayContent(model.content.slice(-150));
    }
  }, [model.content, model.status]);

  const getStatusIcon = () => {
    switch (model.status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-400" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-400" />;
      case "streaming":
        return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBorder = () => {
    switch (model.status) {
      case "streaming":
        return "border-primary/50 bg-primary/5";
      case "completed":
        return "border-green-500/30 bg-green-500/5";
      case "error":
        return "border-red-500/30 bg-red-500/5";
      default:
        return "border-border bg-secondary";
    }
  };

  return (
    <div
      className={`p-3 rounded-lg border transition-all duration-300 ${getStatusBorder()}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="text-sm font-medium text-foreground">
            {model.modelName}
          </span>
        </div>
        {model.latencyMs && (
          <span className="text-xs text-muted-foreground font-mono">
            {(model.latencyMs / 1000).toFixed(2)}s
          </span>
        )}
      </div>

      {/* Streaming content preview */}
      {model.status === "streaming" && displayContent && (
        <div className="relative">
          <div className="text-xs text-muted-foreground font-mono bg-black/30 rounded p-2 overflow-hidden">
            <span className="opacity-70">{displayContent}</span>
            <span className="animate-pulse text-primary">▌</span>
          </div>
          <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-black/30 to-transparent pointer-events-none" />
        </div>
      )}

      {model.status === "error" && model.errorMessage && (
        <p className="text-xs text-red-400 mt-1">{model.errorMessage}</p>
      )}

      {model.status === "completed" && (
        <div className="flex gap-3 text-xs text-muted-foreground mt-1">
          {model.tokenCount !== undefined && model.tokenCount > 0 && (
            <span className="font-mono">
              {model.tokenCount.toLocaleString()} tok
            </span>
          )}
          {model.cost !== undefined && model.cost > 0 && (
            <span className="font-mono">${model.cost.toFixed(4)}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Pipeline Stage Card
// ============================================================================

function PipelineStageCard({
  stage,
  index,
}: {
  stage: PipelineStageStatus;
  index: number;
}) {
  const config = STAGE_CONFIG[stage.stage];
  const Icon = config?.icon || FileText;

  const getStatusIcon = () => {
    switch (stage.status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-400" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-400" />;
      case "running":
        return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div
      className={`
        p-3 rounded-lg border transition-all duration-300
        ${
          stage.status === "running"
            ? "bg-primary/10 border-primary/30 shadow-lg shadow-primary/10"
            : stage.status === "completed"
              ? "bg-secondary border-border"
              : "bg-card border-border opacity-60"
        }
      `}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono w-4">
            {index + 1}
          </span>
          <Icon
            className={`h-4 w-4 ${config?.color || "text-muted-foreground"}`}
          />
          <span className="text-sm font-medium text-foreground">
            {config?.label || stage.stage}
          </span>
        </div>
        {getStatusIcon()}
      </div>

      {stage.status === "running" && (
        <div className="mt-2">
          <div className="h-1 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/50 animate-pulse"
              style={{ width: "60%" }}
            />
          </div>
        </div>
      )}

      {stage.output && stage.status === "completed" && (
        <p className="text-xs text-muted-foreground mt-2 line-clamp-2 font-mono">
          {stage.output.slice(0, 100)}...
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function StreamingThinkingPanel({
  mode,
  modelStatuses,
  pipelineStages,
  consensusInProgress,
  isProcessing,
  streamingLogs = [],
}: StreamingThinkingPanelProps) {
  // Calculate overall progress
  const progress = useMemo(() => {
    if (mode === "consensus") {
      const statuses = Array.from(modelStatuses.values());
      if (statuses.length === 0) return 0;
      const completed = statuses.filter(
        s => s.status === "completed" || s.status === "error"
      ).length;
      return Math.round((completed / statuses.length) * 100);
    } else {
      if (pipelineStages.length === 0) return 0;
      const completed = pipelineStages.filter(
        s => s.status === "completed"
      ).length;
      return Math.round((completed / pipelineStages.length) * 100);
    }
  }, [mode, modelStatuses, pipelineStages]);

  // Calculate totals
  const totals = useMemo(() => {
    const statuses = Array.from(modelStatuses.values());
    return {
      totalLatency: statuses.reduce((sum, s) => sum + (s.latencyMs || 0), 0),
      totalTokens: statuses.reduce((sum, s) => sum + (s.tokenCount || 0), 0),
      totalCost: statuses.reduce((sum, s) => sum + (s.cost || 0), 0),
      completed: statuses.filter(s => s.status === "completed").length,
      errors: statuses.filter(s => s.status === "error").length,
      total: statuses.length,
      streaming: statuses.filter(s => s.status === "streaming").length,
    };
  }, [modelStatuses]);

  // Elapsed time counter
  const [elapsedTime, setElapsedTime] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (isProcessing && !startTimeRef.current) {
      startTimeRef.current = Date.now();
    } else if (!isProcessing) {
      startTimeRef.current = null;
      setElapsedTime(0);
    }

    if (isProcessing) {
      const interval = setInterval(() => {
        if (startTimeRef.current) {
          setElapsedTime(Date.now() - startTimeRef.current);
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [isProcessing]);

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header with live stats */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {mode === "consensus" ? (
              <Zap className="h-4 w-4 text-primary" />
            ) : (
              <Sparkles className="h-4 w-4 text-purple-400" />
            )}
            <h3 className="font-medium text-foreground">
              {mode === "consensus" ? "Consensus" : "Synthesis"} Progress
            </h3>
          </div>

          {/* Live timer */}
          {isProcessing && (
            <div className="flex items-center gap-1 text-xs font-mono text-primary">
              <Activity className="h-3 w-3 animate-pulse" />
              {(elapsedTime / 1000).toFixed(1)}s
            </div>
          )}
        </div>

        {/* Progress bar */}
        <Progress value={progress} className="h-2" />
        <div className="flex justify-between mt-1">
          <p className="text-xs text-muted-foreground">{progress}% complete</p>
          {totals.streaming > 0 && (
            <p className="text-xs text-primary">
              {totals.streaming} streaming...
            </p>
          )}
        </div>
      </div>

      {/* Flying Logs Section */}
      <div className="p-4 border-b border-border">
        <FlyingLogs logs={streamingLogs} isActive={isProcessing} />
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-3">
          {mode === "consensus" ? (
            // Consensus Mode - Model Status List
            <>
              {modelStatuses.size === 0 && !isProcessing ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Waiting for query...</p>
                  <p className="text-xs mt-1">
                    Model responses will appear here
                  </p>
                </div>
              ) : (
                Array.from(modelStatuses.values()).map(model => (
                  <StreamingModelCard key={model.modelId} model={model} />
                ))
              )}

              {/* Consensus generation indicator */}
              {consensusInProgress && (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 text-primary animate-spin" />
                    <span className="text-sm font-medium text-primary">
                      Generating consensus...
                    </span>
                  </div>
                </div>
              )}
            </>
          ) : (
            // Synthesis Mode - Pipeline Stages
            <>
              {pipelineStages.length === 0 && !isProcessing ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Waiting for query...</p>
                  <p className="text-xs mt-1">
                    Pipeline stages will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pipelineStages.map((stage, index) => (
                    <PipelineStageCard
                      key={stage.stage}
                      stage={stage}
                      index={index}
                    />
                  ))}
                </div>
              )}

              {/* Model statuses for synthesis */}
              {modelStatuses.size > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                    Proposer Models
                  </h4>
                  <div className="space-y-2">
                    {Array.from(modelStatuses.values()).map(model => (
                      <StreamingModelCard key={model.modelId} model={model} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Stats Footer */}
      {(modelStatuses.size > 0 || pipelineStages.length > 0) && (
        <div className="p-4 border-t border-border bg-secondary/50">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-muted-foreground">Total Time</p>
              <p className="font-medium font-mono text-foreground">
                {(totals.totalLatency / 1000).toFixed(2)}s
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Tokens</p>
              <p className="font-medium font-mono text-foreground">
                {totals.totalTokens.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Cost</p>
              <p className="font-medium font-mono text-foreground">
                ${totals.totalCost.toFixed(4)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Models</p>
              <p className="font-medium font-mono text-foreground">
                {totals.completed}/{totals.total}
                {totals.errors > 0 && (
                  <span className="text-red-400 ml-1">
                    ({totals.errors} err)
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
