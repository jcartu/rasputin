'use client';

import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useMobile } from '@/lib/hooks/useMobile';
import { useUIStore } from '@/lib/store';

interface MobileContextValue {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouchDevice: boolean;
  isLandscape: boolean;
  width: number;
  height: number;
}

const MobileContext = createContext<MobileContextValue>({
  isMobile: false,
  isTablet: false,
  isDesktop: true,
  isTouchDevice: false,
  isLandscape: false,
  width: 1024,
  height: 768,
});

export function useMobileContext() {
  return useContext(MobileContext);
}

interface MobileProviderProps {
  children: ReactNode;
}

export function MobileProvider({ children }: MobileProviderProps) {
  const mobile = useMobile();
  const { setSidebarOpen, setRightPanelOpen, setMobileMenuOpen, setMobilePanelOpen } = useUIStore();

  useEffect(() => {
    if (mobile.isMobile) {
      setSidebarOpen(false);
      setRightPanelOpen(false);
    } else {
      setMobileMenuOpen(false);
      setMobilePanelOpen(false);
    }
  }, [mobile.isMobile, setSidebarOpen, setRightPanelOpen, setMobileMenuOpen, setMobilePanelOpen]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--sat', `${mobile.safeAreaInsets.top}px`);
    root.style.setProperty('--sab', `${mobile.safeAreaInsets.bottom}px`);
    root.style.setProperty('--sal', `${mobile.safeAreaInsets.left}px`);
    root.style.setProperty('--sar', `${mobile.safeAreaInsets.right}px`);
    
    if (mobile.isMobile) {
      root.classList.add('is-mobile');
      root.classList.remove('is-tablet', 'is-desktop');
    } else if (mobile.isTablet) {
      root.classList.add('is-tablet');
      root.classList.remove('is-mobile', 'is-desktop');
    } else {
      root.classList.add('is-desktop');
      root.classList.remove('is-mobile', 'is-tablet');
    }

    if (mobile.isTouchDevice) {
      root.classList.add('touch-device');
    } else {
      root.classList.remove('touch-device');
    }
  }, [mobile]);

  return (
    <MobileContext.Provider value={mobile}>
      {children}
    </MobileContext.Provider>
  );
}
