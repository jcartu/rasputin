import { useEffect, useRef } from 'react';
import { useChatStore, Session } from './store';
import { useVersionControl, createChangelogEntry } from './version-control';

export function useAutoVersioning() {
  const sessions = useChatStore(state => state.sessions);
  const activeSessionId = useChatStore(state => state.activeSessionId);
  
  const createSnapshot = useVersionControl(state => state.createSnapshot);
  const shouldAutoSnapshot = useVersionControl(state => state.shouldAutoSnapshot);
  const cleanupOldSnapshots = useVersionControl(state => state.cleanupOldSnapshots);
  
  const previousSessionsRef = useRef<Map<string, Session>>(new Map());
  const lastSnapshotTimeRef = useRef<Map<string, number>>(new Map());
  
  useEffect(() => {
    const prevSessions = previousSessionsRef.current;
    
    for (const session of sessions) {
      const prevSession = prevSessions.get(session.id);
      
      if (!prevSession) {
        prevSessions.set(session.id, { ...session, messages: [...session.messages] });
        
        if (session.messages.length > 0) {
          const now = Date.now();
          const lastSnapshot = lastSnapshotTimeRef.current.get(session.id) || 0;
          
          if (now - lastSnapshot > 5000) {
            createSnapshot(
              session.id,
              session,
              'auto',
              'Initial session state',
              undefined,
              [createChangelogEntry('message_added', `Session created with ${session.messages.length} messages`)]
            );
            lastSnapshotTimeRef.current.set(session.id, now);
          }
        }
        continue;
      }
      
      const prevMessageCount = prevSession.messages.length;
      const currentMessageCount = session.messages.length;
      
      if (currentMessageCount > prevMessageCount) {
        const addedMessages = session.messages.slice(prevMessageCount);
        const now = Date.now();
        const lastSnapshot = lastSnapshotTimeRef.current.get(session.id) || 0;
        const MIN_SNAPSHOT_INTERVAL = 10000;
        
        const shouldSnapshot = 
          (now - lastSnapshot > MIN_SNAPSHOT_INTERVAL) &&
          (
            addedMessages.some(m => m.role === 'assistant') ||
            currentMessageCount % 5 === 0 ||
            prevMessageCount === 0
          );
        
        if (shouldSnapshot && shouldAutoSnapshot(session.id, 'message_added')) {
          const changelog = addedMessages.map(msg => 
            createChangelogEntry(
              'message_added',
              `${msg.role === 'user' ? 'User' : 'Assistant'} message added`,
              { messageId: msg.id }
            )
          );
          
          createSnapshot(
            session.id,
            session,
            'auto',
            `Auto-save: ${currentMessageCount} messages`,
            `Added ${addedMessages.length} message(s)`,
            changelog
          );
          
          lastSnapshotTimeRef.current.set(session.id, now);
          cleanupOldSnapshots(session.id, 100);
        }
      }
      
      if (prevSession.name !== session.name) {
        const now = Date.now();
        const lastSnapshot = lastSnapshotTimeRef.current.get(session.id) || 0;
        
        if (now - lastSnapshot > 5000) {
          createSnapshot(
            session.id,
            session,
            'auto',
            `Renamed: ${session.name}`,
            `Session renamed from "${prevSession.name}" to "${session.name}"`,
            [createChangelogEntry('session_renamed', 'Session renamed', {
              oldValue: prevSession.name,
              newValue: session.name,
            })]
          );
          lastSnapshotTimeRef.current.set(session.id, now);
        }
      }
      
      prevSessions.set(session.id, { ...session, messages: [...session.messages] });
    }
    
    const currentIds = new Set(sessions.map(s => s.id));
    Array.from(prevSessions.keys()).forEach(id => {
      if (!currentIds.has(id)) {
        prevSessions.delete(id);
        lastSnapshotTimeRef.current.delete(id);
      }
    });
  }, [sessions, createSnapshot, shouldAutoSnapshot, cleanupOldSnapshots]);
  
  useEffect(() => {
    if (!activeSessionId) return;
    
    const session = sessions.find(s => s.id === activeSessionId);
    if (!session || session.messages.length === 0) return;
    
    const lastSnapshot = lastSnapshotTimeRef.current.get(activeSessionId);
    if (!lastSnapshot) {
      createSnapshot(
        activeSessionId,
        session,
        'auto',
        'Session opened',
        'Snapshot created when session was opened',
        []
      );
      lastSnapshotTimeRef.current.set(activeSessionId, Date.now());
    }
  }, [activeSessionId, sessions, createSnapshot]);
}

export function useManualSnapshot() {
  const sessions = useChatStore(state => state.sessions);
  const activeSessionId = useChatStore(state => state.activeSessionId);
  const createSnapshot = useVersionControl(state => state.createSnapshot);
  
  return (label?: string, description?: string) => {
    if (!activeSessionId) return null;
    
    const session = sessions.find(s => s.id === activeSessionId);
    if (!session) return null;
    
    return createSnapshot(
      activeSessionId,
      session,
      'manual',
      label || `Manual snapshot`,
      description || 'Manually created snapshot',
      [createChangelogEntry('metadata_changed', 'Manual snapshot created')]
    );
  };
}
