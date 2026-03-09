'use client';

import { useEffect, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { Wrench, FolderTree, Activity, X, GripHorizontal, Volume2, History, LayoutTemplate, Camera, Mail, BookOpen, Code2, GitBranch, Users2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ToolPanel } from './ToolPanel';
import { FilePanel } from './FilePanel';
import { StatsPanel } from './StatsPanel';
import { VoiceSettings } from '@/components/voice';
import { VersionHistory, DiffView } from '@/components/version';
import { TemplatePanel, TemplateMarketplace } from '@/components/templates';
import { MediaGallery } from '@/components/media';
import { EmailClient } from '@/components/email';
import { NotebookPanel } from '@/components/notebook';
import { ArtifactPanel } from './ArtifactPanel';
import { WorkflowListPanel } from './WorkflowListPanel';
import { CollabPanel } from './CollabPanel';
import { useUIStore, useChatStore } from '@/lib/store';
import { useVersionControl } from '@/lib/version-control';
import { useMobileContext } from '@/components/shared/MobileProvider';
import { cn } from '@/lib/utils';

const SWIPE_THRESHOLD = 100;

type TabType = 'artifacts' | 'tools' | 'files' | 'stats' | 'voice' | 'history' | 'templates' | 'media' | 'email' | 'notebook' | 'workflow' | 'collab';

export function RightPanel() {
  const { isMobile, isTouchDevice } = useMobileContext();
  const { rightPanelOpen, mobilePanelOpen, rightPanelTab, setRightPanelTab, setMobilePanelOpen, setRightPanelOpen } = useUIStore();
  const { activeSessionId, sessions } = useChatStore();
  const { isComparing, selectedSnapshotId, comparisonSnapshotId } = useVersionControl();
  
  const activeSession = sessions.find(s => s.id === activeSessionId);

  useEffect(() => {
    if (isMobile && mobilePanelOpen) {
      document.body.classList.add('body-scroll-lock');
    } else {
      document.body.classList.remove('body-scroll-lock');
    }
    return () => document.body.classList.remove('body-scroll-lock');
  }, [isMobile, mobilePanelOpen]);

  const handleDragEnd = useCallback((_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > SWIPE_THRESHOLD) {
      setMobilePanelOpen(false);
    }
  }, [setMobilePanelOpen]);

  const handleClose = useCallback(() => {
    if (isMobile) {
      setMobilePanelOpen(false);
    } else {
      setRightPanelOpen(false);
    }
  }, [isMobile, setMobilePanelOpen, setRightPanelOpen]);

  const handleRollback = useCallback((sessionState: { messages: unknown[]; name: string }) => {
    if (!activeSessionId) return;
    const updateSession = useChatStore.getState();
    updateSession.sessions.forEach(session => {
      if (session.id === activeSessionId) {
        session.messages = sessionState.messages as typeof session.messages;
        session.name = sessionState.name;
        session.updatedAt = new Date();
      }
    });
  }, [activeSessionId]);

  const showDiffView = isComparing && selectedSnapshotId && comparisonSnapshotId;

  const panelContent = (
    <Tabs
      value={rightPanelTab}
      onValueChange={(v) => setRightPanelTab(v as TabType)}
      className="flex flex-col h-full"
    >
      <TabsList className={cn(
        'w-full rounded-none border-b border-border bg-transparent p-1 h-auto overflow-x-auto',
        isMobile && 'pt-0'
      )}>
        <TabsTrigger
          value="artifacts"
          className={cn(
            'gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg text-xs px-1.5',
            isMobile && 'min-h-[44px]'
          )}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span className="hidden">Artifacts</span>
        </TabsTrigger>
        <TabsTrigger
          value="tools"
          className={cn(
            'gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg text-xs px-1.5',
            isMobile && 'min-h-[44px]'
          )}
          data-tutorial="tools-tab"
        >
          <Wrench className="w-3.5 h-3.5" />
          <span className="hidden">Tools</span>
        </TabsTrigger>
        <TabsTrigger
          value="files"
          className={cn(
            'gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg text-xs px-1.5',
            isMobile && 'min-h-[44px]'
          )}
        >
          <FolderTree className="w-3.5 h-3.5" />
          <span className="hidden">Files</span>
        </TabsTrigger>
        <TabsTrigger
          value="history"
          className={cn(
            'gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg text-xs px-1.5',
            isMobile && 'min-h-[44px]'
          )}
        >
          <History className="w-3.5 h-3.5" />
          <span className="hidden">History</span>
        </TabsTrigger>
        <TabsTrigger
          value="stats"
          className={cn(
            'gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg text-xs px-1.5',
            isMobile && 'min-h-[44px]'
          )}
        >
          <Activity className="w-3.5 h-3.5" />
          <span className="hidden">Stats</span>
        </TabsTrigger>
        <TabsTrigger
          value="voice"
          className={cn(
            'gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg text-xs px-1.5',
            isMobile && 'min-h-[44px]'
          )}
        >
          <Volume2 className="w-3.5 h-3.5" />
          <span className="hidden">Voice</span>
        </TabsTrigger>
        <TabsTrigger
          value="templates"
          className={cn(
            'gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg text-xs px-1.5',
            isMobile && 'min-h-[44px]'
          )}
        >
          <LayoutTemplate className="w-3.5 h-3.5" />
          <span className="hidden">Templates</span>
        </TabsTrigger>
        <TabsTrigger
          value="media"
          className={cn(
            'gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg text-xs px-1.5',
            isMobile && 'min-h-[44px]'
          )}
        >
          <Camera className="w-3.5 h-3.5" />
          <span className="hidden">Media</span>
        </TabsTrigger>
        <TabsTrigger
          value="email"
          className={cn(
            'gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg text-xs px-1.5',
            isMobile && 'min-h-[44px]'
          )}
        >
          <Mail className="w-3.5 h-3.5" />
          <span className="hidden">Email</span>
        </TabsTrigger>
         <TabsTrigger
           value="notebook"
           className={cn(
             'gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg text-xs px-1.5',
             isMobile && 'min-h-[44px]'
           )}
         >
           <BookOpen className="w-3.5 h-3.5" />
           <span className="hidden">Notebook</span>
         </TabsTrigger>
          <TabsTrigger
            value="workflow"
            className={cn(
              'gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg text-xs px-1.5',
              isMobile && 'min-h-[44px]'
            )}
          >
            <GitBranch className="w-3.5 h-3.5" />
             <span className="hidden">Workflows</span>
            </TabsTrigger>
           <TabsTrigger
             value="collab"
             className={cn(
               'gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg text-xs px-1.5',
               isMobile && 'min-h-[44px]'
             )}
           >
             <Users2 className="w-3.5 h-3.5" />
             <span className="hidden">Collab</span>
           </TabsTrigger>
         </TabsList>

      <TabsContent value="tools" className="flex-1 m-0 overflow-hidden">
        <ToolPanel />
      </TabsContent>
      <TabsContent value="artifacts" className="flex-1 m-0 overflow-hidden">
        <ArtifactPanel />
      </TabsContent>
      <TabsContent value="files" className="flex-1 m-0 overflow-hidden">
        <FilePanel />
      </TabsContent>
      <TabsContent value="history" className="flex-1 m-0 overflow-hidden">
        {activeSessionId && activeSession ? (
          showDiffView ? (
            <DiffView sessionId={activeSessionId} />
          ) : (
            <VersionHistory 
              sessionId={activeSessionId} 
              onRollback={handleRollback}
            />
          )
        ) : (
          <div className="flex items-center justify-center h-full p-4">
            <p className="text-sm text-muted-foreground text-center">
              Select a chat session to view version history
            </p>
          </div>
        )}
      </TabsContent>
      <TabsContent value="stats" className="flex-1 m-0 overflow-hidden">
        <StatsPanel />
      </TabsContent>
      <TabsContent value="voice" className="flex-1 m-0 overflow-hidden">
        <ScrollArea className="h-full">
          <VoiceSettings className="p-4" />
        </ScrollArea>
      </TabsContent>
      <TabsContent value="templates" className="flex-1 m-0 overflow-hidden">
        <TemplatePanel />
        <TemplateMarketplace />
      </TabsContent>
      <TabsContent value="media" className="flex-1 m-0 overflow-hidden">
        <MediaGallery />
      </TabsContent>
      <TabsContent value="email" className="flex-1 m-0 overflow-hidden">
        <EmailClient />
      </TabsContent>
       <TabsContent value="notebook" className="flex-1 m-0 overflow-hidden">
         <NotebookPanel />
       </TabsContent>
         <TabsContent value="workflow" className="flex-1 m-0 overflow-hidden">
           <ScrollArea className="h-full">
             <div className="p-4 space-y-4">
               <h3 className="font-semibold text-sm">Workflows</h3>
               <p className="text-xs text-muted-foreground">Create and manage automated workflows</p>
               <WorkflowListPanel />
             </div>
           </ScrollArea>
          </TabsContent>
          <TabsContent value="collab" className="flex-1 m-0 overflow-hidden">
            <CollabPanel />
          </TabsContent>
       </Tabs>
  );

  if (isMobile) {
    return (
      <AnimatePresence>
        {mobilePanelOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="mobile-overlay"
              onClick={() => setMobilePanelOpen(false)}
            />
            <motion.aside
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              drag={isTouchDevice ? 'y' : false}
              dragConstraints={{ top: 0, bottom: 300 }}
              dragElastic={0.1}
              onDragEnd={handleDragEnd}
              className="bottom-sheet flex flex-col"
              style={{ height: '70dvh' }}
            >
              <div className="flex items-center justify-center py-2 cursor-grab active:cursor-grabbing">
                <GripHorizontal className="w-8 h-1.5 text-muted-foreground/50" />
              </div>
              
              <div className="flex items-center justify-between px-4 pb-2">
                <h2 className="font-semibold text-lg">Panel</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClose}
                  className="rounded-xl min-w-[44px] min-h-[44px]"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="flex-1 overflow-hidden">
                {panelContent}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {rightPanelOpen && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 340, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col h-full border-l border-border bg-card/50 backdrop-blur-xl overflow-hidden relative z-10 flex-shrink-0"
          data-tutorial="right-panel"
        >
          {panelContent}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
