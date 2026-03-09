import { useState, useEffect, useRef, useCallback } from "react";
import { ChatPanel } from "./components/ChatPanel";
import type { ChatMessage } from "./components/ChatPanel";
import { ComputerView } from "./components/ComputerView";
import type { ActionEvent } from "./components/ActionFeed";
import { TaskBreakdown } from "./components/TaskBreakdown";
import type { TaskItem } from "./components/TaskBreakdown";
import { FileBrowser } from "./components/FileBrowser";
import type { FileItem } from "./components/FileBrowser";
import { VNCViewer } from "./components/VNCViewer";
import { TerminalPanel } from "./components/TerminalPanel";
import type { TerminalLine } from "./components/TerminalPanel";
import { SessionHistory } from "./components/SessionHistory";
import { CodeEditor } from "./components/CodeEditor";
import { SettingsPanel } from "./components/SettingsPanel";
import { ProjectsPanel } from "./components/ProjectsPanel";
import type { Project } from "./components/ProjectsPanel";

const SUGGESTIONS = [
  {
    icon: "🌐",
    title: "Build a website",
    description: "Create landing pages, portfolios, or web applications",
    prompt:
      "Create a modern landing page for a coffee shop called 'Morning Brew' with a hero section, menu, and contact form",
  },
  {
    icon: "📊",
    title: "Analyze data",
    description: "Process datasets, create visualizations and insights",
    prompt:
      "Create a Python script that analyzes sample sales data and generates charts showing trends",
  },
  {
    icon: "🔍",
    title: "Research topics",
    description: "Search the web and compile comprehensive reports",
    prompt:
      "Search the web for the latest developments in AI and create a summary report",
  },
  {
    icon: "📝",
    title: "Write code",
    description: "Build scripts, APIs, and software components",
    prompt:
      "Write a Python REST API with FastAPI that manages a todo list with CRUD operations",
  },
  {
    icon: "📑",
    title: "Create documents",
    description: "Generate presentations, reports, and documentation",
    prompt:
      "Create a professional project proposal document for a mobile app startup",
  },
  {
    icon: "🤖",
    title: "Automate tasks",
    description: "Build workflows and automation scripts",
    prompt:
      "Create a Python script that monitors a folder and automatically organizes files by type",
  },
];

type RightPanelView = "browser" | "vnc" | "files" | "terminal" | "code";

function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [browserUrl, setBrowserUrl] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
  const [maxSteps, setMaxSteps] = useState(20);
  const [thought, setThought] = useState("");
  const [actionEvents, setActionEvents] = useState<ActionEvent[]>([]);
  const [vncUrl, setVncUrl] = useState<string | null>(null);

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentAction, setCurrentAction] = useState<string>("");
  const [toolsUsed, setToolsUsed] = useState(0);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [filePath, setFilePath] = useState("");
  const [isVncControlled, setIsVncControlled] = useState(false);
  const [rightPanelView, setRightPanelView] =
    useState<RightPanelView>("browser");
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID());
  const [activeMode, setActiveMode] = useState<"adaptive" | "chat" | "agent">(
    "adaptive"
  );
  const [routedMode, setRoutedMode] = useState<string | null>(null);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [showProjects, setShowProjects] = useState(true);

  const wsRef = useRef<WebSocket | null>(null);
  const connectRef = useRef<() => void>(() => {});

  const addActionEvent = useCallback(
    (
      icon: string,
      title: string,
      detail?: string,
      status: ActionEvent["status"] = "done"
    ) => {
      const event: ActionEvent = {
        id: crypto.randomUUID(),
        type: "action",
        icon,
        title,
        detail,
        status,
        timestamp: new Date(),
      };
      setActionEvents(prev => [...prev.slice(-50), event]);
      return event.id;
    },
    []
  );

  const updateActionEvent = useCallback(
    (id: string, updates: Partial<ActionEvent>) => {
      setActionEvents(prev =>
        prev.map(e => (e.id === id ? { ...e, ...updates } : e))
      );
    },
    []
  );

  const fetchFiles = useCallback(
    async (path = "") => {
      try {
        const res = await fetch(
          `/api/sessions/${sessionId}/files?path=${encodeURIComponent(path)}`
        );
        if (res.ok) {
          const data = await res.json();
          setFiles(data.files || []);
          setFilePath(data.path || "");
        }
      } catch {
        void 0;
      }
    },
    [sessionId]
  );

  const connect = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/${sessionId}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      addActionEvent("🔗", "Connected to server");
    };

    ws.onclose = () => {
      setIsConnected(false);
      addActionEvent("⚠️", "Disconnected", "Reconnecting...", "error");
      setTimeout(() => connectRef.current(), 3000);
    };

    ws.onerror = () => ws.close();

    ws.onmessage = event => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case "status":
          if (data.data.state === "thinking") {
            setIsProcessing(true);
            setStartTime(Date.now());
            setCurrentAction("Thinking...");
            addActionEvent("🧠", "Agent is thinking...", undefined, "running");
          } else if (data.data.state === "planning") {
            setCurrentAction("Planning tasks...");
            addActionEvent("📋", "Planning tasks...", undefined, "running");
          } else if (data.data.state === "routing") {
            setCurrentAction("Classifying request...");
            addActionEvent(
              "🔀",
              "Classifying request...",
              undefined,
              "running"
            );
          }
          break;

        case "mode_selected":
          setRoutedMode(data.data.mode);
          addActionEvent(
            data.data.mode === "chat" ? "💬" : "🤖",
            `Mode: ${data.data.mode}`,
            typeof data.data.reason === "string" ? data.data.reason : undefined
          );
          break;

        case "step_start":
          setCurrentStep(data.data.step);
          setMaxSteps(data.data.max_steps);
          addActionEvent(
            "📍",
            `Starting step ${data.data.step}`,
            `of ${data.data.max_steps}`
          );
          break;

        case "thought": {
          const thoughtContent =
            typeof data.data.content === "string"
              ? data.data.content
              : JSON.stringify(data.data.content);
          setThought(thoughtContent);
          setMessages(prev => {
            const updated = [...prev];
            const lastMsg = updated[updated.length - 1];
            if (lastMsg && lastMsg.role === "assistant") {
              lastMsg.content = thoughtContent;
              lastMsg.isThinking = false;
            }
            return updated;
          });
          addActionEvent(
            "💭",
            "Thinking",
            thoughtContent.slice(0, 100) + "..."
          );
          break;
        }

        case "task_plan": {
          const newTasks = (data.data.tasks || []).map(
            (t: {
              id: string;
              title: string;
              status: string;
              description?: string;
            }) => ({
              id: t.id,
              title: t.title,
              status: t.status as TaskItem["status"],
              description: t.description,
            })
          );
          setTasks(newTasks);
          addActionEvent("📋", `Planned ${newTasks.length} task(s)`);
          break;
        }

        case "task_update": {
          const { task_id, status } = data.data;
          setTasks(prev =>
            prev.map(t =>
              t.id === task_id
                ? { ...t, status: status as TaskItem["status"] }
                : t
            )
          );
          if (status === "in_progress") {
            setCurrentTaskId(task_id);
          }
          break;
        }

        case "tools_selected": {
          const tools = data.data.tools as string[];
          addActionEvent(
            "🧰",
            `Selected ${tools.length} tool(s)`,
            tools.join(", ")
          );
          break;
        }

        case "tool_start": {
          const name = data.data.name as string;
          setCurrentAction(`Running ${name}...`);
          setToolsUsed(prev => prev + 1);
          const icons: Record<string, string> = {
            browser_use: "🌐",
            python_execute: "🐍",
            run_shell: "⚡",
            read_file: "📖",
            write_file: "✍️",
            list_files: "📂",
            delete_file: "🗑️",
            str_replace_editor: "📝",
            ask_human: "❓",
            terminate: "✅",
          };
          const eventId = addActionEvent(
            icons[name] || "⚡",
            `Running ${name}`,
            undefined,
            "running"
          );

          if (name === "browser_use") {
            const args = data.data.args as Record<string, unknown>;
            if (args.url) setBrowserUrl(String(args.url));
          }

          (window as unknown as Record<string, string>).__currentToolEventId =
            eventId;
          break;
        }

        case "tool_result": {
          const eventId = (window as unknown as Record<string, string>)
            .__currentToolEventId;
          if (eventId) {
            updateActionEvent(eventId, { status: "done" });
          }
          addActionEvent(
            "✅",
            `${data.data.name} completed`,
            data.data.result?.slice?.(0, 100)
          );

          if (data.data.has_image && data.data.base64_image) {
            setScreenshot(data.data.base64_image);
          }
          break;
        }

        case "screenshot":
          if (data.data.base64_image) {
            setScreenshot(data.data.base64_image);
          }
          break;

        case "tool_error": {
          const eventId = (window as unknown as Record<string, string>)
            .__currentToolEventId;
          if (eventId) {
            updateActionEvent(eventId, { status: "error" });
          }
          const errorMsg =
            typeof data.data.error === "string"
              ? data.data.error
              : JSON.stringify(data.data.error);
          addActionEvent("❌", `${data.data.name} failed`, errorMsg, "error");
          break;
        }

        case "files_updated":
          setFiles(data.data.files || []);
          addActionEvent("📂", "Files updated");
          break;

        case "terminal_output": {
          const terminalContent =
            typeof data.data.content === "string"
              ? data.data.content
              : JSON.stringify(data.data.content);
          const line: TerminalLine = {
            id: crypto.randomUUID(),
            type: data.data.type as TerminalLine["type"],
            content: terminalContent,
            timestamp: new Date(),
          };
          setTerminalLines(prev => [...prev.slice(-200), line]);
          if (data.data.type === "command") {
            setRightPanelView("terminal");
          }
          break;
        }

        case "complete":
          setIsProcessing(false);
          setCurrentStep(0);
          setCurrentTaskId(null);
          setStartTime(null);
          setCurrentAction("Completed!");
          addActionEvent(
            "🎉",
            "Task completed",
            data.data.success ? "Successfully" : "With errors"
          );
          fetchFiles(filePath);
          break;

        case "error": {
          setIsProcessing(false);
          setStartTime(null);
          setCurrentAction("Error");
          const errMessage =
            typeof data.data.message === "string"
              ? data.data.message
              : JSON.stringify(data.data.message);
          addActionEvent("❌", "Error occurred", errMessage, "error");
          break;
        }

        case "sandbox_ready":
          setVncUrl(data.data.vnc_url || null);
          addActionEvent("🖥️", "Sandbox ready", "VNC live view available");
          break;
      }
    };
  }, [sessionId, addActionEvent, updateActionEvent, fetchFiles, filePath]);

  // Keep ref in sync for reconnection timer
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  // Elapsed time tracker
  useEffect(() => {
    if (!startTime || !isProcessing) return;
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 100);
    return () => clearInterval(interval);
  }, [startTime, isProcessing]);

  useEffect(() => {
    connect();
    return () => wsRef.current?.close();
  }, [connect]);

  const sendMessage = useCallback(
    (text: string) => {
      if (
        !text.trim() ||
        !wsRef.current ||
        wsRef.current.readyState !== WebSocket.OPEN
      )
        return;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        timestamp: new Date(),
      };

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isThinking: true,
      };

      setMessages(prev => [...prev, userMsg, assistantMsg]);
      setInput("");
      setIsProcessing(true);
      setThought("");
      setScreenshot(null);
      setActionEvents([]);
      setTasks([]);
      setCurrentTaskId(null);
      setTerminalLines([]);
      setRoutedMode(null);
      setStartTime(Date.now());
      setElapsedTime(0);
      setToolsUsed(0);
      setCurrentAction("Starting...");

      addActionEvent("📤", "Sending message", text.slice(0, 50) + "...");
      wsRef.current.send(
        JSON.stringify({
          type: "message",
          content: text,
          mode: activeMode,
          project_id: currentProject?.id,
          project_instructions: currentProject?.instructions,
        })
      );
    },
    [addActionEvent, activeMode, currentProject]
  );

  const handleTakeOver = useCallback(() => {
    setIsVncControlled(true);
    setRightPanelView("vnc");
    addActionEvent("🎮", "Taking control", "You are now in control");
  }, [addActionEvent]);

  const handleReturnControl = useCallback(() => {
    setIsVncControlled(false);
    addActionEvent("🔙", "Returned control", "Agent is back in control");
  }, [addActionEvent]);

  const handleSelectSession = useCallback(
    async (selectedSessionId: string) => {
      try {
        const res = await fetch(`/api/sessions/${selectedSessionId}`);
        if (res.ok) {
          const session = await res.json();
          setSessionId(selectedSessionId);
          setMessages(
            session.messages.map(
              (m: { role: string; content: string; timestamp: string }) => ({
                id: crypto.randomUUID(),
                role: m.role as "user" | "assistant",
                content: m.content,
                timestamp: new Date(m.timestamp),
              })
            )
          );
          setTasks(
            session.tasks.map(
              (t: { id: string; title: string; status: string }) => ({
                id: t.id,
                title: t.title,
                status: t.status as TaskItem["status"],
              })
            )
          );
          wsRef.current?.close();
          connect();
        }
      } catch {
        void 0;
      }
    },
    [connect]
  );

  const handleNewSession = useCallback(() => {
    setSessionId(crypto.randomUUID());
    setMessages([]);
    setTasks([]);
    setActionEvents([]);
    setTerminalLines([]);
    setScreenshot(null);
    setThought("");
    setCurrentStep(0);
    setFiles([]);
    wsRef.current?.close();
    connect();
  }, [connect]);

  const showWelcome = messages.length === 0;

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0b]">
      {showWelcome ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
          {/* Background gradient effects */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
          </div>

          {/* Header with settings */}
          <div className="absolute top-4 right-4 flex items-center gap-3">
            <SessionHistory
              currentSessionId={sessionId}
              onSelectSession={handleSelectSession}
              onNewSession={handleNewSession}
            />
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2.5 text-zinc-500 hover:text-white hover:bg-zinc-800/50 rounded-xl transition-all"
              title="Settings"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
          </div>

          {/* Logo */}
          <div className="relative mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center text-white text-2xl font-bold shadow-2xl shadow-purple-500/25 animate-glow-pulse">
              M
            </div>
            <div className="absolute -inset-1 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-2xl blur opacity-30 -z-10" />
          </div>

          {/* Main heading with typing effect */}
          <h1 className="text-5xl md:text-6xl font-semibold mb-4 text-center">
            <span className="bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              What can I do for you?
            </span>
          </h1>

          <p className="text-zinc-500 mb-12 text-center max-w-xl text-lg">
            I can browse the web, write code, analyze data, create documents,
            and execute complex tasks autonomously.
          </p>

          {/* Input field */}
          <div className="w-full max-w-2xl mb-12 relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-2xl opacity-0 group-hover:opacity-30 group-focus-within:opacity-50 blur transition-all duration-500" />
            <div className="relative flex items-center bg-zinc-900/80 border border-zinc-800 rounded-2xl overflow-hidden backdrop-blur-sm">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendMessage(input)}
                placeholder="Describe what you want me to do..."
                className="flex-1 px-6 py-4 bg-transparent text-white placeholder-zinc-600 focus:outline-none text-lg"
                disabled={!isConnected}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!isConnected || !input.trim()}
                className="m-2 px-6 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-400 hover:to-purple-500 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Start
              </button>
            </div>
          </div>

          {/* Task template cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl w-full mb-8">
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                onClick={() => sendMessage(s.prompt)}
                disabled={!isConnected}
                className="task-card text-left p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700 hover:bg-zinc-800/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative">
                  <span className="text-2xl mb-3 block group-hover:scale-110 transition-transform duration-300">
                    {s.icon}
                  </span>
                  <span className="text-white font-medium block mb-1">
                    {s.title}
                  </span>
                  <span className="text-zinc-500 text-sm">{s.description}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Status indicator */}
          <div className="flex items-center gap-2 text-sm">
            <div
              className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`}
            />
            <span className="text-zinc-600">
              {isConnected ? "Ready to assist" : "Connecting..."}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {showProjects && (
            <div className="w-[240px] flex-shrink-0">
              <ProjectsPanel
                currentProjectId={currentProject?.id || null}
                onSelectProject={setCurrentProject}
                onNewChat={projectId => {
                  handleNewSession();
                  if (projectId) {
                    const proj =
                      currentProject?.id === projectId ? currentProject : null;
                    if (proj) setCurrentProject(proj);
                  }
                }}
              />
            </div>
          )}

          <div className="w-[420px] border-r border-zinc-800/50 flex flex-col bg-zinc-900/20">
            <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center justify-between bg-zinc-900/30">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowProjects(!showProjects)}
                  className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800/50 rounded-xl transition-all"
                  title={showProjects ? "Hide projects" : "Show projects"}
                >
                  {showProjects ? "◀" : "📁"}
                </button>
                <SessionHistory
                  currentSessionId={sessionId}
                  onSelectSession={handleSelectSession}
                  onNewSession={handleNewSession}
                />
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={activeMode}
                  onChange={e =>
                    setActiveMode(
                      e.target.value as "adaptive" | "chat" | "agent"
                    )
                  }
                  className="px-3 py-1.5 text-xs bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  title="Select mode"
                >
                  <option value="adaptive">🔀 Adaptive</option>
                  <option value="chat">💬 Chat Only</option>
                  <option value="agent">🤖 Agent Only</option>
                </select>
                {routedMode && (
                  <span
                    className={`px-2.5 py-1 text-xs rounded-xl font-medium ${
                      routedMode === "chat"
                        ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                        : "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                    }`}
                  >
                    {routedMode === "chat" ? "💬 Chat" : "🤖 Agent"}
                  </span>
                )}
                {currentProject && (
                  <span className="px-2.5 py-1 text-xs rounded-xl bg-green-500/20 text-green-400 border border-green-500/30 truncate max-w-[100px]">
                    📁 {currentProject.name}
                  </span>
                )}
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800/50 rounded-xl transition-all"
                  title="Settings"
                >
                  ⚙️
                </button>
                <button
                  onClick={handleNewSession}
                  className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white bg-zinc-800/30 hover:bg-zinc-700/50 border border-zinc-700/30 rounded-xl transition-all"
                >
                  + New
                </button>
              </div>
            </div>
            <ChatPanel
              messages={messages}
              input={input}
              onInputChange={setInput}
              onSend={() => sendMessage(input)}
              isConnected={isConnected}
              isProcessing={isProcessing}
            />
          </div>

          <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0a0b]">
            <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center justify-between bg-zinc-900/30">
              <div className="flex items-center gap-1">
                {[
                  { id: "browser", icon: "🖥️", label: "Browser" },
                  ...(vncUrl ? [{ id: "vnc", icon: "📺", label: "Live" }] : []),
                  { id: "files", icon: "📂", label: "Files" },
                  {
                    id: "terminal",
                    icon: "⌨️",
                    label: "Terminal",
                    badge: terminalLines.length || undefined,
                  },
                  { id: "code", icon: "📝", label: "Code" },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setRightPanelView(tab.id as RightPanelView);
                      if (tab.id === "files") fetchFiles(filePath);
                    }}
                    className={`px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 flex items-center gap-2 ${
                      rightPanelView === tab.id
                        ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white border border-blue-500/30"
                        : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                    }`}
                  >
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                    {tab.badge && (
                      <span className="px-1.5 py-0.5 bg-blue-500/30 text-blue-300 text-[10px] rounded-full">
                        {tab.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3">
                {isProcessing && (
                  <div className="flex items-center gap-4 px-4 py-2 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl animate-glow-breathe">
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <div className="w-2 h-2 bg-blue-500 rounded-full" />
                        <div className="absolute inset-0 w-2 h-2 bg-blue-500 rounded-full animate-ping" />
                      </div>
                      <span className="text-xs text-blue-300 font-medium">
                        LIVE
                      </span>
                    </div>
                    <div className="h-4 w-px bg-zinc-700" />
                    <div className="flex items-center gap-1.5">
                      <span className="text-zinc-500 text-xs">⏱️</span>
                      <span className="text-xs text-white font-mono telemetry-value">
                        {Math.floor(elapsedTime / 60)}:
                        {String(elapsedTime % 60).padStart(2, "0")}
                      </span>
                    </div>
                    <div className="h-4 w-px bg-zinc-700" />
                    <div className="flex items-center gap-1.5">
                      <span className="text-zinc-500 text-xs">📊</span>
                      <span className="text-xs text-white font-mono">
                        Step{" "}
                        <span className="text-blue-400">{currentStep}</span>/
                        {maxSteps}
                      </span>
                    </div>
                    <div className="h-4 w-px bg-zinc-700" />
                    <div className="flex items-center gap-1.5">
                      <span className="text-zinc-500 text-xs">🔧</span>
                      <span className="text-xs text-white font-mono">
                        <span className="text-purple-400">{toolsUsed}</span>{" "}
                        tools
                      </span>
                    </div>
                    <div className="h-4 w-px bg-zinc-700" />
                    <div className="flex items-center gap-1.5 max-w-[180px]">
                      <span className="text-xs text-zinc-400 truncate">
                        {currentAction}
                      </span>
                      <span className="thinking-dots text-blue-400">
                        <span>.</span>
                        <span>.</span>
                        <span>.</span>
                      </span>
                    </div>
                  </div>
                )}
                {vncUrl && !isVncControlled && (
                  <button
                    onClick={handleTakeOver}
                    className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white rounded-xl transition-all shadow-lg shadow-orange-500/20 hover:scale-105"
                  >
                    🎮 Take Over
                  </button>
                )}
                {isVncControlled && (
                  <button
                    onClick={handleReturnControl}
                    className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white rounded-xl transition-all shadow-lg shadow-green-500/20 hover:scale-105"
                  >
                    🔙 Return Control
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
              <div
                className={`flex-1 min-w-0 relative ${isProcessing ? "panel-processing" : ""}`}
              >
                {rightPanelView === "browser" && (
                  <div className="h-full">
                    <ComputerView
                      screenshot={screenshot}
                      browserUrl={browserUrl}
                      isLoading={isProcessing}
                      events={actionEvents}
                      currentStep={currentStep}
                      maxSteps={maxSteps}
                      thought={thought}
                      vncUrl={vncUrl}
                    />
                  </div>
                )}
                {rightPanelView === "vnc" && (
                  <div className="h-full p-4">
                    <div className="h-full rounded-2xl overflow-hidden border border-zinc-800/50 bg-zinc-900/30">
                      <VNCViewer
                        vncUrl={vncUrl}
                        isControlled={isVncControlled}
                        onTakeOver={handleTakeOver}
                        onReturnControl={handleReturnControl}
                      />
                    </div>
                  </div>
                )}
                {rightPanelView === "files" && (
                  <div className="h-full p-4">
                    <div className="h-full rounded-2xl overflow-hidden border border-zinc-800/50 bg-zinc-900/30 p-4">
                      <FileBrowser
                        sessionId={sessionId}
                        files={files}
                        currentPath={filePath}
                        onNavigate={path => {
                          setFilePath(path);
                          fetchFiles(path);
                        }}
                        onRefresh={() => fetchFiles(filePath)}
                        onOpenFile={path => {
                          setEditingFile(path);
                          setRightPanelView("code");
                        }}
                      />
                    </div>
                  </div>
                )}
                {rightPanelView === "terminal" && (
                  <div className="h-full p-4">
                    <div className="h-full rounded-2xl overflow-hidden border border-zinc-800/50 bg-black/50">
                      <TerminalPanel
                        lines={terminalLines}
                        onClear={() => setTerminalLines([])}
                      />
                    </div>
                  </div>
                )}
                {rightPanelView === "code" && (
                  <div className="h-full p-4">
                    <div className="h-full rounded-2xl overflow-hidden border border-zinc-800/50 bg-zinc-900/30">
                      <CodeEditor
                        sessionId={sessionId}
                        filePath={editingFile}
                        onClose={() => setRightPanelView("files")}
                      />
                    </div>
                  </div>
                )}
              </div>

              {tasks.length > 0 && (
                <div className="w-80 border-l border-zinc-800/50 p-4 bg-zinc-900/20">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    <h3 className="text-sm font-medium text-white">
                      Task Progress
                    </h3>
                  </div>
                  <TaskBreakdown tasks={tasks} currentTaskId={currentTaskId} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}

export default App;
