import Layout from "@/components/JarvisLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Brain,
  Code,
  Terminal,
  Shield,
  Eye,
  Activity,
  Layers,
} from "lucide-react";

export default function Agents() {
  const agents = [
    {
      name: "Orchestrator",
      icon: Brain,
      color: "text-purple-400",
      role: "System Controller",
      desc: "Routes requests, manages context, and handles user interaction. The 'Brain' of the operation.",
      tools: ["Context Manager", "Memory Retrieval", "User IO"],
    },
    {
      name: "Planner",
      icon: Layers,
      color: "text-blue-400",
      role: "Strategy & Decomposition",
      desc: "Breaks complex goals into executable DAGs (Directed Acyclic Graphs). Uses Frontier APIs for reasoning.",
      tools: [
        "Task Decomposition",
        "Dependency Mapping",
        "Resource Allocation",
      ],
    },
    {
      name: "Coder",
      icon: Code,
      color: "text-green-400",
      role: "Full-Stack Developer",
      desc: "Writes, debugs, and refactors code. Manages the entire software development lifecycle.",
      tools: [
        "File Operations",
        "LSP Integration",
        "Git Control",
        "Test Runner",
      ],
    },
    {
      name: "Executor",
      icon: Terminal,
      color: "text-orange-400",
      role: "Action Taker",
      desc: "Interacts with the OS and external services. Runs commands, manages processes, and handles I/O.",
      tools: ["Shell Execution", "Process Management", "Network Requests"],
    },
    {
      name: "Vision",
      icon: Eye,
      color: "text-cyan-400",
      role: "Perception Engine",
      desc: "Analyzes screen content and images. Provides 'eyes' for the desktop daemon.",
      tools: ["Screen Capture", "OCR", "Object Detection", "UI Analysis"],
    },
    {
      name: "Verifier",
      icon: Shield,
      color: "text-red-400",
      role: "Quality Assurance",
      desc: "Validates outcomes against success criteria. The 'Critic' that ensures quality.",
      tools: ["Output Validation", "Security Scanning", "Consistency Check"],
    },
    {
      name: "Learner",
      icon: Activity,
      color: "text-yellow-400",
      role: "Optimization & Memory",
      desc: "Analyzes execution logs to improve future performance. Updates Qdrant with new skills.",
      tools: ["Log Analysis", "Pattern Recognition", "Memory Consolidation"],
    },
  ];

  return (
    <Layout>
      <div className="space-y-10">
        <div className="space-y-4">
          <h1 className="text-3xl font-bold tracking-tight font-mono">
            3. Swarm Agent Specification
          </h1>
          <p className="text-lg text-muted-foreground">
            A coordinated fleet of 7 specialized agents working in parallel via
            Redis Streams.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent, i) => (
            <Card
              key={i}
              className="bg-card/50 border-border hover:border-primary/50 transition-colors"
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <agent.icon className={`h-8 w-8 ${agent.color}`} />
                  <Badge variant="outline" className="font-mono text-xs">
                    {agent.role}
                  </Badge>
                </div>
                <CardTitle className={`text-xl font-mono mt-4 ${agent.color}`}>
                  {agent.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground min-h-[60px]">
                  {agent.desc}
                </p>
                <div className="space-y-2">
                  <div className="text-xs font-mono uppercase text-muted-foreground">
                    Key Tools
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {agent.tools.map((tool, j) => (
                      <Badge
                        key={j}
                        variant="secondary"
                        className="text-xs bg-muted/50"
                      >
                        {tool}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <section className="space-y-6">
          <h2 className="text-2xl font-bold tracking-tight font-mono border-b border-border pb-2">
            3.2 Coordination Protocol
          </h2>
          <Card className="bg-black/30 border-border">
            <CardContent className="p-6 font-mono text-sm space-y-4">
              <div className="flex items-center gap-4">
                <Badge className="bg-purple-500/20 text-purple-400 hover:bg-purple-500/30">
                  Redis Streams
                </Badge>
                <span>
                  Primary communication bus. All events are immutable and
                  ordered.
                </span>
              </div>
              <div className="flex items-center gap-4">
                <Badge className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30">
                  Consumer Groups
                </Badge>
                <span>
                  Agents subscribe to relevant topics (e.g., `task.created`,
                  `code.written`).
                </span>
              </div>
              <div className="flex items-center gap-4">
                <Badge className="bg-green-500/20 text-green-400 hover:bg-green-500/30">
                  Anti-Thrash
                </Badge>
                <span>
                  Distributed locking prevents multiple agents from controlling
                  the mouse/keyboard simultaneously.
                </span>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </Layout>
  );
}
