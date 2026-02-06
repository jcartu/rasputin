import type {
  AIModel,
  ProviderConfig,
  CustomEndpoint,
  ModelTestResponse,
  ModelComparisonResponse,
  UsageStatsResponse,
  MarketplaceModel,
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export const modelsApi = {
  listModels: () => 
    fetchApi<{ models: AIModel[]; providers: ProviderConfig[] }>('/api/models'),

  getModel: (id: string) =>
    fetchApi<AIModel>(`/api/models/${id}`),

  testModel: (modelId: string, prompt?: string) =>
    fetchApi<ModelTestResponse>('/api/models/test', {
      method: 'POST',
      body: JSON.stringify({ modelId, prompt }),
    }),

  compareModels: async (
    modelIds: string[],
    prompt: string,
    onUpdate: (modelId: string, update: Partial<ModelComparisonResponse>) => void
  ) => {
    const response = await fetch(`${API_BASE}/api/models/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelIds, prompt }),
    });

    if (!response.ok) {
      throw new Error('Comparison request failed');
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.modelId) {
              onUpdate(data.modelId, data);
            }
          } catch {
            continue;
          }
        }
      }
    }
  },

  setActiveModel: (modelId: string) =>
    fetchApi<{ success: boolean }>('/api/models/active', {
      method: 'POST',
      body: JSON.stringify({ modelId }),
    }),

  getProviders: () =>
    fetchApi<{ providers: ProviderConfig[] }>('/api/models/providers'),

  updateProvider: (providerId: string, updates: Partial<ProviderConfig>) =>
    fetchApi<ProviderConfig>(`/api/models/providers/${providerId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  testProvider: (providerId: string) =>
    fetchApi<{ success: boolean; error?: string }>(`/api/models/providers/${providerId}/test`, {
      method: 'POST',
    }),

  addCustomEndpoint: (endpoint: Omit<CustomEndpoint, 'id' | 'createdAt'>) =>
    fetchApi<CustomEndpoint>('/api/models/endpoints', {
      method: 'POST',
      body: JSON.stringify(endpoint),
    }),

  updateCustomEndpoint: (id: string, updates: Partial<CustomEndpoint>) =>
    fetchApi<CustomEndpoint>(`/api/models/endpoints/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  deleteCustomEndpoint: (id: string) =>
    fetchApi<{ success: boolean }>(`/api/models/endpoints/${id}`, {
      method: 'DELETE',
    }),

  testCustomEndpoint: (id: string) =>
    fetchApi<ModelTestResponse>(`/api/models/endpoints/${id}/test`, {
      method: 'POST',
    }),

  discoverModels: (endpointId: string) =>
    fetchApi<{ models: string[] }>(`/api/models/endpoints/${endpointId}/discover`, {
      method: 'POST',
    }),

  getUsageStats: (params?: { startDate?: Date; endDate?: Date; modelId?: string }) =>
    fetchApi<UsageStatsResponse>('/api/models/usage', {
      method: 'POST',
      body: JSON.stringify({
        startDate: params?.startDate?.toISOString(),
        endDate: params?.endDate?.toISOString(),
        modelId: params?.modelId,
      }),
    }),

  getMarketplace: (category?: string, search?: string) =>
    fetchApi<{ models: MarketplaceModel[] }>(
      `/api/models/marketplace?${new URLSearchParams({
        ...(category && category !== 'all' ? { category } : {}),
        ...(search ? { search } : {}),
      })}`
    ),

  installModel: (marketplaceModelId: string) =>
    fetchApi<AIModel>('/api/models/marketplace/install', {
      method: 'POST',
      body: JSON.stringify({ modelId: marketplaceModelId }),
    }),

  uninstallModel: (modelId: string) =>
    fetchApi<{ success: boolean }>(`/api/models/${modelId}`, {
      method: 'DELETE',
    }),
};
