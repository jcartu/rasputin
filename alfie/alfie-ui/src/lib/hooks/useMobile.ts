'use client';

import { useState, useEffect, useCallback } from 'react';

export const BREAKPOINTS = {
  xs: 375,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

interface MobileState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  width: number;
  height: number;
  breakpoint: Breakpoint;
  isTouchDevice: boolean;
  isLandscape: boolean;
  safeAreaInsets: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

export function useMobile(): MobileState {
  const [state, setState] = useState<MobileState>({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
    breakpoint: 'lg',
    isTouchDevice: false,
    isLandscape: false,
    safeAreaInsets: { top: 0, bottom: 0, left: 0, right: 0 },
  });

  const getBreakpoint = useCallback((width: number): Breakpoint => {
    if (width < BREAKPOINTS.sm) return 'xs';
    if (width < BREAKPOINTS.md) return 'sm';
    if (width < BREAKPOINTS.lg) return 'md';
    if (width < BREAKPOINTS.xl) return 'lg';
    if (width < BREAKPOINTS['2xl']) return 'xl';
    return '2xl';
  }, []);

  const getSafeAreaInsets = useCallback(() => {
    if (typeof window === 'undefined') return { top: 0, bottom: 0, left: 0, right: 0 };
    
    const style = getComputedStyle(document.documentElement);
    return {
      top: parseInt(style.getPropertyValue('--sat') || '0', 10) || 0,
      bottom: parseInt(style.getPropertyValue('--sab') || '0', 10) || 0,
      left: parseInt(style.getPropertyValue('--sal') || '0', 10) || 0,
      right: parseInt(style.getPropertyValue('--sar') || '0', 10) || 0,
    };
  }, []);

  useEffect(() => {
    const updateState = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const breakpoint = getBreakpoint(width);
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      
      setState({
        isMobile: width < BREAKPOINTS.md,
        isTablet: width >= BREAKPOINTS.md && width < BREAKPOINTS.lg,
        isDesktop: width >= BREAKPOINTS.lg,
        width,
        height,
        breakpoint,
        isTouchDevice,
        isLandscape: width > height,
        safeAreaInsets: getSafeAreaInsets(),
      });
    };

    updateState();

    window.addEventListener('resize', updateState);
    window.addEventListener('orientationchange', updateState);

    return () => {
      window.removeEventListener('resize', updateState);
      window.removeEventListener('orientationchange', updateState);
    };
  }, [getBreakpoint, getSafeAreaInsets]);

  return state;
}

// Hook for swipe gestures
interface SwipeConfig {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number;
  enabled?: boolean;
}

export function useSwipeGesture(config: SwipeConfig) {
  const { 
    onSwipeLeft, 
    onSwipeRight, 
    onSwipeUp, 
    onSwipeDown, 
    threshold = 50,
    enabled = true 
  } = config;

  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled) return;
    setTouchEnd(null);
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    });
  }, [enabled]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!enabled) return;
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    });
  }, [enabled]);

  const handleTouchEnd = useCallback(() => {
    if (!enabled || !touchStart || !touchEnd) return;

    const deltaX = touchStart.x - touchEnd.x;
    const deltaY = touchStart.y - touchEnd.y;
    const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);

    if (isHorizontal) {
      if (deltaX > threshold) {
        onSwipeLeft?.();
      } else if (deltaX < -threshold) {
        onSwipeRight?.();
      }
    } else {
      if (deltaY > threshold) {
        onSwipeUp?.();
      } else if (deltaY < -threshold) {
        onSwipeDown?.();
      }
    }
  }, [enabled, touchStart, touchEnd, threshold, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]);

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  };
}
