'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, ChevronDown, ChevronUp, ExternalLink, FileText, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ToolCitation, ToolResult } from '@/lib/store';

interface SearchIndicatorProps {
  query: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  result?: ToolResult;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/^\s*[-*+]\s/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function SearchIndicator({ query, status, result }: SearchIndicatorProps) {
  const isRunning = status === 'running' || status === 'pending';
  const citations: ToolCitation[] = result?.citations || [];
  const [researchExpanded, setResearchExpanded] = useState(false);
  const [researchFullyExpanded, setResearchFullyExpanded] = useState(false);

  const strippedContent = result?.content ? stripMarkdown(result.content) : '';

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
      <div className="px-4 pt-3 pb-3">
        {/* Search header */}
        <div className="flex items-center gap-2 text-sm text-foreground/90">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/20 to-emerald-500/20">
            <Search className={cn('h-4 w-4', isRunning ? 'animate-pulse text-cyan-300' : 'text-cyan-200')} />
          </span>
          <span className="font-medium">Searching:</span>
          <span className="text-foreground/60 truncate flex-1">&quot;{query || '…'}&quot;</span>
          <span
            className={cn(
              'ml-auto flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] uppercase tracking-wide font-medium',
              isRunning
                ? 'bg-cyan-500/20 text-cyan-200'
                : status === 'error'
                  ? 'bg-red-500/20 text-red-200'
                  : 'bg-emerald-500/20 text-emerald-200'
            )}
          >
            {isRunning ? 'Searching' : status === 'error' ? 'Failed' : 'Done'}
          </span>
        </div>

        {/* Shimmer bar while searching */}
        {isRunning && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full w-1/3 rounded-full bg-gradient-to-r from-cyan-400/70 via-primary/80 to-emerald-400/70"
              animate={{ x: ['-100%', '400%'] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
        )}

        {/* Research collected — collapsed by default */}
        {!isRunning && strippedContent && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => {
                if (researchExpanded && researchFullyExpanded) {
                  setResearchFullyExpanded(false);
                  setResearchExpanded(false);
                } else if (researchExpanded) {
                  setResearchFullyExpanded(true);
                } else {
                  setResearchExpanded(true);
                }
              }}
              className="flex items-center gap-2 w-full text-left group/research"
            >
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                <FileText className="h-3 w-3" />
                Research collected
              </span>
              <span className="text-[11px] text-white/30 group-hover/research:text-white/50 transition-colors">
                {researchExpanded ? (researchFullyExpanded ? 'Hide' : 'Show all') : 'Preview'}
              </span>
              {researchExpanded ? (
                <ChevronUp className="h-3 w-3 text-white/30 ml-auto" />
              ) : (
                <ChevronDown className="h-3 w-3 text-white/30 ml-auto" />
              )}
            </button>

            <AnimatePresence>
              {researchExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div
                    className={cn(
                      'mt-2 rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2.5',
                      'text-[12px] leading-relaxed text-white/50',
                      !researchFullyExpanded && 'max-h-[4.5em] overflow-hidden relative'
                    )}
                  >
                    <p className="whitespace-pre-wrap">{strippedContent}</p>
                    {!researchFullyExpanded && (
                      <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-slate-900/90 to-transparent pointer-events-none" />
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Sources / Citations */}
      {!isRunning && citations.length > 0 && (
        <div className="border-t border-white/[0.06] px-4 py-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <BookOpen className="h-3.5 w-3.5" />
            Sources ({citations.length})
          </div>
          <div className="mt-2 space-y-2">
            {citations
              .filter((c) => c.url || c.title)
              .map((citation, index) => {
                const displayTitle = citation.title || (() => {
                  try { return new URL(citation.url).hostname.replace(/^www\./, ''); }
                  catch { return citation.url; }
                })();
                return (
                  <a
                    key={`${citation.url}-${index}`}
                    href={citation.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-start gap-2 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-sm text-foreground/80 transition hover:border-cyan-400/40 hover:bg-white/[0.06] hover:text-foreground"
                  >
                    <ExternalLink className="mt-0.5 h-3.5 w-3.5 text-cyan-200 flex-shrink-0" />
                    <span className="space-y-1 min-w-0">
                      <span className="block text-xs font-semibold text-foreground/90 truncate">
                        {displayTitle}
                      </span>
                      {citation.snippet && (
                        <span className="block text-[11px] text-muted-foreground line-clamp-2">
                          {citation.snippet}
                        </span>
                      )}
                      {citation.url && !citation.title && (
                        <span className="block text-[10px] text-white/25 truncate">
                          {citation.url}
                        </span>
                      )}
                    </span>
                  </a>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
