'use client';

import { useEffect, useRef, useMemo, useCallback, useState, type DragEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';
import { VoiceListeningIndicator, GlobalVoiceIndicator } from '@/components/voice';
import { ActivityMonitor } from '@/components/activity';
import { AgentProgress } from '@/components/agent/AgentProgress';
import { AgentThinking } from '@/components/agent/AgentThinking';
import { AgentToolCall } from '@/components/agent/AgentToolCall';
import { WelcomeScreen } from '@/components/shared/WelcomeScreen';
import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer';
import { useChatStore } from '@/lib/store';
import { useWebSocket } from '@/lib/websocket';
import { useArtifactStore, extractArtifacts } from '@/lib/artifactStore';
import { useAgentStore, type AgentStep } from '@/lib/agentStore';
import { useAuthStore } from '@/lib/authStore';
import { useMobileContext } from '@/components/shared/MobileProvider';
import { cn } from '@/lib/utils';

export function ChatArea() {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);

  const sessions = useChatStore((s) => s.sessions);
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const isLoading = useChatStore((s) => s.isLoading);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const createSession = useChatStore((s) => s.createSession);
  const addMessage = useChatStore((s) => s.addMessage);
  const { sendMessage } = useWebSocket();
  const { isMobile } = useMobileContext();

  const user = useAuthStore((s) => s.user);
  const addArtifact = useArtifactStore((s) => s.addArtifact);
  const activeTask = useAgentStore((s) => s.activeTask);

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const messages = activeSession?.messages || [];

  const lastAssistantMessageIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return i;
    }
    return -1;
  }, [messages]);

  const lastMessageContent = messages.length > 0 ? messages[messages.length - 1]?.content : '';

  useEffect(() => {
    const el = scrollAreaRef.current;
    if (!el) return;
    const viewport = el.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
    if (viewport) {
      scrollContainerRef.current = viewport;
    }
  }, []);

  const prevSessionRef = useRef(activeSessionId);
  if (prevSessionRef.current !== activeSessionId) {
    prevSessionRef.current = activeSessionId;
    setUserScrolledUp(false);
  }

  const rafRef = useRef<number>(0);
  const isAnimatingRef = useRef(false);
  const isProgrammaticScrollRef = useRef(false);
  const lastScrollTopRef = useRef(0);
  const LERP_FACTOR = 0.14;

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    if (userScrolledUp || !isStreaming) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      isAnimatingRef.current = false;

      if (!isStreaming && !userScrolledUp) {
        const target = container.scrollHeight - container.clientHeight;
        if (target - container.scrollTop > 1) {
          isProgrammaticScrollRef.current = true;
          container.scrollTop = target;
        }
      }
      return;
    }

    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;

    const animate = () => {
      if (!isAnimatingRef.current) return;
      const c = scrollContainerRef.current;
      if (!c) { isAnimatingRef.current = false; return; }

      const target = c.scrollHeight - c.clientHeight;
      const diff = target - c.scrollTop;
      if (Math.abs(diff) > 0.5) {
        isProgrammaticScrollRef.current = true;
        c.scrollTop += diff * LERP_FACTOR;
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      isAnimatingRef.current = false;
    };
  }, [isStreaming, userScrolledUp]);

  const prevContentLenRef = useRef(0);
  const prevSessionForScrollRef = useRef(activeSessionId);
  const currentContentLen = lastMessageContent?.length ?? 0;
  const contentChanged = prevContentLenRef.current !== currentContentLen;
  const sessionChanged = prevSessionForScrollRef.current !== activeSessionId;
  prevContentLenRef.current = currentContentLen;
  prevSessionForScrollRef.current = activeSessionId;

  useEffect(() => {
    if (!contentChanged && !sessionChanged) return;
    if (userScrolledUp || isStreaming) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    isProgrammaticScrollRef.current = true;
    container.scrollTop = container.scrollHeight - container.clientHeight;
  }, [contentChanged, sessionChanged, userScrolledUp, isStreaming]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (isProgrammaticScrollRef.current) {
        isProgrammaticScrollRef.current = false;
        lastScrollTopRef.current = container.scrollTop;
        return;
      }

      const scrolledUp = container.scrollTop < lastScrollTopRef.current - 5;
      lastScrollTopRef.current = container.scrollTop;

      if (scrolledUp) {
        setUserScrolledUp(true);
        return;
      }

      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      if (distanceFromBottom < 30) {
        setUserScrolledUp(false);
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSend = useCallback((content: string, files?: { id?: string; name: string }[]) => {
    if (!activeSessionId) {
      createSession();
    }
    const fileIds = files?.map(f => f.id).filter((id): id is string => Boolean(id)) ?? [];
    const displayContent = fileIds.length > 0
      ? `${content}\n\n📎 ${files!.map(f => f.name).join(', ')}`
      : content;
    addMessage({ role: 'user', content: displayContent });
    sendMessage(content, fileIds.length > 0 ? fileIds : undefined);
    setUserScrolledUp(false);
  }, [activeSessionId, createSession, addMessage, sendMessage]);

  const handleRegenerate = useCallback(() => {
    if (!activeSession) return;
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMsg) {
      sendMessage(lastUserMsg.content);
    }
  }, [activeSession, messages, sendMessage]);

  const handleEditResubmit = useCallback((content: string) => {
    addMessage({ role: 'user', content });
    sendMessage(content);
    setUserScrolledUp(false);
  }, [addMessage, sendMessage]);

  useEffect(() => {
    if (!activeSessionId) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === 'assistant' && lastMsg.content && !isStreaming) {
      const artifacts = extractArtifacts(lastMsg.content, lastMsg.id, activeSessionId);
      for (const a of artifacts) {
        addArtifact(a);
      }
    }
  }, [isStreaming, messages, activeSessionId, addArtifact]);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      setDroppedFiles(files);
    }
  }, []);

  if (!activeSession) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="flex-1 flex items-center justify-center px-4">
          <WelcomeScreen
            onPromptSelect={handleSend}
            username={user?.username}
          />
        </div>
        <ChatInput onSend={handleSend} isLoading={isLoading} incomingFiles={droppedFiles} onIncomingFilesHandled={() => setDroppedFiles([])} />
      </div>
    );
  }

  return (
    <section
      className={cn(
        'flex-1 flex flex-col overflow-hidden',
        isDragging && 'ring-2 ring-primary/50 ring-inset bg-primary/5'
      )}
      aria-label="Chat area"
      data-tutorial="chat-area"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <ScrollArea className="flex-1" ref={scrollAreaRef}>
        <div className={cn(
          'mx-auto py-4 md:py-6 px-3 md:px-4',
          isMobile ? 'max-w-full' : 'max-w-4xl'
        )}>
          {messages.length === 0 ? (
            <WelcomeScreen
              onPromptSelect={handleSend}
              username={user?.username}
            />
          ) : (
            <AnimatePresence mode="popLayout">
              {messages.map((message, index) => {
                const isLastAssistant = index === lastAssistantMessageIndex;
                return (
                  <div key={message.id}>
                    <MessageBubble
                      message={message}
                      isStreaming={isStreaming && index === messages.length - 1 && message.role === 'assistant'}
                      isLatestAssistantMessage={isLastAssistant}
                      onRegenerate={isLastAssistant ? handleRegenerate : undefined}
                      onEditResubmit={message.role === 'user' ? handleEditResubmit : undefined}
                    />
                    {message.role === 'assistant' && activeTask && activeTask.steps.length > 0 && isLastAssistant && (
                      <div className="ml-13 space-y-2 mb-4">
                        {activeTask.steps.map((step: AgentStep) => {
                          const stepKey = `${step.type}-${step.iteration}-${step.tool || 'none'}`;
                          if (step.type === 'thinking') {
                            return (
                              <AgentThinking
                                key={stepKey}
                                content={step.thinking || ''}
                                iteration={step.iteration}
                                isActive={false}
                              />
                            );
                          }
                          if (step.type === 'tool_call' || step.type === 'tool_result') {
                            return (
                              <AgentToolCall
                                key={stepKey}
                                tool={step.tool || ''}
                                input={step.input}
                                output={step.output}
                                success={step.success}
                                isRunning={step.type === 'tool_call'}
                              />
                            );
                          }
                          return null;
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </AnimatePresence>
          )}
          {isLoading && !isStreaming && <TypingIndicator />}
          <ActivityMonitor />
          {activeTask && <AgentProgress />}
          <div ref={bottomRef} className="h-1" />
        </div>
      </ScrollArea>
      <VoiceListeningIndicator />
      <ChatInput onSend={handleSend} isLoading={isLoading} incomingFiles={droppedFiles} onIncomingFilesHandled={() => setDroppedFiles([])} />
      <GlobalVoiceIndicator />
    </section>
  );
}
