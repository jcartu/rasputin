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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Folder,
  Server,
  Layout,
  Terminal,
  Layers,
  MoreVertical,
  Trash2,
  Play,
  Square,
  ExternalLink,
  Clock,
  HardDrive,
  GitBranch,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface WorkspaceManagerProps {
  onSelectWorkspace?: (workspaceId: number) => void;
}

const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  blank: <Folder className="h-5 w-5" />,
  "node-basic": <Server className="h-5 w-5" />,
  "react-vite": <Layout className="h-5 w-5" />,
  "python-basic": <Terminal className="h-5 w-5" />,
  "express-api": <Server className="h-5 w-5" />,
  nextjs: <Layers className="h-5 w-5" />,
};

const STATUS_COLORS: Record<string, string> = {
  creating: "bg-yellow-500",
  ready: "bg-green-500",
  running: "bg-blue-500",
  stopped: "bg-gray-500",
  error: "bg-red-500",
};

export function WorkspaceManager({ onSelectWorkspace }: WorkspaceManagerProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newWorkspaceDescription, setNewWorkspaceDescription] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("blank");

  const utils = trpc.useUtils();

  // Queries
  const { data: workspaces, isLoading: workspacesLoading } =
    trpc.workspace.list.useQuery();
  const { data: templates } = trpc.workspace.getTemplates.useQuery();

  // Mutations
  const createWorkspace = trpc.workspace.create.useMutation({
    onSuccess: () => {
      utils.workspace.list.invalidate();
      setIsCreateDialogOpen(false);
      setNewWorkspaceName("");
      setNewWorkspaceDescription("");
      setSelectedTemplate("blank");
    },
  });

  const deleteWorkspace = trpc.workspace.delete.useMutation({
    onSuccess: () => {
      utils.workspace.list.invalidate();
    },
  });

  const startDevServer = trpc.workspace.startDevServer.useMutation({
    onSuccess: () => {
      utils.workspace.list.invalidate();
    },
  });

  const stopDevServer = trpc.workspace.stopDevServer.useMutation({
    onSuccess: () => {
      utils.workspace.list.invalidate();
    },
  });

  const handleCreateWorkspace = () => {
    if (!newWorkspaceName.trim()) return;
    createWorkspace.mutate({
      name: newWorkspaceName,
      description: newWorkspaceDescription || undefined,
      template: selectedTemplate,
    });
  };

  const handleDeleteWorkspace = (id: number) => {
    if (
      confirm(
        "Are you sure you want to delete this workspace? This action cannot be undone."
      )
    ) {
      deleteWorkspace.mutate({ id });
    }
  };

  const handleStartServer = (id: number) => {
    startDevServer.mutate({ workspaceId: id });
  };

  const handleStopServer = (id: number) => {
    stopDevServer.mutate({ workspaceId: id });
  };

  if (workspacesLoading) {
    return (
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Workspaces</h2>
          <p className="text-muted-foreground">
            Persistent development environments for RASPUTIN
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Workspace
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create New Workspace</DialogTitle>
              <DialogDescription>
                Create a new persistent development environment for RASPUTIN to
                work in.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="My Awesome Project"
                  value={newWorkspaceName}
                  onChange={e => setNewWorkspaceName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  placeholder="A brief description of this workspace..."
                  value={newWorkspaceDescription}
                  onChange={e => setNewWorkspaceDescription(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Template</Label>
                <Select
                  value={selectedTemplate}
                  onValueChange={setSelectedTemplate}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates?.map(template => (
                      <SelectItem key={template.id} value={template.id}>
                        <div className="flex items-center gap-2">
                          {TEMPLATE_ICONS[template.id] || (
                            <Folder className="h-4 w-4" />
                          )}
                          <span>{template.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {templates?.find(t => t.id === selectedTemplate)
                  ?.description && (
                  <p className="text-sm text-muted-foreground">
                    {
                      templates.find(t => t.id === selectedTemplate)
                        ?.description
                    }
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateWorkspace}
                disabled={!newWorkspaceName.trim() || createWorkspace.isPending}
              >
                {createWorkspace.isPending ? "Creating..." : "Create Workspace"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Workspace Grid */}
      {workspaces && workspaces.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workspaces.map(workspace => (
            <Card
              key={workspace.id}
              className="group cursor-pointer transition-all hover:border-primary/50 hover:shadow-md"
              onClick={() => onSelectWorkspace?.(workspace.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {TEMPLATE_ICONS[workspace.template] || (
                      <Folder className="h-5 w-5" />
                    )}
                    <CardTitle className="text-lg">{workspace.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`${STATUS_COLORS[workspace.status]} text-white border-0`}
                    >
                      {workspace.status}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        asChild
                        onClick={e => e.stopPropagation()}
                      >
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {workspace.status === "running" ? (
                          <DropdownMenuItem
                            onClick={e => {
                              e.stopPropagation();
                              handleStopServer(workspace.id);
                            }}
                          >
                            <Square className="mr-2 h-4 w-4" />
                            Stop Server
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={e => {
                              e.stopPropagation();
                              handleStartServer(workspace.id);
                            }}
                          >
                            <Play className="mr-2 h-4 w-4" />
                            Start Server
                          </DropdownMenuItem>
                        )}
                        {workspace.devServerUrl && (
                          <DropdownMenuItem
                            onClick={e => {
                              e.stopPropagation();
                              window.open(workspace.devServerUrl!, "_blank");
                            }}
                          >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Open Preview
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={e => {
                            e.stopPropagation();
                            handleDeleteWorkspace(workspace.id);
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                {workspace.description && (
                  <CardDescription className="line-clamp-2">
                    {workspace.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>
                      {formatDistanceToNow(new Date(workspace.updatedAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <HardDrive className="h-4 w-4" />
                    <span>{workspace.diskUsageMb || 0} MB</span>
                  </div>
                  {workspace.gitBranch && (
                    <div className="flex items-center gap-1">
                      <GitBranch className="h-4 w-4" />
                      <span>{workspace.gitBranch}</span>
                    </div>
                  )}
                </div>
                {workspace.devServerUrl && workspace.status === "running" && (
                  <div className="mt-3 flex items-center gap-2">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                    <span className="text-xs text-muted-foreground">
                      Running on port {workspace.devServerPort}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Folder className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">No workspaces yet</h3>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Create your first workspace to get started with RASPUTIN
              development.
            </p>
            <Button
              className="mt-4"
              onClick={() => setIsCreateDialogOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Workspace
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
