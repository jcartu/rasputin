'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Square,
  Send,
  Trash2,
  Wifi,
  WifiOff,
  Plus,
  X,
  Clock,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  Copy,
  Check,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { usePlaygroundStore } from '@/lib/playground/store';
import { WebSocketConnection, WebSocketMessage } from '@/lib/playground/types';
import { formatDistanceToNow } from 'date-fns';

export function WebSocketTester() {
  const {
    wsConnections,
    activeWsConnectionId,
    createWsConnection,
    updateWsConnection,
    deleteWsConnection,
    setActiveWsConnection,
    addWsMessage,
    clearWsMessages,
    resolveVariables,
  } = usePlaygroundStore();

  const [url, setUrl] = useState('ws://localhost:8080/ws');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeConnection = wsConnections.find((c) => c.id === activeWsConnectionId);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (activeConnection?.messages?.length) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeConnection?.messages?.length]);

  const handleConnect = useCallback(() => {
    if (!url) return;

    const resolvedUrl = resolveVariables(url);
    const connectionId = createWsConnection(resolvedUrl);
    updateWsConnection(connectionId, { status: 'connecting' });

    try {
      const ws = new WebSocket(resolvedUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        updateWsConnection(connectionId, { status: 'connected' });
        addWsMessage(connectionId, { type: 'system', content: 'Connected to server' });
      };

      ws.onmessage = (event) => {
        addWsMessage(connectionId, { type: 'received', content: event.data });
      };

      ws.onerror = () => {
        updateWsConnection(connectionId, { status: 'error' });
        addWsMessage(connectionId, { type: 'system', content: 'Connection error' });
      };

      ws.onclose = () => {
        updateWsConnection(connectionId, { status: 'disconnected' });
        addWsMessage(connectionId, { type: 'system', content: 'Connection closed' });
        wsRef.current = null;
      };
    } catch (error) {
      updateWsConnection(connectionId, { status: 'error' });
      addWsMessage(connectionId, {
        type: 'system',
        content: `Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }, [url, resolveVariables, createWsConnection, updateWsConnection, addWsMessage]);

  const handleDisconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (activeWsConnectionId) {
      updateWsConnection(activeWsConnectionId, { status: 'disconnected' });
    }
  }, [activeWsConnectionId, updateWsConnection]);

  const handleSendMessage = useCallback(() => {
    if (!message.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const resolvedMessage = resolveVariables(message);
    wsRef.current.send(resolvedMessage);

    if (activeWsConnectionId) {
      addWsMessage(activeWsConnectionId, { type: 'sent', content: resolvedMessage });
    }

    setMessage('');
  }, [message, resolveVariables, activeWsConnectionId, addWsMessage]);

  const handleCopyMessage = useCallback((content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const isConnected = activeConnection?.status === 'connected';
  const isConnecting = activeConnection?.status === 'connecting';

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 p-4 border-b border-border bg-card/30">
        <div className="flex items-center gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="ws://localhost:8080/ws"
            className="flex-1 font-mono text-sm"
            disabled={isConnected || isConnecting}
          />

          {!isConnected && !isConnecting && (
            <Button onClick={handleConnect} disabled={!url} className="gap-2">
              <Play className="w-4 h-4" />
              Connect
            </Button>
          )}

          {isConnecting && (
            <Button disabled className="gap-2">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                <Wifi className="w-4 h-4" />
              </motion.div>
              Connecting...
            </Button>
          )}

          {isConnected && (
            <Button onClick={handleDisconnect} variant="destructive" className="gap-2">
              <Square className="w-4 h-4" />
              Disconnect
            </Button>
          )}
        </div>

        {wsConnections.length > 0 && (
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs text-muted-foreground">Connections:</span>
            {wsConnections.map((conn) => (
              <Badge
                key={conn.id}
                variant={conn.id === activeWsConnectionId ? 'default' : 'outline'}
                className={cn(
                  'cursor-pointer gap-1.5',
                  conn.status === 'connected' && 'border-emerald-500/50',
                  conn.status === 'error' && 'border-red-500/50',
                  conn.status === 'disconnected' && 'border-muted'
                )}
                onClick={() => setActiveWsConnection(conn.id)}
              >
                {conn.status === 'connected' && <Wifi className="w-3 h-3 text-emerald-500" />}
                {conn.status === 'disconnected' && <WifiOff className="w-3 h-3" />}
                {conn.status === 'error' && <AlertCircle className="w-3 h-3 text-red-500" />}
                {conn.status === 'connecting' && (
                  <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1, repeat: Infinity }}>
                    <Wifi className="w-3 h-3" />
                  </motion.div>
                )}
                <span className="truncate max-w-[100px]">{new URL(conn.url).pathname}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (conn.status === 'connected' && conn.id === activeWsConnectionId) {
                      handleDisconnect();
                    }
                    deleteWsConnection(conn.id);
                  }}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {!activeConnection && (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Wifi className="w-16 h-16 mb-4 opacity-30" />
                <p className="text-lg font-medium">No Connection</p>
                <p className="text-sm mt-2">Enter a WebSocket URL and click Connect</p>
              </div>
            )}

            {activeConnection?.messages.map((msg) => (
              <MessageItem
                key={msg.id}
                message={msg}
                onCopy={() => handleCopyMessage(msg.content, msg.id)}
                isCopied={copied === msg.id}
              />
            ))}

            {activeConnection?.messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <ArrowDown className="w-16 h-16 mb-4 opacity-30" />
                <p className="text-lg font-medium">Waiting for messages</p>
                <p className="text-sm mt-2">Messages will appear here</p>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {activeConnection && (
          <div className="flex-shrink-0 p-4 border-t border-border bg-card/30">
            <div className="flex items-center gap-2">
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter message to send..."
                className="flex-1 min-h-[60px] max-h-[200px] font-mono text-sm resize-none"
                disabled={!isConnected}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              <div className="flex flex-col gap-2">
                <Button
                  onClick={handleSendMessage}
                  disabled={!isConnected || !message.trim()}
                  className="gap-2"
                >
                  <Send className="w-4 h-4" />
                  Send
                </Button>
                {activeConnection.messages.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => clearWsMessages(activeConnection.id)}
                    className="gap-1 text-muted-foreground"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface MessageItemProps {
  message: WebSocketMessage;
  onCopy: () => void;
  isCopied: boolean;
}

function MessageItem({ message, onCopy, isCopied }: MessageItemProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const isJson = (() => {
    try {
      JSON.parse(message.content);
      return true;
    } catch {
      return false;
    }
  })();

  const formattedContent = isJson ? JSON.stringify(JSON.parse(message.content), null, 2) : message.content;

  const typeConfig = {
    sent: {
      icon: ArrowUp,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10 border-blue-500/20',
      label: 'Sent',
    },
    received: {
      icon: ArrowDown,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      label: 'Received',
    },
    system: {
      icon: AlertCircle,
      color: 'text-muted-foreground',
      bg: 'bg-muted/50 border-muted',
      label: 'System',
    },
  };

  const config = typeConfig[message.type];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('rounded-lg border p-3', config.bg)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className={cn('w-4 h-4', config.color)} />
          <span className={cn('text-xs font-medium', config.color)}>{config.label}</span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
          </span>
          {isJson && (
            <Badge variant="outline" className="text-[10px]">
              JSON
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCopy}>
            {isCopied ? (
              <Check className="w-3 h-3 text-emerald-500" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </Button>
          {message.content.length > 200 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <ChevronDown
                className={cn('w-3 h-3 transition-transform', isExpanded && 'rotate-180')}
              />
            </Button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.pre
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-2 text-sm font-mono whitespace-pre-wrap break-all overflow-hidden"
          >
            {formattedContent}
          </motion.pre>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
