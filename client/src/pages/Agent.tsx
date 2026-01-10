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
  Download,
  Copy,
  Calculator,
  Image as ImageIcon,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Sparkles,
  Mic,
  MicOff,
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
} from "lucide-react";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import { WorkspaceIDE } from "@/components/WorkspaceIDE";
import { ToolOutputPreview } from "@/components/ToolOutputPreview";
import { HostsManager } from "@/components/HostsManager";
import { ApprovalBadge, ApprovalWorkflow } from "@/components/ApprovalWorkflow";
import { ExportMenu } from "@/components/ExportMenu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Types for JARVIS
interface ToolCall {
  id: string;
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  input?: string;
  output?: string;
  startTime?: number;
  endTime?: number;
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

// Tool status badge
function ToolStatusBadge({ status }: { status: ToolCall["status"] }) {
  const variants: Record<
    ToolCall["status"],
    { icon: React.ReactNode; className: string; label: string }
  > = {
    pending: {
      icon: <Clock className="h-3 w-3" />,
      className: "bg-muted text-muted-foreground",
      label: "Pending",
    },
    running: {
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      className: "bg-cyan-500/20 text-cyan-400",
      label: "Running",
    },
    completed: {
      icon: <CheckCircle2 className="h-3 w-3" />,
      className: "bg-green-500/20 text-green-400",
      label: "Done",
    },
    failed: {
      icon: <XCircle className="h-3 w-3" />,
      className: "bg-red-500/20 text-red-400",
      label: "Failed",
    },
  };
  const { icon, className, label } = variants[status];
  return (
    <Badge variant="outline" className={cn("gap-1 text-xs", className)}>
      {icon}
      {label}
    </Badge>
  );
}

// Tool call card with real-time updates
function ToolCallCard({ tool, isLive }: { tool: ToolCall; isLive?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const duration =
    tool.endTime && tool.startTime
      ? ((tool.endTime - tool.startTime) / 1000).toFixed(2)
      : null;

  return (
    <Card
      className={cn(
        "bg-background/50 border-border/50 transition-all",
        isLive &&
          tool.status === "running" &&
          "border-cyan-500/50 shadow-cyan-500/10 shadow-lg"
      )}
    >
      <CardContent className="p-3">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-2">
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <div
              className={cn(
                "p-1.5 rounded",
                tool.status === "running"
                  ? "bg-cyan-500/20 text-cyan-400"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {toolIcons[tool.name] || <Zap className="h-4 w-4" />}
            </div>
            <span className="font-mono text-sm">
              {tool.name.replace(/_/g, " ")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {duration && (
              <span className="text-xs text-muted-foreground">{duration}s</span>
            )}
            <ToolStatusBadge status={tool.status} />
          </div>
        </div>
        {expanded && (
          <div className="mt-3 space-y-2 pl-6">
            {tool.input && (
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-medium">
                    Input
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2"
                    onClick={e => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(tool.input || "");
                      toast.success("Copied to clipboard");
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <pre className="mt-1 p-2 rounded bg-muted/50 text-xs overflow-x-auto max-h-32">
                  {tool.input}
                </pre>
              </div>
            )}
            {tool.output && (
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-medium">
                    Output
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2"
                    onClick={e => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(tool.output || "");
                      toast.success("Copied to clipboard");
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
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Executing...</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Agent step component
function AgentStepView({
  step,
  isLive,
}: {
  step: AgentStep;
  isLive?: boolean;
}) {
  if (step.type === "thinking") {
    return (
      <div className="flex items-start gap-2 text-muted-foreground animate-in fade-in slide-in-from-left-2">
        <Brain
          className={cn(
            "h-4 w-4 mt-0.5",
            isLive ? "text-purple-400 animate-pulse" : "text-purple-400/50"
          )}
        />
        <p className="text-sm italic">{step.content}</p>
      </div>
    );
  }

  if (step.type === "tool" || step.type === "tool_call") {
    const toolCall: ToolCall = {
      id: step.id,
      name: step.tool || "unknown",
      status:
        step.status === "success"
          ? "completed"
          : step.status === "error"
            ? "failed"
            : step.status === "running"
              ? "running"
              : "pending",
      input: step.input,
      output: step.output,
    };
    return <ToolCallCard tool={toolCall} isLive={isLive} />;
  }

  return null;
}

// Message component
function AgentMessageView({
  message,
  isLive,
}: {
  message: AgentMessage;
  isLive?: boolean;
}) {
  const isUser = message.role === "user";

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
            {message.steps?.map((step, idx) => (
              <AgentStepView
                key={step.id}
                step={step}
                isLive={isLive && idx === message.steps!.length - 1}
              />
            ))}
            {message.content && (
              <div className="p-4 rounded-lg bg-muted/30 text-foreground prose prose-sm prose-invert max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-sm">
                  {message.content}
                </pre>
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

// Workspace tab component
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
                Create a persistent development environment for JARVIS.
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
            No workspaces yet. Create one to give JARVIS a persistent
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
                Set up a recurring task for JARVIS to execute automatically.
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
      md += `## JARVIS\n\n`;
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

  // Voice mode state
  const [voiceMode, setVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, _setIsSpeaking] = useState(false);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [_audioLevel, _setAudioLevel] = useState(0);
  const _mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const _audioChunksRef = useRef<Blob[]>([]);
  const _audioContextRef = useRef<AudioContext | null>(null);
  const _analyserRef = useRef<AnalyserNode | null>(null);
  const _audioElementRef = useRef<HTMLAudioElement | null>(null);

  const jarvisStream = useJarvisStream();
  const [useStreamingMode, setUseStreamingMode] = useState(true);

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
    { enabled: typeof currentTask?.id === "number" }
  );

  // Update currentTask with messages when they load
  useEffect(() => {
    if (selectedTaskMessages && typeof currentTask?.id === "number") {
      setCurrentTask(prev =>
        prev
          ? {
              ...prev,
              messages: selectedTaskMessages,
            }
          : null
      );
    }
  }, [selectedTaskMessages]);

  // Merge local and DB tasks
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
    })) || []),
  ].sort((a, b) => b.createdAt - a.createdAt);

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

  const handleExportTask = useCallback((task: AgentTask) => {
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

    const taskInput = input.trim();
    setInput("");
    setCurrentTask(null);
    jarvisStream.startTask(taskInput, user.id);
  }, [input, jarvisStream, user?.id]);

  const handleSubmitLegacy = useCallback(async () => {
    if (!input.trim() || isProcessing) return;

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
        query: input.trim(),
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
        task: input.trim(),
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
  }, [input, isProcessing, currentTask, jarvisExecute, refetchTasks]);

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
          <TabsList className="grid grid-cols-7 mx-4 mt-2">
            <TabsTrigger value="tasks" className="text-xs">
              Tasks
            </TabsTrigger>
            <TabsTrigger value="templates" className="text-xs">
              Templates
            </TabsTrigger>
            <TabsTrigger value="stats" className="text-xs">
              Stats
            </TabsTrigger>
            <TabsTrigger value="workspace" className="text-xs">
              <FolderOpen className="h-3 w-3" />
            </TabsTrigger>
            <TabsTrigger value="schedule" className="text-xs">
              <Calendar className="h-3 w-3" />
            </TabsTrigger>
            <TabsTrigger value="voice" className="text-xs">
              <Mic className="h-3 w-3" />
            </TabsTrigger>
            <TabsTrigger value="hosts" className="text-xs">
              <Server className="h-3 w-3" />
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
                      onClick={() => setCurrentTask(task)}
                      className="w-full text-left p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            "text-sm font-medium truncate flex-1 line-clamp-2",
                            currentTask?.id === task.id && "text-purple-400"
                          )}
                          title={task.title}
                        >
                          {task.title}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "ml-2 text-xs",
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
                            ? "awaiting approval"
                            : task.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
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
                                mode: "JARVIS Agent",
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
              <div className="text-center py-4">
                <div className="relative inline-block">
                  <div
                    className={cn(
                      "w-24 h-24 rounded-full flex items-center justify-center transition-all",
                      voiceMode ? "bg-purple-500/20 animate-pulse" : "bg-muted"
                    )}
                  >
                    {isListening ? (
                      <Mic className="h-10 w-10 text-red-400 animate-pulse" />
                    ) : isSpeaking ? (
                      <Volume2 className="h-10 w-10 text-purple-400 animate-pulse" />
                    ) : (
                      <Mic className="h-10 w-10 text-muted-foreground" />
                    )}
                  </div>
                  {voiceMode && (
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-background" />
                  )}
                </div>
                <h3 className="font-semibold mt-4 mb-2">Voice Mode</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {voiceMode
                    ? "Voice mode active - speak to JARVIS"
                    : "Enable voice for hands-free interaction"}
                </p>
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant={voiceMode ? "destructive" : "default"}
                    onClick={() => {
                      setVoiceMode(!voiceMode);
                      toast.success(
                        voiceMode ? "Voice mode disabled" : "Voice mode enabled"
                      );
                    }}
                  >
                    {voiceMode ? (
                      <>
                        <MicOff className="h-4 w-4 mr-2" />
                        Disable Voice
                      </>
                    ) : (
                      <>
                        <Mic className="h-4 w-4 mr-2" />
                        Enable Voice
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setVoiceMuted(!voiceMuted)}
                    className={voiceMuted ? "text-red-400" : ""}
                  >
                    {voiceMuted ? (
                      <VolumeX className="h-4 w-4" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
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
                          : "JARVIS will speak results automatically"
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
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Wake Word</span>
                  <Badge variant="outline">"Hey JARVIS"</Badge>
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
              <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                JARVIS
              </span>
            </div>
            <Badge
              variant="outline"
              className="text-purple-400 border-purple-400/50"
            >
              Agent Mode
            </Badge>
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
                    Review and approve commands that JARVIS wants to execute
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
          <div className="flex-1 flex">
            <ScrollArea className="flex-1 p-4">
              <div className="max-w-3xl mx-auto">
                <JarvisStreamView state={jarvisStream} autoSpeak={autoSpeak} />
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
            <div className="w-96 border-l border-border">
              <JarvisThinkingPanel state={jarvisStream} />
            </div>
          </div>
        ) : (
          <ScrollArea className="flex-1 p-4">
            {currentTask ? (
              <div className="max-w-4xl mx-auto space-y-6">
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
                        JARVIS is analyzing your request...
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
                <h2 className="text-2xl font-bold mb-2">Welcome to JARVIS</h2>
                <p className="text-muted-foreground max-w-md mb-6">
                  Your autonomous AI agent. I can browse the web, execute code,
                  generate images, and complete complex tasks.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl">
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
                </div>
              </div>
            )}
          </ScrollArea>
        )}

        {/* Input Area */}
        <div className="p-4 border-t border-border">
          <div className="max-w-4xl mx-auto">
            <div className="flex gap-2">
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
                placeholder="Give JARVIS a task... (e.g., 'Research the latest AI news and summarize')"
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
                  JARVIS will autonomously use tools to complete your task
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
    </div>
  );
}
