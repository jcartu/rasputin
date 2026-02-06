'use client';

import { useCallback, useMemo, useRef } from 'react';
import { useChatStore, useUIStore } from '@/lib/store';
import { useActivityStore } from '@/lib/activityStore';
import { useKeyboardShortcuts, Shortcut, SHORTCUT_CONFIGS } from '@/lib/shortcuts';
import { ShortcutsHelp } from './ShortcutsHelp';

export function KeyboardShortcutsProvider({ children }: { children: React.ReactNode }) {
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  
  const { createSession, sessions, activeSessionId, setActiveSession } = useChatStore();
  const { 
    toggleSidebar, 
    shortcutsHelpOpen, 
    setShortcutsHelpOpen,
    settingsOpen,
    setSettingsOpen,
    searchOpen,
    setSearchOpen,
    closeAllModals,
  } = useUIStore();
  const { toggleVisible: toggleActivityLog } = useActivityStore();

  const navigateToPreviousChat = useCallback(() => {
    if (!sessions.length) return;
    const currentIndex = sessions.findIndex(s => s.id === activeSessionId);
    if (currentIndex > 0) {
      setActiveSession(sessions[currentIndex - 1].id);
    }
  }, [sessions, activeSessionId, setActiveSession]);

  const navigateToNextChat = useCallback(() => {
    if (!sessions.length) return;
    const currentIndex = sessions.findIndex(s => s.id === activeSessionId);
    if (currentIndex < sessions.length - 1) {
      setActiveSession(sessions[currentIndex + 1].id);
    }
  }, [sessions, activeSessionId, setActiveSession]);

  const focusChatInput = useCallback(() => {
    const input = document.querySelector('textarea[placeholder*="Message"]') as HTMLTextAreaElement;
    if (input) {
      input.focus();
    }
  }, []);

  const handleEscape = useCallback(() => {
    if (shortcutsHelpOpen || settingsOpen || searchOpen) {
      closeAllModals();
      return;
    }
    const activeElement = document.activeElement as HTMLElement;
    if (activeElement && (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT')) {
      activeElement.blur();
    }
  }, [shortcutsHelpOpen, settingsOpen, searchOpen, closeAllModals]);

  const shortcuts: Shortcut[] = useMemo(() => [
    {
      id: 'search',
      ...SHORTCUT_CONFIGS.SEARCH,
      action: () => setSearchOpen(!searchOpen),
    },
    {
      id: 'new-chat',
      ...SHORTCUT_CONFIGS.NEW_CHAT,
      action: () => createSession(),
    },
    {
      id: 'settings',
      ...SHORTCUT_CONFIGS.SETTINGS,
      action: () => setSettingsOpen(!settingsOpen),
    },
    {
      id: 'toggle-sidebar',
      ...SHORTCUT_CONFIGS.TOGGLE_SIDEBAR,
      action: toggleSidebar,
    },
    {
      id: 'shortcuts-help',
      ...SHORTCUT_CONFIGS.SHORTCUTS_HELP,
      action: () => setShortcutsHelpOpen(!shortcutsHelpOpen),
    },
    {
      id: 'close-modal',
      ...SHORTCUT_CONFIGS.CLOSE_MODAL,
      action: handleEscape,
    },
    {
      id: 'nav-prev',
      ...SHORTCUT_CONFIGS.NAV_PREV,
      action: navigateToPreviousChat,
    },
    {
      id: 'nav-next',
      ...SHORTCUT_CONFIGS.NAV_NEXT,
      action: navigateToNextChat,
    },
    {
      id: 'focus-input',
      ...SHORTCUT_CONFIGS.FOCUS_INPUT,
      action: focusChatInput,
      enabled: !shortcutsHelpOpen && !settingsOpen && !searchOpen,
    },
    {
      id: 'toggle-activity-log',
      ...SHORTCUT_CONFIGS.TOGGLE_ACTIVITY_LOG,
      action: toggleActivityLog,
    },
  ], [
    searchOpen,
    setSearchOpen,
    createSession,
    settingsOpen,
    setSettingsOpen,
    toggleSidebar,
    shortcutsHelpOpen,
    setShortcutsHelpOpen,
    handleEscape,
    navigateToPreviousChat,
    navigateToNextChat,
    focusChatInput,
    toggleActivityLog,
  ]);

  useKeyboardShortcuts(shortcuts);

  const displayShortcuts = useMemo(() => 
    shortcuts.filter(s => s.id !== 'close-modal' && s.id !== 'focus-input'),
    [shortcuts]
  );

  return (
    <>
      {children}
      <ShortcutsHelp
        open={shortcutsHelpOpen}
        onOpenChange={setShortcutsHelpOpen}
        shortcuts={displayShortcuts}
      />
    </>
  );
}
