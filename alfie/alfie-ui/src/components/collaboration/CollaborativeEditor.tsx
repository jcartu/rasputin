'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import Editor, { Monaco, OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { useUIStore } from '@/lib/store';
import { 
  useCollaborationStore, 
  type CollaboratorInfo, 
  type CursorPosition,
  type SelectionRange,
  PermissionLevel 
} from '@/lib/collaboration';
import { UserPresenceBar } from './UserPresenceBar';
import { TypingIndicator } from './TypingIndicator';

interface CollaborativeEditorProps {
  documentId: string;
  initialValue?: string;
  language?: string;
  height?: string | number;
  className?: string;
  onSave?: (content: string) => void;
}

interface RemoteCursorDecoration {
  odId: string[];
  userId: string;
}

export function CollaborativeEditor({
  documentId,
  initialValue = '',
  language = 'typescript',
  height = '100%',
  className,
  onSave,
}: CollaborativeEditorProps) {
  const { theme } = useUIStore();
  const monacoRef = useRef<Monaco | null>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const decorationsRef = useRef<Map<string, RemoteCursorDecoration>>(new Map());
  const [isReady, setIsReady] = useState(false);
  
  const {
    isConnected,
    collaborators,
    localUser,
    permission,
    updateCursor,
    updateSelection,
    setTyping,
    typingUsers,
  } = useCollaborationStore();

  const canEdit = permission >= PermissionLevel.EDIT;

  const handleEditorMount: OnMount = useCallback((editor, monacoInstance) => {
    monacoRef.current = monacoInstance;
    editorRef.current = editor;

    monacoInstance.editor.defineTheme('collab-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6B7280', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'C084FC' },
        { token: 'string', foreground: '34D399' },
        { token: 'number', foreground: 'FB923C' },
        { token: 'type', foreground: '22D3EE' },
        { token: 'function', foreground: '60A5FA' },
      ],
      colors: {
        'editor.background': '#0A0B0F',
        'editor.foreground': '#F9FAFB',
        'editor.lineHighlightBackground': '#1F2937',
        'editor.selectionBackground': '#7C3AED40',
        'editorLineNumber.foreground': '#4B5563',
        'editorCursor.foreground': '#7C3AED',
      },
    });

    monacoInstance.editor.defineTheme('collab-light', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#FFFFFF',
        'editor.selectionBackground': '#7C3AED30',
      },
    });

    editor.updateOptions({
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontLigatures: true,
      minimap: { enabled: true },
      scrollBeyondLastLine: false,
      renderLineHighlight: 'all',
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      smoothScrolling: true,
      padding: { top: 16, bottom: 16 },
      readOnly: !canEdit,
    });

    editor.onDidChangeCursorPosition((e) => {
      const position: CursorPosition = {
        lineNumber: e.position.lineNumber,
        column: e.position.column,
      };
      updateCursor(position);
    });

    editor.onDidChangeCursorSelection((e) => {
      const sel = e.selection;
      if (sel.isEmpty()) {
        updateSelection(null);
      } else {
        const selection: SelectionRange = {
          startLineNumber: sel.startLineNumber,
          startColumn: sel.startColumn,
          endLineNumber: sel.endLineNumber,
          endColumn: sel.endColumn,
        };
        updateSelection(selection);
      }
    });

    let typingTimeout: NodeJS.Timeout;
    editor.onDidChangeModelContent(() => {
      setTyping(true);
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => setTyping(false), 2000);
    });

    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {
      if (onSave) {
        onSave(editor.getValue());
      }
    });

    setIsReady(true);
  }, [canEdit, updateCursor, updateSelection, setTyping, onSave]);

  useEffect(() => {
    if (!editorRef.current || !monacoRef.current || !isReady) return;

    const editor = editorRef.current;
    const monacoInstance = monacoRef.current;
    const model = editor.getModel();
    if (!model) return;

    const currentDecorations = new Map(decorationsRef.current);
    const activeUserIds = new Set(collaborators.map(c => c.id));

    currentDecorations.forEach((decoration, odId) => {
      if (!activeUserIds.has(decoration.userId)) {
        editor.deltaDecorations(decoration.odId, []);
        currentDecorations.delete(odId);
      }
    });

    collaborators.forEach((collaborator) => {
      if (collaborator.id === localUser?.id) return;
      
      const decorations: monaco.editor.IModelDeltaDecoration[] = [];

      if (collaborator.cursor) {
        decorations.push({
          range: new monacoInstance.Range(
            collaborator.cursor.lineNumber,
            collaborator.cursor.column,
            collaborator.cursor.lineNumber,
            collaborator.cursor.column
          ),
          options: {
            className: `remote-cursor-${collaborator.id}`,
            beforeContentClassName: `remote-cursor-line-${collaborator.id}`,
            stickiness: monacoInstance.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          },
        });
      }

      if (collaborator.selection) {
        decorations.push({
          range: new monacoInstance.Range(
            collaborator.selection.startLineNumber,
            collaborator.selection.startColumn,
            collaborator.selection.endLineNumber,
            collaborator.selection.endColumn
          ),
          options: {
            className: `remote-selection-${collaborator.id}`,
            stickiness: monacoInstance.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          },
        });
      }

      if (decorations.length > 0) {
        const existingDecoration = currentDecorations.get(collaborator.id);
        const newDecorationIds = editor.deltaDecorations(
          existingDecoration?.odId || [],
          decorations
        );
        currentDecorations.set(collaborator.id, {
          odId: newDecorationIds,
          userId: collaborator.id,
        });
      }
    });

    decorationsRef.current = currentDecorations;
  }, [collaborators, localUser, isReady]);

  useEffect(() => {
    if (!isReady) return;

    const styleSheet = document.createElement('style');
    styleSheet.id = 'remote-cursor-styles';
    
    const styles = collaborators
      .filter(c => c.id !== localUser?.id)
      .map(collaborator => `
        .remote-cursor-${collaborator.id} {
          background-color: ${collaborator.color};
          width: 2px !important;
          margin-left: -1px;
        }
        .remote-cursor-line-${collaborator.id}::before {
          content: '${collaborator.name}';
          position: absolute;
          top: -20px;
          left: 0;
          background-color: ${collaborator.color};
          color: white;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 11px;
          white-space: nowrap;
          pointer-events: none;
          z-index: 100;
        }
        .remote-selection-${collaborator.id} {
          background-color: ${collaborator.color}30;
        }
      `).join('\n');

    styleSheet.textContent = styles;
    
    const existingStyle = document.getElementById('remote-cursor-styles');
    if (existingStyle) {
      existingStyle.textContent = styles;
    } else {
      document.head.appendChild(styleSheet);
    }

    return () => {
      const style = document.getElementById('remote-cursor-styles');
      if (style) style.remove();
    };
  }, [collaborators, localUser, isReady]);

  useEffect(() => {
    if (monacoRef.current) {
      monacoRef.current.editor.setTheme(theme === 'dark' ? 'collab-dark' : 'collab-light');
    }
  }, [theme]);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({ readOnly: !canEdit });
    }
  }, [canEdit]);

  return (
    <div className={`flex flex-col h-full ${className || ''}`}>
      <UserPresenceBar collaborators={collaborators} localUser={localUser} />
      
      <div className="flex-1 relative">
        <Editor
          height={height}
          language={language}
          defaultValue={initialValue}
          onMount={handleEditorMount}
          theme={theme === 'dark' ? 'collab-dark' : 'collab-light'}
          loading={
            <div className="flex items-center justify-center h-full bg-background">
              <div className="animate-pulse text-muted-foreground">
                {isConnected ? 'Loading editor...' : 'Connecting...'}
              </div>
            </div>
          }
        />
        
        {!isConnected && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Connecting to collaboration server...</p>
            </div>
          </div>
        )}
        
        {!canEdit && isConnected && (
          <div className="absolute top-2 right-2 bg-amber-500/20 text-amber-500 px-3 py-1 rounded-full text-sm">
            View Only
          </div>
        )}
      </div>
      
      {typingUsers.length > 0 && (
        <TypingIndicator users={typingUsers} />
      )}
    </div>
  );
}

export default CollaborativeEditor;
