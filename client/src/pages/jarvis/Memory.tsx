import Layout from "@/components/JarvisLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, HardDrive, FileJson } from "lucide-react";

export default function Memory() {
  return (
    <Layout>
      <div className="space-y-10">
        <div className="space-y-4">
          <h1 className="text-3xl font-bold tracking-tight font-mono">
            5. Memory Systems
          </h1>
          <p className="text-lg text-muted-foreground">
            A three-tier memory architecture combining hot cache, warm vector
            storage, and cold archival.
          </p>
        </div>

        {/* Memory Tiers */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="bg-card/50 border-red-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-mono text-red-400">
                <ZapIcon className="h-5 w-5" /> L1: Hot Memory
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Technology</span>
                <span className="font-mono">Redis</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Latency</span>
                <span className="font-mono text-green-400">&lt; 1ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Capacity</span>
                <span className="font-mono">~50MB</span>
              </div>
              <p className="pt-2 text-muted-foreground">
                Stores active context, screen state, and immediate task queue.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-orange-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-mono text-orange-400">
                <Database className="h-5 w-5" /> L2: Warm Memory
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Technology</span>
                <span className="font-mono">Qdrant</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Latency</span>
                <span className="font-mono text-green-400">~10ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Capacity</span>
                <span className="font-mono">~100GB</span>
              </div>
              <p className="pt-2 text-muted-foreground">
                Vector storage for episodic memory, skills, and code snippets.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-blue-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-mono text-blue-400">
                <HardDrive className="h-5 w-5" /> L3: Cold Memory
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Technology</span>
                <span className="font-mono">PostgreSQL / S3</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Latency</span>
                <span className="font-mono text-yellow-400">~50ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Capacity</span>
                <span className="font-mono">Unlimited</span>
              </div>
              <p className="pt-2 text-muted-foreground">
                Structured logs, full project files, and archival data.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Qdrant Schema */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold tracking-tight font-mono border-b border-border pb-2">
            5.2 Qdrant Collections
          </h2>
          <div className="rounded-lg border border-border bg-black p-4 font-mono text-sm overflow-x-auto">
            <div className="flex items-center gap-2 text-muted-foreground mb-4 border-b border-border/20 pb-2">
              <FileJson className="h-4 w-4" />
              <span>memory/schema.ts</span>
            </div>
            <pre className="text-blue-400">
              {`interface EpisodicMemory {
  id: string;
  vector: number[1536]; // OpenAI/BGE embedding
  payload: {
    timestamp: number;
    user_goal: string;
    actions_taken: Action[];
    outcome: "success" | "failure";
    reflection: string; // What was learned
    tags: string[];
  }
}

interface ProceduralMemory {
  id: string;
  vector: number[1536];
  payload: {
    skill_name: string;
    code_snippet: string;
    language: string;
    success_rate: number;
    execution_count: number;
  }
}`}
            </pre>
          </div>
        </section>
      </div>
    </Layout>
  );
}

function ZapIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}
