import { useState } from "react";
import {
  FileText,
  Image as ImageIcon,
  // FileCode,
  FileJson,
  // File,
  ExternalLink,
  Download,
  Maximize2,
  X,
  // FileSpreadsheet,
  // FileVideo,
  FileAudio,
  Archive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Streamdown } from "streamdown";

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

// Image Preview Component
function ImagePreview({ src }: { src: string }) {
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div className="flex items-center gap-2 p-3 rounded bg-muted/50 text-muted-foreground">
        <ImageIcon className="h-4 w-4" />
        <span className="text-sm">Failed to load image</span>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-400 hover:underline text-sm ml-2"
        >
          Open URL
        </a>
      </div>
    );
  }

  return (
    <>
      <div className="relative group">
        <img
          src={src}
          alt="Generated image"
          className="mt-2 rounded max-w-full max-h-64 object-contain cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => setFullscreen(true)}
          onError={() => setError(true)}
        />
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
          <Button
            variant="secondary"
            size="sm"
            className="h-7 px-2"
            onClick={() => setFullscreen(true)}
          >
            <Maximize2 className="h-3 w-3" />
          </Button>
          <Button variant="secondary" size="sm" className="h-7 px-2" asChild>
            <a href={src} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
          <Button variant="secondary" size="sm" className="h-7 px-2" asChild>
            <a href={src} download>
              <Download className="h-3 w-3" />
            </a>
          </Button>
        </div>
      </div>

      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 bg-black/90">
          <DialogTitle className="sr-only">Image Preview</DialogTitle>
          <div className="relative flex items-center justify-center p-4">
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2 text-white hover:bg-white/20"
              onClick={() => setFullscreen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
            <img
              src={src}
              alt="Generated image fullscreen"
              className="max-w-full max-h-[85vh] object-contain"
            />
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
  const isPdf = filename.endsWith(".pdf");
  const isImage = /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(filename);

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

// Main Preview Component
export function ToolOutputPreview({
  toolName,
  output,
  input,
}: ToolOutputPreviewProps) {
  if (
    toolName === "write_file" &&
    output.toLowerCase().includes("file written")
  ) {
    return <FileWritePreview output={output} input={input} />;
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
