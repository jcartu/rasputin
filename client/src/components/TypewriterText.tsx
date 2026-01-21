import { useState, useEffect, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import { Streamdown } from "streamdown";

interface TypewriterTextProps {
  content: string;
  isStreaming: boolean;
  charsPerFrame?: number;
  className?: string;
}

export function TypewriterText({
  content,
  isStreaming,
  charsPerFrame = 3,
  className,
}: TypewriterTextProps) {
  const [displayedLength, setDisplayedLength] = useState(0);
  const animationRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const targetLengthRef = useRef<number>(0);

  targetLengthRef.current = content.length;

  useEffect(() => {
    if (!isStreaming) {
      setDisplayedLength(content.length);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    const animate = (timestamp: number) => {
      const FRAME_INTERVAL_MS = 16;
      if (timestamp - lastUpdateRef.current >= FRAME_INTERVAL_MS) {
        lastUpdateRef.current = timestamp;

        setDisplayedLength(prev => {
          const target = targetLengthRef.current;
          if (prev >= target) {
            return prev;
          }
          const distance = target - prev;
          const catchUpSpeed = Math.min(
            charsPerFrame + Math.floor(distance / 20),
            10
          );
          return Math.min(prev + catchUpSpeed, target);
        });
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isStreaming, charsPerFrame, content.length]);

  const displayedContent = useMemo(() => {
    if (!isStreaming || displayedLength >= content.length) {
      return content;
    }
    return content.slice(0, displayedLength);
  }, [content, displayedLength, isStreaming]);

  const showCursor = isStreaming && displayedLength < content.length;

  return (
    <div className={className}>
      <div className="prose prose-invert prose-lg max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-p:leading-relaxed prose-pre:bg-muted/50 prose-pre:border prose-pre:border-border/50">
        <Streamdown>{displayedContent}</Streamdown>
      </div>
      {showCursor && (
        <motion.span
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
          className="inline-block w-2 h-5 bg-cyan-400 ml-0.5 align-middle"
        />
      )}
    </div>
  );
}

export function StreamingMarkdown({
  content,
  isStreaming,
  className,
}: {
  content: string;
  isStreaming: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="prose prose-invert prose-lg max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-p:leading-relaxed prose-pre:bg-muted/50 prose-pre:border prose-pre:border-border/50">
        <Streamdown>{content}</Streamdown>
      </div>
      {isStreaming && (
        <motion.span
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
          className="inline-block w-2 h-5 bg-cyan-400 ml-0.5 align-middle"
        />
      )}
    </div>
  );
}
