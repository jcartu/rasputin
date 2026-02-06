'use client';

import { useRef, useEffect } from 'react';
import { DiffEditor, Monaco, DiffOnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { useUIStore } from '@/lib/store';
import { useDiffViewerStore } from '@/lib/diff-viewer';
import type { FileDiff } from '@/lib/diff-viewer';

interface MonacoDiffEditorProps {
  file: FileDiff;
  oldContent: string;
  newContent: string;
  height?: string | number;
  onLineClick?: (lineNumber: number, side: 'old' | 'new') => void;
}

export function MonacoDiffEditor({
  file,
  oldContent,
  newContent,
  height = '100%',
  onLineClick,
}: MonacoDiffEditorProps) {
  const { theme } = useUIStore();
  const { config } = useDiffViewerStore();
  const monacoRef = useRef<Monaco | null>(null);
  const editorRef = useRef<editor.IStandaloneDiffEditor | null>(null);

  const handleEditorMount: DiffOnMount = (diffEditor, monaco) => {
    monacoRef.current = monaco;
    editorRef.current = diffEditor;

    monaco.editor.defineTheme('alfie-diff-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6B7280', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'C084FC' },
        { token: 'string', foreground: '34D399' },
        { token: 'number', foreground: 'FB923C' },
        { token: 'type', foreground: '22D3EE' },
        { token: 'function', foreground: '60A5FA' },
        { token: 'variable', foreground: 'F9FAFB' },
      ],
      colors: {
        'editor.background': '#0A0B0F',
        'editor.foreground': '#F9FAFB',
        'editor.lineHighlightBackground': '#1F2937',
        'editor.selectionBackground': '#7C3AED40',
        'editor.inactiveSelectionBackground': '#7C3AED20',
        'editorLineNumber.foreground': '#4B5563',
        'editorLineNumber.activeForeground': '#9CA3AF',
        'editorCursor.foreground': '#7C3AED',
        'diffEditor.insertedTextBackground': '#22C55E15',
        'diffEditor.insertedLineBackground': '#22C55E10',
        'diffEditor.removedTextBackground': '#EF444415',
        'diffEditor.removedLineBackground': '#EF444410',
        'diffEditor.diagonalFill': '#1F2937',
        'diffEditorGutter.insertedLineBackground': '#22C55E30',
        'diffEditorGutter.removedLineBackground': '#EF444430',
        'diffEditorOverview.insertedForeground': '#22C55E',
        'diffEditorOverview.removedForeground': '#EF4444',
      },
    });

    monaco.editor.defineTheme('alfie-diff-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6B7280', fontStyle: 'italic' },
        { token: 'keyword', foreground: '7C3AED' },
        { token: 'string', foreground: '059669' },
        { token: 'number', foreground: 'EA580C' },
        { token: 'type', foreground: '0891B2' },
        { token: 'function', foreground: '2563EB' },
      ],
      colors: {
        'editor.background': '#FFFFFF',
        'editor.foreground': '#1F2937',
        'editor.lineHighlightBackground': '#F3F4F6',
        'editor.selectionBackground': '#7C3AED30',
        'editorLineNumber.foreground': '#9CA3AF',
        'editorCursor.foreground': '#7C3AED',
        'diffEditor.insertedTextBackground': '#22C55E20',
        'diffEditor.insertedLineBackground': '#22C55E10',
        'diffEditor.removedTextBackground': '#EF444420',
        'diffEditor.removedLineBackground': '#EF444410',
        'diffEditor.diagonalFill': '#F3F4F6',
        'diffEditorGutter.insertedLineBackground': '#22C55E30',
        'diffEditorGutter.removedLineBackground': '#EF444430',
      },
    });

    diffEditor.getOriginalEditor().onMouseDown((e: editor.IEditorMouseEvent) => {
      if (e.target.position && onLineClick) {
        onLineClick(e.target.position.lineNumber, 'old');
      }
    });

    diffEditor.getModifiedEditor().onMouseDown((e: editor.IEditorMouseEvent) => {
      if (e.target.position && onLineClick) {
        onLineClick(e.target.position.lineNumber, 'new');
      }
    });
  };

  useEffect(() => {
    if (monacoRef.current) {
      monacoRef.current.editor.setTheme(theme === 'dark' ? 'alfie-diff-dark' : 'alfie-diff-light');
    }
  }, [theme]);

  const editorOptions = {
    readOnly: true,
    fontSize: 12,
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    fontLigatures: true,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    renderLineHighlight: 'all' as const,
    lineNumbers: config.showLineNumbers ? ('on' as const) : ('off' as const),
    glyphMargin: true,
    folding: true,
    lineDecorationsWidth: 8,
    automaticLayout: true,
    wordWrap: config.wordWrap ? ('on' as const) : ('off' as const),
    renderWhitespace: config.showWhitespace ? ('all' as const) : ('none' as const),
    scrollbar: {
      vertical: 'auto' as const,
      horizontal: 'auto' as const,
      verticalScrollbarSize: 8,
      horizontalScrollbarSize: 8,
    },
  };

  return (
    <div className="h-full">
      <DiffEditor
        height={height}
        language={file.language || 'plaintext'}
        original={oldContent}
        modified={newContent}
        onMount={handleEditorMount}
        theme={theme === 'dark' ? 'alfie-diff-dark' : 'alfie-diff-light'}
        options={{
          ...editorOptions,
          renderSideBySide: config.viewMode === 'split',
          enableSplitViewResizing: true,
          renderOverviewRuler: true,
          ignoreTrimWhitespace: false,
          diffWordWrap: config.wordWrap ? 'on' : 'off',
        }}
        loading={
          <div className="flex items-center justify-center h-full bg-background">
            <div className="animate-pulse text-muted-foreground">Loading diff...</div>
          </div>
        }
      />
    </div>
  );
}
