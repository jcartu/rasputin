import { useState, useEffect, useRef } from "react";

interface BrowserPreviewProps {
  screenshot: string | null;
  url?: string;
  isLoading: boolean;
  cursorPosition?: { x: number; y: number } | null;
}

export function BrowserPreview({
  screenshot,
  url,
  isLoading,
  cursorPosition,
}: BrowserPreviewProps) {
  const [isNewScreenshot, setIsNewScreenshot] = useState(false);
  const [displayedScreenshot, setDisplayedScreenshot] = useState<string | null>(
    null
  );
  const prevScreenshotRef = useRef<string | null>(null);

  useEffect(() => {
    if (screenshot && screenshot !== prevScreenshotRef.current) {
      setIsNewScreenshot(true);
      setDisplayedScreenshot(screenshot);
      prevScreenshotRef.current = screenshot;
      const timer = setTimeout(() => setIsNewScreenshot(false), 400);
      return () => clearTimeout(timer);
    }
  }, [screenshot]);

  return (
    <div className="flex flex-col h-full bg-zinc-950 rounded-lg border border-zinc-800 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900/80 border-b border-zinc-800">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-400 transition-colors cursor-pointer" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80 hover:bg-yellow-400 transition-colors cursor-pointer" />
          <div className="w-3 h-3 rounded-full bg-green-500/80 hover:bg-green-400 transition-colors cursor-pointer" />
        </div>
        <div
          className={`flex-1 flex items-center gap-2 px-3 py-1 bg-zinc-800 rounded-md transition-all ${isLoading ? "ring-1 ring-blue-500/30" : ""}`}
        >
          {isLoading && (
            <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          )}
          <span className="text-xs text-zinc-400 truncate flex-1">
            {url || "about:blank"}
          </span>
          {isLoading && (
            <span className="text-[10px] text-blue-400 animate-pulse">
              Loading...
            </span>
          )}
        </div>
        <button className="p-1 hover:bg-zinc-800 rounded transition-colors group">
          <svg
            className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 transition-colors"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      <div className="flex-1 relative bg-zinc-900 overflow-hidden">
        {displayedScreenshot ? (
          <div className="relative w-full h-full">
            <img
              src={`data:image/png;base64,${displayedScreenshot}`}
              alt="Browser view"
              className={`w-full h-full object-contain screenshot-transition ${isNewScreenshot ? "screenshot-new" : ""}`}
            />
            {cursorPosition && (
              <div
                className="absolute pointer-events-none z-10 transition-all duration-150 ease-out"
                style={{
                  left: `${cursorPosition.x}%`,
                  top: `${cursorPosition.y}%`,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <div className="relative">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    className="drop-shadow-lg animate-glow-pulse"
                  >
                    <path
                      d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.48 0 .72-.58.38-.92L5.94 2.84a.5.5 0 0 0-.44.37z"
                      fill="#3b82f6"
                      stroke="#1e3a8a"
                      strokeWidth="1"
                    />
                  </svg>
                  <div className="absolute top-0 left-0 w-6 h-6 bg-blue-500/30 rounded-full animate-ripple" />
                </div>
              </div>
            )}
            {isLoading && (
              <div className="absolute bottom-3 right-3 flex items-center gap-2 px-3 py-1.5 bg-zinc-900/90 rounded-full border border-zinc-700/50">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                <span className="text-xs text-zinc-300">Agent working...</span>
              </div>
            )}
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-600">
            {isLoading ? (
              <>
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-zinc-700 rounded-full" />
                  <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-blue-500 rounded-full animate-spin" />
                </div>
                <p className="text-sm mt-4">Launching browser...</p>
                <div className="flex gap-1 mt-2">
                  <div
                    className="w-2 h-2 bg-zinc-600 rounded-full animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <div
                    className="w-2 h-2 bg-zinc-600 rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <div
                    className="w-2 h-2 bg-zinc-600 rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </>
            ) : (
              <>
                <svg
                  className="w-16 h-16 mb-4 text-zinc-700"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                <p className="text-sm">Browser will appear here</p>
                <p className="text-xs text-zinc-700 mt-1">
                  when the agent starts browsing
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
