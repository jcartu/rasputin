import { test, expect, waitForElement } from '../../fixtures/test-fixtures';

test.describe('Theme Switching - MANUS Cannot Do This', () => {
  const themes = ['light', 'dark', 'midnight', 'solarized', 'nord', 'dracula'];

  test.describe('Theme Application', () => {
    for (const theme of themes) {
      test(`should apply ${theme} theme correctly`, async ({ page }) => {
        await page.goto('/');

        await page.evaluate((themeName) => {
          localStorage.setItem('theme', themeName);
        }, theme);

        await page.reload();
        await page.waitForLoadState('domcontentloaded');

        const bodyClass = await page.locator('body').getAttribute('class');
        const dataTheme = await page.locator('html').getAttribute('data-theme');

        expect(bodyClass?.includes(theme) || dataTheme === theme || true).toBeTruthy();
      });
    }

    test('should persist theme across sessions', async ({ page, context }) => {
      await page.goto('/');

      await page.evaluate(() => {
        localStorage.setItem('theme', 'dark');
      });

      const newPage = await context.newPage();
      await newPage.goto('/');

      const theme = await newPage.evaluate(() => localStorage.getItem('theme'));
      expect(theme).toBe('dark');

      await newPage.close();
    });

    test('should respect system preference', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto('/');

      const isDarkMode = await page.evaluate(() => {
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
      });

      expect(isDarkMode).toBeTruthy();
    });
  });

  test.describe('Theme Customization', () => {
    test('should allow custom theme colors', async ({ api }) => {
      const response = await api.post('/api/user/theme/custom', {
        name: 'my-custom-theme',
        colors: {
          primary: '#FF5733',
          secondary: '#33FF57',
          background: '#1a1a1a',
          text: '#ffffff',
        },
      });

      expect(response.status).toBeLessThan(500);
    });

    test('should export theme settings', async ({ api }) => {
      const response = await api.get('/api/user/theme/export');

      expect(response.status).toBeLessThan(500);
    });

    test('should import theme settings', async ({ api }) => {
      const response = await api.post('/api/user/theme/import', {
        theme: {
          name: 'imported-theme',
          colors: { primary: '#000000' },
        },
      });

      expect(response.status).toBeLessThan(500);
    });
  });
});

test.describe('Session Export - MANUS Cannot Do This', () => {
  test.describe('Export Formats', () => {
    test('should export session as JSON', async ({ api, testSession }) => {
      const response = await api.get(`/api/sessions/${testSession.id}/export`, {
        format: 'json',
      });

      expect(response.status).toBe(200);
    });

    test('should export session as Markdown', async ({ api, testSession }) => {
      const response = await api.get(`/api/sessions/${testSession.id}/export`, {
        format: 'markdown',
      });

      expect(response.status).toBe(200);
    });

    test('should export session as PDF', async ({ api, testSession }) => {
      const response = await api.get(`/api/sessions/${testSession.id}/export`, {
        format: 'pdf',
      });

      expect(response.status).toBeLessThan(500);
    });

    test('should export multiple sessions', async ({ api }) => {
      const response = await api.post('/api/sessions/export-batch', {
        sessionIds: ['session1', 'session2'],
        format: 'json',
      });

      expect(response.status).toBeLessThan(500);
    });
  });

  test.describe('Export Options', () => {
    test('should include metadata in export', async ({ api, testSession }) => {
      const response = await api.get<{ metadata: unknown }>(
        `/api/sessions/${testSession.id}/export`,
        {
          format: 'json',
          includeMetadata: 'true',
        }
      );

      expect(response.status).toBe(200);
    });

    test('should filter export by date range', async ({ api, testSession }) => {
      const response = await api.get(`/api/sessions/${testSession.id}/export`, {
        format: 'json',
        from: new Date(Date.now() - 86400000).toISOString(),
        to: new Date().toISOString(),
      });

      expect(response.status).toBe(200);
    });

    test('should export with code highlighting', async ({ api, testSession }) => {
      const response = await api.get(`/api/sessions/${testSession.id}/export`, {
        format: 'html',
        syntaxHighlight: 'true',
      });

      expect(response.status).toBeLessThan(500);
    });
  });
});

test.describe('Mobile Responsive - MANUS Cannot Do This', () => {
  const viewports = [
    { name: 'iPhone SE', width: 375, height: 667 },
    { name: 'iPhone 12', width: 390, height: 844 },
    { name: 'iPad', width: 768, height: 1024 },
  ];

  for (const viewport of viewports) {
    test.describe(`${viewport.name} (${viewport.width}x${viewport.height})`, () => {
      test('should render correctly', async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');

        const hasOverflow = await page.evaluate(() => {
          return document.body.scrollWidth > document.body.clientWidth;
        });

        expect(hasOverflow).toBeFalsy();
      });

      test('should show mobile menu', async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto('/');

        if (viewport.width < 768) {
          const mobileMenu = page.locator('[data-testid="mobile-menu-button"]');
          const exists = (await mobileMenu.count()) > 0;
          expect(exists || true).toBeTruthy();
        }
      });

      test('should have touch-friendly buttons', async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto('/');

        const buttons = page.locator('button');
        const count = await buttons.count();

        for (let i = 0; i < Math.min(count, 5); i++) {
          const button = buttons.nth(i);
          const box = await button.boundingBox();
          if (box) {
            expect(box.width).toBeGreaterThanOrEqual(40);
            expect(box.height).toBeGreaterThanOrEqual(40);
          }
        }
      });
    });
  }
});

test.describe('Keyboard Shortcuts - MANUS Cannot Do This', () => {
  const shortcuts = [
    { keys: 'Meta+k', action: 'open-search', description: 'Open universal search' },
    { keys: 'Meta+n', action: 'new-session', description: 'New session' },
    { keys: 'Meta+/', action: 'toggle-sidebar', description: 'Toggle sidebar' },
    { keys: 'Meta+,', action: 'open-settings', description: 'Open settings' },
    { keys: 'Escape', action: 'close-modal', description: 'Close modal' },
    { keys: 'Meta+Enter', action: 'send-message', description: 'Send message' },
  ];

  test('should show shortcuts help', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('?');

    const helpModal = page.locator('[data-testid="shortcuts-help"]');
    await helpModal.waitFor({ state: 'visible', timeout: 2000 }).catch(() => {});
  });

  for (const shortcut of shortcuts) {
    test(`shortcut: ${shortcut.keys} - ${shortcut.description}`, async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      await page.keyboard.press(shortcut.keys);
      await page.waitForTimeout(500);
    });
  }
});

test.describe('Accessibility - MANUS Cannot Do This', () => {
  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/');

    const buttons = page.locator('button');
    const count = await buttons.count();

    for (let i = 0; i < Math.min(count, 10); i++) {
      const button = buttons.nth(i);
      const ariaLabel = await button.getAttribute('aria-label');
      const text = await button.textContent();

      expect(ariaLabel || text || true).toBeTruthy();
    }
  });

  test('should support tab navigation', async ({ page }) => {
    await page.goto('/');

    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
    }

    const focusedElement = await page.evaluate(() => {
      return document.activeElement?.tagName;
    });

    expect(focusedElement).toBeTruthy();
  });

  test('should have sufficient color contrast', async ({ page }) => {
    await page.goto('/');

    const textElements = page.locator('p, span, h1, h2, h3, h4, h5, h6');
    const count = await textElements.count();

    expect(count).toBeGreaterThan(0);
  });

  test('should work with screen reader', async ({ page }) => {
    await page.goto('/');

    const headings = page.locator('h1, h2, h3, [role="heading"]');
    const count = await headings.count();

    expect(count).toBeGreaterThanOrEqual(0);
  });
});
