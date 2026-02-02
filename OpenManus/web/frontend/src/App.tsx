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
    icon: "🔍",
    title: "Search the web",
    prompt:
      "Search the web for the latest AI news and summarize the top stories",
  },
  {
    icon: "🌐",
    title: "Build website",
    prompt:
      "Create a simple HTML landing page for a coffee shop called 'Morning Brew'",
  },
  {
    icon: "📊",
    title: "Analyze data",
    prompt:
      "Create a Python script that generates a chart showing the Fibonacci sequence",
  },
  {
    icon: "📝",
    title: "Write code",
    prompt:
      "Write a Python function that checks if a string is a palindrome, with tests",
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
            addActionEvent("🧠", "Agent is thinking...", undefined, "running");
          } else if (data.data.state === "planning") {
            addActionEvent("📋", "Planning tasks...", undefined, "running");
          } else if (data.data.state === "routing") {
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
            data.data.reason
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

        case "thought":
          setThought(data.data.content);
          setMessages(prev => {
            const updated = [...prev];
            const lastMsg = updated[updated.length - 1];
            if (lastMsg && lastMsg.role === "assistant") {
              lastMsg.content = data.data.content;
              lastMsg.isThinking = false;
            }
            return updated;
          });
          addActionEvent(
            "💭",
            "Thinking",
            data.data.content.slice(0, 100) + "..."
          );
          break;

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
          addActionEvent(
            "❌",
            `${data.data.name} failed`,
            data.data.error,
            "error"
          );
          break;
        }

        case "files_updated":
          setFiles(data.data.files || []);
          addActionEvent("📂", "Files updated");
          break;

        case "terminal_output": {
          const line: TerminalLine = {
            id: crypto.randomUUID(),
            type: data.data.type as TerminalLine["type"],
            content: data.data.content,
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
          addActionEvent(
            "🎉",
            "Task completed",
            data.data.success ? "Successfully" : "With errors"
          );
          fetchFiles(filePath);
          break;

        case "error":
          setIsProcessing(false);
          addActionEvent("❌", "Error occurred", data.data.message, "error");
          break;

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
    <div className="h-screen flex flex-col bg-zinc-950">
      {showWelcome ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-4xl font-bold mb-6 shadow-lg shadow-blue-500/20">
            M
          </div>
          <h1 className="text-4xl font-semibold text-white mb-3">OpenManus</h1>
          <p className="text-zinc-400 mb-10 text-center max-w-lg text-lg">
            Your AI agent that can browse the web, write code, analyze data, and
            execute tasks autonomously.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl w-full mb-8">
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                onClick={() => sendMessage(s.prompt)}
                disabled={!isConnected}
                className="text-left p-5 rounded-xl bg-zinc-900/50 border border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <span className="text-3xl mb-3 block group-hover:scale-110 transition-transform">
                  {s.icon}
                </span>
                <span className="text-white font-medium">{s.title}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4 text-sm">
            <SessionHistory
              currentSessionId={sessionId}
              onSelectSession={handleSelectSession}
              onNewSession={handleNewSession}
            />
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-2 px-3 py-2 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 rounded-lg transition-colors"
            >
              <span>⚙️</span>
              <span className="text-zinc-300">Settings</span>
            </button>
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
              />
              <span className="text-zinc-500">
                {isConnected ? "Connected and ready" : "Connecting..."}
              </span>
            </div>
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

          <div className="w-[400px] border-r border-zinc-800 flex flex-col">
            <div className="px-4 py-2 border-b border-zinc-700/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowProjects(!showProjects)}
                  className="p-1 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded transition-colors"
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
                  className="px-2 py-1 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  title="Select mode"
                >
                  <option value="adaptive">🔀 Adaptive</option>
                  <option value="chat">💬 Chat Only</option>
                  <option value="agent">🤖 Agent Only</option>
                </select>
                {routedMode && (
                  <span
                    className={`px-2 py-1 text-xs rounded-lg ${
                      routedMode === "chat"
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-purple-500/20 text-purple-400"
                    }`}
                  >
                    {routedMode === "chat" ? "💬 Chat" : "🤖 Agent"}
                  </span>
                )}
                {currentProject && (
                  <span className="px-2 py-1 text-xs rounded-lg bg-green-500/20 text-green-400 truncate max-w-[100px]">
                    📁 {currentProject.name}
                  </span>
                )}
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                  title="Settings"
                >
                  ⚙️
                </button>
                <button
                  onClick={handleNewSession}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  + New Chat
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

          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 flex items-center gap-2">
              <button
                onClick={() => setRightPanelView("browser")}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  rightPanelView === "browser"
                    ? "bg-zinc-700 text-white"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                }`}
              >
                🖥️ Browser
              </button>
              {vncUrl && (
                <button
                  onClick={() => setRightPanelView("vnc")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    rightPanelView === "vnc"
                      ? "bg-zinc-700 text-white"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                  }`}
                >
                  📺 Live VNC
                </button>
              )}
              <button
                onClick={() => {
                  setRightPanelView("files");
                  fetchFiles(filePath);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  rightPanelView === "files"
                    ? "bg-zinc-700 text-white"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                }`}
              >
                📂 Files
              </button>
              <button
                onClick={() => setRightPanelView("terminal")}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  rightPanelView === "terminal"
                    ? "bg-zinc-700 text-white"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                }`}
              >
                ⌨️ Terminal
                {terminalLines.length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 bg-zinc-600 text-[10px] rounded-full">
                    {terminalLines.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setRightPanelView("code")}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  rightPanelView === "code"
                    ? "bg-zinc-700 text-white"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                }`}
              >
                📝 Code
              </button>
            </div>

            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 min-w-0">
                {rightPanelView === "browser" && (
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
                )}
                {rightPanelView === "vnc" && (
                  <div className="h-full p-3">
                    <VNCViewer
                      vncUrl={vncUrl}
                      isControlled={isVncControlled}
                      onTakeOver={handleTakeOver}
                      onReturnControl={handleReturnControl}
                    />
                  </div>
                )}
                {rightPanelView === "files" && (
                  <div className="h-full p-3">
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
                )}
                {rightPanelView === "terminal" && (
                  <div className="h-full p-3">
                    <TerminalPanel
                      lines={terminalLines}
                      onClear={() => setTerminalLines([])}
                    />
                  </div>
                )}
                {rightPanelView === "code" && (
                  <div className="h-full p-3">
                    <CodeEditor
                      sessionId={sessionId}
                      filePath={editingFile}
                      onClose={() => setRightPanelView("files")}
                    />
                  </div>
                )}
              </div>

              {tasks.length > 0 && (
                <div className="w-72 border-l border-zinc-800 p-3">
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
