import { BrowserPreview } from "./BrowserPreview";
import { ActionFeed } from "./ActionFeed";
import type { ActionEvent } from "./ActionFeed";

interface ComputerViewProps {
  screenshot: string | null;
  browserUrl: string;
  isLoading: boolean;
  events: ActionEvent[];
  currentStep: number;
  maxSteps: number;
  thought: string;
  cursorPosition?: { x: number; y: number } | null;
  vncUrl?: string | null;
}

export function ComputerView({
  screenshot,
  browserUrl,
  isLoading,
  events,
  currentStep,
  maxSteps,
  thought,
  cursorPosition,
  vncUrl,
}: ComputerViewProps) {
  return (
    <div className="flex flex-col h-full bg-zinc-900/50">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
            <svg
              className="w-4 h-4 text-zinc-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div>
            <h2 className="font-medium text-white text-sm">Computer View</h2>
            <p className="text-xs text-zinc-500">Live agent workspace</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {currentStep > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 rounded-full">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-xs text-zinc-300">
                Step {currentStep} / {maxSteps}
              </span>
            </div>
          )}
          {vncUrl && (
            <a
              href={vncUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 bg-green-600/20 text-green-400 text-xs font-medium rounded-lg border border-green-600/30 hover:bg-green-600/30 transition-colors group"
            >
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span>Watch Live</span>
              <svg
                className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity"
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
            </a>
          )}
          <button className="px-3 py-1.5 bg-amber-600/20 text-amber-400 text-xs font-medium rounded-lg border border-amber-600/30 hover:bg-amber-600/30 transition-colors">
            Take Over
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-3 p-3 overflow-hidden">
        <div className="flex-1 min-h-0">
          <BrowserPreview
            screenshot={screenshot}
            url={browserUrl}
            isLoading={isLoading}
            cursorPosition={cursorPosition}
          />
        </div>

        <div className="w-full lg:w-80 flex flex-col gap-3 min-h-0">
          {thought && (
            <div className="bg-zinc-800/50 rounded-lg border border-zinc-700/50 p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm">💭</span>
                <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Thinking
                </span>
              </div>
              <p className="text-sm text-zinc-300 leading-relaxed line-clamp-4">
                {thought}
              </p>
            </div>
          )}

          <div className="flex-1 bg-zinc-800/50 rounded-lg border border-zinc-700/50 overflow-hidden min-h-0">
            <ActionFeed events={events} />
          </div>
        </div>
      </div>
    </div>
  );
}
