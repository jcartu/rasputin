"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Code2,
  Download,
  ExternalLink,
  RefreshCw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MarkdownRenderer } from "@/components/shared/MarkdownRenderer";
import { cn } from "@/lib/utils";

interface CodeSandboxProps {
  html?: string;
  css?: string;
  javascript?: string;
  title?: string;
  onClose?: () => void;
}

interface ResizableHandleProps {
  onResize: (delta: number) => void;
  className?: string;
}

function ResizableHandle({ onResize, className }: ResizableHandleProps) {
  const startYRef = useRef(0);
  const isDraggingRef = useRef(false);

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const delta = event.clientY - startYRef.current;
      startYRef.current = event.clientY;
      onResize(delta);
    },
    [onResize]
  );

  const stopDragging = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    document.body.style.cursor = "default";
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", stopDragging);
  }, [handlePointerMove]);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      isDraggingRef.current = true;
      startYRef.current = event.clientY;
      document.body.style.cursor = "row-resize";
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", stopDragging);
    },
    [handlePointerMove, stopDragging]
  );

  return (
    <div
      onPointerDown={handlePointerDown}
      className={cn(
        "group flex h-6 items-center justify-center",
        "cursor-row-resize",
        className
      )}
    >
      <div className="h-1.5 w-24 rounded-full bg-muted/50 transition-all group-hover:bg-muted" />
    </div>
  );
}

const buildHtmlDocument = ({
  html,
  css,
  javascript,
}: {
  html: string;
  css: string;
  javascript: string;
}) => {
  const bodyContent = html.trim().length > 0 ? html : "<div id=\"app\"></div>";
  return `<!DOCTYPE html>
<html lang=\"en\">
  <head>
    <meta charset=\"utf-8\" />
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
    <style>${css}</style>
  </head>
  <body>
    ${bodyContent}
    <script>${javascript}</script>
  </body>
</html>`;
};

export function CodeSandbox({
  html = "",
  css = "",
  javascript = "",
  title = "Sandbox Preview",
  onClose,
}: CodeSandboxProps) {
  const [activeTab, setActiveTab] = useState("preview");
  const [iframeKey, setIframeKey] = useState(0);
  const [previewHeight, setPreviewHeight] = useState(460);
  const [htmlValue, setHtmlValue] = useState(html);
  const [cssValue, setCssValue] = useState(css);
  const [javascriptValue, setJavascriptValue] = useState(javascript);
  const [editorTab, setEditorTab] = useState<"html" | "css" | "javascript">(
    "html"
  );

  useEffect(() => setHtmlValue(html), [html]);
  useEffect(() => setCssValue(css), [css]);
  useEffect(() => setJavascriptValue(javascript), [javascript]);

  const combinedSource = useMemo(
    () =>
      buildHtmlDocument({
        html: htmlValue,
        css: cssValue,
        javascript: javascriptValue,
      }),
    [htmlValue, cssValue, javascriptValue]
  );

  const srcDoc = useMemo(() => combinedSource, [combinedSource]);

  const handleRefresh = useCallback(() => {
    setIframeKey((prev) => prev + 1);
  }, []);

  const handleOpenInNewTab = useCallback(() => {
    const blob = new Blob([combinedSource], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }, [combinedSource]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([combinedSource], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "preview.html";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [combinedSource]);

  const handleResize = useCallback((delta: number) => {
    setPreviewHeight((current) => {
      const next = current + delta;
      return Math.min(720, Math.max(240, next));
    });
  }, []);

  const codeBlock = useMemo(
    () => `\`\`\`html\n${combinedSource}\n\`\`\``,
    [combinedSource]
  );

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border/60 bg-[#0b0f16] text-foreground shadow-xl">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted/30">
            <Code2 className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground">Live preview sandbox</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            className="h-8 w-8"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleOpenInNewTab}
            className="h-8 w-8"
            title="Open in new tab"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDownload}
            className="h-8 w-8"
            title="Download HTML"
          >
            <Download className="h-4 w-4" />
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
              title="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        <div className="border-b border-border/60 px-4 py-2">
          <TabsList className="bg-muted/20">
            <TabsTrigger value="preview" className="gap-2">
              Preview
            </TabsTrigger>
            <TabsTrigger value="code" className="gap-2">
              Code
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="preview" className="m-0 h-full">
          <AnimatePresence mode="wait">
            <motion.div
              key="preview"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="flex h-full flex-col gap-2 px-4 py-4"
            >
              <div
                className="relative overflow-hidden rounded-2xl border border-border/50 bg-[#0c0f14] shadow-inner"
                style={{ height: previewHeight }}
              >
                <iframe
                  key={iframeKey}
                  title="Sandbox Preview"
                  sandbox="allow-scripts allow-modals"
                  srcDoc={srcDoc}
                  className="h-full w-full rounded-2xl bg-black"
                />
              </div>
              <ResizableHandle onResize={handleResize} />
              <p className="text-xs text-muted-foreground">
                Drag the handle to resize the preview.
              </p>
            </motion.div>
          </AnimatePresence>
        </TabsContent>

        <TabsContent value="code" className="m-0 h-full">
          <AnimatePresence mode="wait">
            <motion.div
              key="code"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="flex h-full flex-col gap-4 px-4 py-4"
            >
              <div className="rounded-2xl border border-border/50 bg-[#0c0f14] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Combined Source
                </p>
                <div className="mt-3">
                  <MarkdownRenderer content={codeBlock} enableCopyButton={false} />
                </div>
              </div>

              <div className="flex flex-1 flex-col rounded-2xl border border-border/50 bg-muted/10">
                <div className="flex items-center justify-between border-b border-border/50 px-4 py-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Edit Code
                  </p>
                  <div className="flex items-center gap-2">
                    {(["html", "css", "javascript"] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setEditorTab(tab)}
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                          editorTab === tab
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted/30 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {tab.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-4">
                    {editorTab === "html" && (
                      <textarea
                        value={htmlValue}
                        onChange={(event) => setHtmlValue(event.target.value)}
                        placeholder="Add HTML markup..."
                        className="min-h-[200px] w-full rounded-xl border border-border/50 bg-[#0b0f16] p-4 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    )}
                    {editorTab === "css" && (
                      <textarea
                        value={cssValue}
                        onChange={(event) => setCssValue(event.target.value)}
                        placeholder="Add CSS styles..."
                        className="min-h-[200px] w-full rounded-xl border border-border/50 bg-[#0b0f16] p-4 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    )}
                    {editorTab === "javascript" && (
                      <textarea
                        value={javascriptValue}
                        onChange={(event) => setJavascriptValue(event.target.value)}
                        placeholder="Add JavaScript..."
                        className="min-h-[200px] w-full rounded-xl border border-border/50 bg-[#0b0f16] p-4 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    )}
                  </div>
                </ScrollArea>
              </div>
            </motion.div>
          </AnimatePresence>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default CodeSandbox;
