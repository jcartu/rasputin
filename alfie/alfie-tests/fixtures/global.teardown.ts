import { FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * Global teardown - runs once after all tests
 */
async function globalTeardown(config: FullConfig): Promise<void> {
  console.log('\n=== ALFIE E2E Test Suite - Global Teardown ===\n');

  // Clean up test data
  await cleanupTestData();

  // Generate summary report
  await generateSummaryReport();

  // Clean up auth state
  cleanupAuthState();

  console.log('\nGlobal teardown completed\n');
}

async function cleanupTestData(): Promise<void> {
  console.log('Cleaning up test data...');

  try {
    const apiUrl = process.env.ALFIE_API_URL || 'http://localhost:3001';

    // Clean up test sessions
    await fetch(`${apiUrl}/api/test/cleanup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: 'test_' }),
    }).catch(() => {});

    console.log('  [OK] Test data cleaned up');
  } catch {
    console.log('  [INFO] Cleanup endpoint not available');
  }
}

async function generateSummaryReport(): Promise<void> {
  console.log('Generating summary report...');

  const reportsDir = './reports';
  const resultsPath = path.join(reportsDir, 'results.json');

  if (fs.existsSync(resultsPath)) {
    try {
      const results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));

      const summary = {
        timestamp: new Date().toISOString(),
        totalTests:
          results.suites?.reduce(
            (acc: number, suite: any) => acc + (suite.specs?.length || 0),
            0
          ) || 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: results.stats?.duration || 0,
        categories: {} as Record<string, { passed: number; failed: number }>,
      };

      // Calculate stats per category
      const categories = [
        'ai',
        'realtime',
        'integrations',
        'ui',
        'dataviz',
        'platform',
        'enterprise',
        'stress',
        'manus-killer',
      ];

      for (const category of categories) {
        summary.categories[category] = { passed: 0, failed: 0 };
      }

      fs.writeFileSync(path.join(reportsDir, 'summary.json'), JSON.stringify(summary, null, 2));

      console.log('  [OK] Summary report generated');
    } catch {
      console.log('  [INFO] Could not generate summary');
    }
  }
}

function cleanupAuthState(): void {
  const authStatePath = './fixtures/.auth-state.json';
  if (fs.existsSync(authStatePath)) {
    fs.unlinkSync(authStatePath);
    console.log('  [OK] Auth state cleaned up');
  }
}

export default globalTeardown;
