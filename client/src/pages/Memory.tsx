import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Brain,
  Database,
  Lightbulb,
  BookOpen,
  Cog,
  Search,
  RefreshCw,
  ArrowLeft,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Link } from "wouter";

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Memory() {
  const [searchQuery, setSearchQuery] = useState("");
  const [episodicPage, setEpisodicPage] = useState(0);
  const [semanticPage, setSemanticPage] = useState(0);
  const [proceduralPage, setProceduralPage] = useState(0);
  const pageSize = 10;

  const statsQuery = trpc.memory.getStats.useQuery();
  const qdrantQuery = trpc.memory.getQdrantCollections.useQuery();

  const episodicQuery = trpc.memory.listEpisodic.useQuery({
    limit: pageSize,
    offset: episodicPage * pageSize,
  });

  const semanticQuery = trpc.memory.listSemantic.useQuery({
    limit: pageSize,
    offset: semanticPage * pageSize,
  });

  const proceduralQuery = trpc.memory.listProcedural.useQuery({
    limit: pageSize,
    offset: proceduralPage * pageSize,
  });

  const learningQuery = trpc.memory.listLearningEvents.useQuery({
    limit: 20,
    offset: 0,
  });

  const searchMutation = trpc.memory.search.useQuery(
    { query: searchQuery, limit: 20 },
    { enabled: searchQuery.length > 2 }
  );

  const stats = statsQuery.data;
  const qdrant = qdrantQuery.data;

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
                <Brain className="w-6 h-6 text-purple-400" />
                <h1 className="text-xl font-bold">JARVIS Memory</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  statsQuery.refetch();
                  qdrantQuery.refetch();
                  episodicQuery.refetch();
                  semanticQuery.refetch();
                  proceduralQuery.refetch();
                }}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-400" />
                Episodic
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.totalEpisodic ?? "—"}
              </div>
              <p className="text-xs text-muted-foreground">Task experiences</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-yellow-400" />
                Semantic
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.totalSemantic ?? "—"}
              </div>
              <p className="text-xs text-muted-foreground">Learned facts</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Cog className="w-4 h-4 text-green-400" />
                Procedural
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.totalProcedural ?? "—"}
              </div>
              <p className="text-xs text-muted-foreground">Learned skills</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Database className="w-4 h-4 text-cyan-400" />
                Qdrant Vectors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.qdrantVectors ?? "—"}
              </div>
              <p className="text-xs text-muted-foreground">
                {qdrant?.connected ? (
                  <span className="text-green-400">Connected</span>
                ) : (
                  <span className="text-red-400">Disconnected</span>
                )}
              </p>
            </CardContent>
          </Card>
        </div>

        {qdrant?.connected && qdrant.collections.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                All Qdrant Collections
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {qdrant.collections.map(c => (
                  <Badge
                    key={c.name}
                    variant={c.status === "green" ? "default" : "secondary"}
                  >
                    {c.name}: {c.vectorCount} vectors
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search memories..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {searchQuery.length > 2 && searchMutation.data && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                Search Results ({searchMutation.data.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {searchMutation.data.map((result, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-muted/50 border border-border/50"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">{result.memoryType}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(result.relevanceScore * 100)}% match
                      </span>
                    </div>
                    <p className="text-sm">
                      {"title" in result.memory
                        ? result.memory.title
                        : "name" in result.memory
                          ? result.memory.name
                          : `${result.memory.subject} ${result.memory.predicate} ${result.memory.object}`}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="episodic" className="space-y-4">
          <TabsList>
            <TabsTrigger value="episodic">
              <BookOpen className="w-4 h-4 mr-2" />
              Episodic
            </TabsTrigger>
            <TabsTrigger value="semantic">
              <Lightbulb className="w-4 h-4 mr-2" />
              Semantic
            </TabsTrigger>
            <TabsTrigger value="procedural">
              <Cog className="w-4 h-4 mr-2" />
              Procedural
            </TabsTrigger>
            <TabsTrigger value="learning">
              <Brain className="w-4 h-4 mr-2" />
              Learning Events
            </TabsTrigger>
          </TabsList>

          <TabsContent value="episodic">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  Episodic Memories ({episodicQuery.data?.total ?? 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {episodicQuery.data?.items.map(m => (
                    <div
                      key={m.id}
                      className="p-4 rounded-lg bg-muted/50 border border-border/50"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-medium">{m.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            {m.description}
                          </p>
                        </div>
                        <Badge variant="outline">{m.memoryType}</Badge>
                      </div>
                      {m.outcome && (
                        <p className="text-sm mt-2">
                          <strong>Outcome:</strong> {m.outcome}
                        </p>
                      )}
                      {m.lessons && m.lessons.length > 0 && (
                        <div className="mt-2">
                          <strong className="text-sm">Lessons:</strong>
                          <ul className="list-disc list-inside text-sm text-muted-foreground">
                            {m.lessons.map((l: string, i: number) => (
                              <li key={i}>{l}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                        <span>Importance: {m.importance}/10</span>
                        <span>•</span>
                        <span>{formatDate(m.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                  {(episodicQuery.data?.items.length ?? 0) === 0 && (
                    <p className="text-muted-foreground text-center py-8">
                      No episodic memories yet
                    </p>
                  )}
                </div>
                {(episodicQuery.data?.total ?? 0) > pageSize && (
                  <div className="flex justify-center gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={episodicPage === 0}
                      onClick={() => setEpisodicPage(p => p - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={
                        (episodicPage + 1) * pageSize >=
                        (episodicQuery.data?.total ?? 0)
                      }
                      onClick={() => setEpisodicPage(p => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="semantic">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  Semantic Memories ({semanticQuery.data?.total ?? 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {semanticQuery.data?.items.map(m => (
                    <div
                      key={m.id}
                      className="p-4 rounded-lg bg-muted/50 border border-border/50"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-medium">
                            {m.subject}{" "}
                            <span className="text-muted-foreground">
                              {m.predicate}
                            </span>{" "}
                            {m.object}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{m.category}</Badge>
                          {m.isValid ? (
                            <CheckCircle className="w-4 h-4 text-green-400" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-400" />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>
                          Confidence: {Math.round(m.confidence * 100)}%
                        </span>
                        {m.source && (
                          <>
                            <span>•</span>
                            <span>Source: {m.source}</span>
                          </>
                        )}
                        <span>•</span>
                        <span>{formatDate(m.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                  {(semanticQuery.data?.items.length ?? 0) === 0 && (
                    <p className="text-muted-foreground text-center py-8">
                      No semantic memories yet
                    </p>
                  )}
                </div>
                {(semanticQuery.data?.total ?? 0) > pageSize && (
                  <div className="flex justify-center gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={semanticPage === 0}
                      onClick={() => setSemanticPage(p => p - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={
                        (semanticPage + 1) * pageSize >=
                        (semanticQuery.data?.total ?? 0)
                      }
                      onClick={() => setSemanticPage(p => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="procedural">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  Procedural Memories ({proceduralQuery.data?.total ?? 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {proceduralQuery.data?.items.map(m => (
                    <div
                      key={m.id}
                      className="p-4 rounded-lg bg-muted/50 border border-border/50"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-medium">{m.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {m.description}
                          </p>
                        </div>
                        <Badge variant={m.isActive ? "default" : "secondary"}>
                          {m.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      {m.triggerConditions &&
                        m.triggerConditions.length > 0 && (
                          <div className="mt-2">
                            <strong className="text-sm">Triggers:</strong>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {m.triggerConditions.map(
                                (t: string, i: number) => (
                                  <Badge
                                    key={i}
                                    variant="outline"
                                    className="text-xs"
                                  >
                                    {t}
                                  </Badge>
                                )
                              )}
                            </div>
                          </div>
                        )}
                      {m.steps && m.steps.length > 0 && (
                        <div className="mt-2">
                          <strong className="text-sm">
                            Steps ({m.steps.length}):
                          </strong>
                          <ol className="list-decimal list-inside text-sm text-muted-foreground mt-1">
                            {m.steps.slice(0, 3).map((s: any, i: number) => (
                              <li key={i}>{s.description || s.action}</li>
                            ))}
                            {m.steps.length > 3 && (
                              <li className="text-muted-foreground/50">
                                ...and {m.steps.length - 3} more
                              </li>
                            )}
                          </ol>
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                        <span>Success rate: {m.successRate}%</span>
                        <span>•</span>
                        <span>Executions: {m.executionCount}</span>
                        <span>•</span>
                        <span>{formatDate(m.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                  {(proceduralQuery.data?.items.length ?? 0) === 0 && (
                    <p className="text-muted-foreground text-center py-8">
                      No procedural memories yet
                    </p>
                  )}
                </div>
                {(proceduralQuery.data?.total ?? 0) > pageSize && (
                  <div className="flex justify-center gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={proceduralPage === 0}
                      onClick={() => setProceduralPage(p => p - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={
                        (proceduralPage + 1) * pageSize >=
                        (proceduralQuery.data?.total ?? 0)
                      }
                      onClick={() => setProceduralPage(p => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="learning">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  Recent Learning Events ({learningQuery.data?.total ?? 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {learningQuery.data?.items.map(e => (
                    <div
                      key={e.id}
                      className="p-4 rounded-lg bg-muted/50 border border-border/50"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium">{e.summary}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{e.eventType}</Badge>
                          {e.applied ? (
                            <CheckCircle className="w-4 h-4 text-green-400" />
                          ) : (
                            <XCircle className="w-4 h-4 text-yellow-400" />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>
                          Confidence: {Math.round(e.confidence * 100)}%
                        </span>
                        {e.impactScore && (
                          <>
                            <span>•</span>
                            <span>Impact: {e.impactScore}</span>
                          </>
                        )}
                        <span>•</span>
                        <span>{formatDate(e.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                  {(learningQuery.data?.items.length ?? 0) === 0 && (
                    <p className="text-muted-foreground text-center py-8">
                      No learning events yet
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
