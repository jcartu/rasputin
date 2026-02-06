import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AIModel,
  ProviderConfig,
  CustomEndpoint,
  ModelComparison,
  ModelComparisonResponse,
  CostSummary,
  PerformanceSummary,
  UsageRecord,
  ModelProvider,
  MarketplaceModel,
  MarketplaceCategory,
} from './types';

interface ModelState {
  models: AIModel[];
  providers: ProviderConfig[];
  customEndpoints: CustomEndpoint[];
  activeModelId: string | null;
  favoriteModelIds: string[];
  
  comparisons: ModelComparison[];
  activeComparisonId: string | null;
  
  usageRecords: UsageRecord[];
  costSummary: CostSummary;
  performanceSummary: PerformanceSummary;
  
  marketplaceModels: MarketplaceModel[];
  marketplaceCategory: MarketplaceCategory | 'all';
  marketplaceSearch: string;
  
  isLoading: boolean;
  error: string | null;
  
  isModelSelectorOpen: boolean;
  isComparisonViewOpen: boolean;
  isMarketplaceOpen: boolean;
  isProviderSettingsOpen: boolean;
  
  setModels: (models: AIModel[]) => void;
  setProviders: (providers: ProviderConfig[]) => void;
  setActiveModel: (modelId: string | null) => void;
  toggleFavorite: (modelId: string) => void;
  
  addCustomEndpoint: (endpoint: Omit<CustomEndpoint, 'id' | 'createdAt'>) => void;
  updateCustomEndpoint: (id: string, updates: Partial<CustomEndpoint>) => void;
  removeCustomEndpoint: (id: string) => void;
  
  startComparison: (modelIds: string[], prompt: string) => string;
  updateComparisonResponse: (comparisonId: string, modelId: string, updates: Partial<ModelComparisonResponse>) => void;
  saveComparison: (comparisonId: string, name: string) => void;
  deleteComparison: (comparisonId: string) => void;
  setActiveComparison: (comparisonId: string | null) => void;
  
  addUsageRecord: (record: Omit<UsageRecord, 'id'>) => void;
  updateModelMetrics: (modelId: string, latency: number, inputTokens: number, outputTokens: number, success: boolean, error?: string) => void;
  
  setMarketplaceModels: (models: MarketplaceModel[]) => void;
  setMarketplaceCategory: (category: MarketplaceCategory | 'all') => void;
  setMarketplaceSearch: (search: string) => void;
  installMarketplaceModel: (modelId: string) => void;
  
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  setModelSelectorOpen: (open: boolean) => void;
  setComparisonViewOpen: (open: boolean) => void;
  setMarketplaceOpen: (open: boolean) => void;
  setProviderSettingsOpen: (open: boolean) => void;
  
  getModelById: (id: string) => AIModel | undefined;
  getModelsByProvider: (provider: ModelProvider) => AIModel[];
  getAvailableModels: () => AIModel[];
  getFavoriteModels: () => AIModel[];
}

const defaultCostSummary: CostSummary = {
  today: 0,
  thisWeek: 0,
  thisMonth: 0,
  allTime: 0,
  byModel: {},
  byProvider: {} as Record<ModelProvider, number>,
};

const defaultPerformanceSummary: PerformanceSummary = {
  averageLatency: 0,
  p50Latency: 0,
  p95Latency: 0,
  p99Latency: 0,
  averageTokensPerSecond: 0,
  successRate: 1,
  totalRequests: 0,
  byModel: {},
};

const defaultProviders: ProviderConfig[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4, GPT-3.5 and other OpenAI models',
    baseUrl: 'https://api.openai.com/v1',
    apiKeyName: 'OPENAI_API_KEY',
    isEnabled: true,
    isConfigured: false,
    icon: 'Sparkles',
    models: [],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude 3.5, Claude 3 and other Anthropic models',
    baseUrl: 'https://api.anthropic.com/v1',
    apiKeyName: 'ANTHROPIC_API_KEY',
    isEnabled: true,
    isConfigured: false,
    icon: 'Brain',
    models: [],
  },
  {
    id: 'google',
    name: 'Google AI',
    description: 'Gemini Pro and other Google models',
    baseUrl: 'https://generativelanguage.googleapis.com/v1',
    apiKeyName: 'GOOGLE_API_KEY',
    isEnabled: true,
    isConfigured: false,
    icon: 'Globe',
    models: [],
  },
  {
    id: 'local',
    name: 'Local Models',
    description: 'Self-hosted models via VLLM, Ollama, etc.',
    baseUrl: 'http://localhost:8001/v1',
    apiKeyName: '',
    isEnabled: true,
    isConfigured: false,
    icon: 'Server',
    models: [],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Access multiple providers through one API',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKeyName: 'OPENROUTER_API_KEY',
    isEnabled: true,
    isConfigured: false,
    icon: 'Route',
    models: [],
  },
];

export const useModelStore = create<ModelState>()(
  persist(
    (set, get) => ({
      models: [],
      providers: defaultProviders,
      customEndpoints: [],
      activeModelId: null,
      favoriteModelIds: [],
      
      comparisons: [],
      activeComparisonId: null,
      
      usageRecords: [],
      costSummary: defaultCostSummary,
      performanceSummary: defaultPerformanceSummary,
      
      marketplaceModels: [],
      marketplaceCategory: 'all',
      marketplaceSearch: '',
      
      isLoading: false,
      error: null,
      
      isModelSelectorOpen: false,
      isComparisonViewOpen: false,
      isMarketplaceOpen: false,
      isProviderSettingsOpen: false,
      
      setModels: (models) => set({ models }),
      setProviders: (providers) => set({ providers }),
      
      setActiveModel: (modelId) => set({ activeModelId: modelId }),
      
      toggleFavorite: (modelId) => set((state) => {
        const isFavorite = state.favoriteModelIds.includes(modelId);
        return {
          favoriteModelIds: isFavorite
            ? state.favoriteModelIds.filter(id => id !== modelId)
            : [...state.favoriteModelIds, modelId],
          models: state.models.map(m => 
            m.id === modelId ? { ...m, isFavorite: !isFavorite } : m
          ),
        };
      }),
      
      addCustomEndpoint: (endpoint) => set((state) => ({
        customEndpoints: [
          ...state.customEndpoints,
          {
            ...endpoint,
            id: crypto.randomUUID(),
            createdAt: new Date(),
          },
        ],
      })),
      
      updateCustomEndpoint: (id, updates) => set((state) => ({
        customEndpoints: state.customEndpoints.map(e =>
          e.id === id ? { ...e, ...updates } : e
        ),
      })),
      
      removeCustomEndpoint: (id) => set((state) => ({
        customEndpoints: state.customEndpoints.filter(e => e.id !== id),
      })),
      
      startComparison: (modelIds, prompt) => {
        const id = crypto.randomUUID();
        const comparison: ModelComparison = {
          id,
          name: `Comparison ${new Date().toLocaleString()}`,
          models: modelIds,
          prompt,
          responses: modelIds.map(modelId => ({
            modelId,
            response: '',
            latency: 0,
            inputTokens: 0,
            outputTokens: 0,
            cost: 0,
            status: 'pending',
            timestamp: new Date(),
          })),
          createdAt: new Date(),
          isSaved: false,
        };
        set((state) => ({
          comparisons: [comparison, ...state.comparisons],
          activeComparisonId: id,
          isComparisonViewOpen: true,
        }));
        return id;
      },
      
      updateComparisonResponse: (comparisonId, modelId, updates) => set((state) => ({
        comparisons: state.comparisons.map(c =>
          c.id === comparisonId
            ? {
                ...c,
                responses: c.responses.map(r =>
                  r.modelId === modelId ? { ...r, ...updates } : r
                ),
              }
            : c
        ),
      })),
      
      saveComparison: (comparisonId, name) => set((state) => ({
        comparisons: state.comparisons.map(c =>
          c.id === comparisonId ? { ...c, name, isSaved: true } : c
        ),
      })),
      
      deleteComparison: (comparisonId) => set((state) => ({
        comparisons: state.comparisons.filter(c => c.id !== comparisonId),
        activeComparisonId: state.activeComparisonId === comparisonId ? null : state.activeComparisonId,
      })),
      
      setActiveComparison: (comparisonId) => set({ activeComparisonId: comparisonId }),
      
      addUsageRecord: (record) => {
        const fullRecord: UsageRecord = {
          ...record,
          id: crypto.randomUUID(),
        };
        set((state) => {
          const newRecords = [fullRecord, ...state.usageRecords].slice(0, 1000);
          const cost = record.inputTokens * 0.00001 + record.outputTokens * 0.00003;
          
          return {
            usageRecords: newRecords,
            costSummary: {
              ...state.costSummary,
              today: state.costSummary.today + cost,
              thisWeek: state.costSummary.thisWeek + cost,
              thisMonth: state.costSummary.thisMonth + cost,
              allTime: state.costSummary.allTime + cost,
              byModel: {
                ...state.costSummary.byModel,
                [record.modelId]: (state.costSummary.byModel[record.modelId] || 0) + cost,
              },
            },
          };
        });
      },
      
      updateModelMetrics: (modelId, latency, inputTokens, outputTokens, success, error) => set((state) => ({
        models: state.models.map(m => {
          if (m.id !== modelId) return m;
          const metrics = m.metrics;
          const totalRequests = metrics.totalRequests + 1;
          const newAvgLatency = (metrics.averageLatency * metrics.totalRequests + latency) / totalRequests;
          const tokensPerSecond = outputTokens / (latency / 1000);
          const newSuccessRate = (metrics.successRate * metrics.totalRequests + (success ? 1 : 0)) / totalRequests;
          
          return {
            ...m,
            metrics: {
              ...metrics,
              averageLatency: newAvgLatency,
              tokensPerSecond: (metrics.tokensPerSecond + tokensPerSecond) / 2,
              successRate: newSuccessRate,
              totalRequests,
              totalInputTokens: metrics.totalInputTokens + inputTokens,
              totalOutputTokens: metrics.totalOutputTokens + outputTokens,
              errorCount: metrics.errorCount + (success ? 0 : 1),
              lastUsed: new Date(),
              lastError: error,
            },
          };
        }),
      })),
      
      setMarketplaceModels: (models) => set({ marketplaceModels: models }),
      setMarketplaceCategory: (category) => set({ marketplaceCategory: category }),
      setMarketplaceSearch: (search) => set({ marketplaceSearch: search }),
      
      installMarketplaceModel: (marketplaceModelId) => set((state) => {
        const marketplaceModel = state.marketplaceModels.find(m => m.id === marketplaceModelId);
        if (!marketplaceModel) return state;
        
        const newModel: AIModel = {
          id: crypto.randomUUID(),
          name: marketplaceModel.name,
          provider: marketplaceModel.provider,
          modelId: marketplaceModel.modelId,
          description: marketplaceModel.description,
          capabilities: marketplaceModel.capabilities,
          pricing: marketplaceModel.pricing,
          limits: marketplaceModel.limits,
          status: 'available',
          metrics: {
            averageLatency: 0,
            tokensPerSecond: 0,
            successRate: 1,
            totalRequests: 0,
            totalInputTokens: 0,
            totalOutputTokens: 0,
            totalCost: 0,
            errorCount: 0,
          },
          tags: marketplaceModel.tags,
        };
        
        return {
          models: [...state.models, newModel],
          marketplaceModels: state.marketplaceModels.map(m =>
            m.id === marketplaceModelId ? { ...m, isInstalled: true } : m
          ),
        };
      }),
      
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
      
      setModelSelectorOpen: (open) => set({ isModelSelectorOpen: open }),
      setComparisonViewOpen: (open) => set({ isComparisonViewOpen: open }),
      setMarketplaceOpen: (open) => set({ isMarketplaceOpen: open }),
      setProviderSettingsOpen: (open) => set({ isProviderSettingsOpen: open }),
      
      getModelById: (id) => get().models.find(m => m.id === id),
      getModelsByProvider: (provider) => get().models.filter(m => m.provider === provider),
      getAvailableModels: () => get().models.filter(m => m.status === 'available'),
      getFavoriteModels: () => get().models.filter(m => get().favoriteModelIds.includes(m.id)),
    }),
    {
      name: 'alfie-model-storage',
      partialize: (state) => ({
        activeModelId: state.activeModelId,
        favoriteModelIds: state.favoriteModelIds,
        customEndpoints: state.customEndpoints,
        comparisons: state.comparisons.filter(c => c.isSaved),
        costSummary: state.costSummary,
        usageRecords: state.usageRecords.slice(0, 100),
      }),
    }
  )
);
