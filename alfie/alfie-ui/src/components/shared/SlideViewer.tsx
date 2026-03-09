"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "./MarkdownRenderer";

type Slide = {
  title: string;
  content: string;
};

export type SlideViewerProps = {
  slides: Slide[];
  theme?: "dark" | "light";
};

type Direction = -1 | 0 | 1;

const slideVariants = {
  enter: (direction: Direction) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
    scale: 0.98,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (direction: Direction) => ({
    x: direction > 0 ? -80 : 80,
    opacity: 0,
    scale: 0.98,
  }),
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatInlineMarkdown(value: string): string {
  let output = escapeHtml(value);
  output = output.replace(/`([^`]+)`/g, "<code>$1</code>");
  output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  output = output.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  output = output.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  return output;
}

function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let html = "";
  let inCodeBlock = false;
  let listType: "ul" | "ol" | null = null;

  const closeList = () => {
    if (listType) {
      html += `</${listType}>`;
      listType = null;
    }
  };

  lines.forEach(line => {
    if (line.trim().startsWith("```")) {
      if (!inCodeBlock) {
        closeList();
        inCodeBlock = true;
        html += "<pre><code>";
      } else {
        html += "</code></pre>";
        inCodeBlock = false;
      }
      return;
    }

    if (inCodeBlock) {
      html += `${escapeHtml(line)}\n`;
      return;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      closeList();
      const level = headingMatch[1].length;
      html += `<h${level}>${formatInlineMarkdown(headingMatch[2])}</h${level}>`;
      return;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const item = line.replace(/^\s*[-*+]\s+/, "");
      if (listType !== "ul") {
        closeList();
        listType = "ul";
        html += "<ul>";
      }
      html += `<li>${formatInlineMarkdown(item)}</li>`;
      return;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const item = line.replace(/^\s*\d+\.\s+/, "");
      if (listType !== "ol") {
        closeList();
        listType = "ol";
        html += "<ol>";
      }
      html += `<li>${formatInlineMarkdown(item)}</li>`;
      return;
    }

    if (/^\s*>\s+/.test(line)) {
      closeList();
      const quote = line.replace(/^\s*>\s+/, "");
      html += `<blockquote>${formatInlineMarkdown(quote)}</blockquote>`;
      return;
    }

    if (!line.trim()) {
      closeList();
      return;
    }

    closeList();
    html += `<p>${formatInlineMarkdown(line)}</p>`;
  });

  closeList();

  if (inCodeBlock) {
    html += "</code></pre>";
  }

  return html;
}

function buildExportHtml(slides: Slide[]): string {
  const slideMarkup = slides
    .map((slide, index) => {
      const title = slide.title
        ? `<h1>${escapeHtml(slide.title)}</h1>`
        : "";
      const content = markdownToHtml(slide.content);
      return `<section class="slide${index === 0 ? " active" : ""}">${title}${content}</section>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Exported Slides</title>
    <style>
      :root {
        color-scheme: dark;
        --bg-start: #0b0d12;
        --bg-end: #050608;
        --surface: rgba(9, 11, 18, 0.7);
        --text: #f5f6f9;
        --muted: #a1a7b3;
        --accent: #7c5cff;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: "Trebuchet MS", "Lucida Sans", sans-serif;
        background: radial-gradient(circle at top, #111425 0%, var(--bg-end) 55%),
          linear-gradient(135deg, var(--bg-start), var(--bg-end));
        color: var(--text);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 32px;
      }
      .stage {
        width: min(1200px, 96vw);
        aspect-ratio: 16 / 9;
        position: relative;
        background: var(--surface);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 28px;
        box-shadow: 0 40px 120px rgba(0, 0, 0, 0.6);
        overflow: hidden;
        backdrop-filter: blur(16px);
      }
      .slides {
        position: absolute;
        inset: 0;
        padding: 72px 88px 88px;
      }
      .slide {
        position: absolute;
        inset: 0;
        opacity: 0;
        transform: translateX(40px);
        transition: opacity 0.5s ease, transform 0.5s ease;
      }
      .slide.active {
        opacity: 1;
        transform: translateX(0);
      }
      h1 {
        margin: 0 0 24px;
        font-family: "Georgia", "Times New Roman", serif;
        font-size: clamp(2rem, 4vw, 3.8rem);
        letter-spacing: -0.02em;
      }
      h2, h3, h4 {
        margin: 1.6rem 0 0.8rem;
      }
      p {
        margin: 0.75rem 0;
        font-size: clamp(1rem, 1.6vw, 1.4rem);
        color: var(--text);
        line-height: 1.65;
      }
      ul, ol {
        margin: 0.8rem 0 0.8rem 1.5rem;
        font-size: clamp(1rem, 1.6vw, 1.3rem);
        line-height: 1.6;
      }
      li { margin-bottom: 0.35rem; }
      blockquote {
        margin: 1rem 0;
        padding-left: 1rem;
        border-left: 3px solid var(--accent);
        color: var(--muted);
      }
      code {
        background: rgba(255, 255, 255, 0.08);
        padding: 0.1rem 0.35rem;
        border-radius: 6px;
      }
      pre {
        background: rgba(0, 0, 0, 0.4);
        padding: 1rem;
        border-radius: 14px;
        overflow-x: auto;
      }
      a { color: var(--accent); text-decoration: none; }
      .controls {
        position: absolute;
        bottom: 18px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 10px 16px;
        border-radius: 999px;
        background: rgba(8, 10, 16, 0.7);
        border: 1px solid rgba(255, 255, 255, 0.08);
        backdrop-filter: blur(12px);
      }
      .controls button {
        border: none;
        background: rgba(255, 255, 255, 0.06);
        color: var(--text);
        padding: 8px 14px;
        border-radius: 999px;
        cursor: pointer;
        font-size: 0.95rem;
      }
      .counter { color: var(--muted); font-size: 0.9rem; }
      @media (max-width: 720px) {
        .slides { padding: 48px 32px 72px; }
      }
    </style>
  </head>
  <body>
    <div class="stage">
      <div class="slides">${slideMarkup}</div>
      <div class="controls">
        <button id="prev">Prev</button>
        <span class="counter" id="counter">1 / ${slides.length}</span>
        <button id="next">Next</button>
      </div>
    </div>
    <script>
      const slides = Array.from(document.querySelectorAll(".slide"));
      const counter = document.getElementById("counter");
      let currentIndex = 0;
      function showSlide(index) {
        currentIndex = (index + slides.length) % slides.length;
        slides.forEach((slide, i) => {
          slide.classList.toggle("active", i === currentIndex);
        });
        if (counter) {
          counter.textContent = (currentIndex + 1) + " / " + slides.length;
        }
      }
      document.getElementById("prev").addEventListener("click", () => {
        showSlide(currentIndex - 1);
      });
      document.getElementById("next").addEventListener("click", () => {
        showSlide(currentIndex + 1);
      });
      document.addEventListener("keydown", event => {
        if (event.key === "ArrowRight") showSlide(currentIndex + 1);
        if (event.key === "ArrowLeft") showSlide(currentIndex - 1);
      });
    </script>
  </body>
</html>`;
}

export function SlideViewer({ slides, theme = "dark" }: SlideViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<Direction>(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (currentIndex >= slides.length) {
      setCurrentIndex(0);
      setDirection(0);
    }
  }, [currentIndex, slides.length]);

  const handleNavigation = useCallback(
    (nextIndex: number) => {
      if (slides.length === 0) return;
      const clampedIndex = Math.max(0, Math.min(slides.length - 1, nextIndex));
      if (clampedIndex === currentIndex) return;
      setDirection(clampedIndex > currentIndex ? 1 : -1);
      setCurrentIndex(clampedIndex);
    },
    [currentIndex, slides.length]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const targetTag = target?.tagName?.toLowerCase();
      if (targetTag === "input" || targetTag === "textarea") return;

      if (event.key === "ArrowRight") {
        handleNavigation(currentIndex + 1);
      }
      if (event.key === "ArrowLeft") {
        handleNavigation(currentIndex - 1);
      }
      if (event.key === "Escape" && document.fullscreenElement) {
        document.exitFullscreen();
      }
    },
    [currentIndex, handleNavigation]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  const handleExport = useCallback(() => {
    const html = buildExportHtml(slides);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `presentation-${Date.now()}.html`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, [slides]);

  const handlePptxExport = useCallback(async () => {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const token = typeof window !== "undefined" ? localStorage.getItem("alfie_access_token") : null;
    try {
      const res = await fetch(`${API_BASE}/api/export/pptx`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          slides: slides.map(s => ({ title: s.title, content: s.content })),
          title: slides[0]?.title || "Presentation",
        }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `presentation-${Date.now()}.pptx`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("PPTX export failed:", e);
    }
  }, [slides]);

  const themeClasses =
    theme === "light"
      ? "bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900"
      : "bg-gradient-to-br from-gray-900 via-gray-950 to-gray-950 text-white";

  const slideContentClasses = useMemo(
    () =>
      theme === "light"
        ? "text-slate-900 [&_p]:text-slate-700 [&_li]:text-slate-700"
        : "text-slate-100 [&_p]:text-slate-200 [&_li]:text-slate-200",
    [theme]
  );

  const currentSlide = slides[currentIndex];

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full rounded-xl border border-white/10 shadow-2xl overflow-hidden",
        themeClasses,
        isFullscreen && "fixed inset-0 z-50 rounded-none"
      )}
    >
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 bg-black/30 text-white hover:bg-black/50"
          onClick={handlePptxExport}
          title="Download PPTX"
        >
          <FileSpreadsheet className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 bg-black/30 text-white hover:bg-black/50"
          onClick={handleExport}
          title="Download HTML"
        >
          <Download className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 bg-black/30 text-white hover:bg-black/50"
          onClick={toggleFullscreen}
        >
          {isFullscreen ? (
            <Minimize2 className="w-4 h-4" />
          ) : (
            <Maximize2 className="w-4 h-4" />
          )}
        </Button>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-6xl aspect-video relative">
          <div className="absolute inset-0 rounded-2xl border border-white/10 bg-black/30 backdrop-blur-sm shadow-[0_30px_80px_rgba(0,0,0,0.45)] overflow-hidden">
            <AnimatePresence custom={direction} mode="wait">
              <motion.div
                key={currentIndex}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="absolute inset-0 px-10 py-12 overflow-y-auto"
              >
                {currentSlide?.title && (
                  <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-6">
                    {currentSlide.title}
                  </h1>
                )}
                <MarkdownRenderer
                  content={currentSlide?.content ?? ""}
                  className={cn(
                    "text-base md:text-lg leading-relaxed",
                    slideContentClasses,
                    "[&_h1]:text-3xl [&_h1]:mb-4 [&_h2]:text-2xl [&_h2]:mb-3"
                  )}
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-3">
        <div className="flex items-center gap-2">
          {slides.map((slide, index) => (
            <button
              key={`${slide.title}-${index}`}
              type="button"
              onClick={() => handleNavigation(index)}
              className={cn(
                "h-2.5 w-2.5 rounded-full transition-all",
                index === currentIndex
                  ? "bg-primary shadow-[0_0_10px_rgba(124,92,255,0.6)]"
                  : "bg-white/30 hover:bg-white/60"
              )}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
        <div className="flex items-center gap-3 rounded-full border border-white/10 bg-black/40 px-4 py-2 backdrop-blur">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-white hover:bg-white/10"
            onClick={() => handleNavigation(currentIndex - 1)}
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </Button>
          <span className="text-sm text-white/80 min-w-[64px] text-center">
            {currentIndex + 1} / {slides.length}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-white hover:bg-white/10"
            onClick={() => handleNavigation(currentIndex + 1)}
            disabled={currentIndex === slides.length - 1}
          >
            <ChevronRight className="w-4 h-4" />
            <span>Next</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
