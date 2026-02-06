'use client';

import { useEffect } from 'react';
import { useThemeStore } from '@/lib/themes';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { applyCurrentTheme, transitionsEnabled } = useThemeStore();

  useEffect(() => {
    applyCurrentTheme();
    
    if (transitionsEnabled) {
      document.documentElement.classList.add('theme-transitions');
    } else {
      document.documentElement.classList.remove('theme-transitions');
    }
  }, [applyCurrentTheme, transitionsEnabled]);

  return <>{children}</>;
}
