'use client';

import { useEffect, useRef, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { MessageSquare, Sparkles } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';
import { VoiceListeningIndicator, GlobalVoiceIndicator } from '@/components/voice';
import { useChatStore } from '@/lib/store';
import { useWebSocket } from '@/lib/websocket';
import { useMobileContext } from '@/components/shared/MobileProvider';
import { cn } from '@/lib/utils';

export function ChatArea() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { sessions, activeSessionId, isLoading, isStreaming, createSession, addMessage } = useChatStore();
  const { sendMessage } = useWebSocket();
  const { isMobile } = useMobileContext();

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const messages = activeSession?.messages || [];
  const messageCount = messages.length;
  const lastMessageId = messages[messages.length - 1]?.id;
  
  const lastAssistantMessageIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return i;
    }
    return -1;
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messageCount, lastMessageId, isStreaming]);

  const handleSend = (content: string) => {
    if (!activeSessionId) {
      createSession();
    }
    addMessage({ role: 'user', content });
    sendMessage(content);
  };

  if (!activeSession) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="flex-1 flex items-center justify-center px-4">
          <EmptyState onNewChat={() => createSession()} isMobile={isMobile} />
        </div>
        <ChatInput onSend={handleSend} isLoading={isLoading} />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden" data-tutorial="chat-area">
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className={cn(
          'mx-auto py-4 md:py-6 px-3 md:px-4',
          isMobile ? 'max-w-full' : 'max-w-4xl'
        )}>
          {messages.length === 0 ? (
            <EmptyState onNewChat={() => {}} showButton={false} isMobile={isMobile} />
          ) : (
            <AnimatePresence mode="popLayout">
              {messages.map((message, index) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isStreaming={isStreaming && index === messages.length - 1 && message.role === 'assistant'}
                  isLatestAssistantMessage={index === lastAssistantMessageIndex}
                />
              ))}
            </AnimatePresence>
          )}
          {isLoading && !isStreaming && <TypingIndicator />}
        </div>
      </ScrollArea>
      <VoiceListeningIndicator />
      <ChatInput onSend={handleSend} isLoading={isLoading} />
      <GlobalVoiceIndicator />
    </div>
  );
}

interface EmptyStateProps {
  onNewChat: () => void;
  showButton?: boolean;
  isMobile?: boolean;
}

function EmptyState({ onNewChat, showButton = true, isMobile = false }: EmptyStateProps) {
  const t = useTranslations('chat');
  const tSuggestions = useTranslations('suggestions');

  const suggestions = [
    {
      icon: MessageSquare,
      title: tSuggestions('codeGeneration'),
      description: tSuggestions('codeGenerationDesc'),
    },
    {
      icon: Sparkles,
      title: tSuggestions('problemSolving'),
      description: tSuggestions('problemSolvingDesc'),
    },
    {
      icon: MessageSquare,
      title: tSuggestions('fileOperations'),
      description: tSuggestions('fileOperationsDesc'),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className={cn(
        'text-center space-y-4 md:space-y-6 py-8 md:py-12',
        isMobile && 'px-4'
      )}
    >
      <motion.div
        animate={{
          boxShadow: [
            '0 0 20px hsl(262 83% 58% / 0.2)',
            '0 0 40px hsl(262 83% 58% / 0.4)',
            '0 0 20px hsl(262 83% 58% / 0.2)',
          ],
        }}
        transition={{ duration: 2, repeat: Infinity }}
        className={cn(
          'mx-auto rounded-3xl bg-gradient-to-br from-primary via-accent to-primary flex items-center justify-center',
          isMobile ? 'w-16 h-16' : 'w-24 h-24'
        )}
      >
        <Sparkles className={cn(isMobile ? 'w-8 h-8' : 'w-12 h-12', 'text-white')} />
      </motion.div>

      <div className="space-y-2">
        <h2 className={cn(
          'font-bold gradient-text',
          isMobile ? 'text-2xl' : 'text-3xl'
        )}>{t('welcomeTitle')}</h2>
        <p className={cn(
          'text-muted-foreground mx-auto',
          isMobile ? 'text-sm max-w-xs' : 'max-w-md'
        )}>
          {isMobile ? t('welcomeDescription') : t('welcomeDescriptionFull')}
        </p>
      </div>

      <div className={cn(
        'grid gap-3 md:gap-4 mx-auto mt-6 md:mt-8',
        isMobile ? 'grid-cols-1 max-w-xs' : 'grid-cols-1 md:grid-cols-3 max-w-2xl'
      )}>
        {suggestions.map((suggestion, idx) => (
          <motion.button
            key={suggestion.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + idx * 0.1 }}
            whileHover={!isMobile ? { scale: 1.02, y: -3 } : undefined}
            whileTap={{ scale: 0.98 }}
            onClick={onNewChat}
            className={cn(
              'p-3 md:p-4 rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm hover:bg-card/90 hover:border-primary/40 hover:shadow-[0_4px_20px_hsl(var(--primary)/0.1)] transition-all duration-200 text-left group',
              isMobile && 'min-h-[44px] active:bg-card/80'
            )}
          >
            <suggestion.icon className="w-5 h-5 md:w-6 md:h-6 text-primary mb-1 md:mb-2 group-hover:scale-110 transition-transform" />
            <h3 className="font-medium text-sm">{suggestion.title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5 md:mt-1">{suggestion.description}</p>
          </motion.button>
        ))}
      </div>

      {showButton && !isMobile && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          onClick={onNewChat}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-white font-medium hover:opacity-90 transition-opacity glow-primary"
        >
          <MessageSquare className="w-5 h-5" />
          {t('startNewChat')}
        </motion.button>
      )}
    </motion.div>
  );
}
