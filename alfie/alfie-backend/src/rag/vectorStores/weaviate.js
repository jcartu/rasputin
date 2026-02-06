import axios from 'axios';

const DEFAULT_URL = 'http://localhost:8080';

export class WeaviateStore {
  constructor(config = {}) {
    this.url = config.url || process.env.WEAVIATE_URL || DEFAULT_URL;
    this.apiKey = config.apiKey || process.env.WEAVIATE_API_KEY;
    this.className = this.formatClassName(config.collectionName || 'Default');
    this.dimensions = config.dimensions;
    this.distanceMetric = config.distanceMetric || 'cosine';
    
    const headers = { 'Content-Type': 'application/json' };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    
    this.client = axios.create({
      baseURL: this.url,
      headers,
      timeout: 30000,
    });
  }

  formatClassName(name) {
    const formatted = name.charAt(0).toUpperCase() + name.slice(1).replace(/[^a-zA-Z0-9]/g, '');
    return formatted;
  }

  async initialize(dimensions) {
    this.dimensions = dimensions || this.dimensions;
    
    try {
      await this.client.get(`/v1/schema/${this.className}`);
      return { success: true, class: this.className, action: 'exists' };
    } catch (error) {
      if (error.response?.status === 404) {
        await this.createClass();
        return { success: true, class: this.className, action: 'created' };
      }
      throw error;
    }
  }

  async createClass() {
    const distanceMap = {
      cosine: 'cosine',
      euclidean: 'l2-squared',
      dot_product: 'dot',
    };

    const classConfig = {
      class: this.className,
      vectorizer: 'none',
      vectorIndexConfig: {
        distance: distanceMap[this.distanceMetric.toLowerCase()] || 'cosine',
        efConstruction: 128,
        maxConnections: 64,
      },
      properties: [
        {
          name: 'content',
          dataType: ['text'],
        },
        {
          name: 'metadata',
          dataType: ['object'],
          nestedProperties: [
            { name: 'source', dataType: ['text'] },
            { name: 'page', dataType: ['int'] },
            { name: 'chunk', dataType: ['int'] },
          ],
        },
      ],
    };

    await this.client.post('/v1/schema', classConfig);
    return { success: true };
  }

  async deleteClass() {
    await this.client.delete(`/v1/schema/${this.className}`);
    return { success: true };
  }

  async upsert(vectors, options = {}) {
    const batchSize = options.batchSize || 100;
    const results = [];

    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);
      const objects = batch.map((v) => ({
        class: this.className,
        id: v.id || this.generateUUID(),
        vector: v.vector,
        properties: {
          content: v.metadata?.content || '',
          metadata: v.metadata || {},
        },
      }));

      const response = await this.client.post('/v1/batch/objects', { objects });
      
      const successCount = response.data.filter(r => !r.result?.errors).length;
      results.push({
        batch: Math.floor(i / batchSize) + 1,
        count: objects.length,
        success: successCount,
      });
    }

    return { success: true, batches: results, total: vectors.length };
  }

  async search(queryVector, options = {}) {
    const topK = options.topK || 5;
    const filter = options.filter || null;
    const certainty = options.scoreThreshold ? options.scoreThreshold : undefined;
    const distance = options.maxDistance;

    let whereClause = '';
    if (filter) {
      whereClause = `where: ${JSON.stringify(this.buildFilter(filter))}`;
    }

    const nearVectorParams = [];
    nearVectorParams.push(`vector: [${queryVector.join(',')}]`);
    if (certainty !== undefined) nearVectorParams.push(`certainty: ${certainty}`);
    if (distance !== undefined) nearVectorParams.push(`distance: ${distance}`);

    const query = `
      {
        Get {
          ${this.className}(
            limit: ${topK}
            nearVector: { ${nearVectorParams.join(', ')} }
            ${whereClause}
          ) {
            _additional {
              id
              certainty
              distance
              vector
            }
            content
            metadata
          }
        }
      }
    `;

    const response = await this.client.post('/v1/graphql', { query });
    
    const results = response.data.data?.Get?.[this.className] || [];
    return results.map(item => ({
      id: item._additional.id,
      score: item._additional.certainty || (1 - item._additional.distance),
      metadata: {
        content: item.content,
        ...item.metadata,
      },
      vector: item._additional.vector,
    }));
  }

  async searchBatch(queryVectors, options = {}) {
    const results = await Promise.all(
      queryVectors.map(vector => this.search(vector, options))
    );
    return results;
  }

  async hybridSearch(queryVector, searchText, options = {}) {
    const topK = options.topK || 5;
    const alpha = options.alpha || 0.5;

    const query = `
      {
        Get {
          ${this.className}(
            limit: ${topK}
            hybrid: {
              query: "${searchText.replace(/"/g, '\\"')}"
              vector: [${queryVector.join(',')}]
              alpha: ${alpha}
            }
          ) {
            _additional {
              id
              score
              explainScore
            }
            content
            metadata
          }
        }
      }
    `;

    const response = await this.client.post('/v1/graphql', { query });
    
    const results = response.data.data?.Get?.[this.className] || [];
    return results.map(item => ({
      id: item._additional.id,
      score: item._additional.score,
      metadata: {
        content: item.content,
        ...item.metadata,
      },
    }));
  }

  async delete(ids) {
    for (const id of ids) {
      await this.client.delete(`/v1/objects/${this.className}/${id}`);
    }
    return { success: true, deleted: ids.length };
  }

  async deleteByFilter(filter) {
    const query = `
      {
        Delete {
          ${this.className}(
            where: ${JSON.stringify(this.buildFilter(filter))}
          ) {
            successful
          }
        }
      }
    `;

    await this.client.post('/v1/graphql', { query });
    return { success: true };
  }

  async getObject(id) {
    const response = await this.client.get(
      `/v1/objects/${this.className}/${id}`,
      { params: { include: 'vector' } }
    );
    
    const obj = response.data;
    return {
      id: obj.id,
      vector: obj.vector,
      metadata: {
        content: obj.properties?.content,
        ...obj.properties?.metadata,
      },
    };
  }

  async count(filter = null) {
    let whereClause = '';
    if (filter) {
      whereClause = `where: ${JSON.stringify(this.buildFilter(filter))}`;
    }

    const query = `
      {
        Aggregate {
          ${this.className}${whereClause ? `(${whereClause})` : ''} {
            meta {
              count
            }
          }
        }
      }
    `;

    const response = await this.client.post('/v1/graphql', { query });
    return response.data.data?.Aggregate?.[this.className]?.[0]?.meta?.count || 0;
  }

  async getClassInfo() {
    const response = await this.client.get(`/v1/schema/${this.className}`);
    const count = await this.count();
    
    return {
      name: this.className,
      vectorCount: count,
      config: response.data,
    };
  }

  buildFilter(filter) {
    if (filter.operator) {
      return filter;
    }

    const conditions = [];
    for (const [key, value] of Object.entries(filter)) {
      const path = key.includes('.') ? key.split('.') : ['metadata', key];
      
      if (typeof value === 'object' && value !== null) {
        if (value.$eq !== undefined) {
          conditions.push({ path, operator: 'Equal', valueText: String(value.$eq) });
        } else if (value.$ne !== undefined) {
          conditions.push({ path, operator: 'NotEqual', valueText: String(value.$ne) });
        } else if (value.$gt !== undefined) {
          conditions.push({ path, operator: 'GreaterThan', valueNumber: value.$gt });
        } else if (value.$gte !== undefined) {
          conditions.push({ path, operator: 'GreaterThanEqual', valueNumber: value.$gte });
        } else if (value.$lt !== undefined) {
          conditions.push({ path, operator: 'LessThan', valueNumber: value.$lt });
        } else if (value.$lte !== undefined) {
          conditions.push({ path, operator: 'LessThanEqual', valueNumber: value.$lte });
        } else if (value.$in) {
          conditions.push({ 
            path, 
            operator: 'ContainsAny', 
            valueTextArray: value.$in.map(String) 
          });
        } else if (value.$like) {
          conditions.push({ path, operator: 'Like', valueText: value.$like });
        }
      } else {
        conditions.push({ path, operator: 'Equal', valueText: String(value) });
      }
    }

    if (conditions.length === 1) {
      return conditions[0];
    }

    return {
      operator: 'And',
      operands: conditions,
    };
  }

  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  async healthCheck() {
    try {
      const response = await this.client.get('/v1/.well-known/ready');
      return { healthy: response.status === 200, store: 'weaviate', url: this.url };
    } catch (error) {
      return { healthy: false, store: 'weaviate', error: error.message };
    }
  }
}

export default WeaviateStore;
