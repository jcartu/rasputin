import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type FontSize = 'small' | 'medium' | 'large' | 'extra-large';
export type ContrastMode = 'normal' | 'high' | 'highest';
export type FocusIndicator = 'default' | 'enhanced' | 'high-visibility';

export interface AccessibilityPreferences {
  fontSize: FontSize;
  contrastMode: ContrastMode;
  reducedMotion: boolean;
  reducedTransparency: boolean;
  focusIndicator: FocusIndicator;
  focusHighlightColor: string;
  announceMessages: boolean;
  announceToolCalls: boolean;
  verboseDescriptions: boolean;
  enableKeyboardNavigation: boolean;
  showKeyboardShortcuts: boolean;
  dyslexicFont: boolean;
  underlineLinks: boolean;
  largeClickTargets: boolean;
}

const defaultAccessibilityPreferences: AccessibilityPreferences = {
  fontSize: 'medium',
  contrastMode: 'normal',
  reducedMotion: false,
  reducedTransparency: false,
  focusIndicator: 'default',
  focusHighlightColor: '#4f46e5',
  announceMessages: true,
  announceToolCalls: true,
  verboseDescriptions: false,
  enableKeyboardNavigation: true,
  showKeyboardShortcuts: true,
  dyslexicFont: false,
  underlineLinks: false,
  largeClickTargets: false,
};

export const fontSizeScale: Record<FontSize, number> = {
  small: 0.875,
  medium: 1,
  large: 1.125,
  'extra-large': 1.25,
};

type AnnouncementPriority = 'polite' | 'assertive';

interface Announcement {
  message: string;
  priority: AnnouncementPriority;
  timestamp: number;
}

interface AccessibilityState extends AccessibilityPreferences {
  isSkipLinkVisible: boolean;
  currentFocusedElement: string | null;
  announcements: Announcement[];
  
  updatePreference: <K extends keyof AccessibilityPreferences>(
    key: K,
    value: AccessibilityPreferences[K]
  ) => void;
  setFontSize: (size: FontSize) => void;
  setContrastMode: (mode: ContrastMode) => void;
  setReducedMotion: (enabled: boolean) => void;
  setFocusIndicator: (indicator: FocusIndicator) => void;
  toggleDyslexicFont: () => void;
  resetToDefaults: () => void;
  setSkipLinkVisible: (visible: boolean) => void;
  setCurrentFocusedElement: (id: string | null) => void;
  announce: (message: string, priority?: AnnouncementPriority) => void;
  clearAnnouncements: () => void;
  applySettings: () => void;
}

export const useAccessibilityStore = create<AccessibilityState>()(
  persist(
    (set, get) => ({
      ...defaultAccessibilityPreferences,
      isSkipLinkVisible: false,
      currentFocusedElement: null,
      announcements: [],

      updatePreference: (key, value) => {
        set({ [key]: value });
        get().applySettings();
      },

      setFontSize: (size) => {
        set({ fontSize: size });
        get().applySettings();
      },

      setContrastMode: (mode) => {
        set({ contrastMode: mode });
        get().applySettings();
      },

      setReducedMotion: (enabled) => {
        set({ reducedMotion: enabled });
        get().applySettings();
      },

      setFocusIndicator: (indicator) => {
        set({ focusIndicator: indicator });
        get().applySettings();
      },

      toggleDyslexicFont: () => {
        set((state) => ({ dyslexicFont: !state.dyslexicFont }));
        get().applySettings();
      },

      resetToDefaults: () => {
        set(defaultAccessibilityPreferences);
        get().applySettings();
      },

      setSkipLinkVisible: (visible) => set({ isSkipLinkVisible: visible }),

      setCurrentFocusedElement: (id) => set({ currentFocusedElement: id }),

      announce: (message, priority = 'polite') => {
        const announcement: Announcement = {
          message,
          priority,
          timestamp: Date.now(),
        };
        set((state) => ({
          announcements: [...state.announcements, announcement].slice(-10),
        }));
      },

      clearAnnouncements: () => set({ announcements: [] }),

      applySettings: () => {
        if (typeof window === 'undefined') return;

        const state = get();
        const root = document.documentElement;

        const scale = fontSizeScale[state.fontSize];
        root.style.setProperty('--a11y-font-scale', scale.toString());
        root.style.fontSize = `${scale * 100}%`;

        root.classList.remove('contrast-normal', 'contrast-high', 'contrast-highest');
        root.classList.add(`contrast-${state.contrastMode}`);

        if (state.reducedMotion) {
          root.classList.add('reduce-motion');
        } else {
          root.classList.remove('reduce-motion');
        }

        if (state.reducedTransparency) {
          root.classList.add('reduce-transparency');
        } else {
          root.classList.remove('reduce-transparency');
        }

        root.classList.remove('focus-default', 'focus-enhanced', 'focus-high-visibility');
        root.classList.add(`focus-${state.focusIndicator}`);
        root.style.setProperty('--focus-color', state.focusHighlightColor);

        if (state.dyslexicFont) {
          root.classList.add('dyslexic-font');
        } else {
          root.classList.remove('dyslexic-font');
        }

        if (state.underlineLinks) {
          root.classList.add('underline-links');
        } else {
          root.classList.remove('underline-links');
        }

        if (state.largeClickTargets) {
          root.classList.add('large-targets');
        } else {
          root.classList.remove('large-targets');
        }
      },
    }),
    {
      name: 'alfie-accessibility',
      partialize: (state) => ({
        fontSize: state.fontSize,
        contrastMode: state.contrastMode,
        reducedMotion: state.reducedMotion,
        reducedTransparency: state.reducedTransparency,
        focusIndicator: state.focusIndicator,
        focusHighlightColor: state.focusHighlightColor,
        announceMessages: state.announceMessages,
        announceToolCalls: state.announceToolCalls,
        verboseDescriptions: state.verboseDescriptions,
        enableKeyboardNavigation: state.enableKeyboardNavigation,
        showKeyboardShortcuts: state.showKeyboardShortcuts,
        dyslexicFont: state.dyslexicFont,
        underlineLinks: state.underlineLinks,
        largeClickTargets: state.largeClickTargets,
      }),
    }
  )
);

export function useSystemA11yPreferences() {
  if (typeof window === 'undefined') {
    return {
      prefersReducedMotion: false,
      prefersHighContrast: false,
      prefersReducedTransparency: false,
    };
  }

  return {
    prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    prefersHighContrast: window.matchMedia('(prefers-contrast: more)').matches,
    prefersReducedTransparency: window.matchMedia('(prefers-reduced-transparency: reduce)').matches,
  };
}

export function createFocusTrap(containerRef: React.RefObject<HTMLElement>) {
  const container = containerRef.current;
  if (!container) return { activate: () => {}, deactivate: () => {} };

  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  let previousFocus: HTMLElement | null = null;

  const getFocusableElements = () => {
    return Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors));
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    const focusable = getFocusableElements();
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return {
    activate: () => {
      previousFocus = document.activeElement as HTMLElement;
      container.addEventListener('keydown', handleKeyDown);
      const focusable = getFocusableElements();
      if (focusable.length > 0) {
        focusable[0].focus();
      }
    },
    deactivate: () => {
      container.removeEventListener('keydown', handleKeyDown);
      if (previousFocus) {
        previousFocus.focus();
      }
    },
  };
}

export const KeyboardKeys = {
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
  TAB: 'Tab',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  HOME: 'Home',
  END: 'End',
  PAGE_UP: 'PageUp',
  PAGE_DOWN: 'PageDown',
} as const;

export function isActivationKey(key: string): boolean {
  return key === KeyboardKeys.ENTER || key === KeyboardKeys.SPACE;
}

const navigationKeys = [
  KeyboardKeys.ARROW_UP,
  KeyboardKeys.ARROW_DOWN,
  KeyboardKeys.ARROW_LEFT,
  KeyboardKeys.ARROW_RIGHT,
  KeyboardKeys.HOME,
  KeyboardKeys.END,
] as const;

export function isNavigationKey(key: string): boolean {
  return (navigationKeys as readonly string[]).includes(key);
}
