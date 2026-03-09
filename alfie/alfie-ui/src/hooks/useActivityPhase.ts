'use client';

import { useMemo } from 'react';
import { useActivityStore } from '@/lib/activityStore';
import { useChatStore } from '@/lib/store';

export interface ActivityPhase {
  type: 'think' | 'act' | 'search' | 'stream' | 'observe';
  label: string;
  detail?: string;
}

export function useActivityPhase() {
  const events = useActivityStore((s) => s.events);
  const isLoading = useChatStore((s) => s.isLoading);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const currentPhase = useChatStore((s) => s.currentPhase);

  const phase = useMemo((): ActivityPhase | null => {
    if (isStreaming) {
      return { type: 'stream', label: 'Generating response' };
    }

    const runningEvents = events.filter((e) => e.status === 'running');

    const searchEvent = runningEvents.find((e) => e.type === 'search');
    if (searchEvent) {
      return {
        type: 'search',
        label: 'Searching the web',
        detail: searchEvent.query,
      };
    }

    const toolEvent = runningEvents.find((e) => e.type === 'tool');
    if (toolEvent) {
      return {
        type: 'act',
        label: `Using ${toolEvent.toolName || 'tool'}`,
        detail: toolEvent.title,
      };
    }

    if (currentPhase === 'observe') {
      return { type: 'observe', label: 'Processing results' };
    }

    if (isLoading || currentPhase === 'think') {
      return { type: 'think', label: 'Thinking' };
    }

    return null;
  }, [events, isLoading, isStreaming, currentPhase]);

  const recentEvents = useMemo(() => events.slice(0, 10), [events]);

  const isActive = phase !== null;

  return { phase, recentEvents, isActive };
}
