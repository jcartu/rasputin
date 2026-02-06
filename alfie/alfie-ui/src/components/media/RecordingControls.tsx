'use client';

import { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Pause,
  Play,
  Square,
  Mic,
  MicOff,
  GripHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useMediaStore, formatDuration } from '@/lib/mediaStore';
import { cn } from '@/lib/utils';

export function RecordingControls() {
  const {
    recording,
    showFloatingControls,
    pauseRecording,
    resumeRecording,
    stopRecording,
    incrementDuration,
    setRecordingState,
  } = useMediaStore();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (recording.isRecording && !recording.isPaused) {
      intervalRef.current = setInterval(() => {
        incrementDuration();
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [recording.isRecording, recording.isPaused, incrementDuration]);

  const handlePause = useCallback(() => {
    if (recording.mediaRecorder?.state === 'recording') {
      recording.mediaRecorder.pause();
      pauseRecording();
    }
  }, [recording.mediaRecorder, pauseRecording]);

  const handleResume = useCallback(() => {
    if (recording.mediaRecorder?.state === 'paused') {
      recording.mediaRecorder.resume();
      resumeRecording();
    }
  }, [recording.mediaRecorder, resumeRecording]);

  const handleStop = useCallback(() => {
    if (recording.mediaRecorder && recording.mediaRecorder.state !== 'inactive') {
      recording.mediaRecorder.stop();
    }
    if (recording.stream) {
      recording.stream.getTracks().forEach((track) => track.stop());
    }
    stopRecording();
  }, [recording.mediaRecorder, recording.stream, stopRecording]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!controlsRef.current) return;
    isDragging.current = true;
    const rect = controlsRef.current.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !controlsRef.current) return;
    
    const x = e.clientX - dragOffset.current.x;
    const y = e.clientY - dragOffset.current.y;
    
    const maxX = window.innerWidth - controlsRef.current.offsetWidth;
    const maxY = window.innerHeight - controlsRef.current.offsetHeight;
    
    controlsRef.current.style.left = `${Math.max(0, Math.min(x, maxX))}px`;
    controlsRef.current.style.top = `${Math.max(0, Math.min(y, maxY))}px`;
    controlsRef.current.style.right = 'auto';
    controlsRef.current.style.bottom = 'auto';
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <AnimatePresence>
      {showFloatingControls && recording.isRecording && (
        <TooltipProvider>
          <motion.div
            ref={controlsRef}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-[9999] flex items-center gap-2 px-3 py-2 rounded-full bg-card/95 backdrop-blur-xl border border-border shadow-2xl"
            style={{ cursor: 'default' }}
          >
            <div
              className="cursor-grab active:cursor-grabbing p-1 -ml-1 rounded hover:bg-muted/50"
              onMouseDown={handleMouseDown}
            >
              <GripHorizontal className="w-4 h-4 text-muted-foreground" />
            </div>

            <div className="flex items-center gap-2">
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className={cn(
                  'w-3 h-3 rounded-full',
                  recording.isPaused ? 'bg-amber-500' : 'bg-red-500'
                )}
              />
              <span className="text-sm font-mono font-medium min-w-[60px]">
                {formatDuration(recording.duration)}
              </span>
            </div>

            <div className="w-px h-6 bg-border" />

            <div className="flex items-center gap-1">
              {recording.hasAudio ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="p-1.5 rounded-full bg-primary/10">
                      <Mic className="w-4 h-4 text-primary" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Microphone enabled</TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="p-1.5 rounded-full bg-muted">
                      <MicOff className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Microphone disabled</TooltipContent>
                </Tooltip>
              )}
            </div>

            <div className="w-px h-6 bg-border" />

            <div className="flex items-center gap-1">
              {recording.isPaused ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8 rounded-full hover:bg-primary/10 hover:text-primary"
                      onClick={handleResume}
                    >
                      <Play className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Resume</TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8 rounded-full hover:bg-amber-500/10 hover:text-amber-500"
                      onClick={handlePause}
                    >
                      <Pause className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Pause</TooltipContent>
                </Tooltip>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 rounded-full bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white"
                    onClick={handleStop}
                  >
                    <Square className="w-4 h-4 fill-current" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Stop recording</TooltipContent>
              </Tooltip>
            </div>
          </motion.div>
        </TooltipProvider>
      )}
    </AnimatePresence>
  );
}
