import axios from 'axios';
import { RerankerModel } from '../types.js';

export class Reranker {
  constructor(config = {}) {
    this.model = config.model || RerankerModel.COHERE_RERANK;
    this.topN = config.topN || 3;
    this.returnDocuments = config.returnDocuments !== false;
    this.apiKey = config.apiKey;
    this.client = null;
    this.provider = this.detectProvider();
  }

  detectProvider() {
    const model = this.model.toLowerCase();
    
    if (model.includes('cohere')) {
      return 'cohere';
    }
    if (model.includes('bge-reranker')) {
      return 'huggingface';
    }
    if (model.includes('cross-encoder')) {
      return 'huggingface';
    }
    if (model.includes('flashrank')) {
      return 'flashrank';
    }
    if (model.includes('jina')) {
      return 'jina';
    }
    if (model === 'none') {
      return 'none';
    }
    
    return 'cohere';
  }

  async initialize() {
    const initializers = {
      cohere: () => this.initializeCohere(),
      huggingface: () => this.initializeHuggingFace(),
      jina: () => this.initializeJina(),
      flashrank: () => this.initializeFlashRank(),
      none: () => Promise.resolve(),
    };

    const initializer = initializers[this.provider];
    if (initializer) {
      await initializer();
    }

    return { provider: this.provider, model: this.model };
  }

  initializeCohere() {
    const apiKey = this.apiKey || process.env.COHERE_API_KEY;
    if (!apiKey) throw new Error('Cohere API key required for reranking');

    this.client = axios.create({
      baseURL: 'https://api.cohere.ai/v1',
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 60000,
    });
  }

  initializeHuggingFace() {
    const apiKey = this.apiKey || process.env.HUGGINGFACE_API_KEY;
    
    this.client = axios.create({
      baseURL: 'https://api-inference.huggingface.co',
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      timeout: 120000,
    });
  }

  initializeJina() {
    const apiKey = this.apiKey || process.env.JINA_API_KEY;
    if (!apiKey) throw new Error('Jina API key required for reranking');

    this.client = axios.create({
      baseURL: 'https://api.jina.ai/v1',
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 60000,
    });
  }

  initializeFlashRank() {
    const url = process.env.FLASHRANK_URL || 'http://localhost:8000';
    
    this.client = axios.create({
      baseURL: url,
      timeout: 30000,
    });
  }

  async rerank(query, documents, options = {}) {
    if (this.provider === 'none') {
      return documents.slice(0, options.topN || this.topN);
    }

    const rerankers = {
      cohere: () => this.rerankCohere(query, documents, options),
      huggingface: () => this.rerankHuggingFace(query, documents, options),
      jina: () => this.rerankJina(query, documents, options),
      flashrank: () => this.rerankFlashRank(query, documents, options),
    };

    const reranker = rerankers[this.provider];
    if (!reranker) {
      throw new Error(`Unknown reranker provider: ${this.provider}`);
    }

    return reranker();
  }

  async rerankCohere(query, documents, options = {}) {
    const topN = options.topN || this.topN;
    const docs = documents.map(doc => 
      typeof doc === 'string' ? doc : (doc.metadata?.content || doc.content || JSON.stringify(doc))
    );

    const response = await this.client.post('/rerank', {
      model: this.model.includes('cohere') ? this.model.replace('cohere-', '') : 'rerank-english-v3.0',
      query,
      documents: docs,
      top_n: topN,
      return_documents: this.returnDocuments,
    });

    return response.data.results.map(result => ({
      index: result.index,
      relevanceScore: result.relevance_score,
      document: this.returnDocuments ? {
        ...documents[result.index],
        content: result.document?.text || docs[result.index],
      } : documents[result.index],
    }));
  }

  async rerankHuggingFace(query, documents, options = {}) {
    const topN = options.topN || this.topN;
    const docs = documents.map(doc =>
      typeof doc === 'string' ? doc : (doc.metadata?.content || doc.content || JSON.stringify(doc))
    );

    const pairs = docs.map(doc => [query, doc]);
    
    const response = await this.client.post(
      `/models/${this.model}`,
      { inputs: pairs }
    );

    const scores = response.data;
    const indexed = scores.map((score, idx) => ({
      index: idx,
      relevanceScore: Array.isArray(score) ? score[0] : score,
      document: documents[idx],
    }));

    indexed.sort((a, b) => b.relevanceScore - a.relevanceScore);
    return indexed.slice(0, topN);
  }

  async rerankJina(query, documents, options = {}) {
    const topN = options.topN || this.topN;
    const docs = documents.map(doc =>
      typeof doc === 'string' ? doc : (doc.metadata?.content || doc.content || JSON.stringify(doc))
    );

    const response = await this.client.post('/rerank', {
      model: this.model,
      query,
      documents: docs,
      top_n: topN,
    });

    return response.data.results.map(result => ({
      index: result.index,
      relevanceScore: result.relevance_score,
      document: documents[result.index],
    }));
  }

  async rerankFlashRank(query, documents, options = {}) {
    const topN = options.topN || this.topN;
    const docs = documents.map(doc =>
      typeof doc === 'string' ? doc : (doc.metadata?.content || doc.content || JSON.stringify(doc))
    );

    const response = await this.client.post('/rerank', {
      query,
      passages: docs,
      top_k: topN,
    });

    return response.data.results.map(result => ({
      index: result.index,
      relevanceScore: result.score,
      document: documents[result.index],
    }));
  }

  async crossEncoderScore(query, document) {
    if (this.provider !== 'huggingface') {
      throw new Error('Cross-encoder scoring only available with HuggingFace models');
    }

    const text = typeof document === 'string' 
      ? document 
      : (document.metadata?.content || document.content || JSON.stringify(document));

    const response = await this.client.post(
      `/models/${this.model}`,
      { inputs: [[query, text]] }
    );

    return Array.isArray(response.data[0]) ? response.data[0][0] : response.data[0];
  }
}

export function createReranker(config = {}) {
  return new Reranker(config);
}

export default { Reranker, createReranker };
