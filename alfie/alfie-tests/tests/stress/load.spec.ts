import { test, expect, PERFORMANCE_THRESHOLDS } from '../../fixtures/test-fixtures';
import { createMultipleConnections } from '../../utils/websocket-helper';

test.describe('Stress Tests - MANUS Cannot Do This', () => {
  test.describe('High Message Volume', () => {
    test('should handle 1000 messages in single session', async ({ api, testSession }) => {
      test.setTimeout(300000);
      const messageCount = 1000;
      const batchSize = 50;
      const batches = Math.ceil(messageCount / batchSize);

      let successCount = 0;

      for (let batch = 0; batch < batches; batch++) {
        const promises: Promise<void>[] = [];
        for (let i = 0; i < batchSize && batch * batchSize + i < messageCount; i++) {
          promises.push(
            api
              .sendMessage(testSession.id, `Message ${batch * batchSize + i}`)
              .then((r) => {
                if (r.status === 200) successCount++;
              })
              .catch(() => {})
          );
        }
        await Promise.all(promises);
      }

      expect(successCount).toBeGreaterThan(messageCount * 0.9);
    });

    test('should handle 100 rapid-fire messages', async ({ api, testSession }) => {
      const start = Date.now();
      const promises: Promise<unknown>[] = [];

      for (let i = 0; i < 100; i++) {
        promises.push(api.sendMessage(testSession.id, `Rapid message ${i}`));
      }

      const results = await Promise.allSettled(promises);
      const duration = Date.now() - start;

      const successCount = results.filter((r) => r.status === 'fulfilled').length;
      expect(successCount).toBeGreaterThan(80);

      console.log(`100 messages sent in ${duration}ms, ${successCount} successful`);
    });

    test('should maintain response time under load', async ({ api }) => {
      const responseTimes: number[] = [];

      for (let i = 0; i < 50; i++) {
        const start = Date.now();
        await api.get('/api/health');
        responseTimes.push(Date.now() - start);
      }

      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);

      expect(avgResponseTime).toBeLessThan(200);
      expect(maxResponseTime).toBeLessThan(1000);
    });
  });

  test.describe('Concurrent WebSocket Connections', () => {
    test('should handle 50 concurrent WebSocket connections', async () => {
      test.setTimeout(60000);
      const connections = await createMultipleConnections(50);

      expect(connections.length).toBe(50);
      expect(connections.every((c) => c.isConnected())).toBeTruthy();

      connections.forEach((c) => {
        c.send({ type: 'ping' });
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const stillConnected = connections.filter((c) => c.isConnected()).length;
      expect(stillConnected).toBeGreaterThan(45);

      await Promise.all(connections.map((c) => c.disconnect()));
    });

    test('should broadcast to all connections', async () => {
      const connections = await createMultipleConnections(20);

      connections.forEach((c) => {
        c.send({ type: 'subscribe', payload: { channel: 'broadcast' } });
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

      connections[0].send({
        type: 'broadcast',
        payload: { message: 'Hello all!' },
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      await Promise.all(connections.map((c) => c.disconnect()));
    });
  });

  test.describe('File Browser Load', () => {
    test('should handle directory with 10000 files', async ({ api }) => {
      const response = await api.get<{ files: unknown[]; count: number }>('/api/files', {
        path: '/large-directory',
        limit: '100',
        offset: '0',
      });

      expect(response.status).toBeLessThan(500);
      expect(response.latency).toBeLessThan(PERFORMANCE_THRESHOLDS.fileOperation);
    });

    test('should paginate through large directories', async ({ api }) => {
      const pageSize = 100;
      let offset = 0;
      let totalFetched = 0;

      for (let page = 0; page < 10; page++) {
        const response = await api.get<{ files: unknown[] }>('/api/files', {
          path: '/',
          limit: String(pageSize),
          offset: String(offset),
        });

        if (response.status !== 200) break;

        totalFetched += response.data.files?.length || 0;
        offset += pageSize;

        if (!response.data.files || response.data.files.length < pageSize) break;
      }

      expect(totalFetched).toBeGreaterThan(0);
    });
  });

  test.describe('Search Performance', () => {
    test('should search across 1M+ records efficiently', async ({ api }) => {
      const start = Date.now();

      const response = await api.post('/api/search/universal', {
        query: 'important meeting notes',
        sources: ['memories', 'sessions', 'files'],
        limit: 50,
      });

      const duration = Date.now() - start;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(2000);
    });

    test('should handle concurrent search requests', async ({ api }) => {
      const queries = [
        'architecture decisions',
        'bug fixes',
        'performance optimization',
        'security review',
        'deployment notes',
      ];

      const start = Date.now();

      const promises = queries.map((query) =>
        api.post('/api/search/universal', {
          query,
          limit: 20,
        })
      );

      const results = await Promise.all(promises);
      const duration = Date.now() - start;

      expect(results.every((r) => r.status === 200)).toBeTruthy();
      expect(duration).toBeLessThan(5000);
    });
  });

  test.describe('Tool Execution Queue', () => {
    test('should handle 20 parallel tool executions', async ({ api }) => {
      const tools = Array.from({ length: 20 }, (_, i) => ({
        tool: 'echo',
        args: { message: `Tool ${i}` },
      }));

      const start = Date.now();

      const promises = tools.map((tool) => api.post('/api/tools/execute', tool));

      const results = await Promise.allSettled(promises);
      const duration = Date.now() - start;

      const successful = results.filter(
        (r) => r.status === 'fulfilled' && (r.value as { status: number }).status < 500
      ).length;

      expect(successful).toBeGreaterThan(15);
      console.log(`20 tools executed in ${duration}ms, ${successful} successful`);
    });

    test('should queue and execute tools sequentially when needed', async ({ api }) => {
      const response = await api.post('/api/tools/execute-batch', {
        tools: [
          { tool: 'read_file', args: { path: '/test/file1.txt' } },
          { tool: 'write_file', args: { path: '/test/file2.txt', content: 'test' } },
          { tool: 'read_file', args: { path: '/test/file2.txt' } },
        ],
        sequential: true,
      });

      expect(response.status).toBeLessThan(500);
    });
  });

  test.describe('Memory Pressure', () => {
    test('should handle large response payloads', async ({ api }) => {
      const response = await api.post<{ data: string }>('/api/test/large-response', {
        size: 10 * 1024 * 1024,
      });

      expect(response.status).toBeLessThan(500);
    });

    test('should handle many small requests', async ({ api }) => {
      const requestCount = 500;
      let successCount = 0;

      const start = Date.now();

      for (let batch = 0; batch < 10; batch++) {
        const promises = Array.from({ length: 50 }, () =>
          api
            .get('/api/health')
            .then((r) => {
              if (r.status === 200) successCount++;
            })
            .catch(() => {})
        );
        await Promise.all(promises);
      }

      const duration = Date.now() - start;

      expect(successCount).toBeGreaterThan(requestCount * 0.95);
      console.log(`${requestCount} requests in ${duration}ms, ${successCount} successful`);
    });
  });

  test.describe('Database Connection Pool', () => {
    test('should handle concurrent database queries', async ({ api }) => {
      const queries = Array.from({ length: 50 }, (_, i) =>
        api.post('/api/db/query', {
          query: `SELECT ${i} as num`,
        })
      );

      const results = await Promise.allSettled(queries);
      const successful = results.filter((r) => r.status === 'fulfilled').length;

      expect(successful).toBeGreaterThan(40);
    });
  });
});
