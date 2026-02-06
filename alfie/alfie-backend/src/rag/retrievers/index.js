import { RetrievalAlgorithm } from '../types.js';

export class Retriever {
  constructor(vectorStore, embedder, config = {}) {
    this.vectorStore = vectorStore;
    this.embedder = embedder;
    this.algorithm = config.algorithm || RetrievalAlgorithm.SIMILARITY;
    this.topK = config.topK || 5;
    this.scoreThreshold = config.scoreThreshold || 0;
    this.filter = config.filter || null;
    this.mmrLambda = config.mmrLambda || 0.5;
    this.fetchK = config.fetchK || 20;
    this.includeMetadata = config.includeMetadata !== false;
  }

  async retrieve(query, options = {}) {
    const retrievers = {
      [RetrievalAlgorithm.SIMILARITY]: () => this.similaritySearch(query, options),
      [RetrievalAlgorithm.MMR]: () => this.mmrSearch(query, options),
      [RetrievalAlgorithm.HYBRID]: () => this.hybridSearch(query, options),
      [RetrievalAlgorithm.MULTI_QUERY]: () => this.multiQuerySearch(query, options),
      [RetrievalAlgorithm.CONTEXTUAL_COMPRESSION]: () => this.contextualCompressionSearch(query, options),
      [RetrievalAlgorithm.ENSEMBLE]: () => this.ensembleSearch(query, options),
      [RetrievalAlgorithm.PARENT_DOCUMENT]: () => this.parentDocumentSearch(query, options),
    };

    const retriever = retrievers[this.algorithm];
    if (!retriever) {
      throw new Error(`Unknown retrieval algorithm: ${this.algorithm}`);
    }

    return retriever();
  }

  async similaritySearch(query, options = {}) {
    const queryVector = await this.embedder.embedQuery(query);
    
    const results = await this.vectorStore.search(queryVector, {
      topK: options.topK || this.topK,
      scoreThreshold: options.scoreThreshold || this.scoreThreshold,
      filter: options.filter || this.filter,
      includeMetadata: this.includeMetadata,
    });

    return results.map(result => ({
      ...result,
      retrievalMethod: 'similarity',
    }));
  }

  async mmrSearch(query, options = {}) {
    const queryVector = await this.embedder.embedQuery(query);
    const lambda = options.mmrLambda || this.mmrLambda;
    const fetchK = options.fetchK || this.fetchK;
    const topK = options.topK || this.topK;

    const candidates = await this.vectorStore.search(queryVector, {
      topK: fetchK,
      filter: options.filter || this.filter,
      includeMetadata: this.includeMetadata,
      includeVector: true,
    });

    if (candidates.length === 0) return [];

    const selected = [];
    const remaining = [...candidates];

    while (selected.length < topK && remaining.length > 0) {
      let bestIdx = 0;
      let bestScore = -Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i];
        const relevanceScore = candidate.score;

        let maxSimilarity = 0;
        for (const sel of selected) {
          const similarity = this.cosineSimilarity(candidate.vector, sel.vector);
          maxSimilarity = Math.max(maxSimilarity, similarity);
        }

        const mmrScore = lambda * relevanceScore - (1 - lambda) * maxSimilarity;

        if (mmrScore > bestScore) {
          bestScore = mmrScore;
          bestIdx = i;
        }
      }

      selected.push(remaining[bestIdx]);
      remaining.splice(bestIdx, 1);
    }

    return selected.map(result => ({
      id: result.id,
      score: result.score,
      metadata: result.metadata,
      retrievalMethod: 'mmr',
    }));
  }

  async hybridSearch(query, options = {}) {
    const queryVector = await this.embedder.embedQuery(query);
    
    if (this.vectorStore.hybridSearch) {
      const results = await this.vectorStore.hybridSearch(queryVector, query, {
        topK: options.topK || this.topK,
        alpha: options.alpha || 0.5,
        filter: options.filter || this.filter,
      });

      return results.map(result => ({
        ...result,
        retrievalMethod: 'hybrid',
      }));
    }

    const vectorResults = await this.vectorStore.search(queryVector, {
      topK: options.fetchK || this.fetchK,
      filter: options.filter || this.filter,
      includeMetadata: true,
    });

    const textResults = this.bm25Search(query, vectorResults);
    
    const alpha = options.alpha || 0.5;
    const combined = this.reciprocalRankFusion([
      { results: vectorResults, weight: alpha },
      { results: textResults, weight: 1 - alpha },
    ]);

    return combined.slice(0, options.topK || this.topK).map(result => ({
      ...result,
      retrievalMethod: 'hybrid',
    }));
  }

  bm25Search(query, documents) {
    const k1 = 1.5;
    const b = 0.75;
    const queryTerms = query.toLowerCase().split(/\s+/);
    
    const avgDocLength = documents.reduce((sum, doc) => {
      const content = doc.metadata?.content || '';
      return sum + content.split(/\s+/).length;
    }, 0) / documents.length;

    const termDocFreq = {};
    for (const term of queryTerms) {
      termDocFreq[term] = documents.filter(doc => {
        const content = (doc.metadata?.content || '').toLowerCase();
        return content.includes(term);
      }).length;
    }

    const scores = documents.map(doc => {
      const content = (doc.metadata?.content || '').toLowerCase();
      const docTerms = content.split(/\s+/);
      const docLength = docTerms.length;

      let score = 0;
      for (const term of queryTerms) {
        const tf = docTerms.filter(t => t === term).length;
        const df = termDocFreq[term] || 0;
        const idf = Math.log((documents.length - df + 0.5) / (df + 0.5) + 1);
        const tfNorm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (docLength / avgDocLength)));
        score += idf * tfNorm;
      }

      return { ...doc, bm25Score: score };
    });

    return scores.sort((a, b) => b.bm25Score - a.bm25Score);
  }

  reciprocalRankFusion(rankedLists, k = 60) {
    const scores = new Map();

    for (const { results, weight } of rankedLists) {
      results.forEach((doc, rank) => {
        const id = doc.id;
        const rrfScore = weight / (k + rank + 1);
        
        if (scores.has(id)) {
          const existing = scores.get(id);
          existing.score += rrfScore;
        } else {
          scores.set(id, {
            ...doc,
            score: rrfScore,
          });
        }
      });
    }

    return Array.from(scores.values()).sort((a, b) => b.score - a.score);
  }

  async multiQuerySearch(query, options = {}) {
    const queries = await this.generateQueryVariations(query);
    queries.unshift(query);

    const allResults = await Promise.all(
      queries.map(q => this.similaritySearch(q, { 
        ...options, 
        topK: options.fetchK || this.fetchK 
      }))
    );

    const fused = this.reciprocalRankFusion(
      allResults.map(results => ({ results, weight: 1 }))
    );

    return fused.slice(0, options.topK || this.topK).map(result => ({
      ...result,
      retrievalMethod: 'multi_query',
    }));
  }

  async generateQueryVariations(query) {
    const variations = [
      `What is ${query}?`,
      `Explain ${query}`,
      `Tell me about ${query}`,
      query.split(' ').slice(0, -1).join(' '),
    ].filter(v => v && v !== query);

    return variations.slice(0, 3);
  }

  async contextualCompressionSearch(query, options = {}) {
    const results = await this.similaritySearch(query, {
      ...options,
      topK: options.fetchK || this.fetchK,
    });

    const compressed = results.map(result => {
      const content = result.metadata?.content || '';
      const relevantPart = this.extractRelevantContext(content, query);
      
      return {
        ...result,
        metadata: {
          ...result.metadata,
          originalContent: content,
          content: relevantPart,
        },
        retrievalMethod: 'contextual_compression',
      };
    });

    return compressed.slice(0, options.topK || this.topK);
  }

  extractRelevantContext(content, query, windowSize = 500) {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const sentences = content.split(/[.!?]+/).filter(s => s.trim());
    
    const scoredSentences = sentences.map((sentence, idx) => {
      const lowerSentence = sentence.toLowerCase();
      const matchCount = queryTerms.filter(term => lowerSentence.includes(term)).length;
      return { sentence: sentence.trim(), idx, score: matchCount };
    });

    scoredSentences.sort((a, b) => b.score - a.score);
    
    const topSentences = scoredSentences.slice(0, 3);
    topSentences.sort((a, b) => a.idx - b.idx);
    
    return topSentences.map(s => s.sentence).join('. ') + '.';
  }

  async ensembleSearch(query, options = {}) {
    const [similarityResults, mmrResults] = await Promise.all([
      this.similaritySearch(query, { ...options, topK: options.fetchK || this.fetchK }),
      this.mmrSearch(query, { ...options, topK: options.fetchK || this.fetchK }),
    ]);

    const weights = options.weights || [0.5, 0.5];
    const fused = this.reciprocalRankFusion([
      { results: similarityResults, weight: weights[0] },
      { results: mmrResults, weight: weights[1] },
    ]);

    return fused.slice(0, options.topK || this.topK).map(result => ({
      ...result,
      retrievalMethod: 'ensemble',
    }));
  }

  async parentDocumentSearch(query, options = {}) {
    const results = await this.similaritySearch(query, {
      ...options,
      topK: options.topK || this.topK,
    });

    const parentIds = new Set();
    const enrichedResults = [];

    for (const result of results) {
      const parentId = result.metadata?.parentId || result.metadata?.documentId;
      
      if (parentId && !parentIds.has(parentId)) {
        parentIds.add(parentId);
        enrichedResults.push({
          ...result,
          metadata: {
            ...result.metadata,
            isParent: true,
          },
          retrievalMethod: 'parent_document',
        });
      } else if (!parentId) {
        enrichedResults.push({
          ...result,
          retrievalMethod: 'parent_document',
        });
      }
    }

    return enrichedResults;
  }

  cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }
}

export function createRetriever(vectorStore, embedder, config = {}) {
  return new Retriever(vectorStore, embedder, config);
}

export default { Retriever, createRetriever };
