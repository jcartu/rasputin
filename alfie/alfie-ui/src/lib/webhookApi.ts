import type { Webhook, WebhookLog, WebhookEvent, WebhookStats } from './webhookStore';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || error.details || 'Request failed');
  }
  return response.json();
}

export const webhookApi = {
  async list(): Promise<{ webhooks: Webhook[] }> {
    const response = await fetch(`${API_BASE}/api/webhooks`);
    return handleResponse(response);
  },

  async get(id: string): Promise<Webhook> {
    const response = await fetch(`${API_BASE}/api/webhooks/${id}`);
    return handleResponse(response);
  },

  async create(data: {
    name: string;
    url: string;
    events?: string[];
    description?: string;
    headers?: Record<string, string>;
    template?: Record<string, unknown>;
    retryCount?: number;
    retryDelay?: number;
    timeout?: number;
    enabled?: boolean;
  }): Promise<Webhook> {
    const response = await fetch(`${API_BASE}/api/webhooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async update(id: string, data: Partial<Webhook>): Promise<Webhook> {
    const response = await fetch(`${API_BASE}/api/webhooks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async delete(id: string): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE}/api/webhooks/${id}`, {
      method: 'DELETE',
    });
    return handleResponse(response);
  },

  async regenerateSecret(id: string): Promise<{ secret: string }> {
    const response = await fetch(`${API_BASE}/api/webhooks/${id}/regenerate-secret`, {
      method: 'POST',
    });
    return handleResponse(response);
  },

  async test(id: string): Promise<{ success: boolean; statusCode?: number; error?: string; logId: string }> {
    const response = await fetch(`${API_BASE}/api/webhooks/${id}/test`, {
      method: 'POST',
    });
    return handleResponse(response);
  },

  async getLogs(
    id: string,
    options?: { limit?: number; offset?: number; status?: string; eventType?: string }
  ): Promise<{ logs: WebhookLog[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.offset) params.set('offset', options.offset.toString());
    if (options?.status) params.set('status', options.status);
    if (options?.eventType) params.set('eventType', options.eventType);

    const response = await fetch(`${API_BASE}/api/webhooks/${id}/logs?${params}`);
    return handleResponse(response);
  },

  async getAllLogs(options?: {
    limit?: number;
    offset?: number;
    status?: string;
    eventType?: string;
    webhookId?: string;
  }): Promise<{ logs: WebhookLog[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.offset) params.set('offset', options.offset.toString());
    if (options?.status) params.set('status', options.status);
    if (options?.eventType) params.set('eventType', options.eventType);
    if (options?.webhookId) params.set('webhookId', options.webhookId);

    const response = await fetch(`${API_BASE}/api/webhooks/logs?${params}`);
    return handleResponse(response);
  },

  async getStats(id: string): Promise<WebhookStats> {
    const response = await fetch(`${API_BASE}/api/webhooks/${id}/stats`);
    return handleResponse(response);
  },

  async clearLogs(id: string, olderThan?: string): Promise<{ deletedCount: number }> {
    const params = olderThan ? `?olderThan=${encodeURIComponent(olderThan)}` : '';
    const response = await fetch(`${API_BASE}/api/webhooks/${id}/logs${params}`, {
      method: 'DELETE',
    });
    return handleResponse(response);
  },

  async retryDelivery(logId: string): Promise<{ success: boolean; error?: string }> {
    const response = await fetch(`${API_BASE}/api/webhooks/logs/${logId}/retry`, {
      method: 'POST',
    });
    return handleResponse(response);
  },

  async getEventTypes(): Promise<{ events: WebhookEvent[] }> {
    const response = await fetch(`${API_BASE}/api/webhooks/events`);
    return handleResponse(response);
  },
};
