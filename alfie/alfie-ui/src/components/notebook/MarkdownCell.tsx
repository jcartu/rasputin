'use client';

import { memo, useCallback, useState, useRef, useEffect } from 'react';
import { Edit2, Trash2, Copy, ChevronUp, ChevronDown, MoreHorizontal, Code, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { useNotebookStore } from '@/lib/notebook/store';
import type { NotebookCell, CellState } from '@/lib/notebook/types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeHighlight from 'rehype-highlight';

interface MarkdownCellProps {
  notebookId: string;
  cell: NotebookCell;
  cellState: CellState;
  isActive: boolean;
  isSelected: boolean;
}

export const MarkdownCell = memo(function MarkdownCell({
  notebookId,
  cell,
  cellState,
  isActive,
  isSelected,
}: MarkdownCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(cell.source);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    updateCellSource,
    updateCellType,
    deleteCell,
    duplicateCell,
    moveCell,
    setActiveCell,
    setCellCollapsed,
  } = useNotebookStore();

  useEffect(() => {
    setEditValue(cell.source);
  }, [cell.source]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(
        textareaRef.current.value.length,
        textareaRef.current.value.length
      );
    }
  }, [isEditing]);

  const handleClick = useCallback(() => {
    setActiveCell(notebookId, cell.id);
  }, [notebookId, cell.id, setActiveCell]);

  const handleDoubleClick = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleSave = useCallback(() => {
    updateCellSource(notebookId, cell.id, editValue);
    setIsEditing(false);
  }, [notebookId, cell.id, editValue, updateCellSource]);

  const handleCancel = useCallback(() => {
    setEditValue(cell.source);
    setIsEditing(false);
  }, [cell.source]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleSave();
    }
  }, [handleCancel, handleSave]);

  const handleDelete = useCallback(() => {
    deleteCell(notebookId, cell.id);
  }, [notebookId, cell.id, deleteCell]);

  const handleDuplicate = useCallback(() => {
    duplicateCell(notebookId, cell.id);
  }, [notebookId, cell.id, duplicateCell]);

  const handleMoveUp = useCallback(() => {
    moveCell(notebookId, cell.id, 'up');
  }, [notebookId, cell.id, moveCell]);

  const handleMoveDown = useCallback(() => {
    moveCell(notebookId, cell.id, 'down');
  }, [notebookId, cell.id, moveCell]);

  const handleConvertToCode = useCallback(() => {
    updateCellType(notebookId, cell.id, 'code');
  }, [notebookId, cell.id, updateCellType]);

  const handleCopyContent = useCallback(() => {
    navigator.clipboard.writeText(cell.source);
  }, [cell.source]);

  const handleToggleCollapse = useCallback(() => {
    setCellCollapsed(notebookId, cell.id, !cellState.isCollapsed);
  }, [notebookId, cell.id, cellState.isCollapsed, setCellCollapsed]);

  const isEmpty = !cell.source.trim();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={(e) => { if (e.key === 'Enter') handleClick(); if (e.key === ' ') handleDoubleClick(); }}
      className={`
        group relative border rounded-lg overflow-hidden transition-all
        ${isActive ? 'border-primary ring-1 ring-primary/50' : 'border-border'}
        ${isSelected ? 'bg-primary/5' : 'bg-card'}
      `}
    >
      <div className="absolute top-1 right-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        {!isEditing && (
          <>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setIsEditing(true)}>
              <Edit2 className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={handleCopyContent}>
              <Copy className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={handleMoveUp}>
              <ChevronUp className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={handleMoveDown}>
              <ChevronDown className="h-3 w-3" />
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleDuplicate}>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleConvertToCode}>
                  <Code className="h-4 w-4 mr-2" />
                  Convert to Code
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleToggleCollapse}>
                  {cellState.isCollapsed ? 'Expand' : 'Collapse'} Cell
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
        
        {isEditing && (
          <>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-green-500" onClick={handleSave}>
              <Check className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500" onClick={handleCancel}>
              <X className="h-3 w-3" />
            </Button>
          </>
        )}
      </div>

      {cellState.isCollapsed ? (
        <div
          role="button"
          tabIndex={0}
          className="px-4 py-2 text-muted-foreground text-sm cursor-pointer hover:bg-muted/30"
          onClick={handleToggleCollapse}
          onKeyDown={(e) => e.key === 'Enter' && handleToggleCollapse()}
        >
          <Edit2 className="h-4 w-4 inline mr-2" />
          {cell.source.split('\n')[0].substring(0, 50)}
          {cell.source.length > 50 && '...'}
        </div>
      ) : isEditing ? (
        <div className="p-2">
          <Textarea
            ref={textareaRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-h-[100px] font-mono text-sm resize-y bg-muted/30 border-0 focus-visible:ring-1"
            placeholder="Enter Markdown..."
          />
          <div className="text-xs text-muted-foreground mt-1">
            Press Ctrl+Enter to save, Escape to cancel
          </div>
        </div>
      ) : isEmpty ? (
        <div
          role="button"
          tabIndex={0}
          className="px-4 py-8 text-center text-muted-foreground cursor-pointer hover:bg-muted/30"
          onClick={() => setIsEditing(true)}
          onKeyDown={(e) => e.key === 'Enter' && setIsEditing(true)}
        >
          <Edit2 className="h-6 w-6 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Double-click to edit markdown</p>
        </div>
      ) : (
        <div className="px-4 py-3 prose prose-invert prose-sm max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex, rehypeRaw, rehypeHighlight]}
            components={{
              table: ({ children }) => (
                <div className="overflow-x-auto">
                  <table className="border-collapse border border-border">{children}</table>
                </div>
              ),
              th: ({ children }) => (
                <th className="border border-border px-3 py-2 bg-muted/50">{children}</th>
              ),
              td: ({ children }) => (
                <td className="border border-border px-3 py-2">{children}</td>
              ),
              a: ({ href, children }) => (
                <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  {children}
                </a>
              ),
              code: ({ className, children, ...props }) => {
                const match = /language-(\w+)/.exec(className || '');
                const isInline = !match;
                return isInline ? (
                  <code className="bg-muted px-1 py-0.5 rounded text-sm" {...props}>
                    {children}
                  </code>
                ) : (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              },
            }}
          >
            {cell.source}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
});
