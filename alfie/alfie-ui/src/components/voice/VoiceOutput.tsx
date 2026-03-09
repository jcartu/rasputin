'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, Pause, Play, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useVoiceStore } from '@/lib/store';

interface VoiceOutputProps {
  text: string;
  messageId: string;
  autoPlay?: boolean;
  className?: string;
}

export function VoiceOutput({ text, messageId, autoPlay: autoPlayProp, className }: VoiceOutputProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const isLoadingRef = useRef(false);
  const retryCountRef = useRef(0);
  const hasAutoPlayAttempted = useRef(false);
  const playRef = useRef<() => Promise<void>>(async () => {});
  
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLocalPlaying, setIsLocalPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  
  const { 
    selectedVoiceId, 
    speed, 
    autoPlay: globalAutoPlay, 
    voiceEnabled,
    isPlaying: globalIsPlaying,
    setIsPlaying: setGlobalIsPlaying,
  } = useVoiceStore();

  const shouldAutoPlay = autoPlayProp ?? globalAutoPlay;

  const generateSpeech = useCallback(async () => {
    if (!voiceEnabled || !text || isLoadingRef.current) return null;

    const MAX_RETRIES = 2;
    if (retryCountRef.current >= MAX_RETRIES) {
      setHasFailed(true);
      return null;
    }

    isLoadingRef.current = true;
    setIsLoading(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const token = typeof window !== 'undefined' ? localStorage.getItem('alfie_access_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const response = await fetch(`${apiBase}/api/tts`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          text: text.slice(0, 5000),
          voiceId: selectedVoiceId,
          speed,
        }),
      });

      if (!response.ok) {
        retryCountRef.current += 1;
        throw new Error('TTS request failed');
      }

      retryCountRef.current = 0;
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      return url;
    } catch (error) {
      console.error('Failed to generate speech:', error);
      if (retryCountRef.current >= MAX_RETRIES) {
        setHasFailed(true);
      }
      return null;
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, [text, selectedVoiceId, speed, voiceEnabled]);

  const play = useCallback(async () => {
    if (!audioRef.current) return;

    let url = audioUrl;
    if (!url) {
      url = await generateSpeech();
      if (!url) return;
    }

    audioRef.current.src = url;
    audioRef.current.playbackRate = speed;
    
    try {
      await audioRef.current.play();
      setIsLocalPlaying(true);
      setGlobalIsPlaying(true);
      setHasPlayed(true);
    } catch (error) {
      console.error('Failed to play audio:', error);
    }
  }, [audioUrl, generateSpeech, speed, setGlobalIsPlaying]);

  // Keep playRef in sync with play function
  useEffect(() => {
    playRef.current = play;
  }, [play]);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsLocalPlaying(false);
      setGlobalIsPlaying(false);
    }
  }, [setGlobalIsPlaying]);

  const replay = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      play();
    }
  }, [play]);

  const togglePlayPause = useCallback(() => {
    if (isLocalPlaying) {
      pause();
    } else {
      play();
    }
  }, [isLocalPlaying, play, pause]);

  useEffect(() => {
    if (shouldAutoPlay && voiceEnabled && !hasAutoPlayAttempted.current && !hasFailed && text) {
      hasAutoPlayAttempted.current = true;
      const timer = setTimeout(() => playRef.current(), 500);
      return () => clearTimeout(timer);
    }
  }, [shouldAutoPlay, voiceEnabled, hasFailed, text]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    const handleEnded = () => {
      setIsLocalPlaying(false);
      setGlobalIsPlaying(false);
      setProgress(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [setGlobalIsPlaying]);

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  if (!voiceEnabled) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg',
        'bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/10',
        className
      )}
    >
      <audio ref={audioRef}>
        <track kind="captions" />
      </audio>
      
      <Button
        variant="ghost"
        size="icon"
        onClick={togglePlayPause}
        disabled={isLoading}
        className="h-7 w-7 rounded-md"
      >
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin"
            />
          ) : isLocalPlaying ? (
            <motion.div
              key="pause"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            >
              <Pause className="w-4 h-4 text-primary" />
            </motion.div>
          ) : (
            <motion.div
              key="play"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            >
              <Play className="w-4 h-4 text-primary" />
            </motion.div>
          )}
        </AnimatePresence>
      </Button>

      <div className="relative w-20 h-1 bg-muted rounded-full overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-accent rounded-full"
          style={{ width: `${progress}%` }}
        />
        {isLocalPlaying && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-primary/50 to-accent/50"
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}
      </div>

      {hasPlayed && (
        <Button
          variant="ghost"
          size="icon"
          onClick={replay}
          className="h-7 w-7 rounded-md"
        >
          <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
        </Button>
      )}
    </motion.div>
  );
}

export function GlobalVoiceIndicator() {
  const { isPlaying, voiceEnabled } = useVoiceStore();

  if (!voiceEnabled) return null;

  return (
    <AnimatePresence>
      {isPlaying && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="fixed bottom-24 right-6 z-50"
        >
          <motion.div
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-card/90 backdrop-blur-xl border border-primary/30 shadow-lg"
            animate={{
              boxShadow: [
                '0 0 20px 0 hsl(var(--primary) / 0.2)',
                '0 0 40px 5px hsl(var(--primary) / 0.3)',
                '0 0 20px 0 hsl(var(--primary) / 0.2)',
              ],
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            >
              <Volume2 className="w-4 h-4 text-primary" />
            </motion.div>
            <span className="text-sm font-medium text-primary">ALFIE Speaking</span>
            <div className="flex gap-0.5">
              {[0, 1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  className="w-0.5 h-3 rounded-full bg-primary"
                  animate={{ scaleY: [0.3, 1, 0.3] }}
                  transition={{
                    duration: 0.4,
                    repeat: Infinity,
                    delay: i * 0.1,
                  }}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
