"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { Check, Code2, Copy, Download, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface InlineSvgPreviewProps {
  content: string;
}

export const InlineSvgPreview = memo(function InlineSvgPreview({
  content,
}: InlineSvgPreviewProps) {
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const svgRef = useRef<HTMLDivElement>(null);

  const sanitizedSVG = useMemo(() => {
    return DOMPurify.sanitize(content, {
      USE_PROFILES: { svg: true, svgFilters: true },
      FORBID_TAGS: ["script", "foreignObject"],
      FORBID_ATTR: ["onclick", "onerror", "onload", "onfocus", "onblur"],
    });
  }, [content]);

  useEffect(() => {
    if (!svgRef.current) return;
    svgRef.current.innerHTML = sanitizedSVG;
  }, [sanitizedSVG]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "chart.svg";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="my-3 rounded-xl border border-border/50 bg-card/50 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/30 bg-muted/30">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Eye className="w-3.5 h-3.5" />
          <span>SVG Preview</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-md hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
            title="Copy SVG"
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
            title="Download SVG"
            type="button"
          >
            <Download className="w-3.5 h-3.5" />
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
        <div className="p-4 overflow-x-auto">
          <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-all">
            {content}
          </pre>
        </div>
      ) : (
        <div
          ref={svgRef}
          className="p-4 flex justify-center items-center bg-white/5 [&_svg]:max-w-full [&_svg]:h-auto"
        />
      )}
    </div>
  );
});
