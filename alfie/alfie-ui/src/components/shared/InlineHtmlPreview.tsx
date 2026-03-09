"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Code2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const CDN_REWRITES: [RegExp, string][] = [
  [/cdnjs\.cloudflare\.com\/ajax\/libs\/echarts\/[\d.]+\/echarts\.min\.js/,
   "cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js"],
];

function fixCdnUrl(url: string): string {
  for (const [pattern, replacement] of CDN_REWRITES) {
    if (pattern.test(url)) return url.replace(pattern, replacement);
  }
  return url;
}

function ensureCdnLoadOrder(html: string): string {
  const externalScriptRe = /<script\s+[^>]*src\s*=\s*["']([^"']+)["'][^>]*>\s*<\/script>/gi;
  const cdnUrls: string[] = [];
  let processed = html.replace(externalScriptRe, (_: string, url: string) => {
    cdnUrls.push(fixCdnUrl(url));
    return "";
  });
  if (cdnUrls.length === 0) return html;

  const inlineScriptRe = /<script(?:\s[^>]*)?>(?!<)([\s\S]*?)<\/script>/gi;
  const inlineContents: string[] = [];
  processed = processed.replace(inlineScriptRe, (match: string, body: string) => {
    if (!match.match(/\bsrc\s*=/i) && body.trim().length > 0) {
      inlineContents.push(body);
      return "";
    }
    return match;
  });

  if (inlineContents.length === 0) return html;

  const loaderScript = `<script>
(function(){
  var urls = ${JSON.stringify(cdnUrls)};
  var idx = 0;
  function loadNext() {
    if (idx >= urls.length) { runApp(); return; }
    var s = document.createElement('script');
    s.src = urls[idx++];
    s.onload = loadNext;
    s.onerror = function() { console.warn('CDN load failed: ' + s.src); loadNext(); };
    document.head.appendChild(s);
  }
  function runApp() {
    try {
      ${inlineContents.join("\n")}
    } catch(e) { console.error('App script error:', e); }
  }
  loadNext();
})();
<\/script>`;

  if (processed.includes("</body>")) {
    processed = processed.replace("</body>", loaderScript + "\n</body>");
  } else if (processed.includes("</html>")) {
    processed = processed.replace("</html>", loaderScript + "\n</html>");
  } else {
    processed += loaderScript;
  }

  return processed;
}

function stripScripts(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, "");
}

function applyCdnRewrites(html: string): string {
  return CDN_REWRITES.reduce((result, [pattern, replacement]) => {
    return result.replace(pattern, replacement);
  }, html);
}

function cleanPartialHtml(html: string): string {
  let result = stripScripts(html);

  const lastStyleOpen = result.toLowerCase().lastIndexOf("<style");
  if (lastStyleOpen !== -1) {
    const lastStyleClose = result.toLowerCase().lastIndexOf("</style>");
    if (lastStyleClose < lastStyleOpen) {
      result = result.slice(0, lastStyleOpen);
    }
  }

  const lastScriptOpen = result.toLowerCase().lastIndexOf("<script");
  if (lastScriptOpen !== -1) {
    const lastScriptClose = result.toLowerCase().lastIndexOf("</script>");
    if (lastScriptClose < lastScriptOpen) {
      result = result.slice(0, lastScriptOpen);
    }
  }

  const lower = result.toLowerCase();
  if (!lower.includes("</body>")) result += "\n</body>";
  if (!lower.includes("</html>")) result += "\n</html>";
  return result;
}

interface InlineHtmlPreviewProps {
  content: string;
  isStreaming?: boolean;
}

export const InlineHtmlPreview = memo(function InlineHtmlPreview({
  content,
  isStreaming,
}: InlineHtmlPreviewProps) {
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [iframeHeight, setIframeHeight] = useState(400);
  const [phase, setPhase] = useState<"waiting" | "streaming" | "complete">("waiting");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const contentRef = useRef(content);
  const lastRenderedLenRef = useRef(0);
  const streamIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stableTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const renderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastContentRef = useRef(content);

  contentRef.current = content;

  const isComplete = useMemo(() => {
    const t = content.trim().toLowerCase();
    return t.includes("</html>") || t.includes("</body>");
  }, [content]);

  const hasBodyTag = useMemo(() => /<body/i.test(content), [content]);
  const contentLen = content.trim().length;
  const hasEnoughContent = contentLen >= 200;

  const updateIframeHeight = useCallback(() => {
    try {
      const iframe = iframeRef.current;
      if (iframe?.contentDocument?.body) {
        const height = iframe.contentDocument.body.scrollHeight;
        if (height > 50) {
          setIframeHeight(Math.min(height + 20, expanded ? 800 : 500));
        }
      }
    } catch {
      // cross-origin
    }
  }, [expanded]);

  useEffect(() => {
    if (isStreaming) {
      setPhase(prev => {
        if (prev === "complete") return prev;
        return hasBodyTag && hasEnoughContent ? "streaming" : "waiting";
      });
      return;
    }

    if (isComplete) {
      setPhase("complete");
      return;
    }

    setPhase(prev => (prev === "complete" ? prev : "waiting"));
  }, [isStreaming, hasBodyTag, hasEnoughContent, isComplete]);

  useEffect(() => {
    if (isStreaming || phase === "complete") return;
    if (stableTimerRef.current) clearTimeout(stableTimerRef.current);
    lastContentRef.current = content;
    if (!hasEnoughContent) return;
    stableTimerRef.current = setTimeout(() => {
      if (lastContentRef.current === contentRef.current && contentRef.current.trim().length >= 200) {
        setPhase("complete");
      }
    }, 2000);
    return () => {
      if (stableTimerRef.current) clearTimeout(stableTimerRef.current);
    };
  }, [content, isStreaming, phase, hasEnoughContent]);

  useEffect(() => {
    if (phase !== "complete") return;
    if (renderTimerRef.current) clearTimeout(renderTimerRef.current);
    renderTimerRef.current = setTimeout(() => {
      const iframe = iframeRef.current;
      if (!iframe) return;
      iframe.srcdoc = ensureCdnLoadOrder(applyCdnRewrites(content));
      lastRenderedLenRef.current = content.length;
    }, 200);
    return () => {
      if (renderTimerRef.current) clearTimeout(renderTimerRef.current);
    };
  }, [content, phase]);

  useEffect(() => {
    if (!isStreaming || phase !== "streaming") {
      if (streamIntervalRef.current) {
        clearInterval(streamIntervalRef.current);
        streamIntervalRef.current = null;
      }
      return;
    }

    streamIntervalRef.current = setInterval(() => {
      const iframe = iframeRef.current;
      if (!iframe) return;
      const currentContent = contentRef.current;
      if (currentContent.length === lastRenderedLenRef.current) return;

      const previewHtml = cleanPartialHtml(applyCdnRewrites(currentContent));
      try {
        const doc = iframe.contentDocument;
        if (doc) {
          doc.open();
          doc.write(previewHtml);
          doc.close();
        }
      } catch {
        iframe.srcdoc = previewHtml;
      }
      lastRenderedLenRef.current = currentContent.length;

      setTimeout(updateIframeHeight, 150);
    }, 1200);

    return () => {
      if (streamIntervalRef.current) {
        clearInterval(streamIntervalRef.current);
        streamIntervalRef.current = null;
      }
    };
  }, [isStreaming, phase, updateIframeHeight]);

  useEffect(() => {
    if (isStreaming) return;
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }
    if (isComplete || hasEnoughContent) {
      setPhase("complete");
    }
  }, [isStreaming, isComplete, hasEnoughContent]);

  useEffect(() => {
    return () => {
      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
      if (stableTimerRef.current) clearTimeout(stableTimerRef.current);
      if (renderTimerRef.current) clearTimeout(renderTimerRef.current);
    };
  }, []);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "page.html";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenNew = () => {
    const blob = new Blob([content], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  const onIframeLoad = useCallback(() => {
    updateIframeHeight();
  }, [updateIframeHeight]);

  return (
    <div className="my-3 rounded-xl border border-border/50 bg-card/50 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/30 bg-muted/30">
        {phase === "streaming" ? (
          <div className="flex items-center gap-2.5 text-xs">
            <div className="relative h-1.5 w-28 bg-muted rounded-full overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_100%] animate-gradient-shift rounded-full" />
            </div>
            <span className="text-primary font-medium">Building report…</span>
          </div>
        ) : phase === "waiting" ? (
          <div className="flex items-center gap-2.5 text-xs">
            <div className="relative h-1.5 w-28 bg-muted rounded-full overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-muted-foreground/20 via-muted-foreground/40 to-muted-foreground/20 bg-[length:200%_100%] animate-gradient-shift rounded-full" />
            </div>
            <span className="text-muted-foreground font-medium">Preparing…</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Eye className="w-3.5 h-3.5" />
            <span>Live Preview</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-md hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
            title="Copy HTML"
            type="button"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={handleDownload}
            className="p-1.5 rounded-md hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
            title="Download HTML"
            type="button"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleOpenNew}
            className="p-1.5 rounded-md hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
            title="Open in new tab"
            type="button"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-md hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
            title={expanded ? "Collapse" : "Expand"}
            type="button"
          >
            {expanded ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={() => setShowCode(!showCode)}
            className={cn(
              "p-1.5 rounded-md hover:bg-accent/50 transition-colors",
              showCode
                ? "text-primary bg-accent/50"
                : "text-muted-foreground hover:text-foreground"
            )}
            title={showCode ? "Show Preview" : "View Code"}
            type="button"
          >
            <Code2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {showCode ? (
        <div className="p-4 overflow-x-auto max-h-[500px]">
          <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-all">
            {content}
          </pre>
        </div>
      ) : (
        <div
          style={{ height: `${iframeHeight}px` }}
          className="relative overflow-hidden rounded-b-xl"
        >
          {phase === "waiting" && (
            <div className="absolute inset-0 flex flex-col gap-3 p-6 z-10" style={{ background: "hsl(var(--card))" }}>
              <div className="h-8 w-3/4 rounded-lg bg-muted shimmer" />
              <div className="h-4 w-full rounded bg-muted shimmer" style={{ animationDelay: "0.1s" }} />
              <div className="h-4 w-5/6 rounded bg-muted shimmer" style={{ animationDelay: "0.2s" }} />
              <div className="h-32 w-full rounded-lg bg-muted shimmer mt-2" style={{ animationDelay: "0.3s" }} />
              <div className="h-4 w-4/5 rounded bg-muted shimmer" style={{ animationDelay: "0.4s" }} />
              <div className="h-4 w-full rounded bg-muted shimmer" style={{ animationDelay: "0.5s" }} />
              <div className="h-24 w-full rounded-lg bg-muted shimmer mt-2" style={{ animationDelay: "0.6s" }} />
            </div>
          )}
          <iframe
            ref={iframeRef}
            sandbox="allow-scripts allow-same-origin"
            onLoad={onIframeLoad}
            className="w-full border-0 transition-opacity duration-500"
            style={{
              height: `${iframeHeight}px`,
              background: "white",
              borderRadius: "0 0 0.75rem 0.75rem",
              opacity: phase === "waiting" ? 0 : phase === "streaming" ? 0.95 : 1,
            }}
            title="HTML Preview"
          />
        </div>
      )}
    </div>
  );
});
