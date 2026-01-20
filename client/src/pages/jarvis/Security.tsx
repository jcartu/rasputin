import Layout from "@/components/JarvisLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Shield, Lock, Eye, AlertTriangle, Key } from "lucide-react";

export default function Security() {
  return (
    <Layout>
      <div className="space-y-10">
        <div className="space-y-4">
          <h1 className="text-3xl font-bold tracking-tight font-mono">6. Security & Safety</h1>
          <p className="text-lg text-muted-foreground">
            A "Defense in Depth" approach to autonomous AI control.
          </p>
        </div>

        <Alert variant="destructive" className="bg-destructive/10 border-destructive/50 text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Core Principle</AlertTitle>
          <AlertDescription>
            Autonomous agents must never have unchecked root access. All privileged actions require explicit capability tokens.
          </AlertDescription>
        </Alert>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="bg-card/50 border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-mono text-primary">
                <Key className="h-5 w-5" /> Capability Tokens
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                Agents do not have inherent permissions. To perform sensitive actions (e.g., file write, network request), 
                an agent must request a short-lived <strong>Capability Token</strong> from the Orchestrator.
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Tokens expire after 5 minutes</li>
                <li>Tokens are scoped to specific resources (e.g., `/home/user/project/*`)</li>
                <li>Tokens are cryptographically signed</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-mono text-primary">
                <Eye className="h-5 w-5" /> Human-in-the-Loop
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                For high-risk actions, the system enforces a mandatory human approval step.
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong>Level 1 (Safe)</strong>: Read-only ops (Auto-approved)</li>
                <li><strong>Level 2 (Standard)</strong>: File writes in sandbox (Notify only)</li>
                <li><strong>Level 3 (Critical)</strong>: System config, payments, email (Require Approval)</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <section className="space-y-6">
          <h2 className="text-2xl font-bold tracking-tight font-mono border-b border-border pb-2">
            6.3 Sandboxing Architecture
          </h2>
          <div className="rounded-lg border border-border bg-black/50 p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded bg-card/30 border border-border">
                <Shield className="h-6 w-6 text-green-400" />
                <div>
                  <h3 className="font-bold font-mono text-green-400">Docker Containers</h3>
                  <p className="text-sm text-muted-foreground">All code execution happens in ephemeral, network-restricted containers.</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 p-4 rounded bg-card/30 border border-border">
                <Lock className="h-6 w-6 text-blue-400" />
                <div>
                  <h3 className="font-bold font-mono text-blue-400">gRPC Isolation</h3>
                  <p className="text-sm text-muted-foreground">The Desktop Daemon listens only on localhost with mTLS authentication.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
