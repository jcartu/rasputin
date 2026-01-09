import { useEffect, useRef, useState, useCallback } from "react";
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
  ChevronRight,
  Sparkles,
  Volume2,
  VolumeX,
  Download,
  FileDown,
  FileJson,
  Printer,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type {
  StreamingToolCall,
  StreamingState,
} from "@/hooks/useJarvisStream";
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
  success,
}: {
  current: number;
  max: number;
  isStreaming: boolean;
  success: boolean | null;
}) {
  const progress = isStreaming ? (max > 0 ? (current / max) * 100 : 0) : 100;

  if (!isStreaming && current === 0 && success === null) return null;

  const isComplete = !isStreaming && success !== null;
  const isSuccess = success === true;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border",
        isComplete && isSuccess && "bg-green-500/10 border-green-500/30",
        isComplete && !isSuccess && "bg-red-500/10 border-red-500/30",
        !isComplete && "bg-muted/30 border-border/50"
      )}
    >
      <div className="flex items-center gap-2">
        {isStreaming ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <Sparkles className="h-5 w-5 text-purple-400" />
          </motion.div>
        ) : isSuccess ? (
          <CheckCircle2 className="h-5 w-5 text-green-400" />
        ) : (
          <XCircle className="h-5 w-5 text-red-400" />
        )}
        <span className="text-sm font-medium">
          {isStreaming ? "Working..." : isSuccess ? "Complete" : "Failed"}
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
  artifacts,
}: {
  summary: string | null;
  success: boolean;
  durationMs: number | null;
  artifacts?: Array<{ type: string; url?: string; content?: string }>;
}) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(
    null
  );
  const ttsMutation = trpc.voice.textToSpeech.useMutation();

  const handleSpeak = useCallback(async () => {
    if (!summary) return;

    if (isSpeaking && audioElement) {
      audioElement.pause();
      setAudioElement(null);
      setIsSpeaking(false);
      return;
    }

    try {
      setIsSpeaking(true);
      const result = await ttsMutation.mutateAsync({
        text: summary.slice(0, 4000),
      });
      const audio = new Audio(`data:${result.mimeType};base64,${result.audio}`);
      setAudioElement(audio);
      audio.onended = () => {
        setIsSpeaking(false);
        setAudioElement(null);
      };
      await audio.play();
    } catch {
      toast.error("Failed to generate speech");
      setIsSpeaking(false);
    }
  }, [summary, isSpeaking, audioElement, ttsMutation]);

  const handleExport = useCallback(
    (format: "markdown" | "html" | "pdf" | "json") => {
      if (!summary) return;

      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `jarvis-report-${timestamp}`;

      if (format === "markdown") {
        const content = `# JARVIS Task Report\n\n**Date:** ${new Date().toLocaleString()}\n**Status:** ${success ? "Completed" : "Failed"}\n**Duration:** ${durationMs ? (durationMs / 1000).toFixed(1) + "s" : "N/A"}\n\n## Summary\n\n${summary}`;
        const blob = new Blob([content], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${filename}.md`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Exported as Markdown");
      } else if (format === "html") {
        const content = `<!DOCTYPE html><html><head><title>JARVIS Report</title><style>body{font-family:system-ui;max-width:800px;margin:40px auto;padding:20px;background:#0a0a0a;color:#e5e5e5}h1{color:#22d3ee}pre{background:#1a1a1a;padding:15px;border-radius:8px;overflow-x:auto}.meta{color:#888;margin-bottom:20px}</style></head><body><h1>JARVIS Task Report</h1><div class="meta"><p>Date: ${new Date().toLocaleString()}</p><p>Status: ${success ? "✅ Completed" : "❌ Failed"}</p><p>Duration: ${durationMs ? (durationMs / 1000).toFixed(1) + "s" : "N/A"}</p></div><div>${summary.replace(/\n/g, "<br>")}</div></body></html>`;
        const blob = new Blob([content], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${filename}.html`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Exported as HTML");
      } else if (format === "pdf") {
        window.print();
        toast.success("Print dialog opened for PDF");
      } else if (format === "json") {
        const content = JSON.stringify(
          { summary, success, durationMs, artifacts, exportedAt: new Date() },
          null,
          2
        );
        const blob = new Blob([content], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${filename}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Exported as JSON");
      }
    },
    [summary, success, durationMs, artifacts]
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="print:bg-white print:text-black"
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
                "p-2 rounded-full print:hidden",
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
                <div className="flex items-center gap-2">
                  {durationMs && (
                    <Badge variant="outline" className="text-xs print:hidden">
                      {(durationMs / 1000).toFixed(1)}s
                    </Badge>
                  )}
                  {summary && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 print:hidden"
                        onClick={handleSpeak}
                        title={isSpeaking ? "Stop speaking" : "Read aloud"}
                      >
                        {isSpeaking ? (
                          <VolumeX className="h-4 w-4 text-purple-400" />
                        ) : (
                          <Volume2 className="h-4 w-4" />
                        )}
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 print:hidden"
                            title="Export"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleExport("markdown")}
                          >
                            <FileDown className="h-4 w-4 mr-2" />
                            Export as Markdown
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleExport("html")}
                          >
                            <Globe className="h-4 w-4 mr-2" />
                            Export as HTML
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleExport("json")}
                          >
                            <FileJson className="h-4 w-4 mr-2" />
                            Export as JSON
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleExport("pdf")}>
                            <Printer className="h-4 w-4 mr-2" />
                            Print / Save as PDF
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  )}
                </div>
              </div>
              {summary && (
                <div className="prose prose-invert prose-sm max-w-none print:prose-neutral">
                  <Streamdown>{summary}</Streamdown>
                </div>
              )}
              {artifacts && artifacts.length > 0 && (
                <div className="mt-4 space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Artifacts
                  </h4>
                  <div className="grid gap-3">
                    {artifacts.map((artifact, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg bg-muted/30 border border-border/50"
                      >
                        {artifact.type === "image" && artifact.url && (
                          <img
                            src={artifact.url}
                            alt="Generated artifact"
                            className="max-w-full rounded-lg"
                          />
                        )}
                        {artifact.type === "html" && artifact.content && (
                          <iframe
                            srcDoc={artifact.content}
                            className="w-full h-96 rounded-lg border-0"
                            sandbox="allow-scripts"
                          />
                        )}
                        {artifact.type === "video" && artifact.url && (
                          <video
                            src={artifact.url}
                            controls
                            className="max-w-full rounded-lg"
                          />
                        )}
                      </div>
                    ))}
                  </div>
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
  autoSpeak?: boolean;
}

export function JarvisStreamView({
  state,
  autoSpeak = false,
}: JarvisStreamViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasAutoSpoken, setHasAutoSpoken] = useState(false);
  const ttsMutation = trpc.voice.textToSpeech.useMutation();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [state.steps]);

  const isComplete = state.success !== null && !state.isStreaming;
  const lastStepIndex = state.steps.length - 1;

  useEffect(() => {
    if (
      autoSpeak &&
      isComplete &&
      state.summary &&
      !hasAutoSpoken &&
      state.success
    ) {
      setHasAutoSpoken(true);
      ttsMutation
        .mutateAsync({ text: state.summary.slice(0, 4000) })
        .then(result => {
          const audio = new Audio(
            `data:${result.mimeType};base64,${result.audio}`
          );
          audio.play();
        })
        .catch(() => {});
    }
  }, [autoSpeak, isComplete, state.summary, hasAutoSpoken, state.success]);

  useEffect(() => {
    if (state.isStreaming) {
      setHasAutoSpoken(false);
    }
  }, [state.isStreaming]);

  const artifacts = state.steps
    .filter(s => s.type === "tool" && s.tool)
    .map(s => s.tool!)
    .filter(
      t =>
        t.status === "completed" &&
        (t.name === "generate_image" ||
          t.name === "write_file" ||
          t.name === "screenshot")
    )
    .map(t => {
      if (t.name === "generate_image" && t.output) {
        const urlMatch = t.output.match(
          /https?:\/\/[^\s]+\.(png|jpg|jpeg|gif|webp)/i
        );
        if (urlMatch) return { type: "image", url: urlMatch[0] };
      }
      if (t.name === "screenshot" && t.output) {
        const urlMatch = t.output.match(/https?:\/\/[^\s]+/);
        if (urlMatch) return { type: "image", url: urlMatch[0] };
      }
      if (
        t.name === "write_file" &&
        t.input &&
        typeof t.input === "object" &&
        "path" in t.input
      ) {
        const path = String((t.input as Record<string, unknown>).path);
        if (path.endsWith(".html")) {
          const content = (t.input as Record<string, unknown>).content;
          if (typeof content === "string") return { type: "html", content };
        }
      }
      return null;
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);

  return (
    <div className="space-y-4">
      <ProgressIndicator
        current={state.currentIteration}
        max={state.maxIterations}
        isStreaming={state.isStreaming}
        success={state.success}
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
          artifacts={artifacts}
        />
      )}

      <div ref={scrollRef} />
    </div>
  );
}
