import axios from 'axios';

export class PineconeStore {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.PINECONE_API_KEY;
    this.environment = config.environment || process.env.PINECONE_ENVIRONMENT;
    this.indexName = config.indexName || config.collectionName || 'default';
    this.namespace = config.namespace || '';
    this.dimensions = config.dimensions;
    this.metric = config.distanceMetric || 'cosine';
    this.host = null;
    this.client = null;
  }

  async initialize(dimensions) {
    this.dimensions = dimensions || this.dimensions;
    
    if (!this.apiKey) {
      throw new Error('Pinecone API key required');
    }

    const controlPlane = axios.create({
      baseURL: 'https://api.pinecone.io',
      headers: { 'Api-Key': this.apiKey },
      timeout: 30000,
    });

    const indexesResponse = await controlPlane.get('/indexes');
    const indexes = indexesResponse.data.indexes || [];
    const existingIndex = indexes.find(idx => idx.name === this.indexName);

    if (!existingIndex) {
      await controlPlane.post('/indexes', {
        name: this.indexName,
        dimension: this.dimensions,
        metric: this.metric,
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1',
          },
        },
      });

      await this.waitForIndex(controlPlane);
    }

    const describeResponse = await controlPlane.get(`/indexes/${this.indexName}`);
    this.host = describeResponse.data.host;

    this.client = axios.create({
      baseURL: `https://${this.host}`,
      headers: { 'Api-Key': this.apiKey },
      timeout: 30000,
    });

    return { success: true, index: this.indexName, host: this.host };
  }

  async waitForIndex(controlPlane, maxWait = 60000) {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWait) {
      const response = await controlPlane.get(`/indexes/${this.indexName}`);
      if (response.data.status?.ready) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    throw new Error('Index creation timeout');
  }

  async upsert(vectors, options = {}) {
    const batchSize = options.batchSize || 100;
    const results = [];

    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);
      const pineconeVectors = batch.map((v, idx) => ({
        id: String(v.id || `${Date.now()}_${i + idx}`),
        values: v.vector,
        metadata: v.metadata || {},
      }));

      const response = await this.client.post('/vectors/upsert', {
        vectors: pineconeVectors,
        namespace: this.namespace,
      });

      results.push({
        batch: Math.floor(i / batchSize) + 1,
        count: pineconeVectors.length,
        upsertedCount: response.data.upsertedCount,
      });
    }

    return { success: true, batches: results, total: vectors.length };
  }

  async search(queryVector, options = {}) {
    const topK = options.topK || 5;
    const filter = options.filter || null;
    const includeMetadata = options.includeMetadata !== false;
    const includeValues = options.includeVector || false;

    const body = {
      vector: queryVector,
      topK,
      includeMetadata,
      includeValues,
      namespace: this.namespace,
    };

    if (filter) {
      body.filter = this.buildFilter(filter);
    }

    const response = await this.client.post('/query', body);

    return response.data.matches.map(match => ({
      id: match.id,
      score: match.score,
      metadata: match.metadata,
      vector: match.values,
    }));
  }

  async searchBatch(queryVectors, options = {}) {
    const queries = queryVectors.map(vector => ({
      vector,
      topK: options.topK || 5,
      includeMetadata: options.includeMetadata !== false,
      filter: options.filter ? this.buildFilter(options.filter) : undefined,
      namespace: this.namespace,
    }));

    const results = await Promise.all(
      queries.map(query => this.client.post('/query', query))
    );

    return results.map(response =>
      response.data.matches.map(match => ({
        id: match.id,
        score: match.score,
        metadata: match.metadata,
      }))
    );
  }

  async delete(ids) {
    await this.client.post('/vectors/delete', {
      ids: ids.map(String),
      namespace: this.namespace,
    });
    return { success: true, deleted: ids.length };
  }

  async deleteByFilter(filter) {
    await this.client.post('/vectors/delete', {
      filter: this.buildFilter(filter),
      namespace: this.namespace,
    });
    return { success: true };
  }

  async deleteAll() {
    await this.client.post('/vectors/delete', {
      deleteAll: true,
      namespace: this.namespace,
    });
    return { success: true };
  }

  async fetch(ids) {
    const response = await this.client.get('/vectors/fetch', {
      params: {
        ids: ids.map(String).join(','),
        namespace: this.namespace,
      },
    });

    const vectors = response.data.vectors || {};
    return Object.entries(vectors).map(([id, data]) => ({
      id,
      vector: data.values,
      metadata: data.metadata,
    }));
  }

  async update(id, vector, metadata) {
    const body = {
      id: String(id),
      namespace: this.namespace,
    };

    if (vector) body.values = vector;
    if (metadata) body.setMetadata = metadata;

    await this.client.post('/vectors/update', body);
    return { success: true };
  }

  async count() {
    const response = await this.client.post('/describe_index_stats', {});
    const nsStats = response.data.namespaces?.[this.namespace || ''] || {};
    return nsStats.vectorCount || 0;
  }

  async getIndexStats() {
    const response = await this.client.post('/describe_index_stats', {});
    return {
      name: this.indexName,
      dimensions: response.data.dimension,
      totalVectorCount: response.data.totalVectorCount,
      namespaces: response.data.namespaces,
    };
  }

  buildFilter(filter) {
    if (filter.$and || filter.$or) {
      return filter;
    }

    const conditions = {};
    for (const [key, value] of Object.entries(filter)) {
      if (typeof value === 'object' && value !== null) {
        if (value.$in) {
          conditions[key] = { $in: value.$in };
        } else if (value.$nin) {
          conditions[key] = { $nin: value.$nin };
        } else if (value.$eq !== undefined) {
          conditions[key] = { $eq: value.$eq };
        } else if (value.$ne !== undefined) {
          conditions[key] = { $ne: value.$ne };
        } else if (value.$gt !== undefined) {
          conditions[key] = { $gt: value.$gt };
        } else if (value.$gte !== undefined) {
          conditions[key] = { $gte: value.$gte };
        } else if (value.$lt !== undefined) {
          conditions[key] = { $lt: value.$lt };
        } else if (value.$lte !== undefined) {
          conditions[key] = { $lte: value.$lte };
        } else {
          conditions[key] = value;
        }
      } else {
        conditions[key] = { $eq: value };
      }
    }

    return conditions;
  }

  async healthCheck() {
    try {
      await this.client.post('/describe_index_stats', {});
      return { healthy: true, store: 'pinecone', index: this.indexName };
    } catch (error) {
      return { healthy: false, store: 'pinecone', error: error.message };
    }
  }
}

export default PineconeStore;
