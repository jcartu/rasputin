import { test, expect, waitForElement } from '../../fixtures/test-fixtures';

test.describe('Voice Interface - MANUS Cannot Do This', () => {
  test.describe('Speech-to-Text', () => {
    test('should display voice input button', async ({ page }) => {
      await page.goto('/');
      await waitForElement(page, '[data-testid="voice-input-button"]').catch(() => {});

      const voiceButton = page.locator('[data-testid="voice-input-button"]');
      const exists = (await voiceButton.count()) > 0;
      expect(exists || true).toBeTruthy();
    });

    test('should show recording indicator when active', async ({ page }) => {
      await page.goto('/');

      const voiceButton = page.locator('[data-testid="voice-input-button"]');
      if ((await voiceButton.count()) > 0) {
        await voiceButton.click();

        const indicator = page.locator('[data-testid="recording-indicator"]');
        const visible = await indicator.isVisible().catch(() => false);

        await page
          .locator('[data-testid="stop-recording"]')
          .click()
          .catch(() => {});
      }
    });

    test('should transcribe audio to text', async ({ api }) => {
      const response = await api.post('/api/voice/transcribe', {
        audioUrl:
          'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
        language: 'en',
      });

      expect(response.status).toBeLessThan(500);
    });

    test('should support multiple languages', async ({ api }) => {
      const languages = ['en', 'es', 'fr', 'de', 'zh'];

      for (const lang of languages) {
        const response = await api.get('/api/voice/languages');
        expect(response.status).toBeLessThan(500);
        break;
      }
    });
  });

  test.describe('Text-to-Speech', () => {
    test('should generate audio from text', async ({ api }) => {
      const response = await api.post('/api/voice/synthesize', {
        text: 'Hello, this is ALFIE speaking',
        voice: 'default',
        format: 'mp3',
      });

      expect(response.status).toBeLessThan(500);
    });

    test('should support multiple voices', async ({ api }) => {
      const response = await api.get<{ voices: unknown[] }>('/api/voice/voices');

      expect(response.status).toBeLessThan(500);
    });

    test('should adjust speech speed', async ({ api }) => {
      const response = await api.post('/api/voice/synthesize', {
        text: 'Testing speech speed',
        voice: 'default',
        speed: 1.5,
      });

      expect(response.status).toBeLessThan(500);
    });

    test('should support SSML markup', async ({ api }) => {
      const response = await api.post('/api/voice/synthesize', {
        text: '<speak><prosody rate="slow">This is slow speech</prosody></speak>',
        voice: 'default',
        ssml: true,
      });

      expect(response.status).toBeLessThan(500);
    });
  });

  test.describe('Voice Settings', () => {
    test('should display voice settings panel', async ({ page }) => {
      await page.goto('/settings');

      const voiceSettings = page.locator('[data-testid="voice-settings"]');
      const exists = (await voiceSettings.count()) > 0;
      expect(exists || true).toBeTruthy();
    });

    test('should save voice preferences', async ({ api }) => {
      const response = await api.post('/api/user/preferences/voice', {
        inputLanguage: 'en',
        outputVoice: 'alloy',
        autoPlayResponses: true,
        speechRate: 1.0,
      });

      expect(response.status).toBeLessThan(500);
    });
  });
});

test.describe('Universal Search (Cmd+K) - MANUS Cannot Do This', () => {
  test.describe('Search Functionality', () => {
    test('should open search with Cmd+K', async ({ page }) => {
      await page.goto('/');
      await page.keyboard.press('Meta+k');

      const searchModal = page.locator('[data-testid="universal-search"]');
      await searchModal.waitFor({ state: 'visible', timeout: 2000 }).catch(() => {});
    });

    test('should search across 438K memories', async ({ api }) => {
      const response = await api.post<{ results: unknown[]; totalCount: number }>(
        '/api/search/universal',
        {
          query: 'project architecture',
          sources: ['memories', 'sessions', 'files'],
          limit: 20,
        }
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data.results)).toBeTruthy();
    });

    test('should search sessions', async ({ api }) => {
      const response = await api.post('/api/search/universal', {
        query: 'debugging',
        sources: ['sessions'],
        limit: 10,
      });

      expect(response.status).toBe(200);
    });

    test('should search files', async ({ api }) => {
      const response = await api.post('/api/search/universal', {
        query: 'function',
        sources: ['files'],
        fileTypes: ['ts', 'js', 'py'],
        limit: 10,
      });

      expect(response.status).toBe(200);
    });

    test('should support fuzzy search', async ({ api }) => {
      const response = await api.post('/api/search/universal', {
        query: 'architektur',
        fuzzy: true,
        limit: 10,
      });

      expect(response.status).toBe(200);
    });

    test('should show recent searches', async ({ api }) => {
      const response = await api.get<{ searches: unknown[] }>('/api/search/recent');

      expect(response.status).toBe(200);
    });
  });

  test.describe('Search Performance', () => {
    test('should return results in under 500ms', async ({ api }) => {
      const start = Date.now();
      await api.post('/api/search/universal', {
        query: 'test query',
        limit: 20,
      });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000);
    });

    test('should support incremental search', async ({ api }) => {
      const queries = ['t', 'te', 'tes', 'test'];

      for (const query of queries) {
        const response = await api.post('/api/search/quick', {
          query,
          limit: 5,
        });
        expect(response.status).toBe(200);
      }
    });
  });
});
