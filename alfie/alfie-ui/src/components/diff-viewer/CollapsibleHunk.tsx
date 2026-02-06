'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Plus, Minus, MessageSquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useDiffViewerStore } from '@/lib/diff-viewer';
import type { DiffHunk, DiffLine, DiffComment } from '@/lib/diff-viewer';

interface CollapsibleHunkProps {
  hunk: DiffHunk;
  viewMode: 'split' | 'unified';
  showLineNumbers: boolean;
  comments: DiffComment[];
  onAddComment?: (lineNumber: number, side: 'old' | 'new') => void;
}

export function CollapsibleHunk({
  hunk,
  viewMode,
  showLineNumbers,
  comments,
  onAddComment,
}: CollapsibleHunkProps) {
  const { collapsedHunks, toggleHunkCollapse } = useDiffViewerStore();
  const isCollapsed = collapsedHunks.has(hunk.id);

  const additions = hunk.lines.filter((l) => l.type === 'addition').length;
  const deletions = hunk.lines.filter((l) => l.type === 'deletion').length;

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => toggleHunkCollapse(hunk.id)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-muted/50 hover:bg-muted/70 transition-colors text-left"
      >
        <motion.div
          animate={{ rotate: isCollapsed ? 0 : 90 }}
          transition={{ duration: 0.15 }}
        >
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </motion.div>
        
        <span className="font-mono text-xs text-muted-foreground">
          @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
        </span>
        
        {hunk.header && (
          <span className="text-xs text-primary/70 truncate flex-1">{hunk.header}</span>
        )}
        
        <div className="flex items-center gap-2 text-xs">
          {additions > 0 && (
            <span className="flex items-center gap-0.5 text-green-500">
              <Plus className="w-3 h-3" />
              {additions}
            </span>
          )}
          {deletions > 0 && (
            <span className="flex items-center gap-0.5 text-red-500">
              <Minus className="w-3 h-3" />
              {deletions}
            </span>
          )}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {viewMode === 'split' ? (
              <SplitView
                lines={hunk.lines}
                showLineNumbers={showLineNumbers}
                comments={comments}
                onAddComment={onAddComment}
              />
            ) : (
              <UnifiedView
                lines={hunk.lines}
                showLineNumbers={showLineNumbers}
                comments={comments}
                onAddComment={onAddComment}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface SplitViewProps {
  lines: DiffLine[];
  showLineNumbers: boolean;
  comments: DiffComment[];
  onAddComment?: (lineNumber: number, side: 'old' | 'new') => void;
}

function SplitView({ lines, showLineNumbers, comments, onAddComment }: SplitViewProps) {
  const oldLines: (DiffLine | null)[] = [];
  const newLines: (DiffLine | null)[] = [];

  let oldIdx = 0;
  let newIdx = 0;

  for (const line of lines) {
    if (line.type === 'context') {
      oldLines.push(line);
      newLines.push(line);
    } else if (line.type === 'deletion') {
      oldLines.push(line);
    } else if (line.type === 'addition') {
      newLines.push(line);
    }
  }

  while (oldLines.length < newLines.length) {
    oldLines.push(null);
  }
  while (newLines.length < oldLines.length) {
    newLines.push(null);
  }

  return (
    <div className="grid grid-cols-2 divide-x divide-border">
      <div className="overflow-x-auto">
        {oldLines.map((line, idx) => (
          <DiffLineRow
            key={`old-${line?.oldLineNumber ?? `empty-${idx}`}`}
            line={line}
            side="old"
            showLineNumbers={showLineNumbers}
            comments={comments.filter(
              (c) => c.side === 'old' && c.lineNumber === line?.oldLineNumber
            )}
            onAddComment={onAddComment}
          />
        ))}
      </div>
      <div className="overflow-x-auto">
        {newLines.map((line, idx) => (
          <DiffLineRow
            key={`new-${line?.newLineNumber ?? `empty-${idx}`}`}
            line={line}
            side="new"
            showLineNumbers={showLineNumbers}
            comments={comments.filter(
              (c) => c.side === 'new' && c.lineNumber === line?.newLineNumber
            )}
            onAddComment={onAddComment}
          />
        ))}
      </div>
    </div>
  );
}

interface UnifiedViewProps {
  lines: DiffLine[];
  showLineNumbers: boolean;
  comments: DiffComment[];
  onAddComment?: (lineNumber: number, side: 'old' | 'new') => void;
}

function UnifiedView({ lines, showLineNumbers, comments, onAddComment }: UnifiedViewProps) {
  return (
    <div className="overflow-x-auto">
      {lines.map((line) => (
        <DiffLineRow
          key={`${line.type}-${line.oldLineNumber ?? 'x'}-${line.newLineNumber ?? 'x'}`}
          line={line}
          side={line.type === 'deletion' ? 'old' : 'new'}
          showLineNumbers={showLineNumbers}
          showBothLineNumbers
          comments={comments.filter(
            (c) =>
              (c.side === 'old' && c.lineNumber === line.oldLineNumber) ||
              (c.side === 'new' && c.lineNumber === line.newLineNumber)
          )}
          onAddComment={onAddComment}
        />
      ))}
    </div>
  );
}

interface DiffLineRowProps {
  line: DiffLine | null;
  side: 'old' | 'new';
  showLineNumbers: boolean;
  showBothLineNumbers?: boolean;
  comments: DiffComment[];
  onAddComment?: (lineNumber: number, side: 'old' | 'new') => void;
}

function DiffLineRow({
  line,
  side,
  showLineNumbers,
  showBothLineNumbers,
  comments,
  onAddComment,
}: DiffLineRowProps) {
  const [showAddComment, setShowAddComment] = useState(false);

  if (!line) {
    return (
      <div className="h-6 bg-muted/20 border-b border-border/50" />
    );
  }

  const bgColors = {
    addition: 'bg-green-500/10',
    deletion: 'bg-red-500/10',
    context: '',
    header: 'bg-muted/50',
  };

  const prefixColors = {
    addition: 'text-green-500',
    deletion: 'text-red-500',
    context: 'text-muted-foreground',
    header: 'text-muted-foreground',
  };

  const prefix = {
    addition: '+',
    deletion: '-',
    context: ' ',
    header: '',
  };

  const lineNum = side === 'old' ? line.oldLineNumber : line.newLineNumber;

  return (
    <div className="group relative">
      <div
        className={cn(
          'flex items-stretch min-h-[24px] border-b border-border/30 hover:bg-muted/30',
          bgColors[line.type]
        )}
      >
        {showLineNumbers && (
          <>
            {showBothLineNumbers ? (
              <>
                <span className="w-12 flex-shrink-0 px-2 py-0.5 text-right text-xs font-mono text-muted-foreground select-none border-r border-border/30 bg-muted/30">
                  {line.oldLineNumber || ''}
                </span>
                <span className="w-12 flex-shrink-0 px-2 py-0.5 text-right text-xs font-mono text-muted-foreground select-none border-r border-border/30 bg-muted/30">
                  {line.newLineNumber || ''}
                </span>
              </>
            ) : (
              <span className="w-12 flex-shrink-0 px-2 py-0.5 text-right text-xs font-mono text-muted-foreground select-none border-r border-border/30 bg-muted/30">
                {lineNum || ''}
              </span>
            )}
          </>
        )}

        <span
          className={cn(
            'w-5 flex-shrink-0 text-center text-xs font-mono select-none py-0.5',
            prefixColors[line.type]
          )}
        >
          {prefix[line.type]}
        </span>

        <pre className="flex-1 px-2 py-0.5 text-xs font-mono whitespace-pre overflow-hidden text-ellipsis">
          {line.content}
        </pre>

        {onAddComment && lineNum && (
          <button
            type="button"
            className="opacity-0 group-hover:opacity-100 p-1 mr-1 text-muted-foreground hover:text-primary transition-opacity"
            onClick={() => {
              if (lineNum) {
                onAddComment(lineNum, side);
              }
            }}
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
          </button>
        )}

        {comments.length > 0 && (
          <div className="flex items-center gap-0.5 pr-2">
            <span className="text-xs text-primary">{comments.length}</span>
            <MessageSquarePlus className="w-3 h-3 text-primary" />
          </div>
        )}
      </div>

      {comments.length > 0 && (
        <div className="px-4 py-2 bg-muted/30 border-b border-border">
          {comments.map((comment) => (
            <div key={comment.id} className="text-xs">
              <span className="font-medium">{comment.author}:</span>{' '}
              <span className="text-muted-foreground">{comment.content}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
