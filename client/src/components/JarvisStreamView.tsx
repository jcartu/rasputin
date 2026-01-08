import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Search,
  Globe,
  Code,
  Terminal,
  FileText,
  FolderOpen,
  Calculator,
  Image as ImageIcon,
  Clock,
  Zap,
  CheckCircle2,
  XCircle,
  Loader2,
  Copy,
  ChevronDown,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type {
  StreamingStep,
  StreamingToolCall,
  StreamingState,
} from "@/hooks/useJarvisStream";
import { useState } from "react";
import { ToolOutputPreview } from "./ToolOutputPreview";
import { Streamdown } from "streamdown";

const TOOL_ICONS: Record<string, React.ReactNode> = {
  web_search: <Search className="h-4 w-4" />,
  browse_url: <Globe className="h-4 w-4" />,
  execute_python: <Code className="h-4 w-4 text-yellow-400" />,
  execute_javascript: <Code className="h-4 w-4 text-yellow-300" />,
  run_shell: <Terminal className="h-4 w-4" />,
  execute_shell: <Terminal className="h-4 w-4" />,
  read_file: <FileText className="h-4 w-4" />,
  write_file: <FileText className="h-4 w-4" />,
  list_files: <FolderOpen className="h-4 w-4" />,
  calculate: <Calculator className="h-4 w-4" />,
  http_request: <Globe className="h-4 w-4" />,
  generate_image: <ImageIcon className="h-4 w-4" />,
  get_datetime: <Clock className="h-4 w-4" />,
  scaffold_project: <FolderOpen className="h-4 w-4 text-green-400" />,
  start_dev_server: <Zap className="h-4 w-4 text-cyan-400" />,
  stop_dev_server: <Zap className="h-4 w-4 text-red-400" />,
  install_dependencies: <Terminal className="h-4 w-4 text-purple-400" />,
  git_clone: <Code className="h-4 w-4 text-orange-400" />,
  task_complete: <CheckCircle2 className="h-4 w-4 text-green-400" />,
};

function ThinkingBubble({ content }: { content: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex items-start gap-3"
    >
      <motion.div
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="p-2 rounded-full bg-purple-500/20 flex-shrink-0"
      >
        <Brain className="h-5 w-5 text-purple-400" />
      </motion.div>
      <div className="flex-1 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 overflow-hidden">
        <div className="prose prose-invert prose-sm max-w-none prose-p:text-purple-200 prose-headings:text-purple-100 prose-strong:text-purple-100 prose-code:text-purple-300 prose-pre:bg-purple-950/50">
          <Streamdown>{content}</Streamdown>
        </div>
      </div>
    </motion.div>
  );
}

function ToolCard({
  tool,
  isLive,
}: {
  tool: StreamingToolCall;
  isLive?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isRunning = tool.status === "running";
  const isCompleted = tool.status === "completed";
  const isFailed = tool.status === "failed";

  const duration = tool.durationMs
    ? (tool.durationMs / 1000).toFixed(2)
    : tool.endTime && tool.startTime
      ? ((tool.endTime - tool.startTime) / 1000).toFixed(2)
      : null;

  const statusColors = {
    running: "border-cyan-500/50 shadow-cyan-500/20",
    completed: "border-green-500/30",
    failed: "border-red-500/30",
  };

  const statusBadge = {
    running: (
      <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        Running
      </Badge>
    ),
    completed: (
      <Badge className="bg-green-500/20 text-green-400 border-green-500/30 gap-1">
        <CheckCircle2 className="h-3 w-3" />
        Done
      </Badge>
    ),
    failed: (
      <Badge className="bg-red-500/20 text-red-400 border-red-500/30 gap-1">
        <XCircle className="h-3 w-3" />
        Failed
      </Badge>
    ),
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <Card
        className={cn(
          "transition-all duration-300 overflow-hidden",
          statusColors[tool.status],
          isLive && isRunning && "shadow-lg shadow-cyan-500/10 animate-pulse"
        )}
      >
        <CardContent className="p-0">
          <div
            className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={() => setExpanded(!expanded)}
          >
            <div className="flex items-center gap-3">
              <motion.button
                animate={{ rotate: expanded ? 90 : 0 }}
                transition={{ duration: 0.2 }}
                className="text-muted-foreground"
              >
                <ChevronRight className="h-4 w-4" />
              </motion.button>
              <div
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  isRunning && "bg-cyan-500/20",
                  isCompleted && "bg-green-500/20",
                  isFailed && "bg-red-500/20"
                )}
              >
                {TOOL_ICONS[tool.name] || <Zap className="h-4 w-4" />}
              </div>
              <div>
                <p className="font-mono text-sm font-medium">
                  {tool.name.replace(/_/g, " ")}
                </p>
                {isRunning && (
                  <motion.p
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="text-xs text-cyan-400"
                  >
                    Executing...
                  </motion.p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {duration && (
                <span className="text-xs text-muted-foreground font-mono">
                  {duration}s
                </span>
              )}
              {statusBadge[tool.status]}
            </div>
          </div>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="border-t border-border/50"
              >
                <div className="p-3 space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        Input
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2"
                        onClick={e => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(
                            JSON.stringify(tool.input, null, 2)
                          );
                          toast.success("Copied to clipboard");
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <pre className="p-2 rounded bg-muted/50 text-xs overflow-x-auto max-h-32 font-mono">
                      {JSON.stringify(tool.input, null, 2)}
                    </pre>
                  </div>
                  {tool.output && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-muted-foreground">
                          Output
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2"
                          onClick={e => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(tool.output || "");
                            toast.success("Copied to clipboard");
                          }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <ToolOutputPreview
                        toolName={tool.name}
                        output={tool.output}
                        input={JSON.stringify(tool.input)}
                      />
                    </div>
                  )}
                  {isRunning && !tool.output && (
                    <div className="flex items-center gap-2 text-cyan-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Processing...</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function ProgressIndicator({
  current,
  max,
  isStreaming,
}: {
  current: number;
  max: number;
  isStreaming: boolean;
}) {
  const progress = max > 0 ? (current / max) * 100 : 0;

  if (!isStreaming && current === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50"
    >
      <div className="flex items-center gap-2">
        {isStreaming ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <Sparkles className="h-5 w-5 text-purple-400" />
          </motion.div>
        ) : (
          <CheckCircle2 className="h-5 w-5 text-green-400" />
        )}
        <span className="text-sm font-medium">
          {isStreaming ? "Working..." : "Complete"}
        </span>
      </div>
      <div className="flex-1">
        <Progress value={progress} className="h-2" />
      </div>
      <span className="text-xs text-muted-foreground font-mono">
        {current}/{max}
      </span>
    </motion.div>
  );
}

function CompletionCard({
  summary,
  success,
  durationMs,
}: {
  summary: string | null;
  success: boolean;
  durationMs: number | null;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <Card
        className={cn(
          "border-2",
          success ? "border-green-500/30" : "border-red-500/30"
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "p-2 rounded-full",
                success ? "bg-green-500/20" : "bg-red-500/20"
              )}
            >
              {success ? (
                <CheckCircle2 className="h-6 w-6 text-green-400" />
              ) : (
                <XCircle className="h-6 w-6 text-red-400" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">
                  {success ? "Task Completed" : "Task Failed"}
                </h3>
                {durationMs && (
                  <Badge variant="outline" className="text-xs">
                    {(durationMs / 1000).toFixed(1)}s
                  </Badge>
                )}
              </div>
              {summary && (
                <div className="prose prose-invert prose-sm max-w-none">
                  <Streamdown>{summary}</Streamdown>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

interface JarvisStreamViewProps {
  state: StreamingState;
}

export function JarvisStreamView({ state }: JarvisStreamViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [state.steps]);

  const isComplete = state.success !== null && !state.isStreaming;
  const lastStepIndex = state.steps.length - 1;

  return (
    <div className="space-y-4">
      <ProgressIndicator
        current={state.currentIteration}
        max={state.maxIterations}
        isStreaming={state.isStreaming}
      />

      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {state.steps.map((step, index) => (
            <motion.div
              key={step.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              {step.type === "thinking" && step.content && (
                <ThinkingBubble content={step.content} />
              )}
              {step.type === "tool" && step.tool && (
                <ToolCard
                  tool={step.tool}
                  isLive={state.isStreaming && index === lastStepIndex}
                />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {state.error && !isComplete && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card className="border-red-500/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-red-400">
                <XCircle className="h-5 w-5" />
                <span className="font-medium">Error</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {state.error}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {isComplete && (
        <CompletionCard
          summary={state.summary}
          success={state.success ?? false}
          durationMs={state.durationMs}
        />
      )}

      <div ref={scrollRef} />
    </div>
  );
}
