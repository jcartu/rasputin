'use client';

import {
  Children,
  isValidElement,
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkEmoji from 'remark-emoji';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Check, 
  Copy, 
  Download,
  Play,
  ChevronDown, 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  CheckCircle2,
  Lightbulb,
  Quote,
  ExternalLink,
  Presentation,
  Mail,
  Sparkles
} from 'lucide-react';
import type { Pluggable } from "unified";
import { cn } from '@/lib/utils';
import { useArtifactStore } from '@/lib/artifactStore';
import { useChatStore, useUIStore } from '@/lib/store';
import { useEmailStore, type EmailAddress } from "@/lib/emailStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InteractiveTable } from "@/components/shared/InteractiveTable";
import { DataChart } from "@/components/shared/DataChart";
import { EmailPreview } from "@/components/shared/EmailPreview";
import { InlineHtmlPreview } from "@/components/shared/InlineHtmlPreview";
import { InlineSvgPreview } from "@/components/shared/InlineSvgPreview";
import { BrowserFrame } from "@/components/shared/BrowserFrame";
import mermaid from 'mermaid';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github-dark.css';

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
  fontFamily: 'inherit',
  themeVariables: {
    primaryColor: 'hsl(262, 83%, 58%)',
    primaryTextColor: '#fff',
    primaryBorderColor: 'hsl(262, 83%, 48%)',
    lineColor: 'hsl(215, 20%, 55%)',
    secondaryColor: 'hsl(187, 92%, 45%)',
    tertiaryColor: 'hsl(224, 71%, 8%)',
  },
});

const SlideViewer = lazy(async () => {
  const module = await import("./SlideViewer");
  return { default: module.SlideViewer };
});

interface MarkdownRendererProps {
  content: string;
  className?: string;
  enableMermaid?: boolean;
  enableMath?: boolean;
  enableCopyButton?: boolean;
  enableSlideView?: boolean;
  enableEmailPreview?: boolean;
  enableEmailDrafts?: boolean;
  isStreaming?: boolean;
}

const CodeBlock = memo(function CodeBlock({ 
  className, 
  children, 
  enableCopyButton = true,
  ...props 
}: React.HTMLAttributes<HTMLElement> & { enableCopyButton?: boolean }) {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLElement>(null);
  const langMatch = className?.match(/language-(\S+)/);
  const language = langMatch ? langMatch[1] : (className?.replace(/\bhljs\b/g, '').trim() || '');
  const isInline = !className;
  const { activeSessionId } = useChatStore();
  const { addArtifact, artifacts, removeArtifact, selectArtifact } =
    useArtifactStore();
  const { setRightPanelOpen, setRightPanelTab } = useUIStore();
  const isPreviewable = ['html', 'css', 'javascript', 'js'].includes(
    language.toLowerCase()
  );

  const handleCopy = useCallback(async () => {
    if (codeRef.current) {
      const text = codeRef.current.textContent || '';
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, []);

  const handleDownload = useCallback(() => {
    if (codeRef.current) {
      const text = codeRef.current.textContent || '';
      const extMap: Record<string, string> = {
        python: '.py', javascript: '.js', typescript: '.ts', tsx: '.tsx', jsx: '.jsx',
        html: '.html', css: '.css', json: '.json', bash: '.sh', sh: '.sh', shell: '.sh',
        sql: '.sql', rust: '.rs', go: '.go', java: '.java', cpp: '.cpp', c: '.c',
        ruby: '.rb', php: '.php', yaml: '.yml', yml: '.yml', markdown: '.md', md: '.md',
        xml: '.xml', swift: '.swift', kotlin: '.kt', scala: '.scala', r: '.r',
        dockerfile: '.dockerfile', makefile: '.makefile', toml: '.toml', ini: '.ini',
      };
      const ext = extMap[language.toLowerCase()] || '.txt';
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `code-${language || 'snippet'}${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }, [language]);

  const handlePreview = useCallback(() => {
    if (!codeRef.current || !activeSessionId || !language) return;
    const text = codeRef.current.textContent || '';
    const normalizedLanguage = language.toLowerCase() === 'js'
      ? 'javascript'
      : language.toLowerCase();

    const existingPreview = artifacts.filter(
      (artifact) =>
        artifact.sessionId === activeSessionId &&
        artifact.messageId === 'preview'
    );

    existingPreview.forEach((artifact) => {
      removeArtifact(artifact.id);
    });

    const previewArtifact = {
      id: crypto.randomUUID(),
      title: 'Preview snippet',
      language: normalizedLanguage,
      content: text,
      type: 'code' as const,
      messageId: 'preview',
      sessionId: activeSessionId,
      createdAt: new Date(),
    };

    addArtifact(previewArtifact);
    selectArtifact(previewArtifact.id);
    const setRightPanelTabUnsafe = setRightPanelTab as (tab: string) => void;
    setRightPanelTabUnsafe("artifacts");
    setRightPanelOpen(true);
  }, [
    activeSessionId,
    addArtifact,
    artifacts,
    language,
    removeArtifact,
    selectArtifact,
    setRightPanelOpen,
    setRightPanelTab,
  ]);

  if (isInline) {
    return (
      <code 
        className="px-1.5 py-0.5 rounded-md bg-muted text-primary font-mono text-[0.9em] border border-border/50"
        {...props}
      >
        {children}
      </code>
    );
  }

  return (
    <div className="relative group my-4">
      {language && (
        <div className="absolute top-0 left-0 px-3 py-1 text-xs font-medium text-muted-foreground bg-muted/80 rounded-tl-lg rounded-br-lg border-r border-b border-border/50">
          {language}
        </div>
      )}
      {isPreviewable && enableCopyButton && (
        <motion.button
          type="button"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={handlePreview}
          className="absolute top-2 right-24 p-2 rounded-lg transition-all bg-primary/15 hover:bg-primary/25 border border-primary/30"
          aria-label="Preview code"
        >
          <Play className="w-4 h-4 text-primary" />
        </motion.button>
      )}
      {enableCopyButton && (
        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={handleDownload}
            className="p-2 rounded-lg transition-all bg-muted/80 hover:bg-muted border border-border/50"
            aria-label="Download code"
          >
            <Download className="w-4 h-4 text-muted-foreground" />
          </motion.button>
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={handleCopy}
            className="p-2 rounded-lg transition-all bg-muted/80 hover:bg-muted border border-border/50"
            aria-label="Copy code"
          >
            <AnimatePresence mode="wait">
              {copied ? (
                <motion.div
                  key="check"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                >
                  <Check className="w-4 h-4 text-emerald-500" />
                </motion.div>
              ) : (
                <motion.div
                  key="copy"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                >
                  <Copy className="w-4 h-4 text-muted-foreground" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      )}
      <pre className={cn(
        "overflow-x-auto rounded-lg border border-border/50 bg-[#0d1117]",
        "p-4 pt-8 text-sm leading-relaxed",
        className
      )}>
        <code ref={codeRef} className={className} {...props}>
          {children}
        </code>
      </pre>
    </div>
  );
});

const MermaidDiagram = memo(function MermaidDiagram({ chart }: { chart: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isStable, setIsStable] = useState(false);
  const lastChartRef = useRef<string>(chart);

  // Debounce render until chart prop stabilizes (prevents errors from partial streaming chunks)
  useEffect(() => {
    lastChartRef.current = chart;
    setIsStable(false);

    const timer = setTimeout(() => {
      if (lastChartRef.current === chart) {
        setIsStable(true);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [chart]);

  useEffect(() => {
    if (!isStable || !chart) return;

    const renderDiagram = async () => {
      try {
        const id = `mermaid-${crypto.randomUUID()}`;
        const { svg } = await mermaid.render(id, chart);
        setSvg(svg);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to render diagram');
      }
    };

    renderDiagram();
  }, [chart, isStable]);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = svg;
  }, [svg]);

  if (!isStable && !svg) {
    return (
      <div className="my-4 p-4 rounded-lg border border-border/50 bg-card/50 flex items-center justify-center gap-2 text-muted-foreground">
        <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        <span className="text-sm">Rendering diagram…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="my-4 p-4 rounded-lg border border-destructive/50 bg-destructive/5 text-destructive">
        <div className="flex items-center gap-2 font-medium">
          <AlertCircle className="w-4 h-4" />
          Mermaid Error
        </div>
        <pre className="mt-2 text-sm overflow-x-auto">{error}</pre>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="my-4 p-4 rounded-lg border border-border/50 bg-card/50 overflow-x-auto flex justify-center mermaid-diagram"
    />
  );
});

const containerStyles = {
  info: {
    icon: Info,
    className: 'border-blue-500/50 bg-blue-500/5 text-blue-600 dark:text-blue-400',
    iconClass: 'text-blue-500',
  },
  warning: {
    icon: AlertTriangle,
    className: 'border-amber-500/50 bg-amber-500/5 text-amber-600 dark:text-amber-400',
    iconClass: 'text-amber-500',
  },
  danger: {
    icon: AlertCircle,
    className: 'border-red-500/50 bg-red-500/5 text-red-600 dark:text-red-400',
    iconClass: 'text-red-500',
  },
  success: {
    icon: CheckCircle2,
    className: 'border-emerald-500/50 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400',
    iconClass: 'text-emerald-500',
  },
  tip: {
    icon: Lightbulb,
    className: 'border-purple-500/50 bg-purple-500/5 text-purple-600 dark:text-purple-400',
    iconClass: 'text-purple-500',
  },
  note: {
    icon: Quote,
    className: 'border-muted-foreground/30 bg-muted/30 text-muted-foreground',
    iconClass: 'text-muted-foreground',
  },
};

type ContainerType = keyof typeof containerStyles;

const CustomContainer = memo(function CustomContainer({ 
  type, 
  title, 
  children 
}: { 
  type: ContainerType; 
  title?: string; 
  children: React.ReactNode;
}) {
  const style = containerStyles[type] || containerStyles.note;
  const Icon = style.icon;

  return (
    <div className={cn(
      "my-4 rounded-lg border-l-4 p-4",
      style.className
    )}>
      {title && (
        <div className="flex items-center gap-2 font-semibold mb-2">
          <Icon className={cn("w-4 h-4", style.iconClass)} />
          {title}
        </div>
      )}
      <div className="prose-content">{children}</div>
    </div>
  );
});

const TaskListItem = memo(function TaskListItem({ 
  checked, 
  children 
}: { 
  checked: boolean; 
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 list-none -ml-6">
      <span className={cn(
        "flex items-center justify-center w-5 h-5 mt-0.5 rounded border-2 transition-colors",
        checked 
          ? "bg-primary border-primary text-primary-foreground" 
          : "border-muted-foreground/30 bg-background"
      )}>
        {checked && <Check className="w-3 h-3" />}
      </span>
      <span className={cn(checked && "text-muted-foreground line-through")}>
        {children}
      </span>
    </li>
  );
});

type TableData = {
  headers: string[];
  rows: string[][];
};

type ElementWithChildren = React.ReactElement<{ children?: React.ReactNode }>;

const isElementWithChildren = (
  node: React.ReactNode
): node is ElementWithChildren =>
  isValidElement<{ children?: React.ReactNode }>(node);

const getChildrenArray = (node: ElementWithChildren): ElementWithChildren[] =>
  Children.toArray(node.props.children).filter(isElementWithChildren);


// Extract raw text content from React children (handles rehype-highlight wrapped elements)
function extractTextFromChildren(children: React.ReactNode): string {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (!children) return '';
  if (Array.isArray(children)) return children.map(extractTextFromChildren).join('');
  if (isValidElement<{ children?: React.ReactNode }>(children)) {
    return extractTextFromChildren(children.props.children);
  }
  return String(children);
}

const browserLanguages = new Set(["browser", "webpage", "html-preview"]);

const isValidUrl = (value?: string) => {
  if (!value) return false;
  try {
    const parsed = new URL(value.trim());
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
};

const parseBrowserPayload = (raw: string) => {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const firstIndex = lines.findIndex(line => line.trim().length > 0);
  if (firstIndex === -1) return { url: undefined, content: "" };

  const firstLine = lines[firstIndex]?.trim() ?? "";
  if (isValidUrl(firstLine)) {
    const rest = lines.slice(firstIndex + 1).join("\n").trim();
    return { url: firstLine, content: rest };
  }

  return { url: undefined, content: raw.trim() };
};

const transformBrowserBlocks = (text: string) => {
  const normalized = text.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const output: string[] = [];
  let inFence = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      inFence = !inFence;
      output.push(line);
      continue;
    }

    if (!inFence && isValidUrl(trimmed)) {
      const nextLine = lines[index + 1];
      if (nextLine && nextLine.trim().length > 0) {
        const contentLines: string[] = [];
        let cursor = index + 1;
        while (cursor < lines.length && lines[cursor].trim().length > 0) {
          contentLines.push(lines[cursor]);
          cursor += 1;
        }

        output.push("```browser");
        output.push(trimmed);
        output.push(...contentLines);
        output.push("```");
        index = cursor - 1;
        continue;
      }
    }

    output.push(line);
  }

  return output.join("\n");
};

const extractText = (node: React.ReactNode): string => {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(child => extractText(child)).join("");
  }
  if (isElementWithChildren(node)) {
    return extractText(node.props.children);
  }
  return "";
};

const parseMarkdownTable = (children: React.ReactNode): TableData | null => {
  const elements = Children.toArray(children).filter(isElementWithChildren);
  const thead = elements.find(element => element.type === "thead");
  const tbody = elements.find(element => element.type === "tbody");

  if (!thead && !tbody) return null;

  const toRowCells = (row: ElementWithChildren) =>
    getChildrenArray(row).map(cell => extractText(cell).trim());

  const headerRows = thead ? getChildrenArray(thead) : [];
  const headerCells = headerRows.length
    ? toRowCells(headerRows[0])
    : [];

  const bodyRows = tbody ? getChildrenArray(tbody) : [];
  const rows = bodyRows.map(row => toRowCells(row));

  const columnCount = Math.max(
    headerCells.length,
    ...rows.map(row => row.length)
  );
  if (columnCount === 0) return null;

  const headers = headerCells.length
    ? headerCells
    : Array.from({ length: columnCount }, (_, index) =>
        `Column ${index + 1}`
      );

  const normalizedRows = rows.map(row =>
    headers.map((_, index) => row[index] ?? "")
  );

  return { headers, rows: normalizedRows };
};

const parseJsonTable = (raw: string): TableData | null => {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;

    const objects = parsed.filter(
      item => typeof item === "object" && item !== null && !Array.isArray(item)
    ) as Record<string, unknown>[];

    if (objects.length !== parsed.length) return null;

    const headers: string[] = [];
    const headerSet = new Set<string>();

    objects.forEach(item => {
      Object.keys(item).forEach(key => {
        if (!headerSet.has(key)) {
          headerSet.add(key);
          headers.push(key);
        }
      });
    });

    if (headers.length === 0) return null;

    const rows = objects.map(item =>
      headers.map(header => {
        const value = item[header];
        if (value === null || value === undefined) return "";
        if (
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean"
        ) {
          return String(value);
        }
        return JSON.stringify(value);
      })
    );

    return { headers, rows };
  } catch {
    return null;
  }
};

const parseCsvLine = (line: string) => {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
};

const parseCsvTable = (raw: string): TableData | null => {
  const lines = raw
    .trim()
    .split(/\r?\n/)
    .filter(line => line.trim().length > 0);

  if (lines.length < 2) return null;

  const parsedRows = lines.map(line => parseCsvLine(line));
  const columnCount = parsedRows[0]?.length ?? 0;

  if (columnCount < 2) return null;
  if (parsedRows.some(row => row.length !== columnCount)) return null;

  const headers = parsedRows[0].map(cell => cell.trim());
  const rows = parsedRows.slice(1).map(row => row.map(cell => cell.trim()));

  return { headers, rows };
};

const isLikelyCsv = (raw: string) => {
  const lines = raw.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return false;
  if (!lines.every(line => line.includes(","))) return false;
  return true;
};

type ParsedEmailContent = {
  to?: string;
  from?: string;
  subject: string;
  body: string;
  date?: string;
};

const parseEmailContent = (raw: string): ParsedEmailContent | null => {
  const normalized = raw.replace(/\r\n/g, "\n").trim();
  if (!normalized) return null;

  const lines = normalized.split("\n");
  const firstTenLines = lines.slice(0, 10).join("\n");
  const hasSubject = /(^|\n)\s*\*{0,2}Subject:\*{0,2}/i.test(firstTenLines);
  const hasRecipientCue =
    /(^|\n)\s*\*{0,2}To:\*{0,2}/i.test(firstTenLines) ||
    /\bDear\b/i.test(firstTenLines) ||
    /\bHi\s/i.test(firstTenLines);

  if (!hasSubject || !hasRecipientCue) return null;

  const findHeader = (label: string) => {
    const regex = new RegExp(`^\\*{0,2}${label}:\\*{0,2}\\s*(.*)$`, "im");
    const line = lines.find(currentLine => regex.test(currentLine));
    return line ? line.replace(regex, "$1").trim().replace(/^\*{1,2}|\*{1,2}$/g, "") : undefined;
  };

  const subject = findHeader("Subject");
  if (!subject) return null;

  const to = findHeader("To");
  const from = findHeader("From");
  const date = findHeader("Date");

  const headerIndices = lines.reduce<number[]>((acc, line, index) => {
    if (/^(Subject|To|From|Date):/i.test(line)) {
      acc.push(index);
    }
    return acc;
  }, []);

  let bodyStartIndex = 0;
  if (headerIndices.length > 0) {
    const lastHeaderIndex = Math.max(...headerIndices);
    const blankIndex = lines.findIndex(
      (line, index) => index > lastHeaderIndex && line.trim() === ""
    );
    bodyStartIndex = blankIndex !== -1 ? blankIndex + 1 : lastHeaderIndex + 1;
  }

  const body = lines.slice(bodyStartIndex).join("\n").trim();

  return {
    to,
    from,
    subject,
    body,
    date,
  };
};

const parseDraftRecipients = (raw?: string): EmailAddress[] | undefined => {
  if (!raw) return undefined;
  const recipients = raw
    .split(",")
    .map(part => part.trim())
    .filter(Boolean)
    .map(email => ({ email }));
  return recipients.length > 0 ? recipients : undefined;
};

const hashEmailContent = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

const JsonTableBlock = memo(function JsonTableBlock({
  raw,
  tableData,
  className,
  enableCopyButton = true,
}: {
  raw: string;
  tableData: TableData;
  className?: string;
  enableCopyButton?: boolean;
}) {
  const [viewMode, setViewMode] = useState<"table" | "code">("table");
  const toggleLabel =
    viewMode === "table" ? "View as Code" : "View as Table";

  return (
    <div className="my-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">JSON</Badge>
          <span>
            {tableData.rows.length} row{tableData.rows.length === 1 ? "" : "s"}
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setViewMode(current => (current === "table" ? "code" : "table"))
          }
        >
          {toggleLabel}
        </Button>
      </div>
      {viewMode === "table" ? (
        <InteractiveTable
          headers={tableData.headers}
          rows={tableData.rows}
          title="JSON data"
        />
      ) : (
        <CodeBlock
          className={className}
          enableCopyButton={enableCopyButton}
        >
          {raw}
        </CodeBlock>
      )}
    </div>
  );
});

export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  className,
  enableMermaid = true,
  enableMath = true,
  enableCopyButton = true,
  enableSlideView = true,
  enableEmailPreview = true,
  enableEmailDrafts = false,
  isStreaming,
}: MarkdownRendererProps) {
  const processContent = useCallback((text: string) => {
    return transformBrowserBlocks(text);
  }, []);

  const addDraft = useEmailStore(state => state.addDraft);
  const activeAccountId = useEmailStore(state => state.activeAccountId);

  const emailPreview = useMemo(() => {
    if (!enableEmailPreview) return null;
    return parseEmailContent(content);
  }, [content, enableEmailPreview]);

  const [emailViewMode, setEmailViewMode] = useState<"email" | "markdown">(
    "email"
  );

  useEffect(() => {
    if (emailPreview) {
      setEmailViewMode("email");
    }
  }, [emailPreview]);

  const emailDraftId = useMemo(() => {
    if (!emailPreview) return null;
    return `ai-email-${hashEmailContent(
      `${emailPreview.subject}-${emailPreview.body}`
    )}`;
  }, [emailPreview]);

  useEffect(() => {
    if (!emailPreview || !enableEmailDrafts || !emailDraftId) return;
    const { drafts } = useEmailStore.getState();
    if (drafts.some(draft => draft.id === emailDraftId)) return;

    addDraft({
      id: emailDraftId,
      accountId: activeAccountId || "ai",
      to: parseDraftRecipients(emailPreview.to),
      subject: emailPreview.subject,
      body: emailPreview.body,
      updatedAt: new Date(),
    });
  }, [
    emailPreview,
    enableEmailDrafts,
    emailDraftId,
    addDraft,
    activeAccountId,
  ]);

  const slideSections = useMemo(() => {
    if (!enableSlideView) return null;
    const normalized = content.replace(/\r\n/g, "\n").trim();
    if (!normalized.startsWith("# ")) return null;

    const separators = normalized.match(/^---$/gm);
    if (!separators || separators.length < 2) return null;

    const sections = normalized.split(/\n---\n/);
    if (sections.length < 3) return null;

    return sections.map(section => {
      const lines = section.trim().split("\n");
      const firstLine = lines[0]?.trim() ?? "";
      let title = "";
      let bodyLines = lines;

      if (/^#{1,6}\s+/.test(firstLine)) {
        title = firstLine.replace(/^#{1,6}\s+/, "").trim();
        bodyLines = lines.slice(1);
      }

      return {
        title,
        content: bodyLines.join("\n").trim(),
      };
    });
  }, [content, enableSlideView]);

  const [viewMode, setViewMode] = useState<"document" | "slides">("document");

  useEffect(() => {
    if (slideSections) {
      setViewMode("document");
    }
  }, [slideSections]);

  const remarkPlugins: Pluggable[] = [];
  remarkPlugins.push(remarkGfm as unknown as Pluggable);
  remarkPlugins.push(remarkEmoji as unknown as Pluggable);
  if (enableMath) {
    remarkPlugins.push(
      [remarkMath, { singleDollarTextMath: false }] as unknown as Pluggable
    );
  }

  const rehypePlugins: Pluggable[] = [];
  rehypePlugins.push(rehypeHighlight as unknown as Pluggable);
  rehypePlugins.push(rehypeRaw as unknown as Pluggable);
  if (enableMath) {
    rehypePlugins.push(
      [rehypeKatex, { strict: false, throwOnError: false }] as unknown as Pluggable
    );
  }

  return (
    <div className={cn("markdown-renderer", className)}>
      {emailPreview && enableEmailPreview && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/20 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="w-4 h-4 text-primary" />
            <span>Email draft detected</span>
          </div>
          <div className="flex items-center rounded-full border border-border/50 bg-background/60 p-1">
            <Button
              type="button"
              variant={emailViewMode === "email" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-full"
              onClick={() => setEmailViewMode("email")}
            >
              View as Email
            </Button>
            <Button
              type="button"
              variant={emailViewMode === "markdown" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-full"
              onClick={() => setEmailViewMode("markdown")}
            >
              View as Markdown
            </Button>
          </div>
        </div>
      )}
      {emailPreview && enableEmailPreview && emailViewMode === "email" ? (
        <EmailPreview
          to={emailPreview.to}
          from={emailPreview.from}
          subject={emailPreview.subject}
          body={emailPreview.body}
          date={emailPreview.date}
        />
      ) : (
        <>
          {slideSections && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/20 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Presentation className="w-4 h-4 text-primary" />
                <span>Presentation detected</span>
              </div>
              <div className="flex items-center rounded-full border border-border/50 bg-background/60 p-1">
                <Button
                  type="button"
                  variant={viewMode === "document" ? "secondary" : "ghost"}
                  size="sm"
                  className="rounded-full"
                  onClick={() => setViewMode("document")}
                >
                  View as Document
                </Button>
                <Button
                  type="button"
                  variant={viewMode === "slides" ? "secondary" : "ghost"}
                  size="sm"
                  className="rounded-full"
                  onClick={() => setViewMode("slides")}
                >
                  View as Slides
                </Button>
              </div>
            </div>
          )}
          {slideSections && viewMode === "slides" ? (
            <Suspense
              fallback={
                <div className="flex min-h-[360px] items-center justify-center rounded-xl border border-border/50 bg-card/40 text-muted-foreground">
                  Loading slides...
                </div>
              }
            >
              <SlideViewer slides={slideSections} theme="dark" />
            </Suspense>
          ) : (
            <ReactMarkdown
              remarkPlugins={remarkPlugins}
              rehypePlugins={rehypePlugins}
              components={{
          code({ className, children, ...props }: React.ComponentPropsWithoutRef<"code"> & { node?: unknown }) {
            const match = /language-(\w+)/.exec(className || "");
            const language = match?.[1];
            const rawCode = String(children).replace(/\n$/, "");
            const normalizedLanguage = language?.toLowerCase();

            if (normalizedLanguage && browserLanguages.has(normalizedLanguage)) {
              const { url, content: browserContent } = parseBrowserPayload(rawCode);
              return (
                <BrowserFrame
                  url={url}
                  title={url || "Browser preview"}
                  content={browserContent}
                />
              );
            }

            if (language === "mermaid" && enableMermaid) {
              return <MermaidDiagram chart={rawCode} />;
            }

            if (language === "chart") {
              try {
                const chartData = JSON.parse(rawCode);
                if (chartData.type && chartData.labels && chartData.datasets) {
                  return (
                    <DataChart
                      type={chartData.type}
                      labels={chartData.labels}
                      datasets={chartData.datasets}
                      title={chartData.title}
                    />
                  );
                }
              } catch {
                // fall through to code block
              }
            }

            if (language === "json") {
              try {
                const parsed = JSON.parse(rawCode);
                if (parsed && parsed.type && parsed.labels && parsed.datasets) {
                  return (
                    <DataChart
                      type={parsed.type}
                      labels={parsed.labels}
                      datasets={parsed.datasets}
                      title={parsed.title}
                    />
                  );
                }
              } catch {
                // fall through
              }
              const tableData = parseJsonTable(rawCode);
              if (tableData) {
                return (
                  <JsonTableBlock
                    raw={rawCode}
                    tableData={tableData}
                    className={className}
                    enableCopyButton={enableCopyButton}
                  />
                );
              }
            }

            if (language === "csv" || (!language && isLikelyCsv(rawCode))) {
              const tableData = parseCsvTable(rawCode);
              if (tableData) {
                return (
                  <InteractiveTable
                    headers={tableData.headers}
                    rows={tableData.rows}
                    title="CSV data"
                  />
                );
              }
            }

            if (normalizedLanguage === "svg") {
              const svgText = extractTextFromChildren(children);
              return <InlineSvgPreview content={svgText} />;
            }

            // Auto-render full HTML documents inline
            if (normalizedLanguage === "html" || normalizedLanguage === "htm") {
              const fullText = extractTextFromChildren(children);
              const trimmed = fullText.trim().toLowerCase();
              const isFullDocument =
                trimmed.startsWith("<!doctype") ||
                trimmed.startsWith("<html") ||
                (trimmed.includes("<body") && trimmed.includes("</body>"));
              if (isFullDocument) {
                return (
                  <InlineHtmlPreview content={fullText} isStreaming={isStreaming} />
                );
              }
            }

            const isInline = !className;

            if (isInline) {
              return (
                <code
                  className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-mono text-[0.88em] border border-primary/20 font-medium"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <CodeBlock className={className} enableCopyButton={enableCopyButton} {...props}>
                {children}
              </CodeBlock>
            );
          },

          pre({ children }) {
            return <>{children}</>;
          },

          table({ children }) {
            const tableData = parseMarkdownTable(children);

            if (tableData && tableData.rows.length > 2) {
              return (
                <InteractiveTable
                  headers={tableData.headers}
                  rows={tableData.rows}
                />
              );
            }

            return (
              <div className="my-5 overflow-x-auto rounded-xl border border-border/40 shadow-sm shadow-primary/5">
                <table className="w-full border-collapse text-sm">
                  {children}
                </table>
              </div>
            );
          },
          thead({ children }) {
            return (
              <thead className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-primary/20">
                {children}
              </thead>
            );
          },
          th({ children }) {
            return (
              <th className="px-4 py-3 text-left font-semibold text-foreground text-sm uppercase tracking-wider">
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className="px-4 py-2.5 border-t border-border/20 text-foreground/85 text-[0.92rem]">
                {children}
              </td>
            );
          },
          tr({ children }) {
            return (
              <tr className="hover:bg-muted/30 transition-colors">
                {children}
              </tr>
            );
          },

          li({ children, className, ...props }) {
            const isTaskItem = className?.includes('task-list-item');
            const childArray = Array.isArray(children) ? children : [children];
            
            if (isTaskItem) {
              const hasCheckedInput = childArray.some((child: unknown) => {
                if (typeof child === 'object' && child !== null && 'props' in child) {
                  const childProps = (child as { props?: { type?: string; checked?: boolean } }).props;
                  return childProps?.type === 'checkbox' && childProps?.checked;
                }
                return false;
              });
              
              const filteredChildren = childArray.filter((child: unknown) => {
                if (typeof child === 'object' && child !== null && 'props' in child) {
                  const childProps = (child as { props?: { type?: string } }).props;
                  return childProps?.type !== 'checkbox';
                }
                return true;
              });
              
              return (
                <TaskListItem checked={hasCheckedInput}>
                  {filteredChildren}
                </TaskListItem>
              );
            }
            
            return <li className={cn("leading-relaxed text-foreground/85 text-[0.935rem] transition-colors hover:text-foreground", className)} {...props}>{children}</li>;
          },

          blockquote({ children }) {
            const childArray = Array.isArray(children) ? children : [children];
            const firstChild = childArray[0];
            
            if (firstChild && typeof firstChild === 'object' && 'props' in firstChild) {
              const childProps = firstChild as { props?: { children?: unknown } };
              const text = String(childProps.props?.children || '');
              const match = text.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i);
              
              if (match) {
                const typeMap: Record<string, ContainerType> = {
                  NOTE: 'note',
                  TIP: 'tip',
                  IMPORTANT: 'info',
                  WARNING: 'warning',
                  CAUTION: 'danger',
                };
                const containerType = typeMap[match[1].toUpperCase()] || 'note';
                const restContent = text.replace(match[0], '').trim();
                
                return (
                  <CustomContainer type={containerType} title={match[1]}>
                    {restContent}
                    {childArray.slice(1)}
                  </CustomContainer>
                );
              }
            }
            
            return (
              <blockquote className="my-4 pl-4 border-l-4 border-primary/40 bg-gradient-to-r from-primary/10 to-transparent py-3 pr-4 rounded-r-lg not-italic flex items-start gap-3">
                <Lightbulb className="w-5 h-5 text-primary/70 mt-0.5 flex-shrink-0" />
                <div className="text-foreground/80">{children}</div>
              </blockquote>
            );
          },

          a({ href, children }) {
            const isExternal = href?.startsWith('http');
            return (
              <a 
                href={href}
                target={isExternal ? '_blank' : undefined}
                rel={isExternal ? 'noopener noreferrer' : undefined}
                className="text-primary hover:text-primary/80 underline underline-offset-4 decoration-primary/30 hover:decoration-primary/60 transition-all hover:bg-primary/5 px-0.5 rounded-sm inline-flex items-center gap-1"
              >
                {children}
                {isExternal && <ExternalLink className="w-3 h-3" />}
              </a>
            );
          },

          h1({ children }) {
            return (
              <h1 className="text-3xl font-extrabold mt-8 mb-5 pb-3 bg-gradient-to-r from-primary via-purple-400 to-primary/70 bg-clip-text text-transparent">
                {children}
              </h1>
            );
          },
          h2({ children }) {
            const text = typeof children === 'string' ? children : 
              Array.isArray(children) ? children.map(c => typeof c === 'string' ? c : '').join('') : '';
            const isSummary = /summary|tl;?dr|key (findings|takeaways)|executive|highlights|overview/i.test(text);
            
            if (isSummary) {
              return (
                <div className="mt-8 mb-5 rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-background to-primary/5 p-5 shadow-lg shadow-primary/10">
                  <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    {children}
                  </h2>
                </div>
              );
            }
            
            return (
              <div className="mt-8 mb-4 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 to-transparent p-4 shadow-sm">
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <span className="w-1.5 h-6 bg-primary rounded-full" />
                  {children}
                </h2>
              </div>
            );
          },
          h3({ children }) {
            return (
              <h3 className="text-lg font-semibold mt-5 mb-2 text-primary/90">
                {children}
              </h3>
            );
          },
          h4({ children }) {
            return (
              <h4 className="text-base font-semibold mt-4 mb-2 text-primary/80">
                {children}
              </h4>
            );
          },
          h5({ children }) {
            return (
              <h5 className="text-base font-semibold mt-3 mb-1 text-primary/70">
                {children}
              </h5>
            );
          },
          h6({ children }) {
            return (
              <h6 className="text-sm font-semibold mt-3 mb-1 text-primary/60">
                {children}
              </h6>
            );
          },

          p({ children }) {
            return (
              <p className="my-2.5 leading-relaxed text-foreground/85 text-[0.935rem]">
                {children}
              </p>
            );
          },

          ul({ children }) {
            return (
              <ul className="my-3 ml-1 space-y-1.5 list-none [&>li]:relative [&>li]:pl-5 [&>li]:before:content-['▸'] [&>li]:before:absolute [&>li]:before:left-0 [&>li]:before:text-primary/60 [&>li]:before:font-bold">
                {children}
              </ul>
            );
          },
          ol({ children }) {
            return (
              <ol className="my-3 ml-1 space-y-1.5 list-none [counter-reset:item] [&>li]:relative [&>li]:pl-7 [&>li]:[counter-increment:item] [&>li]:before:[content:counter(item)] [&>li]:before:absolute [&>li]:before:left-0 [&>li]:before:w-5 [&>li]:before:h-5 [&>li]:before:rounded-full [&>li]:before:bg-primary/15 [&>li]:before:text-primary [&>li]:before:text-xs [&>li]:before:font-bold [&>li]:before:flex [&>li]:before:items-center [&>li]:before:justify-center [&>li]:before:mt-0.5">
                {children}
              </ol>
            );
          },

          hr() {
            return (
              <hr className="my-8 border-none h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
            );
          },

          img({ src, alt }) {
            return (
              <span className="block my-4">
                <img 
                  src={src} 
                  alt={alt || ''} 
                  className="rounded-lg border border-border/50 max-w-full h-auto"
                  loading="lazy"
                />
                {alt && (
                  <span className="block text-center text-sm text-muted-foreground mt-2 italic">
                    {alt}
                  </span>
                )}
              </span>
            );
          },

          strong({ children }) {
            return (
              <strong className="font-semibold text-foreground bg-primary/[0.08] px-1 py-0.5 rounded">
                {children}
              </strong>
            );
          },

          em({ children }) {
            return (
              <em className="italic text-foreground/90">
                {children}
              </em>
            );
          },

          del({ children }) {
            return (
              <del className="line-through text-muted-foreground">
                {children}
              </del>
            );
          },

          details({ children }) {
            return (
              <details className="my-4 rounded-lg border border-border/50 overflow-hidden bg-card/30 group">
                {children}
              </details>
            );
          },
          summary({ children }) {
            return (
              <summary className="flex items-center gap-2 px-4 py-3 font-medium cursor-pointer hover:bg-muted/50 transition-colors list-none [&::-webkit-details-marker]:hidden">
                <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                {children}
              </summary>
            );
          },
              }}
            >
              {processContent(content)}
            </ReactMarkdown>
          )}
        </>
      )}
    </div>
  );
});

export default MarkdownRenderer;
