/**
 * Webhook & Event System Page
 * Configure webhooks, triggers, and automated actions
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
  Webhook,
  Clock,
  Zap,
  Plus,
  Copy,
  ArrowLeft,
  Bell,
  RefreshCw,
  Send,
  CheckCircle,
  XCircle,
  Loader2,
  Play,
  FileJson,
} from "lucide-react";
import { Link } from "wouter";

// Sample webhook payloads
const samplePayloads = {
  github_push: {
    name: "GitHub Push",
    payload: {
      action: "push",
      repository: {
        full_name: "user/repo",
        clone_url: "https://github.com/user/repo.git",
      },
      sender: { login: "developer" },
      ref: "refs/heads/main",
      commits: [
        {
          id: "abc123",
          message: "Update README",
          author: { name: "Dev", email: "dev@example.com" },
        },
      ],
    },
  },
  alert: {
    name: "Alert",
    payload: {
      alertname: "HighCPU",
      status: "firing",
      severity: "warning",
      labels: { instance: "server-1", job: "node" },
      annotations: { summary: "CPU usage above 80%" },
    },
  },
  custom: {
    name: "Custom Event",
    payload: {
      event: "custom_event",
      data: { key: "value", timestamp: new Date().toISOString() },
      source: "test",
    },
  },
};

// Main component
export default function Events() {
  const [newWebhookName, setNewWebhookName] = useState("");
  const [newWebhookDesc, setNewWebhookDesc] = useState("");
  const [webhookDialogOpen, setWebhookDialogOpen] = useState(false);

  const [newCronName, setNewCronName] = useState("");
  const [newCronExpr, setNewCronExpr] = useState("");
  const [newCronDesc, setNewCronDesc] = useState("");
  const [cronDialogOpen, setCronDialogOpen] = useState(false);

  // Webhook testing state
  const [selectedWebhookId, setSelectedWebhookId] = useState<string>("");
  const [testPayload, setTestPayload] = useState(
    JSON.stringify(samplePayloads.custom.payload, null, 2)
  );
  const [testResult, setTestResult] = useState<{
    success: boolean;
    response?: string;
    error?: string;
  } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const webhooksQuery = trpc.events.listWebhooks.useQuery();
  const triggersQuery = trpc.events.listCronTriggers.useQuery();

  const createWebhookMutation = trpc.events.createWebhook.useMutation({
    onSuccess: () => {
      toast.success("Webhook created");
      setWebhookDialogOpen(false);
      setNewWebhookName("");
      setNewWebhookDesc("");
      webhooksQuery.refetch();
    },
    onError: err => {
      toast.error(`Failed to create webhook: ${err.message}`);
    },
  });

  const createCronMutation = trpc.events.createCronTrigger.useMutation({
    onSuccess: () => {
      toast.success("Cron trigger created");
      setCronDialogOpen(false);
      setNewCronName("");
      setNewCronExpr("");
      setNewCronDesc("");
      triggersQuery.refetch();
    },
    onError: err => {
      toast.error(`Failed to create cron trigger: ${err.message}`);
    },
  });

  const testWebhookMutation = trpc.events.testWebhook.useMutation({
    onSuccess: result => {
      setTestResult({
        success: true,
        response: JSON.stringify(result, null, 2),
      });
      setIsTesting(false);
      toast.success("Webhook test successful");
    },
    onError: err => {
      setTestResult({ success: false, error: err.message });
      setIsTesting(false);
      toast.error(`Webhook test failed: ${err.message}`);
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const handleTestWebhook = () => {
    if (!selectedWebhookId) {
      toast.error("Please select a webhook to test");
      return;
    }
    try {
      const payload = JSON.parse(testPayload);
      setIsTesting(true);
      setTestResult(null);
      testWebhookMutation.mutate({
        webhookId: parseInt(selectedWebhookId),
        payload,
      });
    } catch (e) {
      toast.error("Invalid JSON payload");
    }
  };

  const loadSamplePayload = (key: keyof typeof samplePayloads) => {
    setTestPayload(JSON.stringify(samplePayloads[key].payload, null, 2));
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
                <Bell className="w-6 h-6 text-cyan-400" />
                <h1 className="text-xl font-bold">Events & Webhooks</h1>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                webhooksQuery.refetch();
                triggersQuery.refetch();
              }}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container py-6">
        <Tabs defaultValue="webhooks" className="space-y-6">
          <TabsList className="bg-card/50">
            <TabsTrigger value="webhooks" className="flex items-center gap-2">
              <Webhook className="w-4 h-4" />
              Webhooks
            </TabsTrigger>
            <TabsTrigger value="testing" className="flex items-center gap-2">
              <Send className="w-4 h-4" />
              Test Webhooks
            </TabsTrigger>
            <TabsTrigger value="cron" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Cron Triggers
            </TabsTrigger>
          </TabsList>

          {/* Webhooks Tab */}
          <TabsContent value="webhooks" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Webhook Endpoints</h2>
              <Dialog
                open={webhookDialogOpen}
                onOpenChange={setWebhookDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button className="bg-cyan-600 hover:bg-cyan-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Webhook
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-background border-border">
                  <DialogHeader>
                    <DialogTitle>Create Webhook Endpoint</DialogTitle>
                    <DialogDescription>
                      Create a new webhook endpoint to receive external events
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Name</Label>
                      <Input
                        value={newWebhookName}
                        onChange={e => setNewWebhookName(e.target.value)}
                        placeholder="GitHub Events"
                      />
                    </div>
                    <div>
                      <Label>Description (optional)</Label>
                      <Textarea
                        value={newWebhookDesc}
                        onChange={e => setNewWebhookDesc(e.target.value)}
                        placeholder="Receives push events from GitHub..."
                        rows={2}
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={() =>
                        createWebhookMutation.mutate({
                          name: newWebhookName,
                          description: newWebhookDesc || undefined,
                        })
                      }
                      disabled={
                        !newWebhookName || createWebhookMutation.isPending
                      }
                    >
                      {createWebhookMutation.isPending
                        ? "Creating..."
                        : "Create Webhook"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {webhooksQuery.isLoading ? (
              <div className="animate-pulse">Loading webhooks...</div>
            ) : webhooksQuery.data?.length === 0 ? (
              <Card className="bg-card/30">
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No webhooks configured. Create one to get started.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {webhooksQuery.data?.map(webhook => (
                  <Card key={webhook.id} className="bg-card/30">
                    <CardContent className="py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Webhook className="w-5 h-5 text-cyan-400" />
                          <div>
                            <div className="font-medium">{webhook.name}</div>
                            <div className="text-sm text-muted-foreground font-mono flex items-center gap-2">
                              {webhook.path}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => copyToClipboard(webhook.path)}
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                        <Badge
                          variant={webhook.isEnabled ? "default" : "secondary"}
                        >
                          {webhook.isEnabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Webhook Testing Tab */}
          <TabsContent value="testing" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Test Input */}
              <Card className="bg-card/50 border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Send className="w-5 h-5 text-cyan-400" />
                    Test Webhook
                  </CardTitle>
                  <CardDescription>
                    Send a test payload to a webhook endpoint
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Webhook Selection */}
                  <div>
                    <Label>Select Webhook</Label>
                    <Select
                      value={selectedWebhookId}
                      onValueChange={setSelectedWebhookId}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Choose a webhook..." />
                      </SelectTrigger>
                      <SelectContent>
                        {webhooksQuery.data?.map(webhook => (
                          <SelectItem
                            key={webhook.id}
                            value={webhook.id.toString()}
                          >
                            {webhook.name} ({webhook.path})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Sample Payloads */}
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Sample Payloads
                    </Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {Object.entries(samplePayloads).map(([key, { name }]) => (
                        <Button
                          key={key}
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() =>
                            loadSamplePayload(
                              key as keyof typeof samplePayloads
                            )
                          }
                        >
                          {name}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Payload Input */}
                  <div>
                    <Label>JSON Payload</Label>
                    <Textarea
                      value={testPayload}
                      onChange={e => setTestPayload(e.target.value)}
                      placeholder='{"event": "test", "data": {}}'
                      rows={10}
                      className="mt-2 font-mono text-sm"
                    />
                  </div>

                  {/* Test Button */}
                  <Button
                    className="w-full bg-cyan-600 hover:bg-cyan-700"
                    onClick={handleTestWebhook}
                    disabled={!selectedWebhookId || isTesting}
                  >
                    {isTesting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Send Test Payload
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Test Results */}
              <Card className="bg-card/50 border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileJson className="w-5 h-5 text-cyan-400" />
                    Test Results
                  </CardTitle>
                  <CardDescription>
                    View the response from the webhook test
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isTesting ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Loader2 className="w-8 h-8 animate-spin mb-4 text-cyan-400" />
                      <p>Sending webhook...</p>
                    </div>
                  ) : testResult ? (
                    <div className="space-y-4">
                      {/* Status */}
                      <div className="flex items-center gap-2">
                        {testResult.success ? (
                          <CheckCircle className="w-5 h-5 text-green-400" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-400" />
                        )}
                        <span
                          className={
                            testResult.success
                              ? "text-green-400"
                              : "text-red-400"
                          }
                        >
                          {testResult.success
                            ? "Webhook Test Successful"
                            : "Webhook Test Failed"}
                        </span>
                      </div>

                      {/* Response/Error */}
                      <ScrollArea className="h-[300px] rounded-md border border-border/50 p-4">
                        <pre className="text-sm whitespace-pre-wrap font-mono">
                          {testResult.success
                            ? testResult.response
                            : testResult.error}
                        </pre>
                      </ScrollArea>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Zap className="w-8 h-8 mb-4 opacity-50" />
                      <p>No test results yet</p>
                      <p className="text-xs mt-2">
                        Send a test payload to see the response
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Cron Tab */}
          <TabsContent value="cron" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Cron Triggers</h2>
              <Dialog open={cronDialogOpen} onOpenChange={setCronDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-cyan-600 hover:bg-cyan-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Cron
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-background border-border">
                  <DialogHeader>
                    <DialogTitle>Create Cron Trigger</DialogTitle>
                    <DialogDescription>
                      Schedule recurring tasks with cron expressions
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Name</Label>
                      <Input
                        value={newCronName}
                        onChange={e => setNewCronName(e.target.value)}
                        placeholder="Daily Backup"
                      />
                    </div>
                    <div>
                      <Label>Cron Expression</Label>
                      <Input
                        value={newCronExpr}
                        onChange={e => setNewCronExpr(e.target.value)}
                        placeholder="0 0 * * *"
                        className="font-mono"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Format: minute hour day month weekday (e.g., "0 9 * *
                        1-5" for weekdays at 9am)
                      </p>
                    </div>
                    <div>
                      <Label>Description (optional)</Label>
                      <Textarea
                        value={newCronDesc}
                        onChange={e => setNewCronDesc(e.target.value)}
                        placeholder="What this trigger does..."
                        rows={2}
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={() =>
                        createCronMutation.mutate({
                          name: newCronName,
                          cronExpression: newCronExpr,
                          description: newCronDesc || undefined,
                        })
                      }
                      disabled={
                        !newCronName ||
                        !newCronExpr ||
                        createCronMutation.isPending
                      }
                    >
                      {createCronMutation.isPending
                        ? "Creating..."
                        : "Create Trigger"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {triggersQuery.isLoading ? (
              <div className="animate-pulse">Loading triggers...</div>
            ) : triggersQuery.data?.length === 0 ? (
              <Card className="bg-card/30">
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No cron triggers configured. Create one to get started.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {triggersQuery.data?.map(trigger => (
                  <Card key={trigger.id} className="bg-card/30">
                    <CardContent className="py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Clock className="w-5 h-5 text-cyan-400" />
                          <div>
                            <div className="font-medium">{trigger.name}</div>
                            <div className="text-sm text-muted-foreground font-mono">
                              {trigger.cronExpression}
                            </div>
                          </div>
                        </div>
                        <Badge
                          variant={trigger.isEnabled ? "default" : "secondary"}
                        >
                          {trigger.isEnabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
