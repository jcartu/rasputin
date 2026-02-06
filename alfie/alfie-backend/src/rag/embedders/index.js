import axios from 'axios';
import { EmbeddingModel } from '../types.js';

export class Embedder {
  constructor(config = {}) {
    this.model = config.model || EmbeddingModel.OPENAI_3_SMALL;
    this.batchSize = config.batchSize || 100;
    this.dimensions = config.dimensions || null;
    this.apiKey = config.apiKey;
    this.client = null;
    this.provider = this.detectProvider();
  }

  detectProvider() {
    const model = this.model.toLowerCase();
    
    if (model.includes('text-embedding') || model.startsWith('openai')) {
      return 'openai';
    }
    if (model.includes('embed-') && (model.includes('english') || model.includes('multilingual'))) {
      return 'cohere';
    }
    if (model.includes('bge') || model.includes('e5') || model.includes('instructor') || model.includes('/')) {
      return 'huggingface';
    }
    if (model.includes('voyage')) {
      return 'voyage';
    }
    if (model === 'ollama') {
      return 'ollama';
    }
    
    return 'openai';
  }

  async initialize() {
    const initializers = {
      openai: () => this.initializeOpenAI(),
      cohere: () => this.initializeCohere(),
      huggingface: () => this.initializeHuggingFace(),
      voyage: () => this.initializeVoyage(),
      ollama: () => this.initializeOllama(),
    };

    const initializer = initializers[this.provider];
    if (initializer) {
      await initializer();
    }

    return { provider: this.provider, model: this.model, dimensions: this.dimensions };
  }

  initializeOpenAI() {
    const apiKey = this.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OpenAI API key required');

    this.client = axios.create({
      baseURL: 'https://api.openai.com/v1',
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 60000,
    });

    const dimensionMap = {
      'text-embedding-ada-002': 1536,
      'text-embedding-3-small': 1536,
      'text-embedding-3-large': 3072,
    };
    this.dimensions = this.dimensions || dimensionMap[this.model] || 1536;
  }

  initializeCohere() {
    const apiKey = this.apiKey || process.env.COHERE_API_KEY;
    if (!apiKey) throw new Error('Cohere API key required');

    this.client = axios.create({
      baseURL: 'https://api.cohere.ai/v1',
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 60000,
    });

    const dimensionMap = {
      'embed-english-v3.0': 1024,
      'embed-multilingual-v3.0': 1024,
      'embed-english-light-v3.0': 384,
    };
    this.dimensions = this.dimensions || dimensionMap[this.model] || 1024;
  }

  initializeHuggingFace() {
    const apiKey = this.apiKey || process.env.HUGGINGFACE_API_KEY;
    
    this.client = axios.create({
      baseURL: 'https://api-inference.huggingface.co',
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      timeout: 120000,
    });

    const dimensionMap = {
      'BAAI/bge-small-en-v1.5': 384,
      'BAAI/bge-base-en-v1.5': 768,
      'BAAI/bge-large-en-v1.5': 1024,
      'intfloat/e5-small-v2': 384,
      'intfloat/e5-base-v2': 768,
      'intfloat/e5-large-v2': 1024,
      'hkunlp/instructor-large': 768,
    };
    this.dimensions = this.dimensions || dimensionMap[this.model] || 768;
  }

  initializeVoyage() {
    const apiKey = this.apiKey || process.env.VOYAGE_API_KEY;
    if (!apiKey) throw new Error('Voyage API key required');

    this.client = axios.create({
      baseURL: 'https://api.voyageai.com/v1',
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 60000,
    });

    const dimensionMap = {
      'voyage-02': 1024,
      'voyage-code-02': 1536,
    };
    this.dimensions = this.dimensions || dimensionMap[this.model] || 1024;
  }

  initializeOllama() {
    const url = process.env.OLLAMA_URL || 'http://localhost:11434';
    
    this.client = axios.create({
      baseURL: url,
      timeout: 120000,
    });
    
    this.dimensions = this.dimensions || 4096;
  }

  async embed(texts) {
    if (!Array.isArray(texts)) {
      texts = [texts];
    }

    const embedders = {
      openai: () => this.embedOpenAI(texts),
      cohere: () => this.embedCohere(texts),
      huggingface: () => this.embedHuggingFace(texts),
      voyage: () => this.embedVoyage(texts),
      ollama: () => this.embedOllama(texts),
    };

    const embedder = embedders[this.provider];
    if (!embedder) {
      throw new Error(`Unknown embedding provider: ${this.provider}`);
    }

    return embedder();
  }

  async embedBatch(texts, onProgress = null) {
    const results = [];
    
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize);
      const embeddings = await this.embed(batch);
      results.push(...embeddings);

      if (onProgress) {
        onProgress({
          processed: Math.min(i + this.batchSize, texts.length),
          total: texts.length,
          percentage: Math.round((Math.min(i + this.batchSize, texts.length) / texts.length) * 100),
        });
      }
    }

    return results;
  }

  async embedOpenAI(texts) {
    const response = await this.client.post('/embeddings', {
      model: this.model,
      input: texts,
      dimensions: this.model === 'text-embedding-3-small' || this.model === 'text-embedding-3-large' 
        ? this.dimensions 
        : undefined,
    });

    return response.data.data
      .sort((a, b) => a.index - b.index)
      .map(item => item.embedding);
  }

  async embedCohere(texts) {
    const response = await this.client.post('/embed', {
      model: this.model,
      texts,
      input_type: 'search_document',
      truncate: 'END',
    });

    return response.data.embeddings;
  }

  async embedHuggingFace(texts) {
    const results = [];
    
    for (const text of texts) {
      const response = await this.client.post(
        `/pipeline/feature-extraction/${this.model}`,
        { inputs: text, options: { wait_for_model: true } }
      );
      
      let embedding = response.data;
      if (Array.isArray(embedding) && Array.isArray(embedding[0])) {
        embedding = this.meanPooling(embedding);
      }
      
      results.push(embedding);
    }

    return results;
  }

  async embedVoyage(texts) {
    const response = await this.client.post('/embeddings', {
      model: this.model,
      input: texts,
      input_type: 'document',
    });

    return response.data.data.map(item => item.embedding);
  }

  async embedOllama(texts) {
    const results = [];
    
    for (const text of texts) {
      const response = await this.client.post('/api/embeddings', {
        model: this.model === 'ollama' ? 'nomic-embed-text' : this.model,
        prompt: text,
      });
      
      results.push(response.data.embedding);
    }

    return results;
  }

  meanPooling(tokenEmbeddings) {
    const numTokens = tokenEmbeddings.length;
    const embeddingDim = tokenEmbeddings[0].length;
    
    const result = new Array(embeddingDim).fill(0);
    for (const tokenEmb of tokenEmbeddings) {
      for (let i = 0; i < embeddingDim; i++) {
        result[i] += tokenEmb[i];
      }
    }
    
    return result.map(v => v / numTokens);
  }

  async embedQuery(text) {
    if (this.provider === 'cohere') {
      const response = await this.client.post('/embed', {
        model: this.model,
        texts: [text],
        input_type: 'search_query',
        truncate: 'END',
      });
      return response.data.embeddings[0];
    }
    
    const embeddings = await this.embed([text]);
    return embeddings[0];
  }

  getDimensions() {
    return this.dimensions;
  }
}

export function createEmbedder(config = {}) {
  return new Embedder(config);
}

export default { Embedder, createEmbedder };
