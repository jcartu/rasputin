import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * ALFIE E2E Test Suite Configuration
 *
 * Comprehensive testing for ALFIE features that MANUS cannot match:
 * - Multi-model AI capabilities
 * - Real-time WebSocket features
 * - Second Brain with 438K+ memories
 * - Code sandbox execution
 * - Collaborative editing
 * - And 100+ more differentiating features
 */
export default defineConfig({
  testDir: './tests',

  // Run tests in parallel for speed
  fullyParallel: true,

  // CI optimizations
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 4 : undefined,

  // Rich reporting
  reporter: [
    ['html', { outputFolder: './reports/html', open: 'never' }],
    ['json', { outputFile: './reports/results.json' }],
    ['junit', { outputFile: './reports/junit.xml' }],
    ['list'],
    ...(process.env.CI ? [['github' as const, {}] as const] : []),
  ],

  // Global timeout settings
  timeout: 60000,
  expect: {
    timeout: 10000,
  },

  // Common test settings
  use: {
    // Base URLs
    baseURL: process.env.ALFIE_UI_URL || 'http://localhost:3000',

    // Capture on failure
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',

    // Network settings
    actionTimeout: 15000,
    navigationTimeout: 30000,

    // Extra HTTP headers
    extraHTTPHeaders: {
      'X-Test-Suite': 'ALFIE-E2E',
    },
  },

  // Test projects for different environments
  projects: [
    // Setup project - runs first
    {
      name: 'setup',
      testMatch: /global\.setup\.ts/,
    },

    // Chrome desktop - primary test environment
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
      dependencies: ['setup'],
    },

    // Firefox for cross-browser coverage
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      dependencies: ['setup'],
    },

    // Safari for WebKit coverage
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      dependencies: ['setup'],
    },

    // Mobile Chrome
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        isMobile: true,
      },
      dependencies: ['setup'],
    },

    // Mobile Safari
    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 12'],
        isMobile: true,
      },
      dependencies: ['setup'],
    },

    // API-only tests (no browser)
    {
      name: 'api',
      testMatch: /api\..*\.spec\.ts/,
      use: {
        baseURL: process.env.ALFIE_API_URL || 'http://localhost:3001',
      },
    },

    // Stress tests (isolated)
    {
      name: 'stress',
      testMatch: /stress\/.*\.spec\.ts/,
      timeout: 300000, // 5 minutes for stress tests
      use: {
        ...devices['Desktop Chrome'],
      },
      dependencies: ['setup'],
    },

    // Performance benchmarks
    {
      name: 'performance',
      testMatch: /performance\..*\.spec\.ts/,
      timeout: 120000,
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--enable-precise-memory-info'],
        },
      },
      dependencies: ['setup'],
    },
  ],

  webServer: [],

  // Output directory for artifacts
  outputDir: './reports/test-artifacts',

  // Global setup/teardown
  globalSetup: path.join(__dirname, 'fixtures/global.setup.ts'),
  globalTeardown: path.join(__dirname, 'fixtures/global.teardown.ts'),
});
