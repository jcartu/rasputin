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

type RightPanelView = "browser" | "vnc" | "files";

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

  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef(crypto.randomUUID());

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

  const fetchFiles = useCallback(async (path = "") => {
    try {
      const res = await fetch(
        `/api/sessions/${sessionIdRef.current}/files?path=${encodeURIComponent(path)}`
      );
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
        setFilePath(data.path || "");
      }
    } catch {}
  }, []);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/${sessionIdRef.current}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      addActionEvent("🔗", "Connected to server");
    };

    ws.onclose = () => {
      setIsConnected(false);
      addActionEvent("⚠️", "Disconnected", "Reconnecting...", "error");
      setTimeout(connect, 3000);
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
          }
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
  }, [addActionEvent, updateActionEvent, fetchFiles, filePath]);

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

      addActionEvent("📤", "Sending message", text.slice(0, 50) + "...");
      wsRef.current.send(JSON.stringify({ type: "message", content: text }));
    },
    [addActionEvent]
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

          <div className="flex items-center gap-2 text-sm">
            <div
              className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
            />
            <span className="text-zinc-500">
              {isConnected ? "Connected and ready" : "Connecting..."}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          <div className="w-[400px] border-r border-zinc-800 flex flex-col">
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
                      sessionId={sessionIdRef.current}
                      files={files}
                      currentPath={filePath}
                      onNavigate={path => {
                        setFilePath(path);
                        fetchFiles(path);
                      }}
                      onRefresh={() => fetchFiles(filePath)}
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
    </div>
  );
}

export default App;
