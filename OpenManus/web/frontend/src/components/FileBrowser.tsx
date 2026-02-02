import { useState, useCallback, useRef } from "react";

export interface FileItem {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
}

interface FileBrowserProps {
  sessionId: string;
  files: FileItem[];
  currentPath: string;
  onNavigate: (path: string) => void;
  onRefresh: () => void;
  onOpenFile?: (path: string) => void;
}

interface UploadStatus {
  uploading: boolean;
  progress: number;
  error?: string;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(name: string, isDir: boolean): string {
  if (isDir) return "📁";
  const ext = name.split(".").pop()?.toLowerCase();
  const icons: Record<string, string> = {
    py: "🐍",
    js: "📜",
    ts: "📘",
    tsx: "⚛️",
    jsx: "⚛️",
    html: "🌐",
    css: "🎨",
    json: "📋",
    md: "📝",
    txt: "📄",
    png: "🖼️",
    jpg: "🖼️",
    jpeg: "🖼️",
    gif: "🖼️",
    svg: "🖼️",
    pdf: "📕",
    zip: "📦",
    sh: "⚡",
  };
  return icons[ext || ""] || "📄";
}

export function FileBrowser({
  sessionId,
  files,
  currentPath,
  onNavigate,
  onRefresh,
  onOpenFile,
}: FileBrowserProps) {
  const [viewMode, setViewMode] = useState<"list" | "tree">("list");
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({
    uploading: false,
    progress: 0,
  });
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(
    async (filesToUpload: FileList | null) => {
      if (!filesToUpload || filesToUpload.length === 0) return;

      setUploadStatus({ uploading: true, progress: 0 });

      const formData = new FormData();
      for (let i = 0; i < filesToUpload.length; i++) {
        formData.append("files", filesToUpload[i]);
      }

      try {
        const response = await fetch(
          `/api/sessions/${sessionId}/files/upload-multiple?path=${encodeURIComponent(currentPath)}`,
          {
            method: "POST",
            body: formData,
          }
        );

        if (!response.ok) {
          throw new Error("Upload failed");
        }

        setUploadStatus({ uploading: false, progress: 100 });
        onRefresh();
      } catch (error) {
        setUploadStatus({
          uploading: false,
          progress: 0,
          error: error instanceof Error ? error.message : "Upload failed",
        });
      }
    },
    [sessionId, currentPath, onRefresh]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleUpload(e.dataTransfer.files);
    },
    [handleUpload]
  );

  const handleDownload = useCallback(
    async (file: FileItem) => {
      if (file.is_dir) return;
      const url = `/api/sessions/${sessionId}/files/download?path=${encodeURIComponent(file.path)}`;
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    [sessionId]
  );

  const handleNavigate = useCallback(
    (file: FileItem) => {
      if (file.is_dir) {
        onNavigate(file.path);
      }
    },
    [onNavigate]
  );

  const goUp = useCallback(() => {
    const parts = currentPath.split("/").filter(Boolean);
    parts.pop();
    onNavigate(parts.length > 0 ? "/" + parts.join("/") : "");
  }, [currentPath, onNavigate]);

  const breadcrumbs = currentPath.split("/").filter(Boolean);

  const sortedFiles = [...files].sort((a, b) => {
    if (a.is_dir && !b.is_dir) return -1;
    if (!a.is_dir && b.is_dir) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div
      className={`flex flex-col h-full bg-zinc-800/50 rounded-lg border overflow-hidden transition-colors ${
        isDragging ? "border-blue-500 bg-blue-500/10" : "border-zinc-700/50"
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={e => handleUpload(e.target.files)}
      />

      <div className="px-3 py-2 border-b border-zinc-700/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">📂</span>
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Files
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 text-zinc-500 hover:text-blue-400 hover:bg-zinc-700/50 rounded transition-colors"
            title="Upload files"
            disabled={uploadStatus.uploading}
          >
            {uploadStatus.uploading ? "⏳" : "⬆️"}
          </button>
          <button
            onClick={() => setViewMode(viewMode === "list" ? "tree" : "list")}
            className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50 rounded transition-colors"
            title={viewMode === "list" ? "Tree view" : "List view"}
          >
            {viewMode === "list" ? "🌳" : "📋"}
          </button>
          <button
            onClick={onRefresh}
            className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50 rounded transition-colors"
            title="Refresh"
          >
            🔄
          </button>
        </div>
      </div>

      {uploadStatus.error && (
        <div className="px-3 py-2 bg-red-500/10 border-b border-red-500/30 text-red-400 text-xs">
          {uploadStatus.error}
        </div>
      )}

      <div className="px-3 py-1.5 border-b border-zinc-700/30 flex items-center gap-1 text-xs overflow-x-auto">
        <button
          onClick={() => onNavigate("")}
          className="text-zinc-400 hover:text-white transition-colors shrink-0"
        >
          /
        </button>
        {breadcrumbs.map((part, i) => (
          <span key={i} className="flex items-center gap-1 shrink-0">
            <span className="text-zinc-600">/</span>
            <button
              onClick={() =>
                onNavigate("/" + breadcrumbs.slice(0, i + 1).join("/"))
              }
              className="text-zinc-400 hover:text-white transition-colors"
            >
              {part}
            </button>
          </span>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-0.5 scrollbar-thin">
        {currentPath && (
          <button
            onClick={goUp}
            className="w-full flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-zinc-700/50 transition-colors text-left group"
          >
            <span className="text-sm">⬆️</span>
            <span className="text-sm text-zinc-400 group-hover:text-zinc-200">
              ..
            </span>
          </button>
        )}

        {isDragging && (
          <div className="absolute inset-0 flex items-center justify-center bg-blue-500/10 backdrop-blur-sm z-10">
            <div className="flex flex-col items-center gap-2 text-blue-400">
              <span className="text-3xl">⬆️</span>
              <span className="text-sm font-medium">Drop files to upload</span>
            </div>
          </div>
        )}

        {sortedFiles.length === 0 && !currentPath ? (
          <div className="flex flex-col items-center justify-center py-8 text-zinc-600">
            <div
              className="w-16 h-16 mb-3 rounded-lg border-2 border-zinc-700 border-dashed flex items-center justify-center cursor-pointer hover:border-zinc-500 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <span className="text-2xl">⬆️</span>
            </div>
            <p className="text-sm">No files yet</p>
            <p className="text-xs text-zinc-700 mt-1">
              Drop files here or click to upload
            </p>
          </div>
        ) : (
          sortedFiles.map(file => (
            <div
              key={file.path}
              className="w-full flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-zinc-700/50 transition-colors group"
            >
              <span className="text-sm">
                {getFileIcon(file.name, file.is_dir)}
              </span>
              <button
                onClick={() => {
                  if (file.is_dir) {
                    handleNavigate(file);
                  } else if (onOpenFile) {
                    onOpenFile(file.path);
                  }
                }}
                className="flex-1 text-left text-sm text-zinc-300 group-hover:text-white truncate"
              >
                {file.name}
              </button>
              <span className="text-xs text-zinc-600 tabular-nums shrink-0">
                {formatSize(file.size)}
              </span>
              {!file.is_dir && (
                <>
                  {onOpenFile && (
                    <button
                      onClick={() => onOpenFile(file.path)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-blue-400 transition-all"
                      title="Open in editor"
                    >
                      📝
                    </button>
                  )}
                  <button
                    onClick={() => handleDownload(file)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-zinc-300 transition-all"
                    title="Download"
                  >
                    ⬇️
                  </button>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {files.some(f => !f.is_dir) && (
        <div className="p-2 border-t border-zinc-700/30">
          <button
            className="w-full py-2 px-3 bg-zinc-700/50 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-2"
            title="Coming soon"
            disabled
          >
            <span>📦</span>
            <span>Download All as ZIP</span>
          </button>
        </div>
      )}
    </div>
  );
}
