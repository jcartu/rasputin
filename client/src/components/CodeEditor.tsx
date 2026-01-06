import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Save, X, FileCode, Undo, Redo, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CodeEditorProps {
  workspaceId: number;
  filePath: string;
  initialContent: string;
  onClose?: () => void;
  onSave?: (content: string) => void;
}

// Simple syntax highlighting for common languages
function getLanguageFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const langMap: Record<string, string> = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    py: "python",
    json: "json",
    html: "html",
    css: "css",
    md: "markdown",
    sh: "bash",
    yml: "yaml",
    yaml: "yaml",
  };
  return langMap[ext] || "plaintext";
}

export function CodeEditor({
  workspaceId,
  filePath,
  initialContent,
  onClose,
  onSave,
}: CodeEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<string[]>([initialContent]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const utils = trpc.useUtils();

  const writeFile = trpc.workspace.writeFile.useMutation({
    onSuccess: () => {
      setIsDirty(false);
      setIsSaving(false);
      onSave?.(content);
      utils.workspace.listFiles.invalidate({ workspaceId });
    },
    onError: () => {
      setIsSaving(false);
    },
  });

  // Update content when file changes
  useEffect(() => {
    setContent(initialContent);
    setIsDirty(false);
    setHistory([initialContent]);
    setHistoryIndex(0);
  }, [filePath, initialContent]);

  // Track changes
  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setIsDirty(newContent !== initialContent);

    // Add to history (debounced)
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newContent);
    if (newHistory.length > 50) newHistory.shift(); // Limit history
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  // Undo/Redo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setContent(history[newIndex]);
      setIsDirty(history[newIndex] !== initialContent);
    }
  }, [history, historyIndex, initialContent]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setContent(history[newIndex]);
      setIsDirty(history[newIndex] !== initialContent);
    }
  }, [history, historyIndex, initialContent]);

  // Save file
  const handleSave = useCallback(() => {
    if (!isDirty) return;
    setIsSaving(true);
    writeFile.mutate({
      workspaceId,
      path: filePath,
      content,
    });
  }, [workspaceId, filePath, content, isDirty, writeFile]);

  // Copy to clipboard
  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave, handleUndo, handleRedo]);

  const language = getLanguageFromPath(filePath);
  const fileName = filePath.split("/").pop() || filePath;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-3">
          <FileCode className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">{fileName}</span>
          {isDirty && (
            <Badge
              variant="outline"
              className="text-yellow-500 border-yellow-500"
            >
              Unsaved
            </Badge>
          )}
          <Badge variant="secondary" className="text-xs">
            {language}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleUndo}
            disabled={historyIndex === 0}
            title="Undo (Ctrl+Z)"
          >
            <Undo className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleRedo}
            disabled={historyIndex === history.length - 1}
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleCopy}
            title="Copy to clipboard"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onClose}
              title="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="relative flex-1 overflow-hidden">
        {/* Line numbers */}
        <div className="absolute left-0 top-0 bottom-0 w-12 bg-muted/50 border-r overflow-hidden">
          <div className="p-3 font-mono text-xs text-muted-foreground text-right">
            {content.split("\n").map((_, i) => (
              <div key={i} className="leading-6">
                {i + 1}
              </div>
            ))}
          </div>
        </div>

        {/* Code area */}
        <Textarea
          value={content}
          onChange={e => handleContentChange(e.target.value)}
          className={cn(
            "absolute inset-0 pl-14 pr-4 py-3 resize-none",
            "font-mono text-sm leading-6",
            "bg-transparent border-0 rounded-none",
            "focus-visible:ring-0 focus-visible:ring-offset-0",
            "whitespace-pre overflow-auto"
          )}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t px-4 py-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>Lines: {content.split("\n").length}</span>
          <span>Characters: {content.length}</span>
        </div>
        <div className="flex items-center gap-4">
          <span>{filePath}</span>
          <span>UTF-8</span>
        </div>
      </div>
    </div>
  );
}
