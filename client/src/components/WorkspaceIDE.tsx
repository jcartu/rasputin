import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { FileExplorer } from "./FileExplorer";
import { CodeEditor } from "./CodeEditor";
import {
  ArrowLeft,
  Play,
  Square,
  Terminal,
  GitBranch,
  GitCommit,
  History,
  ExternalLink,
  // RefreshCw,
  Save,
  FolderOpen,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface WorkspaceIDEProps {
  workspaceId: number;
  onBack?: () => void;
}

interface OpenFile {
  path: string;
  content: string;
  isDirty: boolean;
}

export function WorkspaceIDE({ workspaceId, onBack }: WorkspaceIDEProps) {
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"files" | "git" | "terminal">(
    "files"
  );

  const utils = trpc.useUtils();

  // Queries
  const { data: workspace, isLoading: workspaceLoading } =
    trpc.workspace.get.useQuery({
      id: workspaceId,
    });

  const { data: commits } = trpc.workspace.getCommits.useQuery({
    workspaceId,
    limit: 20,
  });

  const { data: gitStatus } = trpc.workspace.getGitStatus.useQuery({
    workspaceId,
  });

  // Mutations
  const startServer = trpc.workspace.startDevServer.useMutation({
    onSuccess: () => {
      utils.workspace.get.invalidate({ id: workspaceId });
    },
  });

  const stopServer = trpc.workspace.stopDevServer.useMutation({
    onSuccess: () => {
      utils.workspace.get.invalidate({ id: workspaceId });
    },
  });

  const executeCommand = trpc.workspace.executeCommand.useMutation({
    onSuccess: (result, variables) => {
      setTerminalOutput(prev => [
        ...prev,
        `$ ${variables.command}`,
        result.stdout || "",
        result.stderr ? `Error: ${result.stderr}` : "",
        `Exit code: ${result.exitCode}`,
        "---",
      ]);
    },
  });

  const createCheckpoint = trpc.workspace.createCheckpoint.useMutation({
    onSuccess: () => {
      utils.workspace.getCommits.invalidate({ workspaceId });
    },
  });

  // File handling
  const handleFileSelect = (path: string, content: string) => {
    const existingFile = openFiles.find(f => f.path === path);
    if (!existingFile) {
      setOpenFiles([...openFiles, { path, content, isDirty: false }]);
    }
    setActiveFile(path);
  };

  const handleCloseFile = (path: string) => {
    const file = openFiles.find(f => f.path === path);
    if (file?.isDirty) {
      if (!confirm("You have unsaved changes. Close anyway?")) {
        return;
      }
    }
    setOpenFiles(openFiles.filter(f => f.path !== path));
    if (activeFile === path) {
      const remaining = openFiles.filter(f => f.path !== path);
      setActiveFile(
        remaining.length > 0 ? remaining[remaining.length - 1].path : null
      );
    }
  };

  const handleFileSave = (path: string, content: string) => {
    setOpenFiles(
      openFiles.map(f =>
        f.path === path ? { ...f, content, isDirty: false } : f
      )
    );
  };

  // Terminal
  const handleRunCommand = (command: string) => {
    executeCommand.mutate({ workspaceId, command });
  };

  if (workspaceLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Skeleton className="h-full w-full" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Workspace not found</p>
      </div>
    );
  }

  const activeFileData = openFiles.find(f => f.path === activeFile);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <FolderOpen className="h-5 w-5 text-cyan-500" />
          <span className="font-semibold">{workspace.name}</span>
          <Badge
            variant="outline"
            className={
              workspace.status === "running"
                ? "text-green-500 border-green-500"
                : "text-gray-500"
            }
          >
            {workspace.status}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {workspace.status === "running" ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(workspace.devServerUrl!, "_blank")}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Preview
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => stopServer.mutate({ workspaceId })}
                disabled={stopServer.isPending}
              >
                <Square className="mr-2 h-4 w-4" />
                Stop
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => startServer.mutate({ workspaceId })}
              disabled={startServer.isPending}
            >
              <Play className="mr-2 h-4 w-4" />
              Start Server
            </Button>
          )}
          <Button
            variant="default"
            size="sm"
            onClick={() => {
              const name = prompt("Checkpoint name:");
              if (name) {
                createCheckpoint.mutate({ workspaceId, name });
              }
            }}
          >
            <Save className="mr-2 h-4 w-4" />
            Checkpoint
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Sidebar */}
        <ResizablePanel defaultSize={20} minSize={15} maxSize={40}>
          <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)}>
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-2">
              <TabsTrigger value="files" className="gap-2">
                <FolderOpen className="h-4 w-4" />
                Files
              </TabsTrigger>
              <TabsTrigger value="git" className="gap-2">
                <GitBranch className="h-4 w-4" />
                Git
              </TabsTrigger>
              <TabsTrigger value="terminal" className="gap-2">
                <Terminal className="h-4 w-4" />
                Term
              </TabsTrigger>
            </TabsList>

            <TabsContent value="files" className="m-0 h-[calc(100%-40px)]">
              <FileExplorer
                workspaceId={workspaceId}
                onFileSelect={handleFileSelect}
                selectedFile={activeFile || undefined}
              />
            </TabsContent>

            <TabsContent value="git" className="m-0 h-[calc(100%-40px)]">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-4">
                  {/* Git Status */}
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <GitBranch className="h-4 w-4" />
                      Branch: {workspace.gitBranch || "main"}
                    </h4>
                    {gitStatus && (
                      <div className="text-sm text-muted-foreground">
                        {gitStatus.modified?.length > 0 && (
                          <p>{gitStatus.modified.length} modified</p>
                        )}
                        {gitStatus.added?.length > 0 && (
                          <p>{gitStatus.added.length} added</p>
                        )}
                        {gitStatus.deleted?.length > 0 && (
                          <p>{gitStatus.deleted.length} deleted</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Commits */}
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <History className="h-4 w-4" />
                      Recent Commits
                    </h4>
                    <div className="space-y-2">
                      {commits?.map(commit => (
                        <div
                          key={commit.hash}
                          className="text-sm p-2 rounded-md bg-muted/50"
                        >
                          <div className="flex items-center gap-2">
                            <GitCommit className="h-3 w-3" />
                            <span className="font-mono text-xs">
                              {commit.hash.substring(0, 7)}
                            </span>
                            {(commit as any).isCheckpoint && (
                              <Badge variant="secondary" className="text-xs">
                                Checkpoint
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1 text-muted-foreground truncate">
                            {commit.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(commit.date), {
                              addSuffix: true,
                            })}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="terminal" className="m-0 h-[calc(100%-40px)]">
              <div className="flex h-full flex-col">
                <ScrollArea className="flex-1 bg-black p-2">
                  <pre className="font-mono text-xs text-green-400">
                    {terminalOutput.join("\n") ||
                      "Terminal ready. Run commands from JARVIS."}
                  </pre>
                </ScrollArea>
                <div className="border-t p-2">
                  <form
                    onSubmit={e => {
                      e.preventDefault();
                      const input = e.currentTarget.elements.namedItem(
                        "command"
                      ) as HTMLInputElement;
                      if (input.value) {
                        handleRunCommand(input.value);
                        input.value = "";
                      }
                    }}
                  >
                    <input
                      name="command"
                      type="text"
                      placeholder="Enter command..."
                      className="w-full bg-transparent text-sm outline-none"
                    />
                  </form>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </ResizablePanel>

        <ResizableHandle />

        {/* Editor Area */}
        <ResizablePanel defaultSize={80}>
          <div className="flex h-full flex-col">
            {/* File Tabs */}
            {openFiles.length > 0 && (
              <div className="flex items-center border-b bg-muted/30 overflow-x-auto">
                {openFiles.map(file => (
                  <div
                    key={file.path}
                    className={`flex items-center gap-2 px-3 py-2 border-r cursor-pointer ${
                      activeFile === file.path
                        ? "bg-background"
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() => setActiveFile(file.path)}
                  >
                    <span className="text-sm truncate max-w-[150px]">
                      {file.path.split("/").pop()}
                    </span>
                    {file.isDirty && (
                      <span className="h-2 w-2 rounded-full bg-yellow-500" />
                    )}
                    <button
                      className="hover:bg-muted rounded p-0.5"
                      onClick={e => {
                        e.stopPropagation();
                        handleCloseFile(file.path);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Editor */}
            {activeFileData ? (
              <CodeEditor
                workspaceId={workspaceId}
                filePath={activeFileData.path}
                initialContent={activeFileData.content}
                onSave={content => handleFileSave(activeFileData.path, content)}
              />
            ) : (
              <div className="flex flex-1 items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <FolderOpen className="mx-auto h-12 w-12 opacity-50" />
                  <p className="mt-4">Select a file to edit</p>
                  <p className="text-sm">
                    Or let JARVIS create and edit files for you
                  </p>
                </div>
              </div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
