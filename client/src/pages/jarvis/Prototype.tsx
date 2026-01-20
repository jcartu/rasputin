import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Terminal,
  Cpu,
  Activity,
  Zap,
  Shield,
  MessageSquare,
  Mic,
  Send,
  Minimize2,
  Maximize2,
  ChevronRight,
  ChevronLeft,
  Brain,
  Layers,
  Code,
  Eye,
  Play,
  Wifi,
  WifiOff,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  StopCircle,
} from "lucide-react";
import { IntelligenceStream } from "@/components/IntelligenceStream";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useJarvisStream } from "@/hooks/useJarvisStream";
import { getSocket } from "@/lib/socket";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";

const TOOL_TO_AGENT: Record<string, string> = {
  web_search: "VIS",
  browse_url: "VIS",
  execute_python: "CODE",
  execute_javascript: "CODE",
  run_shell: "EXEC",
  read_file: "MEM",
  write_file: "MEM",
  list_files: "MEM",
  search_memory: "MEM",
  store_memory: "MEM",
  calculate: "CODE",
  http_request: "VIS",
  generate_image: "VIS",
  task_complete: "VER",
  create_rich_report: "CODE",
};

export default function Prototype() {
  const [, navigate] = useLocation();
  const { user, refresh: refreshAuth } = useAuth();
  const jarvis = useJarvisStream();

  const [logs, setLogs] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [isHudOpen, setIsHudOpen] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [gpuData, setGpuData] = useState<any[]>(() =>
    Array.from({ length: 60 }).map((_, i) => ({
      time: new Date(Date.now() - (60 - i) * 1000).toISOString(),
      load: Math.floor(Math.random() * 10) + 5,
      vram: Math.floor(Math.random() * 5) + 10,
    }))
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [isConnected, setIsConnected] = useState(false);
  const [isOverride, setIsOverride] = useState(false);

  const { data: systemStats } = trpc.localStats.get.useQuery(undefined, {
    refetchInterval: 2000,
  });

  const { data: taskHistory } = trpc.jarvis.listTasks.useQuery({ limit: 20 });

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
    if (systemStats) {
      setGpuData(prev => {
        const now = new Date();
        const time = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
        const gpuTotal = systemStats.gpu?.memoryTotalMb ?? 1;
        const gpuUsed = systemStats.gpu?.memoryUsedMb ?? 0;
        const load =
          systemStats.gpu?.utilizationPercent ??
          Math.floor(Math.random() * 30) + 20;
        const vram = Math.round((gpuUsed / gpuTotal) * 100);
        const newData = [...prev, { time, load, vram }];
        return newData.slice(-60);
      });
    }
  }, [systemStats]);

  // TTS Handler
  const speak = async (text: string) => {
    try {
      // Using a high-quality default voice ID since exact Rasputin ID wasn't found
      // Voice: "Josh" - deep, professional, authoritative
      const VOICE_ID = "TxGEqnHWrfWFTfGW9XjX";
      const API_KEY = "sk_dcd04145dad2fa39684fd10fe3973b56fe539614369e507f";

      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": API_KEY,
          },
          body: JSON.stringify({
            text,
            model_id: "eleven_turbo_v2",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
            },
          }),
        }
      );

      if (!response.ok) throw new Error("TTS failed");

      const blob = await response.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      audio.play();
    } catch (error) {
      console.error("TTS Error:", error);
    }
  };

  // Voice Command Handler
  const toggleListening = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }

    if (!("webkitSpeechRecognition" in window)) {
      alert("Voice command not supported in this browser.");
      return;
    }

    setIsListening(true);
    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setMessages(prev => [...prev, { role: "user", content: transcript }]);

      // Trigger demo response for specific keywords
      if (
        transcript.toLowerCase().includes("analyze") ||
        transcript.toLowerCase().includes("market")
      ) {
        runDemo();
      } else if (
        transcript.toLowerCase().includes("override") ||
        transcript.toLowerCase().includes("control")
      ) {
        setIsOverride(true);
        speak(
          "Manual override engaged. Establishing secure VNC tunnel to Rasputin server."
        );
      }
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [showStream, setShowStream] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [agentMetrics, setAgentMetrics] = useState<
    Record<string, { cpu: number; mem: number; net: number }>
  >({});

  const currentRunningTool = jarvis.steps.find(
    s => s.type === "tool" && s.tool?.status === "running"
  )?.tool?.name;

  const derivedActiveAgent = currentRunningTool
    ? TOOL_TO_AGENT[currentRunningTool] || "ORCH"
    : jarvis.isStreaming
      ? "ORCH"
      : null;

  useEffect(() => {
    if (derivedActiveAgent) {
      setActiveAgent(derivedActiveAgent);
    } else if (!jarvis.isStreaming) {
      setActiveAgent(null);
    }
  }, [derivedActiveAgent, jarvis.isStreaming]);

  useEffect(() => {
    const newLogs = jarvis.steps.map(step => {
      if (step.type === "tool" && step.tool) {
        const agentCode = TOOL_TO_AGENT[step.tool.name] || "EXEC";
        const statusSuffix =
          step.tool.status === "running"
            ? " [RUNNING]"
            : step.tool.status === "failed"
              ? " [FAILED]"
              : " [DONE]";
        return {
          agent: agentCode,
          msg: `${step.tool.name}${statusSuffix}`,
          type: step.tool.status === "failed" ? "error" : "exec",
        };
      }
      return {
        agent: "ORCH",
        msg: step.content?.slice(0, 100) || "Thinking...",
        type: "info",
      };
    });
    if (newLogs.length > 0) {
      setLogs(newLogs);
    }
  }, [jarvis.steps]);

  useEffect(() => {
    const interval = setInterval(() => {
      setAgentMetrics(prev => {
        const next = { ...prev };
        ["ORCH", "PLAN", "CODE", "VIS", "EXEC", "MEM", "VER", "SEC"].forEach(
          agent => {
            const isActive = activeAgent === agent;
            next[agent] = {
              cpu: isActive ? Math.random() * 40 + 50 : Math.random() * 10 + 2,
              mem: isActive
                ? Math.random() * 200 + 300
                : Math.random() * 50 + 100,
              net: isActive ? Math.random() * 50 + 10 : Math.random() * 2,
            };
          }
        );
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeAgent]);

  // Scenarios
  const scenarios = {
    bugfix: {
      name: "Bug Fix",
      prompt: "Scan my screen and find the bug in this Python script.",
      logs: [
        {
          agent: "Vision",
          msg: "Capturing screen (2560x1440)...",
          type: "vision",
        },
        {
          agent: "Vision",
          msg: "OCR processing: found 128 lines of code",
          type: "vision",
        },
        {
          agent: "Memory",
          msg: "Loading python_expert context...",
          type: "db",
        },
        {
          agent: "Planner",
          msg: "Identified infinite loop in line 42",
          type: "action",
        },
      ],
      response:
        "I found the issue. You have an infinite loop in the `while` condition on line 42 because `i` is never incremented.\n\nHere is the fixed code block:",
      speech:
        "I found the issue. You have an infinite loop in the while condition on line 42.",
      thinking: [
        "Scanning screen buffer...",
        "Parsing Python syntax tree...",
        "Detected logic error: infinite loop",
        "Generating fix...",
      ],
    },
    security: {
      name: "Global Cyber-Defense Audit",
      prompt: "Initiate global security sweep. Scan all subnets for anomalies.",
      logs: Array.from({ length: 50 }, (_, i) => ({
        agent: ["SEC", "NET", "SCAN", "AI"][i % 4],
        msg: `Scanning subnet 192.168.${i}.0/24... [${Math.floor(Math.random() * 100)}% COMPLETE]`,
        type: ["info", "check", "vision", "db"][i % 4],
      })),
      response:
        "Security sweep complete. Detected 3 anomalies in subnet 192.168.4.0/24. Isolating compromised nodes and patching firewall rules.",
      speech: "Security sweep complete. Anomalies detected and isolated.",
      thinking: [
        "Initializing NMAP scan...",
        "Analyzing packet headers...",
        "Cross-referencing CVE database...",
        "Deploying countermeasures...",
      ],
    },
    saas: {
      name: "Autonomous SaaS Deployment",
      prompt: "Build and deploy a full-stack SaaS app for 'CryptoTracker'.",
      logs: Array.from({ length: 50 }, (_, i) => ({
        agent: ["CODE", "EXEC", "TEST", "DEP"][i % 4],
        msg: `Compiling module core/v${i}... [SUCCESS]`,
        type: ["exec", "action", "success", "info"][i % 4],
      })),
      response:
        "SaaS deployment successful. 'CryptoTracker' is live at https://crypto-tracker.jarvis.ai. All unit tests passed (420/420).",
      speech: "SaaS deployment successful. Application is live.",
      thinking: [
        "Scaffolding React frontend...",
        "Configuring PostgreSQL schema...",
        "Running CI/CD pipeline...",
        "Verifying SSL certificates...",
      ],
    },
    market: {
      name: "Alpha-Centauri Market Arbitrage",
      prompt: "Execute high-frequency arbitrage across all major exchanges.",
      logs: Array.from({ length: 100 }, (_, i) => ({
        agent: ["TRADER", "QUANT", "EXEC", "RISK"][i % 4],
        msg: `Arbitrage opportunity: BTC/USD spread ${Math.random().toFixed(4)}% [EXECUTING]`,
        type: ["success", "info", "action", "db"][i % 4],
      })),
      response:
        "Arbitrage execution complete. Net profit: +4.20% ($12,450). Risk parameters maintained within 0.5% variance.",
      speech: "Arbitrage execution complete. Net profit positive.",
      thinking: [
        "Analyzing order books (Binance, Coinbase)...",
        "Calculating latency delta...",
        "Executing flash loan...",
        "Rebalancing portfolio...",
      ],
    },
  };

  const [selectedScenario, setSelectedScenario] =
    useState<keyof typeof scenarios>("bugfix");

  // Audio Synthesizer
  const playSound = (type: "type" | "alert" | "success" | "hover") => {
    const ctx = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === "type") {
      // High-tech typing click
      osc.type = "square";
      osc.frequency.setValueAtTime(800 + Math.random() * 200, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.05);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === "alert") {
      // Warning beep
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.linearRampToValueAtTime(880, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === "success") {
      // Positive chime
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1760, now + 0.2);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
    } else if (type === "hover") {
      // Subtle hover hum
      osc.type = "sine";
      osc.frequency.setValueAtTime(220, now);
      gain.gain.setValueAtTime(0.02, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    }
  };

  const handleSubmit = useCallback(() => {
    if (!input.trim() || !user) {
      if (!user) toast.error("Please sign in to use JARVIS");
      return;
    }
    jarvis.startTask(input, user.id);
    setShowStream(true);
    setActiveScenario("jarvis");
    setInput("");
  }, [input, user, jarvis]);

  const runDemo = () => {
    const scenario = scenarios[selectedScenario];
    if (user) {
      jarvis.startTask(scenario.prompt, user.id);
      setShowStream(true);
      setActiveScenario(selectedScenario);
    } else {
      toast.error("Please sign in to use JARVIS");
    }
  };

  return (
    <div className="fixed inset-0 bg-[#050505] text-foreground font-sans overflow-hidden selection:bg-cyan-500/30">
      {/* Background Grid */}
      <div className="absolute inset-0 z-0 pointer-events-none bg-[linear-gradient(to_right,#1a1a1a_1px,transparent_1px),linear-gradient(to_bottom,#1a1a1a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,#000_40%,transparent_100%)] opacity-20" />

      {/* Main Layout */}
      <div className="relative z-10 flex h-full">
        {/* Left Sidebar (Navigation) */}
        <div className="w-16 border-r border-white/10 flex flex-col items-center py-6 gap-6 bg-black/40 backdrop-blur-md">
          <div className="h-10 w-10 rounded-full bg-cyan-500/10 border border-cyan-500/50 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.3)]">
            <Terminal className="h-5 w-5 text-cyan-400" />
          </div>
          <nav className="flex flex-col gap-4">
            <NavIcon icon={MessageSquare} active />
            <NavIcon icon={Layers} />
            <NavIcon icon={Code} />
            <NavIcon icon={Shield} />
          </nav>
          <div className="mt-auto">
            <NavIcon icon={Zap} />
          </div>
        </div>

        {/* Center Stage (Chat/Work) */}
        <div className="flex-1 flex flex-col relative">
          {/* Header */}
          <header className="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-black/20 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-lg tracking-widest text-cyan-400">
                JARVIS v3
              </span>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] h-5 transition-colors duration-500",
                  isConnected
                    ? "border-green-500/30 text-green-500/70 bg-green-500/5"
                    : "border-yellow-500/30 text-yellow-500/70 bg-yellow-500/5"
                )}
              >
                {isConnected ? "CONNECTED" : "CONNECTING..."}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
              <div className="flex items-center gap-2">
                <Cpu className="h-3 w-3" />
                <span>GPU: {systemStats?.gpu?.utilizationPercent ?? 0}%</span>
              </div>
              <div className="flex items-center gap-2">
                <Activity className="h-3 w-3" />
                <span>
                  MEM: {((systemStats?.memory?.usedMb ?? 0) / 1024).toFixed(1)}/
                  {((systemStats?.memory?.totalMb ?? 0) / 1024).toFixed(0)}GB
                </span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="h-7 bg-black/50 border border-cyan-500/30 text-cyan-400 text-[10px] font-mono rounded px-2 outline-none"
                  value={selectedScenario}
                  onChange={e => setSelectedScenario(e.target.value as any)}
                >
                  {Object.entries(scenarios).map(([key, val]) => (
                    <option key={key} value={key}>
                      {val.name}
                    </option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs font-mono border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                  onClick={runDemo}
                >
                  ▶ RUN
                </Button>
              </div>
              <Button
                variant="destructive"
                size="sm"
                className="h-7 text-xs font-mono bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20"
                onClick={() => {
                  setIsOverride(!isOverride);
                  if (!isOverride)
                    speak(
                      "Manual override engaged. Establishing secure VNC tunnel."
                    );
                }}
              >
                {isOverride ? "DISCONNECT VNC" : "TAKE CONTROL"}
              </Button>
            </div>
          </header>

          {jarvis.isStreaming || jarvis.summary ? (
            <div className="absolute inset-0 z-10 bg-black/90 backdrop-blur-sm p-6 overflow-hidden mt-14 mb-24">
              <ScrollArea className="h-full">
                <div className="max-w-3xl mx-auto space-y-4">
                  {jarvis.exchanges.length > 0 && (
                    <div className="p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                      <div className="text-xs font-mono text-cyan-400 mb-2">
                        USER QUERY
                      </div>
                      <div className="text-sm text-white">
                        {
                          jarvis.exchanges[jarvis.exchanges.length - 1]
                            ?.userQuery
                        }
                      </div>
                    </div>
                  )}

                  {jarvis.steps.map((step, idx) => (
                    <div
                      key={step.id || idx}
                      className={cn(
                        "p-3 rounded-lg border animate-in fade-in slide-in-from-left-2",
                        step.type === "thinking"
                          ? "bg-purple-500/10 border-purple-500/20"
                          : step.tool?.status === "running"
                            ? "bg-cyan-500/10 border-cyan-500/30"
                            : step.tool?.status === "failed"
                              ? "bg-red-500/10 border-red-500/20"
                              : "bg-green-500/10 border-green-500/20"
                      )}
                    >
                      {step.type === "thinking" ? (
                        <div className="flex items-start gap-3">
                          <Brain className="h-4 w-4 text-purple-400 animate-pulse mt-0.5" />
                          <div className="text-sm text-purple-200/90">
                            {step.content || "Thinking..."}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            {step.tool?.status === "running" ? (
                              <Loader2 className="h-4 w-4 text-cyan-400 animate-spin" />
                            ) : step.tool?.status === "failed" ? (
                              <XCircle className="h-4 w-4 text-red-400" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-green-400" />
                            )}
                            <span className="font-mono text-sm text-white">
                              {step.tool?.name}
                            </span>
                            {step.tool?.durationMs && (
                              <span className="text-xs text-muted-foreground">
                                {(step.tool.durationMs / 1000).toFixed(2)}s
                              </span>
                            )}
                          </div>
                          {step.tool?.output && (
                            <pre className="text-xs text-muted-foreground bg-black/30 p-2 rounded overflow-x-auto max-h-32">
                              {step.tool.output.slice(0, 500)}
                              {step.tool.output.length > 500 && "..."}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {jarvis.summary && (
                    <div className="p-4 rounded-lg bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-purple-500/30">
                      <div className="text-xs font-mono text-purple-400 mb-2">
                        SYNTHESIS COMPLETE
                      </div>
                      <div className="text-sm text-white whitespace-pre-wrap">
                        {jarvis.summary}
                      </div>
                    </div>
                  )}

                  {jarvis.error && (
                    <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                      <div className="text-xs font-mono text-red-400 mb-2">
                        ERROR
                      </div>
                      <div className="text-sm text-red-300">{jarvis.error}</div>
                    </div>
                  )}
                </div>
              </ScrollArea>
              {!jarvis.isStreaming && (
                <div className="absolute bottom-4 right-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      jarvis.reset();
                      setShowStream(false);
                      setActiveScenario(null);
                    }}
                  >
                    Clear & New Task
                  </Button>
                </div>
              )}
            </div>
          ) : showStream && activeScenario && activeScenario !== "jarvis" ? (
            <div className="absolute inset-0 z-10 bg-black/90 backdrop-blur-sm p-6 overflow-hidden mt-14 mb-24">
              <IntelligenceStream
                scenario={activeScenario}
                onComplete={() => setActiveAgent(null)}
                onLog={log => {
                  setLogs(prev => [...prev, log]);
                  const agentMap: Record<string, string> = {
                    VISION: "VIS",
                    EXEC: "EXEC",
                    MEMORY: "MEM",
                    PLANNER: "PLAN",
                    SYSTEM: "ORCH",
                    SEC: "SEC",
                    NET: "SEC",
                    CODE: "CODE",
                    TEST: "VER",
                    DEP: "EXEC",
                  };
                  const gridCode = agentMap[log.agent] || "ORCH";
                  setActiveAgent(gridCode);
                  setTimeout(() => setActiveAgent(null), 800);
                }}
              />
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center flex-col text-muted-foreground opacity-50 pointer-events-none z-0 mt-14 mb-24">
              <Brain className="w-16 h-16 mb-4 animate-pulse text-cyan-500/50" />
              <p className="font-mono text-sm text-cyan-500/50 tracking-widest">
                AWAITING COMMAND INPUT
              </p>
            </div>
          )}

          {/* Chat Area - Hidden when stream is active */}
          <div className="flex-1" />

          {/* VNC Overlay */}
          {isOverride && (
            <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-300">
              <div className="w-[90%] h-[80%] bg-black border border-red-500/30 rounded-xl overflow-hidden shadow-[0_0_50px_rgba(239,68,68,0.2)] flex flex-col">
                <div className="h-10 bg-red-950/30 border-b border-red-500/20 flex items-center justify-between px-4">
                  <div className="flex items-center gap-2 text-red-400 font-mono text-xs tracking-widest">
                    <Shield className="h-3 w-3" />
                    SECURE VNC TUNNEL // ROOT ACCESS
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] text-red-400 hover:bg-red-500/20"
                    onClick={() => setIsOverride(false)}
                  >
                    TERMINATE SESSION
                  </Button>
                </div>
                <div className="flex-1 relative bg-[#1a1a1a] flex items-center justify-center">
                  <div className="text-center space-y-4">
                    <div className="h-16 w-16 border-2 border-red-500/50 rounded-full flex items-center justify-center mx-auto animate-pulse">
                      <Shield className="h-8 w-8 text-red-500" />
                    </div>
                    <div className="font-mono text-red-400 text-sm">
                      ESTABLISHING CONNECTION...
                    </div>
                    <div className="font-mono text-red-500/50 text-xs">
                      &gt; Handshake initiated
                      <br />
                      &gt; Authenticating root@rasputin
                      <br />
                      &gt; Decrypting video stream...
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="p-4 lg:p-6 lg:pb-8">
            <div className="max-w-3xl mx-auto relative">
              <div className="absolute inset-0 bg-cyan-500/5 blur-xl rounded-full" />
              <div className="relative bg-black/60 border border-white/10 rounded-xl flex items-center p-2 gap-2 shadow-2xl backdrop-blur-xl">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "transition-all duration-300",
                    isListening
                      ? "text-red-500 animate-pulse bg-red-500/10"
                      : "text-muted-foreground hover:text-cyan-400"
                  )}
                  onClick={toggleListening}
                >
                  <Mic className="h-5 w-5" />
                </Button>
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSubmit()}
                  placeholder="Command JARVIS..."
                  className="flex-1 bg-transparent border-none outline-none text-sm px-2 placeholder:text-muted-foreground/50"
                  disabled={jarvis.isStreaming}
                />
                {jarvis.isStreaming ? (
                  <Button
                    size="icon"
                    variant="destructive"
                    className="rounded-lg h-8 w-8"
                    onClick={() => jarvis.cancelTask()}
                  >
                    <StopCircle className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    className="bg-cyan-500 hover:bg-cyan-400 text-black rounded-lg h-8 w-8"
                    onClick={handleSubmit}
                    disabled={!input.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {jarvis.isStreaming && (
                <div className="mt-2 text-center">
                  <span className="text-xs font-mono text-cyan-400 animate-pulse">
                    ITERATION {jarvis.currentIteration}/{jarvis.maxIterations}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right HUD (The Hive) */}
        <div
          className={cn(
            "border-l border-white/10 bg-black/80 backdrop-blur-xl transition-all duration-300 flex flex-col shadow-2xl shadow-cyan-900/20",
            isHudOpen ? "w-[450px]" : "w-0 opacity-0 overflow-hidden"
          )}
        >
          {/* Header */}
          <div className="h-12 border-b border-white/10 flex items-center justify-between px-4 bg-black/40">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-cyan-400 animate-pulse" />
              <span className="font-mono font-bold text-xs tracking-[0.2em] text-cyan-100">
                HIVE TELEMETRY
              </span>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-mono">
              <span className="text-muted-foreground">UPTIME: 14:02:11</span>
              <div className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e]" />
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 ml-2"
                onClick={() => setIsHudOpen(false)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* 1. Active Swarm Grid */}
          <div className="p-4 border-b border-white/10 bg-black/20">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-mono text-muted-foreground tracking-widest">
                ACTIVE AGENTS
              </span>
              <span className="text-[10px] font-mono text-cyan-500">
                7/7 ONLINE
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {["ORCH", "PLAN", "CODE", "VIS", "EXEC", "MEM", "VER", "SEC"].map(
                agent => {
                  const isActive = activeAgent === agent;
                  return (
                    <div
                      key={agent}
                      className={cn(
                        "h-16 border rounded flex flex-col items-center justify-center gap-1 transition-all duration-200",
                        isActive
                          ? "border-cyan-500 bg-cyan-500/20 shadow-[0_0_20px_rgba(6,182,212,0.4)] scale-105 z-10"
                          : "border-white/5 bg-white/5 opacity-50 scale-100"
                      )}
                    >
                      <div
                        className={cn(
                          "h-1.5 w-1.5 rounded-full transition-colors duration-200",
                          isActive ? "bg-cyan-400 animate-ping" : "bg-white/20"
                        )}
                      />
                      <span
                        className={cn(
                          "text-[9px] font-mono font-bold transition-colors duration-200",
                          isActive ? "text-cyan-300" : "text-white/80"
                        )}
                      >
                        {agent}
                      </span>
                    </div>
                  );
                }
              )}
            </div>
          </div>

          {/* 2. Qdrant Memory Core */}
          <div className="p-4 border-b border-white/10 bg-black/20 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2 relative z-10">
              <span className="text-[10px] font-mono text-muted-foreground tracking-widest flex items-center gap-2">
                <Brain className="h-3 w-3" /> MEMORY CORE (QDRANT)
              </span>
              <span
                className={cn(
                  "text-[10px] font-mono transition-colors duration-300",
                  activeAgent === "MEM" ? "text-cyan-400" : "text-white/20"
                )}
              >
                {activeAgent === "MEM" ? "ACTIVE" : "STANDBY"}
              </span>
            </div>

            <div className="h-24 border border-white/5 bg-black/40 rounded relative overflow-hidden flex items-center justify-center">
              {/* Neural Data Stream Visualization */}
              <div className="absolute inset-0 flex items-center justify-center gap-1 opacity-20">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="w-1 h-full bg-white/5" />
                ))}
              </div>

              {/* Active State Visualization */}
              {activeAgent === "MEM" ? (
                <div className="relative z-10 w-full h-full flex items-center justify-center">
                  {/* Reading State (Cyan) */}
                  <div className="absolute inset-0 bg-cyan-500/5 animate-pulse" />
                  <div className="flex gap-1 h-12 items-end">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div
                        key={i}
                        className="w-2 bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)] animate-[bounce_1s_infinite]"
                        style={{
                          height: `${Math.random() * 100}%`,
                          animationDelay: `${i * 0.1}s`,
                        }}
                      />
                    ))}
                  </div>
                  <div className="absolute bottom-2 right-2 text-[9px] font-mono text-cyan-400">
                    RETRIEVING CONTEXT...
                  </div>
                </div>
              ) : activeAgent === "EXEC" ? (
                <div className="relative z-10 w-full h-full flex items-center justify-center">
                  {/* Writing State (Purple) */}
                  <div className="absolute inset-0 bg-purple-500/5 animate-pulse" />
                  <div className="flex gap-1 h-12 items-center">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div
                        key={i}
                        className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)] animate-ping"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                  <div className="absolute bottom-2 right-2 text-[9px] font-mono text-purple-400">
                    STORING VECTORS...
                  </div>
                </div>
              ) : (
                <div className="text-[10px] font-mono text-white/20">
                  NO ACTIVE OPERATIONS
                </div>
              )}
            </div>
          </div>

          {/* 3. Hyper-Stream Logs */}
          <div className="flex-1 overflow-hidden flex flex-col bg-black/90 relative">
            <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-black to-transparent z-10" />
            <ScrollArea
              className="flex-1 p-4 font-mono text-[10px] leading-tight"
              ref={scrollRef}
            >
              <div className="space-y-1.5">
                {logs.map((log, i) => (
                  <div
                    key={i}
                    className="flex gap-2 animate-in fade-in slide-in-from-left-2 duration-100 group hover:bg-white/5 p-0.5 rounded"
                  >
                    <span className="text-white/30 w-12 shrink-0 select-none">
                      {new Date().toLocaleTimeString([], {
                        hour12: false,
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                      .{Math.floor(Math.random() * 999)}
                    </span>
                    <div className="flex-1 break-all">
                      <span
                        className={cn(
                          "font-bold mr-2",
                          (log.agent === "ORCH" ||
                            log.agent === "Orchestrator") &&
                            "text-purple-400",
                          (log.agent === "PLAN" || log.agent === "Planner") &&
                            "text-blue-400",
                          (log.agent === "MEM" || log.agent === "Memory") &&
                            "text-yellow-400",
                          (log.agent === "VIS" || log.agent === "Vision") &&
                            "text-cyan-400",
                          (log.agent === "EXEC" || log.agent === "Executor") &&
                            "text-green-400",
                          (log.agent === "VER" || log.agent === "Verifier") &&
                            "text-orange-400",
                          log.agent === "CODE" && "text-amber-400",
                          log.agent === "SEC" && "text-red-400",
                          log.type === "error" && "text-red-400"
                        )}
                      >
                        [{log.agent?.toUpperCase?.() || "SYS"}]
                      </span>
                      <span
                        className={cn(
                          "text-white/70 group-hover:text-white transition-colors",
                          log.type === "error" && "text-red-300"
                        )}
                      >
                        {log.msg}
                      </span>
                    </div>
                  </div>
                ))}
                <div className="h-4 w-2 bg-cyan-500 animate-pulse mt-2" />
              </div>
            </ScrollArea>
          </div>

          {/* 4. Model Telemetry & Vitals */}
          <div className="h-80 border-t border-white/10 bg-black/40 p-4 space-y-3 flex flex-col">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-muted-foreground">
                SYSTEM VITALS
              </span>
              <span
                className={cn(
                  "text-[10px] font-mono",
                  jarvis.isStreaming
                    ? "text-cyan-400 animate-pulse"
                    : "text-purple-400"
                )}
              >
                {jarvis.isStreaming ? "JARVIS ACTIVE" : "STANDBY"}
              </span>
            </div>

            <div className="space-y-2">
              <div className="space-y-1">
                <div className="flex justify-between text-[9px] font-mono text-white/50">
                  <span>VRAM ({systemStats?.gpu?.count ?? 0}x GPU)</span>
                  <span>
                    {systemStats?.gpu?.memoryUsedMb
                      ? `${(systemStats.gpu.memoryUsedMb / 1024).toFixed(1)}/${(systemStats.gpu.memoryTotalMb / 1024).toFixed(0)}GB`
                      : `${gpuData[gpuData.length - 1]?.vram || 0}%`}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-500 transition-all duration-300"
                    style={{
                      width: `${gpuData[gpuData.length - 1]?.vram || 0}%`,
                    }}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[9px] font-mono text-white/50">
                  <span>GPU UTIL</span>
                  <span>
                    {systemStats?.gpu?.utilizationPercent ??
                      gpuData[gpuData.length - 1]?.load ??
                      0}
                    %
                  </span>
                </div>
                <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 transition-all duration-300"
                    style={{
                      width: `${systemStats?.gpu?.utilizationPercent ?? gpuData[gpuData.length - 1]?.load ?? 0}%`,
                    }}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[9px] font-mono text-white/50">
                  <span>CPU ({systemStats?.cpu?.cores ?? 0} cores)</span>
                  <span>{systemStats?.cpu?.loadPercent?.toFixed(0) ?? 0}%</span>
                </div>
                <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-500"
                    style={{ width: `${systemStats?.cpu?.loadPercent ?? 0}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Sparkline Graph */}
            <div className="flex-1 mt-2 relative border border-white/5 bg-black/20 rounded overflow-hidden">
              <div className="absolute inset-0 flex items-end">
                <svg
                  className="w-full h-full"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  {/* Grid Lines */}
                  <line
                    x1="0"
                    y1="25%"
                    x2="100%"
                    y2="25%"
                    stroke="rgba(255,255,255,0.05)"
                    strokeWidth="1"
                  />
                  <line
                    x1="0"
                    y1="50%"
                    x2="100%"
                    y2="50%"
                    stroke="rgba(255,255,255,0.05)"
                    strokeWidth="1"
                  />
                  <line
                    x1="0"
                    y1="75%"
                    x2="100%"
                    y2="75%"
                    stroke="rgba(255,255,255,0.05)"
                    strokeWidth="1"
                  />

                  {/* VRAM Path */}
                  <path
                    d={`M 0 ${100 - (gpuData[0]?.vram || 0)} ${gpuData.map((d, i) => `L ${(i / (gpuData.length - 1)) * 100} ${100 - d.vram}`).join(" ")}`}
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="1.5"
                    className="opacity-80"
                  />
                  {/* Load Path */}
                  <path
                    d={`M 0 ${100 - (gpuData[0]?.load || 0)} ${gpuData.map((d, i) => `L ${(i / (gpuData.length - 1)) * 100} ${100 - d.load}`).join(" ")}`}
                    fill="none"
                    stroke="#a855f7"
                    strokeWidth="1.5"
                    className="opacity-80"
                  />
                </svg>
              </div>
              <div className="absolute top-1 right-1 text-[8px] font-mono text-white/30">
                60s HISTORY
              </div>
            </div>
          </div>
        </div>

        {/* HUD Toggle (When Closed) */}
        {!isHudOpen && (
          <div className="absolute right-0 top-1/2 -translate-y-1/2">
            <Button
              variant="secondary"
              className="h-12 w-6 rounded-l-xl rounded-r-none border-r-0 p-0 bg-cyan-950/30 border-cyan-500/30 text-cyan-400 hover:bg-cyan-900/50"
              onClick={() => setIsHudOpen(true)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function NavIcon({ icon: Icon, active }: { icon: any; active?: boolean }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        "rounded-xl transition-all duration-200",
        active
          ? "bg-cyan-500/10 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.2)]"
          : "text-muted-foreground hover:text-cyan-200 hover:bg-white/5"
      )}
    >
      <Icon className="h-5 w-5" />
    </Button>
  );
}

function AgentStatus({ name, active }: { name: string; active?: boolean }) {
  return (
    <div
      className={cn(
        "h-8 rounded border flex items-center justify-center text-[10px] font-bold tracking-wider transition-all",
        active
          ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.15)]"
          : "bg-white/5 border-white/10 text-muted-foreground/50"
      )}
    >
      {name}
    </div>
  );
}
