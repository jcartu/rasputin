import Layout from "@/components/JarvisLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Architecture() {
  return (
    <Layout>
      <div className="space-y-10">
        <div className="space-y-4">
          <h1 className="text-3xl font-bold tracking-tight font-mono">
            2. System Architecture
          </h1>
          <p className="text-lg text-muted-foreground">
            A hybrid architecture combining local high-performance compute with
            frontier API reasoning.
          </p>
        </div>

        {/* High Level Diagram */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold tracking-tight font-mono border-b border-border pb-2">
            2.1 High-Level Overview
          </h2>
          <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-black/50">
            <img
              src="/images/architecture-diagram.jpg"
              alt="System Architecture Diagram"
              className="object-cover w-full h-full opacity-80 hover:opacity-100 transition-opacity duration-500"
            />
            <div className="absolute bottom-4 right-4">
              <Badge
                variant="outline"
                className="bg-black/80 backdrop-blur border-primary text-primary"
              >
                LIVE SCHEMATIC
              </Badge>
            </div>
          </div>
        </section>

        {/* Component Layers */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold tracking-tight font-mono border-b border-border pb-2">
            2.2 Component Layers
          </h2>

          <div className="grid gap-6 md:grid-cols-2">
            {/* User Layer */}
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader>
                <CardTitle className="font-mono text-blue-400">
                  User Interface Layer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  • <strong>Web UI (Next.js)</strong>: Primary control interface
                </p>
                <p>
                  • <strong>CLI Interface</strong>: For rapid developer access
                </p>
                <p>
                  • <strong>Voice Interface</strong>: Whisper + TTS for natural
                  interaction
                </p>
                <p>
                  • <strong>Desktop Overlay</strong>: Electron-based HUD for
                  screen context
                </p>
              </CardContent>
            </Card>

            {/* Swarm Layer */}
            <Card className="border-l-4 border-l-purple-500">
              <CardHeader>
                <CardTitle className="font-mono text-purple-400">
                  Agent Swarm Layer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  • <strong>Planner</strong>: Task decomposition & strategy
                </p>
                <p>
                  • <strong>Coder</strong>: Full-stack development specialist
                </p>
                <p>
                  • <strong>Executor</strong>: System actions & tool use
                </p>
                <p>
                  • <strong>Verifier</strong>: Testing & QA validation
                </p>
              </CardContent>
            </Card>

            {/* Infrastructure */}
            <Card className="border-l-4 border-l-green-500">
              <CardHeader>
                <CardTitle className="font-mono text-green-400">
                  Core Infrastructure
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  • <strong>Redis Streams</strong>: High-speed event bus (1-5ms)
                </p>
                <p>
                  • <strong>Qdrant</strong>: Vector memory for episodic recall
                </p>
                <p>
                  • <strong>PostgreSQL</strong>: Structured relational data
                </p>
                <p>
                  • <strong>MinIO/S3</strong>: Artifact storage
                </p>
              </CardContent>
            </Card>

            {/* Local GPU */}
            <Card className="border-l-4 border-l-orange-500">
              <CardHeader>
                <CardTitle className="font-mono text-orange-400">
                  Local GPU Services (96GB)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  • <strong>VisionLM</strong>: Qwen2-VL (24GB) for screen
                  understanding
                </p>
                <p>
                  • <strong>CodeLM</strong>: DeepSeek-Coder (32GB) for local dev
                </p>
                <p>
                  • <strong>ImageGen</strong>: FLUX (20GB) for asset creation
                </p>
                <p>
                  • <strong>Embeddings</strong>: BGE-M3 (4GB) for RAG
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Data Flow */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold tracking-tight font-mono border-b border-border pb-2">
            2.3 Data Flow Pipeline
          </h2>
          <div className="rounded-lg border border-border bg-card p-6 font-mono text-sm space-y-4">
            <div className="flex items-center gap-4">
              <Badge variant="outline">1</Badge>
              <span>User submits task via Gateway</span>
            </div>
            <div className="h-4 border-l border-border ml-3" />
            <div className="flex items-center gap-4">
              <Badge variant="outline">2</Badge>
              <span>Orchestrator queries Qdrant for similar past episodes</span>
            </div>
            <div className="h-4 border-l border-border ml-3" />
            <div className="flex items-center gap-4">
              <Badge variant="outline">3</Badge>
              <span>
                Planner uses Frontier APIs (Claude/GPT) to generate DAG
              </span>
            </div>
            <div className="h-4 border-l border-border ml-3" />
            <div className="flex items-center gap-4">
              <Badge variant="outline">4</Badge>
              <span>
                Subtasks published to Redis Streams for parallel execution
              </span>
            </div>
            <div className="h-4 border-l border-border ml-3" />
            <div className="flex items-center gap-4">
              <Badge variant="outline">5</Badge>
              <span>Agents execute tools (Local GPU or Rasputin Core)</span>
            </div>
            <div className="h-4 border-l border-border ml-3" />
            <div className="flex items-center gap-4">
              <Badge variant="outline">6</Badge>
              <span>Verifier validates results against success criteria</span>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
