import { test as base, expect, Page, BrowserContext } from '@playwright/test';
import { ApiHelper } from '../utils/api-helper';
import { WebSocketHelper } from '../utils/websocket-helper';
import { PerformanceHelper } from '../utils/performance-helper';
import { TestDataGenerator } from '../utils/test-data-generator';

interface TestSession {
  id: string;
  name: string;
  cleanup: () => Promise<void>;
}

interface AlfieFixtures {
  api: ApiHelper;
  ws: WebSocketHelper;
  perf: PerformanceHelper;
  testData: TestDataGenerator;
  testSession: TestSession;
  authenticatedPage: Page;
  authenticatedContext: BrowserContext;
}

export const test = base.extend<AlfieFixtures>({
  api: async ({ request }, use) => {
    const api = new ApiHelper(request);
    await use(api);
  },

  ws: async ({ baseURL }, use) => {
    const wsUrl =
      baseURL?.replace('http', 'ws').replace(':3000', ':3001') + '/ws' || 'ws://localhost:3001/ws';
    const ws = new WebSocketHelper(wsUrl);
    await ws.connect().catch(() => {});
    await use(ws);
    await ws.disconnect().catch(() => {});
  },

  perf: async ({ page }, use) => {
    const perf = new PerformanceHelper(page);
    await use(perf);
  },

  testData: async ({ baseURL }, use) => {
    void baseURL;
    const generator = new TestDataGenerator('./data');
    await use(generator);
  },

  testSession: async ({ api }, use) => {
    const response = await api.createSession(`test_session_${Date.now()}`);
    const session: TestSession = {
      id: response.data.id,
      name: response.data.name,
      cleanup: async () => {
        await api.deleteSession(response.data.id).catch(() => {});
      },
    };

    await use(session);
    await session.cleanup();
  },

  authenticatedPage: async ({ browser }, use) => {
    const context = await browser
      .newContext({
        storageState: './fixtures/.auth-state.json',
      })
      .catch(async () => {
        return browser.newContext();
      });

    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  authenticatedContext: async ({ browser }, use) => {
    const context = await browser
      .newContext({
        storageState: './fixtures/.auth-state.json',
      })
      .catch(async () => {
        return browser.newContext();
      });

    await use(context);
    await context.close();
  },
});

export { expect };

export const PERFORMANCE_THRESHOLDS = {
  pageLoad: 3000,
  apiResponse: 500,
  wsLatency: 100,
  searchResponse: 1000,
  fileOperation: 2000,
  codeExecution: 10000,
  modelResponse: 30000,
};

export const TEST_USERS = {
  admin: {
    email: process.env.TEST_ADMIN_EMAIL || 'admin@alfie.dev',
    password: process.env.TEST_ADMIN_PASSWORD || 'admin-password',
  },
  user: {
    email: process.env.TEST_USER_EMAIL || 'user@alfie.dev',
    password: process.env.TEST_USER_PASSWORD || 'user-password',
  },
  readonly: {
    email: process.env.TEST_READONLY_EMAIL || 'readonly@alfie.dev',
    password: process.env.TEST_READONLY_PASSWORD || 'readonly-password',
  },
};

export const TEST_MODELS = [
  'claude-3-opus',
  'claude-3-sonnet',
  'gpt-4-turbo',
  'gemini-pro',
  'local-llama-70b',
];

export const TEST_PROMPTS = {
  simple: 'What is 2+2?',
  coding: 'Write a Python function to calculate factorial',
  analytical: 'Compare REST and GraphQL APIs',
  creative: 'Write a haiku about programming',
  complex: 'Design a distributed system for real-time chat with 1M concurrent users',
};

export async function waitForElement(page: Page, selector: string, timeout = 10000): Promise<void> {
  await page.waitForSelector(selector, { timeout, state: 'visible' });
}

export async function waitForText(page: Page, text: string, timeout = 10000): Promise<void> {
  await page.waitForFunction(
    (searchText) => document.body.textContent?.includes(searchText),
    text,
    { timeout }
  );
}

export async function measurePageLoad(page: Page, url: string): Promise<number> {
  const start = Date.now();
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  return Date.now() - start;
}

export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
