import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  File as FileIcon,
  Image as ImageIcon,
  FileText,
  Music,
  Video,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Code,
  Archive,
  FileSpreadsheet,
  MonitorPlay,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

export interface ProcessedFile {
  id?: string;
  originalName: string;
  mimeType: string;
  category:
    | "image"
    | "pdf"
    | "video"
    | "audio"
    | "document"
    | "spreadsheet"
    | "presentation"
    | "code"
    | "archive"
    | "unknown";
  size: number;
  downloadUrl?: string;
  content?: string;
  hasAnalysis?: boolean;
}

interface FileUploadProps {
  onUpload: (files: ProcessedFile[], context?: string) => void;
  disabled?: boolean;
  className?: string;
  maxFiles?: number;
}

interface FileState {
  file: File;
  id: string;
  status: "pending" | "uploading" | "processing" | "complete" | "error";
  progress: number;
  error?: string;
  processed?: ProcessedFile;
}

const getFileIcon = (file: File | ProcessedFile) => {
  const type = file instanceof File ? file.type : file.mimeType;
  const name = file instanceof File ? file.name : file.originalName;
  const ext = name.split(".").pop()?.toLowerCase() || "";

  if (
    type.startsWith("image/") ||
    ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)
  ) {
    return { icon: ImageIcon, color: "text-pink-400", bg: "bg-pink-500/10" };
  }
  if (type.startsWith("video/") || ["mp4", "webm", "mov"].includes(ext)) {
    return { icon: Video, color: "text-violet-400", bg: "bg-violet-500/10" };
  }
  if (type.startsWith("audio/") || ["mp3", "wav", "ogg"].includes(ext)) {
    return { icon: Music, color: "text-cyan-400", bg: "bg-cyan-500/10" };
  }
  if (type === "application/pdf" || ext === "pdf") {
    return { icon: FileText, color: "text-red-400", bg: "bg-red-500/10" };
  }
  if (
    type.includes("spreadsheet") ||
    type.includes("excel") ||
    ["csv", "xlsx", "xls"].includes(ext)
  ) {
    return {
      icon: FileSpreadsheet,
      color: "text-green-400",
      bg: "bg-green-500/10",
    };
  }
  if (
    type.includes("presentation") ||
    type.includes("powerpoint") ||
    ["pptx", "ppt"].includes(ext)
  ) {
    return {
      icon: MonitorPlay,
      color: "text-orange-400",
      bg: "bg-orange-500/10",
    };
  }
  if (
    type.includes("zip") ||
    type.includes("compressed") ||
    type.includes("tar") ||
    ["zip", "rar", "7z", "tar", "gz"].includes(ext)
  ) {
    return { icon: Archive, color: "text-yellow-400", bg: "bg-yellow-500/10" };
  }
  if (
    type.includes("json") ||
    type.includes("javascript") ||
    type.includes("typescript") ||
    [
      "js",
      "ts",
      "tsx",
      "jsx",
      "json",
      "html",
      "css",
      "py",
      "rs",
      "go",
      "java",
    ].includes(ext)
  ) {
    return { icon: Code, color: "text-blue-400", bg: "bg-blue-500/10" };
  }
  return { icon: FileIcon, color: "text-slate-400", bg: "bg-slate-500/10" };
};

export function FileUpload({
  onUpload,
  disabled = false,
  className,
  maxFiles = 10,
}: FileUploadProps) {
  const [files, setFiles] = useState<FileState[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) setIsDragging(true);
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const processFiles = useCallback(
    async (newFiles: File[]) => {
      if (disabled) return;

      const validFiles = newFiles.slice(0, maxFiles - files.length);
      if (validFiles.length === 0) return;

      const fileStates: FileState[] = validFiles.map(file => ({
        file,
        id: Math.random().toString(36).substring(7),
        status: "pending",
        progress: 0,
      }));

      setFiles(prev => [...prev, ...fileStates]);

      const formData = new FormData();
      validFiles.forEach(file => formData.append("files", file));

      setFiles(prev =>
        prev.map(f =>
          fileStates.find(fs => fs.id === f.id)
            ? { ...f, status: "uploading", progress: 0 }
            : f
        )
      );

      try {
        const progressInterval = setInterval(() => {
          setFiles(prev =>
            prev.map(f =>
              fileStates.find(fs => fs.id === f.id) && f.status === "uploading"
                ? { ...f, progress: Math.min(f.progress + 10, 90) }
                : f
            )
          );
        }, 200);

        const response = await fetch("/api/files/upload", {
          method: "POST",
          body: formData,
        });

        clearInterval(progressInterval);

        const result = await response.json();

        if (result.success && result.processed) {
          setFiles(prev =>
            prev.map(f => {
              const processedFile = result.processed.find(
                (pf: ProcessedFile) => pf.originalName === f.file.name
              );
              if (fileStates.find(fs => fs.id === f.id)) {
                return {
                  ...f,
                  status: processedFile ? "complete" : "error",
                  progress: 100,
                  processed: processedFile,
                  error: processedFile ? undefined : "Processing failed",
                };
              }
              return f;
            })
          );

          const successFiles = result.processed;
          if (successFiles.length > 0) {
            onUpload(successFiles, result.context);
            toast.success(`Successfully uploaded ${successFiles.length} files`);
          }
        } else {
          throw new Error(result.error || "Upload failed");
        }
      } catch (error) {
        console.error("Upload error:", error);
        setFiles(prev =>
          prev.map(f =>
            fileStates.find(fs => fs.id === f.id)
              ? { ...f, status: "error", error: "Upload failed", progress: 0 }
              : f
          )
        );
        toast.error("Failed to upload files");
      }
    },
    [disabled, files.length, maxFiles, onUpload]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (disabled) return;

      const droppedFiles = Array.from(e.dataTransfer.files);
      processFiles(droppedFiles);
    },
    [disabled, processFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        const selectedFiles = Array.from(e.target.files);
        processFiles(selectedFiles);
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [processFiles]
  );

  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  return (
    <div className={cn("w-full space-y-4", className)}>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={cn(
          "relative border-2 border-dashed rounded-xl p-8 transition-all duration-200 cursor-pointer group overflow-hidden",
          isDragging
            ? "border-purple-500 bg-purple-500/10 scale-[0.99]"
            : "border-border/40 bg-muted/5 hover:bg-muted/10 hover:border-purple-500/50",
          disabled &&
            "opacity-50 cursor-not-allowed hover:bg-transparent hover:border-border/40"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          onChange={handleFileSelect}
          disabled={disabled}
        />

        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

        <div className="flex flex-col items-center justify-center text-center gap-3 relative z-10">
          <div
            className={cn(
              "p-3 rounded-full bg-muted/20 transition-all duration-300 group-hover:scale-110",
              isDragging
                ? "bg-purple-500/20 text-purple-400"
                : "text-muted-foreground group-hover:text-purple-400 group-hover:bg-purple-500/10"
            )}
          >
            <Upload className="w-6 h-6" />
          </div>
          <div>
            <p className="font-medium text-foreground">
              Drop files here or click to upload
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Support for images, documents, audio, video & more
            </p>
          </div>
        </div>
      </div>

      <AnimatePresence mode="popLayout">
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <ScrollArea className="max-h-[300px] w-full rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm p-1">
              <div className="space-y-1 p-2">
                {files.map(fileState => {
                  const { icon: Icon, color, bg } = getFileIcon(fileState.file);
                  return (
                    <motion.div
                      key={fileState.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="group relative flex items-center gap-3 p-3 rounded-lg border border-border/40 bg-muted/10 hover:bg-muted/20 transition-all"
                    >
                      <div
                        className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                          bg,
                          color
                        )}
                      >
                        {fileState.status === "uploading" ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : fileState.status === "processing" ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : fileState.status === "complete" ? (
                          <Icon className="w-5 h-5" />
                        ) : fileState.status === "error" ? (
                          <AlertCircle className="w-5 h-5" />
                        ) : (
                          <Icon className="w-5 h-5" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium truncate max-w-[200px]">
                            {fileState.file.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {(fileState.file.size / 1024 / 1024).toFixed(2)} MB
                          </span>
                        </div>

                        <div className="relative h-1.5 w-full bg-muted/20 rounded-full overflow-hidden">
                          {fileState.status === "complete" ? (
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: "100%" }}
                              className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-500"
                            />
                          ) : fileState.status === "error" ? (
                            <div className="absolute inset-0 bg-red-500/50" />
                          ) : (
                            <motion.div
                              className="absolute inset-0 bg-gradient-to-r from-purple-500 to-cyan-500"
                              initial={{ width: 0 }}
                              animate={{ width: `${fileState.progress}%` }}
                              transition={{ duration: 0.2 }}
                            />
                          )}
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 ml-2"
                        onClick={() => removeFile(fileState.id)}
                      >
                        {fileState.status === "complete" ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                          <X className="w-4 h-4" />
                        )}
                      </Button>
                    </motion.div>
                  );
                })}
              </div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
