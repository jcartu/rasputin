import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const defaultProviders = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4, GPT-3.5 and other OpenAI models',
    baseUrl: 'https://api.openai.com/v1',
    apiKeyName: 'OPENAI_API_KEY',
    isEnabled: true,
    isConfigured: !!process.env.OPENAI_API_KEY,
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
    isConfigured: !!process.env.ANTHROPIC_API_KEY,
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
    isConfigured: !!process.env.GOOGLE_API_KEY,
    icon: 'Globe',
    models: [],
  },
  {
    id: 'local',
    name: 'Local Models',
    description: 'Self-hosted models via VLLM, Ollama, etc.',
    baseUrl: process.env.LOCAL_MODEL_URL || 'http://localhost:8001/v1',
    apiKeyName: '',
    isEnabled: true,
    isConfigured: true,
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
    isConfigured: !!process.env.OPENROUTER_API_KEY,
    icon: 'Route',
    models: [],
  },
];

const defaultModels = [
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    modelId: 'gpt-4-turbo-preview',
    description: 'Most capable GPT-4 model, optimized for chat',
    capabilities: ['chat', 'function-calling', 'vision', 'streaming', 'json-mode'],
    pricing: { inputPerMillion: 10, outputPerMillion: 30, currency: 'USD' },
    limits: { maxContextTokens: 128000, maxOutputTokens: 4096 },
    status: 'available',
    metrics: { averageLatency: 0, tokensPerSecond: 0, successRate: 1, totalRequests: 0, totalInputTokens: 0, totalOutputTokens: 0, totalCost: 0, errorCount: 0 },
    isDefault: true,
    tags: ['gpt-4', 'chat', 'vision'],
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    modelId: 'gpt-4o',
    description: 'Flagship multimodal model with native vision',
    capabilities: ['chat', 'function-calling', 'vision', 'streaming', 'json-mode'],
    pricing: { inputPerMillion: 5, outputPerMillion: 15, currency: 'USD' },
    limits: { maxContextTokens: 128000, maxOutputTokens: 4096 },
    status: 'available',
    metrics: { averageLatency: 0, tokensPerSecond: 0, successRate: 1, totalRequests: 0, totalInputTokens: 0, totalOutputTokens: 0, totalCost: 0, errorCount: 0 },
    tags: ['gpt-4', 'multimodal', 'vision'],
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'openai',
    modelId: 'gpt-3.5-turbo',
    description: 'Fast and cost-effective for simpler tasks',
    capabilities: ['chat', 'function-calling', 'streaming', 'json-mode'],
    pricing: { inputPerMillion: 0.5, outputPerMillion: 1.5, currency: 'USD' },
    limits: { maxContextTokens: 16385, maxOutputTokens: 4096 },
    status: 'available',
    metrics: { averageLatency: 0, tokensPerSecond: 0, successRate: 1, totalRequests: 0, totalInputTokens: 0, totalOutputTokens: 0, totalCost: 0, errorCount: 0 },
    tags: ['gpt-3.5', 'fast', 'cheap'],
  },
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    modelId: 'claude-3-5-sonnet-20241022',
    description: 'Most intelligent Claude model, excellent at coding',
    capabilities: ['chat', 'function-calling', 'vision', 'streaming'],
    pricing: { inputPerMillion: 3, outputPerMillion: 15, currency: 'USD' },
    limits: { maxContextTokens: 200000, maxOutputTokens: 8192 },
    status: 'available',
    metrics: { averageLatency: 0, tokensPerSecond: 0, successRate: 1, totalRequests: 0, totalInputTokens: 0, totalOutputTokens: 0, totalCost: 0, errorCount: 0 },
    tags: ['claude', 'coding', 'vision'],
  },
  {
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    provider: 'anthropic',
    modelId: 'claude-3-opus-20240229',
    description: 'Powerful model for complex tasks',
    capabilities: ['chat', 'function-calling', 'vision', 'streaming'],
    pricing: { inputPerMillion: 15, outputPerMillion: 75, currency: 'USD' },
    limits: { maxContextTokens: 200000, maxOutputTokens: 4096 },
    status: 'available',
    metrics: { averageLatency: 0, tokensPerSecond: 0, successRate: 1, totalRequests: 0, totalInputTokens: 0, totalOutputTokens: 0, totalCost: 0, errorCount: 0 },
    tags: ['claude', 'powerful', 'vision'],
  },
  {
    id: 'claude-3-haiku',
    name: 'Claude 3 Haiku',
    provider: 'anthropic',
    modelId: 'claude-3-haiku-20240307',
    description: 'Fastest Claude model for quick tasks',
    capabilities: ['chat', 'function-calling', 'vision', 'streaming'],
    pricing: { inputPerMillion: 0.25, outputPerMillion: 1.25, currency: 'USD' },
    limits: { maxContextTokens: 200000, maxOutputTokens: 4096 },
    status: 'available',
    metrics: { averageLatency: 0, tokensPerSecond: 0, successRate: 1, totalRequests: 0, totalInputTokens: 0, totalOutputTokens: 0, totalCost: 0, errorCount: 0 },
    tags: ['claude', 'fast', 'cheap'],
  },
  {
    id: 'gemini-pro',
    name: 'Gemini Pro',
    provider: 'google',
    modelId: 'gemini-pro',
    description: 'Google\'s best model for text generation',
    capabilities: ['chat', 'function-calling', 'streaming'],
    pricing: { inputPerMillion: 0.5, outputPerMillion: 1.5, currency: 'USD' },
    limits: { maxContextTokens: 32000, maxOutputTokens: 8192 },
    status: 'available',
    metrics: { averageLatency: 0, tokensPerSecond: 0, successRate: 1, totalRequests: 0, totalInputTokens: 0, totalOutputTokens: 0, totalCost: 0, errorCount: 0 },
    tags: ['gemini', 'google'],
  },
  {
    id: 'gemini-pro-vision',
    name: 'Gemini Pro Vision',
    provider: 'google',
    modelId: 'gemini-pro-vision',
    description: 'Multimodal model with vision capabilities',
    capabilities: ['chat', 'vision', 'streaming'],
    pricing: { inputPerMillion: 0.5, outputPerMillion: 1.5, currency: 'USD' },
    limits: { maxContextTokens: 32000, maxOutputTokens: 8192 },
    status: 'available',
    metrics: { averageLatency: 0, tokensPerSecond: 0, successRate: 1, totalRequests: 0, totalInputTokens: 0, totalOutputTokens: 0, totalCost: 0, errorCount: 0 },
    tags: ['gemini', 'google', 'vision'],
  },
];

const marketplaceModels = [
  {
    id: 'mp-gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    modelId: 'gpt-4-turbo-preview',
    description: 'Most capable GPT-4 model, optimized for chat and complex reasoning',
    longDescription: 'GPT-4 Turbo is OpenAI\'s flagship model, featuring enhanced capabilities for complex reasoning, coding, and creative tasks. It supports vision inputs and has a 128K context window.',
    capabilities: ['chat', 'function-calling', 'vision', 'streaming', 'json-mode'],
    pricing: { inputPerMillion: 10, outputPerMillion: 30, currency: 'USD' },
    limits: { maxContextTokens: 128000, maxOutputTokens: 4096 },
    category: 'general',
    tags: ['gpt-4', 'chat', 'vision', 'coding', 'reasoning'],
    rating: 4.8,
    reviewCount: 12500,
    downloadCount: 850000,
    releaseDate: '2024-01-25',
    lastUpdated: '2024-11-15',
    author: 'OpenAI',
    website: 'https://platform.openai.com/docs/models/gpt-4-turbo',
    benchmarks: [
      { name: 'MMLU', score: 86.4, maxScore: 100, category: 'knowledge' },
      { name: 'HumanEval', score: 85.0, maxScore: 100, category: 'coding' },
      { name: 'GSM8K', score: 92.0, maxScore: 100, category: 'math' },
    ],
    isFeatured: true,
    isNew: false,
  },
  {
    id: 'mp-claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    modelId: 'claude-3-5-sonnet-20241022',
    description: 'Most intelligent Claude model with exceptional coding abilities',
    longDescription: 'Claude 3.5 Sonnet sets new industry benchmarks for graduate-level reasoning, coding proficiency, and nuanced content creation. It excels at complex multi-step tasks.',
    capabilities: ['chat', 'function-calling', 'vision', 'streaming'],
    pricing: { inputPerMillion: 3, outputPerMillion: 15, currency: 'USD' },
    limits: { maxContextTokens: 200000, maxOutputTokens: 8192 },
    category: 'coding',
    tags: ['claude', 'coding', 'vision', 'reasoning', 'anthropic'],
    rating: 4.9,
    reviewCount: 8500,
    downloadCount: 650000,
    releaseDate: '2024-10-22',
    lastUpdated: '2024-10-22',
    author: 'Anthropic',
    website: 'https://docs.anthropic.com/claude/docs/models-overview',
    benchmarks: [
      { name: 'MMLU', score: 88.7, maxScore: 100, category: 'knowledge' },
      { name: 'HumanEval', score: 92.0, maxScore: 100, category: 'coding' },
      { name: 'GSM8K', score: 96.4, maxScore: 100, category: 'math' },
    ],
    isFeatured: true,
    isNew: true,
  },
  {
    id: 'mp-gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    modelId: 'gpt-4o',
    description: 'Flagship multimodal model with native vision and audio',
    longDescription: 'GPT-4o ("o" for "omni") is OpenAI\'s most advanced model with native multimodal capabilities. It can reason across text, images, and audio inputs seamlessly.',
    capabilities: ['chat', 'function-calling', 'vision', 'streaming', 'json-mode'],
    pricing: { inputPerMillion: 5, outputPerMillion: 15, currency: 'USD' },
    limits: { maxContextTokens: 128000, maxOutputTokens: 4096 },
    category: 'general',
    tags: ['gpt-4', 'multimodal', 'vision', 'audio', 'flagship'],
    rating: 4.7,
    reviewCount: 6200,
    downloadCount: 420000,
    releaseDate: '2024-05-13',
    lastUpdated: '2024-08-06',
    author: 'OpenAI',
    website: 'https://platform.openai.com/docs/models/gpt-4o',
    benchmarks: [
      { name: 'MMLU', score: 87.2, maxScore: 100, category: 'knowledge' },
      { name: 'HumanEval', score: 90.2, maxScore: 100, category: 'coding' },
      { name: 'GSM8K', score: 94.8, maxScore: 100, category: 'math' },
    ],
    isFeatured: true,
    isNew: false,
  },
  {
    id: 'mp-claude-3-haiku',
    name: 'Claude 3 Haiku',
    provider: 'anthropic',
    modelId: 'claude-3-haiku-20240307',
    description: 'Fastest and most affordable Claude model',
    longDescription: 'Claude 3 Haiku is designed for speed and efficiency. It\'s ideal for high-volume, latency-sensitive applications while maintaining strong capabilities.',
    capabilities: ['chat', 'function-calling', 'vision', 'streaming'],
    pricing: { inputPerMillion: 0.25, outputPerMillion: 1.25, currency: 'USD' },
    limits: { maxContextTokens: 200000, maxOutputTokens: 4096 },
    category: 'general',
    tags: ['claude', 'fast', 'cheap', 'efficient'],
    rating: 4.5,
    reviewCount: 4500,
    downloadCount: 380000,
    releaseDate: '2024-03-07',
    lastUpdated: '2024-03-07',
    author: 'Anthropic',
    website: 'https://docs.anthropic.com/claude/docs/models-overview',
    benchmarks: [
      { name: 'MMLU', score: 75.2, maxScore: 100, category: 'knowledge' },
      { name: 'HumanEval', score: 75.9, maxScore: 100, category: 'coding' },
    ],
    isFeatured: false,
    isNew: false,
  },
  {
    id: 'mp-deepseek-coder',
    name: 'DeepSeek Coder V2',
    provider: 'openrouter',
    modelId: 'deepseek/deepseek-coder',
    description: 'Specialized coding model with excellent code generation',
    longDescription: 'DeepSeek Coder V2 is a specialized model trained on code, excelling at code generation, explanation, and debugging tasks.',
    capabilities: ['chat', 'completion', 'streaming'],
    pricing: { inputPerMillion: 0.14, outputPerMillion: 0.28, currency: 'USD' },
    limits: { maxContextTokens: 128000, maxOutputTokens: 4096 },
    category: 'coding',
    tags: ['coding', 'deepseek', 'code-generation', 'debugging'],
    rating: 4.6,
    reviewCount: 2800,
    downloadCount: 185000,
    releaseDate: '2024-06-17',
    lastUpdated: '2024-06-17',
    author: 'DeepSeek',
    website: 'https://www.deepseek.com/',
    benchmarks: [
      { name: 'HumanEval', score: 90.2, maxScore: 100, category: 'coding' },
      { name: 'MBPP', score: 88.4, maxScore: 100, category: 'coding' },
    ],
    isFeatured: false,
    isNew: true,
  },
  {
    id: 'mp-llama-3-70b',
    name: 'Llama 3 70B',
    provider: 'local',
    modelId: 'meta-llama/Llama-3-70b-chat-hf',
    description: 'Meta\'s most capable open-source model',
    longDescription: 'Llama 3 70B is Meta\'s flagship open-source model, offering exceptional performance on reasoning and coding tasks while being fully self-hostable.',
    capabilities: ['chat', 'completion', 'streaming'],
    pricing: { inputPerMillion: 0, outputPerMillion: 0, currency: 'USD' },
    limits: { maxContextTokens: 8192, maxOutputTokens: 4096 },
    category: 'general',
    tags: ['llama', 'meta', 'open-source', 'self-hosted'],
    rating: 4.4,
    reviewCount: 3200,
    downloadCount: 520000,
    releaseDate: '2024-04-18',
    lastUpdated: '2024-04-18',
    author: 'Meta',
    website: 'https://llama.meta.com/',
    benchmarks: [
      { name: 'MMLU', score: 82.0, maxScore: 100, category: 'knowledge' },
      { name: 'HumanEval', score: 81.7, maxScore: 100, category: 'coding' },
    ],
    isFeatured: false,
    isNew: false,
  },
  {
    id: 'mp-mistral-large',
    name: 'Mistral Large',
    provider: 'openrouter',
    modelId: 'mistralai/mistral-large-latest',
    description: 'Mistral\'s flagship model for complex tasks',
    longDescription: 'Mistral Large is designed for complex reasoning tasks requiring substantial capabilities. It offers native function calling and multilingual support.',
    capabilities: ['chat', 'function-calling', 'streaming', 'json-mode'],
    pricing: { inputPerMillion: 4, outputPerMillion: 12, currency: 'USD' },
    limits: { maxContextTokens: 128000, maxOutputTokens: 4096 },
    category: 'general',
    tags: ['mistral', 'reasoning', 'multilingual', 'function-calling'],
    rating: 4.5,
    reviewCount: 2100,
    downloadCount: 145000,
    releaseDate: '2024-02-26',
    lastUpdated: '2024-11-18',
    author: 'Mistral AI',
    website: 'https://docs.mistral.ai/',
    benchmarks: [
      { name: 'MMLU', score: 81.2, maxScore: 100, category: 'knowledge' },
      { name: 'HumanEval', score: 84.0, maxScore: 100, category: 'coding' },
    ],
    isFeatured: false,
    isNew: false,
  },
  {
    id: 'mp-text-embedding-3-large',
    name: 'text-embedding-3-large',
    provider: 'openai',
    modelId: 'text-embedding-3-large',
    description: 'OpenAI\'s most capable embedding model',
    longDescription: 'text-embedding-3-large provides state-of-the-art semantic search and retrieval capabilities with 3072 dimensions and superior performance on benchmarks.',
    capabilities: ['embedding'],
    pricing: { inputPerMillion: 0.13, outputPerMillion: 0, currency: 'USD' },
    limits: { maxContextTokens: 8191, maxOutputTokens: 0 },
    category: 'embedding',
    tags: ['embedding', 'search', 'retrieval', 'openai'],
    rating: 4.7,
    reviewCount: 1800,
    downloadCount: 290000,
    releaseDate: '2024-01-25',
    lastUpdated: '2024-01-25',
    author: 'OpenAI',
    website: 'https://platform.openai.com/docs/guides/embeddings',
    benchmarks: [
      { name: 'MTEB', score: 64.6, maxScore: 100, category: 'retrieval' },
    ],
    isFeatured: false,
    isNew: false,
  },
];

let activeModelId = 'claude-3-5-sonnet';
const customEndpoints = [];
const usageRecords = [];

export function getModels() {
  return defaultModels;
}

export function getProviders() {
  return defaultProviders;
}

export function getModelById(id) {
  return defaultModels.find(m => m.id === id);
}

export function getActiveModel() {
  return defaultModels.find(m => m.id === activeModelId);
}

export function setActiveModel(modelId) {
  const model = defaultModels.find(m => m.id === modelId);
  if (model) {
    activeModelId = modelId;
    return { success: true };
  }
  throw new Error('Model not found');
}

export async function testModel(modelId, prompt = 'Hello, this is a test.') {
  const model = defaultModels.find(m => m.id === modelId);
  if (!model) throw new Error('Model not found');
  
  const provider = defaultProviders.find(p => p.id === model.provider);
  if (!provider) throw new Error('Provider not found');

  const start = Date.now();
  
  try {
    let response;
    
    if (model.provider === 'openai' || model.provider === 'openrouter') {
      const apiKey = model.provider === 'openai' 
        ? process.env.OPENAI_API_KEY 
        : process.env.OPENROUTER_API_KEY;
      
      if (!apiKey) throw new Error('API key not configured');
      
      response = await axios.post(
        `${provider.baseUrl}/chat/completions`,
        {
          model: model.modelId,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 50,
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );
    } else if (model.provider === 'anthropic') {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error('API key not configured');
      
      response = await axios.post(
        `${provider.baseUrl}/messages`,
        {
          model: model.modelId,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 50,
        },
        {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );
    } else if (model.provider === 'local') {
      response = await axios.post(
        `${provider.baseUrl}/chat/completions`,
        {
          model: model.modelId,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 50,
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000,
        }
      );
    }

    const latency = Date.now() - start;
    return {
      success: true,
      latency,
      response: response?.data?.choices?.[0]?.message?.content || response?.data?.content?.[0]?.text || 'OK',
    };
  } catch (error) {
    return {
      success: false,
      latency: Date.now() - start,
      error: error.response?.data?.error?.message || error.message,
    };
  }
}

export async function testProvider(providerId) {
  const provider = defaultProviders.find(p => p.id === providerId);
  if (!provider) throw new Error('Provider not found');

  try {
    if (providerId === 'local') {
      await axios.get(`${provider.baseUrl}/models`, { timeout: 5000 });
    } else if (providerId === 'openai') {
      await axios.get(`${provider.baseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
        timeout: 5000,
      });
    } else if (providerId === 'anthropic') {
      return { success: !!process.env.ANTHROPIC_API_KEY };
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export function addCustomEndpoint(endpoint) {
  const newEndpoint = {
    ...endpoint,
    id: uuidv4(),
    createdAt: new Date(),
    isActive: true,
  };
  customEndpoints.push(newEndpoint);
  return newEndpoint;
}

export function getCustomEndpoints() {
  return customEndpoints;
}

export function updateCustomEndpoint(id, updates) {
  const index = customEndpoints.findIndex(e => e.id === id);
  if (index === -1) throw new Error('Endpoint not found');
  customEndpoints[index] = { ...customEndpoints[index], ...updates };
  return customEndpoints[index];
}

export function deleteCustomEndpoint(id) {
  const index = customEndpoints.findIndex(e => e.id === id);
  if (index === -1) throw new Error('Endpoint not found');
  customEndpoints.splice(index, 1);
  return { success: true };
}

export async function testCustomEndpoint(id) {
  const endpoint = customEndpoints.find(e => e.id === id);
  if (!endpoint) throw new Error('Endpoint not found');

  const start = Date.now();
  try {
    await axios.get(`${endpoint.baseUrl}/models`, {
      headers: endpoint.apiKey ? { 'Authorization': `Bearer ${endpoint.apiKey}` } : {},
      timeout: 5000,
    });
    
    customEndpoints.find(e => e.id === id).lastTestedAt = new Date();
    customEndpoints.find(e => e.id === id).lastTestResult = 'success';
    
    return { success: true, latency: Date.now() - start };
  } catch (error) {
    customEndpoints.find(e => e.id === id).lastTestedAt = new Date();
    customEndpoints.find(e => e.id === id).lastTestResult = 'failure';
    
    return { success: false, latency: Date.now() - start, error: error.message };
  }
}

export async function discoverModels(endpointId) {
  const endpoint = customEndpoints.find(e => e.id === endpointId);
  if (!endpoint) throw new Error('Endpoint not found');

  try {
    const response = await axios.get(`${endpoint.baseUrl}/models`, {
      headers: endpoint.apiKey ? { 'Authorization': `Bearer ${endpoint.apiKey}` } : {},
      timeout: 10000,
    });
    
    const models = response.data?.data?.map(m => m.id) || [];
    endpoint.models = models;
    return { models };
  } catch (error) {
    throw new Error(`Failed to discover models: ${error.message}`);
  }
}

export function getMarketplaceModels(category, search) {
  let models = [...marketplaceModels];
  
  if (category && category !== 'all') {
    models = models.filter(m => m.category === category);
  }
  
  if (search) {
    const searchLower = search.toLowerCase();
    models = models.filter(m =>
      m.name.toLowerCase().includes(searchLower) ||
      m.description.toLowerCase().includes(searchLower) ||
      m.tags.some(t => t.toLowerCase().includes(searchLower))
    );
  }
  
  return models;
}

export function installMarketplaceModel(marketplaceModelId) {
  const mpModel = marketplaceModels.find(m => m.id === marketplaceModelId);
  if (!mpModel) throw new Error('Marketplace model not found');
  
  const existingModel = defaultModels.find(m => m.modelId === mpModel.modelId);
  if (existingModel) {
    return existingModel;
  }
  
  const newModel = {
    id: uuidv4(),
    name: mpModel.name,
    provider: mpModel.provider,
    modelId: mpModel.modelId,
    description: mpModel.description,
    capabilities: mpModel.capabilities,
    pricing: mpModel.pricing,
    limits: mpModel.limits,
    status: 'available',
    metrics: { averageLatency: 0, tokensPerSecond: 0, successRate: 1, totalRequests: 0, totalInputTokens: 0, totalOutputTokens: 0, totalCost: 0, errorCount: 0 },
    tags: mpModel.tags,
  };
  
  defaultModels.push(newModel);
  
  const mpIndex = marketplaceModels.findIndex(m => m.id === marketplaceModelId);
  if (mpIndex !== -1) {
    marketplaceModels[mpIndex].isInstalled = true;
  }
  
  return newModel;
}

export function uninstallModel(modelId) {
  const index = defaultModels.findIndex(m => m.id === modelId);
  if (index === -1) throw new Error('Model not found');
  
  if (defaultModels[index].isDefault) {
    throw new Error('Cannot uninstall default model');
  }
  
  const model = defaultModels[index];
  defaultModels.splice(index, 1);
  
  const mpModel = marketplaceModels.find(m => m.modelId === model.modelId);
  if (mpModel) {
    mpModel.isInstalled = false;
  }
  
  return { success: true };
}

export function addUsageRecord(record) {
  const fullRecord = {
    ...record,
    id: uuidv4(),
    timestamp: new Date(),
  };
  usageRecords.unshift(fullRecord);
  if (usageRecords.length > 1000) {
    usageRecords.pop();
  }
  return fullRecord;
}

export function getUsageStats(options = {}) {
  let records = [...usageRecords];
  
  if (options.startDate) {
    records = records.filter(r => new Date(r.timestamp) >= new Date(options.startDate));
  }
  if (options.endDate) {
    records = records.filter(r => new Date(r.timestamp) <= new Date(options.endDate));
  }
  if (options.modelId) {
    records = records.filter(r => r.modelId === options.modelId);
  }
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const costSummary = {
    today: records.filter(r => new Date(r.timestamp) >= today).reduce((sum, r) => sum + r.cost, 0),
    thisWeek: records.filter(r => new Date(r.timestamp) >= weekAgo).reduce((sum, r) => sum + r.cost, 0),
    thisMonth: records.filter(r => new Date(r.timestamp) >= monthAgo).reduce((sum, r) => sum + r.cost, 0),
    allTime: records.reduce((sum, r) => sum + r.cost, 0),
    byModel: {},
    byProvider: {},
  };
  
  records.forEach(r => {
    costSummary.byModel[r.modelId] = (costSummary.byModel[r.modelId] || 0) + r.cost;
    const model = defaultModels.find(m => m.id === r.modelId);
    if (model) {
      costSummary.byProvider[model.provider] = (costSummary.byProvider[model.provider] || 0) + r.cost;
    }
  });
  
  const latencies = records.map(r => r.latency).filter(l => l > 0).sort((a, b) => a - b);
  const performanceSummary = {
    averageLatency: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
    p50Latency: latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.5)] : 0,
    p95Latency: latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] : 0,
    p99Latency: latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.99)] : 0,
    averageTokensPerSecond: 0,
    successRate: records.length > 0 ? records.filter(r => r.success).length / records.length : 1,
    totalRequests: records.length,
    byModel: {},
  };
  
  return { records, costSummary, performanceSummary };
}
