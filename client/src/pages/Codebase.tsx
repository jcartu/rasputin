/**
 * RAG Codebase Understanding Page
 * Index and search codebases with semantic understanding
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import {
  FolderGit2,
  Search,
  Plus,
  RefreshCw,
  FileCode,
  ArrowLeft,
  Code,
  Database,
  Sparkles,
} from "lucide-react";
import { Link } from "wouter";

// Main component
export default function Codebase() {
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectPath, setNewProjectPath] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const projectsQuery = trpc.rag.listProjects.useQuery();

  const searchResults = trpc.rag.search.useQuery(
    {
      query: searchQuery,
      projectId: selectedProjectId ?? undefined,
      limit: 10,
    },
    { enabled: searchQuery.length > 2 }
  );

  const indexMutation = trpc.rag.indexProject.useMutation({
    onSuccess: () => {
      toast.success("Project indexing started");
      setDialogOpen(false);
      setNewProjectName("");
      setNewProjectPath("");
      projectsQuery.refetch();
    },
    onError: err => {
      toast.error(`Failed to index project: ${err.message}`);
    },
  });

  const selectedProject = projectsQuery.data?.find(
    p => p.id === selectedProjectId
  );

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
                <Code className="w-6 h-6 text-cyan-400" />
                <h1 className="text-xl font-bold">Codebase Understanding</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => projectsQuery.refetch()}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-cyan-600 hover:bg-cyan-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Project
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-background border-border">
                  <DialogHeader>
                    <DialogTitle>Add Codebase Project</DialogTitle>
                    <DialogDescription>
                      Index a codebase for semantic search and understanding
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Project Name</Label>
                      <Input
                        value={newProjectName}
                        onChange={e => setNewProjectName(e.target.value)}
                        placeholder="My Project"
                      />
                    </div>
                    <div>
                      <Label>Path (on server)</Label>
                      <Input
                        value={newProjectPath}
                        onChange={e => setNewProjectPath(e.target.value)}
                        placeholder="/home/user/projects/my-project"
                        className="font-mono"
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={() =>
                        indexMutation.mutate({
                          name: newProjectName,
                          path: newProjectPath,
                        })
                      }
                      disabled={
                        !newProjectName ||
                        !newProjectPath ||
                        indexMutation.isPending
                      }
                    >
                      {indexMutation.isPending
                        ? "Adding..."
                        : "Add & Index Project"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Projects list */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FolderGit2 className="w-5 h-5 text-cyan-400" />
              Indexed Projects
            </h2>
            {projectsQuery.isLoading ? (
              <div className="animate-pulse">Loading projects...</div>
            ) : projectsQuery.data?.length === 0 ? (
              <Card className="bg-card/30">
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No projects indexed yet. Add one to get started.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {projectsQuery.data?.map(project => (
                  <Card
                    key={project.id}
                    className={`bg-card/50 border-border/50 cursor-pointer transition-all hover:border-cyan-400/50 ${selectedProjectId === project.id ? "ring-2 ring-cyan-400" : ""}`}
                    onClick={() => setSelectedProjectId(project.id)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FolderGit2 className="w-5 h-5 text-cyan-400" />
                          <CardTitle className="text-lg">
                            {project.name}
                          </CardTitle>
                        </div>
                        <Badge
                          variant={
                            project.status === "ready" ? "default" : "secondary"
                          }
                        >
                          {project.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Database className="w-3 h-3" />
                          {project.totalChunks ?? 0} chunks
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Search and results */}
          <div className="lg:col-span-2 space-y-6">
            {/* Search bar */}
            <Card className="bg-card/50">
              <CardContent className="pt-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search code semantically..."
                      className="pl-10"
                    />
                  </div>
                </div>
                {selectedProject && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    Searching in:{" "}
                    <span className="text-cyan-400">
                      {selectedProject.name}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Search results */}
            <div className="space-y-2">
              {searchQuery.length > 2 && searchResults.isLoading && (
                <div className="animate-pulse text-center py-4">
                  Searching...
                </div>
              )}
              {searchQuery.length > 2 && searchResults.data?.length === 0 && (
                <Card className="bg-card/30">
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    No results found for "{searchQuery}"
                  </CardContent>
                </Card>
              )}
              {searchResults.data?.map((result, idx) => (
                <Card key={idx} className="bg-card/30">
                  <CardContent className="py-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <FileCode className="w-4 h-4 text-cyan-400" />
                        <span className="font-mono text-sm">
                          {result.chunk?.filePath ?? "Unknown"}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {(result.score * 100).toFixed(1)}% match
                      </Badge>
                    </div>
                    {result.chunk?.startLine && result.chunk?.endLine && (
                      <div className="text-xs text-muted-foreground mb-2">
                        Lines {result.chunk.startLine}-{result.chunk.endLine}
                      </div>
                    )}
                    <pre className="text-xs bg-background/50 p-2 rounded overflow-x-auto max-h-32">
                      <code>{result.chunk?.content ?? ""}</code>
                    </pre>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Project stats */}
            {selectedProject && (
              <Card className="bg-card/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-cyan-400" />
                    Project Stats
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">
                        Total Chunks
                      </div>
                      <div className="text-2xl font-bold">
                        {selectedProject.totalChunks ?? 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">
                        Status
                      </div>
                      <Badge
                        variant={
                          selectedProject.status === "ready"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {selectedProject.status}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
