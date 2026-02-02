import { useEffect, useRef } from "react";

export interface TerminalLine {
  id: string;
  type: "command" | "stdout" | "stderr" | "system";
  content: string;
  timestamp: Date;
}

interface TerminalPanelProps {
  lines: TerminalLine[];
  onClear?: () => void;
}

function LinePrefix({ type }: { type: TerminalLine["type"] }) {
  switch (type) {
    case "command":
      return <span className="text-green-400 select-none">$ </span>;
    case "stderr":
      return <span className="text-red-400 select-none">! </span>;
    case "system":
      return <span className="text-blue-400 select-none"># </span>;
    default:
      return null;
  }
}

export function TerminalPanel({ lines, onClear }: TerminalPanelProps) {
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines]);

  const copyToClipboard = () => {
    const text = lines.map(l => l.content).join("\n");
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900 rounded-lg border border-zinc-700/50 overflow-hidden font-mono">
      <div className="px-3 py-2 border-b border-zinc-700/50 flex items-center justify-between bg-zinc-800/50">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          <span className="text-xs font-medium text-zinc-400 ml-2">
            Terminal
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={copyToClipboard}
            className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50 rounded transition-colors"
            title="Copy output"
          >
            📋
          </button>
          {onClear && (
            <button
              onClick={onClear}
              className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50 rounded transition-colors"
              title="Clear"
            >
              🗑️
            </button>
          )}
        </div>
      </div>

      <div
        ref={terminalRef}
        className="flex-1 overflow-y-auto p-3 text-sm leading-relaxed scrollbar-thin"
      >
        {lines.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-600">
            <span className="text-2xl mb-2">⌨️</span>
            <p className="text-xs">No terminal output yet</p>
          </div>
        ) : (
          lines.map(line => (
            <div
              key={line.id}
              className={`whitespace-pre-wrap break-all ${
                line.type === "command"
                  ? "text-green-300 font-semibold mt-2 first:mt-0"
                  : line.type === "stderr"
                    ? "text-red-300"
                    : line.type === "system"
                      ? "text-blue-300 italic"
                      : "text-zinc-300"
              }`}
            >
              <LinePrefix type={line.type} />
              {line.content}
            </div>
          ))
        )}
        <div className="h-1" />
      </div>
    </div>
  );
}
