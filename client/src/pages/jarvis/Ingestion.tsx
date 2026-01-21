import Layout from "@/components/JarvisLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, FileCode, Copy, Check } from "lucide-react";
import { useState, useEffect } from "react";

interface Chunk {
  id: number;
  title: string;
  filename: string;
  url: string;
}

export default function Ingestion() {
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch("/chunks/manifest.json")
      .then(res => res.json())
      .then(data => setChunks(data))
      .catch(err => console.error("Failed to load chunks", err));
  }, []);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const getFullUrl = (path: string) => {
    return `${window.location.origin}${path}`;
  };

  return (
    <Layout>
      <div className="space-y-10">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight font-mono">
              OpenCode Ingestion Hub
            </h1>
            <Badge
              variant="outline"
              className="font-mono border-primary text-primary"
            >
              MACHINE READABLE
            </Badge>
          </div>
          <p className="text-lg text-muted-foreground">
            Optimized formats and modular chunks for AI ingestion. Use these
            links to feed the plan to OpenCode.
          </p>
        </div>

        {/* Full Downloads */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold tracking-tight font-mono border-b border-border pb-2">
            Full Specification
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-card/50 border-border hover:border-primary/50 transition-colors">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-mono flex items-center gap-2">
                  <FileCode className="h-5 w-5 text-blue-400" />
                  Markdown
                </CardTitle>
                <CardDescription>Best for LLM Context</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button
                    className="w-full gap-2"
                    variant="secondary"
                    onClick={() =>
                      window.open("/downloads/jarvis_v3_full.md", "_blank")
                    }
                  >
                    <Download className="h-4 w-4" /> Download
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() =>
                      copyToClipboard(
                        getFullUrl("/downloads/jarvis_v3_full.md"),
                        "full-md"
                      )
                    }
                  >
                    {copied === "full-md" ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-border hover:border-primary/50 transition-colors">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-mono flex items-center gap-2">
                  <FileText className="h-5 w-5 text-gray-400" />
                  Plain Text
                </CardTitle>
                <CardDescription>Stripped formatting</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button
                    className="w-full gap-2"
                    variant="secondary"
                    onClick={() =>
                      window.open("/downloads/jarvis_v3_full.txt", "_blank")
                    }
                  >
                    <Download className="h-4 w-4" /> Download
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() =>
                      copyToClipboard(
                        getFullUrl("/downloads/jarvis_v3_full.txt"),
                        "full-txt"
                      )
                    }
                  >
                    {copied === "full-txt" ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Modular Chunks */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold tracking-tight font-mono border-b border-border pb-2">
            Modular Chunks
          </h2>
          <p className="text-sm text-muted-foreground">
            Use these individual modules if the full plan exceeds context
            limits.
          </p>

          <div className="grid gap-4">
            {chunks.map(chunk => (
              <div
                key={chunk.id}
                className="flex items-center justify-between p-4 rounded-lg border border-border bg-card/30 hover:bg-card/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <Badge
                    variant="outline"
                    className="font-mono w-12 justify-center"
                  >
                    {chunk.id.toString().padStart(2, "0")}
                  </Badge>
                  <span className="font-medium font-mono text-sm md:text-base truncate max-w-[200px] md:max-w-md">
                    {chunk.title}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="font-mono text-xs hidden md:flex"
                    onClick={() => window.open(chunk.url, "_blank")}
                  >
                    VIEW RAW
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={() =>
                      copyToClipboard(
                        getFullUrl(chunk.url),
                        `chunk-${chunk.id}`
                      )
                    }
                  >
                    {copied === `chunk-${chunk.id}` ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    <span className="hidden md:inline">COPY URL</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Layout>
  );
}
