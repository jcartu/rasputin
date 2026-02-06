import axios from 'axios';

const DEFAULT_URL = 'http://localhost:6333';

export class QdrantStore {
  constructor(config = {}) {
    this.url = config.url || process.env.QDRANT_URL || DEFAULT_URL;
    this.apiKey = config.apiKey || process.env.QDRANT_API_KEY;
    this.collectionName = config.collectionName || 'default';
    this.distanceMetric = config.distanceMetric || 'Cosine';
    this.dimensions = config.dimensions;
    this.client = axios.create({
      baseURL: this.url,
      headers: this.apiKey ? { 'api-key': this.apiKey } : {},
      timeout: 30000,
    });
  }

  async initialize(dimensions) {
    this.dimensions = dimensions || this.dimensions;
    const collections = await this.listCollections();
    
    if (!collections.includes(this.collectionName)) {
      await this.createCollection();
    }
    
    return { success: true, collection: this.collectionName };
  }

  async listCollections() {
    const response = await this.client.get('/collections');
    return response.data.result.collections.map(c => c.name);
  }

  async createCollection() {
    const distanceMap = {
      cosine: 'Cosine',
      euclidean: 'Euclid',
      dot_product: 'Dot',
    };

    const config = {
      vectors: {
        size: this.dimensions,
        distance: distanceMap[this.distanceMetric.toLowerCase()] || 'Cosine',
      },
      optimizers_config: {
        default_segment_number: 2,
        memmap_threshold: 20000,
      },
      hnsw_config: {
        m: 16,
        ef_construct: 100,
        full_scan_threshold: 10000,
      },
    };

    await this.client.put(`/collections/${this.collectionName}`, config);
    return { success: true, collection: this.collectionName };
  }

  async deleteCollection() {
    await this.client.delete(`/collections/${this.collectionName}`);
    return { success: true };
  }

  async upsert(vectors, options = {}) {
    const batchSize = options.batchSize || 100;
    const results = [];
    
    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);
      const points = batch.map((v, idx) => ({
        id: v.id || `${Date.now()}_${i + idx}`,
        vector: v.vector,
        payload: v.metadata || {},
      }));

      const response = await this.client.put(
        `/collections/${this.collectionName}/points`,
        { points },
        { params: { wait: true } }
      );
      
      results.push({
        batch: Math.floor(i / batchSize) + 1,
        count: points.length,
        status: response.data.status,
      });
    }
    
    return { success: true, batches: results, total: vectors.length };
  }

  async search(queryVector, options = {}) {
    const topK = options.topK || 5;
    const scoreThreshold = options.scoreThreshold || 0;
    const filter = options.filter || null;
    const withPayload = options.includeMetadata !== false;
    const withVector = options.includeVector || false;

    const body = {
      vector: queryVector,
      limit: topK,
      score_threshold: scoreThreshold,
      with_payload: withPayload,
      with_vector: withVector,
    };

    if (filter) {
      body.filter = this.buildFilter(filter);
    }

    const response = await this.client.post(
      `/collections/${this.collectionName}/points/search`,
      body
    );

    return response.data.result.map(point => ({
      id: point.id,
      score: point.score,
      metadata: point.payload,
      vector: point.vector,
    }));
  }

  async searchBatch(queryVectors, options = {}) {
    const searches = queryVectors.map(vector => ({
      vector,
      limit: options.topK || 5,
      score_threshold: options.scoreThreshold || 0,
      with_payload: options.includeMetadata !== false,
      filter: options.filter ? this.buildFilter(options.filter) : undefined,
    }));

    const response = await this.client.post(
      `/collections/${this.collectionName}/points/search/batch`,
      { searches }
    );

    return response.data.result.map(results =>
      results.map(point => ({
        id: point.id,
        score: point.score,
        metadata: point.payload,
      }))
    );
  }

  async hybridSearch(queryVector, sparseVector, options = {}) {
    const body = {
      prefetch: [
        {
          query: queryVector,
          using: 'dense',
          limit: options.fetchK || 20,
        },
      ],
      query: { fusion: 'rrf' },
      limit: options.topK || 5,
      with_payload: true,
    };

    if (sparseVector) {
      body.prefetch.push({
        query: sparseVector,
        using: 'sparse',
        limit: options.fetchK || 20,
      });
    }

    const response = await this.client.post(
      `/collections/${this.collectionName}/points/query`,
      body
    );

    return response.data.result.map(point => ({
      id: point.id,
      score: point.score,
      metadata: point.payload,
    }));
  }

  async delete(ids) {
    await this.client.post(
      `/collections/${this.collectionName}/points/delete`,
      { points: ids },
      { params: { wait: true } }
    );
    return { success: true, deleted: ids.length };
  }

  async deleteByFilter(filter) {
    await this.client.post(
      `/collections/${this.collectionName}/points/delete`,
      { filter: this.buildFilter(filter) },
      { params: { wait: true } }
    );
    return { success: true };
  }

  async getPoint(id) {
    const response = await this.client.get(
      `/collections/${this.collectionName}/points/${id}`
    );
    const point = response.data.result;
    return {
      id: point.id,
      vector: point.vector,
      metadata: point.payload,
    };
  }

  async getPoints(ids) {
    const response = await this.client.post(
      `/collections/${this.collectionName}/points`,
      { ids, with_payload: true, with_vector: true }
    );
    return response.data.result.map(point => ({
      id: point.id,
      vector: point.vector,
      metadata: point.payload,
    }));
  }

  async count(filter = null) {
    const body = filter ? { filter: this.buildFilter(filter), exact: true } : { exact: true };
    const response = await this.client.post(
      `/collections/${this.collectionName}/points/count`,
      body
    );
    return response.data.result.count;
  }

  async getCollectionInfo() {
    const response = await this.client.get(`/collections/${this.collectionName}`);
    const info = response.data.result;
    return {
      name: this.collectionName,
      vectorCount: info.points_count,
      indexedVectorCount: info.indexed_vectors_count,
      status: info.status,
      config: info.config,
    };
  }

  async scroll(options = {}) {
    const limit = options.limit || 100;
    const offset = options.offset || null;
    const filter = options.filter || null;

    const body = {
      limit,
      with_payload: true,
      with_vector: options.includeVector || false,
    };

    if (offset) body.offset = offset;
    if (filter) body.filter = this.buildFilter(filter);

    const response = await this.client.post(
      `/collections/${this.collectionName}/points/scroll`,
      body
    );

    return {
      points: response.data.result.points.map(point => ({
        id: point.id,
        vector: point.vector,
        metadata: point.payload,
      })),
      nextOffset: response.data.result.next_page_offset,
    };
  }

  buildFilter(filter) {
    if (filter.must || filter.should || filter.must_not) {
      return filter;
    }

    const conditions = [];
    for (const [key, value] of Object.entries(filter)) {
      if (typeof value === 'object' && value !== null) {
        if (value.$in) {
          conditions.push({ key, match: { any: value.$in } });
        } else if (value.$gt !== undefined) {
          conditions.push({ key, range: { gt: value.$gt } });
        } else if (value.$gte !== undefined) {
          conditions.push({ key, range: { gte: value.$gte } });
        } else if (value.$lt !== undefined) {
          conditions.push({ key, range: { lt: value.$lt } });
        } else if (value.$lte !== undefined) {
          conditions.push({ key, range: { lte: value.$lte } });
        } else if (value.$ne !== undefined) {
          conditions.push({ key, match: { value: value.$ne }, is_empty: false });
        }
      } else {
        conditions.push({ key, match: { value } });
      }
    }

    return { must: conditions };
  }

  async healthCheck() {
    try {
      await this.client.get('/');
      return { healthy: true, store: 'qdrant', url: this.url };
    } catch (error) {
      return { healthy: false, store: 'qdrant', error: error.message };
    }
  }
}

export default QdrantStore;
