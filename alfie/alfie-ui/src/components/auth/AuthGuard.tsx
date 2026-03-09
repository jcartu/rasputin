'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/authStore';
import { useChatStore } from '@/lib/store';

const PUBLIC_PATHS = ['/login', '/register'];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const loadFromStorage = useAuthStore((s) => s.loadFromStorage);
  const loadConversations = useChatStore((s) => s.loadConversations);
  const [checked, setChecked] = useState(false);

  const refreshAccessToken = useAuthStore((s) => s.refreshAccessToken);

  useEffect(() => {
    loadFromStorage();
    setChecked(true);
  }, [loadFromStorage]);

  // Proactive token refresh — every 23 hours (token expires in 24h)
  useEffect(() => {
    if (!accessToken) return;
    const REFRESH_INTERVAL = 23 * 60 * 60 * 1000;
    const timer = setInterval(() => {
      refreshAccessToken();
    }, REFRESH_INTERVAL);
    return () => clearInterval(timer);
  }, [accessToken, refreshAccessToken]);

  useEffect(() => {
    if (!checked) return;
    const isAuthenticated = !!accessToken && !!user;
    if (!isAuthenticated && !PUBLIC_PATHS.includes(pathname)) {
      router.replace('/login');
    }
    if (isAuthenticated) {
      loadConversations();
    }
  }, [checked, accessToken, user, pathname, router, loadConversations]);

  if (!checked) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const isAuthenticated = !!accessToken && !!user;
  if (!isAuthenticated && !PUBLIC_PATHS.includes(pathname)) return null;

  return <>{children}</>;
}
