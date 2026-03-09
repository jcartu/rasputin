const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Mutex to prevent multiple concurrent refresh attempts
let refreshPromise: Promise<boolean> | null = null;

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const { useAuthStore } = await import('./authStore');
  const token = useAuthStore.getState().accessToken;
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    // Attempt token refresh (deduplicated via mutex)
    if (!refreshPromise) {
      refreshPromise = useAuthStore.getState().refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }
    const refreshed = await refreshPromise;

    if (refreshed) {
      // Retry original request with new token
      const newToken = useAuthStore.getState().accessToken;
      const retryHeaders = new Headers(options.headers);
      if (newToken) retryHeaders.set('Authorization', `Bearer ${newToken}`);
      if (!retryHeaders.has('Content-Type') && options.body && typeof options.body === 'string') {
        retryHeaders.set('Content-Type', 'application/json');
      }
      return fetch(`${API_BASE}${path}`, { ...options, headers: retryHeaders });
    }

    // Refresh failed — actually log out
    useAuthStore.getState().logout();
    if (typeof window !== 'undefined') window.location.href = '/login';
  }

  return res;
}

export { API_BASE };
