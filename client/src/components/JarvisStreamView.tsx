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
  FileJson,
  ExternalLink,
  File,
  AlertTriangle,
} from "lucide-react";
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
import { StreamingMarkdown } from "./TypewriterText";

function extractDisplayQuery(query: string): {
  displayQuery: string;
  hasAttachments: boolean;
} {
  const userTaskMatch = query.match(/\[USER TASK\]\s*\n?([\s\S]*?)$/i);
  if (userTaskMatch) {
    return {
      displayQuery: userTaskMatch[1].trim(),
      hasAttachments: query.includes("[ATTACHED FILES]"),
    };
  }

  const userQuestionMatch = query.match(/\[USER QUESTION\]\s*\n?([\s\S]*?)$/i);
  if (userQuestionMatch) {
    return {
      displayQuery: userQuestionMatch[1].trim(),
      hasAttachments: query.includes("[ATTACHED FILES]"),
    };
  }

  return { displayQuery: query, hasAttachments: false };
}

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

function _getFileIcon(
  filename: string,
  type: string
): { icon: React.ReactNode; gradient: string; ring: string } {
  const ext = filename?.split(".").pop()?.toLowerCase() || "";

  const iconMap: Record<
    string,
    { icon: React.ReactNode; gradient: string; ring: string }
  > = {
    md: {
      icon: <FileText className="h-7 w-7 text-slate-400" />,
      gradient: "from-slate-500/30 to-gray-500/30",
      ring: "ring-slate-500/20 hover:ring-slate-500/40",
    },
    py: {
      icon: <Code className="h-7 w-7 text-yellow-400" />,
      gradient: "from-yellow-500/30 to-blue-500/30",
      ring: "ring-yellow-500/20 hover:ring-yellow-500/40",
    },
    js: {
      icon: <Code className="h-7 w-7 text-yellow-300" />,
      gradient: "from-yellow-400/30 to-yellow-600/30",
      ring: "ring-yellow-400/20 hover:ring-yellow-400/40",
    },
    ts: {
      icon: <Code className="h-7 w-7 text-blue-400" />,
      gradient: "from-blue-500/30 to-blue-700/30",
      ring: "ring-blue-500/20 hover:ring-blue-500/40",
    },
    tsx: {
      icon: <Code className="h-7 w-7 text-blue-400" />,
      gradient: "from-blue-500/30 to-cyan-500/30",
      ring: "ring-blue-500/20 hover:ring-blue-500/40",
    },
    json: {
      icon: <FileJson className="h-7 w-7 text-amber-400" />,
      gradient: "from-amber-500/30 to-orange-500/30",
      ring: "ring-amber-500/20 hover:ring-amber-500/40",
    },
    css: {
      icon: <Code className="h-7 w-7 text-blue-500" />,
      gradient: "from-blue-500/30 to-purple-500/30",
      ring: "ring-blue-500/20 hover:ring-blue-500/40",
    },
    html: {
      icon: <Code className="h-7 w-7 text-orange-400" />,
      gradient: "from-orange-500/30 to-amber-500/30",
      ring: "ring-orange-500/20 hover:ring-orange-500/40",
    },
    xlsx: {
      icon: <FileText className="h-7 w-7 text-green-500" />,
      gradient: "from-green-500/30 to-emerald-500/30",
      ring: "ring-green-500/20 hover:ring-green-500/40",
    },
    docx: {
      icon: <FileText className="h-7 w-7 text-blue-600" />,
      gradient: "from-blue-600/30 to-blue-800/30",
      ring: "ring-blue-600/20 hover:ring-blue-600/40",
    },
    pptx: {
      icon: <FileText className="h-7 w-7 text-orange-500" />,
      gradient: "from-orange-500/30 to-red-500/30",
      ring: "ring-orange-500/20 hover:ring-orange-500/40",
    },
    pdf: {
      icon: <File className="h-7 w-7 text-red-400" />,
      gradient: "from-red-500/30 to-orange-500/30",
      ring: "ring-red-500/20 hover:ring-red-500/40",
    },
    sh: {
      icon: <Terminal className="h-7 w-7 text-green-400" />,
      gradient: "from-green-500/30 to-teal-500/30",
      ring: "ring-green-500/20 hover:ring-green-500/40",
    },
    txt: {
      icon: <FileText className="h-7 w-7 text-gray-400" />,
      gradient: "from-gray-500/30 to-slate-500/30",
      ring: "ring-gray-500/20 hover:ring-gray-500/40",
    },
    sql: {
      icon: <FileText className="h-7 w-7 text-indigo-400" />,
      gradient: "from-indigo-500/30 to-purple-500/30",
      ring: "ring-indigo-500/20 hover:ring-indigo-500/40",
    },
    yaml: {
      icon: <FileText className="h-7 w-7 text-pink-400" />,
      gradient: "from-pink-500/30 to-rose-500/30",
      ring: "ring-pink-500/20 hover:ring-pink-500/40",
    },
    yml: {
      icon: <FileText className="h-7 w-7 text-pink-400" />,
      gradient: "from-pink-500/30 to-rose-500/30",
      ring: "ring-pink-500/20 hover:ring-pink-500/40",
    },
    png: {
      icon: <ImageIcon className="h-7 w-7 text-pink-400" />,
      gradient: "from-pink-500/20 to-purple-500/20",
      ring: "ring-pink-500/20 hover:ring-pink-500/40",
    },
    jpg: {
      icon: <ImageIcon className="h-7 w-7 text-pink-400" />,
      gradient: "from-pink-500/20 to-purple-500/20",
      ring: "ring-pink-500/20 hover:ring-pink-500/40",
    },
    jpeg: {
      icon: <ImageIcon className="h-7 w-7 text-pink-400" />,
      gradient: "from-pink-500/20 to-purple-500/20",
      ring: "ring-pink-500/20 hover:ring-pink-500/40",
    },
    svg: {
      icon: <ImageIcon className="h-7 w-7 text-emerald-400" />,
      gradient: "from-emerald-500/20 to-green-500/20",
      ring: "ring-emerald-500/20 hover:ring-emerald-500/40",
    },
    gif: {
      icon: <ImageIcon className="h-7 w-7 text-purple-400" />,
      gradient: "from-purple-500/20 to-pink-500/20",
      ring: "ring-purple-500/20 hover:ring-purple-500/40",
    },
    webp: {
      icon: <ImageIcon className="h-7 w-7 text-indigo-400" />,
      gradient: "from-indigo-500/20 to-purple-500/20",
      ring: "ring-indigo-500/20 hover:ring-indigo-500/40",
    },
  };

  if (iconMap[ext]) return iconMap[ext];

  if (type === "image")
    return {
      icon: <ImageIcon className="h-7 w-7 text-pink-400" />,
      gradient: "from-pink-500/20 to-purple-500/20",
      ring: "ring-pink-500/20 hover:ring-pink-500/40",
    };
  if (type === "video")
    return {
      icon: <FileText className="h-7 w-7 text-purple-400" />,
      gradient: "from-purple-500/30 to-pink-500/30",
      ring: "ring-purple-500/20 hover:ring-purple-500/40",
    };
  if (type === "pdf")
    return {
      icon: <File className="h-7 w-7 text-red-400" />,
      gradient: "from-red-500/30 to-orange-500/30",
      ring: "ring-red-500/20 hover:ring-red-500/40",
    };
  if (type === "html")
    return {
      icon: <Code className="h-7 w-7 text-orange-400" />,
      gradient: "from-orange-500/30 to-amber-500/30",
      ring: "ring-orange-500/20 hover:ring-orange-500/40",
    };

  return {
    icon: <FileText className="h-7 w-7 text-cyan-400" />,
    gradient: "from-cyan-500/30 to-blue-500/30",
    ring: "ring-cyan-500/20 hover:ring-cyan-500/40",
  };
}

function _getFileTypeLabel(filename: string, type: string): string {
  const ext = filename?.split(".").pop()?.toLowerCase() || "";
  const labels: Record<string, string> = {
    md: "Markdown",
    py: "Python",
    js: "JavaScript",
    ts: "TypeScript",
    tsx: "React",
    json: "JSON",
    css: "Stylesheet",
    html: "HTML",
    xlsx: "Excel",
    docx: "Word",
    pptx: "PowerPoint",
    pdf: "PDF",
    sh: "Shell Script",
    txt: "Text",
    sql: "SQL",
    yaml: "YAML",
    yml: "YAML",
    png: "PNG Image",
    jpg: "JPEG Image",
    jpeg: "JPEG Image",
    svg: "SVG Image",
    gif: "GIF Image",
    webp: "WebP Image",
  };
  if (labels[ext]) return labels[ext];
  if (type === "image") return "Image";
  if (type === "video") return "Video";
  if (type === "pdf") return "PDF Document";
  if (type === "html") return "HTML Document";
  return "File";
}

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
  isStreaming,
}: {
  tools: StreamingToolCall[];
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

  if (tools.length === 0) return null;

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

import { ExportPanel } from "./ExportPanel";
import { ReportPreview } from "./ReportPreview";

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

  const exportContent = {
    title: "RASPUTIN Task Report",
    content: summary || "",
    metadata: {
      date: new Date().toLocaleString(),
      duration: durationMs ? (durationMs / 1000).toFixed(1) + "s" : undefined,
      status: success ? "Completed" : "Failed",
    },
    artifacts: artifacts,
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="print:bg-white print:text-black"
    >
      <Card
        className={cn(
          "border-2 overflow-hidden",
          success ? "border-green-500/30" : "border-red-500/30"
        )}
      >
        <CardContent className="p-0">
          <div className="p-6">
            <div className="flex items-start gap-4 mb-6">
              <div
                className={cn(
                  "p-3 rounded-full shrink-0",
                  success ? "bg-green-500/20" : "bg-red-500/20"
                )}
              >
                {success ? (
                  <CheckCircle2 className="h-6 w-6 text-green-400" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xl font-semibold">
                    {success ? "Task Completed" : "Task Failed"}
                  </h3>
                  <div className="flex items-center gap-2">
                    {durationMs && (
                      <Badge variant="outline" className="font-mono">
                        {(durationMs / 1000).toFixed(1)}s
                      </Badge>
                    )}
                    {summary && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={handleSpeak}
                        title={isSpeaking ? "Stop speaking" : "Read aloud"}
                      >
                        {isSpeaking ? (
                          <VolumeX className="h-4 w-4 text-purple-400" />
                        ) : (
                          <Volume2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>

                {summary && (
                  <ReportPreview
                    content={summary}
                    artifacts={artifacts || []}
                    isStreaming={false}
                  />
                )}
              </div>
            </div>
          </div>

          {artifacts?.some(a => a.type === "html" && a.downloadUrl) && (
            <div className="border-t border-border/50">
              <div className="p-4 bg-gradient-to-r from-purple-500/10 to-cyan-500/10">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-cyan-400" />
                    Generated Report
                  </h4>
                  <div className="flex gap-2">
                    {artifacts
                      .filter(a => a.type === "html" && a.downloadUrl)
                      .map((a, i) => (
                        <Button
                          key={i}
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(a.downloadUrl, "_blank")}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Open in New Tab
                        </Button>
                      ))}
                  </div>
                </div>
                <div className="rounded-lg overflow-hidden border border-border/50 bg-white">
                  {artifacts
                    .filter(a => a.type === "html" && a.downloadUrl)
                    .map((a, i) => (
                      <iframe
                        key={i}
                        src={a.downloadUrl}
                        className="w-full h-[600px] bg-white"
                        title={a.filename || "Report Preview"}
                      />
                    ))}
                </div>
              </div>
            </div>
          )}

          <div className="bg-muted/30 border-t border-border/50 p-6">
            <ExportPanel content={exportContent} />
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
  const { displayQuery, hasAttachments } = extractDisplayQuery(userQuery);

  return (
    <div className="space-y-3 opacity-80">
      <div className="flex gap-3">
        <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
          <span className="text-xs font-medium text-white">You</span>
        </div>
        <div className="flex-1 min-w-0">
          <Card className="bg-muted/30 border-border/50">
            <CardContent className="p-3">
              {hasAttachments && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                  <File className="h-3 w-3" />
                  <span>Files attached</span>
                </div>
              )}
              <p className="text-sm">{displayQuery}</p>
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

  const writeTools = state.steps
    .filter(s => s.type === "tool" && s.tool)
    .map(s => s.tool!)
    .filter(
      t =>
        t.status === "completed" &&
        (t.name === "write_file" ||
          t.name === "write_xlsx" ||
          t.name === "write_docx" ||
          t.name === "write_pptx" ||
          t.name === "create_rich_report")
    );

  const artifacts = writeTools
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
          const relativePath = filePath
            .replace(/^\/tmp\/jarvis-workspace\//, "")
            .replace(/^jarvis-workspace\//, "")
            .replace(/^\/tmp\//, "")
            .replace(/^\//, "");
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

      if (t.name === "create_rich_report" && t.output) {
        const pathMatch = t.output.match(/Path:\s*([^\n]+\.html)/i);
        if (pathMatch) {
          const filePath = pathMatch[1].trim();
          const filename = filePath.split("/").pop() || filePath;
          const relativePath = filePath
            .replace(/^\/tmp\/jarvis-workspace\//, "")
            .replace(/^jarvis-workspace\//, "")
            .replace(/^\/tmp\//, "")
            .replace(/^\//, "");
          const downloadUrl = `/api/files/workspace/${relativePath}`;

          return {
            type: "html",
            path: filePath,
            filename,
            downloadUrl,
            url: downloadUrl,
          };
        }
      }

      if (t.name === "write_file") {
        let filePath: string | null = null;
        let content: unknown = null;

        if (t.input && typeof t.input === "object" && "path" in t.input) {
          filePath = String((t.input as Record<string, unknown>).path);
          content = (t.input as Record<string, unknown>).content;
        } else if (t.output) {
          filePath = extractPathFromOutput(t.output);
        }

        if (!filePath) return null;

        const filename = filePath.split("/").pop() || filePath;
        const relativePath = filePath
          .replace(/^\/tmp\/jarvis-workspace\//, "")
          .replace(/^jarvis-workspace\//, "")
          .replace(/^\/tmp\//, "")
          .replace(/^\//, "");
        const downloadUrl = `/api/files/workspace/${relativePath}`;

        if (filePath.endsWith(".html") && typeof content === "string") {
          return {
            type: "html",
            content,
            path: filePath,
            filename,
            downloadUrl,
          };
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

      {currentExchange &&
        (() => {
          const { displayQuery, hasAttachments } = extractDisplayQuery(
            currentExchange.userQuery
          );
          return (
            <div className="flex gap-3 mb-4">
              <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
                <span className="text-xs font-medium text-white">You</span>
              </div>
              <div className="flex-1 min-w-0">
                <Card className="bg-muted/30 border-border/50">
                  <CardContent className="p-3">
                    {hasAttachments && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                        <File className="h-3 w-3" />
                        <span>Files attached</span>
                      </div>
                    )}
                    <p className="text-sm">{displayQuery}</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          );
        })()}

      <ProgressIndicator
        current={state.currentIteration}
        max={state.maxIterations}
        isStreaming={state.isStreaming}
        success={state.success}
      />

      {state.isStreaming && latestThinking && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative"
        >
          <div className="flex gap-3">
            <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-green-500 flex items-center justify-center">
              <Brain className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <Card className="border-cyan-500/30 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5 overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-500 via-purple-500 to-cyan-500 animate-pulse" />
                <CardContent className="p-4">
                  <StreamingMarkdown
                    content={latestThinking}
                    isStreaming={true}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </motion.div>
      )}

      {tools.length > 0 && (
        <ToolExecutionPanel tools={tools} isStreaming={state.isStreaming} />
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
