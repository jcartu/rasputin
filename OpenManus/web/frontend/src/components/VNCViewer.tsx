import { useEffect, useState, useCallback } from "react";

interface VNCViewerProps {
  vncUrl: string | null;
  onTakeOver: () => void;
  onReturnControl: () => void;
  isControlled: boolean;
}

export function VNCViewer({
  vncUrl,
  onTakeOver,
  onReturnControl,
  isControlled,
}: VNCViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && isControlled) {
        onReturnControl();
      }
    },
    [isControlled, onReturnControl]
  );

  useEffect(() => {
    if (isControlled) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isControlled, handleKeyDown]);

  if (!vncUrl) {
    return (
      <div className="flex flex-col h-full bg-zinc-800/50 rounded-lg border border-zinc-700/50 overflow-hidden">
        <div className="px-3 py-2 border-b border-zinc-700/50 flex items-center gap-2">
          <span className="text-sm">🖥️</span>
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Live View
          </span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-zinc-700/50 flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-zinc-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <p className="text-sm text-zinc-400 mb-1">No live view available</p>
          <p className="text-xs text-zinc-600">
            VNC will be available when sandbox is ready
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col bg-zinc-800/50 rounded-lg border border-zinc-700/50 overflow-hidden transition-all ${
        isFullscreen ? "fixed inset-4 z-50" : "h-full"
      }`}
    >
      <div className="px-3 py-2 border-b border-zinc-700/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">🖥️</span>
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Live View
          </span>
          {isControlled && (
            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] font-medium rounded-full animate-pulse">
              YOU ARE IN CONTROL
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isControlled ? (
            <button
              onClick={onReturnControl}
              className="flex items-center gap-2 px-3 py-1.5 bg-amber-600/20 text-amber-400 text-xs font-medium rounded-lg border border-amber-600/30 hover:bg-amber-600/30 transition-colors"
            >
              <span>🔙</span>
              <span>Return Control</span>
            </button>
          ) : (
            <button
              onClick={onTakeOver}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600/20 text-blue-400 text-xs font-medium rounded-lg border border-blue-600/30 hover:bg-blue-600/30 transition-colors"
            >
              <span>🎮</span>
              <span>Take Over</span>
            </button>
          )}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50 rounded transition-colors"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? "⬜" : "⬛"}
          </button>
        </div>
      </div>

      <div className="flex-1 relative bg-black">
        <iframe
          src={vncUrl}
          className="absolute inset-0 w-full h-full border-0"
          allow="clipboard-read; clipboard-write"
          title="VNC Live View"
        />
        {!isControlled && <div className="absolute inset-0 bg-transparent" />}
      </div>

      {isControlled && (
        <div className="px-3 py-1.5 border-t border-zinc-700/50 bg-amber-900/20 flex items-center justify-center gap-2">
          <kbd className="px-1.5 py-0.5 bg-zinc-800 text-zinc-400 text-[10px] font-mono rounded">
            ESC
          </kbd>
          <span className="text-xs text-amber-400/80">
            to return control to agent
          </span>
        </div>
      )}
    </div>
  );
}
