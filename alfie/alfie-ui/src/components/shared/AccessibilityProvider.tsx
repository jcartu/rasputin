'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useAccessibilityStore, useSystemA11yPreferences } from '@/lib/accessibility';

interface SkipLinkProps {
  href: string;
  children: React.ReactNode;
}

function SkipLink({ href, children }: SkipLinkProps) {
  return (
    <a href={href} className="skip-link">
      {children}
    </a>
  );
}

function LiveRegions() {
  const { announcements } = useAccessibilityStore();
  const politeRef = useRef<HTMLOutputElement>(null);
  const assertiveRef = useRef<HTMLOutputElement>(null);

  useEffect(() => {
    const latestAnnouncement = announcements[announcements.length - 1];
    if (!latestAnnouncement) return;

    const targetRef = latestAnnouncement.priority === 'assertive' ? assertiveRef : politeRef;
    if (targetRef.current) {
      targetRef.current.textContent = latestAnnouncement.message;
      setTimeout(() => {
        if (targetRef.current) {
          targetRef.current.textContent = '';
        }
      }, 1000);
    }
  }, [announcements]);

  return (
    <>
      <output
        ref={politeRef}
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />
      <output
        ref={assertiveRef}
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      />
    </>
  );
}

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const { applySettings, setReducedMotion, setContrastMode, reducedMotion } = useAccessibilityStore();
  const systemPrefs = useSystemA11yPreferences();

  useEffect(() => {
    applySettings();
  }, [applySettings]);

  useEffect(() => {
    if (systemPrefs.prefersReducedMotion && !reducedMotion) {
      setReducedMotion(true);
    }
  }, [systemPrefs.prefersReducedMotion, reducedMotion, setReducedMotion]);

  useEffect(() => {
    if (systemPrefs.prefersHighContrast) {
      setContrastMode('high');
    }
  }, [systemPrefs.prefersHighContrast, setContrastMode]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Tab') {
      document.body.classList.add('keyboard-navigation');
    }
  }, []);

  const handleMouseDown = useCallback(() => {
    document.body.classList.remove('keyboard-navigation');
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [handleKeyDown, handleMouseDown]);

  return (
    <>
      <SkipLink href="#main-content">Skip to main content</SkipLink>
      <SkipLink href="#chat-input">Skip to chat input</SkipLink>
      {children}
      <LiveRegions />
    </>
  );
}
