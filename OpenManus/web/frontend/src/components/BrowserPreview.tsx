import { useState, useCallback } from "react";

interface BrowserPreviewProps {
  screenshot: string | null;
  url?: string;
  isLoading: boolean;
  cursorPosition?: { x: number; y: number } | null;
  onRefresh?: () => void;
}

function ScreenshotImage({
  screenshot,
  isLoading,
  cursorPosition,
}: {
  screenshot: string;
  isLoading: boolean;
  cursorPosition?: { x: number; y: number } | null;
}) {
  const [isAnimating, setIsAnimating] = useState(true);

  const handleAnimationEnd = useCallback(() => {
    setIsAnimating(false);
  }, []);

  return (
    <div className="relative w-full h-full">
      <img
        src={`data:image/png;base64,${screenshot}`}
        alt="Browser view"
        className={`w-full h-full object-contain screenshot-transition ${isAnimating ? "screenshot-new" : ""}`}
        onAnimationEnd={handleAnimationEnd}
        onTransitionEnd={handleAnimationEnd}
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
  );
}

export function BrowserPreview({
  screenshot,
  url,
  isLoading,
  cursorPosition,
  onRefresh,
}: BrowserPreviewProps) {
  const [copied, setCopied] = useState(false);

  const copyUrl = useCallback(() => {
    if (url) {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [url]);

  const downloadScreenshot = useCallback(() => {
    if (!screenshot) return;
    const link = document.createElement("a");
    link.href = `data:image/png;base64,${screenshot}`;
    link.download = `screenshot-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [screenshot]);

  const openInNewTab = useCallback(() => {
    if (url && url !== "about:blank") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }, [url]);

  return (
    <div className="flex flex-col h-full bg-zinc-950 rounded-lg border border-zinc-800 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900/80 border-b border-zinc-800">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
        </div>

        <div className="flex items-center gap-1 mr-1">
          <button
            className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors disabled:opacity-30"
            disabled
            title="Back (controlled by agent)"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <button
            className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors disabled:opacity-30"
            disabled
            title="Forward (controlled by agent)"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
          <button
            onClick={onRefresh}
            className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors"
            title="Refresh screenshot"
          >
            <svg
              className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`}
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

        <div
          className={`flex-1 flex items-center gap-2 px-3 py-1 bg-zinc-800 rounded-md transition-all cursor-pointer hover:bg-zinc-700/50 ${isLoading ? "ring-1 ring-blue-500/30" : ""}`}
          onClick={copyUrl}
          title={copied ? "Copied!" : "Click to copy URL"}
        >
          {isLoading ? (
            <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg
              className="w-3 h-3 text-zinc-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4"
              />
            </svg>
          )}
          <span className="text-xs text-zinc-400 truncate flex-1 select-all">
            {url || "about:blank"}
          </span>
          {copied && (
            <span className="text-[10px] text-green-400">Copied!</span>
          )}
          {isLoading && (
            <span className="text-[10px] text-blue-400 animate-pulse">
              Loading...
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {screenshot && (
            <button
              onClick={downloadScreenshot}
              className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors"
              title="Download screenshot"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
            </button>
          )}
          {url && url !== "about:blank" && (
            <button
              onClick={openInNewTab}
              className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors"
              title="Open in new tab"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 relative bg-zinc-900 overflow-hidden">
        {screenshot ? (
          <ScreenshotImage
            key={screenshot}
            screenshot={screenshot}
            isLoading={isLoading}
            cursorPosition={cursorPosition}
          />
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
