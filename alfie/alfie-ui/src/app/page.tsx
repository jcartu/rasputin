'use client';

import { useEffect } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { ChatArea } from '@/components/chat/ChatArea';
import { RightPanel } from '@/components/panels/RightPanel';
import { KeyboardShortcutsProvider } from '@/components/shared';
import { MobileProvider } from '@/components/shared/MobileProvider';
// Tutorial disabled — broken positioning, steps target nonexistent elements, 
// tooltip renders off-screen. Modern AI chat UIs are self-explanatory.
// import { TutorialOverlay, OnboardingPrompt } from '@/components/tutorial';
import { ApiPlayground } from '@/components/playground';
import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard';
import { SkillsPanel } from '@/components/skills/SkillsPanel';
import { ProjectsPanel } from '@/components/projects/ProjectsPanel';
import { SchedulesPanel } from '@/components/schedules/SchedulesPanel';
import { TasksPanel } from '@/components/tasks/TasksPanel';
import { IntegrationMarketplace } from '@/components/integrations/IntegrationMarketplace';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { ActivityLog } from '@/components/activity/ActivityLog';
import { useChatStore, useUIStore } from '@/lib/store';
import { wsManager } from '@/lib/websocket';
import { useAutoVersioning } from '@/lib/useAutoVersioning';
import { useActivityStream } from '@/hooks/useActivityStream';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { CommandPalette } from '@/components/shared/CommandPalette';

export default function Home() {
  const { sessions, createSession } = useChatStore();
  const { mainView } = useUIStore();
  
  useAutoVersioning();
  useActivityStream();

  useEffect(() => {
    wsManager.connect().catch(console.error);
  }, []);

  useEffect(() => {
    if (sessions.length === 0) {
      createSession('Welcome');
    }
  }, [sessions.length, createSession]);

  return (
    <AuthGuard>
      <MobileProvider>
        <KeyboardShortcutsProvider>
          <div className="flex h-dvh bg-background overflow-hidden">
            <Sidebar />
            
            <main 
              id="main-content" 
              className="flex-1 flex flex-col transition-all duration-200 relative min-w-0"
              aria-label="Main content"
            >
              {mainView === 'chat' && (
                <>
                  <Header />
                  <div className="flex-1 flex overflow-hidden">
                    <ChatArea />
                    <RightPanel />
                  </div>
                </>
              )}
              
              {mainView === 'playground' && <ApiPlayground />}
              
              {mainView === 'analytics' && <AnalyticsDashboard />}
              
              {mainView === 'skills' && <SkillsPanel />}
              
              {mainView === 'projects' && <ProjectsPanel />}
              
              {mainView === 'schedules' && <SchedulesPanel />}
              
              {mainView === 'tasks' && <TasksPanel />}
              
              {mainView === 'integrations' && <IntegrationMarketplace />}
              
              {mainView === 'settings' && <SettingsPanel />}
            </main>
            
            <ActivityLog />
            <CommandPalette />
          </div>
        </KeyboardShortcutsProvider>
      </MobileProvider>
    </AuthGuard>
  );
}
