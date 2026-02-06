const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export type ShareVisibility = 'public' | 'private' | 'unlisted';
export type ExpiresIn = '1h' | '24h' | '7d' | '30d' | 'never';

export interface CreateShareOptions {
  sessionId: string;
  title?: string;
  description?: string;
  visibility?: ShareVisibility;
  viewOnly?: boolean;
  allowComments?: boolean;
  allowCopy?: boolean;
  allowEmbed?: boolean;
  password?: string;
  expiresIn?: ExpiresIn;
  maxViews?: number;
  allowedEmails?: string[];
  createSnapshot?: boolean;
  snapshotName?: string;
}

export interface Share {
  id: string;
  token: string;
  sessionId: string;
  snapshotId: string | null;
  visibility: ShareVisibility;
  viewOnly: boolean;
  allowComments: boolean;
  allowCopy: boolean;
  allowEmbed: boolean;
  hasPassword: boolean;
  maxViews: number | null;
  allowedEmails: string[];
  title: string;
  description: string;
  createdAt: string;
  createdBy: string;
  expiresAt: string | null;
  viewCount: number;
  lastViewedAt: string | null;
  shareUrl: string;
  embedCode: string | null;
  isExpired?: boolean;
}

export interface ShareStats {
  total: number;
  active: number;
  expired: number;
  public: number;
  private: number;
  unlisted: number;
  passwordProtected: number;
  totalViews: number;
  snapshotsCount: number;
}

export interface ShareListResponse {
  shares: Share[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ShareAccessResult {
  valid: boolean;
  error?: string;
  requiresPassword?: boolean;
  share?: {
    id: string;
    title: string;
    description: string;
    viewOnly: boolean;
    allowComments: boolean;
    allowCopy: boolean;
    createdAt: string;
    viewCount: number;
  };
  session?: {
    messages: Array<{
      id: string;
      role: string;
      content: string;
      timestamp: string;
    }>;
    metadata: Record<string, unknown>;
    createdAt: string;
  };
}

export interface ShareCheckResult {
  exists: boolean;
  title: string;
  description: string;
  requiresPassword: boolean;
  isExpired: boolean;
  isMaxViewsReached: boolean;
  visibility: ShareVisibility;
  viewOnly: boolean;
  allowCopy: boolean;
  createdAt: string;
}

export interface Snapshot {
  id: string;
  sessionId: string;
  name: string;
  description: string;
  createdAt: string;
  data: {
    messages: Array<{
      id: string;
      role: string;
      content: string;
      timestamp: string;
    }>;
    metadata: Record<string, unknown>;
    createdAt: string;
  };
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || error.details || 'Request failed');
  }
  return response.json();
}

export const shareApi = {
  async create(options: CreateShareOptions): Promise<Share> {
    const response = await fetch(`${API_BASE}/api/shares`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });
    return handleResponse<Share>(response);
  },

  async list(params?: {
    status?: 'active' | 'expired';
    visibility?: ShareVisibility;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }): Promise<ShareListResponse> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
    }
    const response = await fetch(`${API_BASE}/api/shares?${searchParams}`);
    return handleResponse<ShareListResponse>(response);
  },

  async getStats(): Promise<ShareStats> {
    const response = await fetch(`${API_BASE}/api/shares/stats`);
    return handleResponse<ShareStats>(response);
  },

  async getForSession(sessionId: string): Promise<{ shares: Share[] }> {
    const response = await fetch(`${API_BASE}/api/shares/session/${sessionId}`);
    return handleResponse<{ shares: Share[] }>(response);
  },

  async get(id: string): Promise<Share> {
    const response = await fetch(`${API_BASE}/api/shares/${id}`);
    return handleResponse<Share>(response);
  },

  async update(id: string, updates: Partial<CreateShareOptions>): Promise<Share> {
    const response = await fetch(`${API_BASE}/api/shares/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return handleResponse<Share>(response);
  },

  async delete(id: string): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE}/api/shares/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<{ success: boolean }>(response);
  },

  async regenerateToken(id: string): Promise<Share> {
    const response = await fetch(`${API_BASE}/api/shares/${id}/regenerate-token`, {
      method: 'POST',
    });
    return handleResponse<Share>(response);
  },

  async access(token: string, options?: { password?: string; email?: string }): Promise<ShareAccessResult> {
    const response = await fetch(`${API_BASE}/api/shares/access/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options || {}),
    });
    return handleResponse<ShareAccessResult>(response);
  },

  async verifyPassword(token: string, password: string): Promise<{ valid: boolean; error?: string }> {
    const response = await fetch(`${API_BASE}/api/shares/verify-password/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    return handleResponse<{ valid: boolean; error?: string }>(response);
  },

  async check(token: string): Promise<ShareCheckResult> {
    const response = await fetch(`${API_BASE}/api/shares/check/${token}`);
    return handleResponse<ShareCheckResult>(response);
  },

  async createSnapshot(sessionId: string, options?: { name?: string; description?: string }): Promise<Snapshot> {
    const response = await fetch(`${API_BASE}/api/shares/snapshots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, ...options }),
    });
    return handleResponse<Snapshot>(response);
  },

  async listSnapshots(sessionId: string): Promise<{ snapshots: Snapshot[] }> {
    const response = await fetch(`${API_BASE}/api/shares/snapshots/${sessionId}`);
    return handleResponse<{ snapshots: Snapshot[] }>(response);
  },

  async getSnapshot(id: string): Promise<Snapshot> {
    const response = await fetch(`${API_BASE}/api/shares/snapshot/${id}`);
    return handleResponse<Snapshot>(response);
  },

  async deleteSnapshot(id: string): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE}/api/shares/snapshot/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<{ success: boolean }>(response);
  },

  getShareUrl(token: string): string {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    return `${baseUrl}/share/${token}`;
  },

  getEmbedCode(token: string, options?: { width?: string; height?: string }): string {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const width = options?.width || '100%';
    const height = options?.height || '600';
    return `<iframe src="${baseUrl}/embed/${token}" width="${width}" height="${height}" frameborder="0" style="border-radius: 8px; border: 1px solid #333;"></iframe>`;
  },

  copyToClipboard(text: string): Promise<void> {
    return navigator.clipboard.writeText(text);
  },
};
