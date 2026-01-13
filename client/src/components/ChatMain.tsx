import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Mic,
  Loader2,
  Zap,
  Sparkles,
  Plus,
  Paperclip,
  X,
  Image as ImageIcon,
  FileText,
  Video,
  Music,
  FileSpreadsheet,
  FileCode,
  Archive,
  Presentation,
  File as FileIcon,
} from "lucide-react";
import { Streamdown } from "streamdown";
import { ModelSelector } from "./ModelSelector";
import { ExportMenu, type ExportContent } from "./ExportMenu";
import { FileUpload, type ProcessedFile } from "./FileUpload";
import type { QueryMode, SpeedTier } from "../../../shared/rasputin";

interface Message {
  id: number;
  role: string;
  content: string;
  createdAt: Date;
  summary?: string | null;
  agreementPercentage?: number | null;
  latencyMs?: number | null;
  tokenCount?: number | null;
  cost?: string | null;
}

interface ChatMainProps {
  chatId: number | null;
  messages: Message[];
  isLoading: boolean;
  isProcessing: boolean;
  mode: QueryMode;
  speedTier: SpeedTier;
  selectedModels: string[];
  onModeChange: (mode: QueryMode) => void;
  onSpeedTierChange: (tier: SpeedTier) => void;
  onSelectedModelsChange: (models: string[]) => void;
  onSubmitQuery: (query: string, fileContext?: string) => void;
  onNewChat: () => void;
}

export function ChatMain({
  chatId,
  messages,
  isLoading,
  isProcessing,
  mode,
  speedTier,
  selectedModels,
  onModeChange,
  onSpeedTierChange,
  onSelectedModelsChange,
  onSubmitQuery,
  onNewChat,
}: ChatMainProps) {
  const [inputValue, setInputValue] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<
    (ProcessedFile & { uiId?: string })[]
  >([]);
  const [fileContext, setFileContext] = useState<string>("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      // Find the actual scrollable viewport inside ScrollArea
      const viewport = scrollRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputValue]);

  const handleSubmit = () => {
    if (!inputValue.trim() || isProcessing) return;
    onSubmitQuery(inputValue.trim(), fileContext || undefined);
    setInputValue("");
    setAttachedFiles([]);
    setFileContext("");
    setShowFileUpload(false);
  };

  const handleFilesUploaded = (files: ProcessedFile[], context: string) => {
    setAttachedFiles(
      files.map(f => ({ ...f, uiId: Math.random().toString(36).slice(2) }))
    );
    setFileContext(context);
    setShowFileUpload(false);
  };

  const removeAttachedFile = (index: number) => {
    const newFiles = attachedFiles.filter((_, i) => i !== index);
    setAttachedFiles(newFiles);
    if (newFiles.length === 0) {
      setFileContext("");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const getFileStyle = (category: ProcessedFile["category"]) => {
    switch (category) {
      case "image":
        return {
          color: "text-pink-400",
          bg: "from-pink-500/10 to-rose-500/10",
          border: "border-pink-500/20",
          icon: ImageIcon,
        };
      case "video":
        return {
          color: "text-violet-400",
          bg: "from-violet-500/10 to-purple-500/10",
          border: "border-violet-500/20",
          icon: Video,
        };
      case "audio":
        return {
          color: "text-cyan-400",
          bg: "from-cyan-500/10 to-blue-500/10",
          border: "border-cyan-500/20",
          icon: Music,
        };
      case "pdf":
        return {
          color: "text-red-400",
          bg: "from-red-500/10 to-orange-500/10",
          border: "border-red-500/20",
          icon: FileText,
        };
      case "spreadsheet":
        return {
          color: "text-green-400",
          bg: "from-green-500/10 to-emerald-500/10",
          border: "border-green-500/20",
          icon: FileSpreadsheet,
        };
      case "presentation":
        return {
          color: "text-orange-400",
          bg: "from-orange-500/10 to-red-500/10",
          border: "border-orange-500/20",
          icon: Presentation,
        };
      case "code":
        return {
          color: "text-yellow-400",
          bg: "from-yellow-500/10 to-amber-500/10",
          border: "border-yellow-500/20",
          icon: FileCode,
        };
      case "archive":
        return {
          color: "text-slate-400",
          bg: "from-slate-500/10 to-gray-500/10",
          border: "border-slate-500/20",
          icon: Archive,
        };
      default:
        return {
          color: "text-blue-400",
          bg: "from-blue-500/10 to-indigo-500/10",
          border: "border-blue-500/20",
          icon: FileIcon,
        };
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Enter without shift OR Ctrl+Enter to submit
    if (e.key === "Enter" && (!e.shiftKey || e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleVoiceInput = () => {
    // Voice input will be implemented later
    setIsRecording(!isRecording);
  };

  // Empty state - no chat selected
  if (!chatId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="text-center max-w-md">
          {/* Logo */}
          <div className="mb-6">
            <svg
              width="80"
              height="50"
              viewBox="0 0 120 80"
              className="mx-auto"
            >
              <ellipse
                cx="30"
                cy="40"
                rx="20"
                ry="25"
                fill="none"
                stroke="oklch(0.75 0.18 195)"
                strokeWidth="2"
              />
              <circle cx="30" cy="40" r="8" fill="oklch(0.75 0.18 195)" />
              <circle cx="33" cy="37" r="3" fill="oklch(0.95 0.01 260)" />
              <ellipse
                cx="90"
                cy="40"
                rx="20"
                ry="25"
                fill="none"
                stroke="oklch(0.75 0.18 195)"
                strokeWidth="2"
              />
              <circle cx="90" cy="40" r="8" fill="oklch(0.75 0.18 195)" />
              <circle cx="93" cy="37" r="3" fill="oklch(0.95 0.01 260)" />
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-primary mb-2">
            Welcome to RASPUTIN
          </h2>
          <p className="text-muted-foreground mb-6">
            Query multiple frontier AI models simultaneously and get
            consensus-driven or deeply synthesized answers.
          </p>

          <Button
            onClick={onNewChat}
            className="bg-primary hover:bg-primary/90"
          >
            <Plus className="h-4 w-4 mr-2" />
            Start New Chat
          </Button>

          {/* Mode explanation */}
          <div className="mt-8 grid grid-cols-2 gap-4 text-left">
            <div className="p-4 rounded-lg bg-card border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-primary" />
                <span className="font-medium text-foreground">
                  Consensus Mode
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Query multiple models in parallel and get a consensus summary
                with agreement percentage.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-card border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-purple-400" />
                <span className="font-medium text-foreground">
                  Synthesis Mode
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Multi-stage pipeline with web search, gap detection, and
                meta-synthesis.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Messages Area */}
      <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
        <div className="max-w-4xl mx-auto p-4 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map(message => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`
                    max-w-[85%] rounded-2xl px-4 py-3
                    ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-card border border-border rounded-bl-md"
                    }
                  `}
                >
                  {message.role === "assistant" ? (
                    <div className="prose prose-invert prose-sm max-w-none">
                      <Streamdown>{message.content}</Streamdown>

                      <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          {message.agreementPercentage !== null &&
                            message.agreementPercentage !== undefined && (
                              <span className="flex items-center gap-1">
                                <span className="text-primary">
                                  {message.agreementPercentage}%
                                </span>{" "}
                                agreement
                              </span>
                            )}
                          {message.latencyMs && (
                            <span>
                              {(message.latencyMs / 1000).toFixed(1)}s
                            </span>
                          )}
                          {message.tokenCount && (
                            <span>
                              {message.tokenCount.toLocaleString()} tokens
                            </span>
                          )}
                          {message.cost && parseFloat(message.cost) > 0 && (
                            <span>${parseFloat(message.cost).toFixed(4)}</span>
                          )}
                        </div>
                        <ExportMenu
                          content={
                            {
                              title: `RASPUTIN ${mode === "consensus" ? "Consensus" : "Synthesis"} Response`,
                              content: message.content,
                              metadata: {
                                date: new Date(
                                  message.createdAt
                                ).toLocaleString(),
                                mode:
                                  mode === "consensus"
                                    ? "Consensus"
                                    : "Synthesis",
                                duration: message.latencyMs
                                  ? `${(message.latencyMs / 1000).toFixed(1)}s`
                                  : undefined,
                              },
                            } as ExportContent
                          }
                          size="sm"
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  )}
                </div>
              </div>
            ))
          )}

          {/* Processing indicator */}
          {isProcessing && (
            <div className="flex justify-start">
              <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">
                    {mode === "consensus"
                      ? "Gathering consensus..."
                      : "Synthesizing response..."}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t border-border p-4 bg-card">
        <div className="max-w-4xl mx-auto">
          {/* Mode Selector */}
          <div className="flex items-center gap-4 mb-3">
            <div className="flex items-center gap-2 bg-secondary rounded-lg p-1">
              <button
                onClick={() => onModeChange("consensus")}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium
                  transition-colors duration-150
                  ${
                    mode === "consensus"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }
                `}
              >
                <Zap className="h-3.5 w-3.5" />
                Consensus
              </button>
              <button
                onClick={() => onModeChange("synthesis")}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium
                  transition-colors duration-150
                  ${
                    mode === "synthesis"
                      ? "bg-purple-500 text-white"
                      : "text-muted-foreground hover:text-foreground"
                  }
                `}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Synthesis
              </button>
            </div>

            {/* Speed Tier */}
            <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
              {(["fast", "normal", "max"] as SpeedTier[]).map(tier => (
                <button
                  key={tier}
                  onClick={() => onSpeedTierChange(tier)}
                  className={`
                    px-2.5 py-1 rounded-md text-xs font-medium capitalize
                    transition-colors duration-150
                    ${
                      speedTier === tier
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }
                  `}
                >
                  {tier}
                </button>
              ))}
            </div>

            {/* Model Selector - only show in consensus mode */}
            {mode === "consensus" && (
              <ModelSelector
                speedTier={speedTier}
                selectedModels={selectedModels}
                onModelsChange={onSelectedModelsChange}
                disabled={isProcessing}
              />
            )}
          </div>

          {showFileUpload && (
            <div className="mb-4">
              <FileUpload
                onUpload={(files, context) =>
                  handleFilesUploaded(files, context || "")
                }
                disabled={isProcessing}
                maxFiles={5}
              />
            </div>
          )}

          <div className="flex flex-wrap gap-3 mb-3 empty:mb-0 transition-all">
            <AnimatePresence mode="popLayout">
              {attachedFiles.map((file, idx) => {
                const style = getFileStyle(file.category);
                const Icon = style.icon;
                const isDataUrl =
                  typeof file.content === "string" &&
                  file.content.startsWith("data:image");
                const thumbnailSrc = isDataUrl ? file.content : null;

                return (
                  <motion.div
                    key={file.uiId || `${file.originalName}-${idx}`}
                    layout
                    initial={{ opacity: 0, scale: 0.8, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, y: -10 }}
                    className={`
                      relative group flex items-center gap-3 pr-8 pl-2 py-2 
                      rounded-xl border backdrop-blur-md transition-all 
                      hover:scale-[1.02] hover:shadow-lg
                      bg-gradient-to-br ${style.bg} ${style.border}
                    `}
                  >
                    <div
                      className={`
                      w-10 h-10 rounded-lg flex items-center justify-center shrink-0 overflow-hidden
                      ${thumbnailSrc ? "bg-black/40" : "bg-black/20"} ${style.color}
                    `}
                    >
                      {thumbnailSrc && file.category === "image" ? (
                        <img
                          src={thumbnailSrc}
                          alt="preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Icon className="w-5 h-5" />
                      )}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium truncate max-w-[140px] text-foreground/90">
                        {file.originalName}
                      </span>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">
                        <span>{formatFileSize(file.size)}</span>
                        <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/50" />
                        <span>{file.category}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => removeAttachedFile(idx)}
                      className="
                        absolute -right-2 -top-2 
                        w-6 h-6 rounded-full flex items-center justify-center
                        bg-background border border-border shadow-sm
                        text-muted-foreground hover:text-red-500 hover:border-red-500/50
                        transition-all opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100
                      "
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          <div className="relative flex items-end gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowFileUpload(!showFileUpload)}
              disabled={isProcessing}
              className={`h-10 w-10 shrink-0 ${showFileUpload ? "text-primary" : "text-muted-foreground"}`}
            >
              <Paperclip className="h-5 w-5" />
            </Button>
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  attachedFiles.length > 0
                    ? "Ask about your files..."
                    : "Ask anything..."
                }
                disabled={isProcessing}
                className="min-h-[52px] max-h-[200px] resize-none pr-24 bg-secondary border-border"
                rows={1}
              />
              <div className="absolute right-2 bottom-2 flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleVoiceInput}
                  disabled={isProcessing}
                  className={`h-8 w-8 ${isRecording ? "text-red-500" : "text-muted-foreground"}`}
                >
                  <Mic className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  onClick={handleSubmit}
                  disabled={!inputValue.trim() || isProcessing}
                  className="h-8 w-8 bg-primary hover:bg-primary/90"
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center mt-2">
            RASPUTIN queries multiple AI models to provide comprehensive answers
          </p>
        </div>
      </div>
    </div>
  );
}
