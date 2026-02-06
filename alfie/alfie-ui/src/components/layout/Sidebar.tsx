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
import { useChatStore, useUIStore } from '@/lib/store';
import { useMobileContext } from '@/components/shared/MobileProvider';
import { formatDistanceToNow } from 'date-fns';
import { ExportImportModal } from '@/components/modals/ExportImportModal';

const SWIPE_THRESHOLD = 100;

export function Sidebar() {
  const t = useTranslations('sidebar');
  const tCommon = useTranslations('common');
  const { isMobile, isTouchDevice } = useMobileContext();
  const { sidebarOpen, mobileMenuOpen, toggleSidebar, setMobileMenuOpen, setSidebarOpen, mainView, setMainView } = useUIStore();
  const { sessions, activeSessionId, createSession, deleteSession, setActiveSession, clearSession } = useChatStore();
  
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportModalTab, setExportModalTab] = useState<'export' | 'import'>('export');
  const [preselectedSessionIds, setPreselectedSessionIds] = useState<string[]>([]);

  const openExportModal = useCallback((tab: 'export' | 'import', sessionIds: string[] = []) => {
    setExportModalTab(tab);
    setPreselectedSessionIds(sessionIds);
    setExportModalOpen(true);
  }, []);

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
      </div>

      {mainView === 'chat' && (
        <ScrollArea className="flex-1 px-3">
          <div className="space-y-1 pb-4">
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
                    onExport={() => openExportModal('export', [session.id])}
                    isMobile={isMobile}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
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
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground min-h-touch"
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
  onExport: () => void;
  isMobile?: boolean;
}

function SessionItem({ session, isActive, onSelect, onDelete, onClear, onExport, isMobile }: SessionItemProps) {
  const t = useTranslations('sidebar');
  const preview = session.messages[0]?.content?.slice(0, 50) || t('newConversation');
  const timeAgo = formatDistanceToNow(new Date(session.updatedAt), { addSuffix: true });

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
        <p className={cn(
          'text-sm font-medium truncate',
          isActive ? 'text-foreground' : 'text-muted-foreground'
        )}>
          {session.name}
        </p>
        <p className="text-xs text-muted-foreground/60 truncate">{preview}</p>
        <p className="text-[10px] text-muted-foreground/40 mt-0.5">{timeAgo}</p>
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
