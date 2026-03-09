/**
 * Workspace - Cyberpunk Real-Time System Monitor
 * 
 * A Manus-computer-inspired live view of everything happening on Rasputin.
 * Shows GPU utilization, service health, OpenClaw activity, live terminal feed,
 * and recent file changes — all streamed in real-time via WebSocket.
 */
import { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Cpu,
  HardDrive,
  Activity,
  Terminal,
  Wifi,
  WifiOff,
  Zap,
  Server,
  Brain,
  Eye,
  Code,
  FileCode,
  ChevronRight,
  MemoryStick,
  Thermometer,
  Clock,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useWorkspaceStream,
  type GpuInfo,
  type ServiceInfo,
  type SystemInfo,
  type OpenClawActivity,
  type TerminalLine,
  type FileActivity,
} from "@/hooks/useWorkspaceStream";

// ============================================================================
// Cyberpunk Color Palette
// ============================================================================
const COLORS = {
  neonCyan: "#00f0ff",
  neonPink: "#ff006e",
  neonGreen: "#39ff14",
  neonYellow: "#ffe600",
  neonOrange: "#ff6600",
  neonPurple: "#bf00ff",
  termGreen: "#4ade80",
  termRed: "#f87171",
  termYellow: "#fbbf24",
  termBlue: "#60a5fa",
  termDim: "#6b7280",
  bgDark: "#0a0a0f",
  bgCard: "#111118",
  bgCardHover: "#1a1a24",
  border: "#1e1e2e",
  borderGlow: "#00f0ff22",
};

// ============================================================================
// Utility Components
// ============================================================================

function GlowBar({ value, max, color, label, sublabel }: {
  value: number; max: number; color: string; label: string; sublabel?: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const barColor = pct > 90 ? COLORS.neonPink : pct > 70 ? COLORS.neonOrange : color;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-mono" style={{ color }}>{label}</span>
        <span className="font-mono text-muted-foreground">{sublabel || `${pct.toFixed(0)}%`}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: `${color}15` }}>
        <motion.div
          className="h-full rounded-full"
          style={{
            background: `linear-gradient(90deg, ${barColor}88, ${barColor})`,
            boxShadow: `0 0 8px ${barColor}66`,
          }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: "online" | "stopped" | "errored" | string }) {
  const color = status === "online" ? COLORS.neonGreen : status === "errored" ? COLORS.neonPink : COLORS.termYellow;
  return (
    <span className="relative flex h-2 w-2">
      {status === "online" && (
        <span
          className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
          style={{ backgroundColor: color }}
        />
      )}
      <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: color }} />
    </span>
  );
}

function ScanLine() {
  return (
    <motion.div
      className="absolute left-0 right-0 h-px pointer-events-none z-50"
      style={{ background: `linear-gradient(90deg, transparent, ${COLORS.neonCyan}44, transparent)` }}
      animate={{ top: ["0%", "100%"] }}
      transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
    />
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)}KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)}MB`;
  return `${(bytes / 1073741824).toFixed(1)}GB`;
}

function formatMB(mb: number): string {
  if (mb < 1024) return `${mb}MB`;
  return `${(mb / 1024).toFixed(1)}GB`;
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// ============================================================================
// Panel Components
// ============================================================================

function GpuPanel({ gpus }: { gpus: GpuInfo[] }) {
  return (
    <div className="space-y-4">
      {gpus.map((gpu) => (
        <div
          key={gpu.index}
          className="rounded-lg p-4 border relative overflow-hidden"
          style={{
            background: COLORS.bgCard,
            borderColor: COLORS.border,
          }}
        >
          {/* Subtle glow effect */}
          <div
            className="absolute inset-0 opacity-5 pointer-events-none"
            style={{
              background: `radial-gradient(ellipse at top right, ${gpu.index === 0 ? COLORS.neonCyan : COLORS.neonPurple}, transparent 70%)`,
            }}
          />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4" style={{ color: gpu.index === 0 ? COLORS.neonCyan : COLORS.neonPurple }} />
                <span className="font-mono text-sm font-bold" style={{ color: gpu.index === 0 ? COLORS.neonCyan : COLORS.neonPurple }}>
                  GPU{gpu.index}
                </span>
                <span className="text-xs text-muted-foreground font-mono">{gpu.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Thermometer className="h-3 w-3 text-muted-foreground" />
                <span className="font-mono text-xs" style={{
                  color: gpu.temperature > 80 ? COLORS.neonPink : gpu.temperature > 60 ? COLORS.neonOrange : COLORS.neonGreen,
                }}>
                  {gpu.temperature}°C
                </span>
                <Zap className="h-3 w-3 text-muted-foreground ml-1" />
                <span className="font-mono text-xs text-muted-foreground">{gpu.power}W</span>
              </div>
            </div>

            <GlowBar
              value={gpu.memUsed}
              max={gpu.memTotal}
              color={gpu.index === 0 ? COLORS.neonCyan : COLORS.neonPurple}
              label="VRAM"
              sublabel={`${formatMB(gpu.memUsed)} / ${formatMB(gpu.memTotal)}`}
            />

            <div className="mt-2">
              <GlowBar
                value={gpu.utilization}
                max={100}
                color={gpu.index === 0 ? COLORS.neonCyan : COLORS.neonPurple}
                label="COMPUTE"
                sublabel={`${gpu.utilization}%`}
              />
            </div>

            {gpu.models.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {gpu.models.map((model) => (
                  <Badge
                    key={model}
                    variant="outline"
                    className="font-mono text-[10px] px-2 py-0.5 border"
                    style={{
                      borderColor: `${gpu.index === 0 ? COLORS.neonCyan : COLORS.neonPurple}44`,
                      color: gpu.index === 0 ? COLORS.neonCyan : COLORS.neonPurple,
                      background: `${gpu.index === 0 ? COLORS.neonCyan : COLORS.neonPurple}08`,
                    }}
                  >
                    {model}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function SystemPanel({ system }: { system: SystemInfo | null }) {
  if (!system) return <div className="text-muted-foreground text-sm font-mono">Waiting for data...</div>;
  return (
    <div className="space-y-3 rounded-lg p-4 border" style={{ background: COLORS.bgCard, borderColor: COLORS.border }}>
      <div className="flex items-center gap-2 mb-2">
        <Server className="h-4 w-4" style={{ color: COLORS.neonGreen }} />
        <span className="font-mono text-sm font-bold" style={{ color: COLORS.neonGreen }}>SYSTEM</span>
        <span className="text-xs text-muted-foreground font-mono ml-auto">{system.uptime}</span>
      </div>
      <GlowBar value={system.cpuUsage} max={100} color={COLORS.neonGreen} label="CPU" sublabel={`${system.cpuUsage.toFixed(1)}%`} />
      <GlowBar value={system.memUsed} max={system.memTotal} color={COLORS.termBlue} label="RAM" sublabel={`${formatBytes(system.memUsed)} / ${formatBytes(system.memTotal)}`} />
      <GlowBar value={system.diskUsed} max={system.diskTotal} color={COLORS.neonYellow} label="DISK" sublabel={`${formatBytes(system.diskUsed)} / ${formatBytes(system.diskTotal)}`} />
      <div className="flex items-center gap-2 pt-1">
        <span className="text-[10px] font-mono text-muted-foreground">LOAD</span>
        {system.loadAvg.map((l, i) => (
          <span key={i} className="font-mono text-xs" style={{ color: l > 8 ? COLORS.neonPink : l > 4 ? COLORS.neonOrange : COLORS.neonGreen }}>
            {l.toFixed(2)}
          </span>
        ))}
      </div>
    </div>
  );
}

function ServicesPanel({ services }: { services: ServiceInfo[] }) {
  const sorted = useMemo(() =>
    [...services].sort((a, b) => {
      if (a.status !== b.status) return a.status === "online" ? -1 : 1;
      return a.name.localeCompare(b.name);
    }),
    [services]
  );
  return (
    <div className="rounded-lg border overflow-hidden" style={{ background: COLORS.bgCard, borderColor: COLORS.border }}>
      <div className="px-4 py-2 flex items-center gap-2 border-b" style={{ borderColor: COLORS.border }}>
        <Activity className="h-4 w-4" style={{ color: COLORS.neonCyan }} />
        <span className="font-mono text-sm font-bold" style={{ color: COLORS.neonCyan }}>SERVICES</span>
        <span className="text-xs text-muted-foreground font-mono ml-auto">
          {services.filter(s => s.status === "online").length}/{services.length} online
        </span>
      </div>
      <div className="divide-y" style={{ borderColor: `${COLORS.border}88` }}>
        {sorted.map((svc) => (
          <div
            key={svc.name}
            className="px-4 py-2 flex items-center gap-3 hover:bg-white/[0.02] transition-colors"
          >
            <StatusDot status={svc.status} />
            <span className="font-mono text-xs flex-1 truncate" style={{
              color: svc.status === "online" ? COLORS.neonGreen : svc.status === "errored" ? COLORS.neonPink : COLORS.termDim,
            }}>
              {svc.name}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground w-12 text-right">{svc.cpu}</span>
            <span className="font-mono text-[10px] text-muted-foreground w-16 text-right">{svc.memory}</span>
            <span className="font-mono text-[10px] text-muted-foreground w-10 text-right">{svc.uptime}</span>
            {svc.restarts > 0 && (
              <Badge variant="outline" className="font-mono text-[9px] px-1 py-0" style={{
                borderColor: svc.restarts > 10 ? `${COLORS.neonPink}66` : `${COLORS.neonOrange}44`,
                color: svc.restarts > 10 ? COLORS.neonPink : COLORS.neonOrange,
              }}>
                <RefreshCw className="h-2 w-2 mr-0.5" />{svc.restarts}
              </Badge>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function OpenClawPanel({ openclaw }: { openclaw: OpenClawActivity | null }) {
  if (!openclaw) return null;
  return (
    <div className="rounded-lg p-4 border relative overflow-hidden" style={{ background: COLORS.bgCard, borderColor: COLORS.border }}>
      <div className="absolute inset-0 opacity-5 pointer-events-none" style={{
        background: `radial-gradient(ellipse at bottom left, ${COLORS.neonPink}, transparent 70%)`,
      }} />
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="h-4 w-4" style={{ color: COLORS.neonPink }} />
          <span className="font-mono text-sm font-bold" style={{ color: COLORS.neonPink }}>OPENCLAW</span>
          {openclaw.thinking && (
            <motion.span
              className="text-[10px] font-mono px-2 py-0.5 rounded-full"
              style={{ background: `${COLORS.neonPink}22`, color: COLORS.neonPink }}
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              THINKING...
            </motion.span>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-mono">MODEL</span>
            <span className="font-mono text-xs" style={{ color: COLORS.neonCyan }}>{openclaw.model}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-mono">SESSION</span>
            <span className="font-mono text-xs text-muted-foreground">
              {openclaw.activeSession ? `${openclaw.activeSession.substring(0, 8)}...` : "none"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-mono">MESSAGES</span>
            <span className="font-mono text-xs" style={{ color: COLORS.neonGreen }}>{openclaw.messageCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-mono">COST</span>
            <span className="font-mono text-xs" style={{ color: COLORS.neonYellow }}>
              ${openclaw.cost.toFixed(4)}
            </span>
          </div>
          {openclaw.lastMessage && (
            <div className="mt-2 p-2 rounded text-[11px] font-mono leading-relaxed" style={{
              background: `${COLORS.neonPink}08`,
              color: COLORS.termDim,
              borderLeft: `2px solid ${COLORS.neonPink}44`,
            }}>
              {openclaw.lastMessage.substring(0, 150)}
              {openclaw.lastMessage.length > 150 && "..."}
            </div>
          )}
          {openclaw.lastMessageTime > 0 && (
            <div className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              {timeAgo(openclaw.lastMessageTime)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TerminalPanel({ lines }: { lines: TerminalLine[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState<"all" | "error" | "gateway">("all");

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines, autoScroll]);

  const filtered = useMemo(() => {
    if (filter === "all") return lines;
    if (filter === "error") return lines.filter(l => l.level === "error" || l.level === "warn");
    return lines.filter(l => l.source === filter);
  }, [lines, filter]);

  const levelColor = (level: string) => {
    switch (level) {
      case "error": return COLORS.termRed;
      case "warn": return COLORS.termYellow;
      case "debug": return COLORS.termDim;
      default: return COLORS.termGreen;
    }
  };

  const sourceColor = (source: string) => {
    switch (source) {
      case "gateway": return COLORS.neonCyan;
      case "openclaw": return COLORS.neonPink;
      case "gpu": return COLORS.neonPurple;
      default: return COLORS.termBlue;
    }
  };

  return (
    <div className="rounded-lg border overflow-hidden flex flex-col" style={{
      background: COLORS.bgDark,
      borderColor: COLORS.border,
      height: "100%",
      minHeight: 300,
    }}>
      {/* Terminal Header */}
      <div className="px-3 py-2 flex items-center gap-2 border-b" style={{ borderColor: COLORS.border, background: COLORS.bgCard }}>
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ background: COLORS.neonPink }} />
          <div className="w-3 h-3 rounded-full" style={{ background: COLORS.neonYellow }} />
          <div className="w-3 h-3 rounded-full" style={{ background: COLORS.neonGreen }} />
        </div>
        <Terminal className="h-3.5 w-3.5 ml-2" style={{ color: COLORS.neonGreen }} />
        <span className="font-mono text-xs" style={{ color: COLORS.neonGreen }}>NEURAL STREAM</span>
        <div className="ml-auto flex items-center gap-1">
          {(["all", "error", "gateway"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "font-mono text-[10px] px-2 py-0.5 rounded transition-colors",
                filter === f ? "text-white" : "text-muted-foreground hover:text-white"
              )}
              style={filter === f ? { background: `${COLORS.neonCyan}22`, color: COLORS.neonCyan } : {}}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Terminal Content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 space-y-0.5"
        style={{ fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace", fontSize: "11px" }}
        onScroll={(e) => {
          const el = e.currentTarget;
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
          setAutoScroll(atBottom);
        }}
      >
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <motion.span
              className="font-mono text-xs"
              style={{ color: COLORS.termDim }}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              Waiting for stream data...
            </motion.span>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filtered.map((line) => (
              <motion.div
                key={line.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.15 }}
                className="flex gap-2 leading-relaxed hover:bg-white/[0.02] px-1 rounded"
              >
                <span style={{ color: COLORS.termDim }} className="flex-shrink-0 select-none">
                  {new Date(line.timestamp).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
                <span style={{ color: sourceColor(line.source) }} className="flex-shrink-0 w-16 select-none">
                  [{line.source.toUpperCase().padEnd(7)}]
                </span>
                <span style={{ color: levelColor(line.level) }} className="break-all">
                  {line.content}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Terminal Footer */}
      <div className="px-3 py-1.5 border-t flex items-center justify-between" style={{ borderColor: COLORS.border, background: COLORS.bgCard }}>
        <span className="font-mono text-[10px] text-muted-foreground">
          {filtered.length} lines
        </span>
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className="font-mono text-[10px] px-2 py-0.5 rounded transition-colors"
          style={{
            color: autoScroll ? COLORS.neonGreen : COLORS.termDim,
            background: autoScroll ? `${COLORS.neonGreen}11` : "transparent",
          }}
        >
          {autoScroll ? "AUTO-SCROLL ON" : "AUTO-SCROLL OFF"}
        </button>
      </div>
    </div>
  );
}

function ActivityPanel({ activity }: { activity: FileActivity[] }) {
  return (
    <div className="rounded-lg border overflow-hidden" style={{ background: COLORS.bgCard, borderColor: COLORS.border }}>
      <div className="px-4 py-2 flex items-center gap-2 border-b" style={{ borderColor: COLORS.border }}>
        <FileCode className="h-4 w-4" style={{ color: COLORS.neonYellow }} />
        <span className="font-mono text-sm font-bold" style={{ color: COLORS.neonYellow }}>RECENT ACTIVITY</span>
        <span className="text-[10px] text-muted-foreground font-mono ml-auto">last 30min</span>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {activity.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-xs font-mono">No recent changes</div>
        ) : (
          activity.slice(0, 15).map((file, i) => (
            <div
              key={`${file.path}-${i}`}
              className="px-4 py-1.5 flex items-center gap-2 hover:bg-white/[0.02] transition-colors"
            >
              <Code className="h-3 w-3 flex-shrink-0" style={{ color: COLORS.neonYellow }} />
              <span className="font-mono text-[11px] truncate flex-1" style={{ color: COLORS.termGreen }}>
                {file.path}
              </span>
              {file.size !== undefined && (
                <span className="font-mono text-[10px] text-muted-foreground flex-shrink-0">
                  {formatBytes(file.size)}
                </span>
              )}
              <span className="font-mono text-[10px] text-muted-foreground flex-shrink-0">
                {timeAgo(file.timestamp)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Workspace Page
// ============================================================================

export default function Workspace() {
  const { gpus, services, system, openclaw, terminal, activity, connected } = useWorkspaceStream();
  const [activeView, setActiveView] = useState<"overview" | "terminal">("overview");

  return (
    <div className="min-h-screen relative" style={{ background: COLORS.bgDark }}>
      {/* Scanline effect */}
      <ScanLine />

      {/* Grid overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.015] z-0"
        style={{
          backgroundImage: `
            linear-gradient(${COLORS.neonCyan}22 1px, transparent 1px),
            linear-gradient(90deg, ${COLORS.neonCyan}22 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b backdrop-blur-xl" style={{
        borderColor: COLORS.border,
        background: `${COLORS.bgDark}dd`,
      }}>
        <div className="flex items-center justify-between px-4 md:px-6 h-14">
          <div className="flex items-center gap-3">
            <Link href="/chat">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5" style={{ color: COLORS.neonCyan }} />
              <h1 className="font-mono text-lg font-bold tracking-wider" style={{
                color: COLORS.neonCyan,
                textShadow: `0 0 20px ${COLORS.neonCyan}44`,
              }}>
                WORKSPACE
              </h1>
            </div>
            <Badge
              variant="outline"
              className="font-mono text-[10px]"
              style={{
                borderColor: connected ? `${COLORS.neonGreen}44` : `${COLORS.neonPink}44`,
                color: connected ? COLORS.neonGreen : COLORS.neonPink,
              }}
            >
              {connected ? (
                <><Wifi className="h-2.5 w-2.5 mr-1" /> LIVE</>
              ) : (
                <><WifiOff className="h-2.5 w-2.5 mr-1" /> OFFLINE</>
              )}
            </Badge>
          </div>

          <Tabs value={activeView} onValueChange={(v) => setActiveView(v as typeof activeView)}>
            <TabsList className="h-8" style={{ background: `${COLORS.bgCard}` }}>
              <TabsTrigger value="overview" className="font-mono text-xs h-6 data-[state=active]:text-white">
                <Activity className="h-3 w-3 mr-1" /> OVERVIEW
              </TabsTrigger>
              <TabsTrigger value="terminal" className="font-mono text-xs h-6 data-[state=active]:text-white">
                <Terminal className="h-3 w-3 mr-1" /> TERMINAL
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>

      {/* Content */}
      <div className="relative z-10">
        {activeView === "overview" ? (
          <div className="p-4 md:p-6">
            {/* Desktop: 3-column grid / Mobile: stacked */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
              {/* Left Column: GPU + System */}
              <div className="lg:col-span-4 space-y-4">
                <GpuPanel gpus={gpus} />
                <SystemPanel system={system} />
              </div>

              {/* Center Column: Terminal + Activity */}
              <div className="lg:col-span-5 space-y-4">
                <div style={{ height: "calc(100vh - 220px)", minHeight: 400 }}>
                  <TerminalPanel lines={terminal} />
                </div>
                <ActivityPanel activity={activity} />
              </div>

              {/* Right Column: Services + OpenClaw */}
              <div className="lg:col-span-3 space-y-4">
                <OpenClawPanel openclaw={openclaw} />
                <ServicesPanel services={services} />
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 md:p-6" style={{ height: "calc(100vh - 56px)" }}>
            <TerminalPanel lines={terminal} />
          </div>
        )}
      </div>
    </div>
  );
}
