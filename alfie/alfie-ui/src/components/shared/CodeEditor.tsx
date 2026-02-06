'use client';

import { useRef, useEffect } from 'react';
import Editor, { Monaco, OnMount } from '@monaco-editor/react';
import { useUIStore } from '@/lib/store';

interface CodeEditorProps {
  value: string;
  language?: string;
  onChange?: (value: string | undefined) => void;
  readOnly?: boolean;
  height?: string | number;
  className?: string;
}

export function CodeEditor({
  value,
  language = 'typescript',
  onChange,
  readOnly = false,
  height = '400px',
  className,
}: CodeEditorProps) {
  const { theme } = useUIStore();
  const monacoRef = useRef<Monaco | null>(null);

  const handleEditorMount: OnMount = (editor, monaco) => {
    monacoRef.current = monaco;
    
    monaco.editor.defineTheme('alfie-dark', {
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
        'editor.selectionHighlightBackground': '#7C3AED20',
        'editorBracketMatch.background': '#7C3AED30',
        'editorBracketMatch.border': '#7C3AED',
      },
    });

    monaco.editor.defineTheme('alfie-light', {
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
      },
    });

    editor.updateOptions({
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontLigatures: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      renderLineHighlight: 'all',
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      smoothScrolling: true,
      padding: { top: 16, bottom: 16 },
      lineNumbers: 'on',
      glyphMargin: false,
      folding: true,
      lineDecorationsWidth: 8,
      automaticLayout: true,
    });
  };

  useEffect(() => {
    if (monacoRef.current) {
      monacoRef.current.editor.setTheme(theme === 'dark' ? 'alfie-dark' : 'alfie-light');
    }
  }, [theme]);

  return (
    <div className={className}>
      <Editor
        height={height}
        language={language}
        value={value}
        onChange={onChange}
        onMount={handleEditorMount}
        theme={theme === 'dark' ? 'alfie-dark' : 'alfie-light'}
        options={{
          readOnly,
        }}
        loading={
          <div className="flex items-center justify-center h-full bg-background">
            <div className="animate-pulse text-muted-foreground">Loading editor...</div>
          </div>
        }
      />
    </div>
  );
}

interface CodeBlockProps {
  code: string;
  language?: string;
}

export function CodeBlock({ code, language = 'typescript' }: CodeBlockProps) {
  return (
    <div className="rounded-xl overflow-hidden border border-border">
      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border">
        <span className="text-xs text-muted-foreground font-medium uppercase">{language}</span>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => navigator.clipboard.writeText(code)}
        >
          Copy
        </button>
      </div>
      <CodeEditor
        value={code}
        language={language}
        readOnly
        height={Math.min(code.split('\n').length * 20 + 32, 400)}
      />
    </div>
  );
}
