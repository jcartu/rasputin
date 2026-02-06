import { create } from 'zustand';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface DatasetExample {
  id: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  estimatedTokens: number;
  addedAt: string;
}

export interface Dataset {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'validated' | 'invalid' | 'uploaded';
  examples: DatasetExample[];
  stats: {
    totalExamples: number;
    totalTokens: number;
    avgTokensPerExample: number;
  };
  validation: DatasetValidation | null;
  openaiFileId?: string;
}

export interface DatasetValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalExamples: number;
    totalTokens: number;
    avgTokensPerExample: number;
    minTokens: number;
    maxTokens: number;
  };
  validatedAt: string;
}

export interface TrainingJob {
  id: string;
  datasetId?: string;
  baseModel: string;
  suffix?: string;
  hyperparameters: {
    n_epochs: number | 'auto';
    batch_size: number | 'auto';
    learning_rate_multiplier: number | 'auto';
  };
  status: 'validating_files' | 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  createdAt: string;
  fineTunedModel?: string;
  trainedTokens?: number;
  error?: { message: string };
  metrics?: TrainingMetrics;
}

export interface TrainingMetrics {
  steps: number[];
  trainingLoss: Array<{ step: number; value: number }>;
  validationLoss: Array<{ step: number; value: number }>;
  trainingTokenAccuracy: Array<{ step: number; value: number }>;
  summary?: {
    finalTrainingLoss: number;
    minTrainingLoss: number;
    avgTrainingLoss: number;
    totalSteps: number;
    finalValidationLoss?: number;
  };
}

export interface ModelVersion {
  id: string;
  modelId: string;
  name: string;
  description: string;
  jobId?: string;
  datasetId?: string;
  baseModel?: string;
  metrics?: TrainingMetrics;
  tags: string[];
  createdAt: string;
  isActive: boolean;
}

export interface Evaluation {
  id: string;
  modelId: string;
  testDatasetId: string;
  name: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  results: Array<{
    exampleId: string;
    expectedResponse?: string;
    actualResponse?: string;
    similarity?: number;
    passed: boolean;
    error?: string;
  }>;
  metrics?: {
    accuracy: number;
    passRate: string;
    avgSimilarity: number;
    minSimilarity: number;
    maxSimilarity: number;
  };
}

export interface HyperparameterPreset {
  name: string;
  description: string;
  params: {
    n_epochs: number | 'auto';
    learning_rate_multiplier: number | 'auto';
    batch_size: number | 'auto';
  };
}

export interface DashboardSummary {
  datasets: { total: number; validated: number; totalExamples: number };
  jobs: { total: number; running: number; succeeded: number; failed: number };
  models: { total: number; active: number };
  recentJobs: Array<{ id: string; status: string; baseModel: string; createdAt: string }>;
}

interface FineTuneState {
  datasets: Dataset[];
  jobs: TrainingJob[];
  versions: ModelVersion[];
  evaluations: Evaluation[];
  presets: Record<string, HyperparameterPreset>;
  supportedModels: string[];
  dashboard: DashboardSummary | null;
  
  selectedDataset: Dataset | null;
  selectedJob: TrainingJob | null;
  selectedVersion: ModelVersion | null;
  
  isLoading: boolean;
  error: string | null;
  
  activeTab: 'dashboard' | 'datasets' | 'jobs' | 'models' | 'evaluations';
  
  fetchDashboard: () => Promise<void>;
  fetchDatasets: () => Promise<void>;
  fetchJobs: () => Promise<void>;
  fetchVersions: () => Promise<void>;
  fetchEvaluations: () => Promise<void>;
  fetchPresets: () => Promise<void>;
  fetchSupportedModels: () => Promise<void>;
  
  createDataset: (name: string, description?: string) => Promise<Dataset>;
  deleteDataset: (id: string) => Promise<void>;
  addExamples: (datasetId: string, examples: Array<{ messages: Array<{ role: string; content: string }> }>) => Promise<void>;
  validateDataset: (id: string) => Promise<DatasetValidation>;
  buildFromSessions: (name: string, sessionIds?: string[], options?: Record<string, unknown>) => Promise<Dataset>;
  uploadDataset: (id: string) => Promise<{ fileId: string }>;
  
  createJob: (options: {
    datasetId?: string;
    trainingFileId?: string;
    baseModel?: string;
    suffix?: string;
    hyperparameters?: Record<string, unknown>;
  }) => Promise<TrainingJob>;
  cancelJob: (id: string) => Promise<void>;
  getJobProgress: (id: string) => Promise<{ chartData: unknown; summary: unknown }>;
  
  registerVersion: (options: {
    modelId: string;
    name: string;
    description?: string;
    jobId?: string;
    tags?: string[];
  }) => Promise<ModelVersion>;
  activateVersion: (id: string) => Promise<void>;
  
  createEvaluation: (options: {
    modelId: string;
    testDatasetId: string;
    name?: string;
  }) => Promise<Evaluation>;
  
  setActiveTab: (tab: 'dashboard' | 'datasets' | 'jobs' | 'models' | 'evaluations') => void;
  selectDataset: (dataset: Dataset | null) => void;
  selectJob: (job: TrainingJob | null) => void;
  selectVersion: (version: ModelVersion | null) => void;
  setError: (error: string | null) => void;
}

export const useFineTuneStore = create<FineTuneState>()((set, get) => ({
  datasets: [],
  jobs: [],
  versions: [],
  evaluations: [],
  presets: {},
  supportedModels: [],
  dashboard: null,
  
  selectedDataset: null,
  selectedJob: null,
  selectedVersion: null,
  
  isLoading: false,
  error: null,
  
  activeTab: 'dashboard',
  
  fetchDashboard: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/finetune/dashboard`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      set({ dashboard: data, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },
  
  fetchDatasets: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/finetune/datasets`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      set({ datasets: data.datasets, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },
  
  fetchJobs: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/finetune/jobs?local=true`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      set({ jobs: data.jobs, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },
  
  fetchVersions: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/finetune/versions`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      set({ versions: data.versions, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },
  
  fetchEvaluations: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/finetune/evaluations`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      set({ evaluations: data.evaluations, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },
  
  fetchPresets: async () => {
    try {
      const res = await fetch(`${API_BASE}/api/finetune/hyperparameters/presets`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      set({ presets: data.presets });
    } catch (err) {
      console.error('Failed to fetch presets:', err);
    }
  },
  
  fetchSupportedModels: async () => {
    try {
      const res = await fetch(`${API_BASE}/api/finetune/supported-models`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      set({ supportedModels: data.models });
    } catch (err) {
      console.error('Failed to fetch supported models:', err);
    }
  },
  
  createDataset: async (name, description) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/finetune/datasets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      set((state) => ({ datasets: [...state.datasets, data], isLoading: false }));
      return data;
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      throw err;
    }
  },
  
  deleteDataset: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/finetune/datasets/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      set((state) => ({
        datasets: state.datasets.filter((d) => d.id !== id),
        selectedDataset: state.selectedDataset?.id === id ? null : state.selectedDataset,
        isLoading: false,
      }));
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      throw err;
    }
  },
  
  addExamples: async (datasetId, examples) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/finetune/datasets/${datasetId}/examples/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examples }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await get().fetchDatasets();
      set({ isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      throw err;
    }
  },
  
  validateDataset: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/finetune/datasets/${id}/validate`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await get().fetchDatasets();
      set({ isLoading: false });
      return data;
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      throw err;
    }
  },
  
  buildFromSessions: async (name, sessionIds, options) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/finetune/datasets/from-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, sessionIds, options }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      set((state) => ({ datasets: [...state.datasets, data], isLoading: false }));
      return data;
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      throw err;
    }
  },
  
  uploadDataset: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/finetune/datasets/${id}/upload`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await get().fetchDatasets();
      set({ isLoading: false });
      return data;
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      throw err;
    }
  },
  
  createJob: async (options) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/finetune/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      set((state) => ({ jobs: [...state.jobs, data], isLoading: false }));
      return data;
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      throw err;
    }
  },
  
  cancelJob: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/finetune/jobs/${id}/cancel`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await get().fetchJobs();
      set({ isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      throw err;
    }
  },
  
  getJobProgress: async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/finetune/jobs/${id}/progress`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data;
    } catch (err) {
      console.error('Failed to get job progress:', err);
      throw err;
    }
  },
  
  registerVersion: async (options) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/finetune/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      set((state) => ({ versions: [...state.versions, data], isLoading: false }));
      return data;
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      throw err;
    }
  },
  
  activateVersion: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/finetune/versions/${id}/activate`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await get().fetchVersions();
      set({ isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      throw err;
    }
  },
  
  createEvaluation: async (options) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/finetune/evaluations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      set((state) => ({ evaluations: [...state.evaluations, data], isLoading: false }));
      return data;
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      throw err;
    }
  },
  
  setActiveTab: (tab) => set({ activeTab: tab }),
  selectDataset: (dataset) => set({ selectedDataset: dataset }),
  selectJob: (job) => set({ selectedJob: job }),
  selectVersion: (version) => set({ selectedVersion: version }),
  setError: (error) => set({ error }),
}));
