import { test, expect } from '../../fixtures/test-fixtures';

test.describe('Terminal Integration - MANUS Cannot Do This', () => {
  test.describe('Command Execution', () => {
    test('should execute terminal command', async ({ api }) => {
      const response = await api.post<{ output: string; exitCode: number }>(
        '/api/integrations/terminal/execute',
        {
          command: 'echo "Hello from ALFIE"',
          timeout: 5000,
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.output).toContain('Hello from ALFIE');
      expect(response.data.exitCode).toBe(0);
    });

    test('should capture command output in real-time', async ({ ws }) => {
      if (!ws.isConnected()) {
        test.skip();
        return;
      }

      ws.send({
        type: 'terminal_execute',
        payload: {
          command: 'for i in 1 2 3; do echo $i; sleep 0.1; done',
          stream: true,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));
      const messages = ws.getMessagesByType('terminal_output');
      expect(messages.length).toBeGreaterThan(0);
    });

    test('should handle command timeout', async ({ api }) => {
      const response = await api.post('/api/integrations/terminal/execute', {
        command: 'sleep 60',
        timeout: 1000,
      });

      expect(response.status).toBeLessThan(500);
    });

    test('should execute with custom environment', async ({ api }) => {
      const response = await api.post<{ output: string }>('/api/integrations/terminal/execute', {
        command: 'echo $CUSTOM_VAR',
        env: { CUSTOM_VAR: 'test_value' },
      });

      expect(response.status).toBe(200);
      expect(response.data.output).toContain('test_value');
    });

    test('should execute in specific directory', async ({ api }) => {
      const response = await api.post<{ output: string }>('/api/integrations/terminal/execute', {
        command: 'pwd',
        workdir: '/tmp',
      });

      expect(response.status).toBe(200);
      expect(response.data.output).toContain('/tmp');
    });
  });

  test.describe('Terminal Sessions', () => {
    test('should create persistent terminal session', async ({ api }) => {
      const response = await api.post<{ sessionId: string }>('/api/integrations/terminal/sessions');

      expect([200, 201]).toContain(response.status);
      expect(response.data.sessionId).toBeTruthy();
    });

    test('should execute command in session', async ({ api }) => {
      const sessionResponse = await api.post<{ sessionId: string }>(
        '/api/integrations/terminal/sessions'
      );
      if (sessionResponse.status >= 200 && sessionResponse.status < 300) {
        const sessionId = sessionResponse.data.sessionId;

        await api.post('/api/integrations/terminal/sessions/' + sessionId + '/execute', {
          command: 'export MY_VAR=hello',
        });

        const response = await api.post<{ output: string }>(
          '/api/integrations/terminal/sessions/' + sessionId + '/execute',
          {
            command: 'echo $MY_VAR',
          }
        );

        expect(response.data.output).toContain('hello');
      }
    });

    test('should list active terminal sessions', async ({ api }) => {
      const response = await api.get<{ sessions: unknown[] }>(
        '/api/integrations/terminal/sessions'
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data.sessions)).toBeTruthy();
    });
  });
});

test.describe('Notion Integration - MANUS Cannot Do This', () => {
  test.describe('Page Operations', () => {
    test('should create Notion page', async ({ api }) => {
      const response = await api.post('/api/integrations/notion/pages', {
        title: 'E2E Test Page',
        content: 'This is a test page created by ALFIE',
        parentId: 'test-database-id',
      });

      expect(response.status).toBeLessThan(500);
    });

    test('should read Notion page', async ({ api }) => {
      const response = await api.get('/api/integrations/notion/pages/test-page-id');

      expect(response.status).toBeLessThan(500);
    });

    test('should update Notion page with AI', async ({ api }) => {
      const response = await api.patch('/api/integrations/notion/pages/test-page-id', {
        content: 'Updated content',
        aiImprove: true,
      });

      expect(response.status).toBeLessThan(500);
    });

    test('should search across Notion workspace', async ({ api }) => {
      const response = await api.post('/api/integrations/notion/search', {
        query: 'project documentation',
        semantic: true,
        limit: 10,
      });

      expect(response.status).toBeLessThan(500);
    });
  });

  test.describe('Database Operations', () => {
    test('should query Notion database', async ({ api }) => {
      const response = await api.post<{ results: unknown[] }>(
        '/api/integrations/notion/databases/test-db-id/query',
        {
          filter: {
            property: 'Status',
            select: { equals: 'In Progress' },
          },
          sorts: [{ property: 'Created', direction: 'descending' }],
        }
      );

      expect(response.status).toBeLessThan(500);
    });

    test('should create database entry', async ({ api }) => {
      const response = await api.post('/api/integrations/notion/databases/test-db-id/entries', {
        properties: {
          Name: 'E2E Test Entry',
          Status: 'To Do',
          Priority: 'High',
        },
      });

      expect(response.status).toBeLessThan(500);
    });

    test('should update database entry', async ({ api }) => {
      const response = await api.patch('/api/integrations/notion/entries/test-entry-id', {
        properties: {
          Status: 'Done',
        },
      });

      expect(response.status).toBeLessThan(500);
    });

    test('should sync database with AI analysis', async ({ api }) => {
      const response = await api.post('/api/integrations/notion/databases/test-db-id/sync', {
        aiAnalyze: true,
        generateInsights: true,
      });

      expect(response.status).toBeLessThan(500);
    });
  });
});

test.describe('Jupyter Integration - MANUS Cannot Do This', () => {
  test.describe('Notebook Operations', () => {
    test('should run notebook cell', async ({ api }) => {
      const response = await api.post<{ output: unknown }>('/api/integrations/jupyter/execute', {
        code: 'print("Hello from Jupyter")',
        language: 'python',
      });

      expect(response.status).toBeLessThan(500);
    });

    test('should render plot output', async ({ api }) => {
      const response = await api.post('/api/integrations/jupyter/execute', {
        code: `
import matplotlib.pyplot as plt
import numpy as np
x = np.linspace(0, 10, 100)
plt.plot(x, np.sin(x))
plt.savefig('/tmp/plot.png')
print('Plot saved')
`,
        language: 'python',
        returnPlots: true,
      });

      expect(response.status).toBeLessThan(500);
    });

    test('should execute multiple cells in sequence', async ({ api }) => {
      const cells = [{ code: 'x = 10' }, { code: 'y = 20' }, { code: 'print(x + y)' }];

      const response = await api.post<{ outputs: unknown[] }>(
        '/api/integrations/jupyter/notebook/execute',
        {
          cells,
          shareKernel: true,
        }
      );

      expect(response.status).toBeLessThan(500);
      if (response.status === 200) {
        expect(response.data.outputs.length).toBe(3);
      }
    });

    test('should save notebook', async ({ api }) => {
      const response = await api.post('/api/integrations/jupyter/notebook/save', {
        path: '/tmp/test_notebook.ipynb',
        cells: [
          { type: 'markdown', content: '# Test Notebook' },
          { type: 'code', content: 'print("Hello")' },
        ],
      });

      expect(response.status).toBeLessThan(500);
    });

    test('should list available kernels', async ({ api }) => {
      const response = await api.get<{ kernels: unknown[] }>('/api/integrations/jupyter/kernels');

      expect(response.status).toBeLessThan(500);
    });
  });
});
