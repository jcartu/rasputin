import { useState, useEffect } from "react";
import {
  FileText,
  Image as ImageIcon,
  FileJson,
  ExternalLink,
  Download,
  Maximize2,
  X,
  FileAudio,
  Archive,
  Cloud,
  Sun,
  Wind,
  Droplets,
  Eye,
  Sunrise,
  Sunset,
  Umbrella,
  Rocket,
  Loader2,
  FileCode,
  Globe,
  Sparkles,
  BarChart3,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Streamdown } from "streamdown";
import { toast } from "sonner";

interface ToolOutputPreviewProps {
  toolName: string;
  output: string;
  input?: string;
}

// Detect file type from URL or content
function detectFileType(
  output: string,
  toolName: string
): {
  type:
    | "image"
    | "pdf"
    | "code"
    | "json"
    | "markdown"
    | "csv"
    | "video"
    | "audio"
    | "archive"
    | "text"
    | "url";
  extension?: string;
  language?: string;
} {
  const lowerOutput = output.toLowerCase().trim();

  // Check for image URLs
  if (
    toolName === "generate_image" ||
    /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?|$)/i.test(lowerOutput) ||
    lowerOutput.includes("image/") ||
    (lowerOutput.startsWith("http") &&
      /\/(image|img|photo|picture)/i.test(lowerOutput))
  ) {
    return { type: "image" };
  }

  // Check for PDF
  if (
    /\.pdf(\?|$)/i.test(lowerOutput) ||
    lowerOutput.includes("application/pdf")
  ) {
    return { type: "pdf" };
  }

  // Check for video
  if (/\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(lowerOutput)) {
    return { type: "video" };
  }

  // Check for audio
  if (/\.(mp3|wav|ogg|m4a|flac)(\?|$)/i.test(lowerOutput)) {
    return { type: "audio" };
  }

  // Check for archive
  if (/\.(zip|tar|gz|rar|7z)(\?|$)/i.test(lowerOutput)) {
    return { type: "archive" };
  }

  // Check for CSV/spreadsheet
  if (
    /\.csv(\?|$)/i.test(lowerOutput) ||
    (toolName === "read_file" && output.includes(","))
  ) {
    return { type: "csv" };
  }

  // Check for JSON content
  if (output.trim().startsWith("{") || output.trim().startsWith("[")) {
    try {
      JSON.parse(output);
      return { type: "json" };
    } catch {
      // Not valid JSON
    }
  }

  // Check for Markdown
  if (
    /\.md(\?|$)/i.test(lowerOutput) ||
    (output.includes("# ") && output.includes("\n")) ||
    output.includes("```") ||
    /^\s*[-*]\s+/m.test(output)
  ) {
    return { type: "markdown" };
  }

  // Check for code files
  const codeExtensions: Record<string, string> = {
    ".py": "python",
    ".js": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".jsx": "javascript",
    ".html": "html",
    ".css": "css",
    ".json": "json",
    ".sql": "sql",
    ".sh": "bash",
    ".bash": "bash",
    ".yml": "yaml",
    ".yaml": "yaml",
    ".xml": "xml",
    ".java": "java",
    ".cpp": "cpp",
    ".c": "c",
    ".go": "go",
    ".rs": "rust",
    ".rb": "ruby",
    ".php": "php",
  };

  for (const [ext, lang] of Object.entries(codeExtensions)) {
    if (lowerOutput.includes(ext)) {
      return { type: "code", extension: ext, language: lang };
    }
  }

  // Check for code patterns in content
  if (
    toolName === "execute_python" ||
    toolName === "execute_javascript" ||
    toolName === "run_shell"
  ) {
    return {
      type: "code",
      language:
        toolName === "execute_python"
          ? "python"
          : toolName === "execute_javascript"
            ? "javascript"
            : "bash",
    };
  }

  // Check for URLs
  if (
    output.trim().startsWith("http://") ||
    output.trim().startsWith("https://")
  ) {
    return { type: "url" };
  }

  return { type: "text" };
}

function ImagePreview({ src }: { src: string }) {
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 p-6 rounded-lg bg-muted/30 border border-border">
        <ImageIcon className="h-8 w-8 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          Failed to load image
        </span>
        <Button variant="outline" size="sm" asChild>
          <a href={src} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3 w-3 mr-2" />
            Open URL
          </a>
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border border-border bg-gradient-to-b from-muted/30 to-muted/10 overflow-hidden">
        <div className="relative group">
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
              <div className="animate-pulse flex flex-col items-center gap-2">
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Loading image...
                </span>
              </div>
            </div>
          )}
          <img
            src={src}
            alt="Generated image"
            className={cn(
              "w-full max-h-[400px] object-contain cursor-pointer transition-all duration-200",
              loaded ? "opacity-100" : "opacity-0",
              "hover:scale-[1.02]"
            )}
            onClick={() => setFullscreen(true)}
            onError={() => setError(true)}
            onLoad={() => setLoaded(true)}
          />
          <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              className="h-8 px-3 bg-black/60 hover:bg-black/80 text-white border-0"
              onClick={() => setFullscreen(true)}
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="p-3 border-t border-border bg-muted/20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <ImageIcon className="h-4 w-4 text-cyan-400 shrink-0" />
            <span className="text-xs text-muted-foreground truncate">
              {src.split("/").pop() || "Generated Image"}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              asChild
            >
              <a href={src} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3 mr-1.5" />
                Open
              </a>
            </Button>
            <Button
              variant="default"
              size="sm"
              className="h-7 px-3 text-xs bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600"
              asChild
            >
              <a href={src} download>
                <Download className="h-3 w-3 mr-1.5" />
                Download
              </a>
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-border">
          <DialogTitle className="sr-only">Image Preview</DialogTitle>
          <div className="relative flex flex-col h-full">
            <div className="absolute top-3 right-3 z-10 flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="h-8 bg-black/60 hover:bg-black/80 text-white border-0"
                asChild
              >
                <a href={src} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  Open
                </a>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="h-8 bg-black/60 hover:bg-black/80 text-white border-0"
                asChild
              >
                <a href={src} download>
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Download
                </a>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="h-8 w-8 p-0 bg-black/60 hover:bg-black/80 text-white border-0"
                onClick={() => setFullscreen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 flex items-center justify-center p-6">
              <img
                src={src}
                alt="Generated image fullscreen"
                className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Code Preview with syntax highlighting
function CodePreview({
  content,
  language,
}: {
  content: string;
  language?: string;
}) {
  return (
    <div className="relative">
      {language && (
        <div className="absolute top-2 right-2 px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground">
          {language}
        </div>
      )}
      <pre
        className={cn(
          "mt-1 p-3 rounded bg-[#1e1e1e] text-sm overflow-x-auto max-h-64",
          "font-mono text-gray-300 border border-border/50"
        )}
      >
        <code>{content}</code>
      </pre>
    </div>
  );
}

// JSON Preview with formatting
function JsonPreview({ content }: { content: string }) {
  let formatted = content;
  try {
    const parsed = JSON.parse(content);
    formatted = JSON.stringify(parsed, null, 2);
  } catch {
    // Keep original if parsing fails
  }

  return (
    <div className="relative">
      <div className="absolute top-2 right-2 flex items-center gap-1">
        <FileJson className="h-3 w-3 text-yellow-400" />
        <span className="text-xs text-muted-foreground">JSON</span>
      </div>
      <pre
        className={cn(
          "mt-1 p-3 rounded bg-[#1e1e1e] text-sm overflow-x-auto max-h-64",
          "font-mono text-gray-300 border border-border/50"
        )}
      >
        <code className="text-green-400">{formatted}</code>
      </pre>
    </div>
  );
}

// Markdown Preview
function MarkdownPreview({ content }: { content: string }) {
  return (
    <div className="mt-1 p-3 rounded bg-muted/30 border border-border/50 max-h-64 overflow-y-auto prose prose-invert prose-sm max-w-none">
      <Streamdown>{content}</Streamdown>
    </div>
  );
}

// PDF Preview
function PdfPreview({ url }: { url: string }) {
  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center gap-2 p-3 rounded bg-red-500/10 border border-red-500/20">
        <FileText className="h-5 w-5 text-red-400" />
        <div className="flex-1">
          <p className="text-sm font-medium">PDF Document</p>
          <p className="text-xs text-muted-foreground truncate">{url}</p>
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" asChild>
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3 mr-1" />
              Open
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={url} download>
              <Download className="h-3 w-3 mr-1" />
              Download
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}

// Video Preview
function VideoPreview({ url }: { url: string }) {
  return (
    <div className="mt-2">
      <video
        src={url}
        controls
        className="max-w-full max-h-64 rounded border border-border/50"
      >
        Your browser does not support video playback.
      </video>
    </div>
  );
}

// Audio Preview
function AudioPreview({ url }: { url: string }) {
  return (
    <div className="mt-2 p-3 rounded bg-purple-500/10 border border-purple-500/20">
      <div className="flex items-center gap-2 mb-2">
        <FileAudio className="h-4 w-4 text-purple-400" />
        <span className="text-sm">Audio File</span>
      </div>
      <audio src={url} controls className="w-full">
        Your browser does not support audio playback.
      </audio>
    </div>
  );
}

// CSV/Table Preview
function CsvPreview({ content }: { content: string }) {
  const lines = content.trim().split("\n").slice(0, 10);
  const rows = lines.map(line => line.split(",").map(cell => cell.trim()));

  if (rows.length === 0) return null;

  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-muted/50">
            {rows[0]?.map((cell, i) => (
              <th
                key={i}
                className="border border-border/50 px-2 py-1 text-left font-medium"
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(1).map((row, i) => (
            <tr key={i} className="hover:bg-muted/30">
              {row.map((cell, j) => (
                <td key={j} className="border border-border/50 px-2 py-1">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {lines.length >= 10 && (
        <p className="text-xs text-muted-foreground mt-1">
          Showing first 10 rows...
        </p>
      )}
    </div>
  );
}

// URL Preview
function UrlPreview({ url }: { url: string }) {
  return (
    <div className="mt-2 flex items-center gap-2 p-3 rounded bg-cyan-500/10 border border-cyan-500/20">
      <ExternalLink className="h-4 w-4 text-cyan-400" />
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-cyan-400 hover:underline truncate flex-1"
      >
        {url}
      </a>
      <Button variant="outline" size="sm" asChild>
        <a href={url} target="_blank" rel="noopener noreferrer">
          Open
        </a>
      </Button>
    </div>
  );
}

// Archive Preview
function ArchivePreview({ url }: { url: string }) {
  return (
    <div className="mt-2 flex items-center gap-2 p-3 rounded bg-orange-500/10 border border-orange-500/20">
      <Archive className="h-4 w-4 text-orange-400" />
      <div className="flex-1">
        <p className="text-sm font-medium">Archive File</p>
        <p className="text-xs text-muted-foreground truncate">{url}</p>
      </div>
      <Button variant="outline" size="sm" asChild>
        <a href={url} download>
          <Download className="h-3 w-3 mr-1" />
          Download
        </a>
      </Button>
    </div>
  );
}

// Interactive Report Preview with fullscreen, PDF export, and Vercel publish
export function ReportPreview({
  output,
  toolName: _toolName,
}: {
  output: string;
  toolName: string;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [previewReady, setPreviewReady] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  // Match **Path:** first (markdown bold), then plain Path: with word boundary
  const pathMatch =
    output.match(/\*\*Path:\*\*\s*([^\n]+)/i) ||
    output.match(/(?:^|[^*])Path:\s*([^\n]+\.html)/i);
  const titleMatch =
    output.match(/\*\*Title:\*\*\s*([^\n]+)/i) ||
    output.match(/Title:\s*([^\n]+)/i);
  const themeMatch = output.match(/\*\*Theme:\*\*\s*([^\n]+)/i);
  const sectionsMatch = output.match(/\*\*Sections:\*\*\s*(\d+)/i);

  const filePath = pathMatch?.[1]?.trim();
  const title = titleMatch?.[1]?.trim() || "Report";
  const theme = themeMatch?.[1]?.trim() || "dark";
  const sectionsCount = sectionsMatch?.[1] || "?";

  if (!filePath) {
    return (
      <pre className="mt-1 p-2 rounded bg-muted/50 text-xs overflow-x-auto max-h-48 whitespace-pre-wrap">
        {output}
      </pre>
    );
  }

  const filename = filePath.split("/").pop() || "report.html";
  const relativePath = filePath.startsWith("/tmp/jarvis-workspace/")
    ? filePath.replace("/tmp/jarvis-workspace/", "")
    : filePath.startsWith("/tmp/")
      ? filePath.replace("/tmp/", "")
      : filePath.startsWith("/")
        ? filePath.substring(1)
        : filePath;
  const downloadUrl = `/api/files/workspace/${relativePath}`;

  // Auto-trigger iframe reload on mount to ensure preview loads
  useEffect(() => {
    // Force iframe refresh by changing key after a short delay
    // This ensures the iframe actually attempts to load
    const timer = setTimeout(() => {
      setIframeKey(k => k + 1);
    }, 100);
    return () => clearTimeout(timer);
  }, [downloadUrl]);

  const loadHtmlContent = async () => {
    if (htmlContent) return;
    setIsLoading(true);
    try {
      const response = await fetch(downloadUrl);
      if (response.ok) {
        const content = await response.text();
        setHtmlContent(content);
      }
    } catch (err) {
      console.error("Failed to load report:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      let contentToExport = htmlContent;
      if (!contentToExport) {
        const res = await fetch(downloadUrl);
        if (!res.ok) throw new Error("Failed to fetch report content");
        contentToExport = await res.text();
      }

      const response = await fetch("/api/files/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: contentToExport,
          filename: filename.replace(/\.html$/, ".pdf"),
        }),
      });

      if (!response.ok) throw new Error("PDF generation failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename.replace(/\.html$/, ".pdf");
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF exported successfully!");
    } catch (err) {
      console.error("PDF export failed:", err);
      toast.error(
        "PDF export failed. Try opening the report and using browser print."
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handlePublishToVercel = async () => {
    setIsPublishing(true);
    try {
      const response = await fetch("/api/jarvis/publish-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filePath,
          title,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Publish failed");
      }

      const result = await response.json();
      setPublishedUrl(result.url);
      toast.success("Published to Vercel!", {
        description: result.url,
        action: {
          label: "Open",
          onClick: () => window.open(result.url, "_blank"),
        },
      });
    } catch (err) {
      console.error("Vercel publish failed:", err);
      toast.error("Failed to publish to Vercel");
    } finally {
      setIsPublishing(false);
    }
  };

  const themeColors: Record<
    string,
    { bg: string; border: string; accent: string }
  > = {
    dark: {
      bg: "from-slate-900 to-indigo-950",
      border: "border-indigo-500/30",
      accent: "text-indigo-400",
    },
    light: {
      bg: "from-slate-100 to-indigo-100",
      border: "border-indigo-300",
      accent: "text-indigo-600",
    },
    purple: {
      bg: "from-purple-950 to-violet-950",
      border: "border-purple-500/30",
      accent: "text-purple-400",
    },
    blue: {
      bg: "from-blue-950 to-cyan-950",
      border: "border-blue-500/30",
      accent: "text-blue-400",
    },
    green: {
      bg: "from-emerald-950 to-teal-950",
      border: "border-emerald-500/30",
      accent: "text-emerald-400",
    },
  };

  const colors = themeColors[theme] || themeColors.dark;

  return (
    <>
      <div
        className={cn(
          "mt-3 rounded-xl overflow-hidden border-2",
          colors.border,
          "bg-gradient-to-br",
          colors.bg
        )}
      >
        <div className="p-4 border-b border-white/10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "p-2.5 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg",
                  "shadow-indigo-500/25"
                )}
              >
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white flex items-center gap-2">
                  {title}
                  <Sparkles className="h-4 w-4 text-yellow-400" />
                </h3>
                <p className="text-xs text-white/60 flex items-center gap-2 mt-0.5">
                  <FileCode className="h-3 w-3" />
                  {sectionsCount} sections • {theme} theme
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {publishedUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-green-500/30 text-green-400 hover:bg-green-500/10"
                  asChild
                >
                  <a
                    href={publishedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    Live
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="relative bg-white">
          <iframe
            key={iframeKey}
            src={downloadUrl}
            className="w-full h-96 border-0"
            title={title}
            onLoad={() => setIsLoading(false)}
          />
          {isLoading && (
            <div className="absolute inset-0 h-96 flex items-center justify-center bg-slate-900">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
            </div>
          )}
        </div>

        <div className="p-3 border-t border-white/10 flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-white/20 text-white hover:bg-white/10"
            onClick={() => {
              loadHtmlContent();
              setFullscreen(true);
            }}
          >
            <Maximize2 className="h-3.5 w-3.5" />
            Fullscreen
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-white/20 text-white hover:bg-white/10"
            asChild
          >
            <a href={downloadUrl} download={filename}>
              <Download className="h-3.5 w-3.5" />
              Download
            </a>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-white/20 text-white hover:bg-white/10"
            onClick={handleExportPdf}
            disabled={isExporting}
          >
            {isExporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileText className="h-3.5 w-3.5" />
            )}
            {isExporting ? "Exporting..." : "Export PDF"}
          </Button>
          <Button
            variant="default"
            size="sm"
            className="gap-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0"
            onClick={handlePublishToVercel}
            disabled={isPublishing || !!publishedUrl}
          >
            {isPublishing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : publishedUrl ? (
              <Globe className="h-3.5 w-3.5" />
            ) : (
              <Rocket className="h-3.5 w-3.5" />
            )}
            {isPublishing
              ? "Publishing..."
              : publishedUrl
                ? "Published!"
                : "Publish to Vercel"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-white/20 text-white hover:bg-white/10"
            asChild
          >
            <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              Open
            </a>
          </Button>
        </div>
      </div>

      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0 bg-black/95 border-white/10">
          <DialogTitle className="sr-only">{title}</DialogTitle>
          <div className="relative flex flex-col h-full">
            <div className="absolute top-3 right-3 z-10 flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="h-9 bg-black/60 hover:bg-black/80 text-white border-0 backdrop-blur-sm"
                asChild
              >
                <a href={downloadUrl} download={filename}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </a>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="h-9 bg-black/60 hover:bg-black/80 text-white border-0 backdrop-blur-sm"
                onClick={handleExportPdf}
                disabled={isExporting}
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                PDF
              </Button>
              {!publishedUrl && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-9 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0"
                  onClick={handlePublishToVercel}
                  disabled={isPublishing}
                >
                  {isPublishing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Rocket className="h-4 w-4 mr-2" />
                  )}
                  Publish
                </Button>
              )}
              {publishedUrl && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-9 bg-green-600 hover:bg-green-700 text-white border-0"
                  asChild
                >
                  <a
                    href={publishedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Globe className="h-4 w-4 mr-2" />
                    View Live
                  </a>
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                className="h-9 w-9 p-0 bg-black/60 hover:bg-black/80 text-white border-0 backdrop-blur-sm"
                onClick={() => setFullscreen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex-1 p-4 pt-14">
              <iframe
                src={downloadUrl}
                className="w-full h-full rounded-lg shadow-2xl bg-white"
                title={title}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Extract image URL from generate_image output
function extractImageUrl(output: string): string | null {
  // Try to extract URL from "URL: https://..." format
  const urlMatch = output.match(/URL:\s*(https?:\/\/[^\s\n]+)/i);
  if (urlMatch) {
    return urlMatch[1];
  }
  // Try to find any image URL in the output
  const imageUrlMatch = output.match(
    /(https?:\/\/[^\s\n]+\.(jpg|jpeg|png|gif|webp|svg)[^\s\n]*)/i
  );
  if (imageUrlMatch) {
    return imageUrlMatch[1];
  }
  // If output is just a URL, return it
  if (output.trim().startsWith("http")) {
    return output.trim().split("\n")[0];
  }
  return null;
}

function FileWritePreview({
  output,
  input,
}: {
  output: string;
  input?: string;
}) {
  const [isExporting, setIsExporting] = useState(false);
  const pathMatch = output.match(/File written.*?:\s*([^\s(]+)/i);
  const filePath = pathMatch?.[1];

  let parsedInput: { path?: string; content?: string } | null = null;
  try {
    parsedInput = input ? JSON.parse(input) : null;
  } catch {
    parsedInput = null;
  }

  const inputPath = parsedInput?.path;
  const finalPath = filePath || inputPath;

  if (!finalPath) {
    return (
      <pre className="mt-1 p-2 rounded bg-muted/50 text-xs overflow-x-auto max-h-48 whitespace-pre-wrap">
        {output}
      </pre>
    );
  }

  const filename = finalPath.split("/").pop() || finalPath;
  const relativePath = finalPath.startsWith("/tmp/jarvis-workspace/")
    ? finalPath.replace("/tmp/jarvis-workspace/", "")
    : finalPath.startsWith("/tmp/")
      ? finalPath.replace("/tmp/", "")
      : finalPath.startsWith("/")
        ? finalPath.substring(1)
        : finalPath;
  const downloadUrl = `/api/files/workspace/${relativePath}`;

  const isHtml = filename.endsWith(".html");
  const isMarkdown = filename.endsWith(".md");
  const isPdf = filename.endsWith(".pdf");
  const isImage = /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(filename);
  const canExportPdf = isHtml || isMarkdown;

  const iconColor = isPdf
    ? "text-red-400"
    : isHtml
      ? "text-cyan-400"
      : "text-green-400";
  const bgColor = isPdf
    ? "bg-red-500/10 border-red-500/20"
    : isHtml
      ? "bg-cyan-500/10 border-cyan-500/20"
      : "bg-green-500/10 border-green-500/20";

  const handleExportPdf = async () => {
    if (!parsedInput?.content) return;

    setIsExporting(true);
    try {
      let htmlContent = parsedInput.content;

      if (isMarkdown) {
        const { marked } = await import("marked");
        htmlContent = await marked(parsedInput.content);
      }

      const response = await fetch("/api/files/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: htmlContent,
          filename: filename.replace(/\.(html|md)$/, ".pdf"),
        }),
      });

      if (!response.ok) throw new Error("PDF generation failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename.replace(/\.(html|md)$/, ".pdf");
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={`mt-2 p-3 rounded ${bgColor} border space-y-3`}>
      <div className="flex items-center gap-2">
        <FileText className={`h-5 w-5 ${iconColor}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{filename}</p>
          <p className="text-xs text-muted-foreground truncate">{finalPath}</p>
        </div>
      </div>

      {isHtml && parsedInput?.content && (
        <div className="border border-border/50 rounded overflow-hidden">
          <iframe
            srcDoc={parsedInput.content}
            className="w-full h-64 bg-white"
            sandbox="allow-scripts"
            title={filename}
          />
        </div>
      )}

      {isImage && (
        <img
          src={downloadUrl}
          alt={filename}
          className="max-w-full max-h-64 rounded object-contain"
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" className="gap-1.5" asChild>
          <a href={downloadUrl} download={filename}>
            <Download className="h-3.5 w-3.5" />
            Download
          </a>
        </Button>
        {canExportPdf && parsedInput?.content && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleExportPdf}
            disabled={isExporting}
          >
            <FileText className="h-3.5 w-3.5" />
            {isExporting ? "Exporting..." : "Export PDF"}
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => {
            navigator.clipboard.writeText(
              `${window.location.origin}${downloadUrl}`
            );
          }}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Copy Link
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" asChild>
          <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
            <Maximize2 className="h-3.5 w-3.5" />
            Open
          </a>
        </Button>
      </div>
    </div>
  );
}

function DocumentWritePreview({
  output,
  toolName,
}: {
  output: string;
  toolName: string;
}) {
  const pathMatch = output.match(/(?:created|written)[^:]*:\s*([^\s(]+)/i);
  const filePath = pathMatch?.[1];

  if (!filePath) {
    return (
      <pre className="mt-1 p-2 rounded bg-muted/50 text-xs overflow-x-auto max-h-48 whitespace-pre-wrap">
        {output}
      </pre>
    );
  }

  const filename = filePath.split("/").pop() || filePath;
  const relativePath = filePath.startsWith("/tmp/jarvis-workspace/")
    ? filePath.replace("/tmp/jarvis-workspace/", "")
    : filePath.startsWith("/tmp/")
      ? filePath.replace("/tmp/", "")
      : filePath.startsWith("/")
        ? filePath.substring(1)
        : filePath;
  const downloadUrl = `/api/files/workspace/${relativePath}`;

  const isXlsx = toolName === "write_xlsx" || filename.endsWith(".xlsx");
  const isDocx = toolName === "write_docx" || filename.endsWith(".docx");
  const isPptx = toolName === "write_pptx" || filename.endsWith(".pptx");

  const iconColor = isXlsx
    ? "text-green-400"
    : isDocx
      ? "text-blue-400"
      : isPptx
        ? "text-orange-400"
        : "text-cyan-400";
  const bgColor = isXlsx
    ? "bg-green-500/10 border-green-500/20"
    : isDocx
      ? "bg-blue-500/10 border-blue-500/20"
      : isPptx
        ? "bg-orange-500/10 border-orange-500/20"
        : "bg-cyan-500/10 border-cyan-500/20";

  const fileTypeLabel = isXlsx
    ? "Excel Spreadsheet"
    : isDocx
      ? "Word Document"
      : isPptx
        ? "PowerPoint Presentation"
        : "Document";

  return (
    <div className={`mt-2 p-3 rounded ${bgColor} border space-y-3`}>
      <div className="flex items-center gap-2">
        <FileText className={`h-5 w-5 ${iconColor}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{filename}</p>
          <p className="text-xs text-muted-foreground">{fileTypeLabel}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" className="gap-1.5" asChild>
          <a href={downloadUrl} download={filename}>
            <Download className="h-3.5 w-3.5" />
            Download
          </a>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => {
            navigator.clipboard.writeText(
              `${window.location.origin}${downloadUrl}`
            );
          }}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Copy Link
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" asChild>
          <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
            <Maximize2 className="h-3.5 w-3.5" />
            Open
          </a>
        </Button>
      </div>
    </div>
  );
}

export interface WeatherData {
  __type: "weather";
  location: string;
  country: string;
  current: {
    temperature: number;
    feelsLike: number;
    condition: string;
    conditionIcon: string;
    humidity: number;
    windSpeed: number;
    windDirection: string;
    pressure: number;
    visibility: number;
    uvIndex: number;
    cloudCover: number;
    precipitation: number;
    sunrise?: string;
    sunset?: string;
  };
  forecast: Array<{
    date: string;
    dayName: string;
    maxTemp: number;
    minTemp: number;
    condition: string;
    icon: string;
    chanceOfRain: number;
  }>;
}

export function WeatherCard({ data }: { data: WeatherData }) {
  const isNight =
    data.current.condition.toLowerCase().includes("night") ||
    data.current.conditionIcon.includes("🌙") ||
    data.current.conditionIcon.includes("🌑");

  const bgGradient = isNight
    ? "bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#4338ca]"
    : "bg-gradient-to-br from-[#0ea5e9] via-[#3b82f6] to-[#6366f1]";

  return (
    <div className="w-full max-w-md mx-auto my-6 font-sans">
      <Card
        className={`border-0 shadow-2xl overflow-hidden ${bgGradient} text-white ring-1 ring-white/10`}
      >
        <CardContent className="p-6 relative z-10">
          <div className="absolute top-[-50px] right-[-50px] w-32 h-32 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-[-50px] left-[-50px] w-32 h-32 bg-black/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-shadow-sm">
                {data.location}
              </h2>
              <p className="text-sm font-medium text-white/80">
                {data.country}
              </p>
            </div>
            <div className="text-right">
              <div className="inline-block px-2 py-1 rounded-full bg-white/20 backdrop-blur-md text-[10px] font-bold uppercase tracking-wider mb-1">
                Current
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center mb-8">
            <div className="relative z-10">
              <span
                className="text-6xl filter drop-shadow-md animate-in zoom-in duration-500"
                role="img"
                aria-label={data.current.condition}
              >
                {data.current.conditionIcon}
              </span>
            </div>
            <div className="text-7xl font-bold tracking-tighter flex items-start mt-2 text-transparent bg-clip-text bg-gradient-to-b from-white to-white/80 filter drop-shadow-sm">
              {Math.round(data.current.temperature)}
              <span className="text-3xl mt-2 text-white/90">°</span>
            </div>
            <p className="text-lg font-medium mt-1">{data.current.condition}</p>
            <p className="text-sm font-medium text-white/70">
              Feels like {Math.round(data.current.feelsLike)}°
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-8 bg-white/10 rounded-xl p-4 backdrop-blur-md border border-white/5 shadow-inner">
            <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
              <div className="p-1.5 rounded-full bg-white/20">
                <Wind className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-white/60 uppercase tracking-wide">
                  Wind
                </p>
                <p className="text-sm font-bold">
                  {data.current.windSpeed} km/h
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
              <div className="p-1.5 rounded-full bg-white/20">
                <Droplets className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-white/60 uppercase tracking-wide">
                  Humidity
                </p>
                <p className="text-sm font-bold">{data.current.humidity}%</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
              <div className="p-1.5 rounded-full bg-white/20">
                <Eye className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-white/60 uppercase tracking-wide">
                  Visibility
                </p>
                <p className="text-sm font-bold">
                  {data.current.visibility} km
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
              <div className="p-1.5 rounded-full bg-white/20">
                <Sun className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-white/60 uppercase tracking-wide">
                  UV Index
                </p>
                <p className="text-sm font-bold">{data.current.uvIndex}</p>
              </div>
            </div>
            {data.current.sunrise && (
              <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
                <div className="p-1.5 rounded-full bg-white/20">
                  <Sunrise className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-white/60 uppercase tracking-wide">
                    Sunrise
                  </p>
                  <p className="text-sm font-bold">{data.current.sunrise}</p>
                </div>
              </div>
            )}
            {data.current.sunset && (
              <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
                <div className="p-1.5 rounded-full bg-white/20">
                  <Sunset className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-white/60 uppercase tracking-wide">
                    Sunset
                  </p>
                  <p className="text-sm font-bold">{data.current.sunset}</p>
                </div>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-xs font-bold text-white/70 mb-3 uppercase tracking-wider flex items-center gap-2">
              <Cloud className="w-3.5 h-3.5" /> 5-Day Forecast
            </h3>
            <div className="flex justify-between items-stretch gap-2">
              {data.forecast.map((day, idx) => (
                <div
                  key={idx}
                  className="flex flex-col items-center justify-between gap-2 p-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors backdrop-blur-sm flex-1 min-w-[3.5rem]"
                >
                  <span className="text-[10px] font-bold text-white/90">
                    {idx === 0 ? "Today" : day.dayName.substring(0, 3)}
                  </span>
                  <div className="flex flex-col items-center gap-1 my-1">
                    <span
                      role="img"
                      aria-label={day.condition}
                      className="text-xl filter drop-shadow-sm"
                    >
                      {day.icon}
                    </span>
                    {day.chanceOfRain > 0 && (
                      <div className="text-[9px] text-blue-200 font-bold flex items-center bg-blue-500/20 px-1.5 py-0.5 rounded-full">
                        <Umbrella className="w-2 h-2 mr-0.5" />
                        {day.chanceOfRain}%
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-center w-full">
                    <span className="text-sm font-bold">
                      {Math.round(day.maxTemp)}°
                    </span>
                    <div className="w-full h-0.5 bg-white/10 rounded-full my-0.5" />
                    <span className="text-xs text-white/60">
                      {Math.round(day.minTemp)}°
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function ToolOutputPreview({
  toolName,
  output,
  input,
}: ToolOutputPreviewProps) {
  if (toolName === "get_weather") {
    try {
      const data = JSON.parse(output);
      if (data.__type === "weather") {
        return <WeatherCard data={data} />;
      }
    } catch {
      // Fall through to default rendering if JSON parsing fails
    }
  }

  if (
    (toolName === "generate_interactive_report" ||
      toolName === "create_rich_report") &&
    (output.includes("report") || output.includes("Report")) &&
    (output.includes(".html") || output.includes("Path:"))
  ) {
    return <ReportPreview output={output} toolName={toolName} />;
  }

  if (
    toolName === "write_file" &&
    output.toLowerCase().includes("file written")
  ) {
    return <FileWritePreview output={output} input={input} />;
  }

  if (
    (toolName === "write_xlsx" ||
      toolName === "write_docx" ||
      toolName === "write_pptx") &&
    (output.toLowerCase().includes("created") ||
      output.toLowerCase().includes("written"))
  ) {
    return <DocumentWritePreview output={output} toolName={toolName} />;
  }

  const fileInfo = detectFileType(output, toolName);

  switch (fileInfo.type) {
    case "image": {
      const imageUrl =
        toolName === "generate_image"
          ? extractImageUrl(output) || output.trim()
          : output.trim();
      return <ImagePreview src={imageUrl} />;
    }

    case "pdf":
      return <PdfPreview url={output.trim()} />;

    case "video":
      return <VideoPreview url={output.trim()} />;

    case "audio":
      return <AudioPreview url={output.trim()} />;

    case "archive":
      return <ArchivePreview url={output.trim()} />;

    case "json":
      return <JsonPreview content={output} />;

    case "markdown":
      return <MarkdownPreview content={output} />;

    case "code":
      return <CodePreview content={output} language={fileInfo.language} />;

    case "csv":
      return <CsvPreview content={output} />;

    case "url":
      return <UrlPreview url={output.trim()} />;

    default:
      return (
        <pre className="mt-1 p-2 rounded bg-muted/50 text-xs overflow-x-auto max-h-48 whitespace-pre-wrap">
          {output}
        </pre>
      );
  }
}

export default ToolOutputPreview;
