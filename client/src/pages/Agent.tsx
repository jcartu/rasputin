import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useJarvisStream } from "@/hooks/useJarvisStream";
import { JarvisStreamView } from "@/components/JarvisStreamView";
import { JarvisThinkingPanel } from "@/components/JarvisThinkingPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Send,
  Bot,
  User,
  Loader2,
  Globe,
  Code,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  Brain,
  Search,
  Terminal,
  FolderOpen,
  ArrowLeft,
  Plus,
  Trash2,
  Copy,
  Calculator,
  Image as ImageIcon,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Sparkles,
  Mic,
  Volume2,
  VolumeX,
  Calendar,
  Play,
  Pause,
  Square,
  Server,
  Activity,
  Users,
  GitBranch,
  Webhook,
  StopCircle,
  Shield,
  Download,
  ExternalLink,
  Maximize2,
  X,
  Paperclip,
  Video,
  Music,
  FileSpreadsheet,
  FileCode,
  Archive,
  Presentation,
  File as FileIcon,
  History,
} from "lucide-react";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import { WorkspaceIDE } from "@/components/WorkspaceIDE";
import {
  ToolOutputPreview,
  WeatherCard,
  type WeatherData,
} from "@/components/ToolOutputPreview";
import { HostsManager } from "@/components/HostsManager";
import { ApprovalBadge, ApprovalWorkflow } from "@/components/ApprovalWorkflow";
import { ExportMenu } from "@/components/ExportMenu";
import { VoiceConversation } from "@/components/VoiceConversation";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import { FileUpload, type ProcessedFile } from "@/components/FileUpload";
import { motion, AnimatePresence } from "framer-motion";
import { SwarmActivityPanel } from "@/components/SwarmActivityPanel";

// Types for JARVIS
interface ToolCall {
  id: string;
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  input?: string;
  output?: string;
  startTime?: number;
  endTime?: number;
  durationMs?: number | null;
}

interface AgentStep {
  id: string;
  type: "thinking" | "tool_call" | "tool" | "response";
  content?: string;
  tool?: string;
  input?: string;
  output?: string;
  status?: "pending" | "running" | "success" | "error";
  toolCalls?: ToolCall[];
  timestamp: number;
  durationMs?: number | null;
}

interface AgentMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  steps?: AgentStep[];
  timestamp: number;
}

interface AgentTask {
  id: string | number;
  title: string;
  query?: string;
  status: "idle" | "running" | "completed" | "failed" | "waiting_approval";
  messages: AgentMessage[];
  createdAt: number;
  iterationCount?: number;
  durationMs?: number;
  errorMessage?: string;
  pendingApprovalId?: number | null;
  errorType?:
    | "api_error"
    | "timeout"
    | "execution_error"
    | "rate_limit"
    | "unknown";
}

// Task templates for quick start
const TASK_TEMPLATES = [
  {
    category: "Research",
    icon: <Search className="h-4 w-4" />,
    templates: [
      {
        title: "Web Research",
        prompt:
          "Research the latest developments in [topic] and summarize the key findings",
      },
      {
        title: "Compare Options",
        prompt: "Compare [option A] vs [option B] and provide a recommendation",
      },
      {
        title: "Find Information",
        prompt: "Find the current [data point] for [subject]",
      },
    ],
  },
  {
    category: "Code",
    icon: <Code className="h-4 w-4" />,
    templates: [
      {
        title: "Write Script",
        prompt: "Write a Python script that [description]",
      },
      {
        title: "Debug Code",
        prompt: "Debug this code and explain the issue: [paste code]",
      },
      {
        title: "Generate Function",
        prompt: "Create a function that [description] in [language]",
      },
    ],
  },
  {
    category: "Data",
    icon: <Calculator className="h-4 w-4" />,
    templates: [
      {
        title: "Calculate",
        prompt: "Calculate [mathematical expression or problem]",
      },
      {
        title: "Analyze Data",
        prompt: "Analyze this data and provide insights: [paste data]",
      },
      {
        title: "Generate Report",
        prompt: "Generate a report on [topic] with statistics",
      },
    ],
  },
  {
    category: "Creative",
    icon: <ImageIcon className="h-4 w-4" />,
    templates: [
      { title: "Generate Image", prompt: "Generate an image of [description]" },
      {
        title: "Write Content",
        prompt: "Write [type of content] about [topic]",
      },
      {
        title: "Brainstorm Ideas",
        prompt: "Brainstorm 10 ideas for [topic or problem]",
      },
    ],
  },
  {
    category: "Multi-Model",
    icon: <Users className="h-4 w-4" />,
    templates: [
      {
        title: "Get Consensus",
        prompt:
          "Get consensus from multiple AI models (GPT-5, Claude, Gemini, Grok) on [topic]",
      },
      {
        title: "Deep Synthesis",
        prompt:
          "Run deep synthesis research on [topic] using web search and multi-model analysis",
      },
      {
        title: "Model Comparison",
        prompt:
          "Compare how different AI models approach [problem or question]",
      },
    ],
  },
];

// Tool icon mapping
const toolIcons: Record<string, React.ReactNode> = {
  web_search: <Search className="h-4 w-4" />,
  browse_url: <Globe className="h-4 w-4" />,
  execute_python: <Code className="h-4 w-4 text-yellow-400" />,
  execute_javascript: <Code className="h-4 w-4 text-yellow-300" />,
  run_shell: <Terminal className="h-4 w-4" />,
  read_file: <FileText className="h-4 w-4" />,
  write_file: <FileText className="h-4 w-4" />,
  list_files: <FolderOpen className="h-4 w-4" />,
  calculate: <Calculator className="h-4 w-4" />,
  http_request: <Globe className="h-4 w-4" />,
  generate_image: <ImageIcon className="h-4 w-4" />,
  get_datetime: <Clock className="h-4 w-4" />,
};

function AgentToolRow({
  tool,
  isExpanded,
  onToggle,
}: {
  tool: ToolCall;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const statusIcon = {
    pending: <Clock className="h-3.5 w-3.5 text-muted-foreground" />,
    running: <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />,
    completed: <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />,
    failed: <XCircle className="h-3.5 w-3.5 text-red-400" />,
  };

  const duration = tool.durationMs
    ? (tool.durationMs / 1000).toFixed(2)
    : tool.endTime && tool.startTime
      ? ((tool.endTime - tool.startTime) / 1000).toFixed(2)
      : null;

  return (
    <div className="group">
      <div
        className={cn(
          "flex items-center gap-3 py-2 px-3 cursor-pointer rounded-md transition-colors",
          "hover:bg-muted/40",
          isExpanded && "bg-muted/30"
        )}
        onClick={onToggle}
      >
        <div className="flex-shrink-0">{statusIcon[tool.status]}</div>
        <div
          className={cn(
            "p-1.5 rounded transition-colors flex-shrink-0",
            tool.status === "running" && "bg-cyan-500/20",
            tool.status === "completed" && "bg-green-500/10",
            tool.status === "failed" && "bg-red-500/10"
          )}
        >
          {toolIcons[tool.name] || <Zap className="h-3.5 w-3.5" />}
        </div>
        <span
          className={cn(
            "font-mono text-sm flex-1 truncate",
            tool.status === "running" && "text-cyan-400",
            tool.status === "completed" && "text-foreground/80",
            tool.status === "failed" && "text-red-400"
          )}
        >
          {tool.name.replace(/_/g, " ")}
        </span>
        {duration && (
          <span className="text-xs text-muted-foreground font-mono flex-shrink-0">
            {duration}s
          </span>
        )}
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground/50 transition-transform flex-shrink-0",
            isExpanded && "rotate-90"
          )}
        />
      </div>

      {isExpanded && (
        <div className="ml-10 mr-3 mb-2 p-3 rounded-md bg-muted/20 border border-border/30 space-y-3">
          {tool.input && (
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
                    navigator.clipboard.writeText(tool.input || "");
                    toast.success("Copied");
                  }}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <pre className="p-2 rounded bg-muted/50 text-xs overflow-x-auto max-h-24 font-mono">
                {tool.input}
              </pre>
            </div>
          )}
          {tool.output && (
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
                input={tool.input}
              />
            </div>
          )}
          {tool.status === "running" && !tool.output && (
            <div className="flex items-center gap-2 text-cyan-400 text-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Processing...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Consolidated panel for agent steps (tools + thinking)
function AgentStepsPanel({
  steps,
  isLive,
}: {
  steps: AgentStep[];
  isLive?: boolean;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedToolId, setExpandedToolId] = useState<string | null>(null);

  const tools: ToolCall[] = steps
    .filter(s => s.type === "tool" || s.type === "tool_call")
    .map(s => ({
      id: s.id,
      name: s.tool || "unknown",
      status:
        s.status === "success"
          ? "completed"
          : s.status === "error"
            ? "failed"
            : s.status === "running"
              ? "running"
              : "pending",
      input: s.input,
      output: s.output,
      startTime: s.timestamp,
      endTime:
        s.status === "success" || s.status === "error" ? Date.now() : undefined,
      durationMs: s.durationMs,
    }));

  const thinkingSteps = steps.filter(s => s.type === "thinking" && s.content);
  const latestThinking = thinkingSteps[thinkingSteps.length - 1]?.content;

  const completedCount = tools.filter(t => t.status === "completed").length;
  const runningCount = tools.filter(t => t.status === "running").length;
  const failedCount = tools.filter(t => t.status === "failed").length;

  const hasRunning = runningCount > 0;
  const allDone = !isLive && tools.length > 0 && runningCount === 0;

  if (tools.length === 0 && !latestThinking) return null;

  return (
    <Card
      className={cn(
        "overflow-hidden transition-all duration-300 bg-background/50",
        hasRunning && "border-cyan-500/40 shadow-lg shadow-cyan-500/5",
        allDone && failedCount === 0 && "border-green-500/30",
        allDone && failedCount > 0 && "border-yellow-500/30"
      )}
    >
      <CardContent className="p-0">
        {/* Header */}
        <div
          className={cn(
            "flex items-center justify-between px-4 py-2.5 cursor-pointer transition-colors",
            "hover:bg-muted/30 border-b border-border/30"
          )}
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <div className="flex items-center gap-3">
            {hasRunning ? (
              <Sparkles className="h-4 w-4 text-cyan-400 animate-pulse" />
            ) : allDone ? (
              failedCount > 0 ? (
                <XCircle className="h-4 w-4 text-yellow-400" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-green-400" />
              )
            ) : (
              <Brain className="h-4 w-4 text-purple-400" />
            )}
            <span className="font-medium text-sm">
              {hasRunning
                ? "Working..."
                : allDone
                  ? failedCount > 0
                    ? "Completed with errors"
                    : "Completed"
                  : "Processing"}
            </span>
          </div>

          <div className="flex items-center gap-3">
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

            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                isCollapsed && "-rotate-90"
              )}
            />
          </div>
        </div>

        {/* Collapsible content */}
        {!isCollapsed && (
          <div>
            {/* Thinking section */}
            {latestThinking && isLive && (
              <div className="px-4 py-2.5 border-b border-border/20 bg-purple-500/5">
                <div className="flex items-start gap-3">
                  <Brain className="h-4 w-4 text-purple-400 animate-pulse mt-0.5 flex-shrink-0" />
                  <p className="text-sm italic text-purple-200/90">
                    {latestThinking}
                  </p>
                </div>
              </div>
            )}

            {/* Tool list */}
            <div className="py-1">
              {tools.map((tool, index) => (
                <AgentToolRow
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface GeneratedImage {
  url: string;
  prompt?: string;
  timestamp: number;
}

function extractGeneratedImages(steps?: AgentStep[]): GeneratedImage[] {
  if (!steps) return [];

  const images: GeneratedImage[] = [];

  for (const step of steps) {
    if (
      step.tool === "generate_image" &&
      step.status === "success" &&
      step.output
    ) {
      let prompt: string | undefined;
      try {
        const input = step.input ? JSON.parse(step.input) : null;
        prompt = input?.prompt;
      } catch {
        prompt = undefined;
      }

      const dataUrlMatch = step.output.match(
        /(data:image\/[^;]+;base64,[A-Za-z0-9+/=]+)/
      );
      if (dataUrlMatch) {
        images.push({
          url: dataUrlMatch[1],
          prompt,
          timestamp: step.timestamp,
        });
        continue;
      }

      const urlMatch = step.output.match(
        /(https?:\/\/[^\s\n]+\.(jpg|jpeg|png|gif|webp)[^\s\n]*)/i
      );
      if (urlMatch) {
        images.push({
          url: urlMatch[1],
          prompt,
          timestamp: step.timestamp,
        });
      }
    }
  }

  return images;
}

function extractWeatherData(steps?: AgentStep[]): WeatherData | null {
  if (!steps) return null;

  for (const step of steps) {
    if (
      step.tool === "get_weather" &&
      step.status === "success" &&
      step.output
    ) {
      try {
        const data = JSON.parse(step.output);
        if (data.__type === "weather") {
          return data as WeatherData;
        }
      } catch {
        continue;
      }
    }
  }

  return null;
}

function WeatherDisplay({ steps }: { steps?: AgentStep[] }) {
  const weatherData = extractWeatherData(steps);
  if (!weatherData) return null;
  return <WeatherCard data={weatherData} />;
}

function GeneratedImagesDisplay({ images }: { images: GeneratedImage[] }) {
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const [errorImages, setErrorImages] = useState<Set<string>>(new Set());
  const [imageDimensions, setImageDimensions] = useState<
    Record<string, { width: number; height: number }>
  >({});

  if (images.length === 0) return null;

  const handleImageLoad = (url: string, img: HTMLImageElement) => {
    setLoadedImages(prev => new Set(prev).add(url));
    setImageDimensions(prev => ({
      ...prev,
      [url]: { width: img.naturalWidth, height: img.naturalHeight },
    }));
  };

  return (
    <>
      <div className="space-y-4">
        {images.map((image, idx) => (
          <div
            key={idx}
            className="rounded-xl border border-border bg-gradient-to-b from-purple-500/5 to-cyan-500/5 overflow-hidden"
          >
            <div className="relative group">
              {!loadedImages.has(image.url) && !errorImages.has(image.url) && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted/50 min-h-[200px]">
                  <div className="animate-pulse flex flex-col items-center gap-2">
                    <ImageIcon className="h-10 w-10 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Loading image...
                    </span>
                  </div>
                </div>
              )}
              {errorImages.has(image.url) ? (
                <div className="flex flex-col items-center gap-3 p-8 bg-muted/30">
                  <ImageIcon className="h-10 w-10 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Failed to load image
                  </span>
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={image.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-3 w-3 mr-2" />
                      Open URL
                    </a>
                  </Button>
                </div>
              ) : (
                <img
                  src={image.url}
                  alt={image.prompt || "Generated image"}
                  className={cn(
                    "w-full max-h-[500px] object-contain cursor-pointer transition-all duration-200",
                    loadedImages.has(image.url) ? "opacity-100" : "opacity-0",
                    "hover:scale-[1.01]"
                  )}
                  onClick={() => setFullscreenImage(image.url)}
                  onError={() =>
                    setErrorImages(prev => new Set(prev).add(image.url))
                  }
                  onLoad={e => handleImageLoad(image.url, e.currentTarget)}
                />
              )}
              {loadedImages.has(image.url) && (
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-9 px-3 bg-black/70 hover:bg-black/90 text-white border-0 backdrop-blur-sm"
                    onClick={() => setFullscreenImage(image.url)}
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border/50 bg-background/50">
              {image.prompt && (
                <p className="text-sm text-foreground/90 mb-3 leading-relaxed">
                  {image.prompt}
                </p>
              )}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <ImageIcon className="h-3.5 w-3.5 text-purple-400" />
                    <span>AI Generated</span>
                  </div>
                  {imageDimensions[image.url] && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-cyan-400">
                        {imageDimensions[image.url].width}
                      </span>
                      <span>×</span>
                      <span className="text-cyan-400">
                        {imageDimensions[image.url].height}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-3 text-xs"
                    asChild
                  >
                    <a
                      href={image.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-3 w-3 mr-1.5" />
                      Open
                    </a>
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="h-8 px-4 text-xs bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600"
                    asChild
                  >
                    <a
                      href={image.url}
                      download={`generated-image-${idx + 1}.png`}
                    >
                      <Download className="h-3 w-3 mr-1.5" />
                      Download
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog
        open={!!fullscreenImage}
        onOpenChange={() => setFullscreenImage(null)}
      >
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-border">
          <DialogTitle className="sr-only">Image Preview</DialogTitle>
          <div className="relative flex flex-col h-full">
            <div className="absolute top-3 right-3 z-10 flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="bg-black/60 hover:bg-black/80"
                asChild
              >
                <a href={fullscreenImage || ""} download>
                  <Download className="h-4 w-4" />
                </a>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="bg-black/60 hover:bg-black/80"
                onClick={() => setFullscreenImage(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {fullscreenImage && (
              <img
                src={fullscreenImage}
                alt="Fullscreen preview"
                className="w-full h-full object-contain p-4"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function extractHtmlReports(steps?: AgentStep[]): Array<{
  path: string;
  filename: string;
  downloadUrl: string;
}> {
  if (!steps) return [];

  const reports: Array<{
    path: string;
    filename: string;
    downloadUrl: string;
  }> = [];

  for (const step of steps) {
    if (
      step.tool === "create_rich_report" &&
      step.status === "success" &&
      step.output
    ) {
      const pathMatch = step.output.match(/Path:\s*([^\n]+\.html)/i);
      if (pathMatch) {
        const filePath = pathMatch[1].trim();
        const filename = filePath.split("/").pop() || filePath;
        const relativePath = filePath
          .replace(/^\/tmp\/jarvis-workspace\//, "")
          .replace(/^jarvis-workspace\//, "")
          .replace(/^\/tmp\//, "")
          .replace(/^\//, "");
        const downloadUrl = `/api/files/workspace/${relativePath}`;
        reports.push({ path: filePath, filename, downloadUrl });
      }
    }

    if (
      step.tool === "write_file" &&
      step.status === "success" &&
      step.output
    ) {
      const pathMatch = step.output.match(
        /(?:wrote|created|saved).*?([^\s]+\.html)/i
      );
      if (pathMatch) {
        const filePath = pathMatch[1].trim();
        const filename = filePath.split("/").pop() || filePath;
        const relativePath = filePath
          .replace(/^\/tmp\/jarvis-workspace\//, "")
          .replace(/^jarvis-workspace\//, "")
          .replace(/^\/tmp\//, "")
          .replace(/^\//, "");
        const downloadUrl = `/api/files/workspace/${relativePath}`;
        reports.push({ path: filePath, filename, downloadUrl });
      }
    }
  }

  return reports;
}

function HtmlReportPreview({ steps }: { steps?: AgentStep[] }) {
  const reports = extractHtmlReports(steps);

  if (reports.length === 0) return null;

  return (
    <div className="space-y-4">
      {reports.map((report, idx) => (
        <div
          key={idx}
          className="rounded-lg border border-border/50 overflow-hidden"
        >
          <div className="p-3 bg-gradient-to-r from-purple-500/10 to-cyan-500/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-cyan-400" />
              <span className="font-medium text-sm">{report.filename}</span>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(report.downloadUrl, "_blank")}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Open
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = report.downloadUrl;
                  a.download = report.filename;
                  a.click();
                }}
              >
                <Download className="h-3 w-3 mr-1" />
                Download
              </Button>
            </div>
          </div>
          <div className="bg-white">
            <iframe
              src={report.downloadUrl}
              className="w-full h-[500px]"
              title={report.filename}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function AgentMessageView({
  message,
  isLive,
}: {
  message: AgentMessage;
  isLive?: boolean;
}) {
  const isUser = message.role === "user";
  const [isSpeakingThis, setIsSpeakingThis] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(
    null
  );
  const ttsMutation = trpc.voice.textToSpeech.useMutation();

  const handleSpeak = useCallback(async () => {
    if (!message.content) return;

    if (isSpeakingThis && audioElement) {
      audioElement.pause();
      setAudioElement(null);
      setIsSpeakingThis(false);
      return;
    }

    try {
      setIsSpeakingThis(true);
      const result = await ttsMutation.mutateAsync({
        text: message.content.slice(0, 4000),
      });
      const audio = new Audio(`data:${result.mimeType};base64,${result.audio}`);
      setAudioElement(audio);
      audio.onended = () => {
        setIsSpeakingThis(false);
        setAudioElement(null);
      };
      await audio.play();
    } catch {
      toast.error("Failed to generate speech");
      setIsSpeakingThis(false);
    }
  }, [message.content, isSpeakingThis, audioElement, ttsMutation]);

  return (
    <div
      className={cn(
        "flex gap-3 animate-in fade-in",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isUser
            ? "bg-cyan-500/20 text-cyan-400"
            : "bg-purple-500/20 text-purple-400"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div
        className={cn(
          "flex-1 space-y-3 max-w-[85%]",
          isUser ? "text-right" : "text-left"
        )}
      >
        {isUser ? (
          <div className="inline-block p-3 rounded-lg bg-cyan-500/10 text-foreground">
            {message.content}
          </div>
        ) : (
          <>
            {message.steps && message.steps.length > 0 && (
              <AgentStepsPanel steps={message.steps} isLive={isLive} />
            )}
            <GeneratedImagesDisplay
              images={extractGeneratedImages(message.steps)}
            />
            <WeatherDisplay steps={message.steps} />
            <HtmlReportPreview steps={message.steps} />
            {message.content && (
              <div className="relative p-4 rounded-lg bg-muted/30 text-foreground prose prose-sm prose-invert max-w-none">
                <div className="absolute top-2 right-2 z-10">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={handleSpeak}
                    title={isSpeakingThis ? "Stop speaking" : "Read aloud"}
                  >
                    {isSpeakingThis ? (
                      <VolumeX className="h-4 w-4 text-purple-400" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <div className="pr-8">
                  <Streamdown>{message.content}</Streamdown>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Usage stats component
function UsageStats() {
  const { data: stats, isLoading } = trpc.jarvis.getUsageStats.useQuery({
    days: 7,
  });
  const { data: rateLimit } = trpc.jarvis.checkRateLimit.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  const todayStats = stats?.[0];
  const totalTasks = stats?.reduce((sum, s) => sum + s.agentTaskCount, 0) || 0;

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Today's Usage</span>
        <Badge variant="outline" className="text-xs">
          {rateLimit?.current || 0} / {rateLimit?.limit || 100} tasks
        </Badge>
      </div>
      <Progress
        value={((rateLimit?.current || 0) / (rateLimit?.limit || 100)) * 100}
        className="h-2"
      />
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2 rounded bg-muted/30">
          <div className="text-muted-foreground">Agent Tasks</div>
          <div className="text-lg font-bold">
            {todayStats?.agentTaskCount || 0}
          </div>
        </div>
        <div className="p-2 rounded bg-muted/30">
          <div className="text-muted-foreground">API Calls</div>
          <div className="text-lg font-bold">
            {todayStats?.totalApiCalls || 0}
          </div>
        </div>
      </div>
      <Separator />
      <div className="text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>7-day total tasks:</span>
          <span className="font-medium">{totalTasks}</span>
        </div>
      </div>
    </div>
  );
}

function TaskHistory() {
  const { data: tasks, isLoading } = trpc.jarvis.listTasks.useQuery({
    limit: 100,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  const completedTasks = tasks?.filter(
    t => t.status === "completed" || t.status === "failed"
  );

  const totalTokens =
    completedTasks?.reduce((sum, t) => sum + (t.totalTokens || 0), 0) || 0;
  const totalCost =
    completedTasks?.reduce(
      (sum, t) => sum + parseFloat(String(t.totalCost || 0)),
      0
    ) || 0;

  const formatDuration = (ms: number | null | undefined) => {
    if (!ms) return "—";
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <ScrollArea className="h-[calc(100vh-220px)]">
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="p-2 rounded bg-muted/30">
            <div className="text-muted-foreground">Total Tasks</div>
            <div className="text-lg font-bold">
              {completedTasks?.length || 0}
            </div>
          </div>
          <div className="p-2 rounded bg-muted/30">
            <div className="text-muted-foreground">Total Tokens</div>
            <div className="text-lg font-bold">
              {totalTokens > 1000000
                ? `${(totalTokens / 1000000).toFixed(1)}M`
                : totalTokens > 1000
                  ? `${(totalTokens / 1000).toFixed(1)}K`
                  : totalTokens}
            </div>
          </div>
          <div className="p-2 rounded bg-muted/30">
            <div className="text-muted-foreground">Total Cost</div>
            <div className="text-lg font-bold">${totalCost.toFixed(2)}</div>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          {completedTasks?.map(task => (
            <div
              key={task.id}
              className="p-3 rounded-lg bg-muted/30 border border-border/50"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm truncate">{task.title}</h4>
                  {task.summary && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {task.summary}
                    </p>
                  )}
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "shrink-0 text-[10px]",
                    task.status === "completed" &&
                      "text-green-400 border-green-400/30",
                    task.status === "failed" && "text-red-400 border-red-400/30"
                  )}
                >
                  {task.status}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDuration(task.durationMs)}
                </span>
                <span className="flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  {task.iterationCount} iterations
                </span>
                {task.totalTokens > 0 && (
                  <span className="flex items-center gap-1">
                    <Activity className="h-3 w-3" />
                    {task.totalTokens > 1000
                      ? `${(task.totalTokens / 1000).toFixed(1)}K`
                      : task.totalTokens}{" "}
                    tokens
                  </span>
                )}
                {parseFloat(String(task.totalCost || 0)) > 0 && (
                  <span className="flex items-center gap-1">
                    <Calculator className="h-3 w-3" />$
                    {parseFloat(String(task.totalCost)).toFixed(4)}
                  </span>
                )}
                <span>
                  {new Date(task.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              {task.errorMessage && (
                <div className="mt-2 p-2 rounded bg-red-500/10 border border-red-500/20">
                  <p className="text-xs text-red-400 line-clamp-2">
                    {task.errorMessage}
                  </p>
                </div>
              )}
            </div>
          ))}

          {(!completedTasks || completedTasks.length === 0) && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No completed tasks yet
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}

function WorkspaceTab({
  onSelectWorkspace,
}: {
  onSelectWorkspace: (id: number) => void;
}) {
  const { data: workspaces, isLoading } = trpc.workspace.list.useQuery();
  const { data: templates } = trpc.workspace.getTemplates.useQuery();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTemplate, setNewTemplate] = useState("blank");
  const utils = trpc.useUtils();

  const createWorkspace = trpc.workspace.create.useMutation({
    onSuccess: () => {
      utils.workspace.list.invalidate();
      setShowCreateDialog(false);
      setNewName("");
      toast.success("Workspace created!");
    },
    onError: err => {
      toast.error(`Failed to create workspace: ${err.message}`);
    },
  });

  const deleteWorkspace = trpc.workspace.delete.useMutation({
    onSuccess: () => {
      utils.workspace.list.invalidate();
      toast.success("Workspace deleted");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Workspaces</span>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="h-3 w-3 mr-1" />
              New
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Workspace</DialogTitle>
              <DialogDescription>
                Create a persistent development environment for RASPUTIN.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="My Project"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Template</label>
                <select
                  value={newTemplate}
                  onChange={e => setNewTemplate(e.target.value)}
                  className="w-full mt-1 p-2 rounded border bg-background"
                >
                  {templates?.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() =>
                  createWorkspace.mutate({
                    name: newName,
                    template: newTemplate,
                  })
                }
                disabled={!newName.trim() || createWorkspace.isPending}
              >
                {createWorkspace.isPending ? "Creating..." : "Create"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {workspaces && workspaces.length > 0 ? (
        <div className="space-y-2">
          {workspaces.map(ws => (
            <div
              key={ws.id}
              className="p-3 rounded-lg border bg-card hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => onSelectWorkspace(ws.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-cyan-500" />
                  <span className="font-medium text-sm">{ws.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={e => {
                      e.stopPropagation();
                      onSelectWorkspace(ws.id);
                    }}
                  >
                    <Play className="h-3 w-3 mr-1" />
                    Open
                  </Button>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs",
                      ws.status === "running" &&
                        "text-green-500 border-green-500",
                      ws.status === "ready" && "text-blue-500 border-blue-500"
                    )}
                  >
                    {ws.status}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={e => {
                      e.stopPropagation();
                      if (confirm("Delete this workspace?")) {
                        deleteWorkspace.mutate({ id: ws.id });
                      }
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {ws.template} • {ws.diskUsageMb || 0} MB
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-sm text-muted-foreground">
            No workspaces yet. Create one to give RASPUTIN a persistent
            environment.
          </p>
        </div>
      )}
    </div>
  );
}

// Schedule Tab Component
function ScheduleTab() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [taskName, setTaskName] = useState("");
  const [taskPrompt, setTaskPrompt] = useState("");
  const [scheduleType, setScheduleType] = useState<
    "once" | "daily" | "weekly" | "monthly"
  >("daily");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [scheduleDay, setScheduleDay] = useState(1); // 0-6 for day of week

  const utils = trpc.useUtils();
  const schedulesQuery = trpc.schedule.list.useQuery();
  const createSchedule = trpc.schedule.create.useMutation({
    onSuccess: () => {
      toast.success("Schedule created successfully!");
      setShowCreateDialog(false);
      setTaskName("");
      setTaskPrompt("");
      utils.schedule.list.invalidate();
    },
    onError: err => {
      toast.error(`Failed to create schedule: ${err.message}`);
    },
  });
  const deleteSchedule = trpc.schedule.delete.useMutation({
    onSuccess: () => {
      toast.success("Schedule deleted");
      utils.schedule.list.invalidate();
    },
  });
  const toggleSchedule = trpc.schedule.toggle.useMutation({
    onSuccess: () => {
      utils.schedule.list.invalidate();
    },
  });

  const handleCreateSchedule = () => {
    if (!taskPrompt.trim()) {
      toast.error("Please enter a task description");
      return;
    }
    createSchedule.mutate({
      name: taskName || taskPrompt.slice(0, 50),
      prompt: taskPrompt,
      scheduleType,
      timeOfDay: scheduleTime,
      dayOfWeek: scheduleType === "weekly" ? scheduleDay : undefined,
      enabled: true,
    });
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Scheduled Tasks</span>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="h-3 w-3 mr-1" />
              New Schedule
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Scheduled Task</DialogTitle>
              <DialogDescription>
                Set up a recurring task for RASPUTIN to execute automatically.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium">Task Description</label>
                <Input
                  value={taskPrompt}
                  onChange={e => setTaskPrompt(e.target.value)}
                  placeholder="e.g., Check crypto prices and send summary"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Frequency</label>
                <select
                  value={scheduleType}
                  onChange={e =>
                    setScheduleType(e.target.value as typeof scheduleType)
                  }
                  className="w-full mt-1 p-2 rounded border bg-background"
                >
                  <option value="once">Once</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              {scheduleType === "weekly" && (
                <div>
                  <label className="text-sm font-medium">Day of Week</label>
                  <select
                    value={scheduleDay}
                    onChange={e => setScheduleDay(Number(e.target.value))}
                    className="w-full mt-1 p-2 rounded border bg-background"
                  >
                    <option value={0}>Sunday</option>
                    <option value={1}>Monday</option>
                    <option value={2}>Tuesday</option>
                    <option value={3}>Wednesday</option>
                    <option value={4}>Thursday</option>
                    <option value={5}>Friday</option>
                    <option value={6}>Saturday</option>
                  </select>
                </div>
              )}
              <div>
                <label className="text-sm font-medium">Time</label>
                <Input
                  type="time"
                  value={scheduleTime}
                  onChange={e => setScheduleTime(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateSchedule}>Create Schedule</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {schedulesQuery.data && schedulesQuery.data.length > 0 ? (
        <div className="space-y-2">
          {schedulesQuery.data.map(schedule => (
            <div
              key={schedule.id}
              className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {schedule.name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {schedule.prompt}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {schedule.scheduleType} at {schedule.timeOfDay || "N/A"}
                    {schedule.enabled ? (
                      <span className="ml-2 text-green-500">● Active</span>
                    ) : (
                      <span className="ml-2 text-gray-500">○ Paused</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleSchedule.mutate({ id: schedule.id })}
                  >
                    {schedule.enabled ? (
                      <Pause className="h-3 w-3" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => deleteSchedule.mutate({ id: schedule.id })}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <Calendar className="h-12 w-12 mx-auto text-purple-400 mb-4" />
          <p className="text-sm text-muted-foreground mb-4">
            No scheduled tasks yet. Create one to automate recurring work.
          </p>
        </div>
      )}

      <Separator />
      <div className="text-xs text-muted-foreground">
        <p className="font-medium mb-2">Example tasks:</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>"Check crypto prices daily at 9am"</li>
          <li>"Summarize news every Monday"</li>
          <li>"Run backup script weekly"</li>
        </ul>
      </div>
    </div>
  );
}

// Extract unique tools used from task
function extractToolsFromTask(task: AgentTask): string[] {
  const tools = new Set<string>();
  for (const msg of task.messages) {
    if (msg.steps) {
      for (const step of msg.steps) {
        if ((step.type === "tool" || step.type === "tool_call") && step.tool) {
          tools.add(step.tool);
        }
      }
    }
  }
  return Array.from(tools);
}

// Export task as markdown
function exportTaskAsMarkdown(task: AgentTask): string {
  let md = `# ${task.title}\n\n`;
  md += `**Created:** ${new Date(task.createdAt).toLocaleString()}\n`;
  md += `**Status:** ${task.status}\n`;
  if (task.iterationCount) md += `**Iterations:** ${task.iterationCount}\n`;
  if (task.durationMs)
    md += `**Duration:** ${(task.durationMs / 1000).toFixed(2)}s\n`;
  md += `\n---\n\n`;

  for (const msg of task.messages) {
    if (msg.role === "user") {
      md += `## User\n\n${msg.content}\n\n`;
    } else {
      md += `## RASPUTIN\n\n`;
      if (msg.steps) {
        for (const step of msg.steps) {
          if (step.type === "thinking") {
            md += `> *${step.content}*\n\n`;
          } else if (step.type === "tool" || step.type === "tool_call") {
            md += `### Tool: ${step.tool}\n\n`;
            if (step.input)
              md += `**Input:**\n\`\`\`\n${step.input}\n\`\`\`\n\n`;
            if (step.output)
              md += `**Output:**\n\`\`\`\n${step.output}\n\`\`\`\n\n`;
          }
        }
      }
      if (msg.content) {
        md += `${msg.content}\n\n`;
      }
    }
    md += `---\n\n`;
  }

  return md;
}

// Main Agent Page
export default function AgentPage() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTask, setCurrentTask] = useState<AgentTask | null>(null);
  const [localTasks, setLocalTasks] = useState<AgentTask[]>([]);
  const [activeTab, setActiveTab] = useState<
    | "tasks"
    | "templates"
    | "stats"
    | "history"
    | "workspace"
    | "schedule"
    | "voice"
    | "hosts"
  >("tasks");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<number | null>(
    null
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [voiceMode, _setVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [_isSpeaking, setIsSpeaking] = useState(false);
  const [voiceMuted, _setVoiceMuted] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);

  const jarvisStream = useJarvisStream();
  const [useStreamingMode, setUseStreamingMode] = useState(true);
  const [researchMode, setResearchMode] = useState(false);

  const [showFileUpload, setShowFileUpload] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<
    (ProcessedFile & { uiId?: string })[]
  >([]);
  const [fileContext, setFileContext] = useState<string>("");

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const getFileStyle = (category: ProcessedFile["category"]) => {
    switch (category) {
      case "image":
        return {
          color: "text-pink-400",
          bg: "from-pink-500/10 to-rose-500/10",
          border: "border-pink-500/20",
          icon: ImageIcon,
        };
      case "video":
        return {
          color: "text-violet-400",
          bg: "from-violet-500/10 to-purple-500/10",
          border: "border-violet-500/20",
          icon: Video,
        };
      case "audio":
        return {
          color: "text-cyan-400",
          bg: "from-cyan-500/10 to-blue-500/10",
          border: "border-cyan-500/20",
          icon: Music,
        };
      case "pdf":
        return {
          color: "text-red-400",
          bg: "from-red-500/10 to-orange-500/10",
          border: "border-red-500/20",
          icon: FileText,
        };
      case "spreadsheet":
        return {
          color: "text-green-400",
          bg: "from-green-500/10 to-emerald-500/10",
          border: "border-green-500/20",
          icon: FileSpreadsheet,
        };
      case "presentation":
        return {
          color: "text-orange-400",
          bg: "from-orange-500/10 to-red-500/10",
          border: "border-orange-500/20",
          icon: Presentation,
        };
      case "code":
        return {
          color: "text-yellow-400",
          bg: "from-yellow-500/10 to-amber-500/10",
          border: "border-yellow-500/20",
          icon: FileCode,
        };
      case "archive":
        return {
          color: "text-slate-400",
          bg: "from-slate-500/10 to-gray-500/10",
          border: "border-slate-500/20",
          icon: Archive,
        };
      default:
        return {
          color: "text-blue-400",
          bg: "from-blue-500/10 to-indigo-500/10",
          border: "border-blue-500/20",
          icon: FileIcon,
        };
    }
  };

  const handleFilesUploaded = useCallback(
    (files: ProcessedFile[], context?: string) => {
      setAttachedFiles(prev => [
        ...prev,
        ...files.map(f => ({
          ...f,
          uiId: Math.random().toString(36).slice(2),
        })),
      ]);
      if (context) {
        setFileContext(prev => (prev ? prev + "\n\n" + context : context));
      }
      setShowFileUpload(false);
      toast.success(`${files.length} file(s) attached`);
    },
    []
  );

  const removeAttachedFile = useCallback((index: number) => {
    setAttachedFiles(prev => {
      const newFiles = [...prev];
      newFiles.splice(index, 1);
      if (newFiles.length === 0) {
        setFileContext("");
      }
      return newFiles;
    });
  }, []);

  // Fetch persisted tasks from database
  const { data: dbTasks, refetch: refetchTasks } =
    trpc.jarvis.listTasks.useQuery({ limit: 50 }, { enabled: !!user });

  // JARVIS orchestrator mutations
  const jarvisExecute = trpc.jarvis.executeTask.useMutation();
  const deleteTaskMutation = trpc.jarvis.deleteTask.useMutation();
  const resumeTaskMutation = trpc.jarvis.resumeTask.useMutation();

  // Fetch task messages when a DB task is selected
  const { data: selectedTaskMessages } = trpc.jarvis.getTaskMessages.useQuery(
    {
      taskId: typeof currentTask?.id === "number" ? currentTask.id : undefined,
    },
    {
      enabled: typeof currentTask?.id === "number",
      staleTime: 0,
      refetchOnMount: true,
    }
  );

  // Update currentTask with messages when they load
  useEffect(() => {
    if (selectedTaskMessages && typeof currentTask?.id === "number") {
      setCurrentTask(prev =>
        prev?.id === currentTask.id
          ? {
              ...prev,
              messages: selectedTaskMessages,
            }
          : prev
      );
    }
  }, [selectedTaskMessages, currentTask?.id]);

  const tasks = [
    ...localTasks,
    ...(dbTasks?.map(t => ({
      id: t.id,
      title: t.title,
      query: t.query,
      status: t.status as AgentTask["status"],
      messages: [] as AgentMessage[],
      createdAt: new Date(t.createdAt).getTime(),
      iterationCount: t.iterationCount,
      errorMessage: t.errorMessage || undefined,
      pendingApprovalId: t.pendingApprovalId,
      errorType: undefined as AgentTask["errorType"],
      summary: t.summary,
    })) || []),
  ].sort((a, b) => b.createdAt - a.createdAt);

  useEffect(() => {
    if (dbTasks && dbTasks.length > 0) {
      const recentCompletedTasks = dbTasks
        .filter(t => t.status === "completed" && t.summary)
        .slice(0, 5)
        .map(t => ({ query: t.query, summary: t.summary }));

      if (recentCompletedTasks.length > 0) {
        jarvisStream.loadConversationHistory(recentCompletedTasks);
      }
    }
  }, [dbTasks, jarvisStream.loadConversationHistory]);

  // Attempt to rejoin active task on mount
  useEffect(() => {
    if (user?.id && !jarvisStream.isStreaming) {
      jarvisStream.rejoinTask(user.id);
    }
  }, [user?.id, jarvisStream.rejoinTask]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentTask?.messages]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      window.location.href = getLoginUrl();
    }
  }, [user, authLoading]);

  // Create new task
  const handleNewTask = useCallback(() => {
    setCurrentTask(null);
    setInput("");
    jarvisStream.reset();
    inputRef.current?.focus();
  }, [jarvisStream]);

  // Delete task
  const handleDeleteTask = useCallback(
    async (taskId: string | number) => {
      if (typeof taskId === "number") {
        try {
          await deleteTaskMutation.mutateAsync({ taskId });
          refetchTasks();
          if (currentTask?.id === taskId) {
            setCurrentTask(null);
          }
          toast.success("Task deleted");
        } catch (_error) {
          toast.error("Failed to delete task");
        }
      } else {
        setLocalTasks(prev => prev.filter(t => t.id !== taskId));
        if (currentTask?.id === taskId) {
          setCurrentTask(null);
        }
      }
    },
    [currentTask, deleteTaskMutation, refetchTasks]
  );

  const _handleExportTask = useCallback((task: AgentTask) => {
    const markdown = exportTaskAsMarkdown(task);
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${task.title.replace(/[^a-z0-9]/gi, "-")}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Task exported");
  }, []);

  const handleResumeTask = useCallback(
    async (taskId: number) => {
      try {
        await resumeTaskMutation.mutateAsync({ taskId });
        refetchTasks();
        toast.success("Task resumed. Re-execute the task to continue.");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to resume task"
        );
      }
    },
    [resumeTaskMutation, refetchTasks]
  );

  // Use template
  const handleUseTemplate = useCallback((prompt: string) => {
    setInput(prompt);
    setActiveTab("tasks");
    inputRef.current?.focus();
  }, []);

  const handleSubmitStreaming = useCallback(() => {
    if (!input.trim() || jarvisStream.isStreaming || !user?.id) return;

    let taskInput = input.trim();

    if (fileContext) {
      taskInput = `[ATTACHED FILES]\n${fileContext}\n\n[USER TASK]\n${taskInput}`;
    }

    if (researchMode) {
      taskInput = `[RESEARCH MODE - Use query_synthesis for comprehensive multi-model analysis with web search, or query_consensus if comparing perspectives. Provide thorough, well-researched response.]\n\n${taskInput}`;
    }

    setInput("");
    setAttachedFiles([]);
    setFileContext("");
    setCurrentTask(null);
    jarvisStream.reset(); // Clear previous task history before starting new task
    jarvisStream.startTask(taskInput, user.id);
  }, [input, jarvisStream, user?.id, researchMode, fileContext]);

  const handleSubmitLegacy = useCallback(async () => {
    if (!input.trim() || isProcessing) return;

    let taskInput = input.trim();

    if (fileContext) {
      taskInput = `[ATTACHED FILES]\n${fileContext}\n\n[USER TASK]\n${taskInput}`;
    }

    if (researchMode) {
      taskInput = `[RESEARCH MODE - Use query_synthesis for comprehensive multi-model analysis with web search, or query_consensus if comparing perspectives. Provide thorough, well-researched response.]\n\n${taskInput}`;
    }

    const userMessage: AgentMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
      timestamp: Date.now(),
    };

    let task = currentTask;
    if (!task) {
      task = {
        id: crypto.randomUUID(),
        title: input.trim().slice(0, 50) + (input.length > 50 ? "..." : ""),
        query: taskInput,
        status: "running",
        messages: [userMessage],
        createdAt: Date.now(),
      };
      setLocalTasks(prev => [task!, ...prev]);
    } else {
      task = {
        ...task,
        status: "running",
        messages: [...task.messages, userMessage],
      };
      setLocalTasks(prev => prev.map(t => (t.id === task!.id ? task! : t)));
    }

    setCurrentTask(task);
    setInput("");
    setAttachedFiles([]);
    setFileContext("");
    setIsProcessing(true);

    const assistantMessage: AgentMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      steps: [],
      timestamp: Date.now(),
    };

    setCurrentTask(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        messages: [...prev.messages, assistantMessage],
      };
    });

    try {
      const conversationHistory = task.messages
        .filter(m => m.role === "user" || m.role === "assistant")
        .slice(0, -1)
        .map(m => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

      const result = await jarvisExecute.mutateAsync({
        task: taskInput,
        conversationHistory,
      });

      const steps: AgentStep[] = [];
      let finalContent = "";

      for (const step of result.steps) {
        if (step.type === "thinking" && step.content) {
          steps.push({
            id: crypto.randomUUID(),
            type: "thinking",
            content: step.content,
            timestamp: Date.now(),
          });
        } else if (step.type === "tool_use" && step.toolCall) {
          const isTaskComplete = step.toolCall.name === "task_complete";
          steps.push({
            id: crypto.randomUUID(),
            type: "tool",
            tool: step.toolCall.name,
            input: JSON.stringify(step.toolCall.input, null, 2),
            status: isTaskComplete ? "success" : "running",
            output: isTaskComplete ? "Task marked as complete" : undefined,
            timestamp: Date.now(),
          });
        } else if (step.type === "tool_result" && step.toolResult) {
          const lastToolStep = steps.findLast(s => s.type === "tool");
          if (lastToolStep) {
            lastToolStep.output = step.toolResult.output;
            lastToolStep.status = step.toolResult.isError ? "error" : "success";
          }
        } else if (step.type === "response" && step.content) {
          finalContent = step.content;
        } else if (step.type === "complete" && step.summary) {
          finalContent = step.summary;
          const taskCompleteStep = steps.findLast(
            s => s.tool === "task_complete"
          );
          if (taskCompleteStep) {
            taskCompleteStep.status = "success";
            taskCompleteStep.output = step.summary;
          }
        } else if (step.type === "error" && step.content) {
          finalContent = `Error: ${step.content}`;
        }
      }

      const finalAssistantMessage: AgentMessage = {
        id: assistantMessage.id,
        role: "assistant",
        content: finalContent || "Task completed.",
        steps,
        timestamp: Date.now(),
      };

      setCurrentTask(prev => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          status: "completed" as const,
          messages: prev.messages.map(m =>
            m.id === assistantMessage.id ? finalAssistantMessage : m
          ),
        };
        setLocalTasks(tasks =>
          tasks.map(t => (t.id === updated.id ? updated : t))
        );
        return updated;
      });

      refetchTasks();
    } catch (_error) {
      const errorMsg =
        _error instanceof Error ? _error.message : String(_error);

      let errorType: AgentTask["errorType"] = "unknown";
      if (
        errorMsg.toLowerCase().includes("timeout") ||
        errorMsg.toLowerCase().includes("timed out")
      ) {
        errorType = "timeout";
      } else if (
        errorMsg.toLowerCase().includes("rate limit") ||
        errorMsg.toLowerCase().includes("429")
      ) {
        errorType = "rate_limit";
      } else if (
        errorMsg.toLowerCase().includes("api") ||
        errorMsg.toLowerCase().includes("401") ||
        errorMsg.toLowerCase().includes("403")
      ) {
        errorType = "api_error";
      } else if (
        errorMsg.toLowerCase().includes("execution") ||
        errorMsg.toLowerCase().includes("runtime")
      ) {
        errorType = "execution_error";
      }

      const errorAssistantMessage: AgentMessage = {
        id: assistantMessage.id,
        role: "assistant",
        content: `Error: ${errorMsg}`,
        steps: [],
        timestamp: Date.now(),
      };

      setCurrentTask(prev => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          status: "failed" as const,
          errorMessage: errorMsg,
          errorType: errorType,
          messages: prev.messages.map(m =>
            m.id === assistantMessage.id ? errorAssistantMessage : m
          ),
        };
        setLocalTasks(tasks =>
          tasks.map(t => (t.id === updated.id ? updated : t))
        );
        return updated;
      });

      toast.error("Task failed: " + errorMsg);
    }

    setIsProcessing(false);
  }, [
    input,
    isProcessing,
    currentTask,
    jarvisExecute,
    refetchTasks,
    researchMode,
  ]);

  const handleSubmit = useCallback(() => {
    if (useStreamingMode) {
      handleSubmitStreaming();
    } else {
      handleSubmitLegacy();
    }
  }, [useStreamingMode, handleSubmitStreaming, handleSubmitLegacy]);

  useEffect(() => {
    if (!jarvisStream.isStreaming && jarvisStream.taskId) {
      refetchTasks();
    }
  }, [jarvisStream.isStreaming, jarvisStream.taskId, refetchTasks]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        handleNewTask();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNewTask]);

  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="h-screen flex bg-background text-foreground">
      {/* Sidebar */}
      <div className="w-80 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <Button
            onClick={handleNewTask}
            className="w-full bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Button>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={v => setActiveTab(v as typeof activeTab)}
          className="flex-1 flex flex-col"
        >
          <TabsList className="flex flex-wrap gap-1 mx-3 mt-2 h-auto bg-transparent p-0">
            <TabsTrigger
              value="tasks"
              className="text-xs px-2.5 py-1.5 h-auto data-[state=active]:bg-muted"
            >
              Tasks
            </TabsTrigger>
            <TabsTrigger
              value="templates"
              className="text-xs px-2.5 py-1.5 h-auto data-[state=active]:bg-muted"
            >
              Templates
            </TabsTrigger>
            <TabsTrigger
              value="stats"
              className="text-xs px-2.5 py-1.5 h-auto data-[state=active]:bg-muted"
            >
              Stats
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="text-xs px-2 py-1.5 h-auto data-[state=active]:bg-muted"
              title="Task History"
            >
              <History className="h-3.5 w-3.5" />
            </TabsTrigger>
            <TabsTrigger
              value="workspace"
              className="text-xs px-2 py-1.5 h-auto data-[state=active]:bg-muted"
              title="Workspaces"
            >
              <FolderOpen className="h-3.5 w-3.5" />
            </TabsTrigger>
            <TabsTrigger
              value="schedule"
              className="text-xs px-2 py-1.5 h-auto data-[state=active]:bg-muted"
              title="Schedule"
            >
              <Calendar className="h-3.5 w-3.5" />
            </TabsTrigger>
            <TabsTrigger
              value="voice"
              className="text-xs px-2 py-1.5 h-auto data-[state=active]:bg-muted"
              title="Voice"
            >
              <Mic className="h-3.5 w-3.5" />
            </TabsTrigger>
            <TabsTrigger
              value="hosts"
              className="text-xs px-2 py-1.5 h-auto data-[state=active]:bg-muted"
              title="SSH Hosts"
            >
              <Server className="h-3.5 w-3.5" />
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="flex-1 m-0">
            <ScrollArea className="h-[calc(100vh-220px)]">
              <div className="p-2 space-y-1">
                {tasks.map(task => (
                  <div
                    key={task.id}
                    className={cn(
                      "group relative rounded-lg transition-colors",
                      currentTask?.id === task.id
                        ? "bg-purple-500/10"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <button
                      onClick={() => {
                        if (task.id !== currentTask?.id) {
                          jarvisStream.reset();
                        }
                        setCurrentTask(task);
                      }}
                      className="w-full text-left p-2.5"
                    >
                      <div className="flex items-start gap-2">
                        {task.query?.includes("[ATTACHED FILES]") && (
                          <Paperclip className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                        )}
                        <span
                          className={cn(
                            "text-sm font-medium flex-1 line-clamp-2 leading-snug break-words",
                            currentTask?.id === task.id && "text-purple-400"
                          )}
                          title={task.title}
                        >
                          {task.title}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "shrink-0 text-[10px] px-1.5",
                            task.status === "completed" &&
                              "text-green-400 border-green-400/30",
                            task.status === "running" &&
                              "text-cyan-400 border-cyan-400/30",
                            task.status === "failed" &&
                              "text-red-400 border-red-400/30",
                            task.status === "waiting_approval" &&
                              "text-amber-400 border-amber-400/30"
                          )}
                        >
                          {task.status === "waiting_approval"
                            ? "approval"
                            : task.status}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(task.createdAt).toLocaleDateString()}
                      </p>
                      {task.status === "failed" && task.errorMessage && (
                        <div className="mt-1 p-1.5 rounded bg-red-500/10 border border-red-500/20">
                          <p className="text-xs text-red-400 line-clamp-2">
                            {task.errorType && (
                              <span className="font-medium capitalize">
                                {task.errorType.replace("_", " ")}:
                              </span>
                            )}
                            {task.errorMessage}
                          </p>
                        </div>
                      )}
                      {task.status === "waiting_approval" && (
                        <div className="mt-1 p-1.5 rounded bg-amber-500/10 border border-amber-500/20">
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-amber-400 flex items-center gap-1">
                              <Shield className="h-3 w-3" />
                              SSH command needs approval
                            </p>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 px-2 text-xs text-amber-400 hover:text-amber-300"
                              onClick={e => {
                                e.stopPropagation();
                                if (typeof task.id === "number") {
                                  handleResumeTask(task.id);
                                }
                              }}
                            >
                              <Play className="h-3 w-3 mr-1" />
                              Resume
                            </Button>
                          </div>
                        </div>
                      )}
                    </button>
                    <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      {(task.messages.length > 0 ||
                        task.status === "completed" ||
                        task.status === "failed") && (
                        <div onClick={e => e.stopPropagation()}>
                          <ExportMenu
                            content={{
                              title: task.title,
                              content: exportTaskAsMarkdown(task as AgentTask),
                              metadata: {
                                date: new Date(task.createdAt).toLocaleString(),
                                mode: "RASPUTIN Agent",
                                duration:
                                  "durationMs" in task && task.durationMs
                                    ? `${(task.durationMs / 1000).toFixed(1)}s`
                                    : undefined,
                                toolsUsed: extractToolsFromTask(
                                  task as AgentTask
                                ),
                              },
                            }}
                            size="sm"
                          />
                        </div>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                        onClick={e => {
                          e.stopPropagation();
                          handleDeleteTask(task.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
                {tasks.length === 0 && (
                  <div className="text-center py-8">
                    <Bot className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground text-sm">
                      No tasks yet
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Start a new task!
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="templates" className="flex-1 m-0">
            <ScrollArea className="h-[calc(100vh-220px)]">
              <div className="p-2 space-y-4">
                {TASK_TEMPLATES.map(category => (
                  <div key={category.category}>
                    <div className="flex items-center gap-2 px-2 py-1 text-sm font-medium text-muted-foreground">
                      {category.icon}
                      {category.category}
                    </div>
                    <div className="space-y-1 mt-1">
                      {category.templates.map(template => (
                        <button
                          key={template.title}
                          onClick={() => handleUseTemplate(template.prompt)}
                          className="w-full text-left p-2 rounded hover:bg-muted/50 transition-colors"
                        >
                          <div className="text-sm font-medium">
                            {template.title}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {template.prompt}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="stats" className="flex-1 m-0">
            <UsageStats />
          </TabsContent>

          <TabsContent value="history" className="flex-1 m-0">
            <TaskHistory />
          </TabsContent>

          <TabsContent value="workspace" className="flex-1 m-0">
            <WorkspaceTab
              onSelectWorkspace={id => {
                setSelectedWorkspaceId(id);
                setCurrentTask(null);
              }}
            />
          </TabsContent>

          <TabsContent value="schedule" className="flex-1 m-0">
            <ScheduleTab />
          </TabsContent>

          <TabsContent value="voice" className="flex-1 m-0">
            <div className="p-4 space-y-4">
              <div className="text-center">
                <h3 className="font-semibold mb-2">Voice Mode</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Press the microphone to talk to RASPUTIN
                </p>
              </div>

              <VoiceConversation
                onTranscription={text => {
                  setInput(text);
                  setIsListening(false);
                  toast.success("Transcribed: " + text.slice(0, 50) + "...");
                  setTimeout(() => {
                    handleSubmit();
                  }, 500);
                }}
                onSpeakingStart={() => setIsSpeaking(true)}
                onSpeakingEnd={() => setIsSpeaking(false)}
                autoSpeak={autoSpeak}
              />

              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Voice Output</span>
                  <Badge variant="outline">
                    {voiceMuted ? "Muted" : "Active"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Auto-Speak Results
                  </span>
                  <Button
                    variant={autoSpeak ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setAutoSpeak(!autoSpeak);
                      toast.success(
                        autoSpeak
                          ? "Auto-speak disabled"
                          : "RASPUTIN will speak results automatically"
                      );
                    }}
                    className={cn(
                      "h-6 px-2 text-xs",
                      autoSpeak && "bg-purple-500 hover:bg-purple-600"
                    )}
                  >
                    {autoSpeak ? "On" : "Off"}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="hosts" className="flex-1 m-0">
            <HostsManager />
          </TabsContent>
        </Tabs>

        {/* Back to Research Mode */}
        <div className="p-4 border-t border-border">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate("/chat")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Research Mode
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-14 border-b border-border flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Bot className="h-6 w-6 text-purple-400" />
              <span
                className="text-xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent tracking-wider"
                style={{ fontFamily: "ui-monospace, monospace" }}
              >
                RASPUTIN
              </span>
            </div>
            <div
              className="flex items-center gap-1 px-2 py-1 rounded-full border border-border/50 bg-muted/30 cursor-pointer select-none"
              onClick={() => setResearchMode(!researchMode)}
            >
              <span
                className={cn(
                  "text-xs font-medium px-2 py-0.5 rounded-full transition-all",
                  !researchMode
                    ? "bg-purple-500/20 text-purple-400"
                    : "text-muted-foreground"
                )}
              >
                Agent
              </span>
              <span
                className={cn(
                  "text-xs font-medium px-2 py-0.5 rounded-full transition-all",
                  researchMode
                    ? "bg-cyan-500/20 text-cyan-400"
                    : "text-muted-foreground"
                )}
              >
                Research
              </span>
            </div>
            {isProcessing && (
              <Badge
                variant="outline"
                className="text-cyan-400 border-cyan-400/50 animate-pulse"
              >
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Working
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* System Pages Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-cyan-400 border-cyan-400/50 hover:bg-cyan-400/10 gap-1"
                >
                  <Activity className="h-4 w-4" />
                  System
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>System Pages</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/infrastructure")}>
                  <Server className="h-4 w-4 mr-2" />
                  Infrastructure
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/multi-agent")}>
                  <Users className="h-4 w-4 mr-2" />
                  Multi-Agent
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/codebase")}>
                  <GitBranch className="h-4 w-4 mr-2" />
                  Codebase
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/events")}>
                  <Webhook className="h-4 w-4 mr-2" />
                  Events
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/hosts")}>
                  <Server className="h-4 w-4 mr-2" />
                  SSH Hosts
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {/* Pending Approvals */}
            <Dialog>
              <DialogTrigger asChild>
                <div className="cursor-pointer">
                  <ApprovalBadge />
                </div>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Pending Approvals</DialogTitle>
                  <DialogDescription>
                    Review and approve commands that RASPUTIN wants to execute
                  </DialogDescription>
                </DialogHeader>
                <ApprovalWorkflow />
              </DialogContent>
            </Dialog>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetchTasks()}
              className="text-muted-foreground"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <UserProfileMenu />
          </div>
        </header>

        {/* Messages Area */}
        {selectedWorkspaceId && activeTab === "workspace" ? (
          <WorkspaceIDE
            workspaceId={selectedWorkspaceId}
            onBack={() => setSelectedWorkspaceId(null)}
          />
        ) : useStreamingMode &&
          (jarvisStream.isStreaming || jarvisStream.steps.length > 0) ? (
          <div className="flex-1 flex min-h-0 overflow-hidden">
            <ScrollArea className="flex-1 min-h-0 min-w-0">
              <div className="max-w-3xl mx-auto p-4">
                <JarvisStreamView state={jarvisStream} autoSpeak={autoSpeak} />
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
            <div className="w-80 xl:w-96 shrink-0 border-l border-border overflow-hidden">
              <JarvisThinkingPanel state={jarvisStream} />
            </div>
          </div>
        ) : (
          <ScrollArea className="flex-1 min-h-0 p-4">
            {currentTask ? (
              <div className="max-w-4xl mx-auto space-y-6">
                {currentTask.status === "idle" &&
                  currentTask.messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                      <div className="text-center space-y-2">
                        <h3 className="text-lg font-semibold text-purple-400">
                          {currentTask.title}
                        </h3>
                        <p className="text-sm text-muted-foreground max-w-md">
                          {currentTask.query}
                        </p>
                      </div>
                      <Button
                        onClick={() => {
                          if (currentTask.query && user?.id) {
                            jarvisStream.startTask(currentTask.query, user.id);
                          }
                        }}
                        className="bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-700 hover:to-cyan-600"
                        disabled={jarvisStream.isStreaming}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Start Task
                      </Button>
                    </div>
                  )}
                {currentTask.messages.map((message, idx) => (
                  <AgentMessageView
                    key={message.id}
                    message={message}
                    isLive={
                      isProcessing && idx === currentTask.messages.length - 1
                    }
                  />
                ))}
                {isProcessing &&
                  currentTask.messages.length > 0 &&
                  currentTask.messages[currentTask.messages.length - 1].role ===
                    "user" && (
                    <div className="flex items-center gap-2 text-muted-foreground animate-pulse">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">
                        RASPUTIN is analyzing your request...
                      </span>
                    </div>
                  )}
                <div ref={messagesEndRef} />
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="relative">
                  <Bot className="h-20 w-20 text-purple-400 mb-4" />
                  <Sparkles className="h-6 w-6 text-cyan-400 absolute -top-1 -right-1 animate-pulse" />
                </div>
                <h2 className="text-2xl font-bold mb-2">
                  Welcome to{" "}
                  <span
                    className="tracking-wider"
                    style={{ fontFamily: "ui-monospace, monospace" }}
                  >
                    RASPUTIN
                  </span>
                </h2>
                <p className="text-muted-foreground max-w-md mb-6">
                  Your autonomous AI agent. I can browse the web, execute code,
                  generate images, and complete complex tasks.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-3xl">
                  <Card
                    className="bg-muted/30 border-border/50 hover:border-cyan-500/50 transition-colors cursor-pointer"
                    onClick={() =>
                      handleUseTemplate(
                        "Search the web for the latest news about [topic]"
                      )
                    }
                  >
                    <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
                      <Globe className="h-6 w-6 text-cyan-400" />
                      <div>
                        <h3 className="font-medium text-sm">Web Search</h3>
                        <p className="text-xs text-muted-foreground">
                          Find information
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card
                    className="bg-muted/30 border-border/50 hover:border-green-500/50 transition-colors cursor-pointer"
                    onClick={() =>
                      handleUseTemplate(
                        "Write a Python script that [description]"
                      )
                    }
                  >
                    <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
                      <Code className="h-6 w-6 text-green-400" />
                      <div>
                        <h3 className="font-medium text-sm">Code</h3>
                        <p className="text-xs text-muted-foreground">
                          Write & run code
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card
                    className="bg-muted/30 border-border/50 hover:border-yellow-500/50 transition-colors cursor-pointer"
                    onClick={() =>
                      handleUseTemplate(
                        "Calculate [expression] and explain the result"
                      )
                    }
                  >
                    <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
                      <Calculator className="h-6 w-6 text-yellow-400" />
                      <div>
                        <h3 className="font-medium text-sm">Calculate</h3>
                        <p className="text-xs text-muted-foreground">
                          Math & analysis
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card
                    className="bg-muted/30 border-border/50 hover:border-pink-500/50 transition-colors cursor-pointer"
                    onClick={() =>
                      handleUseTemplate("Generate an image of [description]")
                    }
                  >
                    <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
                      <ImageIcon className="h-6 w-6 text-pink-400" />
                      <div>
                        <h3 className="font-medium text-sm">Images</h3>
                        <p className="text-xs text-muted-foreground">
                          AI generation
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card
                    className="bg-muted/30 border-border/50 hover:border-purple-500/50 transition-colors cursor-pointer"
                    onClick={() =>
                      handleUseTemplate(
                        "Get consensus from multiple AI models on [topic]"
                      )
                    }
                  >
                    <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
                      <Users className="h-6 w-6 text-purple-400" />
                      <div>
                        <h3 className="font-medium text-sm">Consensus</h3>
                        <p className="text-xs text-muted-foreground">
                          Multi-model query
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card
                    className="bg-muted/30 border-border/50 hover:border-orange-500/50 transition-colors cursor-pointer"
                    onClick={() =>
                      handleUseTemplate(
                        "Run deep synthesis research on [topic]"
                      )
                    }
                  >
                    <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
                      <Brain className="h-6 w-6 text-orange-400" />
                      <div>
                        <h3 className="font-medium text-sm">Synthesis</h3>
                        <p className="text-xs text-muted-foreground">
                          Deep analysis
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </ScrollArea>
        )}

        {/* Input Area */}
        <div className="p-4 border-t border-border">
          <div className="max-w-4xl mx-auto">
            {showFileUpload && (
              <div className="mb-4">
                <FileUpload
                  onUpload={(files, context) =>
                    handleFilesUploaded(files, context || "")
                  }
                  disabled={isProcessing}
                  maxFiles={5}
                />
              </div>
            )}

            <div className="flex flex-wrap gap-3 mb-3 empty:mb-0 transition-all">
              <AnimatePresence mode="popLayout">
                {attachedFiles.map((file, idx) => {
                  const style = getFileStyle(file.category);
                  const Icon = style.icon;
                  const isDataUrl =
                    typeof file.content === "string" &&
                    file.content.startsWith("data:image");
                  const thumbnailSrc = isDataUrl ? file.content : null;

                  return (
                    <motion.div
                      key={file.uiId || `${file.originalName}-${idx}`}
                      layout
                      initial={{ opacity: 0, scale: 0.8, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8, y: -10 }}
                      className={cn(
                        "relative group flex items-center gap-3 pr-8 pl-2 py-2",
                        "rounded-xl border backdrop-blur-md transition-all",
                        "hover:scale-[1.02] hover:shadow-lg",
                        `bg-gradient-to-br ${style.bg} ${style.border}`
                      )}
                    >
                      <div
                        className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 overflow-hidden",
                          thumbnailSrc ? "bg-black/40" : "bg-black/20",
                          style.color
                        )}
                      >
                        {thumbnailSrc && file.category === "image" ? (
                          <img
                            src={thumbnailSrc}
                            alt="preview"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Icon className="w-5 h-5" />
                        )}
                      </div>

                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium truncate max-w-[140px] text-foreground/90">
                          {file.originalName}
                        </span>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">
                          <span>{formatFileSize(file.size)}</span>
                          <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/50" />
                          <span>{file.category}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => removeAttachedFile(idx)}
                        className={cn(
                          "absolute -right-2 -top-2",
                          "w-6 h-6 rounded-full flex items-center justify-center",
                          "bg-background border border-border shadow-sm",
                          "text-muted-foreground hover:text-red-500 hover:border-red-500/50",
                          "transition-all opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100"
                        )}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowFileUpload(!showFileUpload)}
                disabled={isProcessing}
                className={cn(
                  "shrink-0",
                  showFileUpload ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Paperclip className="h-5 w-5" />
              </Button>
              <Input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder="Give RASPUTIN a task... (e.g., 'Research the latest AI news and summarize')"
                className="flex-1 bg-muted/30 border-border focus:border-purple-500/50"
                disabled={isProcessing || jarvisStream.isStreaming}
              />
              {jarvisStream.isStreaming ? (
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => {
                    jarvisStream.cancelTask();
                    toast.info("Task cancelled");
                  }}
                >
                  <StopCircle className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    if (voiceMode) {
                      setIsListening(!isListening);
                      if (!isListening) {
                        toast.info("Listening... speak now");
                      }
                    } else {
                      setActiveTab("voice");
                      toast.info("Enable voice mode first");
                    }
                  }}
                  className={cn(
                    "transition-all",
                    isListening && "bg-red-500/20 border-red-500 text-red-400"
                  )}
                  disabled={isProcessing}
                >
                  {isListening ? (
                    <Square className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </Button>
              )}
              <Button
                onClick={handleSubmit}
                disabled={
                  !input.trim() || isProcessing || jarvisStream.isStreaming
                }
                className="bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600"
              >
                {isProcessing || jarvisStream.isStreaming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-3">
                <p className="text-xs text-muted-foreground">
                  RASPUTIN will autonomously use tools to complete your task
                </p>
                <button
                  onClick={() => setUseStreamingMode(!useStreamingMode)}
                  className={cn(
                    "flex items-center gap-1.5 text-xs px-2 py-1 rounded-full transition-colors",
                    useStreamingMode
                      ? "bg-purple-500/20 text-purple-400"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Sparkles className="h-3 w-3" />
                  {useStreamingMode ? "Live Mode" : "Classic Mode"}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Press{" "}
                <kbd className="px-1 py-0.5 rounded bg-muted text-xs">
                  Ctrl+N
                </kbd>{" "}
                for new task
              </p>
            </div>
          </div>
        </div>
      </div>

      <SwarmActivityPanel />
    </div>
  );
}
