import { create } from 'zustand';

export interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'communication' | 'project-management' | 'version-control' | 'storage' | 'custom';
  authType: 'oauth2' | 'api_key' | 'basic' | 'bearer';
  scopes?: string[];
  features: string[];
}

export interface ConnectedIntegration extends Integration {
  userId: string;
  status: 'connected' | 'error' | 'expired';
  connectedAt: string;
  settings: Record<string, unknown>;
}

export interface CustomIntegrationConfig {
  id: string;
  name: string;
  description: string;
  authType: 'oauth2' | 'api_key' | 'basic' | 'bearer';
  baseUrl: string;
  oauth2Config?: {
    authUrl: string;
    tokenUrl: string;
    scopes: string[];
  };
  apiKeyConfig?: {
    headerName: string;
    prefix?: string;
  };
  endpoints: Record<string, {
    method: string;
    path: string;
    params?: string[];
  }>;
}

interface IntegrationState {
  availableIntegrations: Integration[];
  connectedIntegrations: ConnectedIntegration[];
  customIntegrations: CustomIntegrationConfig[];
  loading: boolean;
  error: string | null;
  selectedIntegration: Integration | null;
  
  fetchIntegrations: () => Promise<void>;
  fetchConnectedIntegrations: () => Promise<void>;
  connectIntegration: (id: string) => Promise<string>;
  disconnectIntegration: (id: string) => Promise<void>;
  updateIntegrationSettings: (id: string, settings: Record<string, unknown>) => Promise<void>;
  
  createCustomIntegration: (config: Omit<CustomIntegrationConfig, 'id'>) => Promise<void>;
  updateCustomIntegration: (id: string, config: Partial<CustomIntegrationConfig>) => Promise<void>;
  deleteCustomIntegration: (id: string) => Promise<void>;
  
  setSelectedIntegration: (integration: Integration | null) => void;
  clearError: () => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const useIntegrationStore = create<IntegrationState>((set, get) => ({
  availableIntegrations: [],
  connectedIntegrations: [],
  customIntegrations: [],
  loading: false,
  error: null,
  selectedIntegration: null,

  fetchIntegrations: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/integrations`);
      if (!res.ok) throw new Error('Failed to fetch integrations');
      const data = await res.json();
      set({ availableIntegrations: data.integrations || data, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchConnectedIntegrations: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/integrations/connected`);
      if (!res.ok) throw new Error('Failed to fetch connected integrations');
      const data = await res.json();
      set({ connectedIntegrations: data.integrations || data, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  connectIntegration: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/integrations/${id}/auth`);
      if (!res.ok) throw new Error('Failed to get auth URL');
      const data = await res.json();
      set({ loading: false });
      return data.authUrl;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  disconnectIntegration: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/integrations/${id}/disconnect`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to disconnect');
      await get().fetchConnectedIntegrations();
      set({ loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  updateIntegrationSettings: async (id: string, settings: Record<string, unknown>) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/integrations/connected/${id}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error('Failed to update settings');
      await get().fetchConnectedIntegrations();
      set({ loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  createCustomIntegration: async (config) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/integrations/custom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error('Failed to create custom integration');
      const data = await res.json();
      set((state) => ({
        customIntegrations: [...state.customIntegrations, data],
        loading: false,
      }));
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  updateCustomIntegration: async (id: string, config) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/integrations/custom/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error('Failed to update custom integration');
      const data = await res.json();
      set((state) => ({
        customIntegrations: state.customIntegrations.map((i) => (i.id === id ? data : i)),
        loading: false,
      }));
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  deleteCustomIntegration: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/integrations/custom/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete custom integration');
      set((state) => ({
        customIntegrations: state.customIntegrations.filter((i) => i.id !== id),
        loading: false,
      }));
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  setSelectedIntegration: (integration) => set({ selectedIntegration: integration }),
  clearError: () => set({ error: null }),
}));
