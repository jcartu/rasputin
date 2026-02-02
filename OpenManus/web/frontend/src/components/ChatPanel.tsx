import { useRef, useEffect } from "react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isThinking?: boolean;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  isConnected: boolean;
  isProcessing: boolean;
}

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex items-center justify-center w-6 h-6">
        <div className="absolute w-6 h-6 rounded-full bg-blue-500/20 animate-ping" />
        <div className="w-4 h-4 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 animate-pulse" />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-zinc-300">Thinking</span>
        <div className="flex gap-1">
          <span
            className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"
            style={{ animationDelay: "0ms" }}
          />
          <span
            className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"
            style={{ animationDelay: "150ms" }}
          />
          <span
            className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"
            style={{ animationDelay: "300ms" }}
          />
        </div>
      </div>
    </div>
  );
}

function MessageContent({
  content,
  isAssistant,
}: {
  content: string;
  isAssistant: boolean;
}) {
  if (!isAssistant || !content) {
    return <p className="text-sm whitespace-pre-wrap">{content}</p>;
  }

  return (
    <p className="text-sm whitespace-pre-wrap">
      {content}
      <span className="inline-block w-0.5 h-4 ml-0.5 bg-blue-400 animate-cursor-blink align-text-bottom" />
    </p>
  );
}

export function ChatPanel({
  messages,
  input,
  onInputChange,
  onSend,
  isConnected,
  isProcessing,
}: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
            M
          </div>
          <div>
            <h1 className="font-semibold text-white">OpenManus</h1>
            <div className="flex items-center gap-1.5">
              <div
                className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
              />
              <span className="text-xs text-zinc-500">
                {isConnected ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                M
              </div>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              What can I do for you?
            </h2>
            <p className="text-sm text-zinc-500 max-w-xs">
              I can browse the web, write code, analyze data, and execute tasks
              autonomously.
            </p>
          </div>
        ) : (
          messages.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-800/80 border border-zinc-700/50 text-zinc-200"
                }`}
              >
                {msg.isThinking ? (
                  <ThinkingIndicator />
                ) : (
                  <MessageContent
                    content={msg.content}
                    isAssistant={msg.role === "assistant"}
                  />
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-zinc-800">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What would you like me to do?"
            disabled={!isConnected || isProcessing}
            rows={1}
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-blue-500 disabled:opacity-50 resize-none"
          />
          <button
            onClick={onSend}
            disabled={!isConnected || isProcessing || !input.trim()}
            className="px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors shrink-0"
          >
            {isProcessing ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
