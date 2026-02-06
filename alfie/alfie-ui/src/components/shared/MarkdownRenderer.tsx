'use client';

import { memo, useCallback, useEffect, useRef, useState } from 'react';
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
  ChevronDown, 
  ChevronRight, 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  CheckCircle2,
  Lightbulb,
  Quote,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
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

interface MarkdownRendererProps {
  content: string;
  className?: string;
  enableMermaid?: boolean;
  enableMath?: boolean;
  enableCopyButton?: boolean;
}

const CodeBlock = memo(function CodeBlock({ 
  className, 
  children, 
  enableCopyButton = true,
  ...props 
}: React.HTMLAttributes<HTMLElement> & { enableCopyButton?: boolean }) {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLElement>(null);
  const language = className?.replace(/language-/, '') || '';
  const isInline = !className;

  const handleCopy = useCallback(async () => {
    if (codeRef.current) {
      const text = codeRef.current.textContent || '';
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, []);

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
      {enableCopyButton && (
        <motion.button
          type="button"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={handleCopy}
          className={cn(
            "absolute top-2 right-2 p-2 rounded-lg transition-all",
            "bg-muted/80 hover:bg-muted border border-border/50",
            "opacity-0 group-hover:opacity-100 focus:opacity-100"
          )}
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

  useEffect(() => {
    const renderDiagram = async () => {
      if (!chart) return;
      
      try {
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg } = await mermaid.render(id, chart);
        setSvg(svg);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to render diagram');
      }
    };

    renderDiagram();
  }, [chart]);

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
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
});

const CollapsibleSection = memo(function CollapsibleSection({ 
  title, 
  children,
  defaultOpen = false 
}: { 
  title: string; 
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="my-4 rounded-lg border border-border/50 overflow-hidden bg-card/30">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left font-medium hover:bg-muted/50 transition-colors"
      >
        <motion.div
          animate={{ rotate: isOpen ? 90 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronRight className="w-4 h-4" />
        </motion.div>
        {title}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 border-t border-border/50">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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

export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  className,
  enableMermaid = true,
  enableMath = true,
  enableCopyButton = true,
}: MarkdownRendererProps) {
  const processContent = useCallback((text: string) => {
    return text;
  }, []);

  const remarkPlugins = [
    remarkGfm,
    remarkEmoji,
    ...(enableMath ? [remarkMath] : []),
  ];

  const rehypePlugins = [
    rehypeHighlight,
    rehypeRaw,
    ...(enableMath ? [rehypeKatex] : []),
  ];

  return (
    <div className={cn("markdown-renderer", className)}>
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match?.[1];
            
            if (language === 'mermaid' && enableMermaid) {
              return <MermaidDiagram chart={String(children).replace(/\n$/, '')} />;
            }

            const isInline = !className;
            
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
              <CodeBlock className={className} enableCopyButton={enableCopyButton} {...props}>
                {children}
              </CodeBlock>
            );
          },

          pre({ children }) {
            return <>{children}</>;
          },

          table({ children }) {
            return (
              <div className="my-4 overflow-x-auto rounded-lg border border-border/50">
                <table className="w-full border-collapse text-sm">
                  {children}
                </table>
              </div>
            );
          },
          thead({ children }) {
            return (
              <thead className="bg-muted/50 border-b border-border/50">
                {children}
              </thead>
            );
          },
          th({ children }) {
            return (
              <th className="px-4 py-3 text-left font-semibold text-foreground">
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className="px-4 py-3 border-t border-border/30">
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
            
            return <li className={className} {...props}>{children}</li>;
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
              <blockquote className="my-4 pl-4 border-l-4 border-primary/50 italic text-muted-foreground bg-muted/20 py-2 pr-4 rounded-r-lg">
                {children}
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
                className="text-primary hover:text-primary/80 underline underline-offset-2 decoration-primary/30 hover:decoration-primary/60 transition-colors inline-flex items-center gap-1"
              >
                {children}
                {isExternal && <ExternalLink className="w-3 h-3" />}
              </a>
            );
          },

          h1({ children }) {
            return (
              <h1 className="text-3xl font-bold mt-8 mb-4 pb-2 border-b border-border/50 text-foreground">
                {children}
              </h1>
            );
          },
          h2({ children }) {
            return (
              <h2 className="text-2xl font-bold mt-6 mb-3 pb-2 border-b border-border/30 text-foreground">
                {children}
              </h2>
            );
          },
          h3({ children }) {
            return (
              <h3 className="text-xl font-semibold mt-5 mb-2 text-foreground">
                {children}
              </h3>
            );
          },
          h4({ children }) {
            return (
              <h4 className="text-lg font-semibold mt-4 mb-2 text-foreground">
                {children}
              </h4>
            );
          },
          h5({ children }) {
            return (
              <h5 className="text-base font-semibold mt-3 mb-1 text-foreground">
                {children}
              </h5>
            );
          },
          h6({ children }) {
            return (
              <h6 className="text-sm font-semibold mt-3 mb-1 text-muted-foreground">
                {children}
              </h6>
            );
          },

          p({ children }) {
            return (
              <p className="my-3 leading-7 text-foreground/90">
                {children}
              </p>
            );
          },

          ul({ children }) {
            return (
              <ul className="my-3 ml-6 list-disc space-y-1 marker:text-muted-foreground">
                {children}
              </ul>
            );
          },
          ol({ children }) {
            return (
              <ol className="my-3 ml-6 list-decimal space-y-1 marker:text-muted-foreground">
                {children}
              </ol>
            );
          },

          hr() {
            return (
              <hr className="my-8 border-none h-px bg-gradient-to-r from-transparent via-border to-transparent" />
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
              <strong className="font-semibold text-foreground">
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
    </div>
  );
});

export default MarkdownRenderer;
