"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronLeft,
  ChevronDown,
  Code2,
  Copy,
  Database,
  Download,
  FileText,
  Globe,
  Play,
  Table2,
  Type,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MarkdownRenderer } from "@/components/shared/MarkdownRenderer";
import { BrowserFrame } from "@/components/shared/BrowserFrame";
import { CodeSandbox } from "@/components/sandbox/CodeSandbox";
import { useChatStore } from "@/lib/store";
import {
  exportAsCSV,
  exportAsHTML,
  exportAsMarkdown,
  exportAsText,
} from "@/lib/exportUtils";
import {
  type Artifact,
  type ArtifactType,
  useArtifactStore,
} from "@/lib/artifactStore";
import { cn } from "@/lib/utils";

const extMap: Record<string, string> = {
  python: ".py",
  javascript: ".js",
  typescript: ".ts",
  tsx: ".tsx",
  jsx: ".jsx",
  html: ".html",
  css: ".css",
  json: ".json",
  bash: ".sh",
  sh: ".sh",
  shell: ".sh",
  sql: ".sql",
  rust: ".rs",
  go: ".go",
  java: ".java",
  cpp: ".cpp",
  c: ".c",
  ruby: ".rb",
  php: ".php",
  yaml: ".yml",
  yml: ".yml",
  markdown: ".md",
  md: ".md",
  xml: ".xml",
  swift: ".swift",
  kotlin: ".kt",
  scala: ".scala",
  r: ".r",
  dockerfile: ".dockerfile",
  makefile: ".makefile",
  toml: ".toml",
  ini: ".ini",
};

const browserLanguages = new Set(["browser", "webpage", "html-preview"]);

const isValidUrl = (value?: string) => {
  if (!value) return false;
  try {
    const parsed = new URL(value.trim());
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
};

const parseBrowserPayload = (raw: string) => {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const firstIndex = lines.findIndex(line => line.trim().length > 0);
  if (firstIndex === -1) return { url: undefined, content: "" };

  const firstLine = lines[firstIndex]?.trim() ?? "";
  if (isValidUrl(firstLine)) {
    const rest = lines.slice(firstIndex + 1).join("\n").trim();
    return { url: firstLine, content: rest };
  }

  return { url: undefined, content: raw.trim() };
};

const typeIconMap: Record<ArtifactType, typeof Code2> = {
  code: Code2,
  document: FileText,
  data: Database,
};

const getLineCount = (content: string) =>
  content === "" ? 0 : content.split("\n").length;

const getTimestamp = (createdAt: Date) =>
  new Date(createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

const getExportFilename = (title?: string) => {
  const base = title?.trim() || "artifact";
  const normalized = base.replace(/[^a-zA-Z0-9-_]+/g, "-");
  return normalized.replace(/^-+|-+$/g, "") || "artifact";
};

const parseCsvContent = (content: string) => {
  const lines = content.split(/\r?\n/).filter(line => line.length > 0);
  if (lines.length === 0) return { headers: ["content"], rows: [] };
  const [headerLine, ...rowLines] = lines;
  const headers = headerLine.split(",").map(cell => cell.trim());
  const rows = rowLines.map(line => line.split(",").map(cell => cell.trim()));
  return { headers, rows };
};

const parseJsonContent = (content: string) => {
  const parsed = JSON.parse(content) as unknown;
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      return { headers: ["content"], rows: [] };
    }

    if (Array.isArray(parsed[0])) {
      const headers = parsed[0].map(
        (_: unknown, index: number) => `Column ${index + 1}`
      );
      const rows = parsed.map(row =>
        Array.isArray(row) ? row.map(cell => String(cell)) : [String(row)]
      );
      return { headers, rows };
    }

    if (typeof parsed[0] === "object" && parsed[0] !== null) {
      const headerSet = new Set<string>();
      parsed.forEach(item => {
        if (typeof item === "object" && item !== null) {
          Object.keys(item as Record<string, unknown>).forEach(key => {
            headerSet.add(key);
          });
        }
      });
      const headers = Array.from(headerSet);
      const rows = parsed.map(item =>
        headers.map(header => {
          if (typeof item !== "object" || item === null) return "";
          const value = (item as Record<string, unknown>)[header];
          if (value === null || value === undefined) return "";
          if (typeof value === "object") return JSON.stringify(value);
          return String(value);
        })
      );
      return { headers, rows };
    }

    const headers = ["content"];
    const rows = parsed.map(item => [String(item)]);
    return { headers, rows };
  }

  if (typeof parsed === "object" && parsed !== null) {
    const headers = Object.keys(parsed as Record<string, unknown>);
    const rows = [
      headers.map(header => {
        const value = (parsed as Record<string, unknown>)[header];
        if (value === null || value === undefined) return "";
        if (typeof value === "object") return JSON.stringify(value);
        return String(value);
      }),
    ];
    return { headers, rows };
  }

  return { headers: ["content"], rows: [[String(parsed)]] };
};

export function ArtifactPanel() {
  const { activeSessionId } = useChatStore();
  const { artifacts, selectedArtifactId, selectArtifact } = useArtifactStore();
  const [copied, setCopied] = useState(false);
  const [sandboxArtifactId, setSandboxArtifactId] = useState<string | null>(null);
  const [dismissedSandboxId, setDismissedSandboxId] = useState<string | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  const sessionArtifacts = useMemo(() => {
    if (!activeSessionId) return [];
    return artifacts.filter((artifact) => artifact.sessionId === activeSessionId);
  }, [activeSessionId, artifacts]);

  const selectedArtifact: Artifact | undefined = sessionArtifacts.find(
    (artifact) => artifact.id === selectedArtifactId
  );

  const selectedLanguage = selectedArtifact?.language.toLowerCase() ?? "";
  const isPreviewable = ["html", "css", "javascript", "js"].includes(
    selectedLanguage
  );
  const isHtmlArtifact = selectedLanguage === "html";
  const isBrowserArtifact = browserLanguages.has(selectedLanguage);

  useEffect(() => {
    if (!selectedArtifact) {
      setSandboxArtifactId(null);
      setDismissedSandboxId(null);
      setIsExportOpen(false);
      return;
    }

    if (isHtmlArtifact && selectedArtifact.id !== dismissedSandboxId) {
      setSandboxArtifactId(selectedArtifact.id);
      return;
    }

    if (!isHtmlArtifact) {
      setSandboxArtifactId(null);
      setDismissedSandboxId(null);
    }
  }, [dismissedSandboxId, isHtmlArtifact, selectedArtifact]);

  useEffect(() => {
    if (!isExportOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!exportMenuRef.current) return;
      if (!(event.target instanceof Node)) return;
      if (!exportMenuRef.current.contains(event.target)) {
        setIsExportOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isExportOpen]);

  const handleCopy = async () => {
    if (!selectedArtifact) return;
    await navigator.clipboard.writeText(selectedArtifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!selectedArtifact) return;
    const language = selectedArtifact.language.toLowerCase();
    const ext = extMap[language] || ".txt";
    const blob = new Blob([selectedArtifact.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedArtifact.title || "artifact"}${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportOptions = useMemo(() => {
    if (!selectedArtifact) return [];

    const baseFilename = getExportFilename(selectedArtifact.title);
    const title = selectedArtifact.title || "Artifact";
    const language = selectedArtifact.language.toLowerCase();
    const options = [
      {
        id: "markdown",
        label: "📄 Markdown",
        Icon: FileText,
        onSelect: () =>
          exportAsMarkdown(selectedArtifact.content, baseFilename),
      },
      {
        id: "html",
        label: "🌐 HTML",
        Icon: Globe,
        onSelect: () =>
          exportAsHTML(selectedArtifact.content, title, baseFilename),
      },
      {
        id: "text",
        label: "📝 Plain Text",
        Icon: Type,
        onSelect: () => exportAsText(selectedArtifact.content, baseFilename),
      },
    ];

    if (selectedArtifact.type === "data") {
      options.push({
        id: "csv",
        label: "📊 CSV",
        Icon: Table2,
        onSelect: () => {
          try {
            if (language === "csv") {
              const { headers, rows } = parseCsvContent(selectedArtifact.content);
              exportAsCSV(headers, rows, baseFilename);
              return;
            }

            if (language === "json") {
              const { headers, rows } = parseJsonContent(selectedArtifact.content);
              exportAsCSV(headers, rows, baseFilename);
              return;
            }

            exportAsCSV(["content"], [[selectedArtifact.content]], baseFilename);
          } catch {
            exportAsCSV(["content"], [[selectedArtifact.content]], baseFilename);
          }
        },
      });
    }

    return options;
  }, [selectedArtifact]);

  const handlePreview = () => {
    if (!selectedArtifact) return;
    setSandboxArtifactId(selectedArtifact.id);
    setDismissedSandboxId(null);
  };

  const handleCloseSandbox = () => {
    setSandboxArtifactId(null);
    setDismissedSandboxId(selectedArtifact?.id ?? null);
  };

  const sandboxPayload = useMemo(() => {
    if (!selectedArtifact || sandboxArtifactId !== selectedArtifact.id) return null;

    if (selectedLanguage === "html") {
      const relatedArtifacts = sessionArtifacts.filter(
        (artifact) =>
          artifact.messageId === selectedArtifact.messageId &&
          artifact.id !== selectedArtifact.id
      );

      const cssBlocks = relatedArtifacts
        .filter((artifact) => artifact.language.toLowerCase() === "css")
        .map((artifact) => artifact.content)
        .join("\n\n");

      const jsBlocks = relatedArtifacts
        .filter((artifact) =>
          ["javascript", "js"].includes(artifact.language.toLowerCase())
        )
        .map((artifact) => artifact.content)
        .join("\n\n");

      return {
        html: selectedArtifact.content,
        css: cssBlocks,
        javascript: jsBlocks,
      };
    }

    if (selectedLanguage === "css") {
      return { css: selectedArtifact.content };
    }

    if (["javascript", "js"].includes(selectedLanguage)) {
      return { javascript: selectedArtifact.content };
    }

    return null;
  }, [sandboxArtifactId, selectedArtifact, selectedLanguage, sessionArtifacts]);

  const browserPayload = useMemo(() => {
    if (!selectedArtifact || !isBrowserArtifact) return null;
    return parseBrowserPayload(selectedArtifact.content);
  }, [isBrowserArtifact, selectedArtifact]);

  if (!activeSessionId || sessionArtifacts.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-muted/40 flex items-center justify-center mb-4">
          <Code2 className="w-6 h-6 text-muted-foreground/60" />
        </div>
        <p className="text-sm text-muted-foreground">
          Artifacts will appear here when ALFIE generates code or documents
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Artifacts</h3>
        </div>
        {selectedArtifact && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => selectArtifact(null)}
              className="gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => selectArtifact(null)}
              className="h-8 w-8"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-40 border-r border-border/60 bg-muted/10">
          <ScrollArea className="h-full">
            <div className="p-3 space-y-2">
              <AnimatePresence mode="popLayout">
                {sessionArtifacts.map((artifact, index) => {
                  const Icon = typeIconMap[artifact.type];
                  const isSelected = artifact.id === selectedArtifactId;
                  const timestamp = getTimestamp(artifact.createdAt);
                  const lineCount = getLineCount(artifact.content);

                  return (
                    <motion.button
                      key={artifact.id}
                      type="button"
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2, delay: index * 0.02 }}
                      onClick={() => selectArtifact(artifact.id)}
                      className={cn(
                        "w-full text-left rounded-xl border p-2.5 transition-all",
                        isSelected
                          ? "border-primary/50 bg-primary/10 shadow-sm"
                          : "border-border/50 bg-card/40 hover:bg-card/70"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <div className="w-7 h-7 rounded-lg bg-muted/60 flex items-center justify-center">
                          <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 h-5"
                            >
                              {artifact.language}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {timestamp}
                            </span>
                          </div>
                          <p className="text-xs font-medium mt-1 truncate">
                            {artifact.title}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {lineCount} lines
                          </p>
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </div>
          </ScrollArea>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedArtifact ? (
            <div className="flex-1 flex flex-col">
              <div className="p-4 border-b border-border flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {selectedArtifact.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedArtifact.language} · {getLineCount(selectedArtifact.content)} lines
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isPreviewable && (
                    <Button variant="outline" size="sm" onClick={handlePreview}>
                      <Play className="w-4 h-4" />
                      Preview
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={handleCopy}>
                    <AnimatePresence mode="wait">
                      {copied ? (
                        <motion.span
                          key="copied"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                          className="flex items-center gap-1"
                        >
                          <Check className="w-4 h-4 text-emerald-500" />
                          Copied
                        </motion.span>
                      ) : (
                        <motion.span
                          key="copy"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                          className="flex items-center gap-1"
                        >
                          <Copy className="w-4 h-4" />
                          Copy All
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownload}>
                    <Download className="w-4 h-4" />
                    Download
                  </Button>
                  <div className="relative" ref={exportMenuRef}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsExportOpen(open => !open)}
                      className="gap-1"
                    >
                      <Download className="w-4 h-4" />
                      Export
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                    {isExportOpen && (
                      <div className="absolute right-0 mt-2 w-48 rounded-lg border border-border bg-card p-1 shadow-lg">
                        {exportOptions.map(option => (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => {
                              option.onSelect();
                              setIsExportOpen(false);
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                          >
                            <option.Icon className="h-4 w-4 text-muted-foreground" />
                            <span>{option.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-4">
                  {sandboxPayload ? (
                    <CodeSandbox
                      html={sandboxPayload.html}
                      css={sandboxPayload.css}
                      javascript={sandboxPayload.javascript}
                      title={selectedArtifact.title}
                      onClose={handleCloseSandbox}
                    />
                  ) : browserPayload ? (
                    <BrowserFrame
                      url={browserPayload.url}
                      title={selectedArtifact.title}
                      content={browserPayload.content}
                      onClose={() => selectArtifact(null)}
                    />
                  ) : (
                    <MarkdownRenderer
                      content={`\`\`\`${selectedArtifact.language}\n${selectedArtifact.content}\n\`\`\``}
                      enableCopyButton={false}
                    />
                  )}
                </div>
              </ScrollArea>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center p-6">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-muted/40 flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-6 h-6 text-muted-foreground/60" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Select an artifact to preview it here
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
