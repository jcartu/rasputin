import { useChatStore, useSystemStore, useFileStore, type ToolCall, type FileNode, type SystemStats } from './store';
import { activityEmitter, useActivityStore, type ActivityEvent } from './activityStore';

export interface WebSocketMessage {
  type: 
    | 'message'
    | 'message_start'
    | 'message_delta'
    | 'message_complete'
    | 'conversation_created'
    | 'thinking'
    | 'tool_start'
    | 'tool_progress'
    | 'tool_complete'
    | 'phase_change'
    | 'system_stats'
    | 'file_tree'
    | 'error'
    | 'connected';
  payload: unknown;
}

class WebSocketManager {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private messageQueue: string[] = [];
  private currentMessageId: string | null = null;
  private activeThreadId: string | null = null;
  private streamingIdleTimer: ReturnType<typeof setTimeout> | null = null;
  private streamingMaxTimer: ReturnType<typeof setTimeout> | null = null;
  private static IDLE_TIMEOUT = 60_000;
  private static MAX_STREAM_TIMEOUT = 600_000;

  constructor(url: string = 'ws://localhost:3001/ws') {
    this.url = url;
  }

  private clearStreamingTimers(): void {
    if (this.streamingIdleTimer) { clearTimeout(this.streamingIdleTimer); this.streamingIdleTimer = null; }
    if (this.streamingMaxTimer) { clearTimeout(this.streamingMaxTimer); this.streamingMaxTimer = null; }
  }

  private resetIdleTimer(): void {
    if (this.streamingIdleTimer) clearTimeout(this.streamingIdleTimer);
    this.streamingIdleTimer = setTimeout(() => this.forceCompleteStreaming(), WebSocketManager.IDLE_TIMEOUT);
  }

  private startStreamingTimers(): void {
    this.clearStreamingTimers();
    this.resetIdleTimer();
    this.streamingMaxTimer = setTimeout(() => this.forceCompleteStreaming(), WebSocketManager.MAX_STREAM_TIMEOUT);
  }

  private forceCompleteStreaming(): void {
    this.clearStreamingTimers();
    const chatStore = useChatStore.getState();
    if (!chatStore.isStreaming) return;
    console.warn('Streaming safety timeout — forcing completion');
    chatStore.setStreaming(false);
    chatStore.setLoading(false);
    chatStore.setCurrentToolCall(null);
    chatStore.setPhase('idle');
    this.currentMessageId = null;
    const activityState = useActivityStore.getState();
    for (const e of activityState.events) {
      if (e.status === 'running') {
        activityState.completeEvent(e.id, 'success');
      }
    }
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        useSystemStore.getState().setConnectionStatus('connecting');
        
        // Add auth token as query param for WS authentication
        const token = typeof window !== 'undefined' ? localStorage.getItem('alfie_access_token') : null;
        const wsUrl = token ? `${this.url}?token=${encodeURIComponent(token)}` : this.url;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          useSystemStore.getState().setConnectionStatus('connected');
          activityEmitter.websocket('Connected', 'success');
          
          while (this.messageQueue.length > 0) {
            const msg = this.messageQueue.shift();
            if (msg) this.ws?.send(msg);
          }
          
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket disconnected, code:', event.code);
          useSystemStore.getState().setConnectionStatus('disconnected');
          activityEmitter.websocket('Disconnected', 'error');
          this.attemptReconnect(event.code === 4001);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private attemptReconnect(authFailed = false): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      console.log(`Attempting reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
      
      setTimeout(async () => {
        if (authFailed) {
          const { useAuthStore } = await import('./authStore');
          const refreshed = await useAuthStore.getState().refreshAccessToken();
          if (!refreshed) {
            useAuthStore.getState().logout();
            if (typeof window !== 'undefined') window.location.href = '/login';
            return;
          }
        }
        this.connect().catch(console.error);
      }, delay);
    }
  }

  private handleMessage(data: string): void {
    try {
      const message: WebSocketMessage = JSON.parse(data);
      const chatStore = useChatStore.getState();
      const fileStore = useFileStore.getState();

      switch (message.type) {
        case 'connected':
          console.log('Connection acknowledged by server');
          break;

        case 'conversation_created': {
          const payload = message.payload as { threadId: string; title: string };
          const activeId = chatStore.activeSessionId;
          if (activeId && payload.threadId) {
            chatStore.mapSessionToThread(activeId, payload.threadId);
            this.activeThreadId = payload.threadId;
          }
          break;
        }

        case 'message_start': {
          const payload = message.payload as { id: string; role: 'assistant'; threadId?: string };
          this.currentMessageId = payload.id;
          if (payload.threadId) {
            const activeId = chatStore.activeSessionId;
            if (activeId) {
              chatStore.mapSessionToThread(activeId, payload.threadId);
              this.activeThreadId = payload.threadId;
            }
          }
          chatStore.addMessage({
            role: payload.role,
            content: '',
          });
          chatStore.setStreaming(true);
          this.startStreamingTimers();
          break;
        }

        case 'message_delta': {
          const payload = message.payload as { content: string };
          this.resetIdleTimer();
          if (this.currentMessageId) {
            const sessions = chatStore.sessions;
            const activeSession = sessions.find(s => s.id === chatStore.activeSessionId);
            const lastMessage = activeSession?.messages[activeSession.messages.length - 1];
            if (lastMessage) {
              chatStore.updateMessage(lastMessage.id, {
                content: lastMessage.content + payload.content,
              });
            }
          }
          break;
        }

        case 'message_complete': {
          this.clearStreamingTimers();
          chatStore.setStreaming(false);
          chatStore.setLoading(false);
          chatStore.setCurrentToolCall(null);
          chatStore.setPhase('idle');
          this.currentMessageId = null;
          
          const activityState = useActivityStore.getState();
          for (const e of activityState.events) {
            if (e.status === 'running') {
              activityState.completeEvent(e.id, 'success');
            }
          }
          break;
        }

        case 'thinking': {
          this.resetIdleTimer();
          const payload = message.payload as { content: string };
          chatStore.setPhase('think');
          activityEmitter.thinking('think');
          if (this.currentMessageId) {
            const sessions = chatStore.sessions;
            const activeSession = sessions.find(s => s.id === chatStore.activeSessionId);
            const lastMessage = activeSession?.messages[activeSession.messages.length - 1];
            if (lastMessage) {
              chatStore.updateMessage(lastMessage.id, {
                thinking: (lastMessage.thinking || '') + payload.content,
              });
            }
          }
          break;
        }

        case 'tool_start': {
          this.resetIdleTimer();
          const payload = message.payload as ToolCall;
          chatStore.setPhase('act');
          chatStore.setCurrentToolCall({
            ...payload,
            status: 'running',
            startTime: new Date(),
          });
          activityEmitter.tool(payload.name, 'running');
          break;
        }

        case 'tool_progress': {
          const payload = message.payload as Partial<ToolCall>;
          const current = chatStore.currentToolCall;
          if (current) {
            chatStore.setCurrentToolCall({ ...current, ...payload });
          }
          break;
        }

        case 'tool_complete': {
          this.resetIdleTimer();
          const payload = message.payload as ToolCall;
          const startTime = chatStore.currentToolCall?.startTime;
          const duration = startTime ? Date.now() - new Date(startTime).getTime() : undefined;
          
          chatStore.setPhase('observe');
          chatStore.setCurrentToolCall({
            ...payload,
            status: 'completed',
            endTime: new Date(),
          });
          
          const sessions = chatStore.sessions;
          const activeSession = sessions.find(s => s.id === chatStore.activeSessionId);
          const lastMessage = activeSession?.messages[activeSession.messages.length - 1];
          if (lastMessage) {
            chatStore.updateMessage(lastMessage.id, {
              toolCalls: [...(lastMessage.toolCalls || []), payload],
            });
          }
          
          activityEmitter.tool(payload.name, payload.status === 'error' ? 'error' : 'success');
          if (duration) {
            const events = useActivityStore.getState().events;
            const lastToolEvent = events.find((e: ActivityEvent) => e.type === 'tool' && e.toolName === payload.name);
            if (lastToolEvent) {
              useActivityStore.getState().completeEvent(lastToolEvent.id, 'success', duration);
            }
          }
          
          setTimeout(() => {
            chatStore.setCurrentToolCall(null);
            chatStore.setPhase('idle');
          }, 1000);
          break;
        }

        case 'phase_change': {
          const payload = message.payload as { phase: 'idle' | 'think' | 'act' | 'observe' };
          chatStore.setPhase(payload.phase);
          if (payload.phase !== 'idle') {
            activityEmitter.thinking(payload.phase as 'think' | 'act' | 'observe');
          }
          break;
        }

        case 'system_stats': {
          const payload = message.payload as Partial<SystemStats>;
          useSystemStore.getState().updateStats(payload);
          break;
        }

        case 'file_tree': {
          const payload = message.payload as FileNode[];
          fileStore.setFiles(payload);
          break;
        }

        case 'error': {
          const payload = message.payload as { message: string };
          console.error('Server error:', payload.message);
          chatStore.setLoading(false);
          chatStore.setStreaming(false);
          useActivityStore.getState().addEvent({
            type: 'websocket',
            status: 'error',
            title: 'Error',
            description: payload.message,
          });
          break;
        }
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  sendMessage(content: string, fileIds?: string[]): void {
    const chatStore = useChatStore.getState();
    const activeId = chatStore.activeSessionId;
    const threadId = activeId ? (chatStore.getThreadId(activeId) || this.activeThreadId) : this.activeThreadId;

    const payload: Record<string, unknown> = { content, threadId };
    if (fileIds && fileIds.length > 0) {
      payload.fileIds = fileIds;
    }

    const message = JSON.stringify({
      type: 'chat',
      payload,
    });

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(message);
      chatStore.setLoading(true);
    } else {
      this.messageQueue.push(message);
    }
  }

  requestFileTree(path: string = '.'): void {
    const message = JSON.stringify({
      type: 'file_tree',
      payload: { path },
    });

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(message);
    }
  }

  requestStats(): void {
    const message = JSON.stringify({
      type: 'stats',
      payload: {},
    });

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(message);
    }
  }

  disconnect(): void {
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnection
    this.ws?.close();
    this.ws = null;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Singleton instance - use env var or fallback
const wsUrl = typeof window !== 'undefined' 
  ? (process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws')
  : 'ws://localhost:3001/ws';
export const wsManager = new WebSocketManager(wsUrl);

// React hook for WebSocket
export function useWebSocket() {
  const connectionStatus = useSystemStore((state) => state.connectionStatus);

  return {
    connect: () => wsManager.connect(),
    disconnect: () => wsManager.disconnect(),
    sendMessage: (content: string, fileIds?: string[]) => wsManager.sendMessage(content, fileIds),
    requestFileTree: (path?: string) => wsManager.requestFileTree(path),
    requestStats: () => wsManager.requestStats(),
    isConnected: connectionStatus === 'connected',
    connectionStatus,
  };
}
