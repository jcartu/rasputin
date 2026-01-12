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
  ExternalLink,
  Link,
  File,
  AlertTriangle,
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

function extractErrorMessage(output: string): string | null {
  if (!output) return null;
  const lowerOutput = output.toLowerCase();
  if (
    lowerOutput.includes("error") ||
    lowerOutput.includes("failed") ||
    lowerOutput.includes("exception") ||
    lowerOutput.includes("traceback")
  ) {
    const lines = output.split("\n").filter(l => l.trim());
    if (lines.length <= 3) return output;
    const errorLine = lines.find(
      l =>
        l.toLowerCase().includes("error") ||
        l.toLowerCase().includes("exception")
    );
    return errorLine || lines.slice(-2).join("\n");
  }
  return null;
}

function ToolRow({
  tool,
  isExpanded,
  onToggle,
}: {
  tool: StreamingToolCall;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const isRunning = tool.status === "running";
  const isCompleted = tool.status === "completed";
  const isFailed = tool.status === "failed";

  const duration = tool.durationMs
    ? (tool.durationMs / 1000).toFixed(2)
    : tool.endTime && tool.startTime
      ? ((tool.endTime - tool.startTime) / 1000).toFixed(2)
      : null;

  const errorSummary = isFailed ? extractErrorMessage(tool.output || "") : null;

  const statusIcon = {
    running: <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />,
    completed: <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />,
    failed: <XCircle className="h-3.5 w-3.5 text-red-400" />,
  };

  return (
    <div className="group">
      <div
        className={cn(
          "flex items-center gap-3 py-2 px-3 cursor-pointer rounded-md transition-colors",
          "hover:bg-muted/40",
          isExpanded && "bg-muted/30",
          isFailed && !isExpanded && "bg-red-500/5"
        )}
        onClick={onToggle}
      >
        <div className="flex-shrink-0">{statusIcon[tool.status]}</div>

        <div
          className={cn(
            "p-1.5 rounded transition-colors flex-shrink-0",
            isRunning && "bg-cyan-500/20",
            isCompleted && "bg-green-500/10",
            isFailed && "bg-red-500/10"
          )}
        >
          {TOOL_ICONS[tool.name] || <Zap className="h-3.5 w-3.5" />}
        </div>

        <div className="flex-1 min-w-0">
          <span
            className={cn(
              "font-mono text-sm truncate block",
              isRunning && "text-cyan-400",
              isCompleted && "text-foreground/80",
              isFailed && "text-red-400"
            )}
          >
            {tool.name.replace(/_/g, " ")}
          </span>
          {isFailed && errorSummary && !isExpanded && (
            <span className="text-xs text-red-400/80 truncate block mt-0.5">
              {errorSummary.slice(0, 60)}
              {errorSummary.length > 60 ? "..." : ""}
            </span>
          )}
        </div>

        {duration && (
          <span className="text-xs text-muted-foreground font-mono flex-shrink-0">
            {duration}s
          </span>
        )}

        <motion.div
          animate={{ rotate: isExpanded ? 90 : 0 }}
          transition={{ duration: 0.15 }}
          className="text-muted-foreground/50 flex-shrink-0"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </motion.div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div
              className={cn(
                "ml-10 mr-3 mb-2 p-3 rounded-md border space-y-3",
                isFailed
                  ? "bg-red-500/5 border-red-500/20"
                  : "bg-muted/20 border-border/30"
              )}
            >
              {isFailed && tool.output && (
                <div className="p-3 rounded-md bg-red-500/10 border border-red-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                    <span className="text-sm font-medium text-red-400">
                      Error Details
                    </span>
                  </div>
                  <pre className="text-xs text-red-300 whitespace-pre-wrap overflow-x-auto max-h-32 font-mono">
                    {tool.output}
                  </pre>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    Input
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1.5"
                    onClick={e => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(
                        JSON.stringify(tool.input, null, 2)
                      );
                      toast.success("Copied");
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <pre className="p-2 rounded bg-muted/50 text-xs overflow-x-auto max-h-24 font-mono">
                  {JSON.stringify(tool.input, null, 2)}
                </pre>
              </div>

              {tool.output && !isFailed && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      Output
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 px-1.5"
                      onClick={e => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(tool.output || "");
                        toast.success("Copied");
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
                <div className="flex items-center gap-2 text-cyan-400 text-sm">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Processing...</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ToolExecutionPanel({
  tools,
  thinking,
  isStreaming,
}: {
  tools: StreamingToolCall[];
  thinking?: string;
  isStreaming: boolean;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedToolId, setExpandedToolId] = useState<string | null>(null);
  const [autoExpandedFailures, setAutoExpandedFailures] = useState<Set<string>>(
    new Set()
  );

  const completedCount = tools.filter(t => t.status === "completed").length;
  const runningCount = tools.filter(t => t.status === "running").length;
  const failedCount = tools.filter(t => t.status === "failed").length;
  const totalCount = tools.length;

  useEffect(() => {
    const newFailedTool = tools.find(
      t =>
        t.status === "failed" &&
        !autoExpandedFailures.has(t.id || String(tools.indexOf(t)))
    );
    if (newFailedTool) {
      const toolId = newFailedTool.id || String(tools.indexOf(newFailedTool));
      setExpandedToolId(toolId);
      setAutoExpandedFailures(prev => new Set(prev).add(toolId));
    }
  }, [tools, autoExpandedFailures]);

  const hasRunning = runningCount > 0;
  const allDone = !isStreaming && totalCount > 0 && runningCount === 0;

  // Calculate total duration
  const totalDuration = tools.reduce((acc, t) => {
    const d =
      t.durationMs || (t.endTime && t.startTime ? t.endTime - t.startTime : 0);
    return acc + d;
  }, 0);

  if (tools.length === 0 && !thinking) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card
        className={cn(
          "overflow-hidden transition-all duration-300",
          hasRunning && "border-cyan-500/40 shadow-lg shadow-cyan-500/5",
          allDone && failedCount === 0 && "border-green-500/30",
          allDone &&
            failedCount > 0 &&
            "border-amber-500/40 shadow-lg shadow-amber-500/5"
        )}
      >
        <CardContent className="p-0">
          {/* Header */}
          <div
            className={cn(
              "flex items-center justify-between px-4 py-3 cursor-pointer transition-colors",
              "hover:bg-muted/30 border-b border-border/30"
            )}
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            <div className="flex items-center gap-3">
              {hasRunning ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  <Sparkles className="h-5 w-5 text-cyan-400" />
                </motion.div>
              ) : allDone ? (
                failedCount > 0 ? (
                  <AlertTriangle className="h-5 w-5 text-amber-400" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-green-400" />
                )
              ) : (
                <Brain className="h-5 w-5 text-purple-400" />
              )}
              <div className="flex flex-col">
                <span className="font-medium text-sm">
                  {hasRunning
                    ? "Working..."
                    : allDone
                      ? failedCount > 0
                        ? "Completed with errors"
                        : "Completed"
                      : "Processing"}
                </span>
                {allDone && failedCount > 0 && (
                  <span className="text-xs text-amber-400/80">
                    {failedCount} tool{failedCount > 1 ? "s" : ""} failed -
                    click to view details
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Stats */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {completedCount > 0 && (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-green-400" />
                    {completedCount}
                  </span>
                )}
                {runningCount > 0 && (
                  <span className="flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin text-cyan-400" />
                    {runningCount}
                  </span>
                )}
                {failedCount > 0 && (
                  <span className="flex items-center gap-1">
                    <XCircle className="h-3 w-3 text-red-400" />
                    {failedCount}
                  </span>
                )}
              </div>

              {totalDuration > 0 && (
                <span className="text-xs text-muted-foreground font-mono">
                  {(totalDuration / 1000).toFixed(1)}s
                </span>
              )}

              <motion.div
                animate={{ rotate: isCollapsed ? 0 : 180 }}
                transition={{ duration: 0.2 }}
                className="text-muted-foreground"
              >
                <ChevronRight className="h-4 w-4 rotate-90" />
              </motion.div>
            </div>
          </div>

          {/* Collapsible content */}
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {/* Thinking section */}
                {thinking && (
                  <div className="px-4 py-3 border-b border-border/20 bg-purple-500/5">
                    <div className="flex items-start gap-3">
                      <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="p-1.5 rounded-full bg-purple-500/20 flex-shrink-0"
                      >
                        <Brain className="h-4 w-4 text-purple-400" />
                      </motion.div>
                      <div className="flex-1 min-w-0 prose prose-invert prose-sm max-w-none prose-p:text-purple-200/90 prose-p:my-1">
                        <Streamdown>{thinking}</Streamdown>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tool list */}
                <div className="py-1">
                  {tools.map((tool, index) => (
                    <ToolRow
                      key={tool.id || index}
                      tool={tool}
                      isExpanded={expandedToolId === (tool.id || String(index))}
                      onToggle={() =>
                        setExpandedToolId(
                          expandedToolId === (tool.id || String(index))
                            ? null
                            : tool.id || String(index)
                        )
                      }
                    />
                  ))}
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

type Artifact = {
  type: string;
  url?: string;
  content?: string;
  path?: string;
  filename?: string;
  downloadUrl?: string;
};

function CompletionCard({
  summary,
  success,
  durationMs,
  artifacts,
}: {
  summary: string | null;
  success: boolean;
  durationMs: number | null;
  artifacts?: Artifact[];
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
      const filename = `rasputin-report-${timestamp}`;

      if (format === "markdown") {
        const content = `# RASPUTIN Task Report\n\n**Date:** ${new Date().toLocaleString()}\n**Status:** ${success ? "Completed" : "Failed"}\n**Duration:** ${durationMs ? (durationMs / 1000).toFixed(1) + "s" : "N/A"}\n\n## Summary\n\n${summary}`;
        const blob = new Blob([content], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${filename}.md`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Exported as Markdown");
      } else if (format === "html") {
        const content = `<!DOCTYPE html><html><head><title>RASPUTIN Report</title><style>body{font-family:system-ui;max-width:800px;margin:40px auto;padding:20px;background:#0a0a0a;color:#e5e5e5}h1{color:#22d3ee}pre{background:#1a1a1a;padding:15px;border-radius:8px;overflow-x:auto}.meta{color:#888;margin-bottom:20px}</style></head><body><h1>RASPUTIN Task Report</h1><div class="meta"><p>Date: ${new Date().toLocaleString()}</p><p>Status: ${success ? "✅ Completed" : "❌ Failed"}</p><p>Duration: ${durationMs ? (durationMs / 1000).toFixed(1) + "s" : "N/A"}</p></div><div>${summary.replace(/\n/g, "<br>")}</div></body></html>`;
        const blob = new Blob([content], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${filename}.html`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Exported as HTML");
      } else if (format === "pdf") {
        const htmlContent = `<h1>RASPUTIN Task Report</h1><div class="meta"><p><strong>Date:</strong> ${new Date().toLocaleString()}</p><p><strong>Status:</strong> ${success ? "Completed" : "Failed"}</p><p><strong>Duration:</strong> ${durationMs ? (durationMs / 1000).toFixed(1) + "s" : "N/A"}</p></div><h2>Summary</h2><div>${summary.replace(/\n/g, "<br>")}</div>`;
        fetch("/api/files/export-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            html: htmlContent,
            filename: `${filename}.pdf`,
          }),
        })
          .then(res => res.blob())
          .then(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${filename}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success("Exported as PDF");
          })
          .catch(() => toast.error("PDF export failed"));
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

              {artifacts?.some(a => a.type === "html" && a.content) && (
                <div className="mt-6 pt-4 border-t border-border/50">
                  <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <Code className="h-4 w-4" />
                    Generated Report Preview
                  </h4>
                  {artifacts
                    .filter(a => a.type === "html" && a.content)
                    .map((artifact, idx) => (
                      <div
                        key={`html-preview-${idx}`}
                        className="rounded-lg overflow-hidden border border-border/50 bg-white"
                      >
                        <iframe
                          srcDoc={artifact.content}
                          title={artifact.filename || "HTML Preview"}
                          className="w-full h-[500px] border-0"
                          sandbox="allow-scripts allow-same-origin"
                        />
                      </div>
                    ))}
                </div>
              )}

              {artifacts && artifacts.length > 0 && (
                <div className="mt-6 pt-4 border-t border-border/50">
                  <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Downloads & Files
                  </h4>
                  <div className="grid gap-2">
                    {artifacts.map((artifact, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-muted/40 to-muted/20 border border-border/50 hover:border-primary/30 transition-colors"
                      >
                        {artifact.type === "image" && (
                          <div className="shrink-0 w-12 h-12 rounded-md overflow-hidden bg-muted">
                            <img
                              src={artifact.url}
                              alt="Preview"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        {artifact.type === "video" && (
                          <div className="shrink-0 w-12 h-12 rounded-md bg-purple-500/20 flex items-center justify-center">
                            <FileText className="h-6 w-6 text-purple-400" />
                          </div>
                        )}
                        {artifact.type === "pdf" && (
                          <div className="shrink-0 w-12 h-12 rounded-md bg-red-500/20 flex items-center justify-center">
                            <File className="h-6 w-6 text-red-400" />
                          </div>
                        )}
                        {artifact.type === "file" && (
                          <div className="shrink-0 w-12 h-12 rounded-md bg-cyan-500/20 flex items-center justify-center">
                            <FileText className="h-6 w-6 text-cyan-400" />
                          </div>
                        )}
                        {artifact.type === "html" && (
                          <div className="shrink-0 w-12 h-12 rounded-md bg-orange-500/20 flex items-center justify-center">
                            <Code className="h-6 w-6 text-orange-400" />
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {artifact.filename ||
                              artifact.path?.split("/").pop() ||
                              `${artifact.type} file`}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {artifact.type}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {artifact.url && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-xs"
                              onClick={() =>
                                window.open(artifact.url!, "_blank")
                              }
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {artifact.downloadUrl && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-xs"
                                onClick={() => {
                                  const url = `${window.location.origin}${artifact.downloadUrl}`;
                                  navigator.clipboard.writeText(url);
                                  toast.success("Link copied");
                                }}
                              >
                                <Link className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-xs"
                                onClick={() =>
                                  window.open(artifact.downloadUrl!, "_blank")
                                }
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            className="h-8 px-3 text-xs bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600"
                            onClick={() => {
                              const a = document.createElement("a");
                              a.href =
                                artifact.downloadUrl || artifact.url || "";
                              a.download = artifact.filename || "download";
                              a.click();
                              toast.success("Download started");
                            }}
                          >
                            <Download className="h-3.5 w-3.5 mr-1.5" />
                            Download
                          </Button>
                        </div>
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

function PastExchangeCard({
  userQuery,
  assistantSummary,
}: {
  userQuery: string;
  assistantSummary: string | null;
}) {
  return (
    <div className="space-y-3 opacity-80">
      <div className="flex gap-3">
        <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
          <span className="text-xs font-medium text-white">You</span>
        </div>
        <div className="flex-1 min-w-0">
          <Card className="bg-muted/30 border-border/50">
            <CardContent className="p-3">
              <p className="text-sm">{userQuery}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {assistantSummary && (
        <div className="flex gap-3">
          <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-green-500 flex items-center justify-center">
            <Brain className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <Card className="bg-green-500/5 border-green-500/20">
              <CardContent className="p-3">
                <div className="prose prose-invert prose-sm max-w-none">
                  <Streamdown>{assistantSummary}</Streamdown>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
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
  }, [
    autoSpeak,
    isComplete,
    state.summary,
    hasAutoSpoken,
    state.success,
    ttsMutation,
  ]);

  useEffect(() => {
    if (state.isStreaming) {
      setHasAutoSpoken(false);
    }
  }, [state.isStreaming]);

  // Helper to extract file path from tool output like "Excel spreadsheet created: /tmp/jarvis-workspace/file.xlsx (123 bytes...)"
  const extractPathFromOutput = (output: string): string | null => {
    // Match patterns like "created: /path/file.ext" or "written to: /path/file.ext"
    const match = output.match(/(?:created|written)[^:]*:\s*([^\s(]+)/i);
    return match ? match[1] : null;
  };

  const artifacts = state.steps
    .filter(s => s.type === "tool" && s.tool)
    .map(s => s.tool!)
    .filter(
      t =>
        t.status === "completed" &&
        (t.name === "write_file" ||
          t.name === "write_xlsx" ||
          t.name === "write_docx" ||
          t.name === "write_pptx")
    )
    .map(t => {
      // Handle document generation tools (write_xlsx, write_docx, write_pptx)
      if (
        (t.name === "write_xlsx" ||
          t.name === "write_docx" ||
          t.name === "write_pptx") &&
        t.output
      ) {
        const filePath = extractPathFromOutput(t.output);
        if (filePath) {
          const filename = filePath.split("/").pop() || filePath;
          const relativePath = filePath.startsWith("/tmp/jarvis-workspace/")
            ? filePath.replace("/tmp/jarvis-workspace/", "")
            : filePath.startsWith("/tmp/")
              ? filePath.replace("/tmp/", "")
              : filePath.startsWith("/")
                ? filePath.substring(1)
                : filePath;
          const downloadUrl = `/api/files/workspace/${relativePath}`;

          const fileType =
            t.name === "write_xlsx"
              ? "xlsx"
              : t.name === "write_docx"
                ? "docx"
                : "pptx";
          return {
            type: "file",
            path: filePath,
            filename,
            downloadUrl,
            fileType,
          };
        }
      }

      if (
        t.name === "write_file" &&
        t.input &&
        typeof t.input === "object" &&
        "path" in t.input
      ) {
        const filePath = String((t.input as Record<string, unknown>).path);
        const content = (t.input as Record<string, unknown>).content;
        const filename = filePath.split("/").pop() || filePath;
        const relativePath = filePath.startsWith("/tmp/jarvis-workspace/")
          ? filePath.replace("/tmp/jarvis-workspace/", "")
          : filePath.startsWith("/tmp/")
            ? filePath.replace("/tmp/", "")
            : filePath.startsWith("/")
              ? filePath.substring(1)
              : filePath;
        const downloadUrl = `/api/files/workspace/${relativePath}`;

        if (filePath.endsWith(".html")) {
          if (typeof content === "string") {
            return {
              type: "html",
              content,
              path: filePath,
              filename,
              downloadUrl,
            };
          }
        } else if (filePath.endsWith(".pdf")) {
          return { type: "pdf", path: filePath, filename, downloadUrl };
        } else if (filePath.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i)) {
          return {
            type: "image",
            url: downloadUrl,
            path: filePath,
            filename,
            downloadUrl,
          };
        } else if (filePath.match(/\.(mp4|webm|mov)$/i)) {
          return {
            type: "video",
            url: downloadUrl,
            path: filePath,
            filename,
            downloadUrl,
          };
        } else {
          return { type: "file", path: filePath, filename, downloadUrl };
        }
      }
      return null;
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);

  // Extract tools and thinking from steps
  const tools = state.steps
    .filter(s => s.type === "tool" && s.tool)
    .map(s => s.tool!);

  const latestThinking = state.steps
    .filter(s => s.type === "thinking" && s.content)
    .pop()?.content;

  const pastExchanges = state.exchanges.slice(0, -1);
  const currentExchange = state.exchanges[state.exchanges.length - 1];

  return (
    <div className="space-y-4">
      {pastExchanges.map((exchange, idx) => (
        <PastExchangeCard
          key={`exchange-${idx}-${exchange.timestamp}`}
          userQuery={exchange.userQuery}
          assistantSummary={exchange.assistantSummary}
        />
      ))}

      {currentExchange && (
        <div className="flex gap-3 mb-4">
          <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
            <span className="text-xs font-medium text-white">You</span>
          </div>
          <div className="flex-1 min-w-0">
            <Card className="bg-muted/30 border-border/50">
              <CardContent className="p-3">
                <p className="text-sm">{currentExchange.userQuery}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <ProgressIndicator
        current={state.currentIteration}
        max={state.maxIterations}
        isStreaming={state.isStreaming}
        success={state.success}
      />

      {(tools.length > 0 || latestThinking) && (
        <ToolExecutionPanel
          tools={tools}
          thinking={state.isStreaming ? latestThinking : undefined}
          isStreaming={state.isStreaming}
        />
      )}

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
