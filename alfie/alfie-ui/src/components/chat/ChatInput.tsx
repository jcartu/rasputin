'use client';

import {
  useState,
  useRef,
  useEffect,
  KeyboardEvent,
  useCallback,
  ChangeEvent,
} from 'react';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Bot, Loader2, Paperclip, Send, StopCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { VoiceInput } from '@/components/voice';
import { useMobileContext } from '@/components/shared/MobileProvider';
import { notifyError } from '@/lib/notificationStore';
import { useUIStore } from '@/lib/store';

interface ChatInputProps {
  onSend: (message: string, files?: AttachedFile[]) => void;
  isLoading?: boolean;
  disabled?: boolean;
  incomingFiles?: File[];
  onIncomingFilesHandled?: () => void;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_FILES = 5;
const SUPPORTED_EXTENSIONS = [
  '.txt',
  '.md',
  '.markdown',
  '.json',
  '.csv',
  '.tsv',
  '.py',
  '.js',
  '.ts',
  '.jsx',
  '.tsx',
  '.html',
  '.css',
  '.scss',
  '.sql',
  '.yaml',
  '.yml',
  '.xml',
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
];

const FILE_ACCEPT = ['text/*', 'application/pdf', 'image/*', ...SUPPORTED_EXTENSIONS].join(',');

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type AttachedFile = {
  localId: string;
  id?: string;
  name: string;
  mimeType: string;
  extractedText?: string;
  status: 'uploading' | 'ready' | 'error';
};

const getFileExtension = (fileName: string) => {
  const lastDotIndex = fileName.lastIndexOf('.');
  if (lastDotIndex === -1) return '';
  return fileName.slice(lastDotIndex).toLowerCase();
};

const createLocalId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const isSupportedFile = (file: File) => {
  const extension = getFileExtension(file.name);
  if (SUPPORTED_EXTENSIONS.includes(extension)) return true;
  if (file.type.startsWith('text/')) return true;
  if (file.type === 'application/pdf') return true;
  if (file.type === 'application/json') return true;
  if (file.type.startsWith('image/')) return true;
  return false;
};

export function ChatInput({
  onSend,
  isLoading,
  disabled,
  incomingFiles,
  onIncomingFilesHandled,
}: ChatInputProps) {
  const t = useTranslations('chat');
  const [message, setMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isMobile } = useMobileContext();
  const pendingInput = useUIStore((state) => state.pendingInput);
  const setPendingInput = useUIStore((state) => state.setPendingInput);
  const agentMode = useUIStore((state) => state.agentMode);
  const toggleAgentMode = useUIStore((state) => state.toggleAgentMode);

  const adjustTextareaHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const maxHeight = isMobile ? 120 : 200;
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, maxHeight)}px`;
    }
  }, [isMobile]);

  useEffect(() => {
    if (message.length >= 0) {
      adjustTextareaHeight();
    }
  }, [message, adjustTextareaHeight]);

  useEffect(() => {
    if (pendingInput) {
      setMessage(pendingInput);
      setPendingInput(null);
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    }
  }, [pendingInput, setPendingInput]);

  useEffect(() => {
    if (isMobile && isFocused) {
      const timeout = setTimeout(() => {
        textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [isMobile, isFocused]);

  const uploadFile = useCallback(async (file: File, localId: string) => {
    try {
      const formData = new FormData();
      formData.append('files', file);

      const token = typeof window !== 'undefined' ? localStorage.getItem('alfie_access_token') : null;
      const response = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        body: formData,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        let message = 'Upload failed.';
        try {
          const errorData = await response.json();
          message = errorData.error || message;
        } catch {}
        throw new Error(message);
      }

      const data = await response.json();
      const uploaded = Array.isArray(data.files) ? data.files[0] : data;
      if (!uploaded?.id) {
        throw new Error('Upload failed.');
      }

      const readyStatus: AttachedFile['status'] = 'ready';
      setAttachedFiles((prev) => {
        const updated: AttachedFile[] = prev.map((item) =>
          item.localId === localId
            ? {
                ...item,
                id: uploaded.id,
                name: uploaded.originalName || item.name,
                mimeType: uploaded.mimeType || item.mimeType,
                extractedText: uploaded.extractedTextPreview || uploaded.extractedText || '',
                status: readyStatus,
              }
            : item
        );
        return updated;
      });
    } catch (error) {
      const errorStatus: AttachedFile['status'] = 'error';
      setAttachedFiles((prev) => {
        const updated: AttachedFile[] = prev.map((item) =>
          item.localId === localId
            ? { ...item, status: errorStatus }
            : item
        );
        return updated;
      });
      notifyError('Upload failed', `${file.name} could not be uploaded.`);
    }
  }, []);

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      const availableSlots = MAX_FILES - attachedFiles.length;
      if (availableSlots <= 0) {
        notifyError(
          'Attachment limit reached',
          `You can attach up to ${MAX_FILES} files.`
        );
        return;
      }

      const filesToProcess = files.slice(0, availableSlots);
      if (files.length > availableSlots) {
        notifyError(
          'Too many files',
          `Only ${availableSlots} more file(s) can be attached.`
        );
      }

      const uploads = filesToProcess
        .map((file) => ({ file, localId: createLocalId() }))
        .filter(({ file }) => {
          if (!isSupportedFile(file)) {
            notifyError(
              'Unsupported file type',
              `${file.name} is not a supported file.`
            );
            return false;
          }

          if (file.size > MAX_FILE_SIZE) {
            notifyError(
              'File too large',
              `${file.name} exceeds the 50MB limit.`
            );
            return false;
          }

          return true;
        });

      if (uploads.length === 0) return;

      const uploadingStatus: AttachedFile['status'] = 'uploading';
      const nextFiles: AttachedFile[] = uploads.map(({ file, localId }) => ({
        localId,
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        status: uploadingStatus,
      }));

      const updatedFiles: AttachedFile[] = [...attachedFiles, ...nextFiles];
      setAttachedFiles(updatedFiles);

      await Promise.all(uploads.map(({ file, localId }) => uploadFile(file, localId)));
    },
    [attachedFiles, uploadFile]
  );

  useEffect(() => {
    if (incomingFiles && incomingFiles.length > 0) {
      handleFiles(incomingFiles);
      onIncomingFilesHandled?.();
    }
  }, [handleFiles, incomingFiles, onIncomingFilesHandled]);

  const handleSend = useCallback(() => {
    const trimmedMessage = message.trim();
    const readyFiles = attachedFiles.filter((file) => file.status === 'ready' && file.id);
    if ((trimmedMessage || readyFiles.length > 0) && !isLoading && !disabled) {
      onSend(trimmedMessage, readyFiles);
      setMessage('');
      setAttachedFiles([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      if (isMobile) {
        textareaRef.current?.blur();
      }
    }
  }, [message, attachedFiles, isLoading, disabled, onSend, isMobile]);

  const handleVoiceTranscript = useCallback((transcript: string) => {
    setMessage((prev) => prev + (prev ? ' ' : '') + transcript);
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    handleFiles(files);
    event.target.value = '';
  };

  const handleRemoveFile = (localId: string) => {
    setAttachedFiles((prev) => prev.filter((file) => file.localId !== localId));
  };

  const hasUploading = attachedFiles.some((file) => file.status === 'uploading');
  const hasReadyFiles = attachedFiles.some((file) => file.status === 'ready');
  const canSend =
    (message.trim().length > 0 || hasReadyFiles) &&
    !isLoading &&
    !disabled &&
    !hasUploading;

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
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={FILE_ACCEPT}
              onChange={handleFileInputChange}
              className="hidden"
            />
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
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('attachFiles')}</TooltipContent>
              </Tooltip>
            )}

            <div className="flex-1 flex flex-col gap-2">
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
              {attachedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {attachedFiles.map((file) => (
                    <span
                      key={file.localId}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-xs',
                        file.status === 'error' && 'border border-destructive/50 text-destructive'
                      )}
                    >
                      {file.status === 'uploading' && (
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                      )}
                      {file.name}
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(file.localId)}
                        className="text-muted-foreground transition hover:text-foreground"
                        aria-label={`Remove ${file.name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              {isMobile && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex-shrink-0 rounded-xl text-muted-foreground hover:text-foreground min-w-[44px] min-h-[44px]"
                  disabled={disabled}
                  onClick={() => fileInputRef.current?.click()}
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
                    variant="ghost"
                    size="icon"
                    onClick={toggleAgentMode}
                    className={cn(
                      'flex-shrink-0 rounded-xl transition-all',
                      isMobile && 'min-w-[44px] min-h-[44px]',
                      agentMode
                        ? 'bg-amber-500/20 text-amber-500 hover:bg-amber-500/30 ring-1 ring-amber-500/40'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Bot className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{agentMode ? 'Agent Mode ON — click to disable' : 'Enable Agent Mode'}</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleSend}
                    disabled={!canSend}
                    size="icon"
                    className={cn(
                      'flex-shrink-0 rounded-xl transition-all',
                      isMobile && 'min-w-[44px] min-h-[44px]',
                      canSend
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
