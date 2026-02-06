'use client';

import { format, isToday, isYesterday, isThisWeek } from 'date-fns';
import { motion } from 'framer-motion';
import { Star, Paperclip, Mail, FileEdit } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Email, EmailDraft } from '@/lib/emailStore';

interface EmailListProps {
  emails: Email[];
  drafts: EmailDraft[];
  selectedId: string | null;
  onSelect: (email: Email) => void;
  onDraftSelect: (draft: EmailDraft) => void;
  compact?: boolean;
}

function formatEmailDate(date: Date): string {
  const d = new Date(date);
  if (isToday(d)) {
    return format(d, 'h:mm a');
  }
  if (isYesterday(d)) {
    return 'Yesterday';
  }
  if (isThisWeek(d)) {
    return format(d, 'EEE');
  }
  return format(d, 'MMM d');
}

export function EmailList({ emails, drafts, selectedId, onSelect, onDraftSelect, compact }: EmailListProps) {
  if (emails.length === 0 && drafts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Mail className="w-12 h-12 mb-2 opacity-50" />
        <p className="text-sm">No emails found</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[calc(100%-60px)]">
      <div className="divide-y divide-border">
        {drafts.map((draft, index) => (
          <motion.button
            key={draft.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.02 }}
            onClick={() => onDraftSelect(draft)}
            className={cn(
              'w-full text-left p-3 hover:bg-muted/50 transition-colors',
              selectedId === draft.id && 'bg-primary/5'
            )}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center">
                <FileEdit className="w-4 h-4 text-orange-500" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm text-orange-500 truncate">
                    Draft
                  </span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {formatEmailDate(draft.updatedAt)}
                  </span>
                </div>
                
                <p className="text-sm font-medium truncate">
                  {draft.subject || '(No subject)'}
                </p>
                
                {!compact && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    To: {draft.to?.map(t => t.email).join(', ') || '(No recipients)'}
                  </p>
                )}
              </div>
            </div>
          </motion.button>
        ))}
        
        {emails.map((email, index) => (
          <motion.button
            key={email.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: (drafts.length + index) * 0.02 }}
            onClick={() => onSelect(email)}
            className={cn(
              'w-full text-left p-3 hover:bg-muted/50 transition-colors',
              !email.isRead && 'bg-primary/5',
              selectedId === email.id && 'bg-primary/10'
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn(
                'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                email.isRead ? 'bg-muted text-muted-foreground' : 'bg-primary/20 text-primary'
              )}>
                {email.from?.name?.[0]?.toUpperCase() || email.from?.email?.[0]?.toUpperCase() || '?'}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn(
                    'text-sm truncate',
                    !email.isRead && 'font-semibold'
                  )}>
                    {email.from?.name || email.from?.email || 'Unknown'}
                  </span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {email.attachments && email.attachments.length > 0 && (
                      <Paperclip className="w-3 h-3 text-muted-foreground" />
                    )}
                    {email.isStarred && (
                      <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatEmailDate(email.date)}
                    </span>
                  </div>
                </div>
                
                <p className={cn(
                  'text-sm truncate',
                  !email.isRead ? 'font-medium' : 'text-muted-foreground'
                )}>
                  {email.subject || '(No subject)'}
                </p>
                
                {!compact && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {email.snippet || email.body?.slice(0, 100)}
                  </p>
                )}
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </ScrollArea>
  );
}
