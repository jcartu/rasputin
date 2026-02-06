'use client';

import { useEffect } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { ChatArea } from '@/components/chat/ChatArea';
import { RightPanel } from '@/components/panels/RightPanel';
import { KeyboardShortcutsProvider } from '@/components/shared';
import { MobileProvider } from '@/components/shared/MobileProvider';
import { TutorialOverlay, OnboardingPrompt } from '@/components/tutorial';
import { ApiPlayground } from '@/components/playground';
import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard';
import { ActivityLog } from '@/components/activity/ActivityLog';
import { useChatStore, useUIStore } from '@/lib/store';
import { useWebSocket } from '@/lib/websocket';
import { useAutoVersioning } from '@/lib/useAutoVersioning';
import { useActivityStream } from '@/hooks/useActivityStream';

export default function Home() {
  const { sessions, createSession } = useChatStore();
  const { mainView } = useUIStore();
  const { connect } = useWebSocket();
  
  useAutoVersioning();
  useActivityStream();

  useEffect(() => {
    connect().catch(console.error);
  }, [connect]);

  useEffect(() => {
    if (sessions.length === 0) {
      createSession('Welcome');
    }
  }, [sessions.length, createSession]);

  return (
    <MobileProvider>
      <KeyboardShortcutsProvider>
        <div className="flex h-dvh bg-background overflow-hidden">
          <Sidebar />
          
          <main 
            id="main-content" 
            className="flex-1 flex flex-col transition-all duration-200 relative min-w-0"
            role="main"
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
          </main>
          
          <TutorialOverlay />
          <OnboardingPrompt />
          <ActivityLog />
        </div>
      </KeyboardShortcutsProvider>
    </MobileProvider>
  );
}
