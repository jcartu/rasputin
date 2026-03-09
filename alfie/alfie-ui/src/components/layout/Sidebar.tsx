'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { 
  Plus, 
  MessageSquare, 
  Trash2, 
  MoreVertical, 
  Settings, 
  Sparkles,
  ChevronLeft,
  ChevronRight,
  X,
  Download,
  Upload,
  FolderDown,
  Zap,
  BarChart3,
  Workflow,
  Search,
  Loader2,
  Wand2,
  FolderOpen,
  Clock,
  ListTodo,
  Puzzle,
  Pencil,
  Check,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { useChatStore, useUIStore } from '@/lib/store';
import { useMobileContext } from '@/components/shared/MobileProvider';
import { apiFetch } from '@/lib/apiClient';
import { formatDistanceToNow } from 'date-fns';
import { ExportImportModal } from '@/components/modals/ExportImportModal';

const SWIPE_THRESHOLD = 100;

export function Sidebar() {
  const t = useTranslations('sidebar');
  const tCommon = useTranslations('common');
  const { isMobile, isTouchDevice } = useMobileContext();
  const { sidebarOpen, mobileMenuOpen, toggleSidebar, setMobileMenuOpen, setSidebarOpen, mainView, setMainView } = useUIStore();
  const { sessions, activeSessionId, createSession, deleteSession, setActiveSession, clearSession, renameSession } = useChatStore();
  
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportModalTab, setExportModalTab] = useState<'export' | 'import'>('export');
  const [preselectedSessionIds, setPreselectedSessionIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ thread_id: string; title: string; snippet?: string; updated_at?: string }>>([]);
  const [isSearching, setIsSearching] = useState(false);

  const openExportModal = useCallback((tab: 'export' | 'import', sessionIds: string[] = []) => {
    setExportModalTab(tab);
    setPreselectedSessionIds(sessionIds);
    setExportModalOpen(true);
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/conversations/search?q=${encodeURIComponent(searchQuery.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.conversations || data.results || []);
        }
      } catch (e) {
        console.error('Search failed:', e);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const isOpen = isMobile ? mobileMenuOpen : sidebarOpen;
  const setOpen = isMobile ? setMobileMenuOpen : setSidebarOpen;

  useEffect(() => {
    if (isMobile && mobileMenuOpen) {
      document.body.classList.add('body-scroll-lock');
    } else {
      document.body.classList.remove('body-scroll-lock');
    }
    return () => document.body.classList.remove('body-scroll-lock');
  }, [isMobile, mobileMenuOpen]);

  const handleDragEnd = useCallback((_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x < -SWIPE_THRESHOLD) {
      setOpen(false);
    }
  }, [setOpen]);

  const handleOverlayClick = useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  const handleNewChat = useCallback(() => {
    createSession();
    if (isMobile) {
      setMobileMenuOpen(false);
    }
  }, [createSession, isMobile, setMobileMenuOpen]);

  const handleSessionSelect = useCallback((sessionId: string) => {
    setActiveSession(sessionId);
    if (isMobile) {
      setMobileMenuOpen(false);
    }
  }, [setActiveSession, isMobile, setMobileMenuOpen]);

  const sidebarContent = (
    <>
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <motion.div
            animate={{
              boxShadow: [
                '0 0 10px hsl(262 83% 58% / 0.3)',
                '0 0 20px hsl(262 83% 58% / 0.5)',
                '0 0 10px hsl(262 83% 58% / 0.3)',
              ],
            }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center"
          >
            <Sparkles className="w-5 h-5 text-white" />
          </motion.div>
          <div>
            <h1 className="font-bold text-lg gradient-text">{tCommon('alfie')}</h1>
            <p className="text-xs text-muted-foreground">{tCommon('tagline')}</p>
          </div>
        </div>
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(false)}
            className="rounded-xl min-w-touch min-h-touch"
          >
            <X className="w-5 h-5" />
          </Button>
        )}
      </div>

      <div className="p-3 space-y-2">
        <div className="flex gap-1 p-1 bg-muted/50 rounded-lg">
          <Button
            variant={mainView === 'chat' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setMainView('chat')}
            className={cn(
              'flex-1 gap-2',
              mainView === 'chat' && 'bg-primary text-primary-foreground'
            )}
          >
            <MessageSquare className="w-4 h-4" />
            Chat
          </Button>
          <Button
            variant={mainView === 'playground' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => {
              setMainView('playground');
              if (isMobile) setMobileMenuOpen(false);
            }}
            className={cn(
              'flex-1 gap-2',
              mainView === 'playground' && 'bg-primary text-primary-foreground'
            )}
          >
            <Zap className="w-4 h-4" />
            API
          </Button>
          <Button
            variant={mainView === 'analytics' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => {
              setMainView('analytics');
              if (isMobile) setMobileMenuOpen(false);
            }}
            className={cn(
              'flex-1 gap-2',
              mainView === 'analytics' && 'bg-primary text-primary-foreground'
            )}
          >
            <BarChart3 className="w-4 h-4" />
            Stats
          </Button>
        </div>
        <div className="flex gap-1 p-1 bg-muted/50 rounded-lg">
          <Button
            variant={mainView === 'skills' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => {
              setMainView('skills');
              if (isMobile) setMobileMenuOpen(false);
            }}
            className={cn(
              'flex-1 gap-2',
              mainView === 'skills' && 'bg-primary text-primary-foreground'
            )}
          >
            <Wand2 className="w-4 h-4" />
            Skills
          </Button>
          <Button
            variant={mainView === 'projects' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => {
              setMainView('projects');
              if (isMobile) setMobileMenuOpen(false);
            }}
            className={cn(
              'flex-1 gap-2',
              mainView === 'projects' && 'bg-primary text-primary-foreground'
            )}
          >
            <FolderOpen className="w-4 h-4" />
            Projects
          </Button>
          <Button
            variant={mainView === 'schedules' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => {
              setMainView('schedules');
              if (isMobile) setMobileMenuOpen(false);
            }}
            className={cn(
              'flex-1 gap-2',
              mainView === 'schedules' && 'bg-primary text-primary-foreground'
            )}
          >
            <Clock className="w-4 h-4" />
            Schedules
          </Button>
          <Button
            variant={mainView === 'tasks' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => {
              setMainView('tasks');
              if (isMobile) setMobileMenuOpen(false);
            }}
            className={cn(
              'flex-1 gap-2',
              mainView === 'tasks' && 'bg-primary text-primary-foreground'
            )}
          >
            <ListTodo className="w-4 h-4" />
            Tasks
          </Button>
        </div>
        
        {mainView === 'chat' && (
          <Button
            onClick={handleNewChat}
            className="w-full justify-start gap-2 bg-gradient-to-r from-primary/10 to-accent/10 hover:from-primary/20 hover:to-accent/20 border border-primary/20 min-h-touch"
            variant="outline"
            data-tutorial="new-chat-button"
          >
            <Plus className="w-4 h-4" />
            {t('newChat')}
          </Button>
        )}
        {mainView === 'chat' && (
          <div className="relative mt-2">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm bg-muted/30 border-border/50"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 p-0.5 rounded-sm hover:bg-muted text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {mainView === 'chat' && (
        <ScrollArea className="flex-1 px-3">
          <div className="space-y-1 pb-4">
            {searchQuery.trim() ? (
              isSearching ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Searching...
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map((result) => (
                  <button
                    key={result.thread_id}
                    type="button"
                    className="group flex items-start gap-2 p-3 rounded-xl cursor-pointer transition-all duration-200 w-full text-left hover:bg-muted/60 border border-transparent hover:border-border/50"
                    onClick={() => {
                      handleSessionSelect(result.thread_id);
                      setSearchQuery('');
                    }}
                  >
                    <Search className="w-4 h-4 flex-shrink-0 mt-0.5 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{result.title || 'Untitled'}</p>
                      {result.snippet && <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{result.snippet}</p>}
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No conversations found
                </div>
              )
            ) : (
            <AnimatePresence>
              {sessions.map((session) => (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  layout
                >
                  <SessionItem
                    session={session}
                    isActive={session.id === activeSessionId}
                    onSelect={() => handleSessionSelect(session.id)}
                    onDelete={() => deleteSession(session.id)}
                    onClear={() => clearSession(session.id)}
                    onRename={(name) => renameSession(session.id, name)}
                    onExport={() => openExportModal('export', [session.id])}
                    isMobile={isMobile}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
            )}
          </div>
        </ScrollArea>
      )}
      
      {mainView !== 'chat' && (
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center text-muted-foreground">
          {mainView === 'playground' && (
            <>
              <Zap className="w-12 h-12 mb-4 opacity-30" />
              <p className="text-sm font-medium">API Playground</p>
              <p className="text-xs mt-1">Test ALFIE API endpoints</p>
            </>
          )}
          {mainView === 'analytics' && (
            <>
              <BarChart3 className="w-12 h-12 mb-4 opacity-30" />
              <p className="text-sm font-medium">Analytics Dashboard</p>
              <p className="text-xs mt-1">View usage statistics</p>
            </>
          )}
          {mainView === 'skills' && (
            <>
              <Wand2 className="w-12 h-12 mb-4 opacity-30" />
              <p className="text-sm font-medium">Skills Marketplace</p>
              <p className="text-xs mt-1">Create and run reusable AI skills</p>
            </>
          )}
          {mainView === 'projects' && (
            <>
              <FolderOpen className="w-12 h-12 mb-4 opacity-30" />
              <p className="text-sm font-medium">Projects</p>
              <p className="text-xs mt-1">Organize conversations into workspaces</p>
            </>
          )}
          {mainView === 'schedules' && (
            <>
              <Clock className="w-12 h-12 mb-4 opacity-30" />
              <p className="text-sm font-medium">Scheduled Tasks</p>
              <p className="text-xs mt-1">Automate recurring agent tasks</p>
            </>
          )}
          {mainView === 'tasks' && (
            <>
              <ListTodo className="w-12 h-12 mb-4 opacity-30" />
              <p className="text-sm font-medium">Agent Tasks</p>
              <p className="text-xs mt-1">Browse task execution history</p>
            </>
          )}
          {mainView === 'integrations' && (
            <>
              <Puzzle className="w-12 h-12 mb-4 opacity-30" />
              <p className="text-sm font-medium">Integrations</p>
              <p className="text-xs mt-1">Connect your tools and services</p>
            </>
          )}
          {mainView === 'settings' && (
            <>
              <Settings className="w-12 h-12 mb-4 opacity-30" />
              <p className="text-sm font-medium">Settings</p>
              <p className="text-xs mt-1">Configure your preferences</p>
            </>
          )}
        </div>
      )}

      <div className="p-3 border-t border-border safe-area-bottom space-y-1">
        <Link href="/workflows" className="block">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground min-h-touch"
          >
            <Workflow className="w-4 h-4" />
            Workflows
          </Button>
        </Link>
        <Button
          variant="ghost"
          onClick={() => {
            setMainView('integrations');
            if (isMobile) setMobileMenuOpen(false);
          }}
          className={cn(
            'w-full justify-start gap-2 min-h-touch',
            mainView === 'integrations' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Puzzle className="w-4 h-4" />
          Integrations
        </Button>
        <div className="flex gap-1 mb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openExportModal('export')}
            className="flex-1 justify-start gap-2 text-muted-foreground hover:text-foreground"
          >
            <FolderDown className="w-4 h-4" />
            {t('exportSessions')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openExportModal('import')}
            className="flex-1 justify-start gap-2 text-muted-foreground hover:text-foreground"
          >
            <Upload className="w-4 h-4" />
            {t('importSessions')}
          </Button>
        </div>
        <Button
          variant="ghost"
          onClick={() => {
            setMainView('settings');
            if (isMobile) setMobileMenuOpen(false);
          }}
          className={cn(
            'w-full justify-start gap-2 min-h-touch',
            mainView === 'settings' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Settings className="w-4 h-4" />
          {t('settings')}
        </Button>
      </div>
      
      <ExportImportModal
        open={exportModalOpen}
        onOpenChange={setExportModalOpen}
        initialTab={exportModalTab}
        preselectedSessionIds={preselectedSessionIds}
      />
    </>
  );

  if (isMobile) {
    return (
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="mobile-overlay"
              onClick={handleOverlayClick}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              drag={isTouchDevice ? 'x' : false}
              dragConstraints={{ left: -320, right: 0 }}
              dragElastic={0.1}
              onDragEnd={handleDragEnd}
              className="mobile-panel flex flex-col h-full safe-area-top"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    );
  }

  return (
    <>
      <AnimatePresence mode="wait">
        {sidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="flex flex-col h-full border-r border-border/50 bg-gradient-to-b from-card/90 via-card/80 to-card/70 backdrop-blur-xl overflow-hidden shadow-[1px_0_30px_hsl(var(--primary)/0.05)]"
            data-tutorial="sidebar"
          >
            {sidebarContent}
          </motion.aside>
        )}
      </AnimatePresence>

      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        className={cn(
          'absolute top-4 z-50 rounded-xl bg-card/80 backdrop-blur-sm border border-border shadow-lg hidden md:flex',
          sidebarOpen ? 'left-[268px]' : 'left-4'
        )}
      >
        {sidebarOpen ? (
          <ChevronLeft className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
      </Button>
    </>
  );
}

interface SessionItemProps {
  session: {
    id: string;
    name: string;
    messages: { content: string }[];
    updatedAt: Date;
  };
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onClear: () => void;
  onRename: (name: string) => void;
  onExport: () => void;
  isMobile?: boolean;
}

function SessionItem({ session, isActive, onSelect, onDelete, onClear, onRename, onExport, isMobile }: SessionItemProps) {
  const t = useTranslations('sidebar');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(session.name);
  const preview = session.messages[0]?.content?.slice(0, 50) || t('newConversation');
  const timeAgo = formatDistanceToNow(new Date(session.updatedAt), { addSuffix: true });

  const handleRenameSubmit = useCallback(() => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== session.name) {
      onRename(trimmed);
    }
    setIsRenaming(false);
  }, [renameValue, session.name, onRename]);

  const handleRenameKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      setRenameValue(session.name);
      setIsRenaming(false);
    }
  }, [handleRenameSubmit, session.name]);

  return (
    <button
      type="button"
      className={cn(
        'group flex items-center gap-2 p-3 rounded-xl cursor-pointer transition-all duration-200 w-full text-left',
        isMobile && 'min-h-touch',
        isActive
          ? 'bg-primary/10 border border-primary/30 shadow-[0_0_15px_hsl(var(--primary)/0.1)] shadow-inner-glow'
          : 'hover:bg-muted/60 hover:border-border/50 border border-transparent active:bg-muted/80 hover:shadow-sm'
      )}
      onClick={onSelect}
    >
      <MessageSquare className={cn(
        'w-4 h-4 flex-shrink-0',
        isActive ? 'text-primary' : 'text-muted-foreground'
      )} />
      
      <div className="flex-1 min-w-0">
        {isRenaming ? (
          <span className="flex items-center gap-1">
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={handleRenameKeyDown}
              onBlur={handleRenameSubmit}
              onClick={(e) => e.stopPropagation()}
              className="text-sm font-medium bg-background border border-border rounded px-1.5 py-0.5 w-full focus:outline-none focus:ring-1 focus:ring-primary"
              ref={(el) => el?.focus()}
            />
            <Button
              variant="ghost"
              size="icon"
              className="w-6 h-6 flex-shrink-0"
              onClick={(e) => { e.stopPropagation(); handleRenameSubmit(); }}
            >
              <Check className="w-3 h-3" />
            </Button>
          </span>
        ) : (
          <>
            <p className={cn(
              'text-sm font-medium truncate',
              isActive ? 'text-foreground' : 'text-muted-foreground'
            )}>
              {session.name}
            </p>
            <p className="text-xs text-muted-foreground/60 truncate">{preview}</p>
            <p className="text-[10px] text-muted-foreground/40 mt-0.5">{timeAgo}</p>
          </>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'w-8 h-8 transition-opacity flex-shrink-0',
              isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              setRenameValue(session.name);
              setIsRenaming(true);
            }}
            className="min-h-touch"
          >
            <Pencil className="w-4 h-4 mr-2" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onExport} className="min-h-touch">
            <Download className="w-4 h-4 mr-2" />
            {t('exportSession')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onClear} className="min-h-touch">
            {t('clearMessages')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDelete} className="text-destructive min-h-touch">
            <Trash2 className="w-4 h-4 mr-2" />
            {t('deleteSession')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </button>
  );
}
