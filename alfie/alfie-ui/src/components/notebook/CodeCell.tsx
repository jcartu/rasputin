'use client';

import { memo, useCallback, useRef, useEffect, useState } from 'react';
import {
  Play,
  Square,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  MoreHorizontal,
  Code,
  FileText,
} from 'lucide-react';
import Editor, { OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CellOutput } from './CellOutput';
import { useNotebookStore } from '@/lib/notebook/store';
import type { NotebookCell, CellState } from '@/lib/notebook/types';

interface CodeCellProps {
  notebookId: string;
  cell: NotebookCell;
  cellState: CellState;
  isActive: boolean;
  isSelected: boolean;
  onExecute: () => void;
  showLineNumbers?: boolean;
}

export const CodeCell = memo(function CodeCell({
  notebookId,
  cell,
  cellState,
  isActive,
  isSelected,
  onExecute,
  showLineNumbers = true,
}: CodeCellProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  const {
    updateCellSource,
    updateCellType,
    deleteCell,
    duplicateCell,
    moveCell,
    clearCellOutputs,
    setActiveCell,
    toggleCellOutput,
    setCellCollapsed,
  } = useNotebookStore();

  const handleEditorMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;

      editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
        onExecute();
      });

      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        onExecute();
      });

      editor.onDidFocusEditorText(() => {
        setIsFocused(true);
        setActiveCell(notebookId, cell.id);
      });

      editor.onDidBlurEditorText(() => {
        setIsFocused(false);
      });
    },
    [onExecute, notebookId, cell.id, setActiveCell]
  );

  const handleSourceChange = useCallback(
    (value: string | undefined) => {
      if (value !== undefined) {
        updateCellSource(notebookId, cell.id, value);
      }
    },
    [notebookId, cell.id, updateCellSource]
  );

  const handleClick = useCallback(() => {
    setActiveCell(notebookId, cell.id);
  }, [notebookId, cell.id, setActiveCell]);

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

  const handleClearOutput = useCallback(() => {
    clearCellOutputs(notebookId, cell.id);
  }, [notebookId, cell.id, clearCellOutputs]);

  const handleConvertToMarkdown = useCallback(() => {
    updateCellType(notebookId, cell.id, 'markdown');
  }, [notebookId, cell.id, updateCellType]);

  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(cell.source);
  }, [cell.source]);

  const handleToggleOutput = useCallback(() => {
    toggleCellOutput(notebookId, cell.id);
  }, [notebookId, cell.id, toggleCellOutput]);

  const handleToggleCollapse = useCallback(() => {
    setCellCollapsed(notebookId, cell.id, !cellState.isCollapsed);
  }, [notebookId, cell.id, cellState.isCollapsed, setCellCollapsed]);

  useEffect(() => {
    if (isActive && editorRef.current && !isFocused) {
      editorRef.current.focus();
    }
  }, [isActive, isFocused]);

  const lineCount = cell.source.split('\n').length;
  const editorHeight = Math.max(60, Math.min(400, lineCount * 19 + 20));

  const hasOutput = cell.outputs && cell.outputs.length > 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      className={`
        group relative border rounded-lg overflow-hidden transition-all
        ${isActive ? 'border-primary ring-1 ring-primary/50' : 'border-border'}
        ${isSelected ? 'bg-primary/5' : 'bg-card'}
        ${cellState.isExecuting ? 'border-yellow-500' : ''}
      `}
    >
      <div className="flex items-center justify-between px-2 py-1 bg-muted/50 border-b border-border/50">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground w-12">
            [{cell.execution_count ?? ' '}]
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={onExecute}
            disabled={cellState.isExecuting}
          >
            {cellState.isExecuting ? (
              <Square className="h-3 w-3 text-yellow-500 fill-yellow-500" />
            ) : (
              <Play className="h-3 w-3" />
            )}
          </Button>
          {cellState.isExecuting && (
            <span className="text-xs text-yellow-500 animate-pulse">Running...</span>
          )}
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={handleCopyCode}>
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
              <DropdownMenuItem onClick={handleConvertToMarkdown}>
                <FileText className="h-4 w-4 mr-2" />
                Convert to Markdown
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleClearOutput}>Clear Output</DropdownMenuItem>
              {hasOutput && (
                <DropdownMenuItem onClick={handleToggleOutput}>
                  {cellState.showOutput ? 'Hide' : 'Show'} Output
                </DropdownMenuItem>
              )}
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
        </div>
      </div>

      {!cellState.isCollapsed && (
        <>
          <div className="relative" style={{ height: editorHeight }}>
            <Editor
              height="100%"
              language="python"
              theme="vs-dark"
              value={cell.source}
              onChange={handleSourceChange}
              onMount={handleEditorMount}
              options={{
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: showLineNumbers ? 'on' : 'off',
                glyphMargin: false,
                folding: false,
                lineDecorationsWidth: 0,
                lineNumbersMinChars: 3,
                renderLineHighlight: 'none',
                scrollbar: {
                  vertical: 'hidden',
                  horizontal: 'auto',
                  useShadows: false,
                },
                overviewRulerLanes: 0,
                hideCursorInOverviewRuler: true,
                overviewRulerBorder: false,
                fontSize: 13,
                fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
                padding: { top: 8, bottom: 8 },
                tabSize: 4,
                wordWrap: 'on',
                automaticLayout: true,
              }}
            />
          </div>

          {hasOutput && cellState.showOutput && (
            <CellOutput outputs={cell.outputs!} executionCount={cell.execution_count} />
          )}
        </>
      )}

      {cellState.isCollapsed && (
        <div
          role="button"
          tabIndex={0}
          className="px-4 py-2 text-muted-foreground text-sm cursor-pointer hover:bg-muted/30"
          onClick={handleToggleCollapse}
          onKeyDown={(e) => e.key === 'Enter' && handleToggleCollapse()}
        >
          <Code className="h-4 w-4 inline mr-2" />
          {cell.source.split('\n')[0].substring(0, 50)}
          {cell.source.length > 50 && '...'}
        </div>
      )}
    </div>
  );
});
