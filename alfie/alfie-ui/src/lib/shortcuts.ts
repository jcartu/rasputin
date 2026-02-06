'use client';

import { useEffect, useCallback, useRef } from 'react';

// Platform detection for modifier key display
const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

export type ModifierKey = 'meta' | 'ctrl' | 'alt' | 'shift';

export interface Shortcut {
  id: string;
  key: string;
  modifiers: ModifierKey[];
  description: string;
  category: 'navigation' | 'actions' | 'modals' | 'general';
  action: () => void;
  enabled?: boolean;
}

export interface ShortcutConfig {
  key: string;
  modifiers?: ModifierKey[];
  description: string;
  category: 'navigation' | 'actions' | 'modals' | 'general';
  enabled?: boolean;
}

// Format modifier key for display (⌘ on Mac, Ctrl on Windows/Linux)
export function formatModifier(modifier: ModifierKey): string {
  switch (modifier) {
    case 'meta':
      return isMac ? '⌘' : 'Ctrl';
    case 'ctrl':
      return isMac ? '⌃' : 'Ctrl';
    case 'alt':
      return isMac ? '⌥' : 'Alt';
    case 'shift':
      return isMac ? '⇧' : 'Shift';
    default:
      return modifier;
  }
}

// Format key for display
export function formatKey(key: string): string {
  const keyMappings: Record<string, string> = {
    'arrowup': '↑',
    'arrowdown': '↓',
    'arrowleft': '←',
    'arrowright': '→',
    'escape': 'Esc',
    'enter': '↵',
    'backspace': '⌫',
    'delete': '⌦',
    'tab': '⇥',
    ' ': 'Space',
    ',': ',',
    '/': '/',
  };
  
  const lowerKey = key.toLowerCase();
  return keyMappings[lowerKey] || key.toUpperCase();
}

// Format full shortcut for display
export function formatShortcut(shortcut: { key: string; modifiers: ModifierKey[] }): string {
  const parts = shortcut.modifiers.map(formatModifier);
  parts.push(formatKey(shortcut.key));
  return parts.join(isMac ? '' : '+');
}

// Check if event matches shortcut
function matchesShortcut(event: KeyboardEvent, shortcut: Shortcut): boolean {
  const { key, modifiers } = shortcut;
  
  // Check key match (case-insensitive)
  if (event.key.toLowerCase() !== key.toLowerCase()) {
    return false;
  }
  
  // Check modifiers
  const hasCmd = event.metaKey || event.ctrlKey; // Treat Ctrl same as Cmd on non-Mac
  const hasAlt = event.altKey;
  const hasShift = event.shiftKey;
  
  const needsCmd = modifiers.includes('meta') || modifiers.includes('ctrl');
  const needsAlt = modifiers.includes('alt');
  const needsShift = modifiers.includes('shift');
  
  // For meta/ctrl, we accept either metaKey or ctrlKey for cross-platform compatibility
  if (needsCmd !== hasCmd) return false;
  if (needsAlt !== hasAlt) return false;
  if (needsShift !== hasShift) return false;
  
  return true;
}

// Check if event target is an input element
function isInputElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  
  const tagName = target.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true;
  }
  
  // Check for contenteditable
  if (target.isContentEditable) {
    return true;
  }
  
  return false;
}

// Custom hook for keyboard shortcuts
export function useKeyboardShortcuts(shortcuts: Shortcut[], options?: {
  preventDefault?: boolean;
  stopPropagation?: boolean;
  ignoreInputs?: boolean;
}) {
  const {
    preventDefault = true,
    stopPropagation = true,
    ignoreInputs = true,
  } = options || {};
  
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;
  
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Skip if target is an input element (unless it's Escape)
    if (ignoreInputs && isInputElement(event.target)) {
      // Always allow Escape to work in inputs
      if (event.key.toLowerCase() !== 'escape') {
        return;
      }
    }
    
    for (const shortcut of shortcutsRef.current) {
      if (shortcut.enabled === false) continue;
      
      if (matchesShortcut(event, shortcut)) {
        if (preventDefault) event.preventDefault();
        if (stopPropagation) event.stopPropagation();
        
        shortcut.action();
        return;
      }
    }
  }, [preventDefault, stopPropagation, ignoreInputs]);
  
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

// Predefined shortcut configurations
export const SHORTCUT_CONFIGS = {
  SEARCH: {
    key: 'k',
    modifiers: ['meta'] as ModifierKey[],
    description: 'Search or command palette',
    category: 'actions' as const,
  },
  NEW_CHAT: {
    key: 'n',
    modifiers: ['meta'] as ModifierKey[],
    description: 'New chat',
    category: 'actions' as const,
  },
  SETTINGS: {
    key: ',',
    modifiers: ['meta'] as ModifierKey[],
    description: 'Open settings',
    category: 'modals' as const,
  },
  TOGGLE_SIDEBAR: {
    key: 'b',
    modifiers: ['meta'] as ModifierKey[],
    description: 'Toggle sidebar',
    category: 'navigation' as const,
  },
  SHORTCUTS_HELP: {
    key: '/',
    modifiers: ['meta'] as ModifierKey[],
    description: 'Show keyboard shortcuts',
    category: 'general' as const,
  },
  CLOSE_MODAL: {
    key: 'Escape',
    modifiers: [] as ModifierKey[],
    description: 'Close modal or dialog',
    category: 'general' as const,
  },
  NAV_UP: {
    key: 'ArrowUp',
    modifiers: [] as ModifierKey[],
    description: 'Navigate up',
    category: 'navigation' as const,
  },
  NAV_DOWN: {
    key: 'ArrowDown',
    modifiers: [] as ModifierKey[],
    description: 'Navigate down',
    category: 'navigation' as const,
  },
  NAV_PREV: {
    key: 'ArrowUp',
    modifiers: ['meta'] as ModifierKey[],
    description: 'Previous chat',
    category: 'navigation' as const,
  },
  NAV_NEXT: {
    key: 'ArrowDown',
    modifiers: ['meta'] as ModifierKey[],
    description: 'Next chat',
    category: 'navigation' as const,
  },
  FOCUS_INPUT: {
    key: '/',
    modifiers: [] as ModifierKey[],
    description: 'Focus chat input',
    category: 'navigation' as const,
  },
  TOGGLE_ACTIVITY_LOG: {
    key: 'l',
    modifiers: ['meta'] as ModifierKey[],
    description: 'Toggle activity log',
    category: 'general' as const,
  },
};

// Group shortcuts by category for display
export function groupShortcutsByCategory(shortcuts: Shortcut[]): Record<string, Shortcut[]> {
  return shortcuts.reduce((acc, shortcut) => {
    const category = shortcut.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(shortcut);
    return acc;
  }, {} as Record<string, Shortcut[]>);
}

// Category display names
export const CATEGORY_LABELS: Record<string, string> = {
  navigation: 'Navigation',
  actions: 'Actions',
  modals: 'Modals & Dialogs',
  general: 'General',
};
