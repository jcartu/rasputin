/**
 * Infrastructure Monitoring & Self-Healing Page
 * Monitor server health, view metrics, manage alerts
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Server,
  Activity,
  AlertTriangle,
  Plus,
  RefreshCw,
  ArrowLeft,
  Shield,
  Clock,
} from "lucide-react";
import { Link } from "wouter";

// Main component
export default function Infrastructure() {
  const [selectedHostId, setSelectedHostId] = useState<number | null>(null);

  const hostsQuery = trpc.infrastructure.listHosts.useQuery();
  const sshHostsQuery = trpc.ssh.listHosts.useQuery();
  const alertsQuery = trpc.infrastructure.getAlertRules.useQuery();
  const incidentsQuery = trpc.infrastructure.getIncidents.useQuery({
    status: "open",
  });

  const addHostMutation = trpc.infrastructure.addHost.useMutation({
    onSuccess: () => {
      toast.success("Host registered for monitoring");
      hostsQuery.refetch();
    },
    onError: (err: { message: string }) => {
      toast.error(`Failed to register host: ${err.message}`);
    },
  });

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
                <Server className="w-6 h-6 text-cyan-400" />
                <h1 className="text-xl font-bold">Infrastructure Monitoring</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  hostsQuery.refetch();
                  alertsQuery.refetch();
                  incidentsQuery.refetch();
                }}
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
        <Tabs defaultValue="hosts" className="space-y-6">
          <TabsList className="bg-card/50">
            <TabsTrigger value="hosts" className="flex items-center gap-2">
              <Server className="w-4 h-4" />
              Hosts
            </TabsTrigger>
            <TabsTrigger value="alerts" className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Alerts
            </TabsTrigger>
            <TabsTrigger value="incidents" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Incidents
            </TabsTrigger>
          </TabsList>

          {/* Hosts Tab */}
          <TabsContent value="hosts" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Monitored Hosts</h2>
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="bg-cyan-600 hover:bg-cyan-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Host
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-background border-border">
                  <DialogHeader>
                    <DialogTitle>Register Host for Monitoring</DialogTitle>
                    <DialogDescription>
                      Select an SSH host to monitor
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>SSH Host</Label>
                      <Select
                        onValueChange={value => {
                          addHostMutation.mutate({
                            sshHostId: parseInt(value),
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a host" />
                        </SelectTrigger>
                        <SelectContent>
                          {sshHostsQuery.data?.map(host => (
                            <SelectItem key={host.id} value={String(host.id)}>
                              {host.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {hostsQuery.isLoading ? (
              <div className="animate-pulse">Loading hosts...</div>
            ) : hostsQuery.data?.length === 0 ? (
              <Card className="bg-card/30">
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No hosts registered for monitoring. Add one to get started.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {hostsQuery.data?.map(host => (
                  <Card
                    key={host.id}
                    className={`bg-card/50 border-border/50 cursor-pointer transition-all hover:border-cyan-400/50 ${selectedHostId === host.id ? "ring-2 ring-cyan-400" : ""}`}
                    onClick={() => setSelectedHostId(host.id)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Server className="w-5 h-5 text-cyan-400" />
                          <CardTitle className="text-lg">{host.name}</CardTitle>
                        </div>
                        <Badge
                          variant={
                            host.status === "online"
                              ? "default"
                              : host.status === "offline"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {host.status ?? "unknown"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-muted-foreground">
                        {host.hostname}:{host.port ?? 22}
                      </div>
                      {host.lastSeen && (
                        <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Last seen: {new Date(host.lastSeen).toLocaleString()}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Alerts Tab */}
          <TabsContent value="alerts" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Alert Rules</h2>
            </div>

            {alertsQuery.isLoading ? (
              <div className="animate-pulse">Loading alerts...</div>
            ) : alertsQuery.data?.length === 0 ? (
              <Card className="bg-card/30">
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No alert rules configured.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {alertsQuery.data?.map(alert => (
                  <Card key={alert.id} className="bg-card/30">
                    <CardContent className="py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <AlertTriangle
                            className={`w-5 h-5 ${alert.severity === "critical" ? "text-red-500" : alert.severity === "warning" ? "text-yellow-500" : "text-blue-500"}`}
                          />
                          <div>
                            <div className="font-medium">{alert.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {alert.metric} {alert.operator} {alert.threshold}
                            </div>
                          </div>
                        </div>
                        <Badge
                          variant={alert.isEnabled ? "default" : "secondary"}
                        >
                          {alert.isEnabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Incidents Tab */}
          <TabsContent value="incidents" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Active Incidents</h2>
            </div>

            {incidentsQuery.isLoading ? (
              <div className="animate-pulse">Loading incidents...</div>
            ) : incidentsQuery.data?.length === 0 ? (
              <Card className="bg-card/30">
                <CardContent className="pt-6 text-center text-muted-foreground">
                  <Shield className="w-12 h-12 mx-auto mb-2 text-green-500" />
                  <div>All systems operational. No active incidents.</div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {incidentsQuery.data?.map(incident => (
                  <Card key={incident.id} className="bg-card/30">
                    <CardContent className="py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Activity className="w-5 h-5 text-red-500" />
                          <div>
                            <div className="font-medium">{incident.title}</div>
                            <div className="text-sm text-muted-foreground">
                              {incident.description}
                            </div>
                          </div>
                        </div>
                        <Badge
                          variant={
                            incident.status === "open"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {incident.status}
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
