import { useRef, useEffect, useState } from "react";
import { Streamdown } from "streamdown";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Maximize2,
  Minimize2,
  ImageIcon,
  BarChart3,
  FileText,
  Download,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Artifact {
  type: string;
  url?: string;
  content?: string;
  path?: string;
  filename?: string;
  downloadUrl?: string;
}

interface ReportPreviewProps {
  content: string;
  artifacts: Artifact[];
  isStreaming: boolean;
  className?: string;
}

export function ReportPreview({
  content,
  artifacts,
  isStreaming,
  className,
}: ReportPreviewProps) {
  const [selectedImage, setSelectedImage] = useState<Artifact | null>(null);

  const visuals = artifacts.filter(
    a =>
      a.type === "image" ||
      (a.filename && /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(a.filename))
  );

  return (
    <div className={cn("space-y-6", className)}>
      <AnimatePresence>
        {visuals.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6"
          >
            {visuals.map((viz, idx) => (
              <motion.div
                key={viz.url || idx}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                layoutId={`viz-${viz.url || idx}`}
                className="relative group rounded-xl overflow-hidden border border-border/40 bg-muted/20 shadow-sm hover:shadow-md transition-all cursor-pointer aspect-video"
                onClick={() => setSelectedImage(viz)}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-end p-3">
                  <p className="text-white text-xs font-medium truncate w-full">
                    {viz.filename || "Generated Image"}
                  </p>
                </div>
                {viz.url ? (
                  <img
                    src={viz.url}
                    alt={viz.filename || "Visual"}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted/30">
                    <ImageIcon className="w-8 h-8 text-muted-foreground/50" />
                  </div>
                )}
                {isStreaming && idx === visuals.length - 1 && (
                  <div className="absolute top-2 right-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </span>
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative min-h-[200px]">
        {content ? (
          <div className="prose prose-invert prose-lg max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-p:leading-relaxed prose-pre:bg-muted/50 prose-pre:border prose-pre:border-border/50">
            <Streamdown>{content}</Streamdown>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <motion.div
              animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <FileText className="w-12 h-12 mb-4 opacity-20" />
            </motion.div>
            <p>Waiting for content stream...</p>
          </div>
        )}

        {isStreaming && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 flex items-center gap-2 text-muted-foreground text-sm"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-mono text-xs">JARVIS is typing...</span>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setSelectedImage(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="relative max-w-5xl max-h-[90vh] w-full bg-background rounded-2xl overflow-hidden shadow-2xl border border-border/50"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-border/40">
                <h3 className="font-medium">
                  {selectedImage.filename || "Image Preview"}
                </h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      const a = document.createElement("a");
                      a.href = selectedImage.url || "";
                      a.download = selectedImage.filename || "download";
                      a.click();
                    }}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedImage(null)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="p-1 bg-muted/10 h-[70vh] flex items-center justify-center">
                {selectedImage.url && (
                  <img
                    src={selectedImage.url}
                    alt="Full preview"
                    className="max-w-full max-h-full object-contain"
                  />
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
