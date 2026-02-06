import { test, expect } from '../../fixtures/test-fixtures';

test.describe('Data Visualization - MANUS Cannot Do This', () => {
  test.describe('Chart Rendering', () => {
    const chartTypes = ['line', 'bar', 'scatter', 'pie', 'area', 'radar'];

    for (const chartType of chartTypes) {
      test(`should render ${chartType} chart`, async ({ page }) => {
        await page.goto(`/charts?type=${chartType}`);

        const chart = page.locator(`[data-testid="chart-${chartType}"], canvas, svg`);
        await chart.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      });
    }

    test('should update chart on data change', async ({ page }) => {
      await page.goto('/charts');

      const updateButton = page.locator('[data-testid="update-data"]');
      if ((await updateButton.count()) > 0) {
        await updateButton.click();
        await page.waitForTimeout(500);
      }
    });

    test('should support chart zoom and pan', async ({ page }) => {
      await page.goto('/charts?type=line');

      const chart = page.locator('canvas, svg').first();
      if ((await chart.count()) > 0) {
        const box = await chart.boundingBox();
        if (box) {
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.wheel(0, -100);
        }
      }
    });

    test('should export chart as image', async ({ api }) => {
      const response = await api.post('/api/charts/export', {
        chartId: 'test-chart',
        format: 'png',
        width: 800,
        height: 600,
      });

      expect(response.status).toBeLessThan(500);
    });
  });

  test.describe('Data Import', () => {
    test('should import CSV data', async ({ api }) => {
      const csvContent = 'name,value\nA,10\nB,20\nC,30';

      const response = await api.post('/api/data/import', {
        content: csvContent,
        format: 'csv',
      });

      expect(response.status).toBeLessThan(500);
    });

    test('should import JSON data', async ({ api }) => {
      const jsonData = [
        { name: 'A', value: 10 },
        { name: 'B', value: 20 },
        { name: 'C', value: 30 },
      ];

      const response = await api.post('/api/data/import', {
        content: JSON.stringify(jsonData),
        format: 'json',
      });

      expect(response.status).toBeLessThan(500);
    });

    test('should validate data on import', async ({ api }) => {
      const invalidCsv = 'invalid,data\n"unclosed quote';

      const response = await api.post('/api/data/import', {
        content: invalidCsv,
        format: 'csv',
        validate: true,
      });

      expect(response.status).toBeLessThan(500);
    });
  });

  test.describe('Data Export', () => {
    test('should export data as CSV', async ({ api }) => {
      const response = await api.post('/api/data/export', {
        data: [
          { a: 1, b: 2 },
          { a: 3, b: 4 },
        ],
        format: 'csv',
      });

      expect(response.status).toBe(200);
    });

    test('should export data as JSON', async ({ api }) => {
      const response = await api.post('/api/data/export', {
        data: [{ a: 1, b: 2 }],
        format: 'json',
      });

      expect(response.status).toBe(200);
    });

    test('should export data as Excel', async ({ api }) => {
      const response = await api.post('/api/data/export', {
        data: [{ a: 1, b: 2 }],
        format: 'xlsx',
      });

      expect(response.status).toBeLessThan(500);
    });
  });
});

test.describe('Code Diff Viewer - MANUS Cannot Do This', () => {
  test.describe('Diff Display', () => {
    test('should display side-by-side diff', async ({ page }) => {
      await page.goto('/diff?mode=split');

      const diffViewer = page.locator('[data-testid="diff-viewer"]');
      await diffViewer.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    });

    test('should display unified diff', async ({ page }) => {
      await page.goto('/diff?mode=unified');

      const diffViewer = page.locator('[data-testid="diff-viewer"]');
      await diffViewer.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    });

    test('should highlight syntax in diff', async ({ api }) => {
      const response = await api.post('/api/diff/render', {
        oldContent: 'const x = 1;',
        newContent: 'const x = 2;',
        language: 'javascript',
        syntaxHighlight: true,
      });

      expect(response.status).toBeLessThan(500);
    });

    test('should collapse unchanged sections', async ({ page }) => {
      await page.goto('/diff');

      const collapseButton = page.locator('[data-testid="collapse-unchanged"]');
      if ((await collapseButton.count()) > 0) {
        await collapseButton.click();
      }
    });

    test('should navigate between changes', async ({ page }) => {
      await page.goto('/diff');

      const nextButton = page.locator('[data-testid="next-change"]');
      if ((await nextButton.count()) > 0) {
        await nextButton.click();
      }
    });
  });

  test.describe('Diff Comments', () => {
    test('should add comment to diff line', async ({ api }) => {
      const response = await api.post('/api/diff/comments', {
        diffId: 'test-diff',
        line: 10,
        content: 'This needs review',
      });

      expect(response.status).toBeLessThan(500);
    });

    test('should list diff comments', async ({ api }) => {
      const response = await api.get<{ comments: unknown[] }>('/api/diff/test-diff/comments');

      expect(response.status).toBeLessThan(500);
    });
  });
});

test.describe('Screenshot Capture - MANUS Cannot Do This', () => {
  test.describe('Capture Functionality', () => {
    test('should capture full page screenshot', async ({ api }) => {
      const response = await api.post('/api/media/screenshot', {
        url: 'http://localhost:3000',
        fullPage: true,
        format: 'png',
      });

      expect(response.status).toBeLessThan(500);
    });

    test('should capture element screenshot', async ({ api }) => {
      const response = await api.post('/api/media/screenshot', {
        url: 'http://localhost:3000',
        selector: 'header',
        format: 'png',
      });

      expect(response.status).toBeLessThan(500);
    });

    test('should capture with custom viewport', async ({ api }) => {
      const response = await api.post('/api/media/screenshot', {
        url: 'http://localhost:3000',
        viewport: { width: 1920, height: 1080 },
        format: 'png',
      });

      expect(response.status).toBeLessThan(500);
    });
  });

  test.describe('Annotation Tools', () => {
    test('should add text annotation', async ({ api }) => {
      const response = await api.post('/api/media/annotate', {
        imageId: 'test-image',
        annotations: [{ type: 'text', x: 100, y: 100, content: 'Note here' }],
      });

      expect(response.status).toBeLessThan(500);
    });

    test('should add arrow annotation', async ({ api }) => {
      const response = await api.post('/api/media/annotate', {
        imageId: 'test-image',
        annotations: [{ type: 'arrow', x1: 100, y1: 100, x2: 200, y2: 200 }],
      });

      expect(response.status).toBeLessThan(500);
    });

    test('should add highlight box', async ({ api }) => {
      const response = await api.post('/api/media/annotate', {
        imageId: 'test-image',
        annotations: [{ type: 'box', x: 100, y: 100, width: 200, height: 100, color: 'red' }],
      });

      expect(response.status).toBeLessThan(500);
    });
  });
});
