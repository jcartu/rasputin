'use client';

import { useEffect, useRef } from 'react';
import { useActivityStore, type ActivityEvent } from '@/lib/activityStore';

export function useActivityStream() {
  const eventSourceRef = useRef<EventSource | null>(null);
  const addEvent = useActivityStore((state) => state.addEvent);

  useEffect(() => {
    const connectStream = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const eventSource = new EventSource('/api/activity/stream');
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'connected') {
            return;
          }

          const activityEvent: Omit<ActivityEvent, 'id' | 'timestamp'> = {
            type: data.type,
            status: data.status,
            title: data.title,
            description: data.description,
            duration: data.duration,
            details: data.details,
            toolName: data.toolName,
            endpoint: data.endpoint,
            method: data.method,
            responseTime: data.responseTime,
            filePath: data.filePath,
            operation: data.operation,
            query: data.query,
            resultsCount: data.resultsCount,
            modelName: data.modelName,
            tokensUsed: data.tokensUsed,
            memoriesFound: data.memoriesFound,
            phase: data.phase,
            taskId: data.taskId,
          };

          addEvent(activityEvent);
        } catch (err) {
          console.error('Failed to parse activity stream event:', err);
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        setTimeout(connectStream, 5000);
      };
    };

    connectStream();

    return () => {
      eventSourceRef.current?.close();
    };
  }, [addEvent]);
}
