import { chromium, FullConfig } from '@playwright/test';
import { TestDataGenerator } from '../utils/test-data-generator';

/**
 * Global setup - runs once before all tests
 */
async function globalSetup(config: FullConfig): Promise<void> {
  console.log('\n=== ALFIE E2E Test Suite - Global Setup ===\n');

  const startTime = Date.now();

  // Wait for services to be ready
  await waitForServices();

  // Generate test data
  await generateTestData();

  // Create authenticated state
  await createAuthState(config);

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\nGlobal setup completed in ${duration}s\n`);
}

async function waitForServices(): Promise<void> {
  const services = [
    { name: 'ALFIE UI', url: process.env.ALFIE_UI_URL || 'http://localhost:3000' },
    { name: 'ALFIE Backend', url: process.env.ALFIE_API_URL || 'http://localhost:3001/api/health' },
  ];

  console.log('Waiting for services...');

  for (const service of services) {
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      try {
        const response = await fetch(service.url);
        if (response.ok) {
          console.log(`  [OK] ${service.name} is ready`);
          break;
        }
      } catch {
        // Service not ready yet
      }

      attempts++;
      if (attempts === maxAttempts) {
        console.warn(`  [WARN] ${service.name} not responding after ${maxAttempts} attempts`);
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

async function generateTestData(): Promise<void> {
  console.log('\nGenerating test data...');

  const generator = new TestDataGenerator();

  // Generate mock sessions
  await generator.generateSessions(10);
  console.log('  [OK] Generated 10 test sessions');

  // Generate mock conversations
  await generator.generateConversations(50);
  console.log('  [OK] Generated 50 test conversations');

  // Generate mock files
  await generator.generateFiles(100);
  console.log('  [OK] Generated 100 test files');

  // Generate mock memories for second brain
  await generator.generateMemories(1000);
  console.log('  [OK] Generated 1000 test memories');
}

async function createAuthState(config: FullConfig): Promise<void> {
  console.log('\nCreating authenticated browser state...');

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    const baseURL = config.projects[0]?.use?.baseURL || 'http://localhost:3000';

    // Navigate to login
    await page.goto(`${baseURL}/login`);

    // Perform authentication
    await page.fill('[data-testid="email-input"]', process.env.TEST_USER_EMAIL || 'test@alfie.dev');
    await page.fill(
      '[data-testid="password-input"]',
      process.env.TEST_USER_PASSWORD || 'test-password'
    );
    await page.click('[data-testid="login-button"]');

    // Wait for successful login
    await page.waitForURL('**/dashboard', { timeout: 10000 }).catch(() => {
      console.log('  [INFO] Dashboard redirect not detected, continuing...');
    });

    // Save storage state
    await page.context().storageState({ path: './fixtures/.auth-state.json' });
    console.log('  [OK] Authenticated state saved');
  } catch (error) {
    console.log('  [INFO] Auth setup skipped (server may not require auth)');
  } finally {
    await browser.close();
  }
}

export default globalSetup;
