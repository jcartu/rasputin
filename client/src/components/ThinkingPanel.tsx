import { useMemo } from "react";
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
  // GitMerge,
  FileSearch,
  AlertTriangle,
  FileText,
} from "lucide-react";
import type { QueryMode, SynthesisStage } from "../../../shared/rasputin";

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

interface ThinkingPanelProps {
  mode: QueryMode;
  modelStatuses: Map<string, ModelStatus>;
  pipelineStages: PipelineStageStatus[];
  consensusInProgress: boolean;
  isProcessing: boolean;
}

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

export function ThinkingPanel({
  mode,
  modelStatuses,
  pipelineStages,
  consensusInProgress,
  isProcessing,
}: ThinkingPanelProps) {
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
    };
  }, [modelStatuses]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-400" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-400" />;
      case "streaming":
      case "running":
        return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          {mode === "consensus" ? (
            <Zap className="h-4 w-4 text-primary" />
          ) : (
            <Sparkles className="h-4 w-4 text-purple-400" />
          )}
          <h3 className="font-medium text-foreground">
            {mode === "consensus" ? "Consensus" : "Synthesis"} Progress
          </h3>
        </div>

        {/* Progress bar */}
        <Progress value={progress} className="h-2" />
        <p className="text-xs text-muted-foreground mt-1">
          {progress}% complete
        </p>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
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
                  <div
                    key={model.modelId}
                    className="p-3 rounded-lg bg-secondary border border-border"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(model.status)}
                        <span className="text-sm font-medium text-foreground">
                          {model.modelName}
                        </span>
                      </div>
                      {model.latencyMs && (
                        <span className="text-xs text-muted-foreground">
                          {(model.latencyMs / 1000).toFixed(1)}s
                        </span>
                      )}
                    </div>

                    {model.status === "streaming" && (
                      <div className="text-xs text-muted-foreground line-clamp-2 mb-2">
                        {model.content.slice(-100)}...
                      </div>
                    )}

                    {model.status === "error" && model.errorMessage && (
                      <p className="text-xs text-red-400 mt-1">
                        {model.errorMessage}
                      </p>
                    )}

                    {model.status === "completed" && (
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        {model.tokenCount && (
                          <span>
                            {model.tokenCount.toLocaleString()} tokens
                          </span>
                        )}
                        {model.cost && model.cost > 0 && (
                          <span>${model.cost.toFixed(4)}</span>
                        )}
                      </div>
                    )}
                  </div>
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
                  {pipelineStages.map((stage, _index) => {
                    const config = STAGE_CONFIG[stage.stage];
                    const Icon = config?.icon || FileText;

                    return (
                      <div
                        key={stage.stage}
                        className={`
                          p-3 rounded-lg border transition-colors duration-200
                          ${
                            stage.status === "running"
                              ? "bg-primary/10 border-primary/30"
                              : stage.status === "completed"
                                ? "bg-secondary border-border"
                                : "bg-card border-border opacity-60"
                          }
                        `}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon
                              className={`h-4 w-4 ${config?.color || "text-muted-foreground"}`}
                            />
                            <span className="text-sm font-medium text-foreground">
                              {config?.label || stage.stage}
                            </span>
                          </div>
                          {getStatusIcon(stage.status)}
                        </div>

                        {stage.status === "running" && (
                          <div className="mt-2">
                            <div className="h-1 bg-secondary rounded-full overflow-hidden">
                              <div className="h-full bg-primary animate-pulse-slow w-1/2" />
                            </div>
                          </div>
                        )}

                        {stage.output && stage.status === "completed" && (
                          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                            {stage.output.slice(0, 100)}...
                          </p>
                        )}
                      </div>
                    );
                  })}
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
              <p className="font-medium text-foreground">
                {(totals.totalLatency / 1000).toFixed(1)}s
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Tokens</p>
              <p className="font-medium text-foreground">
                {totals.totalTokens.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Cost</p>
              <p className="font-medium text-foreground">
                ${totals.totalCost.toFixed(4)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Models</p>
              <p className="font-medium text-foreground">
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
