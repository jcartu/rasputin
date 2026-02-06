'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitCompare,
  FileCode,
  FileText,
  FilePlus,
  FileX,
  ArrowRightLeft,
  Copy,
  AlertTriangle,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useDiffViewerStore, parseGitDiff, parseMergeConflicts, reconstructFileContent } from '@/lib/diff-viewer';
import type { FileDiff, ParsedGitDiff, MergeConflict } from '@/lib/diff-viewer';

import { DiffViewerHeader } from './DiffViewerHeader';
import { MonacoDiffEditor } from './MonacoDiffEditor';
import { DiffComments, AddCommentForm } from './DiffComments';
import { MergeConflictResolver } from './MergeConflictResolver';
import { CollapsibleHunk } from './CollapsibleHunk';

interface DiffViewerProps {
  gitDiff?: string;
  oldContent?: string;
  newContent?: string;
  files?: FileDiff[];
  filePath?: string;
  language?: string;
  onClose?: () => void;
  className?: string;
}

export function DiffViewer({
  gitDiff,
  oldContent,
  newContent,
  files: providedFiles,
  filePath,
  language,
  onClose,
  className,
}: DiffViewerProps) {
  const {
    config,
    selectedFileId,
    selectFile,
    comments,
    getCommentsForFile,
    conflicts,
    setConflicts,
  } = useDiffViewerStore();

  const [addCommentState, setAddCommentState] = useState<{
    lineNumber: number;
    side: 'old' | 'new';
  } | null>(null);

  const parsedData = useMemo<ParsedGitDiff | null>(() => {
    if (providedFiles) {
      return {
        files: providedFiles,
        stats: {
          filesChanged: providedFiles.length,
          additions: providedFiles.reduce((sum, f) => sum + f.additions, 0),
          deletions: providedFiles.reduce((sum, f) => sum + f.deletions, 0),
        },
      };
    }

    if (gitDiff) {
      return parseGitDiff(gitDiff);
    }

    if (oldContent !== undefined && newContent !== undefined) {
      const singleFile: FileDiff = {
        id: 'single-file',
        oldPath: filePath || 'original',
        newPath: filePath || 'modified',
        status: 'modified',
        hunks: [],
        oldContent,
        newContent,
        language: language || 'plaintext',
        binary: false,
        additions: newContent.split('\n').length,
        deletions: oldContent.split('\n').length,
      };

      return {
        files: [singleFile],
        stats: {
          filesChanged: 1,
          additions: singleFile.additions,
          deletions: singleFile.deletions,
        },
      };
    }

    return null;
  }, [gitDiff, oldContent, newContent, providedFiles, filePath, language]);

  const selectedFile = useMemo(() => {
    if (!parsedData) return null;
    if (selectedFileId) {
      return parsedData.files.find((f) => f.id === selectedFileId) || parsedData.files[0];
    }
    return parsedData.files[0];
  }, [parsedData, selectedFileId]);

  const fileConflicts = useMemo(() => {
    if (!selectedFile?.newContent) return [];
    return parseMergeConflicts(selectedFile.newContent, selectedFile.newPath);
  }, [selectedFile]);

  const handleAddComment = useCallback((lineNumber: number, side: 'old' | 'new') => {
    setAddCommentState({ lineNumber, side });
  }, []);

  const handleCloseAddComment = useCallback(() => {
    setAddCommentState(null);
  }, []);

  if (!parsedData || parsedData.files.length === 0) {
    return (
      <div className={cn('flex flex-col h-full bg-background', className)}>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <GitCompare className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-muted-foreground">No diff data provided</p>
          </div>
        </div>
      </div>
    );
  }

  const fileOldContent =
    selectedFile?.oldContent || reconstructFileContent(selectedFile?.hunks || [], 'old');
  const fileNewContent =
    selectedFile?.newContent || reconstructFileContent(selectedFile?.hunks || [], 'new');

  const fileComments = selectedFile ? getCommentsForFile(selectedFile.newPath) : [];

  return (
    <div className={cn('flex flex-col h-full bg-background', className)}>
      <DiffViewerHeader
        files={parsedData.files}
        stats={parsedData.stats}
        onClose={onClose}
      />

      <div className="flex-1 flex flex-col overflow-hidden relative">
        {fileConflicts.length > 0 && (
          <div className="p-3 border-b border-border">
            <MergeConflictResolver
              conflicts={fileConflicts}
              filePath={selectedFile?.newPath || ''}
            />
          </div>
        )}

        {selectedFile && config.syntaxHighlighting && (
          <div className="flex-1 overflow-hidden">
            <MonacoDiffEditor
              file={selectedFile}
              oldContent={fileOldContent}
              newContent={fileNewContent}
              onLineClick={handleAddComment}
            />
          </div>
        )}

        {selectedFile && !config.syntaxHighlighting && (
          <ScrollArea className="flex-1">
            <div className="divide-y divide-border">
              {selectedFile.hunks.map((hunk) => (
                <CollapsibleHunk
                  key={hunk.id}
                  hunk={hunk}
                  viewMode={config.viewMode}
                  showLineNumbers={config.showLineNumbers}
                  comments={fileComments}
                  onAddComment={handleAddComment}
                />
              ))}
            </div>
          </ScrollArea>
        )}

        <AnimatePresence>
          {addCommentState && selectedFile && (
            <AddCommentForm
              filePath={selectedFile.newPath}
              lineNumber={addCommentState.lineNumber}
              side={addCommentState.side}
              onClose={handleCloseAddComment}
            />
          )}
        </AnimatePresence>

        {fileComments.length > 0 && selectedFile && (
          <DiffComments filePath={selectedFile.newPath} />
        )}
      </div>
    </div>
  );
}

interface FileDiffListProps {
  files: FileDiff[];
  selectedFileId: string | null;
  onSelectFile: (fileId: string) => void;
}

export function FileDiffList({ files, selectedFileId, onSelectFile }: FileDiffListProps) {
  const statusIcons = {
    added: FilePlus,
    deleted: FileX,
    modified: FileCode,
    renamed: ArrowRightLeft,
    copied: Copy,
  };

  const statusColors = {
    added: 'text-green-500',
    deleted: 'text-red-500',
    modified: 'text-yellow-500',
    renamed: 'text-blue-500',
    copied: 'text-purple-500',
  };

  return (
    <div className="border-b border-border bg-muted/30">
      <ScrollArea className="max-h-48">
        <div className="p-2 space-y-1">
          {files.map((file) => {
            const Icon = statusIcons[file.status];
            const isSelected = file.id === selectedFileId;

            return (
              <motion.button
                key={file.id}
                type="button"
                onClick={() => onSelectFile(file.id)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors',
                  isSelected
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-muted text-foreground'
                )}
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.98 }}
              >
                <Icon className={cn('w-4 h-4 flex-shrink-0', statusColors[file.status])} />
                <span className="flex-1 truncate text-sm font-mono">{file.newPath}</span>
                <div className="flex items-center gap-2 text-xs">
                  {file.additions > 0 && (
                    <span className="text-green-500">+{file.additions}</span>
                  )}
                  {file.deletions > 0 && (
                    <span className="text-red-500">-{file.deletions}</span>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

export function DiffStats({ stats }: { stats: ParsedGitDiff['stats'] }) {
  return (
    <div className="flex items-center gap-4 text-sm">
      <span className="text-muted-foreground">
        {stats.filesChanged} file{stats.filesChanged !== 1 ? 's' : ''} changed
      </span>
      <span className="flex items-center gap-1 text-green-500">
        <span className="font-bold">+{stats.additions}</span>
        <span className="text-muted-foreground">additions</span>
      </span>
      <span className="flex items-center gap-1 text-red-500">
        <span className="font-bold">-{stats.deletions}</span>
        <span className="text-muted-foreground">deletions</span>
      </span>
    </div>
  );
}
