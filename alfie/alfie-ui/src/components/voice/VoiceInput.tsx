'use client';

import { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useVoiceStore } from '@/lib/store';

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  className?: string;
  'data-tutorial'?: string;
}

export function VoiceInput({ onTranscript, disabled, className, 'data-tutorial': dataTutorial }: VoiceInputProps) {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const { isListening, setIsListening, setTranscript, voiceEnabled } = useVoiceStore();

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, [setIsListening]);

  const startListening = useCallback(() => {
    if (!voiceEnabled || disabled) return;

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognitionAPI) {
      console.error('Speech recognition not supported');
      return;
    }

    recognitionRef.current = new SpeechRecognitionAPI();
    const recognition = recognitionRef.current;

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      setTranscript(interimTranscript || finalTranscript);

      if (finalTranscript) {
        onTranscript(finalTranscript);
        stopListening();
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      setTranscript('');
    };

    recognition.start();
  }, [voiceEnabled, disabled, setIsListening, setTranscript, onTranscript, stopListening]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const isSpeechSupported = typeof window !== 'undefined' && 
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  if (!isSpeechSupported || !voiceEnabled) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleListening}
          disabled={disabled}
          className={cn(
            'flex-shrink-0 rounded-xl transition-all relative',
            isListening 
              ? 'text-primary bg-primary/10 hover:bg-primary/20' 
              : 'text-muted-foreground hover:text-foreground',
            className
          )}
          data-tutorial={dataTutorial}
        >
          <AnimatePresence mode="wait">
            {isListening ? (
              <motion.div
                key="listening"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="relative"
              >
                <Radio className="w-5 h-5 text-primary" />
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-primary"
                  animate={{
                    scale: [1, 1.5, 1],
                    opacity: [1, 0, 1],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-primary"
                  animate={{
                    scale: [1, 2, 1],
                    opacity: [0.5, 0, 0.5],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: 0.3,
                  }}
                />
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <Mic className="w-5 h-5" />
              </motion.div>
            )}
          </AnimatePresence>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {isListening ? 'Stop listening' : 'Voice input (JARVIS mode)'}
      </TooltipContent>
    </Tooltip>
  );
}

export function VoiceListeningIndicator() {
  const { isListening, transcript } = useVoiceStore();

  return (
    <AnimatePresence>
      {isListening && (
        <motion.div
          initial={{ opacity: 0, y: 20, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: 20, height: 0 }}
          className="px-4 pb-2"
        >
          <div className="max-w-4xl mx-auto">
            <motion.div
              className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20"
              animate={{
                boxShadow: [
                  '0 0 0 0 hsl(var(--primary) / 0)',
                  '0 0 20px 5px hsl(var(--primary) / 0.1)',
                  '0 0 0 0 hsl(var(--primary) / 0)',
                ],
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <motion.div
                className="flex gap-1"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
              >
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1 h-4 rounded-full bg-primary"
                    animate={{
                      scaleY: [1, 2, 1],
                    }}
                    transition={{
                      duration: 0.5,
                      repeat: Infinity,
                      delay: i * 0.1,
                    }}
                  />
                ))}
              </motion.div>
              <span className="text-sm text-primary font-medium">
                {transcript || 'Listening...'}
              </span>
              <span className="ml-auto text-xs text-muted-foreground">
                Speak now, Sir
              </span>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
