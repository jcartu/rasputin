import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  Server,
  Terminal,
  Key,
  Lock,
  Shield,
  Activity,
  Trash2,
  Edit,
  RefreshCw,
  Plus,
  ArrowLeft,
  CheckCircle,
  Clock,
  MoreVertical,
  FileText,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApprovalWorkflow } from "@/components/ApprovalWorkflow";

type SshHost = {
  id: number;
  name: string;
  hostname: string;
  port: number;
  username: string;
  authType: "password" | "key";
  status: "online" | "offline" | "error" | "unknown";
  hostFingerprint?: string;
  hostKeyVerified?: number;
  lastConnectedAt?: string | Date;
  description?: string;
};

type HostFormData = {
  name: string;
  hostname: string;
  port: number;
  username: string;
  authType: "password" | "key";
  password?: string;
  privateKey?: string;
  passphrase?: string;
  description?: string;
  tags?: string;
};

const initialFormData: HostFormData = {
  name: "",
  hostname: "",
  port: 22,
  username: "root",
  authType: "key",
  password: "",
  privateKey: "",
  passphrase: "",
  description: "",
  tags: "",
};

export default function Hosts() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);

  const [selectedHost, setSelectedHost] = useState<SshHost | null>(null);
  const [formData, setFormData] = useState<HostFormData>(initialFormData);

  const utils = trpc.useContext();
  const hostsQuery = trpc.ssh.listHosts.useQuery();

  const createHostMutation = trpc.ssh.createHost.useMutation({
    onSuccess: () => {
      toast.success("Host added successfully");
      setIsAddOpen(false);
      setFormData(initialFormData);
      utils.ssh.listHosts.invalidate();
    },
    onError: err => toast.error(`Failed to add host: ${err.message}`),
  });

  const updateHostMutation = trpc.ssh.updateHost.useMutation({
    onSuccess: () => {
      toast.success("Host updated successfully");
      setIsEditOpen(false);
      utils.ssh.listHosts.invalidate();
    },
    onError: err => toast.error(`Failed to update host: ${err.message}`),
  });

  const deleteHostMutation = trpc.ssh.deleteHost.useMutation({
    onSuccess: () => {
      toast.success("Host deleted successfully");
      setIsDeleteOpen(false);
      setSelectedHost(null);
      utils.ssh.listHosts.invalidate();
    },
    onError: err => toast.error(`Failed to delete host: ${err.message}`),
  });

  const testConnectionMutation = trpc.ssh.testConnection.useMutation({
    onSuccess: data => {
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
      utils.ssh.listHosts.invalidate();
    },
    onError: err => toast.error(`Connection test failed: ${err.message}`),
  });

  const verifyHostKeyMutation = trpc.ssh.verifyHostKey.useMutation({
    onSuccess: () => {
      toast.success("Host key verified and pinned");
      utils.ssh.listHosts.invalidate();
    },
    onError: err => toast.error(`Verification failed: ${err.message}`),
  });

  const handleEditClick = (host: SshHost) => {
    setSelectedHost(host);
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
      tags: "",
    });
    setIsEditOpen(true);
  };

  const handleDeleteClick = (host: SshHost) => {
    setSelectedHost(host);
    setIsDeleteOpen(true);
  };

  const handlePermissionsClick = (host: SshHost) => {
    setSelectedHost(host);
    setIsPermissionsOpen(true);
  };

  const handleAuditClick = (host: SshHost) => {
    setSelectedHost(host);
    setIsAuditOpen(true);
  };

  const handleCreateSubmit = () => {
    createHostMutation.mutate({
      ...formData,
      tags: formData.tags
        ? formData.tags.split(",").map(t => t.trim())
        : undefined,
    });
  };

  const handleUpdateSubmit = () => {
    if (!selectedHost) return;
    updateHostMutation.mutate({
      hostId: selectedHost.id,
      name: formData.name,
      hostname: formData.hostname,
      port: formData.port,
      username: formData.username,
      description: formData.description,
      tags: formData.tags
        ? formData.tags.split(",").map(t => t.trim())
        : undefined,
    });
  };

  return (
    <div className="min-h-screen bg-background">
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
                <Terminal className="w-6 h-6 text-cyan-400" />
                <h1 className="text-xl font-bold">SSH Hosts</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => utils.ssh.listHosts.invalidate()}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button
                className="bg-cyan-600 hover:bg-cyan-700"
                size="sm"
                onClick={() => {
                  setFormData(initialFormData);
                  setIsAddOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Host
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-6">
        <Tabs defaultValue="hosts" className="space-y-6">
          <TabsList className="bg-card/50">
            <TabsTrigger value="hosts" className="flex items-center gap-2">
              <Server className="w-4 h-4" />
              Hosts
            </TabsTrigger>
            <TabsTrigger value="approvals" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Approvals
            </TabsTrigger>
          </TabsList>

          <TabsContent value="hosts">
            {hostsQuery.isLoading ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground animate-pulse">
                Loading hosts...
              </div>
            ) : hostsQuery.data?.length === 0 ? (
              <Card className="bg-card/30 border-dashed border-2">
                <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Server className="w-12 h-12 mb-4 opacity-50" />
                  <p className="text-lg font-medium">No SSH hosts found</p>
                  <p className="mb-4">Add your first host to get started</p>
                  <Button variant="outline" onClick={() => setIsAddOpen(true)}>
                    Add Host
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {hostsQuery.data?.map(host => (
                  <HostCard
                    key={host.id}
                    host={host as SshHost}
                    onEdit={() => handleEditClick(host as SshHost)}
                    onDelete={() => handleDeleteClick(host as SshHost)}
                    onPermissions={() =>
                      handlePermissionsClick(host as SshHost)
                    }
                    onAudit={() => handleAuditClick(host as SshHost)}
                    onTest={() =>
                      testConnectionMutation.mutate({ hostId: host.id })
                    }
                    onVerify={() =>
                      verifyHostKeyMutation.mutate({ hostId: host.id })
                    }
                    isTesting={
                      testConnectionMutation.isPending &&
                      testConnectionMutation.variables?.hostId === host.id
                    }
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="approvals">
            <ApprovalWorkflow />
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-2xl bg-background border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add SSH Host</DialogTitle>
            <DialogDescription>
              Enter the connection details for the remote server.
            </DialogDescription>
          </DialogHeader>

          <HostForm
            formData={formData}
            setFormData={setFormData}
            mode="create"
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-cyan-600 hover:bg-cyan-700"
              onClick={handleCreateSubmit}
              disabled={createHostMutation.isPending}
            >
              {createHostMutation.isPending ? "Adding..." : "Add Host"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl bg-background border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Host: {selectedHost?.name}</DialogTitle>
            <DialogDescription>
              Update host details. Note: Credentials cannot be updated here for
              security.
            </DialogDescription>
          </DialogHeader>

          <HostForm formData={formData} setFormData={setFormData} mode="edit" />

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-cyan-600 hover:bg-cyan-700"
              onClick={handleUpdateSubmit}
              disabled={updateHostMutation.isPending}
            >
              {updateHostMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              host configuration
              <span className="font-semibold text-foreground">
                {" "}
                {selectedHost?.name}{" "}
              </span>
              and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                selectedHost &&
                deleteHostMutation.mutate({ hostId: selectedHost.id })
              }
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedHost && (
        <PermissionsDialog
          open={isPermissionsOpen}
          onOpenChange={setIsPermissionsOpen}
          host={selectedHost}
        />
      )}

      {selectedHost && (
        <AuditLogSheet
          open={isAuditOpen}
          onOpenChange={setIsAuditOpen}
          host={selectedHost}
        />
      )}
    </div>
  );
}

function HostCard({
  host,
  onEdit,
  onDelete,
  onPermissions,
  onAudit,
  onTest,
  onVerify,
  isTesting,
}: {
  host: SshHost;
  onEdit: () => void;
  onDelete: () => void;
  onPermissions: () => void;
  onAudit: () => void;
  onTest: () => void;
  onVerify: () => void;
  isTesting: boolean;
}) {
  return (
    <Card className="bg-card/50 border-border/50 hover:border-cyan-400/30 transition-all flex flex-col h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={`p-2 rounded-md ${host.status === "online" ? "bg-green-500/10" : "bg-muted"}`}
            >
              <Server
                className={`w-5 h-5 ${
                  host.status === "online"
                    ? "text-green-500"
                    : host.status === "error"
                      ? "text-red-500"
                      : "text-muted-foreground"
                }`}
              />
            </div>
            <div>
              <CardTitle className="text-lg">{host.name}</CardTitle>
              <CardDescription className="flex items-center gap-1 mt-1">
                {host.username}@{host.hostname}:{host.port}
              </CardDescription>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="w-4 h-4 mr-2" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onPermissions}>
                <Shield className="w-4 h-4 mr-2" /> Permissions
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onAudit}>
                <FileText className="w-4 h-4 mr-2" /> Audit Logs
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-500 focus:text-red-500"
                onClick={onDelete}
              >
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="flex-1 pb-3">
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Status</span>
            <Badge
              variant={host.status === "online" ? "default" : "secondary"}
              className={
                host.status === "online"
                  ? "bg-green-600 hover:bg-green-700"
                  : ""
              }
            >
              {host.status}
            </Badge>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Key Status</span>
            {host.hostKeyVerified ? (
              <Badge
                variant="outline"
                className="border-green-500/50 text-green-500 flex items-center gap-1"
              >
                <CheckCircle className="w-3 h-3" /> Verified
              </Badge>
            ) : (
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-yellow-500"
                onClick={onVerify}
              >
                Unverified (Click to fix)
              </Button>
            )}
          </div>

          {host.lastConnectedAt && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
              <Clock className="w-3 h-3" />
              Last connected: {new Date(host.lastConnectedAt).toLocaleString()}
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="pt-2 border-t border-border/50">
        <Button
          variant="ghost"
          className="w-full text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/30"
          onClick={onTest}
          disabled={isTesting}
        >
          {isTesting ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Activity className="w-4 h-4 mr-2" />
          )}
          {isTesting ? "Testing..." : "Test Connection"}
        </Button>
      </CardFooter>
    </Card>
  );
}

function HostForm({
  formData,
  setFormData,
  mode,
}: {
  formData: HostFormData;
  setFormData: (data: HostFormData) => void;
  mode: "create" | "edit";
}) {
  return (
    <div className="grid gap-6 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">
            Display Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="name"
            placeholder="Production Server"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tags">Tags (comma separated)</Label>
          <Input
            id="tags"
            placeholder="prod, aws, web"
            value={formData.tags}
            onChange={e => setFormData({ ...formData, tags: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-8 space-y-2">
          <Label htmlFor="hostname">
            Hostname / IP <span className="text-red-500">*</span>
          </Label>
          <Input
            id="hostname"
            placeholder="192.168.1.100"
            value={formData.hostname}
            onChange={e =>
              setFormData({ ...formData, hostname: e.target.value })
            }
          />
        </div>
        <div className="col-span-4 space-y-2">
          <Label htmlFor="port">Port</Label>
          <Input
            id="port"
            type="number"
            value={formData.port}
            onChange={e =>
              setFormData({ ...formData, port: parseInt(e.target.value) || 22 })
            }
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="username">
          Username <span className="text-red-500">*</span>
        </Label>
        <Input
          id="username"
          placeholder="ubuntu"
          value={formData.username}
          onChange={e => setFormData({ ...formData, username: e.target.value })}
        />
      </div>

      {mode === "create" && (
        <div className="space-y-4 pt-2 border-t border-border/50">
          <div className="space-y-2">
            <Label>Authentication Method</Label>
            <div className="flex items-center gap-4">
              <div
                className={`flex items-center gap-2 p-3 rounded-md border cursor-pointer transition-all ${formData.authType === "key" ? "border-cyan-500 bg-cyan-950/20" : "border-border"}`}
                onClick={() => setFormData({ ...formData, authType: "key" })}
              >
                <Key className="w-4 h-4" />
                <span className="text-sm font-medium">SSH Key</span>
              </div>
              <div
                className={`flex items-center gap-2 p-3 rounded-md border cursor-pointer transition-all ${formData.authType === "password" ? "border-cyan-500 bg-cyan-950/20" : "border-border"}`}
                onClick={() =>
                  setFormData({ ...formData, authType: "password" })
                }
              >
                <Lock className="w-4 h-4" />
                <span className="text-sm font-medium">Password</span>
              </div>
            </div>
          </div>

          {formData.authType === "password" ? (
            <div className="space-y-2 animate-in fade-in zoom-in-95">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Server password"
                value={formData.password}
                onChange={e =>
                  setFormData({ ...formData, password: e.target.value })
                }
              />
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in zoom-in-95">
              <div className="space-y-2">
                <Label htmlFor="privateKey">Private Key (OpenSSH Format)</Label>
                <Textarea
                  id="privateKey"
                  placeholder="-----BEGIN OPENSSH PRIVATE KEY-----..."
                  className="font-mono text-xs h-32"
                  value={formData.privateKey}
                  onChange={e =>
                    setFormData({ ...formData, privateKey: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="passphrase">Key Passphrase (Optional)</Label>
                <Input
                  id="passphrase"
                  type="password"
                  placeholder="Leave empty if key is not encrypted"
                  value={formData.passphrase}
                  onChange={e =>
                    setFormData({ ...formData, passphrase: e.target.value })
                  }
                />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="description">Description (Optional)</Label>
        <Textarea
          id="description"
          placeholder="Notes about this server..."
          value={formData.description}
          onChange={e =>
            setFormData({ ...formData, description: e.target.value })
          }
        />
      </div>
    </div>
  );
}

function PermissionsDialog({
  open,
  onOpenChange,
  host,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  host: SshHost;
}) {
  const [permissions, setPermissions] = useState<{
    allowedCommands: string;
    blockedCommands: string;
    requireApprovalForAll: boolean;
    allowFileWrite: boolean;
    allowFileDelete: boolean;
    allowSudo: boolean;
  } | null>(null);

  const utils = trpc.useContext();
  const permissionsQuery = trpc.ssh.getPermissions.useQuery(
    { hostId: host.id },
    {
      enabled: open,
    }
  );

  useEffect(() => {
    if (permissionsQuery.data) {
      setPermissions({
        allowedCommands:
          permissionsQuery.data.allowedCommands?.join("\n") || "",
        blockedCommands:
          permissionsQuery.data.blockedCommands?.join("\n") || "",
        requireApprovalForAll: !!permissionsQuery.data.requireApprovalForAll,
        allowFileWrite: !!permissionsQuery.data.allowFileWrite,
        allowFileDelete: !!permissionsQuery.data.allowFileDelete,
        allowSudo: !!permissionsQuery.data.allowSudo,
      });
    }
  }, [permissionsQuery.data]);

  const updatePermissionsMutation = trpc.ssh.updatePermissions.useMutation({
    onSuccess: () => {
      toast.success("Permissions updated");
      onOpenChange(false);
      utils.ssh.getPermissions.invalidate({ hostId: host.id });
    },
    onError: err => toast.error(`Failed to update permissions: ${err.message}`),
  });

  const handleSave = () => {
    if (!permissions) return;
    updatePermissionsMutation.mutate({
      hostId: host.id,
      allowedCommands: permissions.allowedCommands
        .split("\n")
        .filter(c => c.trim()),
      blockedCommands: permissions.blockedCommands
        .split("\n")
        .filter(c => c.trim()),
      requireApprovalForAll: permissions.requireApprovalForAll,
      allowFileWrite: permissions.allowFileWrite,
      allowFileDelete: permissions.allowFileDelete,
      allowSudo: permissions.allowSudo,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Security Permissions</DialogTitle>
          <DialogDescription>
            Configure what actions agents can perform on{" "}
            <span className="font-semibold text-foreground">{host.name}</span>.
          </DialogDescription>
        </DialogHeader>

        {permissionsQuery.isLoading || !permissions ? (
          <div className="py-8 text-center text-muted-foreground animate-pulse">
            Loading permissions...
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4 p-4 border rounded-md bg-muted/20">
                <h4 className="font-medium flex items-center gap-2">
                  <Lock className="w-4 h-4" /> Capabilities
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="allowSudo"
                      checked={permissions.allowSudo}
                      onCheckedChange={c =>
                        setPermissions({ ...permissions, allowSudo: !!c })
                      }
                    />
                    <Label htmlFor="allowSudo">Allow sudo usage</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="allowFileWrite"
                      checked={permissions.allowFileWrite}
                      onCheckedChange={c =>
                        setPermissions({ ...permissions, allowFileWrite: !!c })
                      }
                    />
                    <Label htmlFor="allowFileWrite">Allow file writing</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="allowFileDelete"
                      checked={permissions.allowFileDelete}
                      onCheckedChange={c =>
                        setPermissions({ ...permissions, allowFileDelete: !!c })
                      }
                    />
                    <Label htmlFor="allowFileDelete">Allow file deletion</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="requireApproval"
                      checked={permissions.requireApprovalForAll}
                      onCheckedChange={c =>
                        setPermissions({
                          ...permissions,
                          requireApprovalForAll: !!c,
                        })
                      }
                    />
                    <Label htmlFor="requireApproval">
                      Require approval for ALL commands
                    </Label>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Policy Overview</Label>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>
                    By default, dangerous commands like `rm -rf /` are blocked
                    globally. You can add specific allowed or blocked commands
                    here.
                  </p>
                  <p>
                    Approvals will trigger a request in the "Approvals" tab of
                    the Infrastructure page.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Allowed Commands (One per line)</Label>
                <Textarea
                  className="font-mono text-sm h-32"
                  value={permissions.allowedCommands}
                  onChange={e =>
                    setPermissions({
                      ...permissions,
                      allowedCommands: e.target.value,
                    })
                  }
                  placeholder="ls -la&#10;cat /var/log/syslog"
                />
                <p className="text-xs text-muted-foreground">
                  Whitelist specific commands to bypass checks.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Blocked Commands (One per line)</Label>
                <Textarea
                  className="font-mono text-sm h-32"
                  value={permissions.blockedCommands}
                  onChange={e =>
                    setPermissions({
                      ...permissions,
                      blockedCommands: e.target.value,
                    })
                  }
                  placeholder="reboot&#10;shutdown"
                />
                <p className="text-xs text-muted-foreground">
                  Blacklist specific commands.
                </p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-cyan-600 hover:bg-cyan-700"
            onClick={handleSave}
            disabled={updatePermissionsMutation.isPending}
          >
            Save Permissions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AuditLogSheet({
  open,
  onOpenChange,
  host,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  host: SshHost;
}) {
  const logsQuery = trpc.ssh.getAuditLog.useQuery(
    { hostId: host.id, limit: 50 },
    { enabled: open }
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[600px] sm:w-[800px] sm:max-w-none">
        <SheetHeader className="mb-6">
          <SheetTitle>Audit Log</SheetTitle>
          <SheetDescription>
            History of commands and actions executed on {host.name} (
            {host.hostname})
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-150px)]">
          {logsQuery.isLoading ? (
            <div className="py-8 text-center text-muted-foreground">
              Loading logs...
            </div>
          ) : logsQuery.data?.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No audit logs found.
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Time</TableHead>
                    <TableHead>Command / Action</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logsQuery.data?.map(
                    (log: (typeof logsQuery.data)[number]) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {new Date(log.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {log.command || (
                            <span className="italic text-muted-foreground">
                              command
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              log.status === "completed"
                                ? "outline"
                                : "destructive"
                            }
                          >
                            {log.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
