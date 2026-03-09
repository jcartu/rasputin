import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Send,
  Bot,
  Globe,
  Terminal,
  FolderOpen,
  Code,
  Plus,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  RefreshCw,
  Settings,
  Activity,
  Monitor,
  StopCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { io, Socket } from "socket.io-client";

interface AgentStep {
  id: string;
  type: "thinking" | "tool" | "browser" | "terminal" | "file" | "response";
  title: string;
  content?: string;
  status: "pending" | "running" | "completed" | "failed";
  timestamp: number;
  durationMs?: number;
}

interface AgentSession {
  id: string;
  title: string;
  status: "idle" | "running" | "completed" | "failed";
  steps: AgentStep[];
  createdAt: number;
}

interface TerminalLine {
  id: string;
  type: "input" | "output" | "error";
  content: string;
  timestamp: number;
}

interface FileItem {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
}

export default function Manus() {
  const { user, loading: authLoading } = useAuth();
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [activeSession, setActiveSession] = useState<AgentSession | null>(null);
  const [input, setInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "browser" | "terminal" | "files" | "code"
  >("browser");

  const [browserUrl, setBrowserUrl] = useState("about:blank");
  const [browserScreenshot, setBrowserScreenshot] = useState<string | null>(
    null
  );
  const [browserLoading, setBrowserLoading] = useState(false);
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentPath, setCurrentPath] = useState("/workspace");
  const [currentIteration, setCurrentIteration] = useState(0);
  const [maxIterations, setMaxIterations] = useState(15);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const activeSessionRef = useRef<AgentSession | null>(null);

  // Keep ref in sync with state for use in event handlers
  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  useEffect(() => {
    if (!authLoading && !user) {
      window.location.href = getLoginUrl();
    }
  }, [user, authLoading]);

  useEffect(() => {
    const socket = io({
      path: "/api/socket.io",
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[Manus] WebSocket connected");
    });

    socket.on("disconnect", () => {
      console.log("[Manus] WebSocket disconnected");
    });

    socket.on("manus:thinking", data => {
      if (activeSessionRef.current?.id !== data.sessionId) return;

      setActiveSession(prev => {
        if (!prev) return null;
        const existingThinking = prev.steps.find(
          s => s.type === "thinking" && s.status === "running"
        );
        if (existingThinking) {
          return {
            ...prev,
            steps: prev.steps.map(s =>
              s.id === existingThinking.id
                ? { ...s, content: (s.content || "") + data.content }
                : s
            ),
          };
        }
        return {
          ...prev,
          steps: [
            ...prev.steps,
            {
              id: crypto.randomUUID(),
              type: "thinking",
              title: "Thinking...",
              content: data.content,
              status: "running",
              timestamp: data.timestamp,
            },
          ],
        };
      });
    });

    socket.on("manus:tool_start", data => {
      if (activeSessionRef.current?.id !== data.sessionId) return;

      setActiveSession(prev => {
        if (!prev) return null;
        const prevSteps = prev.steps.map(s =>
          s.type === "thinking" && s.status === "running"
            ? { ...s, status: "completed" as const }
            : s
        );
        return {
          ...prev,
          steps: [
            ...prevSteps,
            {
              id: crypto.randomUUID(),
              type: "tool",
              title: data.toolName,
              content: JSON.stringify(data.input, null, 2),
              status: "running",
              timestamp: data.timestamp,
            },
          ],
        };
      });
    });

    socket.on("manus:tool_end", data => {
      if (activeSessionRef.current?.id !== data.sessionId) return;

      setActiveSession(prev => {
        if (!prev) return null;
        return {
          ...prev,
          steps: prev.steps.map(s =>
            s.type === "tool" && s.status === "running"
              ? {
                  ...s,
                  status: data.isError
                    ? ("failed" as const)
                    : ("completed" as const),
                  content: data.output.slice(0, 500),
                }
              : s
          ),
        };
      });
    });

    socket.on("manus:screenshot", data => {
      if (activeSessionRef.current?.id !== data.sessionId) return;

      setBrowserScreenshot(`data:image/png;base64,${data.screenshot}`);
      setBrowserUrl(data.url);
      setBrowserLoading(false);
    });

    socket.on("manus:terminal", data => {
      if (activeSessionRef.current?.id !== data.sessionId) return;

      setTerminalLines(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: data.isError ? "error" : "output",
          content: data.output,
          timestamp: data.timestamp,
        },
      ]);
    });

    socket.on("manus:file", data => {
      if (activeSessionRef.current?.id !== data.sessionId) return;

      setActiveSession(prev => {
        if (!prev) return null;
        return {
          ...prev,
          steps: [
            ...prev.steps,
            {
              id: crypto.randomUUID(),
              type: "file",
              title: `${data.operation}: ${data.path}`,
              status: "completed",
              timestamp: data.timestamp,
            },
          ],
        };
      });
    });

    socket.on("manus:iteration", data => {
      if (activeSessionRef.current?.id !== data.sessionId) return;
      setCurrentIteration(data.iteration);
      setMaxIterations(data.maxIterations);
    });

    socket.on("manus:complete", data => {
      if (activeSessionRef.current?.id !== data.sessionId) return;

      setIsRunning(false);
      setActiveSession(prev => {
        if (!prev) return null;
        return {
          ...prev,
          status: data.success ? "completed" : "failed",
          steps: [
            ...prev.steps.map(s =>
              s.status === "running"
                ? { ...s, status: "completed" as const }
                : s
            ),
            {
              id: crypto.randomUUID(),
              type: "response",
              title: data.success ? "Task completed" : "Task failed",
              content: data.summary,
              status: data.success ? "completed" : "failed",
              timestamp: data.timestamp,
            },
          ],
        };
      });

      if (data.success) {
        toast.success("Task completed successfully");
      } else {
        toast.error("Task failed");
      }
    });

    socket.on("manus:error", data => {
      if (activeSessionRef.current?.id !== data.sessionId) return;

      setIsRunning(false);
      setActiveSession(prev => {
        if (!prev) return null;
        return {
          ...prev,
          status: "failed",
          steps: [
            ...prev.steps,
            {
              id: crypto.randomUUID(),
              type: "response",
              title: "Error",
              content: data.error,
              status: "failed",
              timestamp: data.timestamp,
            },
          ],
        };
      });
      toast.error(data.error);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const createSession = useCallback(() => {
    const newSession: AgentSession = {
      id: crypto.randomUUID(),
      title: "New Task",
      status: "idle",
      steps: [],
      createdAt: Date.now(),
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSession(newSession);
    setTerminalLines([]);
    setBrowserScreenshot(null);
    setBrowserUrl("about:blank");
    setCurrentIteration(0);
  }, []);

  useEffect(() => {
    if (sessions.length === 0) {
      createSession();
    }
  }, [sessions.length, createSession]);

  const handleSubmit = async () => {
    if (!input.trim() || isRunning || !activeSession || !socketRef.current)
      return;

    const userMessage = input.trim();
    setInput("");
    setIsRunning(true);
    setBrowserLoading(true);
    setCurrentIteration(0);

    setActiveSession(prev =>
      prev
        ? {
            ...prev,
            title:
              userMessage.slice(0, 50) + (userMessage.length > 50 ? "..." : ""),
            status: "running",
            steps: [],
          }
        : null
    );

    setTerminalLines([
      {
        id: crypto.randomUUID(),
        type: "input",
        content: `$ manus execute "${userMessage}"`,
        timestamp: Date.now(),
      },
    ]);

    socketRef.current.emit("manus:start", {
      task: userMessage,
      sessionId: activeSession.id,
      userId: user?.id || 0,
      maxIterations: 15,
    });
  };

  const handleCancel = () => {
    if (!socketRef.current || !activeSession) return;

    socketRef.current.emit("manus:cancel", {
      sessionId: activeSession.id,
    });

    setIsRunning(false);
    setActiveSession(prev =>
      prev
        ? {
            ...prev,
            status: "failed",
            steps: [
              ...prev.steps,
              {
                id: crypto.randomUUID(),
                type: "response",
                title: "Cancelled",
                content: "Task was cancelled by user",
                status: "failed",
                timestamp: Date.now(),
              },
            ],
          }
        : null
    );
    toast.info("Task cancelled");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0a0a0f]">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-[#0a0a0f] text-white overflow-hidden">
      <div className="w-64 border-r border-white/10 flex flex-col">
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-semibold text-sm">MANUS</h1>
              <p className="text-[10px] text-white/50">Claude Opus 4.5</p>
            </div>
          </div>
        </div>

        <div className="p-3">
          <Button
            onClick={createSession}
            className="w-full justify-start gap-2 bg-white/5 hover:bg-white/10 border border-white/10"
            variant="ghost"
          >
            <Plus className="w-4 h-4" />
            New Task
          </Button>
        </div>

        <ScrollArea className="flex-1 px-2">
          <div className="space-y-1 py-2">
            {sessions.map(session => (
              <button
                key={session.id}
                onClick={() => setActiveSession(session)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                  "hover:bg-white/5",
                  activeSession?.id === session.id && "bg-white/10"
                )}
              >
                <div className="flex items-center gap-2">
                  {session.status === "running" ? (
                    <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                  ) : session.status === "completed" ? (
                    <CheckCircle2 className="w-3 h-3 text-green-400" />
                  ) : session.status === "failed" ? (
                    <XCircle className="w-3 h-3 text-red-400" />
                  ) : (
                    <Clock className="w-3 h-3 text-white/40" />
                  )}
                  <span className="truncate">{session.title}</span>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>

        <div className="p-3 border-t border-white/10">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-white/60"
          >
            <Settings className="w-4 h-4" />
            Settings
          </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="h-12 border-b border-white/10 flex items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Tabs
              value={activeTab}
              onValueChange={v => setActiveTab(v as typeof activeTab)}
            >
              <TabsList className="bg-white/5 h-8">
                <TabsTrigger value="browser" className="text-xs gap-1.5 h-7">
                  <Globe className="w-3.5 h-3.5" />
                  Browser
                </TabsTrigger>
                <TabsTrigger value="terminal" className="text-xs gap-1.5 h-7">
                  <Terminal className="w-3.5 h-3.5" />
                  Terminal
                </TabsTrigger>
                <TabsTrigger value="files" className="text-xs gap-1.5 h-7">
                  <FolderOpen className="w-3.5 h-3.5" />
                  Files
                </TabsTrigger>
                <TabsTrigger value="code" className="text-xs gap-1.5 h-7">
                  <Code className="w-3.5 h-3.5" />
                  Code
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex items-center gap-2">
            {isRunning && (
              <>
                <Badge
                  variant="outline"
                  className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
                >
                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                  {currentIteration}/{maxIterations}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  className="h-7 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                  <StopCircle className="w-4 h-4 mr-1" />
                  Stop
                </Button>
              </>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 flex">
          <div className="flex-1 flex flex-col">
            <div className="flex-1 relative">
              {activeTab === "browser" && (
                <div className="absolute inset-0 flex flex-col">
                  <div className="h-10 bg-[#1a1a24] border-b border-white/10 flex items-center px-3 gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500/80" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                      <div className="w-3 h-3 rounded-full bg-green-500/80" />
                    </div>
                    <div className="flex-1 mx-4">
                      <div className="bg-black/30 rounded-md px-3 py-1 text-sm text-white/60 flex items-center gap-2">
                        {browserLoading && (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        )}
                        {browserUrl}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 bg-[#12121a] flex items-center justify-center overflow-hidden">
                    {browserScreenshot ? (
                      <img
                        src={browserScreenshot}
                        alt="Browser screenshot"
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <div className="text-center text-white/40">
                        <Monitor className="w-16 h-16 mx-auto mb-4 opacity-50" />
                        <p>Browser view will appear here</p>
                        <p className="text-sm mt-1">
                          Send a task to start browsing
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "terminal" && (
                <div className="absolute inset-0 bg-black p-4 font-mono text-sm">
                  <ScrollArea className="h-full">
                    {terminalLines.length === 0 ? (
                      <div className="text-white/40">
                        <p>Terminal ready.</p>
                        <p className="mt-2">$ _</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {terminalLines.map(line => (
                          <div
                            key={line.id}
                            className={cn(
                              line.type === "input" && "text-cyan-400",
                              line.type === "output" && "text-white/80",
                              line.type === "error" && "text-red-400"
                            )}
                          >
                            <pre className="whitespace-pre-wrap break-all">
                              {line.content}
                            </pre>
                          </div>
                        ))}
                        {isRunning && (
                          <div className="text-white/40 animate-pulse">
                            Processing...
                          </div>
                        )}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              )}

              {activeTab === "files" && (
                <div className="absolute inset-0 p-4">
                  <div className="flex items-center gap-2 mb-4 text-sm text-white/60">
                    <FolderOpen className="w-4 h-4" />
                    <span>{currentPath}</span>
                  </div>
                  {files.length === 0 ? (
                    <div className="text-center text-white/40 py-12">
                      <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>Workspace is empty</p>
                      <p className="text-sm mt-1">
                        Files created by the agent will appear here
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-2">
                      {files.map(file => (
                        <div
                          key={file.path}
                          className="p-3 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer"
                        >
                          {file.type === "directory" ? (
                            <FolderOpen className="w-8 h-8 mb-2 text-yellow-400" />
                          ) : (
                            <Code className="w-8 h-8 mb-2 text-blue-400" />
                          )}
                          <p className="text-sm truncate">{file.name}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "code" && (
                <div className="absolute inset-0 bg-[#1e1e2e] flex items-center justify-center">
                  <div className="text-center text-white/40">
                    <Code className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Code editor</p>
                    <p className="text-sm mt-1">Select a file to edit</p>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-white/10 p-4">
              <div className="flex gap-3">
                <Textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="What would you like me to do?"
                  className="flex-1 min-h-[60px] max-h-[200px] bg-white/5 border-white/10 resize-none"
                  disabled={isRunning}
                />
                <Button
                  onClick={handleSubmit}
                  disabled={!input.trim() || isRunning}
                  className="self-end bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
                >
                  {isRunning ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="w-72 border-l border-white/10 flex flex-col">
            <div className="p-3 border-b border-white/10 flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-medium">Activity</span>
              {activeSession && (
                <Badge variant="outline" className="ml-auto text-[10px]">
                  {activeSession.steps.length} steps
                </Badge>
              )}
            </div>

            <ScrollArea className="flex-1">
              <div className="p-3 space-y-2">
                {activeSession?.steps.map(step => (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={cn(
                      "p-3 rounded-lg text-sm",
                      "bg-white/5 border border-white/10"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {step.status === "running" ? (
                        <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                      ) : step.status === "completed" ? (
                        <CheckCircle2 className="w-3 h-3 text-green-400" />
                      ) : step.status === "failed" ? (
                        <XCircle className="w-3 h-3 text-red-400" />
                      ) : (
                        <Clock className="w-3 h-3 text-white/40" />
                      )}
                      <span className="font-medium text-xs">{step.title}</span>
                    </div>
                    {step.content && (
                      <p className="text-xs text-white/60 mt-1 line-clamp-3 whitespace-pre-wrap">
                        {step.content}
                      </p>
                    )}
                    {step.durationMs && (
                      <p className="text-[10px] text-white/40 mt-1">
                        {(step.durationMs / 1000).toFixed(1)}s
                      </p>
                    )}
                  </motion.div>
                ))}

                {(!activeSession || activeSession.steps.length === 0) && (
                  <div className="text-center text-white/40 py-8 text-sm">
                    <Zap className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No activity yet</p>
                    <p className="text-xs mt-1">Send a task to get started</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  );
}
