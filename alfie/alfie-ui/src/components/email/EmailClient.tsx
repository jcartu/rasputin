'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail,
  Inbox,
  Send,
  FileEdit,
  Trash2,
  AlertCircle,
  Star,
  Search,
  Plus,
  RefreshCw,
  Settings,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useEmailStore, type Email } from '@/lib/emailStore';
import { emailApi } from '@/lib/emailApi';
import { EmailList } from './EmailList';
import { EmailView } from './EmailView';
import { EmailCompose } from './EmailCompose';
import { EmailAccountSetup } from './EmailAccountSetup';

type ViewType = 'inbox' | 'sent' | 'drafts' | 'trash' | 'spam' | 'starred';

const VIEW_CONFIG: Record<ViewType, { label: string; icon: typeof Inbox }> = {
  inbox: { label: 'Inbox', icon: Inbox },
  sent: { label: 'Sent', icon: Send },
  drafts: { label: 'Drafts', icon: FileEdit },
  trash: { label: 'Trash', icon: Trash2 },
  spam: { label: 'Spam', icon: AlertCircle },
  starred: { label: 'Starred', icon: Star },
};

export function EmailClient() {
  const {
    accounts,
    activeAccountId,
    emails,
    selectedEmailId,
    drafts,
    currentView,
    searchQuery,
    isLoading,
    error,
    composeOpen,
    setAccounts,
    setActiveAccount,
    setEmails,
    setDrafts,
    selectEmail,
    setCurrentView,
    setSearchQuery,
    setLoading,
    setError,
    openCompose,
    getSelectedEmail,
    getUnreadCount,
  } = useEmailStore();

  const [showAccountSetup, setShowAccountSetup] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadAccounts = useCallback(async () => {
    try {
      const { accounts } = await emailApi.getAccounts();
      setAccounts(accounts);
      if (accounts.length > 0 && !activeAccountId) {
        setActiveAccount(accounts[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load accounts');
    }
  }, [setAccounts, setActiveAccount, activeAccountId, setError]);

  const loadEmails = useCallback(async () => {
    if (!activeAccountId) return;
    
    setLoading(true);
    try {
      const folder = currentView === 'starred' ? 'inbox' : currentView;
      const { emails } = await emailApi.listEmails(activeAccountId, {
        folder,
        query: searchQuery || undefined,
      });
      
      const filteredEmails = currentView === 'starred' 
        ? emails.filter(e => e.isStarred)
        : emails;
      
      setEmails(filteredEmails);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load emails');
    } finally {
      setLoading(false);
    }
  }, [activeAccountId, currentView, searchQuery, setEmails, setLoading, setError]);

  const loadDrafts = useCallback(async () => {
    if (!activeAccountId) return;
    
    try {
      const { drafts } = await emailApi.getDrafts(activeAccountId);
      setDrafts(drafts);
    } catch (err) {
      console.error('Failed to load drafts:', err);
    }
  }, [activeAccountId, setDrafts]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    if (activeAccountId) {
      loadEmails();
      loadDrafts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAccountId, loadEmails, loadDrafts]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadEmails();
    setIsRefreshing(false);
  };

  const handleViewChange = (view: string) => {
    setCurrentView(view as ViewType);
    selectEmail(null);
  };

  const handleEmailSelect = async (email: Email) => {
    selectEmail(email.id);
    
    if (!email.isRead && activeAccountId) {
      try {
        await emailApi.markAsRead(activeAccountId, email.id);
        useEmailStore.getState().updateEmail(email.id, { isRead: true });
      } catch (err) {
        console.error('Failed to mark as read:', err);
      }
    }
  };

  const handleReply = (email: Email) => {
    openCompose({
      id: crypto.randomUUID(),
      accountId: activeAccountId || '',
      to: email.from ? [email.from] : [],
      subject: `Re: ${email.subject}`,
      body: `\n\n---\nOn ${new Date(email.date).toLocaleString()}, ${email.from?.name || email.from?.email} wrote:\n> ${email.body?.split('\n').join('\n> ')}`,
      replyToId: email.id,
      updatedAt: new Date(),
    });
  };

  const handleConvertToSession = async (email: Email) => {
    try {
      const { session } = await emailApi.convertToSession(email);
      console.log('Converted to session:', session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to convert to session');
    }
  };

  const selectedEmail = getSelectedEmail();
  const unreadCount = getUnreadCount();

  if (accounts.length === 0 && !isLoading) {
    if (drafts.length > 0) {
      return (
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-primary" />
              <h2 className="font-semibold">Email Drafts</h2>
              <Badge variant="secondary">{drafts.length}</Badge>
            </div>
            <Button onClick={() => setShowAccountSetup(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Email Account
            </Button>
          </div>
          <div className="flex-1 overflow-hidden">
            <EmailList
              emails={[]}
              drafts={drafts}
              selectedId={selectedEmailId}
              onSelect={() => undefined}
              onDraftSelect={(draft) => openCompose(draft)}
              compact
            />
          </div>

          <AnimatePresence>
            {showAccountSetup && (
              <EmailAccountSetup
                onClose={() => setShowAccountSetup(false)}
                onSuccess={() => {
                  setShowAccountSetup(false);
                  loadAccounts();
                }}
              />
            )}
          </AnimatePresence>
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col items-center justify-center p-8">
        <Mail className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">No email accounts connected</h2>
        <p className="text-muted-foreground mb-6 text-center">
          Connect your Gmail, Outlook, or IMAP account to get started
        </p>
        <Button onClick={() => setShowAccountSetup(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Email Account
        </Button>
        
        <AnimatePresence>
          {showAccountSetup && (
            <EmailAccountSetup
              onClose={() => setShowAccountSetup(false)}
              onSuccess={() => {
                setShowAccountSetup(false);
                loadAccounts();
              }}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Mail className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Email</h2>
          {unreadCount > 0 && (
            <Badge variant="secondary">{unreadCount} unread</Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
          </Button>
          
          <Button onClick={() => openCompose()}>
            <Plus className="w-4 h-4 mr-2" />
            Compose
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <Settings className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowAccountSetup(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Account
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {accounts.map(account => (
                <DropdownMenuItem
                  key={account.id}
                  onClick={() => setActiveAccount(account.id)}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  {account.email}
                  {account.id === activeAccountId && (
                    <Badge variant="outline" className="ml-auto">Active</Badge>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-48 border-r border-border p-2 flex flex-col">
          <div className="space-y-1">
            {(Object.keys(VIEW_CONFIG) as ViewType[]).map((view) => {
              const config = VIEW_CONFIG[view];
              const Icon = config.icon;
              const isActive = currentView === view;
              
              return (
                <button
                  type="button"
                  key={view}
                  onClick={() => handleViewChange(view)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-muted/50 text-muted-foreground'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {config.label}
                  {view === 'inbox' && unreadCount > 0 && (
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {unreadCount}
                    </Badge>
                  )}
                  {view === 'drafts' && drafts.length > 0 && (
                    <Badge variant="outline" className="ml-auto text-xs">
                      {drafts.length}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 flex">
          <div className={cn(
            'border-r border-border transition-all duration-200',
            selectedEmail ? 'w-80' : 'flex-1'
          )}>
            <div className="p-3 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search emails..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <EmailList
                emails={currentView === 'drafts' ? [] : emails}
                drafts={currentView === 'drafts' ? drafts : []}
                selectedId={selectedEmailId}
                onSelect={handleEmailSelect}
                onDraftSelect={(draft) => openCompose(draft)}
                compact={!!selectedEmail}
              />
            )}
          </div>

          <AnimatePresence mode="wait">
            {selectedEmail && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex-1 overflow-hidden"
              >
                <EmailView
                  email={selectedEmail}
                  onClose={() => selectEmail(null)}
                  onReply={handleReply}
                  onConvertToSession={handleConvertToSession}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 border-t border-destructive/20">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <AnimatePresence>
        {composeOpen && <EmailCompose />}
        {showAccountSetup && (
          <EmailAccountSetup
            onClose={() => setShowAccountSetup(false)}
            onSuccess={() => {
              setShowAccountSetup(false);
              loadAccounts();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
