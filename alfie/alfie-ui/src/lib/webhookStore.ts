import { create } from 'zustand';

export interface Webhook {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  description: string;
  headers: Record<string, string>;
  template: Record<string, unknown> | null;
  retryCount: number;
  retryDelay: number;
  timeout: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastTriggered: string | null;
}

export interface WebhookLog {
  id: string;
  webhookId: string;
  eventType: string;
  eventId: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'success' | 'failed' | 'retrying';
  statusCode: number | null;
  response: string | null;
  error: string | null;
  attempts: number;
  createdAt: string;
  deliveredAt: string | null;
  nextRetryAt: string | null;
}

export interface WebhookEvent {
  id: string;
  name: string;
  category: string;
}

export interface WebhookStats {
  total: number;
  success: number;
  failed: number;
  pending: number;
  successRate: number;
  avgResponseTime: number | null;
}

interface WebhookState {
  webhooks: Webhook[];
  selectedWebhook: Webhook | null;
  logs: WebhookLog[];
  events: WebhookEvent[];
  stats: WebhookStats | null;
  isLoading: boolean;
  isCreating: boolean;
  isTesting: boolean;
  error: string | null;
  logsTotal: number;
  logsOffset: number;
  
  setWebhooks: (webhooks: Webhook[]) => void;
  setSelectedWebhook: (webhook: Webhook | null) => void;
  setLogs: (logs: WebhookLog[], total: number) => void;
  appendLogs: (logs: WebhookLog[], total: number) => void;
  setEvents: (events: WebhookEvent[]) => void;
  setStats: (stats: WebhookStats | null) => void;
  setLoading: (loading: boolean) => void;
  setCreating: (creating: boolean) => void;
  setTesting: (testing: boolean) => void;
  setError: (error: string | null) => void;
  updateWebhookInList: (webhook: Webhook) => void;
  removeWebhookFromList: (id: string) => void;
  updateLogStatus: (logId: string, status: WebhookLog['status']) => void;
}

export const useWebhookStore = create<WebhookState>()((set) => ({
  webhooks: [],
  selectedWebhook: null,
  logs: [],
  events: [],
  stats: null,
  isLoading: false,
  isCreating: false,
  isTesting: false,
  error: null,
  logsTotal: 0,
  logsOffset: 0,

  setWebhooks: (webhooks) => set({ webhooks }),
  setSelectedWebhook: (webhook) => set({ selectedWebhook: webhook, logs: [], stats: null, logsOffset: 0 }),
  setLogs: (logs, total) => set({ logs, logsTotal: total, logsOffset: logs.length }),
  appendLogs: (logs, total) => set((state) => ({
    logs: [...state.logs, ...logs],
    logsTotal: total,
    logsOffset: state.logsOffset + logs.length,
  })),
  setEvents: (events) => set({ events }),
  setStats: (stats) => set({ stats }),
  setLoading: (loading) => set({ isLoading: loading }),
  setCreating: (creating) => set({ isCreating: creating }),
  setTesting: (testing) => set({ isTesting: testing }),
  setError: (error) => set({ error }),
  
  updateWebhookInList: (webhook) => set((state) => ({
    webhooks: state.webhooks.map((w) => (w.id === webhook.id ? webhook : w)),
    selectedWebhook: state.selectedWebhook?.id === webhook.id ? webhook : state.selectedWebhook,
  })),
  
  removeWebhookFromList: (id) => set((state) => ({
    webhooks: state.webhooks.filter((w) => w.id !== id),
    selectedWebhook: state.selectedWebhook?.id === id ? null : state.selectedWebhook,
  })),
  
  updateLogStatus: (logId, status) => set((state) => ({
    logs: state.logs.map((l) => (l.id === logId ? { ...l, status } : l)),
  })),
}));
