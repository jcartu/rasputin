'use client';

import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, User, ChevronDown, ChevronUp, Wrench, Brain, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { VoiceOutput } from '@/components/voice';
import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer';
import type { Message, ToolCall } from '@/lib/store';

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
  isLatestAssistantMessage?: boolean;
}

const phaseIcons = {
  think: Brain,
  act: Wrench,
  observe: Eye,
};

const phaseColors = {
  think: 'text-amber-500 bg-amber-500/10',
  act: 'text-emerald-500 bg-emerald-500/10',
  observe: 'text-cyan-500 bg-cyan-500/10',
};

export const MessageBubble = memo(function MessageBubble({ message, isStreaming, isLatestAssistantMessage }: MessageBubbleProps) {
  const [showThinking, setShowThinking] = useState(false);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());

  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const PhaseIcon = message.phase ? phaseIcons[message.phase] : null;
  const shouldAutoPlayVoice = isLatestAssistantMessage && !isStreaming;

  const toggleTool = (toolId: string) => {
    const newExpanded = new Set(expandedTools);
    if (newExpanded.has(toolId)) {
      newExpanded.delete(toolId);
    } else {
      newExpanded.add(toolId);
    }
    setExpandedTools(newExpanded);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn(
        'flex gap-3 p-4 rounded-xl',
        isUser ? 'flex-row-reverse' : 'flex-row',
        message.phase && `phase-${message.phase}`
      )}
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 500 }}
        className={cn(
          'flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center shadow-lg',
          isUser
            ? 'bg-gradient-to-br from-primary via-primary/90 to-accent shadow-primary/25'
            : 'bg-gradient-to-br from-card via-card to-muted border border-border/50 shadow-[0_0_20px_hsl(var(--primary)/0.15)]'
        )}
      >
        {isUser ? (
          <User className="w-5 h-5 text-primary-foreground" />
        ) : (
          <Bot className="w-5 h-5 text-foreground" />
        )}
      </motion.div>

      <div className={cn('flex-1 space-y-2', isUser ? 'items-end' : 'items-start')}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-muted-foreground">
            {isUser ? 'You' : 'ALFIE'}
          </span>
          {message.phase && PhaseIcon && (
            <Badge variant="outline" className={cn('text-xs', phaseColors[message.phase])}>
              <PhaseIcon className="w-3 h-3 mr-1" />
              {message.phase.charAt(0).toUpperCase() + message.phase.slice(1)}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground/60">
            {new Date(message.timestamp).toLocaleTimeString()}
          </span>
        </div>

        {message.thinking && (
          <div className="mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowThinking(!showThinking)}
              className="text-xs text-amber-500 hover:text-amber-400 p-0 h-auto"
            >
              <Brain className="w-3 h-3 mr-1" />
              {showThinking ? 'Hide' : 'Show'} thinking
              {showThinking ? (
                <ChevronUp className="w-3 h-3 ml-1" />
              ) : (
                <ChevronDown className="w-3 h-3 ml-1" />
              )}
            </Button>
            <AnimatePresence>
              {showThinking && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-sm text-muted-foreground italic">
                    {message.thinking}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <motion.div
          className={cn(
            'rounded-2xl p-4 max-w-[85%] shadow-md transition-all duration-200',
            isUser
              ? 'bg-gradient-to-br from-primary via-primary/95 to-primary/85 text-primary-foreground ml-auto shadow-primary/20'
              : 'bg-card/90 border border-border/50 backdrop-blur-sm shadow-[0_4px_20px_hsl(var(--foreground)/0.05)] hover:shadow-[0_4px_25px_hsl(var(--foreground)/0.08)]'
          )}
        >
          <div className="max-w-none">
            {isUser ? (
              <p className="whitespace-pre-wrap">{message.content}</p>
            ) : (
              <MarkdownRenderer 
                content={message.content} 
                className={cn(
                  isUser && "[&_a]:text-primary-foreground [&_code]:bg-primary-foreground/20 [&_code]:text-primary-foreground"
                )}
              />
            )}
            {isStreaming && (
              <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="inline-block w-2 h-4 bg-current ml-1"
              />
            )}
          </div>
          {isAssistant && message.content && !isStreaming && (
            <div className="mt-3 pt-2 border-t border-border/30">
              <VoiceOutput
                text={message.content}
                messageId={message.id}
                autoPlay={shouldAutoPlayVoice}
              />
            </div>
          )}
        </motion.div>

        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="space-y-2 mt-3">
            {message.toolCalls.map((tool) => (
              <ToolCallDisplay
                key={tool.id}
                tool={tool}
                isExpanded={expandedTools.has(tool.id)}
                onToggle={() => toggleTool(tool.id)}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
});

interface ToolCallDisplayProps {
  tool: ToolCall;
  isExpanded: boolean;
  onToggle: () => void;
}

function ToolCallDisplay({ tool, isExpanded, onToggle }: ToolCallDisplayProps) {
  const statusColors = {
    pending: 'bg-muted-foreground/20 text-muted-foreground',
    running: 'bg-primary/20 text-primary tool-pulse',
    completed: 'bg-emerald-500/20 text-emerald-500',
    error: 'bg-destructive/20 text-destructive',
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="rounded-xl border border-border/40 overflow-hidden bg-card/60 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-200"
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors"
      >
        <div className={cn('w-2 h-2 rounded-full', statusColors[tool.status])} />
        <Wrench className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium flex-1 text-left">{tool.name}</span>
        <Badge variant="outline" className={cn('text-xs', statusColors[tool.status])}>
          {tool.status}
        </Badge>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3 pt-0 space-y-2 border-t border-border/50">
              <div>
                <span className="text-xs text-muted-foreground">Arguments:</span>
                <pre className="mt-1 p-2 rounded bg-muted/50 text-xs overflow-x-auto">
                  {JSON.stringify(tool.arguments, null, 2)}
                </pre>
              </div>
              {tool.result && (
                <div>
                  <span className="text-xs text-muted-foreground">Result:</span>
                  <pre className="mt-1 p-2 rounded bg-muted/50 text-xs overflow-x-auto max-h-32 overflow-y-auto">
                    {tool.result}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
