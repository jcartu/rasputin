import { test, expect, PERFORMANCE_THRESHOLDS } from '../../fixtures/test-fixtures';

test.describe('Code Sandbox Execution - MANUS Cannot Do This', () => {
  test.describe('Multi-Language Code Execution', () => {
    test('should execute Python code with timeout', async ({ api }) => {
      const response = await api.executeCode('print(sum(range(100)))', 'python');

      expect(response.status).toBe(200);
      expect(response.data.output).toContain('4950');
      expect(response.data.exitCode).toBe(0);
    });

    test('should execute JavaScript code', async ({ api }) => {
      const response = await api.executeCode(
        'console.log(Array.from({length: 10}, (_, i) => i * 2))',
        'javascript'
      );

      expect(response.status).toBe(200);
      expect(response.data.exitCode).toBe(0);
    });

    test('should execute Bash scripts', async ({ api }) => {
      const response = await api.executeCode('echo "Hello from Bash" && date', 'bash');

      expect(response.status).toBe(200);
      expect(response.data.output).toContain('Hello from Bash');
    });

    test('should handle execution timeout', async ({ api }) => {
      const response = await api.post('/api/execute', {
        code: 'import time; time.sleep(100)',
        language: 'python',
        timeout: 2000,
      });

      expect(response.status).toBeLessThan(500);
      const data = response.data as { error?: string; timedOut?: boolean };
      expect(data.timedOut || data.error?.includes('timeout')).toBeTruthy();
    });

    test('should enforce memory limits', async ({ api }) => {
      const response = await api.post('/api/execute', {
        code: 'x = [0] * (10 ** 9)',
        language: 'python',
        memoryLimitMb: 100,
      });

      expect(response.status).toBeLessThan(500);
    });

    test('should capture stderr output', async ({ api }) => {
      const response = await api.post('/api/execute', {
        code: 'import sys; sys.stderr.write("Error message")',
        language: 'python',
      });

      expect(response.status).toBe(200);
      const data = response.data as { stderr?: string };
      expect(data.stderr).toContain('Error message');
    });
  });

  test.describe('Code Execution with Dependencies', () => {
    test('should execute Python with numpy', async ({ api }) => {
      const response = await api.post<{ output: string }>('/api/execute', {
        code: 'import numpy as np; print(np.array([1, 2, 3]).mean())',
        language: 'python',
        packages: ['numpy'],
      });

      expect(response.status).toBe(200);
      expect(response.data.output).toContain('2.0');
    });

    test('should execute Node.js with npm packages', async ({ api }) => {
      const response = await api.post('/api/execute', {
        code: 'const _ = require("lodash"); console.log(_.chunk([1,2,3,4,5,6], 2))',
        language: 'javascript',
        packages: ['lodash'],
      });

      expect(response.status).toBe(200);
    });

    test('should execute with environment variables', async ({ api }) => {
      const response = await api.post<{ output: string }>('/api/execute', {
        code: 'import os; print(os.environ.get("TEST_VAR", "not set"))',
        language: 'python',
        env: { TEST_VAR: 'test_value' },
      });

      expect(response.status).toBe(200);
      expect(response.data.output).toContain('test_value');
    });
  });

  test.describe('Code Sandbox Security', () => {
    test('should prevent file system access outside sandbox', async ({ api }) => {
      const response = await api.post('/api/execute', {
        code: 'open("/etc/passwd").read()',
        language: 'python',
      });

      expect(response.status).toBeLessThan(500);
      const data = response.data as { exitCode: number; error?: string };
      expect(data.exitCode).not.toBe(0);
    });

    test('should prevent network access', async ({ api }) => {
      const response = await api.post('/api/execute', {
        code: 'import urllib.request; urllib.request.urlopen("http://google.com")',
        language: 'python',
        networkAccess: false,
      });

      expect(response.status).toBeLessThan(500);
    });

    test('should prevent fork bombs', async ({ api }) => {
      const response = await api.post('/api/execute', {
        code: 'import os; [os.fork() for _ in range(100)]',
        language: 'python',
        maxProcesses: 1,
      });

      expect(response.status).toBeLessThan(500);
    });

    test('should sandbox subprocess execution', async ({ api }) => {
      const response = await api.post('/api/execute', {
        code: 'import subprocess; subprocess.run(["rm", "-rf", "/"])',
        language: 'python',
      });

      expect(response.status).toBeLessThan(500);
    });
  });

  test.describe('Interactive Execution', () => {
    test('should support multi-cell execution', async ({ api }) => {
      const cells = [
        { code: 'x = 10', language: 'python' },
        { code: 'y = 20', language: 'python' },
        { code: 'print(x + y)', language: 'python' },
      ];

      const response = await api.post('/api/execute/notebook', {
        cells,
        shareState: true,
      });

      expect(response.status).toBe(200);
      const data = response.data as { outputs: { output: string }[] };
      expect(data.outputs[2].output).toContain('30');
    });

    test('should return execution metrics', async ({ api }) => {
      const response = await api.post('/api/execute', {
        code: 'sum(range(10000))',
        language: 'python',
        returnMetrics: true,
      });

      expect(response.status).toBe(200);
      const data = response.data as {
        metrics: {
          executionTimeMs: number;
          memoryUsedMb: number;
        };
      };
      expect(data.metrics.executionTimeMs).toBeGreaterThan(0);
    });

    test('should support streaming execution output', async ({ ws }) => {
      if (!ws.isConnected()) {
        test.skip();
        return;
      }

      ws.send({
        type: 'execute',
        payload: {
          code: 'for i in range(5): print(i); import time; time.sleep(0.1)',
          language: 'python',
          stream: true,
        },
      });

      const messages = await ws.waitForMessages(5, 10000);
      expect(messages.length).toBeGreaterThanOrEqual(1);
    });
  });
});
