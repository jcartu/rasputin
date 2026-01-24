import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useLocation } from "wouter";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Mic,
  Send,
  Settings,
  Loader2,
  CheckCircle2,
  XCircle,
  Sparkles,
  Brain,
  Cpu,
  Activity,
  FileText,
  FileDown,
  Copy,
  Wifi,
  Search,
  Database,
  Code,
  Globe,
  Clock,
  AlertTriangle,
  Server,
  Boxes,
  Home,
  HelpCircle,
  Hexagon,
  Play,
  ChevronUp,
  Monitor,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  FileType,
  Upload,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ReportPreview } from "@/components/ToolOutputPreview";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useJarvisStream } from "@/hooks/useJarvisStream";
import { getSocket } from "@/lib/socket";
import { getLoginUrl } from "@/const";
import { saveAs } from "file-saver";
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
} from "docx";

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

function cleanTaskTitle(text: string): string {
  const prefixes = [
    /^Get consensus from multiple AI models on \[topic\]\s*/i,
    /^Run deep synthesis research on \[topic\]\s*/i,
    /^Run a consensus query then\s*/i,
    /^Query multiple models about\s*/i,
    /^Research and synthesize\s*/i,
  ];
  let clean = text;
  for (const prefix of prefixes) {
    clean = clean.replace(prefix, "");
  }
  return clean.trim();
}

interface TaskExportBarProps {
  title: string;
  content: string;
  taskId: number;
}

function TaskExportBar({ title, content, taskId }: TaskExportBarProps) {
  const [exporting, setExporting] = useState<string | null>(null);
  const [hostedUrl, setHostedUrl] = useState<string | null>(null);
  const hostMarkdown = trpc.jarvis.hostMarkdown.useMutation();

  const sanitizeFilename = (name: string) => {
    return name.replace(/[^a-z0-9]/gi, "-").substring(0, 50);
  };

  const exportPDF = async () => {
    setExporting("pdf");
    try {
      const htmlContent = `<!DOCTYPE html><html><head><style>body{font-family:system-ui;max-width:800px;margin:2rem auto;padding:1rem;}</style></head><body><h1>${title}</h1><div>${content.replace(/\n/g, "<br>")}</div></body></html>`;
      const response = await fetch("/api/files/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: htmlContent,
          filename: `${sanitizeFilename(title)}.pdf`,
        }),
      });
      if (response.ok) {
        const blob = await response.blob();
        saveAs(blob, `${sanitizeFilename(title)}.pdf`);
        toast.success("PDF exported");
      } else {
        throw new Error("PDF export failed");
      }
    } catch {
      toast.error("PDF export failed, using print fallback");
      window.print();
    } finally {
      setExporting(null);
    }
  };

  const exportDocx = async () => {
    setExporting("docx");
    try {
      const lines = content.split("\n");
      const children = [
        new Paragraph({ text: title, heading: HeadingLevel.TITLE, spacing: { after: 400 } }),
        ...lines.map(line => new Paragraph({ text: line, spacing: { after: 200 } })),
      ];
      const doc = new Document({ sections: [{ children }], creator: "JARVIS", title });
      const buffer = await Packer.toBlob(doc);
      saveAs(buffer, `${sanitizeFilename(title)}.docx`);
      toast.success("DOCX exported");
    } finally {
      setExporting(null);
    }
  };

  const publishToVercel = async () => {
    setExporting("vercel");
    try {
      const htmlContent = `<!DOCTYPE html>
<html><head><title>${title}</title>
<style>body{font-family:system-ui;max-width:800px;margin:2rem auto;padding:1rem;background:#111;color:#eee}h1{color:#00d9c0}pre{background:#222;padding:1rem;border-radius:4px;overflow:auto}</style>
</head><body><h1>${title}</h1><div>${content.replace(/\n/g, "<br>")}</div></body></html>`;
      
      const tempFilePath = `/tmp/jarvis-export-${taskId}-${Date.now()}.html`;
      await fetch("/api/files/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: tempFilePath, content: htmlContent }),
      });

      const response = await fetch("/api/jarvis/publish-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath: tempFilePath, title }),
      });
      
      if (response.ok) {
        const { url } = await response.json();
        toast.success(`Published to ${url}`);
        window.open(url, "_blank");
      } else {
        const err = await response.json();
        toast.error(err.message || "Publish failed");
      }
    } catch (e) {
      toast.error(`Publish failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setExporting(null);
    }
  };

  const hostLocally = async () => {
    setExporting("host");
    try {
      const result = await hostMarkdown.mutateAsync({ taskId, content, title });
      setHostedUrl(result.url);
      toast.success("Hosted successfully");
      window.open(result.url, "_blank");
    } catch (e) {
      toast.error(`Hosting failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="flex items-center gap-2 p-4 border-t border-white/10 bg-[#0a0a12]">
      <span className="text-xs text-white/40 uppercase tracking-wider mr-2">Export:</span>
      <Button
        size="sm"
        variant="outline"
        className="h-8 px-3 border-white/10 text-white/70 hover:text-white hover:bg-white/5 gap-1.5"
        onClick={exportPDF}
        disabled={exporting !== null}
      >
        {exporting === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5 text-red-400" />}
        PDF
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-8 px-3 border-white/10 text-white/70 hover:text-white hover:bg-white/5 gap-1.5"
        onClick={exportDocx}
        disabled={exporting !== null}
      >
        {exporting === "docx" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileType className="h-3.5 w-3.5 text-blue-400" />}
        DOCX
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-8 px-3 border-white/10 text-white/70 hover:text-white hover:bg-white/5 gap-1.5"
        onClick={publishToVercel}
        disabled={exporting !== null}
      >
        {exporting === "vercel" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 text-purple-400" />}
        Vercel
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-8 px-3 border-white/10 text-white/70 hover:text-white hover:bg-white/5 gap-1.5"
        onClick={hostLocally}
        disabled={exporting !== null}
      >
        {exporting === "host" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5 text-cyan-400" />}
        Host
      </Button>
      {hostedUrl && (
        <a
          href={hostedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-cyan-400 hover:underline ml-2"
        >
          {hostedUrl}
        </a>
      )}
    </div>
  );
}

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

// Agent badge component
function AgentBadge({ label, active = true }: { label: string; active?: boolean }) {
  return (
    <div className={cn(
      "flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider",
      active ? "bg-cyan-500/20 text-cyan-400" : "bg-white/5 text-white/30"
    )}>
      <div className={cn(
        "h-1.5 w-1.5 rounded-full",
        active ? "bg-green-400" : "bg-white/20"
      )} />
      {label}
    </div>
  );
}

// Progress bar component
function VitalBar({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-white/50">{label}</span>
        <span className="text-cyan-400 font-mono">{value}{unit}</span>
      </div>
      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all duration-500"
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  );
}

export default function Prototype() {
  const [, navigate] = useLocation();
  const { user, refresh: refreshAuth } = useAuth();
  const jarvis = useJarvisStream();

  const [input, setInput] = useState("");
  const [authChecked, setAuthChecked] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [taskType, setTaskType] = useState("research");
  const [uptime, setUptime] = useState("00:00:00");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  const { data: taskHistory } = trpc.jarvis.listTasks.useQuery({ limit: 30 });
  const { data: systemStats } = trpc.localStats.get.useQuery(undefined, {
    refetchInterval: 3000,
  });
  const { data: selectedTask } = trpc.jarvis.getTask.useQuery(
    { taskId: selectedTaskId! },
    { enabled: selectedTaskId !== null }
  );

  const groupedTasks = useMemo(() => {
    if (!taskHistory) return { today: [], yesterday: [], earlier: [] };
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    
    const groups: { today: typeof taskHistory; yesterday: typeof taskHistory; earlier: typeof taskHistory } = {
      today: [],
      yesterday: [],
      earlier: [],
    };
    
    for (const task of taskHistory) {
      const taskDate = new Date(task.createdAt);
      const taskDay = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
      
      if (taskDay.getTime() === today.getTime()) {
        groups.today.push(task);
      } else if (taskDay.getTime() === yesterday.getTime()) {
        groups.yesterday.push(task);
      } else {
        groups.earlier.push(task);
      }
    }
    
    return groups;
  }, [taskHistory]);

  // Uptime counter
  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const hours = Math.floor(elapsed / 3600000).toString().padStart(2, '0');
      const mins = Math.floor((elapsed % 3600000) / 60000).toString().padStart(2, '0');
      const secs = Math.floor((elapsed % 60000) / 1000).toString().padStart(2, '0');
      setUptime(`${hours}:${mins}:${secs}`);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

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

  useEffect(() => {
    if (jarvis.steps.length === 0) return;
    
    const newLogs: LogEvent[] = [];
    const lastStep = jarvis.steps[jarvis.steps.length - 1];
    const stepId = lastStep.id || `step-${jarvis.steps.length}`;
    const existingLog = logs.find(l => l.id.includes(stepId));
    if (existingLog) return;

    if (lastStep.type === "thinking") {
      newLogs.push({
        id: `thinking-${stepId}-${Date.now()}`,
        timestamp: new Date(),
        type: "thinking",
        message: lastStep.content?.slice(0, 60) + (lastStep.content && lastStep.content.length > 60 ? "..." : "") || "Processing...",
        status: "running",
      });
    } else if (lastStep.type === "tool" && lastStep.tool) {
      const toolType = lastStep.tool.name?.toLowerCase().includes("search") 
        ? "search" 
        : lastStep.tool.name?.toLowerCase().includes("code") || lastStep.tool.name?.toLowerCase().includes("write")
          ? "code"
          : lastStep.tool.name?.toLowerCase().includes("memory") || lastStep.tool.name?.toLowerCase().includes("store")
            ? "memory"
            : "tool";
      
      newLogs.push({
        id: `tool-${stepId}-${Date.now()}`,
        timestamp: new Date(),
        type: toolType,
        message: lastStep.tool.name || "Unknown tool",
        details: lastStep.tool.output?.slice(0, 50),
        status: lastStep.tool.status === "running" ? "running" : lastStep.tool.isError ? "error" : "success",
      });
    }

    if (newLogs.length > 0) {
      setLogs(prev => [...prev.slice(-49), ...newLogs]);
    }
  }, [jarvis.steps, logs]);

  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    if (jarvis.isStreaming && logs.length === 0) {
      setLogs([{
        id: `system-start-${Date.now()}`,
        timestamp: new Date(),
        type: "system",
        message: "Task execution initiated",
        status: "running",
      }]);
    }
  }, [jarvis.isStreaming, logs.length]);

  const handleSubmit = useCallback(() => {
    if (!input.trim() || !user) {
      if (!user) toast.error("Please sign in to use JARVIS");
      return;
    }
    setSelectedTaskId(null);
    setLogs([]);
    jarvis.startTask(input, user.id);
    setInput("");
  }, [input, user, jarvis]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSelectTask = useCallback((taskId: number) => {
    setSelectedTaskId(taskId);
    jarvis.reset(null);
  }, [jarvis]);

  const handleNewChat = useCallback(() => {
    setSelectedTaskId(null);
    jarvis.reset();
    inputRef.current?.focus();
  }, [jarvis]);

  return (
    <div className="fixed inset-0 bg-[#0a0a0f] text-white font-sans overflow-hidden flex">
      {/* Left Dock */}
      <div className="w-14 bg-[#0d1117] border-r border-white/10 flex flex-col items-center py-4">
        <div className="mb-6">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <Hexagon className="h-6 w-6 text-white" />
          </div>
        </div>
        
        <nav className="flex flex-col gap-2">
          <button className="h-10 w-10 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center hover:bg-cyan-500/20 transition-colors">
            <Home className="h-5 w-5" />
          </button>
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={cn(
              "h-10 w-10 rounded-lg flex items-center justify-center transition-colors",
              sidebarOpen 
                ? "bg-cyan-500/10 text-cyan-400" 
                : "text-white/40 hover:bg-white/5 hover:text-white/60"
            )}
          >
            <MessageSquare className="h-5 w-5" />
          </button>
          <button className="h-10 w-10 rounded-lg text-white/40 flex items-center justify-center hover:bg-white/5 hover:text-white/60 transition-colors">
            <Settings className="h-5 w-5" />
          </button>
          <button className="h-10 w-10 rounded-lg text-white/40 flex items-center justify-center hover:bg-white/5 hover:text-white/60 transition-colors">
            <HelpCircle className="h-5 w-5" />
          </button>
        </nav>
        
        <div className="mt-auto">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold cursor-pointer hover:ring-2 hover:ring-cyan-500/50 transition-all">
            {user?.username?.slice(0, 2).toUpperCase() || "JS"}
          </div>
        </div>
      </div>

      {sidebarOpen && (
        <div className="w-64 bg-[#0d1117] border-r border-white/10 flex flex-col min-h-0">
          <div className="p-4 border-b border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white/80">Chat History</span>
              <button 
                onClick={() => setSidebarOpen(false)}
                className="h-6 w-6 rounded flex items-center justify-center text-white/40 hover:text-white/60 hover:bg-white/5 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={handleNewChat}
              className="w-full h-9 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <Sparkles className="h-4 w-4" />
              New Chat
            </button>
          </div>
          
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-2 space-y-4">
              {groupedTasks.today.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[10px] font-bold text-white/30 uppercase tracking-wider">
                    Today
                  </div>
                  <div className="space-y-1">
                    {groupedTasks.today.map((task) => (
                      <button
                        key={task.id}
                        onClick={() => handleSelectTask(task.id)}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-lg transition-colors group",
                          selectedTaskId === task.id 
                            ? "bg-cyan-500/10 border border-cyan-500/30" 
                            : "hover:bg-white/5"
                        )}
                      >
                        <div className={cn(
                          "text-sm line-clamp-2 break-words",
                          selectedTaskId === task.id ? "text-cyan-400" : "text-white/70 group-hover:text-white/90"
                        )}>
                          {cleanTaskTitle(task.title || task.query || "Untitled")}
                        </div>
                        <div className="text-[10px] text-white/30 mt-1 flex items-center gap-2">
                          <span className={cn(
                            "px-1.5 py-0.5 rounded",
                            task.status === "completed" ? "bg-green-500/10 text-green-400" :
                            task.status === "failed" ? "bg-red-500/10 text-red-400" :
                            task.status === "running" ? "bg-yellow-500/10 text-yellow-400" :
                            "bg-white/5 text-white/40"
                          )}>
                            {task.status}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {groupedTasks.yesterday.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[10px] font-bold text-white/30 uppercase tracking-wider">
                    Yesterday
                  </div>
                  <div className="space-y-1">
                    {groupedTasks.yesterday.map((task) => (
                      <button
                        key={task.id}
                        onClick={() => handleSelectTask(task.id)}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-lg transition-colors group",
                          selectedTaskId === task.id 
                            ? "bg-cyan-500/10 border border-cyan-500/30" 
                            : "hover:bg-white/5"
                        )}
                      >
                        <div className={cn(
                          "text-sm line-clamp-2 break-words",
                          selectedTaskId === task.id ? "text-cyan-400" : "text-white/70 group-hover:text-white/90"
                        )}>
                          {cleanTaskTitle(task.title || task.query || "Untitled")}
                        </div>
                        <div className="text-[10px] text-white/30 mt-1">
                          <span className={cn(
                            "px-1.5 py-0.5 rounded",
                            task.status === "completed" ? "bg-green-500/10 text-green-400" :
                            task.status === "failed" ? "bg-red-500/10 text-red-400" :
                            "bg-white/5 text-white/40"
                          )}>
                            {task.status}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {groupedTasks.earlier.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[10px] font-bold text-white/30 uppercase tracking-wider">
                    Earlier
                  </div>
                  <div className="space-y-1">
                    {groupedTasks.earlier.map((task) => (
                      <button
                        key={task.id}
                        onClick={() => handleSelectTask(task.id)}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-lg transition-colors group",
                          selectedTaskId === task.id 
                            ? "bg-cyan-500/10 border border-cyan-500/30" 
                            : "hover:bg-white/5"
                        )}
                      >
                        <div className={cn(
                          "text-sm line-clamp-2 break-words",
                          selectedTaskId === task.id ? "text-cyan-400" : "text-white/70 group-hover:text-white/90"
                        )}>
                          {cleanTaskTitle(task.title || task.query || "Untitled")}
                        </div>
                        <div className="text-[10px] text-white/30 mt-1">
                          <span className={cn(
                            "px-1.5 py-0.5 rounded",
                            task.status === "completed" ? "bg-green-500/10 text-green-400" :
                            task.status === "failed" ? "bg-red-500/10 text-red-400" :
                            "bg-white/5 text-white/40"
                          )}>
                            {task.status}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {!taskHistory?.length && (
                <div className="text-center py-8 text-white/30 text-sm">
                  No chat history yet
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Main Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-16 border-b border-white/10 bg-[#0d1117]/50 flex items-center justify-between px-6">
          {/* Left: Title & Status */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-white">JARVIS v3</span>
              <div className={cn(
                "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                isConnected 
                  ? "bg-green-500/20 text-green-400" 
                  : "bg-yellow-500/20 text-yellow-400"
              )}>
                {isConnected ? "ONLINE" : "CONNECTING..."}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-white/60">
              <Cpu className="h-4 w-4 text-cyan-400" />
              <span className="text-sm font-mono">GPU: <span className="text-cyan-400">{systemStats?.gpu?.utilizationPercent ?? "--"}%</span></span>
            </div>
            <div className="flex items-center gap-2 text-white/60">
              <Server className="h-4 w-4 text-cyan-400" />
              <span className="text-sm font-mono">MEM: <span className="text-cyan-400">{systemStats ? Math.round(systemStats.memory.totalMb / 1024) : "--"}GB</span></span>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            <select 
              value={taskType}
              onChange={(e) => setTaskType(e.target.value)}
              className="h-9 px-3 bg-[#1a1a2e] border border-white/10 rounded-lg text-sm text-white/80 focus:outline-none focus:border-cyan-500/50 cursor-pointer"
            >
              <option value="research">Research Task</option>
              <option value="code">Code Task</option>
              <option value="analysis">Analysis Task</option>
              <option value="deploy">Deployment Task</option>
            </select>
            <Button 
              onClick={handleSubmit}
              disabled={!input.trim() || jarvis.isStreaming}
              className="h-9 px-4 bg-cyan-600 hover:bg-cyan-500 text-white font-medium gap-2"
            >
              <Play className="h-4 w-4" fill="currentColor" />
              RUN
            </Button>
            <Button 
              variant="outline" 
              className="h-9 px-4 border-white/20 text-white/80 hover:bg-white/5 hover:text-white"
            >
              <Monitor className="h-4 w-4 mr-2" />
              TAKE CONTROL
            </Button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col min-h-0">
            <ScrollArea ref={scrollRef} className="flex-1 h-0">
              <div className="p-8">
                {/* Idle State */}
                {!jarvis.isStreaming && !jarvis.summary && !selectedTask && (
                  <div className="flex flex-col items-center justify-center min-h-[60vh]">
                    <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 flex items-center justify-center mb-6 animate-pulse">
                      <Hexagon className="h-12 w-12 text-cyan-400" />
                    </div>
                    <p className="text-white/50 text-lg uppercase tracking-widest">
                      AWAITING COMMAND INPUT
                    </p>
                  </div>
                )}

                {selectedTask && !jarvis.isStreaming && (
                  <div className="space-y-6">
                    <div className="bg-[#0d1117] rounded-xl border border-white/10 overflow-hidden">
                      <div className="px-6 py-4 border-b border-white/10 bg-gradient-to-r from-blue-500/10 to-transparent">
                        <div className="flex items-center justify-between">
                          <div>
                            <h2 className="text-lg font-medium text-white">
                              {cleanTaskTitle(selectedTask.title || "Untitled Task")}
                            </h2>
                            <p className="text-sm text-white/50 mt-1">
                              {cleanTaskTitle(selectedTask.query)}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={cn(
                              "px-2 py-1 rounded text-xs font-medium",
                              selectedTask.status === "completed" ? "bg-green-500/20 text-green-400" :
                              selectedTask.status === "failed" ? "bg-red-500/20 text-red-400" :
                              selectedTask.status === "running" ? "bg-yellow-500/20 text-yellow-400" :
                              "bg-white/10 text-white/60"
                            )}>
                              {selectedTask.status.toUpperCase()}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 border-white/10 text-white/70 hover:text-white hover:bg-white/5"
                              onClick={() => {
                                navigator.clipboard.writeText(selectedTask.summary || selectedTask.query);
                                toast.success("Copied to clipboard!");
                              }}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      
                      {selectedTask.toolCalls && selectedTask.toolCalls.length > 0 && (
                        <div className="px-6 py-4 border-b border-white/10 bg-[#0a0a12]">
                          <div className="text-xs text-white/40 mb-3 uppercase tracking-wider">
                            Tools Executed ({selectedTask.toolCalls.length})
                          </div>
                          <div className="space-y-2">
                            {selectedTask.toolCalls.slice(0, 5).map((tc) => (
                              <div key={tc.id} className="flex items-center gap-2 text-xs">
                                {tc.status === "completed" ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                                ) : tc.status === "failed" ? (
                                  <XCircle className="h-3.5 w-3.5 text-red-400" />
                                ) : (
                                  <Loader2 className="h-3.5 w-3.5 text-yellow-400" />
                                )}
                                <span className="text-white/60 font-mono">{tc.toolName}</span>
                                {tc.durationMs && (
                                  <span className="text-white/30">
                                    {(tc.durationMs / 1000).toFixed(1)}s
                                  </span>
                                )}
                              </div>
                            ))}
                            {selectedTask.toolCalls.length > 5 && (
                              <div className="text-xs text-white/30">
                                +{selectedTask.toolCalls.length - 5} more tools
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {selectedTask.messages && selectedTask.messages.length > 0 && (
                        <div className="p-6 space-y-4">
                          {selectedTask.messages.map((msg) => (
                            <div key={msg.id} className={cn(
                              "rounded-lg p-4",
                              msg.role === "user" 
                                ? "bg-blue-500/10 border border-blue-500/20" 
                                : "bg-[#1a1a2e] border border-white/5"
                            )}>
                              <div className="text-xs text-white/40 mb-2 uppercase tracking-wider">
                                {msg.role}
                              </div>
                              {hasReportPath(msg.content) ? (
                                <ReportPreview
                                  output={extractReportInfo(msg.content)}
                                  toolName="generate_interactive_report"
                                />
                              ) : (
                                <RichContent content={msg.content} />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {selectedTask.summary && (
                        <div className="p-6 border-t border-white/10">
                          <div className="text-xs text-cyan-400 font-medium mb-3 uppercase tracking-wider">
                            Summary
                          </div>
                          {hasReportPath(selectedTask.summary) ? (
                            <ReportPreview
                              output={extractReportInfo(selectedTask.summary)}
                              toolName="generate_interactive_report"
                            />
                          ) : (
                            <RichContent content={selectedTask.summary} />
                          )}
                        </div>
                      )}
                      
                      {selectedTask.status === "completed" && (
                        <TaskExportBar
                          title={cleanTaskTitle(selectedTask.title || selectedTask.query)}
                          content={selectedTask.summary || selectedTask.query}
                          taskId={selectedTask.id}
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* Streaming State */}
                {jarvis.isStreaming && (() => {
                  const thinkingSteps = jarvis.steps.filter(s => s.type === "thinking");
                  const toolSteps = jarvis.steps.filter(s => s.type === "tool" && s.tool);
                  const recentThoughts = thinkingSteps.slice(-4);
                  
                  return (
                    <div className="space-y-4">
                      {/* Progress Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/20 flex items-center justify-center border border-cyan-500/30">
                              <Loader2 className="h-5 w-5 text-cyan-400 animate-spin" />
                            </div>
                            <div className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-cyan-400 animate-pulse" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-white">Processing</div>
                            <div className="text-xs text-white/40">
                              Iteration {jarvis.currentIteration} of {jarvis.maxIterations || 10}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-white/40">
                          <span className="font-mono">{toolSteps.length} tools</span>
                          <span>•</span>
                          <span className="font-mono">{thinkingSteps.length} thoughts</span>
                        </div>
                      </div>

                      {/* Thought Stream - Cascading Bubbles */}
                      <div className="relative">
                        <div className="absolute left-4 top-0 bottom-0 w-px bg-gradient-to-b from-purple-500/50 via-purple-500/20 to-transparent" />
                        
                        <div className="space-y-3 pl-8">
                          {recentThoughts.map((thought, idx) => {
                            const isLatest = idx === recentThoughts.length - 1;
                            const opacity = isLatest ? 1 : 0.4 + (idx * 0.15);
                            const scale = isLatest ? 1 : 0.95;
                            
                            return (
                              <div
                                key={thought.id}
                                className="relative"
                                style={{
                                  opacity,
                                  transform: `scale(${scale})`,
                                  transformOrigin: 'left center',
                                  animation: isLatest ? 'slideInFromLeft 0.3s ease-out' : undefined,
                                }}
                              >
                                <div className="absolute -left-8 top-3 w-4 h-4 flex items-center justify-center">
                                  <div 
                                    className={cn(
                                      "rounded-full",
                                      isLatest 
                                        ? "w-3 h-3 bg-purple-400 shadow-lg shadow-purple-500/50" 
                                        : "w-2 h-2 bg-purple-500/50"
                                    )}
                                    style={isLatest ? { animation: 'pulse 2s ease-in-out infinite' } : undefined}
                                  />
                                </div>
                                
                                <div 
                                  className={cn(
                                    "rounded-lg overflow-hidden transition-all duration-300",
                                    isLatest 
                                      ? "bg-gradient-to-r from-purple-500/10 via-[#0d1117] to-[#0d1117] border border-purple-500/30 shadow-lg shadow-purple-500/10" 
                                      : "bg-[#0d1117]/50 border border-white/5"
                                  )}
                                >
                                  <div className="p-3">
                                    {isLatest && (
                                      <div className="flex items-center gap-2 mb-2">
                                        <Brain className="h-4 w-4 text-purple-400" />
                                        <span className="text-xs text-purple-400 font-medium uppercase tracking-wider">Reasoning</span>
                                        <div className="flex-1" />
                                        <div className="flex gap-1">
                                          {[...Array(3)].map((_, i) => (
                                            <div
                                              key={i}
                                              className="h-1.5 w-1.5 rounded-full bg-purple-400"
                                              style={{ animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite` }}
                                            />
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    <p className={cn(
                                      "text-sm leading-relaxed",
                                      isLatest ? "text-white/70" : "text-white/40"
                                    )}>
                                      {thought.content?.slice(0, isLatest ? 400 : 120)}
                                      {(thought.content?.length || 0) > (isLatest ? 400 : 120) && "..."}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        
                        <style>{`
                          @keyframes slideInFromLeft {
                            from { opacity: 0; transform: translateX(-20px) scale(0.95); }
                            to { opacity: 1; transform: translateX(0) scale(1); }
                          }
                        `}</style>
                      </div>

                      {/* Tools Executed - Compact Pills */}
                      {toolSteps.length > 0 && (
                        <div className="rounded-lg bg-[#0d1117] border border-white/5 overflow-hidden">
                          <div className="px-4 py-2 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                            <span className="text-xs text-white/50 font-medium">Tools</span>
                            <span className="text-xs text-white/30 font-mono">{toolSteps.length} executed</span>
                          </div>
                          <div className="p-3 flex flex-wrap gap-2">
                            {toolSteps.slice(-8).map((step, idx) => (
                              <div 
                                key={step.id || idx} 
                                className={cn(
                                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                                  step.tool?.status === "running" 
                                    ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" 
                                    : step.tool?.isError 
                                      ? "bg-red-500/10 text-red-400/70 border border-red-500/20"
                                      : "bg-green-500/10 text-green-400/70 border border-green-500/20"
                                )}
                                style={{ animation: step.tool?.status === "running" ? 'pulse 2s ease-in-out infinite' : undefined }}
                              >
                                {step.tool?.status === "running" ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : step.tool?.isError ? (
                                  <XCircle className="h-3 w-3" />
                                ) : (
                                  <CheckCircle2 className="h-3 w-3" />
                                )}
                                <span>{step.tool?.name}</span>
                                {step.tool?.durationMs && step.tool.status !== "running" && (
                                  <span className="text-white/30">{(step.tool.durationMs / 1000).toFixed(1)}s</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Response State - only show when no task selected from history */}
                {jarvis.summary && !jarvis.isStreaming && !selectedTask && (
                  <div className="bg-[#0d1117] rounded-xl border border-white/10 overflow-hidden">
                    <div className="px-6 py-4 border-b border-white/10 bg-gradient-to-r from-cyan-500/10 to-transparent">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                            <Sparkles className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-white">Task Complete</div>
                            <div className="text-xs text-white/40">
                              {jarvis.steps.filter(s => s.type === "tool").length} tools executed
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 border-white/10 text-white/70 hover:text-white hover:bg-white/5"
                            onClick={() => {
                              navigator.clipboard.writeText(jarvis.summary || "");
                              toast.success("Copied to clipboard!");
                            }}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 border-white/10 text-white/70 hover:text-white hover:bg-white/5"
                            onClick={() => {
                              const blob = new Blob([jarvis.summary || ""], { type: "text/markdown" });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = "jarvis-response.md";
                              a.click();
                              toast.success("Downloaded!");
                            }}
                          >
                            <FileDown className="h-3.5 w-3.5" />
                          </Button>
                        </div>
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
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Input Bar */}
            <div className="border-t border-white/10 p-4 bg-[#0d1117]/50">
              <div className="max-w-4xl mx-auto flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-white/40 hover:text-white shrink-0"
                >
                  <Mic className="h-5 w-5" />
                </Button>
                <div className="flex-1 relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Command JARVIS..."
                    className="w-full h-12 bg-[#1a1a2e] border border-white/10 rounded-lg px-4 pr-20 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/50 transition-colors"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <kbd className="text-[10px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded font-mono">
                      ⌘ K
                    </kbd>
                  </div>
                </div>
                <Button
                  onClick={handleSubmit}
                  disabled={!input.trim() || jarvis.isStreaming}
                  className="h-10 w-10 p-0 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50"
                >
                  <Send className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Right Sidebar - HIVE TELEMETRY */}
          <div className="w-80 border-l border-white/10 bg-[#0a0a0f] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-white/10 bg-gradient-to-r from-cyan-500/5 to-purple-500/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Hexagon className="h-5 w-5 text-cyan-400" />
                  <span className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 uppercase tracking-wider">
                    HIVE TELEMETRY
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/40 font-mono">UPTIME: {uptime}</span>
                  <button className="h-6 w-6 rounded flex items-center justify-center text-white/40 hover:text-white/60 hover:bg-white/5 transition-colors">
                    <ChevronUp className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Active Agents */}
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-white/50 uppercase tracking-wider">Active Agents</span>
                <span className="text-xs text-green-400 font-mono">8/8 ONLINE</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <AgentBadge label="ORCH" />
                <AgentBadge label="PLAN" />
                <AgentBadge label="CODE" />
                <AgentBadge label="VIS" />
                <AgentBadge label="EXEC" />
                <AgentBadge label="MEM" />
                <AgentBadge label="VER" />
                <AgentBadge label="SEC" />
              </div>
            </div>

            {/* Memory Core */}
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-cyan-400" />
                  <span className="text-xs font-medium text-white/80">MEMORY CORE (QDRANT)</span>
                </div>
                <span className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded",
                  jarvis.isStreaming 
                    ? "bg-green-500/20 text-green-400" 
                    : "bg-white/5 text-white/40"
                )}>
                  {jarvis.isStreaming ? "ACTIVE" : "STANDBY"}
                </span>
              </div>
              <p className="text-xs text-white/30 font-mono">
                {jarvis.isStreaming ? "Processing memories..." : "NO ACTIVE OPERATIONS"}
              </p>
            </div>

            {/* System Vitals */}
            <div className="p-4 flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-medium text-white/50 uppercase tracking-wider">System Vitals</span>
                <span className="text-[10px] text-cyan-400">GPT-5.2 PRO ACTIVE</span>
              </div>
              <div className="space-y-4 shrink-0">
                <VitalBar 
                  label={systemStats?.gpu ? "VRAM" : "VRAM (N/A)"} 
                  value={systemStats?.gpu ? Math.round((systemStats.gpu.memoryUsedMb / systemStats.gpu.memoryTotalMb) * 100) : 0} 
                  unit="%" 
                />
                <VitalBar 
                  label={`GPU UTIL${systemStats?.gpu ? "" : " (N/A)"}`}
                  value={systemStats?.gpu?.utilizationPercent ?? 0} 
                  unit="%" 
                />
                <VitalBar 
                  label="NETWORK I/O" 
                  value={systemStats ? Math.round((systemStats.network.rxBytes + systemStats.network.txBytes) / 1024 / 1024) : 0} 
                  unit=" MB/s" 
                />
                <VitalBar 
                  label={`CPU LOAD (${systemStats?.cpu.cores ?? "--"} CORES)`}
                  value={systemStats?.cpu.loadPercent ?? 0} 
                  unit="%" 
                />
              </div>
              
              <div className="mt-4 flex-1 min-h-0 flex flex-col">
                <div className="flex items-center justify-between mb-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <Activity className="h-3 w-3 text-cyan-400" />
                    <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">LIVE TELEMETRY</span>
                  </div>
                  <span className="text-[10px] text-cyan-600 font-mono">{logs.length} EVENTS</span>
                </div>
                <div ref={logsContainerRef} className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1 scrollbar-thin scrollbar-thumb-cyan-900/50 scrollbar-track-transparent font-mono text-[10px]">
                  {logs.length === 0 ? (
                    <div className="text-white/20 text-center py-4">Awaiting events...</div>
                  ) : (
                    logs.map(log => {
                      const config = eventConfig[log.type];
                      const Icon = config.icon;
                      return (
                        <div
                          key={log.id}
                          className="flex items-start gap-2 animate-in fade-in slide-in-from-left-2 duration-300"
                        >
                          <span className="text-white/30 shrink-0">
                            [{log.timestamp.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}]
                          </span>
                          <div className={cn("flex items-center gap-1 shrink-0", config.color)}>
                            <Icon className="h-3 w-3" />
                            <span className="font-bold w-10">{config.label}</span>
                          </div>
                          <span className={cn(
                            "truncate",
                            log.status === "error" ? "text-red-400" : 
                            log.status === "success" ? "text-green-400/80" : "text-white/60"
                          )}>
                            {log.message}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Status Footer */}
            <div className="p-3 border-t border-white/10 bg-black/30">
              <div className="grid grid-cols-3 gap-2 text-[9px]">
                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-purple-500/10">
                  <Brain className="h-3 w-3 text-purple-400" />
                  <span className="text-purple-400 font-mono">
                    {jarvis.steps.filter(s => s.type === "thinking").length}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-green-500/10">
                  <Boxes className="h-3 w-3 text-green-400" />
                  <span className="text-green-400 font-mono">
                    {jarvis.steps.filter(s => s.type === "tool").length}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-red-500/10">
                  <AlertTriangle className="h-3 w-3 text-red-400" />
                  <span className="text-red-400 font-mono">
                    {jarvis.steps.filter(s => s.type === "tool" && s.tool?.status === "failed").length}
                  </span>
                </div>
              </div>
            </div>

            {/* Error Display */}
            {jarvis.error && (
              <div className="p-3 border-t border-red-500/30 bg-red-500/10">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-red-400">ERROR</div>
                    <div className="text-[10px] text-red-300/80 font-mono mt-0.5 line-clamp-3">
                      {jarvis.error.slice(0, 150)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
