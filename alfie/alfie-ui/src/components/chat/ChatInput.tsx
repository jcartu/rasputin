'use client';

import { useState, useRef, useEffect, KeyboardEvent, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Send, Paperclip, StopCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { VoiceInput } from '@/components/voice';
import { useMobileContext } from '@/components/shared/MobileProvider';

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function ChatInput({ onSend, isLoading, disabled }: ChatInputProps) {
  const t = useTranslations('chat');
  const [message, setMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { isMobile } = useMobileContext();

  const adjustTextareaHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const maxHeight = isMobile ? 120 : 200;
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, maxHeight)}px`;
    }
  }, [isMobile]);

  useEffect(() => {
    adjustTextareaHeight();
  }, [message, adjustTextareaHeight]);

  useEffect(() => {
    if (isMobile && isFocused) {
      const timeout = setTimeout(() => {
        textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [isMobile, isFocused]);

  const handleSend = useCallback(() => {
    if (message.trim() && !isLoading && !disabled) {
      onSend(message.trim());
      setMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      if (isMobile) {
        textareaRef.current?.blur();
      }
    }
  }, [message, isLoading, disabled, onSend, isMobile]);

  const handleVoiceTranscript = useCallback((transcript: string) => {
    setMessage((prev) => prev + (prev ? ' ' : '') + transcript);
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <TooltipProvider>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'p-3 md:p-4 border-t border-border/50 bg-gradient-to-t from-card/90 via-card/80 to-card/70 backdrop-blur-xl shadow-[0_-1px_30px_hsl(var(--foreground)/0.03)]',
          isMobile && 'safe-area-bottom'
        )}
      >
        <div className={cn('mx-auto', isMobile ? 'max-w-full' : 'max-w-4xl')}>
          <div 
            className={cn(
              'relative flex items-end gap-1 md:gap-2 p-2 rounded-2xl border border-border/60 bg-background/60 backdrop-blur-md transition-all duration-200 shadow-sm',
              'focus-within:ring-2 focus-within:ring-primary/40 focus-within:border-primary/40 focus-within:bg-background/80 focus-within:shadow-[0_0_20px_hsl(var(--primary)/0.1)]',
              isFocused && isMobile && 'ring-2 ring-primary/40 border-primary/40 bg-background/80 shadow-[0_0_20px_hsl(var(--primary)/0.1)]'
            )}
            data-tutorial="chat-input"
          >
            {!isMobile && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="flex-shrink-0 rounded-xl text-muted-foreground hover:text-foreground"
                    disabled={disabled}
                  >
                    <Paperclip className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('attachFiles')}</TooltipContent>
              </Tooltip>
            )}

            <Textarea
              id="chat-input"
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={isMobile ? t('messagePlaceholderShort') : t('messagePlaceholder')}
              aria-label="Chat message input"
              aria-describedby="chat-input-hint"
              className={cn(
                'flex-1 min-h-[44px] resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0',
                isMobile ? 'text-base max-h-[120px]' : 'text-base max-h-[200px]'
              )}
              disabled={disabled || isLoading}
              rows={1}
            />

            <div className="flex items-center gap-1">
              {isMobile && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex-shrink-0 rounded-xl text-muted-foreground hover:text-foreground min-w-[44px] min-h-[44px]"
                  disabled={disabled}
                >
                  <Paperclip className="w-5 h-5" />
                </Button>
              )}

              <VoiceInput 
                onTranscript={handleVoiceTranscript} 
                disabled={disabled || isLoading}
                data-tutorial="voice-input"
              />

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleSend}
                    disabled={!message.trim() || isLoading || disabled}
                    size="icon"
                    className={cn(
                      'flex-shrink-0 rounded-xl transition-all',
                      isMobile && 'min-w-[44px] min-h-[44px]',
                      message.trim()
                        ? 'bg-gradient-to-r from-primary to-accent hover:opacity-90 glow-primary'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {isLoading ? (
                      <StopCircle className="w-5 h-5" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{isLoading ? t('stop') : t('sendMessage')}</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {!isMobile && (
            <div id="chat-input-hint" className="flex items-center justify-center mt-2 text-xs text-muted-foreground/60">
              <span>{t('enterToSend')}</span>
              <kbd className="mx-1 px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">{t('enterKey')}</kbd>
              <span>{t('toSend')}</span>
              <kbd className="mx-1 px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">{t('shiftEnter')}</kbd>
              <span>{t('forNewLine')}</span>
            </div>
          )}
          {isMobile && <div id="chat-input-hint" className="sr-only">Type your message and tap send</div>}
        </div>
      </motion.div>
    </TooltipProvider>
  );
}
