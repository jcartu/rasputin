import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import {
  Server,
  Plus,
  Trash2,
  Edit,
  CheckCircle2,
  XCircle,
  Loader2,
  Key,
  Lock,
  Shield,
  Clock,
  Terminal,
  AlertTriangle,
  RefreshCw,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Host {
  id: number;
  name: string;
  hostname: string;
  port: number;
  username: string;
  authType: "password" | "key";
  description?: string | null;
  tags?: string[] | null;
  status: "connected" | "disconnected" | "error" | "unknown";
  lastConnectedAt?: Date | null;
  hostKeyVerified: number;
  createdAt: Date;
}

export function HostsManager() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingHost, setEditingHost] = useState<Host | null>(null);
  const [selectedHost, setSelectedHost] = useState<Host | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [testingConnection, setTestingConnection] = useState<number | null>(
    null
  );

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    hostname: "",
    port: 22,
    username: "",
    authType: "key" as "password" | "key",
    password: "",
    privateKey: "",
    passphrase: "",
    description: "",
    tags: "",
  });

  // Queries
  const {
    data: hosts = [],
    refetch: refetchHosts,
    isLoading,
  } = trpc.ssh.listHosts.useQuery();
  const { data: auditLog = [] } = trpc.ssh.getAuditLog.useQuery(
    { hostId: selectedHost?.id ?? 0, limit: 50 },
    { enabled: !!selectedHost }
  );
  const { data: permissions } = trpc.ssh.getPermissions.useQuery(
    { hostId: selectedHost?.id ?? 0 },
    { enabled: !!selectedHost }
  );

  // Mutations
  const createHost = trpc.ssh.createHost.useMutation({
    onSuccess: () => {
      toast.success("Host added successfully");
      setIsAddDialogOpen(false);
      resetForm();
      refetchHosts();
    },
    onError: error => {
      toast.error(`Failed to add host: ${error.message}`);
    },
  });

  const updateHost = trpc.ssh.updateHost.useMutation({
    onSuccess: () => {
      toast.success("Host updated successfully");
      setEditingHost(null);
      resetForm();
      refetchHosts();
    },
    onError: error => {
      toast.error(`Failed to update host: ${error.message}`);
    },
  });

  const deleteHost = trpc.ssh.deleteHost.useMutation({
    onSuccess: () => {
      toast.success("Host deleted");
      if (selectedHost?.id === editingHost?.id) {
        setSelectedHost(null);
      }
      refetchHosts();
    },
    onError: error => {
      toast.error(`Failed to delete host: ${error.message}`);
    },
  });

  const testConnection = trpc.ssh.testConnection.useMutation({
    onSuccess: result => {
      if (result.success) {
        toast.success(`Connected successfully! ${result.message}`);
      } else {
        toast.error(`Connection failed: ${result.message}`);
      }
      setTestingConnection(null);
      refetchHosts();
    },
    onError: error => {
      toast.error(`Connection test failed: ${error.message}`);
      setTestingConnection(null);
    },
  });

  const verifyHostKey = trpc.ssh.verifyHostKey.useMutation({
    onSuccess: result => {
      if (result.success) {
        toast.success("Host key verified and pinned");
      } else {
        toast.error(
          `Host key verification failed: ${result.error || "Unknown error"}`
        );
      }
      refetchHosts();
    },
    onError: error => {
      toast.error(`Host key verification failed: ${error.message}`);
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      hostname: "",
      port: 22,
      username: "",
      authType: "key",
      password: "",
      privateKey: "",
      passphrase: "",
      description: "",
      tags: "",
    });
    setShowPassword(false);
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.hostname || !formData.username) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (formData.authType === "password" && !formData.password) {
      toast.error("Password is required for password authentication");
      return;
    }

    if (formData.authType === "key" && !formData.privateKey) {
      toast.error("Private key is required for key authentication");
      return;
    }

    const tags = formData.tags
      .split(",")
      .map(t => t.trim())
      .filter(Boolean);

    if (editingHost) {
      updateHost.mutate({
        hostId: editingHost.id,
        name: formData.name,
        hostname: formData.hostname,
        port: formData.port,
        username: formData.username,
        description: formData.description || undefined,
        tags: tags.length > 0 ? tags : undefined,
      });
    } else {
      createHost.mutate({
        name: formData.name,
        hostname: formData.hostname,
        port: formData.port,
        username: formData.username,
        authType: formData.authType,
        password:
          formData.authType === "password" ? formData.password : undefined,
        privateKey:
          formData.authType === "key" ? formData.privateKey : undefined,
        passphrase: formData.passphrase || undefined,
        description: formData.description || undefined,
        tags: tags.length > 0 ? tags : undefined,
      });
    }
  };

  const handleEdit = (host: Host) => {
    setEditingHost(host);
    setFormData({
      name: host.name,
      hostname: host.hostname,
      port: host.port,
      username: host.username,
      authType: host.authType,
      password: "",
      privateKey: "",
      passphrase: "",
      description: host.description || "",
      tags: host.tags?.join(", ") || "",
    });
    setIsAddDialogOpen(true);
  };

  const handleTestConnection = (hostId: number) => {
    setTestingConnection(hostId);
    testConnection.mutate({ hostId });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "connected":
        return <CheckCircle2 className="h-4 w-4 text-green-400" />;
      case "disconnected":
        return <XCircle className="h-4 w-4 text-yellow-400" />;
      case "error":
        return <AlertTriangle className="h-4 w-4 text-red-400" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected":
        return "text-green-400 border-green-400/30";
      case "disconnected":
        return "text-yellow-400 border-yellow-400/30";
      case "error":
        return "text-red-400 border-red-400/30";
      default:
        return "text-muted-foreground border-muted-foreground/30";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Server className="h-5 w-5 text-purple-400" />
              SSH Hosts
            </h2>
            <p className="text-sm text-muted-foreground">
              Manage remote servers for JARVIS to access
            </p>
          </div>
          <Dialog
            open={isAddDialogOpen}
            onOpenChange={open => {
              setIsAddDialogOpen(open);
              if (!open) {
                setEditingHost(null);
                resetForm();
              }
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Host
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingHost ? "Edit Host" : "Add New Host"}
                </DialogTitle>
                <DialogDescription>
                  {editingHost
                    ? "Update the host configuration"
                    : "Configure a new SSH host for JARVIS to access"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      placeholder="My Server"
                      value={formData.name}
                      onChange={e =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hostname">Hostname *</Label>
                    <Input
                      id="hostname"
                      placeholder="192.168.1.100 or server.example.com"
                      value={formData.hostname}
                      onChange={e =>
                        setFormData({ ...formData, hostname: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="port">Port</Label>
                    <Input
                      id="port"
                      type="number"
                      value={formData.port}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          port: parseInt(e.target.value) || 22,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="username">Username *</Label>
                    <Input
                      id="username"
                      placeholder="ubuntu"
                      value={formData.username}
                      onChange={e =>
                        setFormData({ ...formData, username: e.target.value })
                      }
                    />
                  </div>
                </div>
                {!editingHost && (
                  <>
                    <div className="space-y-2">
                      <Label>Authentication Type</Label>
                      <Select
                        value={formData.authType}
                        onValueChange={v =>
                          setFormData({
                            ...formData,
                            authType: v as "password" | "key",
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="key">
                            <div className="flex items-center gap-2">
                              <Key className="h-4 w-4" />
                              SSH Key
                            </div>
                          </SelectItem>
                          <SelectItem value="password">
                            <div className="flex items-center gap-2">
                              <Lock className="h-4 w-4" />
                              Password
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {formData.authType === "password" ? (
                      <div className="space-y-2">
                        <Label htmlFor="password">Password *</Label>
                        <div className="relative">
                          <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            value={formData.password}
                            onChange={e =>
                              setFormData({
                                ...formData,
                                password: e.target.value,
                              })
                            }
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="privateKey">Private Key *</Label>
                          <Textarea
                            id="privateKey"
                            placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
                            className="font-mono text-xs h-32"
                            value={formData.privateKey}
                            onChange={e =>
                              setFormData({
                                ...formData,
                                privateKey: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="passphrase">
                            Key Passphrase (optional)
                          </Label>
                          <Input
                            id="passphrase"
                            type="password"
                            value={formData.passphrase}
                            onChange={e =>
                              setFormData({
                                ...formData,
                                passphrase: e.target.value,
                              })
                            }
                          />
                        </div>
                      </>
                    )}
                  </>
                )}
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    placeholder="Production web server"
                    value={formData.description}
                    onChange={e =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tags">Tags (comma-separated)</Label>
                  <Input
                    id="tags"
                    placeholder="production, web, nginx"
                    value={formData.tags}
                    onChange={e =>
                      setFormData({ ...formData, tags: e.target.value })
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={createHost.isPending || updateHost.isPending}
                >
                  {(createHost.isPending || updateHost.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {editingHost ? "Update" : "Add Host"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex">
        {/* Host List */}
        <div className="w-80 border-r border-border">
          <ScrollArea className="h-[calc(100vh-280px)]">
            <div className="p-2 space-y-1">
              {hosts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">No hosts configured</p>
                  <p className="text-xs mt-1">Add a host to get started</p>
                </div>
              ) : (
                hosts.map(host => (
                  <Card
                    key={host.id}
                    className={cn(
                      "cursor-pointer transition-colors",
                      selectedHost?.id === host.id
                        ? "border-purple-500/50 bg-purple-500/5"
                        : "hover:bg-muted/50"
                    )}
                    onClick={() => setSelectedHost(host as Host)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(host.status)}
                            <span className="font-medium truncate">
                              {host.name}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {host.username}@{host.hostname}:{host.port}
                          </p>
                          {host.tags && host.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {(host.tags as string[]).slice(0, 3).map(tag => (
                                <Badge
                                  key={tag}
                                  variant="outline"
                                  className="text-xs"
                                >
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs ml-2",
                            getStatusColor(host.status)
                          )}
                        >
                          {host.authType === "key" ? (
                            <Key className="h-3 w-3" />
                          ) : (
                            <Lock className="h-3 w-3" />
                          )}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Host Details */}
        <div className="flex-1">
          {selectedHost ? (
            <Tabs defaultValue="details" className="h-full flex flex-col">
              <TabsList className="mx-4 mt-4">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="permissions">Permissions</TabsTrigger>
                <TabsTrigger value="audit">Audit Log</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="flex-1 p-4 space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {getStatusIcon(selectedHost.status)}
                          {selectedHost.name}
                        </CardTitle>
                        <CardDescription>
                          {selectedHost.description || "No description"}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTestConnection(selectedHost.id)}
                          disabled={testingConnection === selectedHost.id}
                        >
                          {testingConnection === selectedHost.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(selectedHost)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Host</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "
                                {selectedHost.name}"? This action cannot be
                                undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-red-500 hover:bg-red-600"
                                onClick={() =>
                                  deleteHost.mutate({ hostId: selectedHost.id })
                                }
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-muted-foreground">
                          Hostname
                        </Label>
                        <p className="font-mono">{selectedHost.hostname}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Port</Label>
                        <p className="font-mono">{selectedHost.port}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">
                          Username
                        </Label>
                        <p className="font-mono">{selectedHost.username}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">
                          Auth Type
                        </Label>
                        <p className="flex items-center gap-1">
                          {selectedHost.authType === "key" ? (
                            <>
                              <Key className="h-4 w-4" /> SSH Key
                            </>
                          ) : (
                            <>
                              <Lock className="h-4 w-4" /> Password
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-muted-foreground">
                          Host Key Verified
                        </Label>
                        <p className="flex items-center gap-1">
                          {selectedHost.hostKeyVerified ? (
                            <>
                              <Shield className="h-4 w-4 text-green-400" />{" "}
                              Verified
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="h-4 w-4 text-yellow-400" />{" "}
                              Not Verified
                            </>
                          )}
                        </p>
                      </div>
                      {!selectedHost.hostKeyVerified && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            verifyHostKey.mutate({ hostId: selectedHost.id })
                          }
                          disabled={verifyHostKey.isPending}
                        >
                          {verifyHostKey.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Shield className="h-4 w-4 mr-2" />
                          )}
                          Verify & Pin
                        </Button>
                      )}
                    </div>
                    {selectedHost.lastConnectedAt && (
                      <div>
                        <Label className="text-muted-foreground">
                          Last Connected
                        </Label>
                        <p>
                          {new Date(
                            selectedHost.lastConnectedAt
                          ).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="permissions" className="flex-1 p-4 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Permissions
                    </CardTitle>
                    <CardDescription>
                      Control what JARVIS can do on this host
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {permissions ? (
                      <>
                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Require Approval for All Commands</Label>
                            <p className="text-xs text-muted-foreground">
                              JARVIS will ask before executing any command
                            </p>
                          </div>
                          <Switch
                            checked={permissions.requireApprovalForAll === 1}
                            disabled
                          />
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Allow File Write</Label>
                            <p className="text-xs text-muted-foreground">
                              Allow creating and modifying files
                            </p>
                          </div>
                          <Switch
                            checked={permissions.allowFileWrite === 1}
                            disabled
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Allow File Delete</Label>
                            <p className="text-xs text-muted-foreground">
                              Allow deleting files and directories
                            </p>
                          </div>
                          <Switch
                            checked={permissions.allowFileDelete === 1}
                            disabled
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Allow Sudo</Label>
                            <p className="text-xs text-muted-foreground">
                              Allow running commands with sudo
                            </p>
                          </div>
                          <Switch
                            checked={permissions.allowSudo === 1}
                            disabled
                          />
                        </div>
                        <Separator />
                        <div>
                          <Label>Max Execution Time</Label>
                          <p className="font-mono">
                            {permissions.maxExecutionTime || 30} seconds
                          </p>
                        </div>
                      </>
                    ) : (
                      <p className="text-muted-foreground">
                        Loading permissions...
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="audit" className="flex-1 p-4">
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Terminal className="h-5 w-5" />
                      Audit Log
                    </CardTitle>
                    <CardDescription>
                      History of commands executed on this host
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[300px]">
                      {auditLog.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">
                          No commands executed yet
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {auditLog.map(entry => (
                            <div
                              key={entry.id}
                              className="p-2 rounded bg-muted/50 font-mono text-xs"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-muted-foreground">
                                  {new Date(entry.createdAt).toLocaleString()}
                                </span>
                                <Badge
                                  variant="outline"
                                  className={
                                    entry.status === "completed"
                                      ? "text-green-400"
                                      : "text-red-400"
                                  }
                                >
                                  {entry.status === "completed"
                                    ? "Success"
                                    : entry.status}
                                </Badge>
                              </div>
                              <p className="text-cyan-400">$ {entry.command}</p>
                              {entry.stdout && (
                                <pre className="mt-1 text-muted-foreground whitespace-pre-wrap">
                                  {entry.stdout.substring(0, 200)}
                                  {entry.stdout.length > 200 && "..."}
                                </pre>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a host to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
