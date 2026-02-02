import { useState, useEffect, useCallback, useMemo } from "react";

interface CodeEditorProps {
  sessionId: string;
  filePath: string | null;
  onClose: () => void;
}

interface OpenFile {
  path: string;
  name: string;
  content: string;
  language: string;
}

function getLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const langMap: Record<string, string> = {
    py: "python",
    js: "javascript",
    ts: "typescript",
    tsx: "typescript",
    jsx: "javascript",
    html: "html",
    css: "css",
    json: "json",
    md: "markdown",
    sh: "bash",
    bash: "bash",
    yml: "yaml",
    yaml: "yaml",
    sql: "sql",
    rs: "rust",
    go: "go",
    rb: "ruby",
    php: "php",
    java: "java",
    cpp: "cpp",
    c: "c",
    h: "c",
  };
  return langMap[ext] || "text";
}

function getFileIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  const icons: Record<string, string> = {
    py: "🐍",
    js: "📜",
    ts: "📘",
    tsx: "⚛️",
    jsx: "⚛️",
    html: "🌐",
    css: "🎨",
    json: "📋",
    md: "📝",
    sh: "⚡",
  };
  return icons[ext || ""] || "📄";
}

function highlightCode(code: string, language: string): string {
  const keywords: Record<string, string[]> = {
    python: [
      "def",
      "class",
      "import",
      "from",
      "return",
      "if",
      "else",
      "elif",
      "for",
      "while",
      "try",
      "except",
      "finally",
      "with",
      "as",
      "lambda",
      "yield",
      "raise",
      "pass",
      "break",
      "continue",
      "and",
      "or",
      "not",
      "in",
      "is",
      "None",
      "True",
      "False",
      "async",
      "await",
    ],
    javascript: [
      "function",
      "const",
      "let",
      "var",
      "return",
      "if",
      "else",
      "for",
      "while",
      "try",
      "catch",
      "finally",
      "throw",
      "new",
      "class",
      "extends",
      "import",
      "export",
      "from",
      "default",
      "async",
      "await",
      "yield",
      "null",
      "undefined",
      "true",
      "false",
      "this",
      "super",
    ],
    typescript: [
      "function",
      "const",
      "let",
      "var",
      "return",
      "if",
      "else",
      "for",
      "while",
      "try",
      "catch",
      "finally",
      "throw",
      "new",
      "class",
      "extends",
      "import",
      "export",
      "from",
      "default",
      "async",
      "await",
      "yield",
      "null",
      "undefined",
      "true",
      "false",
      "this",
      "super",
      "interface",
      "type",
      "enum",
      "implements",
      "private",
      "public",
      "protected",
      "readonly",
    ],
  };

  const langKeywords = keywords[language] || keywords["javascript"] || [];

  let result = code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  result = result.replace(
    /(["'`])(?:(?!\1)[^\\]|\\.)*\1/g,
    '<span class="text-green-400">$&</span>'
  );

  result = result.replace(
    /(\/\/.*$|#.*$)/gm,
    '<span class="text-zinc-500 italic">$&</span>'
  );

  result = result.replace(
    /\b(\d+\.?\d*)\b/g,
    '<span class="text-amber-400">$1</span>'
  );

  if (langKeywords.length > 0) {
    const keywordRegex = new RegExp(`\\b(${langKeywords.join("|")})\\b`, "g");
    result = result.replace(
      keywordRegex,
      '<span class="text-purple-400 font-medium">$1</span>'
    );
  }

  return result;
}

export function CodeEditor({ sessionId, filePath, onClose }: CodeEditorProps) {
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFile = useCallback(
    async (path: string) => {
      const existing = openFiles.find(f => f.path === path);
      if (existing) {
        setActiveFile(path);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/sessions/${sessionId}/files/download?path=${encodeURIComponent(path)}`
        );
        if (!res.ok) throw new Error("Failed to load file");

        const content = await res.text();
        const name = path.split("/").pop() || path;
        const language = getLanguage(name);

        const newFile: OpenFile = { path, name, content, language };
        setOpenFiles(prev => [...prev, newFile]);
        setActiveFile(path);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load file");
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId, openFiles]
  );

  useEffect(() => {
    if (filePath) {
      loadFile(filePath);
    }
  }, [filePath, loadFile]);

  const closeFile = useCallback(
    (path: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setOpenFiles(prev => {
        const filtered = prev.filter(f => f.path !== path);
        if (activeFile === path) {
          setActiveFile(
            filtered.length > 0 ? filtered[filtered.length - 1].path : null
          );
        }
        return filtered;
      });
    },
    [activeFile]
  );

  const currentFile = useMemo(
    () => openFiles.find(f => f.path === activeFile),
    [openFiles, activeFile]
  );

  const copyContent = useCallback(() => {
    if (currentFile) {
      navigator.clipboard.writeText(currentFile.content);
    }
  }, [currentFile]);

  const lines = useMemo(() => {
    if (!currentFile) return [];
    return currentFile.content.split("\n");
  }, [currentFile]);

  if (openFiles.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col h-full bg-zinc-900 rounded-lg border border-zinc-700/50 overflow-hidden">
        <div className="px-3 py-2 border-b border-zinc-700/50 flex items-center justify-between bg-zinc-800/50">
          <div className="flex items-center gap-2">
            <span className="text-sm">📝</span>
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Code Editor
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50 rounded transition-colors"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-600">
          <span className="text-3xl mb-3">📂</span>
          <p className="text-sm">No file open</p>
          <p className="text-xs text-zinc-700 mt-1">
            Select a file from the file browser
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-zinc-900 rounded-lg border border-zinc-700/50 overflow-hidden font-mono">
      <div className="flex items-center bg-zinc-800/80 border-b border-zinc-700/50">
        <div className="flex-1 flex items-center overflow-x-auto scrollbar-thin">
          {openFiles.map(file => (
            <div
              key={file.path}
              onClick={() => setActiveFile(file.path)}
              className={`flex items-center gap-2 px-3 py-2 cursor-pointer border-r border-zinc-700/30 transition-colors group shrink-0
                ${file.path === activeFile ? "bg-zinc-900 text-white" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"}`}
            >
              <span className="text-xs">{getFileIcon(file.name)}</span>
              <span className="text-xs truncate max-w-32">{file.name}</span>
              <button
                onClick={e => closeFile(file.path, e)}
                className="ml-1 p-0.5 text-zinc-500 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-all"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1 px-2 shrink-0">
          <button
            onClick={copyContent}
            className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50 rounded transition-colors"
            title="Copy content"
          >
            📋
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50 rounded transition-colors"
            title="Close editor"
          >
            ✕
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-zinc-700 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="flex-1 flex flex-col items-center justify-center text-red-400">
          <span className="text-2xl mb-2">⚠️</span>
          <p className="text-sm">{error}</p>
        </div>
      ) : currentFile ? (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <tbody>
              {lines.map((line, i) => (
                <tr key={i} className="hover:bg-zinc-800/30">
                  <td className="px-3 py-0.5 text-right text-zinc-600 select-none border-r border-zinc-800 sticky left-0 bg-zinc-900 w-12">
                    {i + 1}
                  </td>
                  <td className="px-4 py-0.5 whitespace-pre text-zinc-300">
                    <span
                      dangerouslySetInnerHTML={{
                        __html:
                          highlightCode(line, currentFile.language) || "&nbsp;",
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {currentFile && (
        <div className="px-3 py-1.5 border-t border-zinc-700/50 bg-zinc-800/50 flex items-center justify-between text-[10px] text-zinc-500">
          <span>{currentFile.language.toUpperCase()}</span>
          <span>{lines.length} lines</span>
        </div>
      )}
    </div>
  );
}
