'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wrench, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Brain,
  Eye,
  ArrowRight,
  ChevronRight,
  Copy,
  Check,
  Terminal,
  FileJson,
  Timer,
  Calendar
} from 'lucide-react';
import { format, formatDistanceStrict } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useChatStore, type ToolCall } from '@/lib/store';
import { cn } from '@/lib/utils';

export function ToolPanel() {
  const { currentToolCall, currentPhase, sessions, activeSessionId } = useChatStore();
  
  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const recentTools = activeSession?.messages
    .flatMap((m) => m.toolCalls || [])
    .slice(-10)
    .reverse() || [];

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold flex items-center gap-2">
          <Wrench className="w-4 h-4 text-primary" />
          Tool Execution
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Real-time visibility into ALFIE&apos;s actions
        </p>
      </div>

      <div className="p-4 border-b border-border">
        <ReActVisualization phase={currentPhase} />
      </div>

      {currentToolCall && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="border-b border-border overflow-hidden"
        >
          <div className="p-4">
            <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              CURRENTLY EXECUTING
            </h4>
            <ToolExecutionCard tool={currentToolCall} isActive />
          </div>
        </motion.div>
      )}

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          <h4 className="text-xs font-medium text-muted-foreground">
            EXECUTION HISTORY ({recentTools.length})
          </h4>
          <AnimatePresence mode="popLayout">
            {recentTools.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-12 text-center"
              >
                <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                  <Terminal className="w-6 h-6 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground/60">
                  No tools executed yet
                </p>
                <p className="text-xs text-muted-foreground/40 mt-1">
                  Tool executions will appear here
                </p>
              </motion.div>
            ) : (
              recentTools.map((tool, index) => (
                <motion.div
                  key={tool.id}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                  transition={{ 
                    duration: 0.3,
                    delay: index * 0.05,
                    ease: [0.23, 1, 0.32, 1]
                  }}
                  layout
                >
                  <ToolExecutionCard tool={tool} />
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>
    </div>
  );
}

interface ReActVisualizationProps {
  phase: 'idle' | 'think' | 'act' | 'observe';
}

function ReActVisualization({ phase }: ReActVisualizationProps) {
  const phases = [
    { key: 'think', label: 'Think', icon: Brain, color: 'amber' },
    { key: 'act', label: 'Act', icon: Wrench, color: 'emerald' },
    { key: 'observe', label: 'Observe', icon: Eye, color: 'cyan' },
  ] as const;

  return (
    <div className="flex items-center justify-between">
      {phases.map((p, idx) => (
        <div key={p.key} className="flex items-center">
          <motion.div
            animate={phase === p.key ? {
              scale: [1, 1.1, 1],
              boxShadow: [
                `0 0 0 0 var(--${p.color}-500)`,
                `0 0 20px 4px hsl(var(--${p.color === 'amber' ? 'warning' : p.color === 'emerald' ? 'success' : 'info'}) / 0.3)`,
                `0 0 0 0 var(--${p.color}-500)`,
              ],
            } : {}}
            transition={{ duration: 1.5, repeat: phase === p.key ? Infinity : 0 }}
            className={cn(
              'flex flex-col items-center gap-1 p-3 rounded-xl transition-all',
              phase === p.key
                ? `bg-${p.color}-500/10 border border-${p.color}-500/30`
                : 'bg-muted/50 opacity-50'
            )}
          >
            <p.icon className={cn(
              'w-5 h-5',
              phase === p.key ? `text-${p.color}-500` : 'text-muted-foreground'
            )} />
            <span className={cn(
              'text-xs font-medium',
              phase === p.key ? `text-${p.color}-500` : 'text-muted-foreground'
            )}>
              {p.label}
            </span>
          </motion.div>
          {idx < phases.length - 1 && (
            <ArrowRight className={cn(
              'w-4 h-4 mx-2',
              phase !== 'idle' ? 'text-primary' : 'text-muted-foreground/30'
            )} />
          )}
        </div>
      ))}
    </div>
  );
}

interface StatusConfig {
  icon: typeof Clock;
  color: string;
  bg: string;
  badge: string;
  label: string;
  animate?: boolean;
}

const statusConfig: Record<ToolCall['status'], StatusConfig> = {
  pending: { 
    icon: Clock, 
    color: 'text-muted-foreground', 
    bg: 'bg-muted',
    badge: 'bg-muted text-muted-foreground border-muted-foreground/20',
    label: 'Pending'
  },
  running: { 
    icon: Loader2, 
    color: 'text-blue-500', 
    bg: 'bg-blue-500/10',
    badge: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    label: 'Running',
    animate: true
  },
  completed: { 
    icon: CheckCircle2, 
    color: 'text-emerald-500', 
    bg: 'bg-emerald-500/10',
    badge: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    label: 'Completed'
  },
  error: { 
    icon: XCircle, 
    color: 'text-red-500', 
    bg: 'bg-red-500/10',
    badge: 'bg-red-500/10 text-red-500 border-red-500/20',
    label: 'Failed'
  },
};

interface ToolExecutionCardProps {
  tool: ToolCall;
  isActive?: boolean;
}

function ToolExecutionCard({ tool, isActive = false }: ToolExecutionCardProps) {
  const [inputExpanded, setInputExpanded] = useState(false);
  const [outputExpanded, setOutputExpanded] = useState(false);
  
  const config = statusConfig[tool.status];
  const StatusIcon = config.icon;
  
  const duration = useMemo(() => {
    if (tool.startTime && tool.endTime) {
      const start = new Date(tool.startTime);
      const end = new Date(tool.endTime);
      const ms = end.getTime() - start.getTime();
      if (ms < 1000) return `${ms}ms`;
      return formatDistanceStrict(start, end, { unit: 'second' });
    }
    if (tool.startTime && tool.status === 'running') {
      const start = new Date(tool.startTime);
      const ms = Date.now() - start.getTime();
      if (ms < 1000) return `${ms}ms`;
      return formatDistanceStrict(start, new Date(), { unit: 'second' });
    }
    return null;
  }, [tool.startTime, tool.endTime, tool.status]);

  const hasInput = tool.arguments && Object.keys(tool.arguments).length > 0;
  const hasOutput = tool.result && tool.result.length > 0;

  return (
    <motion.div
      layout
      className={cn(
        'rounded-xl border overflow-hidden transition-all',
        isActive 
          ? 'border-primary/40 bg-primary/5 shadow-lg shadow-primary/5' 
          : 'border-border/60 bg-card/50 hover:bg-card/80 hover:border-border',
        tool.status === 'error' && 'border-red-500/30 bg-red-500/5'
      )}
    >
      <div className="p-3">
        <div className="flex items-start gap-3">
          <motion.div
            animate={config.animate ? { rotate: 360 } : {}}
            transition={config.animate ? { duration: 1, repeat: Infinity, ease: 'linear' } : {}}
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
              config.bg
            )}
          >
            <StatusIcon className={cn('w-4 h-4', config.color)} />
          </motion.div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-medium text-sm truncate">{tool.name}</h4>
              <Badge 
                variant="outline" 
                className={cn('text-[10px] px-1.5 py-0 h-5 font-medium', config.badge)}
              >
                {config.label}
              </Badge>
            </div>
            
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              {tool.startTime && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(tool.startTime), 'HH:mm:ss')}
                </span>
              )}
              {duration && (
                <span className="flex items-center gap-1">
                  <Timer className="w-3 h-3" />
                  {duration}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-border/50">
        {hasInput && (
          <CollapsibleSection
            title="Input"
            icon={<FileJson className="w-3.5 h-3.5" />}
            isExpanded={inputExpanded}
            onToggle={() => setInputExpanded(!inputExpanded)}
            content={JSON.stringify(tool.arguments, null, 2)}
            language="json"
          />
        )}

        {hasOutput && (
          <CollapsibleSection
            title="Output"
            icon={<Terminal className="w-3.5 h-3.5" />}
            isExpanded={outputExpanded}
            onToggle={() => setOutputExpanded(!outputExpanded)}
            content={tool.result || ''}
            language={detectLanguage(tool.result || '')}
            isError={tool.status === 'error'}
          />
        )}

        {!hasInput && !hasOutput && (
          <div className="px-3 py-2 text-xs text-muted-foreground/50 italic">
            No input/output data
          </div>
        )}
      </div>
    </motion.div>
  );
}

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  content: string;
  language?: string;
  isError?: boolean;
}

function CollapsibleSection({ 
  title, 
  icon, 
  isExpanded, 
  onToggle, 
  content, 
  language = 'text',
  isError = false 
}: CollapsibleSectionProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const truncatedPreview = content.length > 100 
    ? content.slice(0, 100) + '...' 
    : content;

  return (
    <div className={cn(
      'border-t border-border/30',
      isError && 'bg-red-500/5'
    )}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-3 py-2 flex items-center gap-2 hover:bg-muted/30 transition-colors text-left"
      >
        <motion.div
          animate={{ rotate: isExpanded ? 90 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        </motion.div>
        <span className={cn('text-muted-foreground', isError && 'text-red-400')}>
          {icon}
        </span>
        <span className={cn(
          'text-xs font-medium',
          isError ? 'text-red-400' : 'text-muted-foreground'
        )}>
          {title}
        </span>
        {!isExpanded && (
          <span className="flex-1 text-xs text-muted-foreground/50 truncate ml-2 font-mono">
            {truncatedPreview.split('\n')[0]}
          </span>
        )}
      </button>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden"
          >
            <div className="relative">
              <SyntaxHighlightedCode 
                code={content} 
                language={language}
                isError={isError}
              />
              <button
                type="button"
                onClick={handleCopy}
                className={cn(
                  'absolute top-2 right-2 p-1.5 rounded-md transition-all',
                  'bg-background/80 hover:bg-background border border-border/50',
                  'text-muted-foreground hover:text-foreground'
                )}
                title="Copy to clipboard"
              >
                <AnimatePresence mode="wait">
                  {copied ? (
                    <motion.div
                      key="check"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="copy"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface SyntaxHighlightedCodeProps {
  code: string;
  language?: string;
  isError?: boolean;
}

function SyntaxHighlightedCode({ code, language = 'text', isError = false }: SyntaxHighlightedCodeProps) {
  const highlighted = useMemo(() => highlightSyntax(code, language), [code, language]);
  
  return (
    <div className={cn(
      'mx-3 mb-3 rounded-lg overflow-hidden border',
      isError ? 'border-red-500/20 bg-red-950/20' : 'border-border/50 bg-background/50'
    )}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30 bg-muted/30">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          {language}
        </span>
      </div>
      <ScrollArea className="max-h-64">
        <pre className={cn(
          'p-3 text-xs font-mono leading-relaxed overflow-x-auto',
          isError && 'text-red-300'
        )}>
          <code 
            className="syntax-highlighted"
            dangerouslySetInnerHTML={{ __html: highlighted }} 
          />
        </pre>
      </ScrollArea>
    </div>
  );
}

function escapeHtmlForSyntaxHighlighting(code: string): string {
  return code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function highlightSyntax(code: string, language: string): string {
  let escaped = escapeHtmlForSyntaxHighlighting(code);

  if (language === 'json') {
    escaped = escaped
      .replace(/"([^"\\]|\\.)*"/g, (match) => `<span class="text-emerald-400">${match}</span>`)
      .replace(/\b(-?\d+\.?\d*)\b/g, '<span class="text-amber-400">$1</span>')
      .replace(/\b(true|false|null)\b/g, '<span class="text-purple-400">$1</span>');
  } else if (language === 'javascript' || language === 'typescript') {
    escaped = escaped
      .replace(/\b(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|try|catch|throw|new|this|typeof|instanceof)\b/g, 
        '<span class="text-purple-400">$1</span>')
      .replace(/(["'`])(?:(?!\1)[^\\]|\\.)*\1/g, '<span class="text-emerald-400">$&</span>')
      .replace(/\b(\d+\.?\d*)\b/g, '<span class="text-amber-400">$1</span>')
      .replace(/(\/\/.*$)/gm, '<span class="text-gray-500 italic">$1</span>')
      .replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="text-gray-500 italic">$1</span>');
  } else if (language === 'bash' || language === 'shell') {
    escaped = escaped
      .replace(/(#.*$)/gm, '<span class="text-gray-500 italic">$1</span>')
      .replace(/(["'])(?:(?!\1)[^\\]|\\.)*\1/g, '<span class="text-emerald-400">$&</span>')
      .replace(/^(\s*)([\w-]+)/gm, '$1<span class="text-cyan-400">$2</span>')
      .replace(/(\s)(--?[\w-]+)/g, '$1<span class="text-amber-400">$2</span>');
  }

  return escaped;
}

function detectLanguage(content: string): string {
  const trimmed = content.trim();
  
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      // Not valid JSON, continue detection
    }
  }
  
  if (trimmed.startsWith('$') || 
      trimmed.includes('#!/bin/') ||
      /^(npm|yarn|pnpm|git|cd|ls|mkdir|rm|cp|mv|cat|echo)\s/m.test(trimmed)) {
    return 'bash';
  }
  
  if (/^(const|let|var|function|import|export|class)\s/m.test(trimmed) ||
      /=>\s*{/.test(trimmed)) {
    return 'typescript';
  }
  
  return 'text';
}
