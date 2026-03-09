'use client';

import { memo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, User, ChevronDown, ChevronUp, Wrench, Brain, Eye, Copy, Check, RefreshCw, ThumbsUp, ThumbsDown, Pencil, X, Link } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { VoiceOutput } from '@/components/voice';
import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer';
import { SearchIndicator } from './SearchIndicator';
import type { Message, ToolCall, ToolResult, ToolCitation } from '@/lib/store';

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
  isLatestAssistantMessage?: boolean;
  onRegenerate?: () => void;
  onEditResubmit?: (content: string) => void;
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

export const MessageBubble = memo(function MessageBubble({ message, isStreaming, isLatestAssistantMessage, onRegenerate, onEditResubmit }: MessageBubbleProps) {
  const [showThinking, setShowThinking] = useState(false);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [sourcesExpanded, setSourcesExpanded] = useState(false);

  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const PhaseIcon = message.phase ? phaseIcons[message.phase] : null;
  const shouldAutoPlayVoice = isLatestAssistantMessage && !isStreaming;
  const toolCalls = message.toolCalls || [];
  const searchToolCalls = toolCalls.filter((tool) => tool.name === 'web_search');
  const otherToolCalls = toolCalls.filter((tool) => tool.name !== 'web_search');

  const sources = searchToolCalls.reduce<ToolCitation[]>((acc, tool) => {
    if (tool.result && typeof tool.result !== 'string') {
      return [...acc, ...(tool.result.citations || [])];
    }
    return acc;
  }, []);

  const toggleTool = (toolId: string) => {
    const newExpanded = new Set(expandedTools);
    if (newExpanded.has(toolId)) {
      newExpanded.delete(toolId);
    } else {
      newExpanded.add(toolId);
    }
    setExpandedTools(newExpanded);
  };

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [message.content]);

  const handleEditSave = useCallback(() => {
    if (editContent.trim() && onEditResubmit) {
      onEditResubmit(editContent.trim());
      setIsEditing(false);
    }
  }, [editContent, onEditResubmit]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn(
        'flex gap-3 p-4 rounded-xl group',
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

        {isEditing && isUser ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl p-4 max-w-[85%] ml-auto bg-card border border-primary/40 shadow-md"
          >
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[80px] resize-none border-0 bg-transparent focus-visible:ring-0 text-base"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-border/30">
              <Button variant="ghost" size="sm" onClick={() => { setIsEditing(false); setEditContent(message.content); }}>
                <X className="w-3.5 h-3.5 mr-1" /> Cancel
              </Button>
              <Button size="sm" onClick={handleEditSave} disabled={!editContent.trim()}>
                Send
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            className={cn(
              'rounded-2xl p-4 max-w-[85%] shadow-md transition-all duration-200',
              isUser
                ? 'bg-gradient-to-br from-primary via-primary/95 to-primary/85 text-primary-foreground ml-auto shadow-primary/20'
                : 'bg-card/90 border border-border/50 backdrop-blur-sm shadow-[0_4px_20px_hsl(var(--foreground)/0.05)] hover:shadow-[0_4px_25px_hsl(var(--foreground)/0.08)]'
            )}
          >
            <div className="max-w-none">
              {isAssistant && searchToolCalls.length > 0 && (
                <div className="mb-3 space-y-3">
                  {searchToolCalls.map((tool) => {
                    const query = typeof tool.input?.query === 'string'
                      ? tool.input.query
                      : typeof tool.arguments?.query === 'string'
                        ? tool.arguments.query
                        : '';
                    const result: ToolResult | undefined = typeof tool.result === 'string'
                      ? { content: tool.result }
                      : tool.result;
                    return (
                      <SearchIndicator
                        key={tool.id}
                        query={query}
                        status={tool.status}
                        result={result}
                      />
                    );
                  })}
                </div>
              )}
              {isUser ? (
                <p className="whitespace-pre-wrap">{message.content}</p>
              ) : (
                <MarkdownRenderer 
                  content={message.content} 
                  className={cn(
                    isUser && "[&_a]:text-primary-foreground [&_code]:bg-primary-foreground/20 [&_code]:text-primary-foreground"
                  )}
                  enableEmailDrafts
                  isStreaming={isStreaming}
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
            {isAssistant && sources.length > 0 && !isStreaming && (
              <div className="mt-3 pt-3 border-t border-border/30">
                <button
                  type="button"
                  onClick={() => setSourcesExpanded(!sourcesExpanded)}
                  className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground"
                >
                  <Link className="h-3.5 w-3.5" />
                  Sources ({sources.length})
                  {sourcesExpanded ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>
                <AnimatePresence>
                  {sourcesExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 space-y-2">
                        {sources.map((source, index) => (
                          <a
                            key={`${source.url}-${index}`}
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block rounded-lg border border-border/40 bg-muted/40 px-3 py-2 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                          >
                            <div className="font-medium text-foreground/90">
                              {source.title || source.url}
                            </div>
                            {source.snippet && (
                              <div className="mt-1 text-[11px] text-muted-foreground">
                                {source.snippet}
                              </div>
                            )}
                          </a>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        )}

        {!isStreaming && !isEditing && message.content && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200',
              isUser ? 'justify-end' : 'justify-start'
            )}
          >
            <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground hover:text-foreground" onClick={handleCopy}>
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </Button>
            {isUser && onEditResubmit && (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground hover:text-foreground" onClick={() => setIsEditing(true)}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            )}
            {isAssistant && onRegenerate && (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground hover:text-foreground" onClick={onRegenerate}>
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            )}
            {isAssistant && (
              <>
                <Button
                  variant="ghost" size="sm"
                  className={cn('h-7 px-2', feedback === 'up' ? 'text-emerald-500' : 'text-muted-foreground hover:text-foreground')}
                  onClick={() => setFeedback(feedback === 'up' ? null : 'up')}
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost" size="sm"
                  className={cn('h-7 px-2', feedback === 'down' ? 'text-red-500' : 'text-muted-foreground hover:text-foreground')}
                  onClick={() => setFeedback(feedback === 'down' ? null : 'down')}
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
          </motion.div>
        )}

        {otherToolCalls.length > 0 && (
          <div className="space-y-2 mt-3">
            {otherToolCalls.map((tool) => (
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

  const toolInput = tool.input || tool.arguments || {};
  const resultText = typeof tool.result === 'string'
    ? tool.result
    : tool.result?.content || '';

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
                  {JSON.stringify(toolInput, null, 2)}
                </pre>
              </div>
              {resultText && (
                <div>
                  <span className="text-xs text-muted-foreground">Result:</span>
                  <pre className="mt-1 p-2 rounded bg-muted/50 text-xs overflow-x-auto max-h-32 overflow-y-auto">
                    {resultText}
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
