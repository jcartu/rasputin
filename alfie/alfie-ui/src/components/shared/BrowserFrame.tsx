"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Globe,
  RefreshCw,
  X,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface BrowserFrameProps {
  url?: string;
  title?: string;
  content?: string;
  isLoading?: boolean;
  onClose?: () => void;
}

const isValidUrl = (value?: string) => {
  if (!value) return false;
  try {
    const parsed = new URL(value.trim());
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
};

const isLikelyHtml = (value: string) => /<\/?[a-z][\s\S]*>/i.test(value);

export function BrowserFrame({
  url,
  title,
  content,
  isLoading = false,
  onClose,
}: BrowserFrameProps) {
  const normalizedUrl = url?.trim() ?? "";
  const normalizedContent = content?.trim() ?? "";
  const hasContent = normalizedContent.length > 0;
  const showIframe = !hasContent && isValidUrl(normalizedUrl);
  const showHtmlFrame = hasContent && isLikelyHtml(normalizedContent);
  const showScreenshotPlaceholder = useMemo(() => {
    const text = normalizedContent.toLowerCase();
    return (
      text.startsWith("screenshot") ||
      text.startsWith("[screenshot]") ||
      text.startsWith("image capture")
    );
  }, [normalizedContent]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={cn(
        "rounded-2xl border border-border/60 bg-card/40 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.5)]",
        "overflow-hidden w-full"
      )}
    >
      <div className="flex items-center justify-between bg-muted/60 px-4 py-2 border-b border-border/60">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-rose-400/90" />
          <span className="h-3 w-3 rounded-full bg-amber-300/90" />
          <span className="h-3 w-3 rounded-full bg-emerald-400/90" />
        </div>
        <p className="text-xs font-medium text-muted-foreground truncate max-w-[60%]">
          {title || normalizedUrl || "Browser preview"}
        </p>
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "p-1.5 rounded-md transition-colors",
            onClose
              ? "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              : "opacity-0 pointer-events-none"
          )}
          aria-label="Close browser preview"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <div className="flex items-center gap-2 bg-background px-3 py-2 border-b border-border/60">
        <div className="flex items-center gap-1 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
          <ArrowRight className="h-4 w-4" />
          <RefreshCw className="h-4 w-4" />
        </div>
        <div className="flex-1 flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground truncate">
            {normalizedUrl || "about:blank"}
          </span>
        </div>
      </div>

      <div className="bg-white text-slate-900 min-h-[220px]">
        {isLoading ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : showIframe ? (
          <iframe
            title={title || normalizedUrl || "Browser preview"}
            src={normalizedUrl}
            className="h-[360px] w-full"
            sandbox="allow-forms allow-modals allow-popups allow-scripts"
          />
        ) : showScreenshotPlaceholder ? (
          <div className="flex h-[280px] w-full items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200">
            <div className="text-center">
              <div className="mx-auto mb-3 h-12 w-12 rounded-2xl border border-dashed border-slate-300 bg-white/70" />
              <p className="text-sm font-medium text-slate-600">Screenshot preview</p>
              <p className="text-xs text-slate-500">Image capture placeholder</p>
            </div>
          </div>
        ) : hasContent ? (
          showHtmlFrame ? (
            <iframe
              title={title || "HTML preview"}
              srcDoc={normalizedContent}
              className="h-[360px] w-full"
              sandbox="allow-forms allow-modals allow-popups allow-scripts"
            />
          ) : (
            <div className="p-4 text-sm leading-6">
              <pre className="whitespace-pre-wrap font-sans text-slate-700">
                {normalizedContent}
              </pre>
            </div>
          )
        ) : (
          <div className="p-6 text-center text-sm text-slate-500">
            No preview available.
          </div>
        )}
      </div>
    </motion.div>
  );
}
