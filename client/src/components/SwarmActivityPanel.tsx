import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useSwarmEvents } from "@/hooks/useSwarmEvents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import {
  Users,
  Activity,
  CheckCircle2,
  Clock,
  Shield,
  Brain,
  Zap,
  ChevronUp,
  ChevronDown,
  Terminal,
  Search,
  BookOpen,
  Vote,
} from "lucide-react";
import { cn } from "@/lib/utils";

type AgentType =
  | "planner"
  | "coder"
  | "executor"
  | "verifier"
  | "researcher"
  | "learner"
  | "safety";

const AGENT_CONFIG: Record<
  string,
  { color: string; icon: any; label: string }
> = {
  planner: {
    color: "text-blue-400 border-blue-400/30 bg-blue-400/10",
    icon: Brain,
    label: "Planner",
  },
  coder: {
    color: "text-green-400 border-green-400/30 bg-green-400/10",
    icon: Terminal,
    label: "Coder",
  },
  executor: {
    color: "text-orange-400 border-orange-400/30 bg-orange-400/10",
    icon: Zap,
    label: "Executor",
  },
  verifier: {
    color: "text-purple-400 border-purple-400/30 bg-purple-400/10",
    icon: CheckCircle2,
    label: "Verifier",
  },
  researcher: {
    color: "text-cyan-400 border-cyan-400/30 bg-cyan-400/10",
    icon: Search,
    label: "Researcher",
  },
  learner: {
    color: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10",
    icon: BookOpen,
    label: "Learner",
  },
  safety: {
    color: "text-red-400 border-red-400/30 bg-red-400/10",
    icon: Shield,
    label: "Safety",
  },
};

export function SwarmActivityPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("agents");

  const { activeConsensus, recentActivity } = useSwarmEvents();

  const { data: metricsData } = trpc.jarvis.v3GetSwarmMetrics.useQuery(
    undefined,
    {
      refetchInterval: 2000,
    }
  );

  const { data: statusData } = trpc.jarvis.v3Status.useQuery(undefined, {
    refetchInterval: 5000,
  });

  const aggregatedMetrics = useMemo(() => {
    if (!metricsData?.agentMetrics) return null;

    let totalTasks = 0;
    let totalFailed = 0;
    let totalDuration = 0;
    let count = 0;

    Object.values(metricsData.agentMetrics).forEach((m: any) => {
      totalTasks += m.tasksCompleted;
      totalFailed += m.tasksFailed;
      if (m.avgDurationMs > 0) {
        totalDuration += m.avgDurationMs;
        count++;
      }
    });

    return {
      totalTasks,
      totalFailed,
      successRate:
        totalTasks > 0
          ? ((totalTasks / (totalTasks + totalFailed)) * 100).toFixed(1)
          : "100.0",
      avgDuration:
        count > 0 ? (totalDuration / count / 1000).toFixed(2) : "0.00",
    };
  }, [metricsData]);

  const currentGlobalTask = useMemo(() => {
    if (!statusData?.subsystems) return null;
    const coordinator = statusData.subsystems.find(
      s => s.name === "agentCoordinator"
    );
    return coordinator?.details?.currentTask as string | undefined;
  }, [statusData]);

  const activeAgentsList = useMemo(() => {
    const agents = metricsData?.activeAgents || [];
    const allTypes: AgentType[] = [
      "planner",
      "coder",
      "executor",
      "verifier",
      "researcher",
      "learner",
      "safety",
    ];

    return allTypes.map(type => {
      const active = agents.find((a: any) => a.type === type);
      const metrics = metricsData?.agentMetrics?.[type];
      return {
        type,
        status: active ? "busy" : "idle",
        currentTask: active?.currentTask,
        metrics: metrics || {
          tasksCompleted: 0,
          tasksFailed: 0,
          successRate: 1,
          avgDurationMs: 0,
        },
      };
    });
  }, [metricsData]);

  const consensusHistory = recentActivity.filter(
    e => e.type === "consensus_complete" || e.type === "vote"
  );

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="fixed bottom-4 right-4 w-[400px] z-50 flex flex-col items-end"
    >
      <CollapsibleTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-border shadow-lg mb-2 gap-2"
        >
          <Activity className="h-4 w-4 text-purple-500" />
          <span className="font-semibold">Swarm Activity</span>
          {metricsData?.activeAgents && metricsData.activeAgents.length > 0 && (
            <Badge
              variant="secondary"
              className="h-5 px-1.5 bg-purple-500/20 text-purple-400"
            >
              {metricsData.activeAgents.length} Active
            </Badge>
          )}
          {isOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <Card className="w-full border-border/60 shadow-xl bg-background/95 backdrop-blur-md">
          <CardHeader className="p-4 pb-2 border-b border-border/40">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-400" />
                V3 Swarm Status
              </CardTitle>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span
                  className={cn(
                    "flex items-center gap-1.5",
                    statusData?.overall === "healthy"
                      ? "text-green-400"
                      : "text-amber-400"
                  )}
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
                  </span>
                  {statusData?.overall || "Connecting..."}
                </span>
              </div>
            </div>
            {currentGlobalTask && (
              <div className="mt-2 text-xs bg-muted/40 p-2 rounded border border-border/40 truncate">
                <span className="font-semibold text-purple-400">
                  Current Task:{" "}
                </span>
                {currentGlobalTask}
              </div>
            )}
          </CardHeader>

          <CardContent className="p-0">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <div className="px-4 pt-2">
                <TabsList className="w-full grid grid-cols-3 bg-muted/30">
                  <TabsTrigger value="agents" className="text-xs">
                    Agents
                  </TabsTrigger>
                  <TabsTrigger value="metrics" className="text-xs">
                    Metrics
                  </TabsTrigger>
                  <TabsTrigger value="consensus" className="text-xs">
                    Consensus
                  </TabsTrigger>
                </TabsList>
              </div>

              <ScrollArea className="h-[350px] w-full">
                <div className="p-4">
                  <TabsContent value="agents" className="mt-0 space-y-3">
                    <div className="grid grid-cols-1 gap-2">
                      {activeAgentsList.map(agent => {
                        const config =
                          AGENT_CONFIG[agent.type] || AGENT_CONFIG.planner;
                        const Icon = config.icon;
                        const isBusy = agent.status === "busy";

                        return (
                          <div
                            key={agent.type}
                            className={cn(
                              "flex items-center justify-between p-2 rounded-lg border transition-all",
                              isBusy
                                ? "bg-muted/40 border-purple-500/30 shadow-sm"
                                : "bg-muted/10 border-transparent opacity-70 hover:opacity-100"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={cn("p-1.5 rounded-md", config.color)}
                              >
                                <Icon className="h-3.5 w-3.5" />
                              </div>
                              <div>
                                <div className="text-xs font-medium capitalize flex items-center gap-2">
                                  {agent.type}
                                  {isBusy && (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] h-4 px-1 py-0 border-purple-500/40 text-purple-400 animate-pulse"
                                    >
                                      BUSY
                                    </Badge>
                                  )}
                                </div>
                                {isBusy && agent.currentTask && (
                                  <div className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                                    {agent.currentTask}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="text-[10px] text-right text-muted-foreground">
                              <div>{agent.metrics.tasksCompleted} tasks</div>
                              <div>
                                {(agent.metrics.successRate * 100).toFixed(0)}%
                                success
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </TabsContent>

                  <TabsContent value="metrics" className="mt-0 space-y-4">
                    {aggregatedMetrics && (
                      <div className="grid grid-cols-2 gap-3">
                        <Card className="bg-muted/30 border-border/50">
                          <CardContent className="p-3 text-center">
                            <div className="text-2xl font-bold text-foreground">
                              {aggregatedMetrics.totalTasks}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Tasks Completed
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="bg-muted/30 border-border/50">
                          <CardContent className="p-3 text-center">
                            <div className="text-2xl font-bold text-green-400">
                              {aggregatedMetrics.successRate}%
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Success Rate
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="bg-muted/30 border-border/50">
                          <CardContent className="p-3 text-center">
                            <div className="text-2xl font-bold text-blue-400">
                              {aggregatedMetrics.avgDuration}s
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Avg Duration
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="bg-muted/30 border-border/50">
                          <CardContent className="p-3 text-center">
                            <div className="text-2xl font-bold text-red-400">
                              {aggregatedMetrics.totalFailed}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Failed Tasks
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}

                    <div className="space-y-3">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Performance Breakdown
                      </div>
                      {activeAgentsList.map(agent => {
                        const successRate = agent.metrics.successRate * 100;
                        const config = AGENT_CONFIG[agent.type];
                        return (
                          <div key={agent.type} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="capitalize">{agent.type}</span>
                              <span
                                className={
                                  successRate >= 90
                                    ? "text-green-400"
                                    : successRate >= 70
                                      ? "text-yellow-400"
                                      : "text-red-400"
                                }
                              >
                                {successRate.toFixed(0)}%
                              </span>
                            </div>
                            <Progress
                              value={successRate}
                              className={cn(
                                "h-1.5",
                                config.color.split(" ")[0]
                              )}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </TabsContent>

                  <TabsContent value="consensus" className="mt-0">
                    {Object.values(activeConsensus).length > 0 && (
                      <div className="mb-4 space-y-2">
                        <div className="text-xs font-medium text-purple-400 uppercase tracking-wider flex items-center gap-1">
                          <Activity className="h-3 w-3" /> Active Votes
                        </div>
                        {Object.values(activeConsensus).map(c => (
                          <Card
                            key={c.proposalId}
                            className="bg-purple-500/5 border-purple-500/20"
                          >
                            <CardContent className="p-3 space-y-2">
                              <div className="text-xs font-medium line-clamp-2">
                                {c.question}
                              </div>
                              <Progress
                                value={
                                  (c.votes.length / c.participantCount) * 100
                                }
                                className="h-1"
                              />
                              <div className="flex justify-between text-[10px] text-muted-foreground">
                                <span>{c.votes.length} votes</span>
                                <span>Target: {c.participantCount}</span>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                        <Clock className="h-3 w-3" /> History
                      </div>
                      {consensusHistory.length > 0 ? (
                        <div className="space-y-2">
                          {consensusHistory.slice(0, 10).map((event, i) => (
                            <div
                              key={`${event.timestamp}-${i}`}
                              className="text-xs p-2 rounded bg-muted/30 border border-border/50"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium capitalize text-purple-400">
                                  {event.type.replace("_", " ")}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {new Date(
                                    event.timestamp
                                  ).toLocaleTimeString()}
                                </span>
                              </div>
                              <div className="text-muted-foreground line-clamp-2">
                                {(event.data as any).decision ||
                                  (event.data as any).question ||
                                  (event.data as any).reasoning}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-xs text-muted-foreground">
                          <Vote className="h-8 w-8 mx-auto mb-2 opacity-20" />
                          No recent consensus activity
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </div>
              </ScrollArea>
            </Tabs>
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}
