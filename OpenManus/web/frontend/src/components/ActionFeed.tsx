import { useEffect, useRef } from "react";

export interface ActionEvent {
  id: string;
  type: string;
  icon: string;
  title: string;
  detail?: string;
  status: "running" | "done" | "error";
  timestamp: Date;
}

interface ActionFeedProps {
  events: ActionEvent[];
}

function StatusIndicator({ status }: { status: ActionEvent["status"] }) {
  if (status === "running") {
    return (
      <div className="flex items-center gap-1">
        <div className="flex gap-0.5">
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
    );
  }

  if (status === "done") {
    return (
      <span className="flex items-center justify-center w-4 h-4 rounded-full bg-green-500/20 text-green-400 text-[10px]">
        ✓
      </span>
    );
  }

  return (
    <span className="flex items-center justify-center w-4 h-4 rounded-full bg-red-500/20 text-red-400 text-[10px]">
      ✗
    </span>
  );
}

export function ActionFeed({ events }: ActionFeedProps) {
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTo({
        top: feedRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [events]);

  const runningCount = events.filter(e => e.status === "running").length;

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${runningCount > 0 ? "bg-blue-500 animate-pulse" : "bg-green-500"}`}
          />
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Activity
          </span>
        </div>
        {events.length > 0 && (
          <span className="text-[10px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
            {events.length} events
          </span>
        )}
      </div>
      <div
        ref={feedRef}
        className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin"
      >
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-600">
            <div className="w-8 h-8 mb-3 rounded-full border-2 border-zinc-700 border-dashed flex items-center justify-center">
              <span className="text-zinc-600">⏳</span>
            </div>
            <p className="text-sm">Waiting for activity...</p>
          </div>
        ) : (
          events.map(event => (
            <div
              key={event.id}
              className={`flex items-start gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-200 animate-slide-in
                ${event.status === "running" ? "bg-blue-500/10 border border-blue-500/20" : "hover:bg-zinc-800/50 border border-transparent"}
                ${event.status === "error" ? "bg-red-500/5 border border-red-500/20" : ""}`}
            >
              <span className="text-base shrink-0 mt-0.5">{event.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm truncate ${event.status === "running" ? "text-zinc-200" : "text-zinc-300"}`}
                  >
                    {event.title}
                  </span>
                  <StatusIndicator status={event.status} />
                </div>
                {event.detail && (
                  <p
                    className={`text-xs truncate mt-0.5 ${event.status === "running" ? "text-zinc-400" : "text-zinc-500"}`}
                  >
                    {event.detail}
                  </p>
                )}
              </div>
              <span className="text-[10px] text-zinc-600 shrink-0 tabular-nums">
                {event.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
