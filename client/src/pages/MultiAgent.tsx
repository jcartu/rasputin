/**
 * Multi-Agent Orchestration Page
 * Manage AI agents and their collaborative tasks
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Bot,
  Plus,
  RefreshCw,
  ArrowLeft,
  Users,
  Zap,
  MessageSquare,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Play,
  FileText,
} from "lucide-react";
import { Link } from "wouter";

// Agent type colors
const agentTypeColors: Record<string, string> = {
  orchestrator: "text-purple-400",
  coordinator: "text-purple-400",
  specialist: "text-cyan-400",
  worker: "text-green-400",
  code: "text-blue-400",
  research: "text-yellow-400",
  sysadmin: "text-red-400",
  data: "text-orange-400",
  custom: "text-gray-400",
};

// Task result type
interface TaskResult {
  success: boolean;
  finalOutput: string;
  subtaskResults: Map<
    number,
    { success: boolean; output: unknown; error?: string }
  >;
  totalTokensUsed: number;
  totalExecutionTimeMs: number;
}

// Main component
export default function MultiAgent() {
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentType, setNewAgentType] = useState("worker");
  const [newAgentPrompt, setNewAgentPrompt] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const [taskPrompt, setTaskPrompt] = useState("");
  const [_taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskResult, setTaskResult] = useState<TaskResult | null>(null);
  const [isRunningTask, setIsRunningTask] = useState(false);

  // Sample task templates
  const taskTemplates = [
    {
      name: "Research Task",
      prompt:
        "Research the latest developments in AI and summarize the key findings",
    },
    {
      name: "Code Review",
      prompt:
        "Review the codebase for potential security vulnerabilities and suggest improvements",
    },
    {
      name: "Data Analysis",
      prompt:
        "Analyze the system logs and identify any anomalies or performance issues",
    },
    {
      name: "System Check",
      prompt:
        "Check the health of all connected servers and report their status",
    },
  ];

  // Use correct method names: list, create, runTask, getMessages
  const agentsQuery = trpc.agents.list.useQuery();

  const createAgentMutation = trpc.agents.create.useMutation({
    onSuccess: () => {
      toast.success("Agent created");
      setDialogOpen(false);
      setNewAgentName("");
      setNewAgentType("worker");
      setNewAgentPrompt("");
      agentsQuery.refetch();
    },
    onError: (err: { message: string }) => {
      toast.error(`Failed to create agent: ${err.message}`);
    },
  });

  const runTaskMutation = trpc.agents.runTask.useMutation({
    onSuccess: result => {
      toast.success("Task completed");
      setTaskResult(result as unknown as TaskResult);
      setIsRunningTask(false);
      agentsQuery.refetch();
    },
    onError: (err: { message: string }) => {
      toast.error(`Task failed: ${err.message}`);
      setIsRunningTask(false);
    },
  });

  const handleRunTask = () => {
    if (!taskPrompt) return;
    setIsRunningTask(true);
    setTaskResult(null);
    runTaskMutation.mutate({ task: taskPrompt });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/chat">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <Users className="w-6 h-6 text-cyan-400" />
                <h1 className="text-xl font-bold">Multi-Agent System</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => agentsQuery.refetch()}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container py-6">
        <Tabs defaultValue="agents" className="space-y-6">
          <TabsList>
            <TabsTrigger value="agents" className="flex items-center gap-2">
              <Bot className="w-4 h-4" />
              Agents
            </TabsTrigger>
            <TabsTrigger value="tasks" className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Task Runner
            </TabsTrigger>
          </TabsList>

          {/* Agents Tab */}
          <TabsContent value="agents" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Bot className="w-5 h-5 text-cyan-400" />
                Available Agents ({agentsQuery.data?.length ?? 0})
              </h2>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Agent
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-background border-border">
                  <DialogHeader>
                    <DialogTitle>Create Agent</DialogTitle>
                    <DialogDescription>
                      Create a new specialized agent
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Name</Label>
                      <Input
                        value={newAgentName}
                        onChange={e => setNewAgentName(e.target.value)}
                        placeholder="Code Expert"
                      />
                    </div>
                    <div>
                      <Label>Type</Label>
                      <Select
                        value={newAgentType}
                        onValueChange={setNewAgentType}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="orchestrator">
                            Orchestrator
                          </SelectItem>
                          <SelectItem value="coordinator">
                            Coordinator
                          </SelectItem>
                          <SelectItem value="specialist">Specialist</SelectItem>
                          <SelectItem value="worker">Worker</SelectItem>
                          <SelectItem value="code">Code</SelectItem>
                          <SelectItem value="research">Research</SelectItem>
                          <SelectItem value="sysadmin">SysAdmin</SelectItem>
                          <SelectItem value="data">Data</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>System Prompt (optional)</Label>
                      <Textarea
                        value={newAgentPrompt}
                        onChange={e => setNewAgentPrompt(e.target.value)}
                        placeholder="You are a specialized agent that..."
                        rows={3}
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={() =>
                        createAgentMutation.mutate({
                          name: newAgentName,
                          type: newAgentType as
                            | "orchestrator"
                            | "coordinator"
                            | "specialist"
                            | "worker"
                            | "code"
                            | "research"
                            | "sysadmin"
                            | "data"
                            | "custom",
                          systemPrompt: newAgentPrompt || undefined,
                        })
                      }
                      disabled={!newAgentName || createAgentMutation.isPending}
                    >
                      {createAgentMutation.isPending
                        ? "Creating..."
                        : "Create Agent"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {agentsQuery.isLoading ? (
              <div className="animate-pulse">Loading agents...</div>
            ) : agentsQuery.data?.length === 0 ? (
              <Card className="bg-card/30">
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No agents created yet. Add one to get started.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {agentsQuery.data?.map(agent => (
                  <Card key={agent.id} className="bg-card/50 border-border/50">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Bot
                            className={`w-5 h-5 ${agentTypeColors[agent.agentType ?? "worker"] ?? "text-gray-400"}`}
                          />
                          <CardTitle className="text-lg">
                            {agent.name}
                          </CardTitle>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {agent.agentType}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {agent.currentGoal && (
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                          {agent.currentGoal}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <Badge
                          variant={
                            agent.status === "idle" ? "default" : "secondary"
                          }
                        >
                          {agent.status ?? "idle"}
                        </Badge>
                        <span>
                          Created{" "}
                          {new Date(agent.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Task Runner Tab */}
          <TabsContent value="tasks" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Task Input */}
              <Card className="bg-card/50 border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Play className="w-5 h-5 text-cyan-400" />
                    Run Multi-Agent Task
                  </CardTitle>
                  <CardDescription>
                    Describe a task for the multi-agent system to complete
                    collaboratively
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Task Templates */}
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Quick Templates
                    </Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {taskTemplates.map((template, idx) => (
                        <Button
                          key={idx}
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => setTaskPrompt(template.prompt)}
                        >
                          {template.name}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Task Input */}
                  <div>
                    <Label>Task Description</Label>
                    <Textarea
                      value={taskPrompt}
                      onChange={e => setTaskPrompt(e.target.value)}
                      placeholder="Describe what you want the agents to accomplish..."
                      rows={6}
                      className="mt-2"
                    />
                  </div>

                  {/* Run Button */}
                  <Button
                    className="w-full bg-cyan-600 hover:bg-cyan-700"
                    onClick={handleRunTask}
                    disabled={!taskPrompt || isRunningTask}
                  >
                    {isRunningTask ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Running Task...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        Run Task
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Task Results */}
              <Card className="bg-card/50 border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-cyan-400" />
                    Task Results
                  </CardTitle>
                  <CardDescription>
                    View the output from the multi-agent task execution
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isRunningTask ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Loader2 className="w-8 h-8 animate-spin mb-4 text-cyan-400" />
                      <p>Orchestrating agents...</p>
                      <p className="text-xs mt-2">
                        The orchestrator is planning and delegating subtasks
                      </p>
                    </div>
                  ) : taskResult ? (
                    <div className="space-y-4">
                      {/* Status */}
                      <div className="flex items-center gap-2">
                        {taskResult.success ? (
                          <CheckCircle className="w-5 h-5 text-green-400" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-400" />
                        )}
                        <span
                          className={
                            taskResult.success
                              ? "text-green-400"
                              : "text-red-400"
                          }
                        >
                          {taskResult.success
                            ? "Task Completed Successfully"
                            : "Task Failed"}
                        </span>
                      </div>

                      {/* Stats */}
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {(taskResult.totalExecutionTimeMs / 1000).toFixed(1)}s
                        </span>
                        <span>
                          {taskResult.totalTokensUsed.toLocaleString()} tokens
                        </span>
                      </div>

                      {/* Output */}
                      <ScrollArea className="h-[300px] rounded-md border border-border/50 p-4">
                        <pre className="text-sm whitespace-pre-wrap font-mono">
                          {taskResult.finalOutput}
                        </pre>
                      </ScrollArea>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <MessageSquare className="w-8 h-8 mb-4 opacity-50" />
                      <p>No task results yet</p>
                      <p className="text-xs mt-2">
                        Run a task to see the output here
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
