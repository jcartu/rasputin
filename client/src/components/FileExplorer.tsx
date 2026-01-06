import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Folder,
  File,
  FileCode,
  FileJson,
  FileText,
  // FileType,
  Image,
  ChevronRight,
  ChevronDown,
  Plus,
  FolderPlus,
  Trash2,
  // Edit,
  RefreshCw,
  Home,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FileExplorerProps {
  workspaceId: number;
  onFileSelect?: (path: string, content: string) => void;
  selectedFile?: string;
}

interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  mimeType?: string;
  lastModified: Date;
}

const FILE_ICONS: Record<string, React.ReactNode> = {
  js: <FileCode className="h-4 w-4 text-yellow-500" />,
  jsx: <FileCode className="h-4 w-4 text-yellow-500" />,
  ts: <FileCode className="h-4 w-4 text-blue-500" />,
  tsx: <FileCode className="h-4 w-4 text-blue-500" />,
  json: <FileJson className="h-4 w-4 text-yellow-600" />,
  md: <FileText className="h-4 w-4 text-gray-500" />,
  txt: <FileText className="h-4 w-4 text-gray-500" />,
  py: <FileCode className="h-4 w-4 text-green-500" />,
  html: <FileCode className="h-4 w-4 text-orange-500" />,
  css: <FileCode className="h-4 w-4 text-blue-400" />,
  svg: <Image className="h-4 w-4 text-purple-500" />,
  png: <Image className="h-4 w-4 text-purple-500" />,
  jpg: <Image className="h-4 w-4 text-purple-500" />,
  jpeg: <Image className="h-4 w-4 text-purple-500" />,
  gif: <Image className="h-4 w-4 text-purple-500" />,
};

function getFileIcon(filename: string, isDirectory: boolean): React.ReactNode {
  if (isDirectory) {
    return <Folder className="h-4 w-4 text-cyan-500" />;
  }
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return FILE_ICONS[ext] || <File className="h-4 w-4 text-gray-400" />;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function FileExplorer({
  workspaceId,
  onFileSelect,
  selectedFile,
}: FileExplorerProps) {
  const [currentPath, setCurrentPath] = useState("");
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [isNewFileDialogOpen, setIsNewFileDialogOpen] = useState(false);
  const [isNewFolderDialogOpen, setIsNewFolderDialogOpen] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemParentPath, setNewItemParentPath] = useState("");

  const utils = trpc.useUtils();

  // Query files for current path
  const {
    data: files,
    isLoading,
    refetch,
  } = trpc.workspace.listFiles.useQuery({
    workspaceId,
    path: currentPath,
  });

  // Mutations
  const writeFile = trpc.workspace.writeFile.useMutation({
    onSuccess: () => {
      utils.workspace.listFiles.invalidate({ workspaceId });
      setIsNewFileDialogOpen(false);
      setNewItemName("");
    },
  });

  const createDirectory = trpc.workspace.createDirectory.useMutation({
    onSuccess: () => {
      utils.workspace.listFiles.invalidate({ workspaceId });
      setIsNewFolderDialogOpen(false);
      setNewItemName("");
    },
  });

  const deleteFile = trpc.workspace.deleteFile.useMutation({
    onSuccess: () => {
      utils.workspace.listFiles.invalidate({ workspaceId });
    },
  });

  // We'll use a direct fetch for reading files since it's a query
  const [_fileContent, _setFileContent] = useState<{
    path: string;
    content: string;
  } | null>(null);

  const handleFileClick = async (file: FileInfo) => {
    if (file.isDirectory) {
      // Toggle directory expansion
      const newExpanded = new Set(expandedDirs);
      if (newExpanded.has(file.path)) {
        newExpanded.delete(file.path);
      } else {
        newExpanded.add(file.path);
      }
      setExpandedDirs(newExpanded);
    } else {
      // Read and select file
      try {
        const result = await utils.workspace.readFile.fetch({
          workspaceId,
          path: file.path,
        });
        onFileSelect?.(file.path, result.content);
      } catch (error) {
        console.error("Failed to read file:", error);
      }
    }
  };

  const handleCreateFile = () => {
    if (!newItemName.trim()) return;
    const filePath = newItemParentPath
      ? `${newItemParentPath}/${newItemName}`
      : newItemName;
    writeFile.mutate({
      workspaceId,
      path: filePath,
      content: "",
    });
  };

  const handleCreateFolder = () => {
    if (!newItemName.trim()) return;
    const folderPath = newItemParentPath
      ? `${newItemParentPath}/${newItemName}`
      : newItemName;
    createDirectory.mutate({
      workspaceId,
      path: folderPath,
    });
  };

  const handleDeleteFile = (path: string) => {
    if (confirm(`Are you sure you want to delete "${path}"?`)) {
      deleteFile.mutate({ workspaceId, path });
    }
  };

  const openNewFileDialog = (parentPath: string = "") => {
    setNewItemParentPath(parentPath);
    setNewItemName("");
    setIsNewFileDialogOpen(true);
  };

  const openNewFolderDialog = (parentPath: string = "") => {
    setNewItemParentPath(parentPath);
    setNewItemName("");
    setIsNewFolderDialogOpen(true);
  };

  // Breadcrumb navigation
  const pathParts = currentPath.split("/").filter(Boolean);

  const renderFileTree = (files: FileInfo[], depth: number = 0) => {
    return files.map(file => (
      <ContextMenu key={file.path}>
        <ContextMenuTrigger>
          <div
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors",
              "hover:bg-accent",
              selectedFile === file.path && "bg-accent"
            )}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
            onClick={() => handleFileClick(file)}
          >
            {file.isDirectory && (
              <span className="w-4">
                {expandedDirs.has(file.path) ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </span>
            )}
            {!file.isDirectory && <span className="w-4" />}
            {getFileIcon(file.name, file.isDirectory)}
            <span className="flex-1 truncate text-sm">{file.name}</span>
            {!file.isDirectory && (
              <span className="text-xs text-muted-foreground">
                {formatFileSize(file.size)}
              </span>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {file.isDirectory && (
            <>
              <ContextMenuItem onClick={() => openNewFileDialog(file.path)}>
                <Plus className="mr-2 h-4 w-4" />
                New File
              </ContextMenuItem>
              <ContextMenuItem onClick={() => openNewFolderDialog(file.path)}>
                <FolderPlus className="mr-2 h-4 w-4" />
                New Folder
              </ContextMenuItem>
              <ContextMenuSeparator />
            </>
          )}
          <ContextMenuItem
            className="text-destructive"
            onClick={() => handleDeleteFile(file.path)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    ));
  };

  if (isLoading) {
    return (
      <div className="space-y-2 p-2">
        {[1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b p-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setCurrentPath("")}
          title="Go to root"
        >
          <Home className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => refetch()}
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => openNewFileDialog()}
          title="New file"
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => openNewFolderDialog()}
          title="New folder"
        >
          <FolderPlus className="h-4 w-4" />
        </Button>
      </div>

      {/* Breadcrumb */}
      {pathParts.length > 0 && (
        <div className="flex items-center gap-1 border-b px-2 py-1 text-sm">
          <button
            className="text-muted-foreground hover:text-foreground"
            onClick={() => setCurrentPath("")}
          >
            root
          </button>
          {pathParts.map((part, index) => (
            <span key={index} className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
              <button
                className="text-muted-foreground hover:text-foreground"
                onClick={() =>
                  setCurrentPath(pathParts.slice(0, index + 1).join("/"))
                }
              >
                {part}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* File List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {files && files.length > 0 ? (
            renderFileTree(files)
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Folder className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">
                This folder is empty
              </p>
              <div className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openNewFileDialog()}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  New File
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openNewFolderDialog()}
                >
                  <FolderPlus className="mr-2 h-4 w-4" />
                  New Folder
                </Button>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* New File Dialog */}
      <Dialog open={isNewFileDialogOpen} onOpenChange={setIsNewFileDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New File</DialogTitle>
            <DialogDescription>
              {newItemParentPath
                ? `Create a new file in "${newItemParentPath}"`
                : "Create a new file in the root directory"}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="filename.js"
              value={newItemName}
              onChange={e => setNewItemName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCreateFile()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsNewFileDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateFile} disabled={!newItemName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Folder Dialog */}
      <Dialog
        open={isNewFolderDialogOpen}
        onOpenChange={setIsNewFolderDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>
              {newItemParentPath
                ? `Create a new folder in "${newItemParentPath}"`
                : "Create a new folder in the root directory"}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="folder-name"
              value={newItemName}
              onChange={e => setNewItemName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCreateFolder()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsNewFolderDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateFolder} disabled={!newItemName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
