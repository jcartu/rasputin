'use client';

import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bold, 
  Italic, 
  Strikethrough, 
  Code, 
  Link2, 
  Image, 
  List, 
  ListOrdered,
  CheckSquare,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  Table,
  Minus,
  Eye,
  EyeOff,
  Columns,
  Maximize2,
  Minimize2,
  FileCode,
  HelpCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ScrollArea } from '@/components/ui/scroll-area';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  maxHeight?: string;
  showToolbar?: boolean;
  showPreview?: boolean;
  defaultView?: 'edit' | 'preview' | 'split';
}

interface ToolbarAction {
  icon: React.ElementType;
  label: string;
  shortcut?: string;
  action: (
    text: string,
    selectionStart: number,
    selectionEnd: number
  ) => { text: string; cursorPosition: number };
}

const toolbarActions: Record<string, ToolbarAction> = {
  bold: {
    icon: Bold,
    label: 'Bold',
    shortcut: 'Ctrl+B',
    action: (text, start, end) => {
      const selectedText = text.slice(start, end);
      const newText = text.slice(0, start) + `**${selectedText}**` + text.slice(end);
      return { text: newText, cursorPosition: selectedText ? end + 4 : start + 2 };
    },
  },
  italic: {
    icon: Italic,
    label: 'Italic',
    shortcut: 'Ctrl+I',
    action: (text, start, end) => {
      const selectedText = text.slice(start, end);
      const newText = text.slice(0, start) + `*${selectedText}*` + text.slice(end);
      return { text: newText, cursorPosition: selectedText ? end + 2 : start + 1 };
    },
  },
  strikethrough: {
    icon: Strikethrough,
    label: 'Strikethrough',
    action: (text, start, end) => {
      const selectedText = text.slice(start, end);
      const newText = text.slice(0, start) + `~~${selectedText}~~` + text.slice(end);
      return { text: newText, cursorPosition: selectedText ? end + 4 : start + 2 };
    },
  },
  code: {
    icon: Code,
    label: 'Inline Code',
    shortcut: 'Ctrl+`',
    action: (text, start, end) => {
      const selectedText = text.slice(start, end);
      const newText = text.slice(0, start) + `\`${selectedText}\`` + text.slice(end);
      return { text: newText, cursorPosition: selectedText ? end + 2 : start + 1 };
    },
  },
  codeBlock: {
    icon: FileCode,
    label: 'Code Block',
    action: (text, start, end) => {
      const selectedText = text.slice(start, end);
      const newText = text.slice(0, start) + `\`\`\`\n${selectedText}\n\`\`\`` + text.slice(end);
      return { text: newText, cursorPosition: start + 4 };
    },
  },
  link: {
    icon: Link2,
    label: 'Link',
    shortcut: 'Ctrl+K',
    action: (text, start, end) => {
      const selectedText = text.slice(start, end);
      const newText = text.slice(0, start) + `[${selectedText}](url)` + text.slice(end);
      return { text: newText, cursorPosition: selectedText ? end + 3 : start + 1 };
    },
  },
  image: {
    icon: Image,
    label: 'Image',
    action: (text, start, end) => {
      const selectedText = text.slice(start, end);
      const newText = text.slice(0, start) + `![${selectedText}](url)` + text.slice(end);
      return { text: newText, cursorPosition: selectedText ? end + 4 : start + 2 };
    },
  },
  h1: {
    icon: Heading1,
    label: 'Heading 1',
    action: (text, start) => {
      const lineStart = text.lastIndexOf('\n', start - 1) + 1;
      const newText = text.slice(0, lineStart) + '# ' + text.slice(lineStart);
      return { text: newText, cursorPosition: start + 2 };
    },
  },
  h2: {
    icon: Heading2,
    label: 'Heading 2',
    action: (text, start) => {
      const lineStart = text.lastIndexOf('\n', start - 1) + 1;
      const newText = text.slice(0, lineStart) + '## ' + text.slice(lineStart);
      return { text: newText, cursorPosition: start + 3 };
    },
  },
  h3: {
    icon: Heading3,
    label: 'Heading 3',
    action: (text, start) => {
      const lineStart = text.lastIndexOf('\n', start - 1) + 1;
      const newText = text.slice(0, lineStart) + '### ' + text.slice(lineStart);
      return { text: newText, cursorPosition: start + 4 };
    },
  },
  ul: {
    icon: List,
    label: 'Bullet List',
    action: (text, start) => {
      const lineStart = text.lastIndexOf('\n', start - 1) + 1;
      const newText = text.slice(0, lineStart) + '- ' + text.slice(lineStart);
      return { text: newText, cursorPosition: start + 2 };
    },
  },
  ol: {
    icon: ListOrdered,
    label: 'Numbered List',
    action: (text, start) => {
      const lineStart = text.lastIndexOf('\n', start - 1) + 1;
      const newText = text.slice(0, lineStart) + '1. ' + text.slice(lineStart);
      return { text: newText, cursorPosition: start + 3 };
    },
  },
  task: {
    icon: CheckSquare,
    label: 'Task List',
    action: (text, start) => {
      const lineStart = text.lastIndexOf('\n', start - 1) + 1;
      const newText = text.slice(0, lineStart) + '- [ ] ' + text.slice(lineStart);
      return { text: newText, cursorPosition: start + 6 };
    },
  },
  quote: {
    icon: Quote,
    label: 'Blockquote',
    action: (text, start) => {
      const lineStart = text.lastIndexOf('\n', start - 1) + 1;
      const newText = text.slice(0, lineStart) + '> ' + text.slice(lineStart);
      return { text: newText, cursorPosition: start + 2 };
    },
  },
  hr: {
    icon: Minus,
    label: 'Horizontal Rule',
    action: (text, start) => {
      const newText = text.slice(0, start) + '\n---\n' + text.slice(start);
      return { text: newText, cursorPosition: start + 5 };
    },
  },
  table: {
    icon: Table,
    label: 'Table',
    action: (text, start) => {
      const tableTemplate = '\n| Header 1 | Header 2 | Header 3 |\n|----------|----------|----------|\n| Cell 1   | Cell 2   | Cell 3   |\n';
      const newText = text.slice(0, start) + tableTemplate + text.slice(start);
      return { text: newText, cursorPosition: start + 3 };
    },
  },
};

const toolbarGroups = [
  ['bold', 'italic', 'strikethrough'],
  ['h1', 'h2', 'h3'],
  ['code', 'codeBlock'],
  ['link', 'image'],
  ['ul', 'ol', 'task'],
  ['quote', 'hr', 'table'],
];

export const MarkdownEditor = memo(function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Write your markdown here...',
  className,
  minHeight = '200px',
  maxHeight = '600px',
  showToolbar = true,
  showPreview = true,
  defaultView = 'split',
}: MarkdownEditorProps) {
  const [view, setView] = useState<'edit' | 'preview' | 'split'>(defaultView);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleToolbarAction = useCallback((actionKey: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const action = toolbarActions[actionKey];
    if (!action) return;

    const { selectionStart, selectionEnd } = textarea;
    const result = action.action(value, selectionStart, selectionEnd);
    
    onChange(result.text);
    
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(result.cursorPosition, result.cursorPosition);
    });
  }, [value, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          handleToolbarAction('bold');
          break;
        case 'i':
          e.preventDefault();
          handleToolbarAction('italic');
          break;
        case 'k':
          e.preventDefault();
          handleToolbarAction('link');
          break;
        case '`':
          e.preventDefault();
          handleToolbarAction('code');
          break;
      }
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.currentTarget;
      const { selectionStart, selectionEnd } = textarea;
      const newText = value.slice(0, selectionStart) + '  ' + value.slice(selectionEnd);
      onChange(newText);
      requestAnimationFrame(() => {
        textarea.setSelectionRange(selectionStart + 2, selectionStart + 2);
      });
    }
  }, [value, onChange, handleToolbarAction]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  const charCount = value.length;

  return (
    <TooltipProvider>
      <div 
        ref={containerRef}
        className={cn(
          "rounded-lg border border-border/50 bg-card overflow-hidden flex flex-col",
          isFullscreen && "fixed inset-0 z-50 rounded-none",
          className
        )}
        style={{ minHeight: isFullscreen ? '100vh' : minHeight, maxHeight: isFullscreen ? '100vh' : maxHeight }}
      >
        {showToolbar && (
          <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-border/50 bg-muted/30 flex-wrap">
            <div className="flex items-center gap-0.5 flex-wrap">
              {toolbarGroups.map((group) => (
                <div key={group.join('-')} className="flex items-center">
                  {toolbarGroups.indexOf(group) > 0 && (
                    <div className="w-px h-6 bg-border/50 mx-1" />
                  )}
                  {group.map((actionKey) => {
                    const action = toolbarActions[actionKey];
                    return (
                      <Tooltip key={actionKey}>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToolbarAction(actionKey)}
                            className="h-8 w-8 p-0"
                          >
                            <action.icon className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{action.label}{action.shortcut && ` (${action.shortcut})`}</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-1">
              {showPreview && (
                <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
                  <TabsList className="h-8 p-0.5">
                    <TabsTrigger value="edit" className="h-7 px-2 text-xs gap-1">
                      <EyeOff className="w-3 h-3" />
                      Edit
                    </TabsTrigger>
                    <TabsTrigger value="split" className="h-7 px-2 text-xs gap-1">
                      <Columns className="w-3 h-3" />
                      Split
                    </TabsTrigger>
                    <TabsTrigger value="preview" className="h-7 px-2 text-xs gap-1">
                      <Eye className="w-3 h-3" />
                      Preview
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={toggleFullscreen}
                    className="h-8 w-8 p-0"
                  >
                    {isFullscreen ? (
                      <Minimize2 className="w-4 h-4" />
                    ) : (
                      <Maximize2 className="w-4 h-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => window.open('https://www.markdownguide.org/cheat-sheet/', '_blank')}
                  >
                    <HelpCircle className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Markdown Help</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        )}

        <div className="flex-1 flex overflow-hidden">
          <AnimatePresence mode="sync">
            {(view === 'edit' || view === 'split') && (
              <motion.div
                key="editor"
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: view === 'split' ? '50%' : '100%' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  "flex flex-col",
                  view === 'split' && "border-r border-border/50"
                )}
              >
                <textarea
                  ref={textareaRef}
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={placeholder}
                  spellCheck={false}
                  className={cn(
                    "flex-1 w-full resize-none bg-transparent p-4",
                    "font-mono text-sm leading-relaxed",
                    "placeholder:text-muted-foreground/50",
                    "focus:outline-none"
                  )}
                />
              </motion.div>
            )}

            {(view === 'preview' || view === 'split') && (
              <motion.div
                key="preview"
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: view === 'split' ? '50%' : '100%' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="flex-1 overflow-hidden"
              >
                <ScrollArea className="h-full">
                  <div className="p-4">
                    {value ? (
                      <MarkdownRenderer content={value} />
                    ) : (
                      <p className="text-muted-foreground/50 italic">Nothing to preview</p>
                    )}
                  </div>
                </ScrollArea>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between px-3 py-1.5 border-t border-border/50 bg-muted/30 text-xs text-muted-foreground">
          <span>Markdown supported</span>
          <span>{wordCount} words, {charCount} characters</span>
        </div>
      </div>
    </TooltipProvider>
  );
});

export default MarkdownEditor;
