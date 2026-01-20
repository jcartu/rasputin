import Layout from "@/components/JarvisLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";

export default function Implementation() {
  const phases = [
    {
      id: 1,
      title: "Foundation & Migration",
      status: "current",
      items: [
        "Migrate Rasputin tools to new repo",
        "Set up Qdrant & Redis infrastructure",
        "Implement basic Orchestrator agent",
        "Establish CI/CD pipeline"
      ]
    },
    {
      id: 2,
      title: "Desktop Daemon Alpha",
      status: "pending",
      items: [
        "Build Rust gRPC server",
        "Implement screen capture (DXGI)",
        "Implement input injection",
        "Basic security sandbox"
      ]
    },
    {
      id: 3,
      title: "Swarm Intelligence",
      status: "pending",
      items: [
        "Deploy Planner & Executor agents",
        "Implement Redis Streams bus",
        "Enable multi-agent consensus",
        "Connect Frontier APIs"
      ]
    },
    {
      id: 4,
      title: "Memory & Learning",
      status: "pending",
      items: [
        "Connect Qdrant episodic memory",
        "Implement skill acquisition loop",
        "Enable self-correction",
        "Long-term context testing"
      ]
    },
    {
      id: 5,
      title: "Full Autonomy (v3.0)",
      status: "pending",
      items: [
        "End-to-end web dev capabilities",
        "Full desktop takeover mode",
        "Production security audit",
        "Public release"
      ]
    }
  ];

  return (
    <Layout>
      <div className="space-y-10">
        <div className="space-y-4">
          <h1 className="text-3xl font-bold tracking-tight font-mono">7. Implementation Roadmap</h1>
          <p className="text-lg text-muted-foreground">
            A 5-phase execution plan to transform Rasputin into JARVIS v3.
          </p>
        </div>

        <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
          {phases.map((phase, i) => (
            <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
              
              {/* Icon */}
              <div className="flex items-center justify-center w-10 h-10 rounded-full border border-border bg-background shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                {phase.status === "done" ? (
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                ) : phase.status === "current" ? (
                  <div className="w-4 h-4 bg-primary rounded-full animate-pulse" />
                ) : (
                  <Circle className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              
              {/* Card */}
              <Card className={`w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-card/50 border-border transition-all hover:border-primary/50 ${phase.status === 'current' ? 'border-primary shadow-[0_0_15px_rgba(0,243,255,0.1)]' : ''}`}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <Badge variant="outline" className="font-mono mb-2">PHASE {phase.id}</Badge>
                    {phase.status === 'current' && <Badge className="bg-primary/20 text-primary hover:bg-primary/30">IN PROGRESS</Badge>}
                  </div>
                  <CardTitle className="text-xl font-mono">{phase.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {phase.items.map((item, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <ArrowRight className="h-4 w-4 mt-0.5 text-primary/50" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
