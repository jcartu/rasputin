import Layout from "@/components/JarvisLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, X, Zap, Brain } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  return (
    <Layout>
      <div className="space-y-10">
        {/* Hero Section */}
        <section className="relative overflow-hidden rounded-xl border border-border bg-card p-8 md:p-12">
          <div className="absolute inset-0 z-0 opacity-20 bg-[url('/images/hero-bg.jpg')] bg-cover bg-center" />
          <div className="absolute inset-0 z-0 bg-gradient-to-r from-background via-background/90 to-transparent" />

          <div className="relative z-10 max-w-3xl space-y-4">
            <Badge
              variant="outline"
              className="border-primary text-primary font-mono"
            >
              v3.0.0-ALPHA
            </Badge>
            <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl font-mono">
              JARVIS <span className="text-primary">ULTIMATE</span>
            </h1>
            <p className="text-xl text-muted-foreground">
              The autonomous AI operating system designed to outperform MANUS,
              ChatGPT, and OpenCode. Powered by hybrid frontier intelligence and
              local 96GB VRAM execution.
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
              <Link href="/architecture">
                <Button size="lg" className="gap-2 font-mono">
                  VIEW ARCHITECTURE <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/research">
                <Button
                  size="lg"
                  variant="outline"
                  className="gap-2 font-mono border-cyan-500 text-cyan-500 hover:bg-cyan-950"
                >
                  RESEARCH CORE <Brain className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/daemon">
                <Button size="lg" variant="outline" className="gap-2 font-mono">
                  DESKTOP DAEMON <Zap className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Mission Statement */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold tracking-tight font-mono border-b border-border pb-2">
            1.1 Mission Statement
          </h2>
          <p className="leading-7 text-muted-foreground">
            JARVIS v3 transforms the existing Rasputin system from a capable AI
            assistant into the world's most powerful autonomous AI operating
            system. This specification details how to extend Rasputin's 83+
            existing tools with:
          </p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 pt-4">
            {[
              {
                title: "Desktop Daemon",
                desc: "Full OS control rivaling MANUS (screen capture, input injection, window management).",
              },
              {
                title: "Swarm Intelligence",
                desc: "Multi-agent coordination with anti-thrash consensus protocols.",
              },
              {
                title: "Episodic Memory",
                desc: "Qdrant-powered learning that improves with every interaction.",
              },
              {
                title: "Full-Stack Autonomy",
                desc: "End-to-end web application development and deployment.",
              },
              {
                title: "Hybrid Intelligence",
                desc: "Frontier APIs for reasoning, local GPU for perception and speed.",
              },
            ].map((item, i) => (
              <Card
                key={i}
                className="bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/50 transition-colors"
              >
                <CardHeader>
                  <CardTitle className="text-lg font-mono text-primary">
                    {item.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Competitive Analysis */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold tracking-tight font-mono border-b border-border pb-2">
            1.2 Competitive Advantage
          </h2>
          <div className="rounded-md border border-border overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 font-mono text-xs uppercase">
                <tr>
                  <th className="p-4">Capability</th>
                  <th className="p-4 text-muted-foreground">ChatGPT</th>
                  <th className="p-4 text-muted-foreground">MANUS</th>
                  <th className="p-4 text-muted-foreground">OpenCode</th>
                  <th className="p-4 text-primary font-bold bg-primary/10">
                    JARVIS v3
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  {
                    cap: "Frontier Reasoning",
                    gpt: true,
                    manus: false,
                    oc: true,
                    jarvis: "✅ Multi-model consensus",
                  },
                  {
                    cap: "Desktop Control",
                    gpt: false,
                    manus: true,
                    oc: false,
                    jarvis: "✅ Privileged daemon",
                  },
                  {
                    cap: "Code Generation",
                    gpt: true,
                    manus: false,
                    oc: true,
                    jarvis: "✅ With execution",
                  },
                  {
                    cap: "Multi-Agent Swarm",
                    gpt: false,
                    manus: false,
                    oc: false,
                    jarvis: "✅ 7 specialized agents",
                  },
                  {
                    cap: "Episodic Memory",
                    gpt: false,
                    manus: false,
                    oc: false,
                    jarvis: "✅ Qdrant learning",
                  },
                  {
                    cap: "Local GPU Inference",
                    gpt: false,
                    manus: false,
                    oc: false,
                    jarvis: "✅ 96GB VRAM",
                  },
                  {
                    cap: "Full Deployment",
                    gpt: false,
                    manus: false,
                    oc: "Partial",
                    jarvis: "✅ End-to-end",
                  },
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    <td className="p-4 font-medium">{row.cap}</td>
                    <td className="p-4">
                      {row.gpt ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <X className="h-4 w-4 text-red-500 opacity-50" />
                      )}
                    </td>
                    <td className="p-4">
                      {row.manus ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <X className="h-4 w-4 text-red-500 opacity-50" />
                      )}
                    </td>
                    <td className="p-4">
                      {row.oc === true ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : row.oc === false ? (
                        <X className="h-4 w-4 text-red-500 opacity-50" />
                      ) : (
                        <span className="text-yellow-500">{row.oc}</span>
                      )}
                    </td>
                    <td className="p-4 font-bold text-primary bg-primary/5">
                      {row.jarvis}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Hardware Specs */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold tracking-tight font-mono border-b border-border pb-2">
            1.3 Target Hardware
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="bg-card border-primary/20">
              <CardHeader>
                <CardTitle className="font-mono text-primary">
                  Compute Node
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 font-mono text-sm">
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">CPU</span>
                  <span>Intel Xeon (56 cores, 112 threads)</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">RAM</span>
                  <span>256GB DDR5 ECC</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">GPU</span>
                  <span className="text-primary font-bold">
                    NVIDIA RTX Pro 6000 (96GB)
                  </span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">Storage</span>
                  <span>2TB+ NVMe SSD (RAID 1)</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="font-mono">Core Principles</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  <li className="flex gap-2">
                    <span className="font-bold text-foreground">
                      1. EXTEND, DON'T REPLACE
                    </span>
                    Rasputin's 83+ tools remain the foundation.
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-foreground">
                      2. SPEED FIRST
                    </span>
                    Frontier APIs for reasoning, local GPU for perception.
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-foreground">
                      3. FAIL GRACEFULLY
                    </span>
                    Every component has fallbacks.
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-foreground">
                      4. LEARN CONTINUOUSLY
                    </span>
                    Every interaction improves the system.
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-foreground">
                      5. SECURE BY DEFAULT
                    </span>
                    Capability-based security, sandboxing, audit trails.
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </Layout>
  );
}
