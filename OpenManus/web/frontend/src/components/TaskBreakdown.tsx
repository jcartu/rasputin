import { useEffect, useRef } from "react";

export interface TaskItem {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  description?: string;
}

interface TaskBreakdownProps {
  tasks: TaskItem[];
  currentTaskId?: string | null;
}

function StatusIcon({ status }: { status: TaskItem["status"] }) {
  switch (status) {
    case "completed":
      return (
        <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
          <svg
            className="w-3 h-3 text-green-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
      );
    case "in_progress":
      return (
        <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
        </div>
      );
    case "failed":
      return (
        <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">
          <svg
            className="w-3 h-3 text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>
      );
    default:
      return (
        <div className="w-5 h-5 rounded-full bg-zinc-700 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-zinc-500" />
        </div>
      );
  }
}

export function TaskBreakdown({ tasks, currentTaskId }: TaskBreakdownProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current && currentTaskId) {
      const activeTask = listRef.current.querySelector(
        `[data-task-id="${currentTaskId}"]`
      );
      activeTask?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentTaskId]);

  const completedCount = tasks.filter(t => t.status === "completed").length;
  const progress = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;

  return (
    <div className="flex flex-col h-full bg-zinc-800/50 rounded-lg border border-zinc-700/50 overflow-hidden">
      <div className="px-3 py-2 border-b border-zinc-700/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">📋</span>
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Task Plan
          </span>
        </div>
        {tasks.length > 0 && (
          <span className="text-[10px] text-zinc-500">
            {completedCount}/{tasks.length}
          </span>
        )}
      </div>

      {tasks.length > 0 && (
        <div className="h-1 bg-zinc-700">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <div
        ref={listRef}
        className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin"
      >
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-zinc-600">
            <div className="w-8 h-8 mb-3 rounded-full border-2 border-zinc-700 border-dashed flex items-center justify-center">
              <span className="text-zinc-600">📝</span>
            </div>
            <p className="text-sm">No tasks yet</p>
            <p className="text-xs text-zinc-700 mt-1">Agent will plan tasks</p>
          </div>
        ) : (
          tasks.map((task, index) => (
            <div
              key={task.id}
              data-task-id={task.id}
              className={`flex items-start gap-3 px-2 py-2 rounded-lg transition-all duration-200
                ${task.id === currentTaskId ? "bg-blue-500/10 border border-blue-500/30" : "hover:bg-zinc-800/50"}
                ${task.status === "completed" ? "opacity-60" : ""}`}
            >
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-zinc-500 w-4 text-right">
                  {index + 1}
                </span>
                <StatusIcon status={task.status} />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm ${task.status === "completed" ? "text-zinc-400 line-through" : "text-zinc-200"}`}
                >
                  {task.title}
                </p>
                {task.description && (
                  <p className="text-xs text-zinc-500 mt-0.5 truncate">
                    {task.description}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
