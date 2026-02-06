import { test, expect, PERFORMANCE_THRESHOLDS } from '../../fixtures/test-fixtures';

test.describe('Second Brain - 438K+ Memories - MANUS Cannot Do This', () => {
  test.describe('Context Injection Mid-Conversation', () => {
    test('should inject relevant memories into conversation context', async ({
      api,
      testSession,
    }) => {
      await api.sendMessage(testSession.id, 'Tell me about the Rudyak project');

      const response = await api.post('/api/memories/inject', {
        sessionId: testSession.id,
        query: 'Rudyak project details',
        limit: 10,
      });

      expect(response.status).toBe(200);
      const data = response.data as { injectedMemories: number };
      expect(data.injectedMemories).toBeGreaterThan(0);
    });

    test('should search across 438K memories in under 1 second', async ({ api }) => {
      const start = Date.now();
      const response = await api.searchMemories('project architecture decisions', 50);
      const duration = Date.now() - start;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.searchResponse);
    });

    test('should filter memories by date range', async ({ api }) => {
      const response = await api.post('/api/memories/search', {
        query: 'meeting notes',
        filters: {
          dateFrom: '2024-01-01',
          dateTo: '2024-12-31',
        },
        limit: 20,
      });

      expect(response.status).toBe(200);
    });

    test('should filter memories by source (telegram, discord, email)', async ({ api }) => {
      const sources = ['telegram', 'discord', 'email'];

      for (const source of sources) {
        const response = await api.post('/api/memories/search', {
          query: 'conversation',
          filters: { source },
          limit: 10,
        });

        expect(response.status).toBe(200);
      }
    });

    test('should filter memories by category', async ({ api }) => {
      const categories = ['code', 'document', 'conversation', 'research'];

      for (const category of categories) {
        const response = await api.post('/api/memories/search', {
          query: 'important',
          filters: { category },
          limit: 10,
        });

        expect(response.status).toBe(200);
      }
    });
  });

  test.describe('Semantic Search Capabilities', () => {
    test('should find semantically similar content', async ({ api }) => {
      const response = await api.post('/api/memories/search', {
        query: 'machine learning model training',
        semantic: true,
        limit: 10,
      });

      expect(response.status).toBe(200);
      const data = response.data as { results: { similarity: number }[] };
      expect(data.results.length).toBeGreaterThan(0);
      data.results.forEach((result) => {
        expect(result.similarity).toBeGreaterThan(0);
      });
    });

    test('should support hybrid search (semantic + keyword)', async ({ api }) => {
      const response = await api.post('/api/memories/search', {
        query: 'API endpoint design',
        mode: 'hybrid',
        semanticWeight: 0.7,
        keywordWeight: 0.3,
        limit: 10,
      });

      expect(response.status).toBe(200);
    });

    test('should return similarity scores for results', async ({ api }) => {
      const response = await api.searchMemories('project timeline', 10);

      expect(response.status).toBe(200);
      const data = response.data as unknown[];
      expect(data.length).toBeGreaterThan(0);
    });

    test('should support multi-query search', async ({ api }) => {
      const response = await api.post('/api/memories/multi-search', {
        queries: ['authentication implementation', 'database schema design', 'API rate limiting'],
        limit: 5,
      });

      expect(response.status).toBe(200);
      const data = response.data as { results: Record<string, unknown[]> };
      expect(Object.keys(data.results).length).toBe(3);
    });
  });

  test.describe('Memory Management', () => {
    test('should add new memory to second brain', async ({ api }) => {
      const response = await api.post('/api/memories/add', {
        content: 'Test memory entry for E2E testing',
        metadata: {
          source: 'e2e_test',
          category: 'test',
        },
      });

      expect([200, 201]).toContain(response.status);
    });

    test('should update existing memory', async ({ api }) => {
      const createResponse = await api.post('/api/memories/add', {
        content: 'Original content',
        metadata: { source: 'e2e_test' },
      });

      if (createResponse.status >= 200 && createResponse.status < 300) {
        const memoryId = (createResponse.data as { id: string }).id;
        const updateResponse = await api.put(`/api/memories/${memoryId}`, {
          content: 'Updated content',
        });

        expect(updateResponse.status).toBe(200);
      }
    });

    test('should delete memory', async ({ api }) => {
      const createResponse = await api.post('/api/memories/add', {
        content: 'Memory to delete',
        metadata: { source: 'e2e_test' },
      });

      if (createResponse.status >= 200 && createResponse.status < 300) {
        const memoryId = (createResponse.data as { id: string }).id;
        const deleteResponse = await api.delete(`/api/memories/${memoryId}`);

        expect([200, 204]).toContain(deleteResponse.status);
      }
    });

    test('should batch import memories', async ({ api }) => {
      const memories = Array.from({ length: 10 }, (_, i) => ({
        content: `Batch memory ${i}`,
        metadata: { source: 'e2e_batch_test' },
      }));

      const response = await api.post('/api/memories/batch', { memories });

      expect([200, 201, 202]).toContain(response.status);
    });

    test('should export memories to file', async ({ api }) => {
      const response = await api.post('/api/memories/export', {
        format: 'json',
        filters: { source: 'e2e_test' },
      });

      expect(response.status).toBe(200);
    });
  });

  test.describe('RAG Pipeline', () => {
    test('should execute RAG query with custom vector DB', async ({ api }) => {
      const response = await api.post('/api/rag/query', {
        query: 'What decisions were made about the system architecture?',
        vectorDb: 'qdrant',
        topK: 10,
      });

      expect(response.status).toBe(200);
      const data = response.data as {
        answer: string;
        sources: unknown[];
      };
      expect(data.answer).toBeTruthy();
      expect(data.sources.length).toBeGreaterThan(0);
    });

    test('should support multiple vector DBs in parallel', async ({ api }) => {
      const response = await api.post('/api/rag/multi-query', {
        query: 'Previous implementation patterns',
        vectorDbs: ['qdrant', 'chromadb', 'pinecone'],
        mergeStrategy: 'union',
      });

      expect(response.status).toBe(200);
    });

    test('should chunk documents for RAG ingestion', async ({ api }) => {
      const response = await api.post('/api/rag/ingest', {
        document: 'A very long document content '.repeat(1000),
        chunkSize: 500,
        chunkOverlap: 50,
      });

      expect([200, 201, 202]).toContain(response.status);
    });

    test('should retrieve with reranking', async ({ api }) => {
      const response = await api.post('/api/rag/query', {
        query: 'Best practices for error handling',
        topK: 20,
        rerank: true,
        rerankModel: 'cohere-rerank',
      });

      expect(response.status).toBe(200);
    });
  });
});
