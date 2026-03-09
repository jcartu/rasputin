import { create } from 'zustand';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface User {
  id: string;
  email: string;
  username: string;
  roles: string[];
  permissions: string[];
  isActive: boolean;
  isVerified: boolean;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
  loadFromStorage: () => void;
  clearError: () => void;
  refreshAccessToken: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        set({ isLoading: false, error: data.message || 'Login failed' });
        return;
      }
      localStorage.setItem('alfie_access_token', data.accessToken);
      localStorage.setItem('alfie_refresh_token', data.refreshToken);
      localStorage.setItem('alfie_user', JSON.stringify(data.user));
      set({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken, isLoading: false, error: null });
    } catch (e) {
      set({ isLoading: false, error: 'Network error' });
    }
  },

  register: async (email, username, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        set({ isLoading: false, error: data.message || 'Registration failed' });
        return;
      }
      localStorage.setItem('alfie_access_token', data.accessToken);
      localStorage.setItem('alfie_refresh_token', data.refreshToken);
      localStorage.setItem('alfie_user', JSON.stringify(data.user));
      set({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken, isLoading: false, error: null });
    } catch (e) {
      set({ isLoading: false, error: 'Network error' });
    }
  },

  logout: () => {
    const token = get().accessToken;
    if (token) {
      fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    localStorage.removeItem('alfie_access_token');
    localStorage.removeItem('alfie_refresh_token');
    localStorage.removeItem('alfie_user');
    set({ user: null, accessToken: null, refreshToken: null, error: null });
  },

  loadFromStorage: () => {
    if (typeof window === 'undefined') return;
    const accessToken = localStorage.getItem('alfie_access_token');
    const refreshToken = localStorage.getItem('alfie_refresh_token');
    const userStr = localStorage.getItem('alfie_user');
    if (accessToken && userStr) {
      try {
        const user = JSON.parse(userStr);
        set({ accessToken, refreshToken, user });
      } catch {
        set({ accessToken: null, refreshToken: null, user: null });
      }
    }
  },

  clearError: () => set({ error: null }),

  refreshAccessToken: async () => {
    const refreshToken = get().refreshToken;
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      localStorage.setItem('alfie_access_token', data.accessToken);
      localStorage.setItem('alfie_refresh_token', data.refreshToken);
      set({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      return true;
    } catch {
      return false;
    }
  },
}));
