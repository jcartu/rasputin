'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  GitMerge,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Edit3,
  ArrowLeft,
  ArrowRight,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useDiffViewerStore } from '@/lib/diff-viewer';
import type { MergeConflict } from '@/lib/diff-viewer';

interface MergeConflictResolverProps {
  conflicts: MergeConflict[];
  filePath: string;
  onResolveAll?: () => void;
}

export function MergeConflictResolver({
  conflicts,
  filePath,
  onResolveAll,
}: MergeConflictResolverProps) {
  const [expandedConflict, setExpandedConflict] = useState<string | null>(
    conflicts[0]?.id || null
  );

  const unresolvedCount = conflicts.filter((c) => !c.resolution).length;
  const allResolved = unresolvedCount === 0;

  if (conflicts.length === 0) return null;

  return (
    <div className="border border-yellow-500/30 rounded-lg overflow-hidden bg-yellow-500/5">
      <div className="p-3 flex items-center justify-between bg-yellow-500/10 border-b border-yellow-500/20">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-500" />
          <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
            {conflicts.length} Merge Conflict{conflicts.length !== 1 ? 's' : ''}
          </span>
          {allResolved ? (
            <Badge className="bg-green-500/20 text-green-600 dark:text-green-400 text-xs">
              All resolved
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs border-yellow-500/30 text-yellow-600">
              {unresolvedCount} unresolved
            </Badge>
          )}
        </div>
        {allResolved && onResolveAll && (
          <Button size="sm" className="h-7" onClick={onResolveAll}>
            <GitMerge className="w-3.5 h-3.5 mr-1" />
            Apply All
          </Button>
        )}
      </div>

      <ScrollArea className="max-h-[500px]">
        <div className="divide-y divide-yellow-500/20">
          {conflicts.map((conflict, index) => (
            <ConflictItem
              key={conflict.id}
              conflict={conflict}
              index={index}
              isExpanded={expandedConflict === conflict.id}
              onToggle={() =>
                setExpandedConflict(expandedConflict === conflict.id ? null : conflict.id)
              }
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

interface ConflictItemProps {
  conflict: MergeConflict;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}

function ConflictItem({ conflict, index, isExpanded, onToggle }: ConflictItemProps) {
  const { resolveConflict } = useDiffViewerStore();
  const [customContent, setCustomContent] = useState('');
  const [showCustomEditor, setShowCustomEditor] = useState(false);

  const handleResolve = (resolution: 'ours' | 'theirs' | 'both' | 'custom') => {
    if (resolution === 'custom') {
      resolveConflict(conflict.id, resolution, customContent);
    } else {
      resolveConflict(conflict.id, resolution);
    }
    setShowCustomEditor(false);
  };

  const isResolved = !!conflict.resolution;

  return (
    <div className="p-3">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between text-left group"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground">#{index + 1}</span>
          <span className="text-sm">
            Lines {conflict.startLine} - {conflict.endLine}
          </span>
          {isResolved && (
            <Badge className="bg-green-500/20 text-green-600 dark:text-green-400 text-xs">
              <Check className="w-3 h-3 mr-1" />
              {conflict.resolution}
            </Badge>
          )}
        </div>
        <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <ConflictSide
                  label={conflict.oursLabel}
                  content={conflict.oursContent}
                  variant="ours"
                  isSelected={conflict.resolution === 'ours'}
                  onSelect={() => handleResolve('ours')}
                />
                <ConflictSide
                  label={conflict.theirsLabel}
                  content={conflict.theirsContent}
                  variant="theirs"
                  isSelected={conflict.resolution === 'theirs'}
                  onSelect={() => handleResolve('theirs')}
                />
              </div>

              {conflict.baseContent && (
                <div className="p-2 rounded-lg bg-muted/50 border border-border">
                  <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                    <Layers className="w-3.5 h-3.5" />
                    Base version
                  </div>
                  <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">
                    {conflict.baseContent}
                  </pre>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={conflict.resolution === 'both' ? 'default' : 'outline'}
                  className="h-7 text-xs"
                  onClick={() => handleResolve('both')}
                >
                  <Layers className="w-3 h-3 mr-1" />
                  Keep Both
                </Button>
                <Button
                  size="sm"
                  variant={showCustomEditor ? 'secondary' : 'outline'}
                  className="h-7 text-xs"
                  onClick={() => {
                    setShowCustomEditor(!showCustomEditor);
                    if (!customContent) {
                      setCustomContent(conflict.oursContent);
                    }
                  }}
                >
                  <Edit3 className="w-3 h-3 mr-1" />
                  Custom Edit
                </Button>
              </div>

              <AnimatePresence>
                {showCustomEditor && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="space-y-2"
                  >
                    <Textarea
                      value={customContent}
                      onChange={(e) => setCustomContent(e.target.value)}
                      className="min-h-[100px] font-mono text-xs"
                      placeholder="Enter custom resolution..."
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        className="h-7"
                        onClick={() => handleResolve('custom')}
                        disabled={!customContent.trim()}
                      >
                        <Check className="w-3.5 h-3.5 mr-1" />
                        Apply Custom
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7"
                        onClick={() => setShowCustomEditor(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface ConflictSideProps {
  label: string;
  content: string;
  variant: 'ours' | 'theirs';
  isSelected: boolean;
  onSelect: () => void;
}

function ConflictSide({ label, content, variant, isSelected, onSelect }: ConflictSideProps) {
  const colors = {
    ours: {
      bg: 'bg-blue-500/10',
      border: isSelected ? 'border-blue-500' : 'border-blue-500/30',
      icon: 'text-blue-500',
      badge: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
    },
    theirs: {
      bg: 'bg-purple-500/10',
      border: isSelected ? 'border-purple-500' : 'border-purple-500/30',
      icon: 'text-purple-500',
      badge: 'bg-purple-500/20 text-purple-600 dark:text-purple-400',
    },
  };

  const colorConfig = colors[variant];

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'p-3 rounded-lg border-2 text-left transition-all',
        colorConfig.bg,
        colorConfig.border,
        isSelected && 'ring-2 ring-offset-2 ring-offset-background',
        isSelected && (variant === 'ours' ? 'ring-blue-500' : 'ring-purple-500')
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {variant === 'ours' ? (
            <ArrowLeft className={cn('w-3.5 h-3.5', colorConfig.icon)} />
          ) : (
            <ArrowRight className={cn('w-3.5 h-3.5', colorConfig.icon)} />
          )}
          <span className="text-xs font-medium">{label}</span>
        </div>
        {isSelected && (
          <Badge className={cn('text-xs', colorConfig.badge)}>
            <Check className="w-3 h-3 mr-1" />
            Selected
          </Badge>
        )}
      </div>
      <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap overflow-hidden max-h-32">
        {content}
      </pre>
    </button>
  );
}
