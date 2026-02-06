'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import {
  X,
  Reply,
  ReplyAll,
  Forward,
  Trash2,
  Star,
  MoreHorizontal,
  Paperclip,
  Download,
  Sparkles,
  MessageSquare,
  FileText,
  ListChecks,
  ExternalLink,
  Loader2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useEmailStore, type Email, type SmartReply } from '@/lib/emailStore';
import { emailApi } from '@/lib/emailApi';

interface EmailViewProps {
  email: Email;
  onClose: () => void;
  onReply: (email: Email) => void;
  onConvertToSession: (email: Email) => void;
}

export function EmailView({ email, onClose, onReply, onConvertToSession }: EmailViewProps) {
  const {
    activeAccountId,
    smartReplies,
    emailSummary,
    emailAnalysis,
    setSmartReplies,
    setEmailSummary,
    setEmailAnalysis,
    openCompose,
    updateEmail,
  } = useEmailStore();

  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [actionItems, setActionItems] = useState<Array<{
    task: string;
    assignee: string;
    deadline: string | null;
    priority: string;
  }>>([]);

  const handleStar = async () => {
    if (!activeAccountId) return;
    updateEmail(email.id, { isStarred: !email.isStarred });
  };

  const handleDelete = async () => {
    if (!activeAccountId) return;
    try {
      await emailApi.deleteEmail(activeAccountId, email.id);
      onClose();
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const handleDownloadAttachment = async (attachment: { id: string; filename: string; mimeType: string }) => {
    if (!activeAccountId) return;
    try {
      const data = await emailApi.getAttachment(activeAccountId, email.id, attachment.id);
      emailApi.downloadAttachment(data.content, attachment.filename, attachment.mimeType);
    } catch (err) {
      console.error('Failed to download attachment:', err);
    }
  };

  const loadSmartReplies = async () => {
    setIsLoadingAi(true);
    try {
      const { suggestions } = await emailApi.getSmartReplies(email);
      setSmartReplies(suggestions);
    } catch (err) {
      console.error('Failed to load smart replies:', err);
    } finally {
      setIsLoadingAi(false);
    }
  };

  const loadSummary = async () => {
    setIsLoadingAi(true);
    try {
      const summary = await emailApi.summarizeEmail(email);
      setEmailSummary(summary);
    } catch (err) {
      console.error('Failed to summarize:', err);
    } finally {
      setIsLoadingAi(false);
    }
  };

  const loadAnalysis = async () => {
    setIsLoadingAi(true);
    try {
      const analysis = await emailApi.analyzeEmail(email);
      setEmailAnalysis(analysis);
    } catch (err) {
      console.error('Failed to analyze:', err);
    } finally {
      setIsLoadingAi(false);
    }
  };

  const loadActionItems = async () => {
    setIsLoadingAi(true);
    try {
      const { actionItems: items } = await emailApi.extractActionItems(email);
      setActionItems(items);
    } catch (err) {
      console.error('Failed to extract action items:', err);
    } finally {
      setIsLoadingAi(false);
    }
  };

  const useSmartReply = (reply: SmartReply) => {
    openCompose({
      id: crypto.randomUUID(),
      accountId: activeAccountId || '',
      to: email.from ? [email.from] : [],
      subject: `Re: ${email.subject}`,
      body: reply.text,
      replyToId: email.id,
      updatedAt: new Date(),
    });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
        
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => onReply(email)}>
            <Reply className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleStar}>
            <Star className={cn(
              'w-4 h-4',
              email.isStarred && 'text-yellow-500 fill-yellow-500'
            )} />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleDelete}>
            <Trash2 className="w-4 h-4" />
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onReply(email)}>
                <ReplyAll className="w-4 h-4 mr-2" />
                Reply All
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Forward className="w-4 h-4 mr-2" />
                Forward
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onConvertToSession(email)}>
                <ExternalLink className="w-4 h-4 mr-2" />
                Convert to Session
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6">
          <h1 className="text-xl font-semibold mb-4">{email.subject}</h1>
          
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-medium">
                {email.from?.name?.[0]?.toUpperCase() || email.from?.email?.[0]?.toUpperCase() || '?'}
              </div>
              <div>
                <p className="font-medium">
                  {email.from?.name || email.from?.email}
                </p>
                <p className="text-sm text-muted-foreground">
                  to {email.to?.map(t => t.name || t.email).join(', ')}
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {format(new Date(email.date), 'PPpp')}
            </p>
          </div>

          {emailAnalysis && (
            <div className="flex flex-wrap gap-2 mb-4">
              <Badge variant={
                emailAnalysis.priority === 'high' ? 'destructive' :
                emailAnalysis.priority === 'medium' ? 'default' : 'secondary'
              }>
                {emailAnalysis.priority} priority
              </Badge>
              <Badge variant="outline">{emailAnalysis.category}</Badge>
              {emailAnalysis.isUrgent && (
                <Badge variant="destructive">Urgent</Badge>
              )}
              {emailAnalysis.requiresResponse && (
                <Badge variant="default">Needs Reply</Badge>
              )}
            </div>
          )}

          {email.attachments && email.attachments.length > 0 && (
            <div className="mb-6 p-3 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium mb-2 flex items-center gap-2">
                <Paperclip className="w-4 h-4" />
                {email.attachments.length} Attachment{email.attachments.length > 1 ? 's' : ''}
              </p>
              <div className="flex flex-wrap gap-2">
                {email.attachments.map((att) => (
                  <Button
                    key={att.id}
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadAttachment(att)}
                  >
                    <Download className="w-3 h-3 mr-2" />
                    {att.filename}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="prose prose-sm dark:prose-invert max-w-none mb-6">
            {email.htmlBody ? (
              <div dangerouslySetInnerHTML={{ __html: email.htmlBody }} />
            ) : (
              <pre className="whitespace-pre-wrap font-sans">{email.body}</pre>
            )}
          </div>

          <Collapsible open={showAiPanel} onOpenChange={setShowAiPanel}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between mb-4">
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  AI Assistant
                </span>
                {showAiPanel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4 p-4 border border-border rounded-lg bg-muted/30"
              >
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadSmartReplies}
                    disabled={isLoadingAi}
                  >
                    {isLoadingAi ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <MessageSquare className="w-3 h-3 mr-2" />}
                    Smart Replies
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadSummary}
                    disabled={isLoadingAi}
                  >
                    {isLoadingAi ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <FileText className="w-3 h-3 mr-2" />}
                    Summarize
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadAnalysis}
                    disabled={isLoadingAi}
                  >
                    {isLoadingAi ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Sparkles className="w-3 h-3 mr-2" />}
                    Analyze
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadActionItems}
                    disabled={isLoadingAi}
                  >
                    {isLoadingAi ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <ListChecks className="w-3 h-3 mr-2" />}
                    Extract Actions
                  </Button>
                </div>

                {smartReplies.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Smart Replies</p>
                    <div className="space-y-2">
                      {smartReplies.map((reply, i) => (
                        <button
                          key={i}
                          onClick={() => useSmartReply(reply)}
                          className="w-full text-left p-3 text-sm bg-background rounded-lg border border-border hover:border-primary transition-colors"
                        >
                          <Badge variant="outline" className="mb-1 text-xs">
                            {reply.type}
                          </Badge>
                          <p>{reply.text}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {emailSummary && (
                  <div>
                    <p className="text-sm font-medium mb-2">Summary</p>
                    <div className="p-3 bg-background rounded-lg border border-border">
                      <p className="text-sm mb-2">{emailSummary.summary}</p>
                      {emailSummary.keyPoints.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Key Points:</p>
                          <ul className="text-xs text-muted-foreground list-disc list-inside">
                            {emailSummary.keyPoints.map((point, i) => (
                              <li key={i}>{point}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {emailSummary.actionItems.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Action Items:</p>
                          <ul className="text-xs text-muted-foreground list-disc list-inside">
                            {emailSummary.actionItems.map((item, i) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {actionItems.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Action Items</p>
                    <div className="space-y-2">
                      {actionItems.map((item, i) => (
                        <div key={i} className="p-3 bg-background rounded-lg border border-border">
                          <p className="text-sm font-medium">{item.task}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {item.assignee}
                            </Badge>
                            <Badge variant={
                              item.priority === 'high' ? 'destructive' :
                              item.priority === 'medium' ? 'default' : 'secondary'
                            } className="text-xs">
                              {item.priority}
                            </Badge>
                            {item.deadline && (
                              <span className="text-xs text-muted-foreground">
                                Due: {item.deadline}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            </CollapsibleContent>
          </Collapsible>

          <div className="flex items-center gap-2 pt-4 border-t border-border">
            <Button onClick={() => onReply(email)} className="flex-1">
              <Reply className="w-4 h-4 mr-2" />
              Reply
            </Button>
            <Button variant="outline" className="flex-1">
              <Forward className="w-4 h-4 mr-2" />
              Forward
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
