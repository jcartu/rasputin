import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Send,
  Mic,
  Loader2,
  Zap,
  Sparkles,
  Plus,
  // ChevronDown,
} from "lucide-react";
import { Streamdown } from "streamdown";
import { ModelSelector } from "./ModelSelector";
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
  onSubmitQuery: (query: string) => void;
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
    onSubmitQuery(inputValue.trim());
    setInputValue("");
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

                      {/* Stats for assistant messages */}
                      {(message.agreementPercentage ||
                        message.latencyMs ||
                        message.tokenCount) && (
                        <div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-3 text-xs text-muted-foreground">
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
                      )}
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

          {/* Input */}
          <div className="relative flex items-end gap-2">
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything..."
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
