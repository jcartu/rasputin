'use client';

import { motion } from 'framer-motion';
import {
  GitCompare,
  X,
  Columns,
  Rows,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Settings,
  Plus,
  Minus,
  FileCode,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useDiffViewerStore } from '@/lib/diff-viewer';
import type { FileDiff, DiffViewerConfig } from '@/lib/diff-viewer';

interface DiffViewerHeaderProps {
  files: FileDiff[];
  stats: {
    additions: number;
    deletions: number;
    filesChanged: number;
  };
  onClose?: () => void;
}

export function DiffViewerHeader({ files, stats, onClose }: DiffViewerHeaderProps) {
  const {
    config,
    setViewMode,
    updateConfig,
    collapseAllHunks,
    expandAllHunks,
    selectedFileId,
    selectFile,
  } = useDiffViewerStore();

  const selectedFile = files.find((f) => f.id === selectedFileId);

  return (
    <div className="flex flex-col border-b border-border bg-card/50">
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <GitCompare className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-sm">Diff Viewer</h2>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{stats.filesChanged} file{stats.filesChanged !== 1 ? 's' : ''} changed</span>
              <span className="flex items-center gap-1 text-green-500">
                <Plus className="w-3 h-3" />
                {stats.additions}
              </span>
              <span className="flex items-center gap-1 text-red-500">
                <Minus className="w-3 h-3" />
                {stats.deletions}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border p-0.5">
            <Button
              variant={config.viewMode === 'split' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2 gap-1.5"
              onClick={() => setViewMode('split')}
            >
              <Columns className="w-3.5 h-3.5" />
              <span className="text-xs">Split</span>
            </Button>
            <Button
              variant={config.viewMode === 'unified' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2 gap-1.5"
              onClick={() => setViewMode('unified')}
            >
              <Rows className="w-3.5 h-3.5" />
              <span className="text-xs">Unified</span>
            </Button>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={expandAllHunks}
              title="Expand all"
            >
              <ChevronDown className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={collapseAllHunks}
              title="Collapse all"
            >
              <ChevronUp className="w-4 h-4" />
            </Button>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2">
                <Settings className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuCheckboxItem
                checked={config.showLineNumbers}
                onCheckedChange={(checked) => updateConfig({ showLineNumbers: checked })}
              >
                Show line numbers
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={config.syntaxHighlighting}
                onCheckedChange={(checked) => updateConfig({ syntaxHighlighting: checked })}
              >
                Syntax highlighting
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={config.wordWrap}
                onCheckedChange={(checked) => updateConfig({ wordWrap: checked })}
              >
                Word wrap
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={config.showWhitespace}
                onCheckedChange={(checked) => updateConfig({ showWhitespace: checked })}
              >
                Show whitespace
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={expandAllHunks}>
                <ChevronDown className="w-4 h-4 mr-2" />
                Expand all hunks
              </DropdownMenuItem>
              <DropdownMenuItem onClick={collapseAllHunks}>
                <ChevronUp className="w-4 h-4 mr-2" />
                Collapse all hunks
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {onClose && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {files.length > 1 && (
        <div className="flex items-center gap-1 px-3 pb-2 overflow-x-auto">
          {files.map((file) => (
            <FileTab
              key={file.id}
              file={file}
              isSelected={file.id === selectedFileId}
              onClick={() => selectFile(file.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface FileTabProps {
  file: FileDiff;
  isSelected: boolean;
  onClick: () => void;
}

function FileTab({ file, isSelected, onClick }: FileTabProps) {
  const statusColors = {
    added: 'text-green-500',
    deleted: 'text-red-500',
    modified: 'text-yellow-500',
    renamed: 'text-blue-500',
    copied: 'text-purple-500',
  };

  const fileName = file.newPath.split('/').pop() || file.newPath;
  const filePath = file.newPath.split('/').slice(0, -1).join('/');

  return (
    <motion.button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors whitespace-nowrap',
        isSelected
          ? 'bg-primary/10 text-primary border border-primary/20'
          : 'hover:bg-muted/50 text-muted-foreground'
      )}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <FileCode className={cn('w-3.5 h-3.5', statusColors[file.status])} />
      <span className="font-medium">{fileName}</span>
      {filePath && <span className="text-muted-foreground/60 hidden sm:inline">{filePath}/</span>}
      <div className="flex items-center gap-1 ml-1">
        {file.additions > 0 && (
          <span className="text-green-500 text-[10px]">+{file.additions}</span>
        )}
        {file.deletions > 0 && (
          <span className="text-red-500 text-[10px]">-{file.deletions}</span>
        )}
      </div>
    </motion.button>
  );
}
