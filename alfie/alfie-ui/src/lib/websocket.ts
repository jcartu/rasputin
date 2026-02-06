import { useChatStore, useSystemStore, useFileStore, type ToolCall, type FileNode, type SystemStats } from './store';
import { activityEmitter, useActivityStore, type ActivityEvent } from './activityStore';

export interface WebSocketMessage {
  type: 
    | 'message'
    | 'message_start'
    | 'message_delta'
    | 'message_complete'
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

  constructor(url: string = 'ws://localhost:8080/ws') {
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        useSystemStore.getState().setConnectionStatus('connecting');
        
        this.ws = new WebSocket(this.url);

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

        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
          useSystemStore.getState().setConnectionStatus('disconnected');
          activityEmitter.websocket('Disconnected', 'error');
          this.attemptReconnect();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      console.log(`Attempting reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
      
      setTimeout(() => {
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

        case 'message_start': {
          const payload = message.payload as { id: string; role: 'assistant' };
          this.currentMessageId = payload.id;
          chatStore.addMessage({
            role: payload.role,
            content: '',
          });
          chatStore.setStreaming(true);
          break;
        }

        case 'message_delta': {
          const payload = message.payload as { content: string };
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
          chatStore.setStreaming(false);
          chatStore.setLoading(false);
          this.currentMessageId = null;
          break;
        }

        case 'thinking': {
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

  sendMessage(content: string): void {
    const message = JSON.stringify({
      type: 'chat',
      payload: { content },
    });

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(message);
      useChatStore.getState().setLoading(true);
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
  ? (process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws')
  : 'ws://localhost:8080/ws';
export const wsManager = new WebSocketManager(wsUrl);

// React hook for WebSocket
export function useWebSocket() {
  const connectionStatus = useSystemStore((state) => state.connectionStatus);

  return {
    connect: () => wsManager.connect(),
    disconnect: () => wsManager.disconnect(),
    sendMessage: (content: string) => wsManager.sendMessage(content),
    requestFileTree: (path?: string) => wsManager.requestFileTree(path),
    requestStats: () => wsManager.requestStats(),
    isConnected: connectionStatus === 'connected',
    connectionStatus,
  };
}
