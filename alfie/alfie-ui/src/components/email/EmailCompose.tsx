'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  Send,
  Paperclip,
  Trash2,
  Save,
  Sparkles,
  Loader2,
  Maximize2,
  Minimize2,
  ChevronDown,
  Bold,
  Italic,
  List,
  Link as LinkIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useEmailStore, type EmailAddress, type EmailAttachment } from '@/lib/emailStore';
import { emailApi } from '@/lib/emailApi';

type AiIntent = 'improve' | 'shorten' | 'expand' | 'formalize' | 'casualize';

const AI_ACTIONS: { intent: AiIntent; label: string }[] = [
  { intent: 'improve', label: 'Improve Writing' },
  { intent: 'shorten', label: 'Make Shorter' },
  { intent: 'expand', label: 'Expand' },
  { intent: 'formalize', label: 'Make Formal' },
  { intent: 'casualize', label: 'Make Casual' },
];

export function EmailCompose() {
  const {
    activeAccountId,
    composeDraft,
    closeCompose,
    updateComposeDraft,
    addDraft,
    removeDraft,
  } = useEmailStore();

  const [isMinimized, setIsMinimized] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [toInput, setToInput] = useState('');
  const [ccVisible, setCcVisible] = useState(false);
  const [bccVisible, setBccVisible] = useState(false);
  const [ccInput, setCcInput] = useState('');
  const [bccInput, setBccInput] = useState('');

  useEffect(() => {
    if (composeDraft?.cc?.length) setCcVisible(true);
    if (composeDraft?.bcc?.length) setBccVisible(true);
  }, [composeDraft?.cc, composeDraft?.bcc]);

  const parseEmailInput = (input: string): EmailAddress | null => {
    const trimmed = input.trim();
    if (!trimmed) return null;
    
    const match = trimmed.match(/(?:"?([^"]*)"?\s)?<?([^>]+@[^>]+)>?/);
    if (match) {
      return { name: match[1] || '', email: match[2] };
    }
    if (trimmed.includes('@')) {
      return { email: trimmed, name: '' };
    }
    return null;
  };

  const handleAddRecipient = (field: 'to' | 'cc' | 'bcc', value: string) => {
    const address = parseEmailInput(value);
    if (!address || !composeDraft) return;

    const currentList = composeDraft[field] || [];
    if (!currentList.find(a => a.email === address.email)) {
      updateComposeDraft({ [field]: [...currentList, address] });
    }

    if (field === 'to') setToInput('');
    else if (field === 'cc') setCcInput('');
    else setBccInput('');
  };

  const handleRemoveRecipient = (field: 'to' | 'cc' | 'bcc', email: string) => {
    if (!composeDraft) return;
    const currentList = composeDraft[field] || [];
    updateComposeDraft({ [field]: currentList.filter(a => a.email !== email) });
  };

  const handleKeyDown = (e: React.KeyboardEvent, field: 'to' | 'cc' | 'bcc', value: string) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
      e.preventDefault();
      handleAddRecipient(field, value);
    }
  };

  const handleSend = async () => {
    if (!activeAccountId || !composeDraft) return;
    if (!composeDraft.to?.length || !composeDraft.subject) {
      return;
    }

    setIsSending(true);
    try {
      await emailApi.sendEmail(activeAccountId, {
        to: composeDraft.to,
        cc: composeDraft.cc,
        bcc: composeDraft.bcc,
        subject: composeDraft.subject,
        body: composeDraft.body,
        htmlBody: composeDraft.htmlBody,
        attachments: composeDraft.attachments,
        replyToId: composeDraft.replyToId,
      });
      
      if (composeDraft.id) {
        removeDraft(composeDraft.id);
      }
      closeCompose();
    } catch (err) {
      console.error('Failed to send:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!activeAccountId || !composeDraft) return;

    setIsSaving(true);
    try {
      const { draftId } = await emailApi.saveDraft(activeAccountId, composeDraft);
      updateComposeDraft({ id: draftId });
      addDraft({ ...composeDraft, id: draftId });
    } catch (err) {
      console.error('Failed to save draft:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAiAssist = async (intent: AiIntent) => {
    if (!composeDraft?.body) return;

    setIsAiProcessing(true);
    try {
      const result = await emailApi.assistCompose({
        intent,
        content: composeDraft.body,
        context: composeDraft.subject,
      });
      
      updateComposeDraft({ 
        body: result.body,
        subject: result.subject || composeDraft.subject 
      });
    } catch (err) {
      console.error('AI assist failed:', err);
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleDraftEmail = async () => {
    if (!composeDraft?.subject) return;

    setIsAiProcessing(true);
    try {
      const result = await emailApi.assistCompose({
        intent: 'draft',
        content: composeDraft.subject,
        context: composeDraft.to?.map(t => t.email).join(', '),
      });
      
      updateComposeDraft({ 
        body: result.body,
        subject: result.subject || composeDraft.subject 
      });
    } catch (err) {
      console.error('AI draft failed:', err);
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleDiscard = () => {
    if (composeDraft?.id) {
      removeDraft(composeDraft.id);
    }
    closeCompose();
  };

  if (!composeDraft) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      className={cn(
        'fixed z-50 bg-background border border-border rounded-t-lg shadow-2xl flex flex-col',
        isMinimized
          ? 'bottom-0 right-4 w-80 h-12'
          : 'bottom-0 right-4 w-[600px] h-[500px]'
      )}
    >
      <div 
        role="button"
        tabIndex={0}
        className="flex items-center justify-between px-4 h-12 border-b border-border bg-muted/50 rounded-t-lg cursor-pointer"
        onClick={() => isMinimized && setIsMinimized(false)}
        onKeyDown={(e) => e.key === 'Enter' && isMinimized && setIsMinimized(false)}
      >
        <span className="font-medium text-sm truncate">
          {composeDraft.subject || 'New Message'}
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}>
            {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={(e) => { e.stopPropagation(); closeCompose(); }}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <>
          <div className="flex-1 flex flex-col overflow-hidden p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground w-12">To:</span>
              <div className="flex-1 flex flex-wrap items-center gap-1 p-1 border border-border rounded-md min-h-[38px]">
                {composeDraft.to?.map((addr) => (
                  <Badge key={addr.email} variant="secondary" className="gap-1">
                    {addr.name || addr.email}
                    <button type="button" onClick={() => handleRemoveRecipient('to', addr.email)}>
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
                <Input
                  value={toInput}
                  onChange={(e) => setToInput(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, 'to', toInput)}
                  onBlur={() => handleAddRecipient('to', toInput)}
                  placeholder={composeDraft.to?.length ? '' : 'Recipients'}
                  className="flex-1 min-w-[120px] border-0 h-7 focus-visible:ring-0"
                />
              </div>
              {!ccVisible && (
                <Button variant="ghost" size="sm" onClick={() => setCcVisible(true)}>Cc</Button>
              )}
              {!bccVisible && (
                <Button variant="ghost" size="sm" onClick={() => setBccVisible(true)}>Bcc</Button>
              )}
            </div>

            {ccVisible && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-12">Cc:</span>
                <div className="flex-1 flex flex-wrap items-center gap-1 p-1 border border-border rounded-md min-h-[38px]">
                  {composeDraft.cc?.map((addr) => (
                    <Badge key={addr.email} variant="secondary" className="gap-1">
                      {addr.name || addr.email}
                      <button type="button" onClick={() => handleRemoveRecipient('cc', addr.email)}>
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                  <Input
                    value={ccInput}
                    onChange={(e) => setCcInput(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, 'cc', ccInput)}
                    onBlur={() => handleAddRecipient('cc', ccInput)}
                    className="flex-1 min-w-[120px] border-0 h-7 focus-visible:ring-0"
                  />
                </div>
              </div>
            )}

            {bccVisible && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-12">Bcc:</span>
                <div className="flex-1 flex flex-wrap items-center gap-1 p-1 border border-border rounded-md min-h-[38px]">
                  {composeDraft.bcc?.map((addr) => (
                    <Badge key={addr.email} variant="secondary" className="gap-1">
                      {addr.name || addr.email}
                      <button type="button" onClick={() => handleRemoveRecipient('bcc', addr.email)}>
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                  <Input
                    value={bccInput}
                    onChange={(e) => setBccInput(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, 'bcc', bccInput)}
                    onBlur={() => handleAddRecipient('bcc', bccInput)}
                    className="flex-1 min-w-[120px] border-0 h-7 focus-visible:ring-0"
                  />
                </div>
              </div>
            )}

            <Input
              value={composeDraft.subject || ''}
              onChange={(e) => updateComposeDraft({ subject: e.target.value })}
              placeholder="Subject"
              className="border-0 border-b border-border rounded-none px-0 focus-visible:ring-0"
            />

            <Textarea
              value={composeDraft.body || ''}
              onChange={(e) => updateComposeDraft({ body: e.target.value })}
              placeholder="Compose your message..."
              className="flex-1 resize-none border-0 focus-visible:ring-0"
            />

            {composeDraft.attachments && composeDraft.attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                {composeDraft.attachments.map((att) => (
                  <Badge key={att.id} variant="outline" className="gap-1">
                    <Paperclip className="w-3 h-3" />
                    {att.filename}
                    <button type="button">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between p-3 border-t border-border bg-muted/30">
            <div className="flex items-center gap-1">
              <Button
                onClick={handleSend}
                disabled={isSending || !composeDraft.to?.length || !composeDraft.subject}
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Send
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" disabled={isAiProcessing}>
                    {isAiProcessing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={handleDraftEmail}>
                    <Sparkles className="w-4 h-4 mr-2" />
                    AI Draft from Subject
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {AI_ACTIONS.map((action) => (
                    <DropdownMenuItem 
                      key={action.intent}
                      onClick={() => handleAiAssist(action.intent)}
                    >
                      {action.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Paperclip className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Attach files</TooltipContent>
              </Tooltip>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSaveDraft}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDiscard}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}
