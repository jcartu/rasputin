'use client';

import { useState } from 'react';
import { Terminal, Globe, FileText, Monitor, Check, X, Loader2, ChevronDown, ChevronRight } from 'lucide-react';

const TOOL_ICONS: Record<string, typeof Terminal> = {
  execute_code: Terminal,
  web_search: Globe,
  file_operations: FileText,
  browser: Monitor,
};

interface AgentToolCallProps {
  tool: string;
  input?: unknown;
  output?: string;
  success?: boolean;
  isRunning?: boolean;
}

export function AgentToolCall({ tool, input, output, success, isRunning }: AgentToolCallProps) {
  const [expanded, setExpanded] = useState(false);
  const Icon = TOOL_ICONS[tool] || Terminal;

  return (
    <div className="flex gap-2 my-1 group">
      <div className="flex-shrink-0 mt-0.5">
        {isRunning ? (
          <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
        ) : success ? (
          <Check className="w-4 h-4 text-emerald-400" />
        ) : success === false ? (
          <X className="w-4 h-4 text-red-400" />
        ) : (
          <Icon className="w-4 h-4 text-blue-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <button
          type="button"
          className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          <Icon className="w-3 h-3" />
          {tool}
          {isRunning && <span className="text-muted-foreground ml-1">running...</span>}
        </button>
        {expanded && (
          <div className="mt-1 space-y-1">
            {input && (
              <pre className="text-xs text-muted-foreground bg-muted/30 rounded px-2 py-1 overflow-x-auto max-h-32">
                {typeof input === 'string' ? input : JSON.stringify(input, null, 2)}
              </pre>
            )}
            {output && (
              <pre className="text-xs text-foreground/70 bg-muted/20 rounded px-2 py-1 overflow-x-auto max-h-32 border-l-2 border-emerald-500/30">
                {output.slice(0, 2000)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
