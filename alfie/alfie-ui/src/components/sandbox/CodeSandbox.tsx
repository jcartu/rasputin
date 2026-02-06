'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Editor, { Monaco, OnMount } from '@monaco-editor/react';
import { useUIStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Play, 
  Square, 
  Terminal, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Loader2,
  ChevronDown,
  Settings2,
  Trash2,
  Copy,
  Download,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Language {
  id: string;
  name: string;
  extension: string;
  monacoId: string;
}

const LANGUAGES: Language[] = [
  { id: 'python', name: 'Python', extension: '.py', monacoId: 'python' },
  { id: 'javascript', name: 'JavaScript', extension: '.js', monacoId: 'javascript' },
  { id: 'typescript', name: 'TypeScript', extension: '.ts', monacoId: 'typescript' },
  { id: 'bash', name: 'Bash', extension: '.sh', monacoId: 'shell' },
];

const DEFAULT_CODE: Record<string, string> = {
  python: `# Python 3.11 - Secure Sandbox
# Try: input() for stdin, print() for stdout

def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

for i in range(10):
    print(f"fib({i}) = {fibonacci(i)}")
`,
  javascript: `// Node.js 20 - Secure Sandbox
// Use console.log() for output

function quickSort(arr) {
  if (arr.length <= 1) return arr;
  
  const pivot = arr[Math.floor(arr.length / 2)];
  const left = arr.filter(x => x < pivot);
  const middle = arr.filter(x => x === pivot);
  const right = arr.filter(x => x > pivot);
  
  return [...quickSort(left), ...middle, ...quickSort(right)];
}

const numbers = [64, 34, 25, 12, 22, 11, 90];
console.log("Original:", numbers);
console.log("Sorted:", quickSort(numbers));
`,
  typescript: `// TypeScript with Node.js
// Full type safety in the sandbox

interface User {
  name: string;
  age: number;
}

const greet = (user: User): string => {
  return \`Hello, \${user.name}! You are \${user.age} years old.\`;
};

const user: User = { name: "World", age: 42 };
console.log(greet(user));
`,
  bash: `#!/bin/bash
# Bash Shell - Secure Sandbox

echo "System Information:"
echo "==================="
echo "Shell: $SHELL"
echo "User: $(whoami)"
echo "Current directory: $(pwd)"
echo ""

# Simple loop
for i in {1..5}; do
  echo "Iteration $i"
done
`,
};

interface ExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;
  timedOut: boolean;
  memoryUsed: number | null;
}

interface CodeSandboxProps {
  initialCode?: string;
  initialLanguage?: string;
  onCodeChange?: (code: string) => void;
  className?: string;
  height?: string | number;
  showStdin?: boolean;
}

export function CodeSandbox({
  initialCode,
  initialLanguage = 'python',
  onCodeChange,
  className,
  height = 500,
  showStdin = true,
}: CodeSandboxProps) {
  const { theme } = useUIStore();
  const monacoRef = useRef<Monaco | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const [language, setLanguage] = useState<Language>(
    LANGUAGES.find(l => l.id === initialLanguage) || LANGUAGES[0]
  );
  const [code, setCode] = useState(initialCode || DEFAULT_CODE[language.id] || '');
  const [stdin, setStdin] = useState('');
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'output' | 'stdin'>('output');
  const [timeout, setTimeout] = useState(30000);
  const [memoryLimit, setMemoryLimit] = useState(256);

  useEffect(() => {
    if (!initialCode) {
      setCode(DEFAULT_CODE[language.id] || '');
    }
  }, [language.id, initialCode]);

  const handleEditorMount: OnMount = (editor, monaco) => {
    monacoRef.current = monaco;
    
    monaco.editor.defineTheme('sandbox-dark', {
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
        'editor.background': '#0D1117',
        'editor.foreground': '#E6EDF3',
        'editor.lineHighlightBackground': '#161B22',
        'editor.selectionBackground': '#388BFD40',
        'editorLineNumber.foreground': '#484F58',
        'editorLineNumber.activeForeground': '#7D8590',
        'editorCursor.foreground': '#58A6FF',
        'editorBracketMatch.background': '#388BFD30',
        'editorBracketMatch.border': '#388BFD',
      },
    });

    monaco.editor.defineTheme('sandbox-light', {
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
        'editor.lineHighlightBackground': '#F6F8FA',
        'editor.selectionBackground': '#0969DA20',
        'editorLineNumber.foreground': '#8C959F',
        'editorCursor.foreground': '#0969DA',
      },
    });

    editor.updateOptions({
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
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
      tabSize: 2,
      wordWrap: 'on',
    });

    editor.addAction({
      id: 'run-code',
      label: 'Run Code',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => executeCode(),
    });
  };

  const executeCode = useCallback(async () => {
    if (isRunning) return;
    
    setIsRunning(true);
    setResult(null);
    
    abortControllerRef.current = new AbortController();
    
    try {
      const response = await fetch(`${API_BASE}/api/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          language: language.id,
          stdin: stdin || undefined,
          timeout,
          memoryMB: memoryLimit,
        }),
        signal: abortControllerRef.current.signal,
      });
      
      const data = await response.json();
      setResult(data);
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        setResult({
          success: false,
          stdout: '',
          stderr: 'Execution cancelled',
          exitCode: -1,
          executionTime: 0,
          timedOut: false,
          memoryUsed: null,
        });
      } else {
        setResult({
          success: false,
          stdout: '',
          stderr: `Error: ${(error as Error).message}`,
          exitCode: 1,
          executionTime: 0,
          timedOut: false,
          memoryUsed: null,
        });
      }
    } finally {
      setIsRunning(false);
      abortControllerRef.current = null;
    }
  }, [code, language.id, stdin, timeout, memoryLimit, isRunning]);

  const stopExecution = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const handleCodeChange = useCallback((value: string | undefined) => {
    const newCode = value || '';
    setCode(newCode);
    onCodeChange?.(newCode);
  }, [onCodeChange]);

  const handleLanguageChange = useCallback((lang: Language) => {
    setLanguage(lang);
    if (!initialCode) {
      setCode(DEFAULT_CODE[lang.id] || '');
    }
    setResult(null);
  }, [initialCode]);

  const clearOutput = useCallback(() => {
    setResult(null);
  }, []);

  const copyOutput = useCallback(() => {
    if (result) {
      const output = result.stdout || result.stderr;
      navigator.clipboard.writeText(output);
    }
  }, [result]);

  const downloadCode = useCallback(() => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `code${language.extension}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [code, language.extension]);

  const editorHeight = typeof height === 'number' ? height - 200 : `calc(${height} - 200px)`;

  return (
    <div className={cn("flex flex-col border rounded-xl overflow-hidden bg-background", className)}>
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                {language.name}
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Select Language</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {LANGUAGES.map((lang) => (
                <DropdownMenuItem
                  key={lang.id}
                  onClick={() => handleLanguageChange(lang)}
                  className={cn(lang.id === language.id && "bg-accent")}
                >
                  {lang.name}
                  <span className="ml-auto text-xs text-muted-foreground">{lang.extension}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <Settings2 className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Execution Settings</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5">
                <label htmlFor="sandbox-timeout" className="text-xs text-muted-foreground">Timeout (seconds)</label>
                <select
                  id="sandbox-timeout"
                  value={timeout}
                  onChange={(e) => setTimeout(Number(e.target.value))}
                  className="w-full mt-1 text-sm bg-background border rounded px-2 py-1"
                >
                  <option value={5000}>5s</option>
                  <option value={10000}>10s</option>
                  <option value={30000}>30s</option>
                  <option value={60000}>60s</option>
                </select>
              </div>
              <div className="px-2 py-1.5">
                <label htmlFor="sandbox-memory" className="text-xs text-muted-foreground">Memory Limit (MB)</label>
                <select
                  id="sandbox-memory"
                  value={memoryLimit}
                  onChange={(e) => setMemoryLimit(Number(e.target.value))}
                  className="w-full mt-1 text-sm bg-background border rounded px-2 py-1"
                >
                  <option value={64}>64 MB</option>
                  <option value={128}>128 MB</option>
                  <option value={256}>256 MB</option>
                  <option value={512}>512 MB</option>
                </select>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={downloadCode}
            title="Download code"
          >
            <Download className="w-4 h-4" />
          </Button>
          
          {isRunning ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={stopExecution}
              className="gap-2"
            >
              <Square className="w-4 h-4" />
              Stop
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={executeCode}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              <Play className="w-4 h-4" />
              Run
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0" style={{ height: editorHeight }}>
        <Editor
          height="100%"
          language={language.monacoId}
          value={code}
          onChange={handleCodeChange}
          onMount={handleEditorMount}
          theme={theme === 'dark' ? 'sandbox-dark' : 'sandbox-light'}
          loading={
            <div className="flex items-center justify-center h-full bg-background">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          }
        />
      </div>

      <div className="border-t">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'output' | 'stdin')}>
          <div className="flex items-center justify-between px-2 border-b bg-muted/20">
            <TabsList className="h-9 bg-transparent">
              <TabsTrigger value="output" className="gap-2 text-xs">
                <Terminal className="w-3.5 h-3.5" />
                Output
                {result && (
                  <span className={cn(
                    "w-2 h-2 rounded-full",
                    result.success ? "bg-green-500" : "bg-red-500"
                  )} />
                )}
              </TabsTrigger>
              {showStdin && (
                <TabsTrigger value="stdin" className="gap-2 text-xs">
                  Input (stdin)
                </TabsTrigger>
              )}
            </TabsList>

            <div className="flex items-center gap-2 pr-2">
              {result && (
                <>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {result.executionTime}ms
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyOutput}
                    className="h-6 w-6 p-0"
                    title="Copy output"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearOutput}
                    className="h-6 w-6 p-0"
                    title="Clear output"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </>
              )}
            </div>
          </div>

          <TabsContent value="output" className="m-0">
            <div className="h-[150px] overflow-auto bg-[#0D1117] dark:bg-[#0D1117] p-4 font-mono text-sm">
              {isRunning ? (
                <div className="flex items-center gap-2 text-blue-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Running...
                </div>
              ) : result ? (
                <div className="space-y-2">
                  {result.timedOut && (
                    <div className="flex items-center gap-2 text-yellow-400">
                      <AlertCircle className="w-4 h-4" />
                      Execution timed out after {timeout / 1000}s
                    </div>
                  )}
                  
                  {result.stdout && (
                    <pre className="text-green-400 whitespace-pre-wrap">{result.stdout}</pre>
                  )}
                  
                  {result.stderr && (
                    <pre className="text-red-400 whitespace-pre-wrap">{result.stderr}</pre>
                  )}
                  
                  {!result.stdout && !result.stderr && !result.timedOut && (
                    <span className="text-gray-500">(No output)</span>
                  )}
                  
                  <div className="pt-2 border-t border-gray-800 flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      {result.success ? (
                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                      ) : (
                        <AlertCircle className="w-3 h-3 text-red-500" />
                      )}
                      Exit code: {result.exitCode}
                    </span>
                    <span>Time: {result.executionTime}ms</span>
                    {result.memoryUsed && (
                      <span>Memory: {(result.memoryUsed / 1024 / 1024).toFixed(1)} MB</span>
                    )}
                  </div>
                </div>
              ) : (
                <span className="text-gray-500">
                  Press <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-xs">Ctrl+Enter</kbd> or click Run to execute code
                </span>
              )}
            </div>
          </TabsContent>

          {showStdin && (
            <TabsContent value="stdin" className="m-0">
              <textarea
                value={stdin}
                onChange={(e) => setStdin(e.target.value)}
                placeholder="Enter input for your program (stdin)..."
                className="w-full h-[150px] p-4 bg-[#0D1117] text-gray-300 font-mono text-sm resize-none focus:outline-none"
              />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}

export default CodeSandbox;
