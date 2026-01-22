import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { useLocation } from "wouter";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Terminal,
  Mic,
  Send,
  ChevronDown,
  ChevronRight,
  Plus,
  Settings,
  ExternalLink,
  Loader2,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Sparkles,
  Brain,
  Cpu,
  Activity,
  Zap,
  FileText,
  FileDown,
  Upload,
  Copy,
  RefreshCw,
  Wifi,
  WifiOff,
  Search,
  Database,
  Code,
  Globe,
  FileCode,
  Play,
  Clock,
  ArrowRight,
  Circle,
  AlertTriangle,
  Info,
  Server,
  Boxes,
} from "lucide-react";
import { toast } from "sonner";

type LogEvent = {
  id: string;
  timestamp: Date;
  type:
    | "websocket"
    | "tool"
    | "thinking"
    | "api"
    | "error"
    | "memory"
    | "system"
    | "code"
    | "search";
  message: string;
  details?: string;
  status?: "running" | "success" | "error";
};

const eventConfig: Record<
  LogEvent["type"],
  { icon: typeof Wifi; color: string; bgColor: string; label: string }
> = {
  websocket: {
    icon: Wifi,
    color: "text-blue-400",
    bgColor: "bg-blue-500/20",
    label: "WS",
  },
  tool: {
    icon: Boxes,
    color: "text-green-400",
    bgColor: "bg-green-500/20",
    label: "TOOL",
  },
  thinking: {
    icon: Brain,
    color: "text-purple-400",
    bgColor: "bg-purple-500/20",
    label: "THINK",
  },
  api: {
    icon: Globe,
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/20",
    label: "API",
  },
  error: {
    icon: AlertTriangle,
    color: "text-red-400",
    bgColor: "bg-red-500/20",
    label: "ERR",
  },
  memory: {
    icon: Database,
    color: "text-orange-400",
    bgColor: "bg-orange-500/20",
    label: "MEM",
  },
  system: {
    icon: Server,
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/20",
    label: "SYS",
  },
  code: {
    icon: Code,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/20",
    label: "CODE",
  },
  search: {
    icon: Search,
    color: "text-pink-400",
    bgColor: "bg-pink-500/20",
    label: "SRCH",
  },
};
import { Button } from "@/components/ui/button";

function hasReportPath(text: string): boolean {
  return text.includes("/tmp/jarvis-workspace/") && text.includes(".html");
}

function extractReportInfo(text: string): string {
  const pathMatch = text.match(/\/tmp\/jarvis-workspace\/[^\s"']+\.html/);
  if (!pathMatch) return text;

  const path = pathMatch[0];
  const titleMatch = text.match(/report[^.]*\.html/i);
  const title = titleMatch
    ? titleMatch[0].replace(".html", "").replace(/_/g, " ")
    : "Report";

  return `**Path:** ${path}\n**Title:** ${title}\n**Theme:** dark`;
}

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400 mt-6 mb-4 pb-2 border-b border-white/10">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xl font-semibold text-cyan-400 mt-6 mb-3 flex items-center gap-2">
      <div className="h-1 w-1 rounded-full bg-cyan-400" />
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-lg font-medium text-white/90 mt-4 mb-2">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-white/80 leading-relaxed my-3">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-cyan-300">{children}</strong>
  ),
  em: ({ children }) => <em className="italic text-white/70">{children}</em>,
  code: ({ className, children }) => {
    const isBlock = className?.includes("language-");
    const codeContent = String(children || "");

    // Hide HTML code blocks - they're generated reports that shouldn't be shown as code
    if (
      isBlock &&
      (className?.includes("html") ||
        codeContent.includes("<!DOCTYPE") ||
        codeContent.includes("<html"))
    ) {
      return null;
    }

    if (isBlock) {
      return (
        <div className="my-4 rounded-lg overflow-hidden border border-white/10">
          <div className="bg-[#1a1a2e] px-4 py-2 text-xs text-cyan-400/60 border-b border-white/10">
            {className?.replace("language-", "") || "code"}
          </div>
          <pre className="bg-[#0d0d1a] p-4 overflow-x-auto">
            <code className="text-sm font-mono text-cyan-300">{children}</code>
          </pre>
        </div>
      );
    }
    return (
      <code className="bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded text-sm font-mono">
        {children}
      </code>
    );
  },
  pre: ({ children }) => <>{children}</>,
  ul: ({ children }) => <ul className="my-3 space-y-2 ml-1">{children}</ul>,
  ol: ({ children }) => (
    <ol className="my-3 space-y-2 ml-1 list-decimal list-inside">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-white/80 flex items-start gap-2">
      <span className="text-cyan-400 mt-1.5">•</span>
      <span className="flex-1">{children}</span>
    </li>
  ),
  table: ({ children }) => (
    <div className="my-4 rounded-lg overflow-hidden border border-white/10">
      <table className="w-full">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20">
      {children}
    </thead>
  ),
  tbody: ({ children }) => (
    <tbody className="divide-y divide-white/5">{children}</tbody>
  ),
  tr: ({ children }) => (
    <tr className="hover:bg-white/5 transition-colors">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="px-4 py-3 text-left text-xs font-semibold text-cyan-300 uppercase tracking-wider">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-3 text-sm text-white/70">{children}</td>
  ),
  hr: () => <hr className="my-6 border-white/10" />,
  blockquote: ({ children }) => (
    <blockquote className="my-4 pl-4 border-l-2 border-cyan-500 bg-cyan-500/5 py-2 pr-4 rounded-r-lg italic text-white/70">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition-colors"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
};

function RichContent({
  content,
  isStreaming = false,
}: {
  content: string;
  isStreaming?: boolean;
}) {
  if (isStreaming) {
    return (
      <div className="text-white/70 font-mono text-sm whitespace-pre-wrap animate-pulse">
        {content}
      </div>
    );
  }

  return (
    <div className="rich-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { ReportPreview } from "@/components/ToolOutputPreview";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useJarvisStream } from "@/hooks/useJarvisStream";
import { getSocket } from "@/lib/socket";
import { getLoginUrl } from "@/const";

export default function Prototype() {
  const [, navigate] = useLocation();
  const { user, refresh: refreshAuth } = useAuth();
  const jarvis = useJarvisStream();

  const [input, setInput] = useState("");
  const [authChecked, setAuthChecked] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isAgentMode, setIsAgentMode] = useState(true);
  const [activeTab, setActiveTab] = useState<"agent" | "research" | "docs">(
    "agent"
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: taskHistory } = trpc.jarvis.listTasks.useQuery({ limit: 30 });

  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const selectedTask = taskHistory?.find(t => t.id === selectedTaskId);

  useEffect(() => {
    refreshAuth().then(() => setAuthChecked(true));
  }, [refreshAuth]);

  useEffect(() => {
    if (authChecked && !user) {
      navigate(getLoginUrl());
    }
  }, [user, authChecked, navigate]);

  useEffect(() => {
    const socket = getSocket();
    setIsConnected(socket.connected);

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  useEffect(() => {
    if (
      taskHistory &&
      taskHistory.length > 0 &&
      jarvis.exchanges.length === 0
    ) {
      const recentCompletedTasks = taskHistory
        .filter(t => t.status === "completed" && t.summary)
        .slice(0, 5)
        .map(t => ({ query: t.query, summary: t.summary }));

      if (recentCompletedTasks.length > 0) {
        jarvis.loadConversationHistory(recentCompletedTasks);
      }
    }
  }, [taskHistory, jarvis.loadConversationHistory, jarvis.exchanges.length]);

  useEffect(() => {
    if (user?.id && !jarvis.isStreaming) {
      jarvis.rejoinTask(user.id);
    }
  }, [user?.id, jarvis.rejoinTask, jarvis.isStreaming]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [jarvis.steps, jarvis.summary]);

  const handleSubmit = useCallback(() => {
    if (!input.trim() || !user) {
      if (!user) toast.error("Please sign in to use JARVIS");
      return;
    }
    jarvis.startTask(input, user.id);
    setSelectedTaskId(null);
    setInput("");
  }, [input, user, jarvis]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleNewTask = () => {
    jarvis.reset();
    setSelectedTaskId(null);
    inputRef.current?.focus();
  };

  const groupedTasks = taskHistory?.reduce(
    (acc, task) => {
      const date = new Date(task.createdAt);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let group: string;
      if (date.toDateString() === today.toDateString()) {
        group = "TODAY";
      } else if (date.toDateString() === yesterday.toDateString()) {
        group = "YESTERDAY";
      } else {
        group = "EARLIER";
      }

      if (!acc[group]) acc[group] = [];
      acc[group].push(task);
      return acc;
    },
    {} as Record<string, typeof taskHistory>
  );

  return (
    <div className="fixed inset-0 bg-[#0a0a0a] text-white font-sans overflow-hidden">
      <div className="flex h-full">
        <div className="w-56 border-r border-white/10 flex flex-col bg-[#111]">
          <div className="p-3">
            <Button
              variant="outline"
              className="w-full justify-start gap-2 h-9 bg-transparent border-white/20 text-white/80 hover:bg-white/5 hover:text-white"
              onClick={handleNewTask}
            >
              <Plus className="h-4 w-4" />
              New Task
            </Button>
          </div>

          <ScrollArea className="flex-1 px-2">
            {groupedTasks &&
              Object.entries(groupedTasks).map(([group, tasks]) => (
                <div key={group} className="mb-4">
                  <div className="text-[10px] font-medium text-cyan-400/60 px-2 py-2">
                    {group}
                  </div>
                  <div className="space-y-1">
                    {tasks?.map(task => (
                      <button
                        key={task.id}
                        onClick={() => setSelectedTaskId(task.id)}
                        className={cn(
                          "w-full text-left px-2 py-2 rounded transition-colors",
                          selectedTaskId === task.id
                            ? "bg-cyan-500/10 text-cyan-300"
                            : "text-cyan-400/70 hover:bg-cyan-500/5 hover:text-cyan-300"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <MessageSquare className="h-3.5 w-3.5 shrink-0 text-cyan-400/50 mt-0.5" />
                          <span className="text-xs leading-relaxed break-words">
                            {task.title || task.query || "New Task"}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
          </ScrollArea>

          <div className="p-3 border-t border-white/10">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-xs font-semibold">
                {user?.username?.slice(0, 2).toUpperCase() || "JS"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-cyan-300 truncate">
                  {user?.username || "User"}
                </div>
                <div className="text-[10px] text-cyan-400/60">Pro Plan</div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-cyan-400/60 hover:text-cyan-300"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          <header className="h-12 border-b border-white/10 flex items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "h-2 w-2 rounded-full",
                  isConnected ? "bg-green-500" : "bg-yellow-500"
                )}
              />
              <span className="font-semibold text-white/90">JARVIS v3.1</span>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-cyan-400/70">AGENT</span>
                <Switch
                  checked={isAgentMode}
                  onCheckedChange={setIsAgentMode}
                  className="data-[state=checked]:bg-cyan-600"
                />
              </div>
              <div className="flex items-center gap-1 text-sm">
                {(["research", "docs"] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "px-3 py-1 rounded transition-colors uppercase text-xs",
                      activeTab === tab
                        ? "text-cyan-300 bg-cyan-500/10"
                        : "text-cyan-400/60 hover:text-cyan-400"
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs text-white/60 hover:text-white"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                DETACH
              </Button>
            </div>
          </header>

          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 flex flex-col">
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-6">
                <div className="max-w-4xl mx-auto space-y-4">
                  {!jarvis.isStreaming && !jarvis.summary && !selectedTask && (
                    <div className="flex justify-center py-8">
                      <div className="inline-flex items-center gap-3 px-5 py-3 rounded-2xl bg-[#151b23] border border-white/10">
                        <div className="h-8 w-8 rounded-full bg-[#0d1117] flex items-center justify-center">
                          <Terminal className="h-4 w-4 text-cyan-400" />
                        </div>
                        <span className="text-sm text-white/80">
                          Awaiting command...
                        </span>
                      </div>
                    </div>
                  )}

                  {selectedTask && !jarvis.isStreaming && (
                    <>
                      <div className="flex justify-center">
                        <div className="inline-flex items-center gap-3 px-5 py-3 rounded-2xl bg-[#151b23] border border-white/10 max-w-2xl">
                          <div className="h-8 w-8 rounded-full bg-[#0d1117] flex items-center justify-center shrink-0">
                            <Terminal className="h-4 w-4 text-cyan-400" />
                          </div>
                          <span className="text-sm text-white/80">
                            {selectedTask.query}
                          </span>
                        </div>
                      </div>
                      {selectedTask.summary && (
                        <div className="border-l-2 border-cyan-500 bg-[#0d1117] rounded-r-lg overflow-hidden">
                          <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10">
                            <Sparkles className="h-3 w-3 text-cyan-400" />
                            <span className="text-xs text-white/50 uppercase tracking-wide">
                              Operation Log
                            </span>
                            <ChevronDown className="h-3 w-3 text-white/30 ml-auto" />
                          </div>
                          <div className="p-4">
                            {hasReportPath(selectedTask.summary) ? (
                              <ReportPreview
                                output={extractReportInfo(selectedTask.summary)}
                                toolName="create_rich_report"
                              />
                            ) : (
                              <RichContent content={selectedTask.summary} />
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {(jarvis.isStreaming || jarvis.summary) && (
                    <>
                      {jarvis.exchanges.length > 0 && (
                        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                          {jarvis.exchanges.map((exchange, idx) => (
                            <div key={idx} className="space-y-3">
                              <div className="flex justify-end">
                                <div className="inline-flex items-center gap-3 px-5 py-3 rounded-2xl bg-cyan-600/20 border border-cyan-500/30 max-w-2xl">
                                  <span className="text-sm text-white/90">
                                    {exchange.userQuery}
                                  </span>
                                </div>
                              </div>
                              {exchange.assistantSummary && (
                                <div className="flex justify-start">
                                  <div className="inline-flex items-start gap-3 px-5 py-3 rounded-2xl bg-[#151b23] border border-white/10 max-w-3xl">
                                    <div className="h-6 w-6 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center shrink-0 mt-0.5">
                                      <Sparkles className="h-3 w-3 text-white" />
                                    </div>
                                    <div className="text-sm text-white/80 prose prose-invert prose-sm max-w-none">
                                      {exchange.assistantSummary}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {jarvis.isStreaming ? (
                        <>
                          <div className="border-l-2 border-cyan-500/50 bg-[#0d1117]/50 rounded-r-lg overflow-hidden">
                            <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10">
                              <Loader2 className="h-3 w-3 text-cyan-400 animate-spin" />
                              <span className="text-xs text-white/50 uppercase tracking-wide">
                                Processing
                              </span>
                              <span className="text-xs text-cyan-400/70 ml-auto font-mono">
                                {jarvis.currentIteration}/
                                {jarvis.maxIterations || 10}
                              </span>
                            </div>
                            <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                              {jarvis.steps.slice(-10).map((step, idx) => (
                                <div
                                  key={step.id || idx}
                                  className="flex items-start gap-2 text-sm animate-in fade-in slide-in-from-bottom-2 duration-300"
                                >
                                  {step.type === "thinking" ? (
                                    <>
                                      <Brain className="h-3 w-3 text-purple-400 mt-0.5 shrink-0" />
                                      <span className="text-white/60 leading-relaxed">
                                        {step.content?.slice(0, 200)}
                                        {(step.content?.length || 0) > 200 &&
                                          "..."}
                                      </span>
                                    </>
                                  ) : step.type === "tool" && step.tool ? (
                                    <div className="flex flex-col gap-1 w-full">
                                      <div className="flex items-center gap-2">
                                        {step.tool.status === "running" ? (
                                          <Loader2 className="h-3 w-3 text-yellow-400 animate-spin shrink-0" />
                                        ) : step.tool.isError ? (
                                          <XCircle className="h-3 w-3 text-red-500 shrink-0" />
                                        ) : (
                                          <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                                        )}
                                        <span
                                          className={
                                            step.tool.status === "running"
                                              ? "text-yellow-400 font-medium"
                                              : step.tool.isError
                                                ? "text-red-400"
                                                : "text-green-400"
                                          }
                                        >
                                          {step.tool.name}
                                        </span>
                                        {step.tool.durationMs && (
                                          <span className="text-white/30 text-xs ml-auto">
                                            {(
                                              step.tool.durationMs / 1000
                                            ).toFixed(1)}
                                            s
                                          </span>
                                        )}
                                      </div>
                                      {step.tool.output && (
                                        <div className="ml-5 text-xs text-white/40 truncate max-w-full">
                                          {step.tool.output.slice(0, 100)}
                                          {step.tool.output.length > 100 &&
                                            "..."}
                                        </div>
                                      )}
                                    </div>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      ) : jarvis.summary ? (
                        <div className="bg-gradient-to-br from-[#0d1117] to-[#0a0f14] rounded-xl border border-white/10 overflow-hidden shadow-xl">
                          <div className="px-6 py-4 border-b border-white/10 bg-gradient-to-r from-cyan-500/10 to-transparent">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                                  <Sparkles className="h-4 w-4 text-white" />
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-white">
                                    Response
                                  </div>
                                  <div className="text-xs text-white/40">
                                    Task completed successfully
                                  </div>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-white/40 hover:text-white gap-1.5"
                                onClick={() => {
                                  jarvis.startTask(
                                    "Create an interactive HTML report with charts, visualizations, and professional styling based on the previous response. Use generate_interactive_report tool.",
                                    user?.id || 0
                                  );
                                }}
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                                <span className="text-xs">Generate Report</span>
                              </Button>
                            </div>
                          </div>
                          <div className="p-6">
                            {hasReportPath(jarvis.summary) ? (
                              <ReportPreview
                                output={extractReportInfo(jarvis.summary)}
                                toolName="create_rich_report"
                              />
                            ) : (
                              <RichContent content={jarvis.summary} />
                            )}
                          </div>
                          <div className="px-6 py-4 border-t border-white/10 bg-gradient-to-r from-transparent to-cyan-500/5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5 border-white/10 text-white/70 hover:text-white hover:bg-white/5"
                                  onClick={async () => {
                                    try {
                                      const response = await fetch("/api/pdf", {
                                        method: "POST",
                                        headers: {
                                          "Content-Type": "application/json",
                                        },
                                        body: JSON.stringify({
                                          html: jarvis.summary,
                                        }),
                                      });
                                      const blob = await response.blob();
                                      const url = URL.createObjectURL(blob);
                                      const a = document.createElement("a");
                                      a.href = url;
                                      a.download = "jarvis-response.pdf";
                                      a.click();
                                      toast.success("PDF downloaded!");
                                    } catch {
                                      toast.error("Failed to export PDF");
                                    }
                                  }}
                                >
                                  <FileDown className="h-3.5 w-3.5" />
                                  PDF
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5 border-white/10 text-white/70 hover:text-white hover:bg-white/5"
                                  onClick={() => {
                                    const blob = new Blob(
                                      [jarvis.summary || ""],
                                      { type: "text/markdown" }
                                    );
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement("a");
                                    a.href = url;
                                    a.download = "jarvis-response.md";
                                    a.click();
                                    toast.success("Markdown downloaded!");
                                  }}
                                >
                                  <FileText className="h-3.5 w-3.5" />
                                  DOC
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5 border-white/10 text-white/70 hover:text-white hover:bg-white/5"
                                  onClick={() => {
                                    navigator.clipboard.writeText(
                                      jarvis.summary || ""
                                    );
                                    toast.success("Copied to clipboard!");
                                  }}
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                  Copy
                                </Button>
                              </div>
                              <Button
                                variant="default"
                                size="sm"
                                className="gap-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500"
                                onClick={() => {
                                  toast.info("Deploy to Vercel coming soon!");
                                }}
                              >
                                <Upload className="h-3.5 w-3.5" />
                                Deploy to Vercel
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </div>

              <div className="border-t border-white/10 p-4">
                <div className="max-w-4xl mx-auto flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-white/40 hover:text-white shrink-0"
                  >
                    <Mic className="h-4 w-4" />
                  </Button>
                  <div className="flex-1 relative">
                    <input
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="What's up"
                      className="w-full h-10 bg-[#1a1a1a] border border-white/10 rounded-lg px-4 pr-16 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <kbd className="text-[10px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded">
                        ⌘ K
                      </kbd>
                    </div>
                  </div>
                  <Button
                    onClick={handleSubmit}
                    disabled={!input.trim() || jarvis.isStreaming}
                    className="h-9 w-9 p-0 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="w-80 border-l border-white/10 bg-[#0a0a0f] flex flex-col overflow-hidden">
              <div className="p-3 border-b border-white/10 bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "h-2 w-2 rounded-full",
                        isConnected
                          ? "bg-green-400 animate-pulse"
                          : "bg-red-400"
                      )}
                    />
                    <span className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 uppercase tracking-wider">
                      Live Telemetry
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isConnected ? (
                      <Wifi className="h-3 w-3 text-green-400" />
                    ) : (
                      <WifiOff className="h-3 w-3 text-red-400" />
                    )}
                  </div>
                </div>
              </div>

              <div className="p-2 border-b border-white/5 bg-black/20">
                <div className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-cyan-400/60" />
                      <span className="text-cyan-400/80 font-mono">
                        {jarvis.currentIteration}/{jarvis.maxIterations}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase",
                        jarvis.isStreaming
                          ? "bg-cyan-500/20 text-cyan-400 animate-pulse"
                          : jarvis.success
                            ? "bg-green-500/20 text-green-400"
                            : "bg-white/5 text-white/40"
                      )}
                    >
                      {jarvis.isStreaming
                        ? "● LIVE"
                        : jarvis.success
                          ? "✓ DONE"
                          : "○ IDLE"}
                    </div>
                  </div>
                </div>
              </div>

              {jarvis.isStreaming && (
                <div className="p-2 border-b border-white/5 bg-gradient-to-r from-purple-500/5 to-cyan-500/5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-black/30 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 rounded-full animate-pulse"
                        style={{
                          width: `${Math.min((jarvis.currentIteration / jarvis.maxIterations) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {jarvis.steps.length === 0 && !jarvis.isStreaming ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center mb-3">
                        <Activity className="h-6 w-6 text-cyan-400/50" />
                      </div>
                      <div className="text-xs text-cyan-400/50">
                        Awaiting activity...
                      </div>
                      <div className="text-[10px] text-white/30 mt-1">
                        Events will appear here in real-time
                      </div>
                    </div>
                  ) : (
                    <>
                      {jarvis.steps.map((step, idx) => {
                        const isLatest = idx === jarvis.steps.length - 1;

                        if (step.type === "thinking" && step.content) {
                          const config = eventConfig.thinking;
                          const Icon = config.icon;
                          return (
                            <div
                              key={step.id || idx}
                              className={cn(
                                "group rounded-lg p-2 transition-all duration-300",
                                isLatest && jarvis.isStreaming
                                  ? "bg-purple-500/10 border border-purple-500/30"
                                  : "hover:bg-white/5"
                              )}
                            >
                              <div className="flex items-start gap-2">
                                <div
                                  className={cn("p-1 rounded", config.bgColor)}
                                >
                                  <Icon
                                    className={cn("h-3 w-3", config.color)}
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={cn(
                                        "text-[10px] font-bold",
                                        config.color
                                      )}
                                    >
                                      {config.label}
                                    </span>
                                    <span className="text-[9px] text-white/30">
                                      {new Date().toLocaleTimeString()}
                                    </span>
                                    {isLatest && jarvis.isStreaming && (
                                      <span className="flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-purple-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-white/60 mt-0.5 font-mono leading-relaxed line-clamp-3">
                                    {step.content.slice(0, 150)}
                                    {step.content.length > 150 ? "..." : ""}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        if (step.type === "tool" && step.tool) {
                          const isRunning = step.tool.status === "running";
                          const isFailed = step.tool.status === "failed";
                          const toolName = step.tool.name || "unknown";

                          let eventType: LogEvent["type"] = "tool";
                          if (
                            toolName.includes("search") ||
                            toolName.includes("web")
                          )
                            eventType = "search";
                          if (
                            toolName.includes("python") ||
                            toolName.includes("code")
                          )
                            eventType = "code";
                          if (toolName.includes("memory")) eventType = "memory";
                          if (
                            toolName.includes("api") ||
                            toolName.includes("fetch")
                          )
                            eventType = "api";

                          const config = eventConfig[eventType];
                          const Icon = config.icon;

                          return (
                            <div
                              key={step.id || idx}
                              className={cn(
                                "group rounded-lg p-2 transition-all duration-300",
                                isRunning
                                  ? "bg-yellow-500/10 border border-yellow-500/30 animate-pulse"
                                  : isFailed
                                    ? "bg-red-500/10 border border-red-500/30"
                                    : isLatest
                                      ? "bg-green-500/10 border border-green-500/30"
                                      : "hover:bg-white/5"
                              )}
                            >
                              <div className="flex items-start gap-2">
                                <div
                                  className={cn(
                                    "p-1 rounded",
                                    isRunning
                                      ? "bg-yellow-500/20"
                                      : isFailed
                                        ? "bg-red-500/20"
                                        : config.bgColor
                                  )}
                                >
                                  {isRunning ? (
                                    <Loader2 className="h-3 w-3 text-yellow-400 animate-spin" />
                                  ) : isFailed ? (
                                    <XCircle className="h-3 w-3 text-red-400" />
                                  ) : (
                                    <Icon
                                      className={cn("h-3 w-3", config.color)}
                                    />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={cn(
                                        "text-[10px] font-bold",
                                        isRunning
                                          ? "text-yellow-400"
                                          : isFailed
                                            ? "text-red-400"
                                            : config.color
                                      )}
                                    >
                                      {config.label}
                                    </span>
                                    {step.tool.durationMs && (
                                      <span className="text-[9px] text-white/40 font-mono">
                                        {(step.tool.durationMs / 1000).toFixed(
                                          1
                                        )}
                                        s
                                      </span>
                                    )}
                                    {isRunning && (
                                      <span className="text-[9px] text-yellow-400 animate-pulse">
                                        Running...
                                      </span>
                                    )}
                                  </div>
                                  <div
                                    className={cn(
                                      "text-[10px] mt-0.5 font-mono truncate",
                                      isRunning
                                        ? "text-yellow-400/80"
                                        : isFailed
                                          ? "text-red-400/80"
                                          : "text-white/60"
                                    )}
                                  >
                                    {toolName}
                                  </div>
                                  {step.tool.output && !isRunning && (
                                    <div className="text-[9px] text-white/40 mt-1 line-clamp-2 font-mono">
                                      {step.tool.output.slice(0, 80)}
                                      {step.tool.output.length > 80
                                        ? "..."
                                        : ""}
                                    </div>
                                  )}
                                </div>
                                {!isRunning && !isFailed && (
                                  <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                                )}
                              </div>
                            </div>
                          );
                        }

                        return null;
                      })}
                    </>
                  )}
                </div>
              </ScrollArea>

              <div className="p-2 border-t border-white/10 bg-black/30">
                <div className="grid grid-cols-3 gap-1 text-[9px]">
                  <div className="flex items-center gap-1 px-2 py-1.5 rounded bg-cyan-500/10">
                    <Brain className="h-3 w-3 text-purple-400" />
                    <span className="text-purple-400 font-mono">
                      {jarvis.steps.filter(s => s.type === "thinking").length}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1.5 rounded bg-green-500/10">
                    <Boxes className="h-3 w-3 text-green-400" />
                    <span className="text-green-400 font-mono">
                      {jarvis.steps.filter(s => s.type === "tool").length}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1.5 rounded bg-red-500/10">
                    <AlertTriangle className="h-3 w-3 text-red-400" />
                    <span className="text-red-400 font-mono">
                      {
                        jarvis.steps.filter(
                          s => s.type === "tool" && s.tool?.status === "failed"
                        ).length
                      }
                    </span>
                  </div>
                </div>
              </div>

              {jarvis.error && (
                <div className="p-2 border-t border-red-500/30 bg-red-500/10">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-bold text-red-400">
                        ERROR
                      </div>
                      <div className="text-[9px] text-red-300/80 font-mono mt-0.5 line-clamp-3">
                        {jarvis.error.slice(0, 100)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
