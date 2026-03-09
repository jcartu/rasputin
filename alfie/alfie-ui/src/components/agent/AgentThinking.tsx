'use client';

import { useState } from 'react';
import { Brain, ChevronDown, ChevronRight } from 'lucide-react';

interface AgentThinkingProps {
  content: string;
  iteration: number;
  isActive?: boolean;
}

export function AgentThinking({ content, iteration, isActive }: AgentThinkingProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex gap-2 my-1">
      <div className="flex-shrink-0 mt-0.5">
        <Brain className={`w-4 h-4 text-violet-400 ${isActive ? 'animate-pulse' : ''}`} />
      </div>
      <div className="flex-1 min-w-0">
        <button
          type="button"
          className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          Thinking (step {iteration})
        </button>
        {expanded && (
          <div className="mt-1 text-sm text-muted-foreground bg-muted/30 rounded-md px-3 py-2 whitespace-pre-wrap">
            {content}
          </div>
        )}
      </div>
    </div>
  );
}
