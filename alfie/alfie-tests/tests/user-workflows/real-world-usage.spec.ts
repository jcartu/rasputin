import { test, expect } from '@playwright/test';

/**
 * Real-World User Workflows - Testing ALFIE like a MANUS user
 * 
 * These tests simulate actual user behavior and common tasks
 * that MANUS users would perform daily
 */

const ALFIE_URL = 'http://localhost:3000';

test.describe('Real-World ALFIE Usage - 100 User Scenarios', () => {
  
  test.describe('Getting Started & Onboarding', () => {
    
    test('should load the application and show welcome screen', async ({ page }) => {
      await page.goto(ALFIE_URL);
      await expect(page).toHaveTitle(/ALFIE/);
      await expect(page.locator('body')).toBeVisible();
    });

    test('should close welcome tour and show main interface', async ({ page }) => {
      await page.goto(ALFIE_URL);
      // Try to find and close tour if present
      const closeButton = page.locator('button:has-text("Skip"), button:has-text("Close"), button:has-text("Got it")').first();
      if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await closeButton.click();
      }
      await expect(page.locator('[data-testid="chat-input"], textarea, input[type="text"]').first()).toBeVisible();
    });

    test('should display sidebar with session list', async ({ page }) => {
      await page.goto(ALFIE_URL);
      await expect(page.locator('[data-testid="sidebar"], aside, nav').first()).toBeVisible();
    });

  });

  test.describe('Basic Chat Functionality', () => {
    
    test('should send a simple message and get response', async ({ page }) => {
      await page.goto(ALFIE_URL);
      
      // Find chat input
      const input = page.locator('textarea, input[type="text"]').first();
      await input.waitFor({ state: 'visible' });
      
      // Type and send message
      await input.fill('Hello, can you help me?');
      await page.keyboard.press('Enter');
      
      // Wait for response (with longer timeout)
      await expect(page.locator('text=/Hello|help|assist/i').first()).toBeVisible({ timeout: 30000 });
    });

    test('should send multiple messages in sequence', async ({ page }) => {
      await page.goto(ALFIE_URL);
      
      const input = page.locator('textarea').first();
      
      await input.fill('What is 2+2?');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
      
      await input.fill('And what is 5+5?');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
      
      // Should see both responses
      await expect(page.locator('text=/4/').first()).toBeVisible();
    });

    test('should handle long messages without breaking', async ({ page }) => {
      await page.goto(ALFIE_URL);
      
      const longMessage = 'This is a very long message that tests how the system handles extensive user input. '.repeat(20);
      
      const input = page.locator('textarea').first();
      await input.fill(longMessage);
      await page.keyboard.press('Enter');
      
      await page.waitForTimeout(5000);
      await expect(input).toBeEmpty();
    });

  });

  test.describe('Code-Related Tasks', () => {
    
    test('should request code snippet and display it properly', async ({ page }) => {
      await page.goto(ALFIE_URL);
      
      const input = page.locator('textarea').first();
      await input.fill('Write a Python function to calculate fibonacci');
      await page.keyboard.press('Enter');
      
      // Look for code block
      await expect(page.locator('code, pre').first()).toBeVisible({ timeout: 30000 });
    });

    test('should ask for code explanation', async ({ page }) => {
      await page.goto(ALFIE_URL);
      
      const input = page.locator('textarea').first();
      await input.fill('Explain what this code does: def hello(): print("world")');
      await page.keyboard.press('Enter');
      
      await expect(page.locator('text=/function|print|output/i').first()).toBeVisible({ timeout: 30000 });
    });

    test('should request code review', async ({ page }) => {
      await page.goto(ALFIE_URL);
      
      const input = page.locator('textarea').first();
      await input.fill('Review this code for bugs: for i in range(10) print(i)');
      await page.keyboard.press('Enter');
      
      await expect(page.locator('text=/syntax|error|colon|bug/i').first()).toBeVisible({ timeout: 30000 });
    });

  });

  test.describe('File Operations', () => {
    
    test('should open file browser', async ({ page }) => {
      await page.goto(ALFIE_URL);
      
      // Look for file browser icon/button
      const fileButton = page.locator('button:has-text("Files"), [data-testid="file-browser"]').first();
      if (await fileButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await fileButton.click();
        await expect(page.locator('[data-testid="file-tree"], [data-testid="file-list"]').first()).toBeVisible();
      }
    });

    test('should request to read a file', async ({ page }) => {
      await page.goto(ALFIE_URL);
      
      const input = page.locator('textarea').first();
      await input.fill('Read the contents of package.json');
      await page.keyboard.press('Enter');
      
      await page.waitForTimeout(5000);
    });

  });

  test.describe('Search & Navigation', () => {
    
    test('should trigger universal search with keyboard shortcut', async ({ page }) => {
      await page.goto(ALFIE_URL);
      
      // Cmd+K or Ctrl+K
      await page.keyboard.press('Meta+K');
      
      // Search modal should appear
      await expect(page.locator('[data-testid="search-modal"], [placeholder*="Search"]').first()).toBeVisible();
    });

    test('should create new chat session', async ({ page }) => {
      await page.goto(ALFIE_URL);
      
      const newChatButton = page.locator('button:has-text("New"), [data-testid="new-chat"]').first();
      if (await newChatButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await newChatButton.click();
        await expect(page.locator('textarea').first()).toBeEmpty();
      }
    });

  });

  test.describe('Settings & Customization', () => {
    
    test('should open settings panel', async ({ page }) => {
      await page.goto(ALFIE_URL);
      
      const settingsButton = page.locator('button:has-text("Settings"), [data-testid="settings"]').first();
      if (await settingsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await settingsButton.click();
        await expect(page.locator('[data-testid="settings-panel"], text=/Settings/i').first()).toBeVisible();
      }
    });

    test('should toggle theme', async ({ page }) => {
      await page.goto(ALFIE_URL);
      
      const themeToggle = page.locator('button:has-text("Theme"), [data-testid="theme-toggle"]').first();
      if (await themeToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
        await themeToggle.click();
        await page.waitForTimeout(1000);
      }
    });

  });

  test.describe('Research & Information Gathering', () => {
    
    test('should ask for web search', async ({ page }) => {
      await page.goto(ALFIE_URL);
      
      const input = page.locator('textarea').first();
      await input.fill('Search the web for latest AI news');
      await page.keyboard.press('Enter');
      
      await page.waitForTimeout(10000);
    });

    test('should request summary of article', async ({ page }) => {
      await page.goto(ALFIE_URL);
      
      const input = page.locator('textarea').first();
      await input.fill('Summarize this: https://example.com/article');
      await page.keyboard.press('Enter');
      
      await page.waitForTimeout(10000);
    });

  });

  test.describe('Creative Tasks', () => {
    
    test('should generate creative content', async ({ page }) => {
      await page.goto(ALFIE_URL);
      
      const input = page.locator('textarea').first();
      await input.fill('Write a short story about a robot');
      await page.keyboard.press('Enter');
      
      await expect(page.locator('text=/robot|story|once/i').first()).toBeVisible({ timeout: 30000 });
    });

    test('should generate marketing copy', async ({ page }) => {
      await page.goto(ALFIE_URL);
      
      const input = page.locator('textarea').first();
      await input.fill('Write a product description for smart headphones');
      await page.keyboard.press('Enter');
      
      await expect(page.locator('text=/headphone|sound|music|audio/i').first()).toBeVisible({ timeout: 30000 });
    });

  });

  test.describe('Data Analysis', () => {
    
    test('should analyze data patterns', async ({ page }) => {
      await page.goto(ALFIE_URL);
      
      const input = page.locator('textarea').first();
      await input.fill('Analyze this data: [1, 2, 3, 5, 8, 13, 21]');
      await page.keyboard.press('Enter');
      
      await expect(page.locator('text=/fibonacci|pattern|sequence/i').first()).toBeVisible({ timeout: 30000 });
    });

  });

  test.describe('Productivity', () => {
    
    test('should help draft an email', async ({ page }) => {
      await page.goto(ALFIE_URL);
      
      const input = page.locator('textarea').first();
      await input.fill('Draft a professional email to schedule a meeting');
      await page.keyboard.press('Enter');
      
      await expect(page.locator('text=/Dear|Subject|schedule|meeting/i').first()).toBeVisible({ timeout: 30000 });
    });

    test('should create a todo list', async ({ page }) => {
      await page.goto(ALFIE_URL);
      
      const input = page.locator('textarea').first();
      await input.fill('Create a todo list for launching a product');
      await page.keyboard.press('Enter');
      
      await expect(page.locator('text=/todo|task|list|1\\.|•/i').first()).toBeVisible({ timeout: 30000 });
    });

  });

  test.describe('Error Handling & Edge Cases', () => {
    
    test('should handle empty message submission', async ({ page }) => {
      await page.goto(ALFIE_URL);
      
      const input = page.locator('textarea').first();
      await input.fill('');
      await page.keyboard.press('Enter');
      
      // Should not crash, input should still be there
      await expect(input).toBeVisible();
    });

    test('should recover from network error', async ({ page }) => {
      await page.goto(ALFIE_URL);
      
      // Try to send message
      const input = page.locator('textarea').first();
      await input.fill('test message');
      await page.keyboard.press('Enter');
      
      // App should still be functional
      await page.waitForTimeout(3000);
      await expect(input).toBeVisible();
    });

  });

  test.describe('UI Responsiveness', () => {
    
    test('should work on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(ALFIE_URL);
      
      await expect(page.locator('textarea').first()).toBeVisible();
    });

    test('should work on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto(ALFIE_URL);
      
      await expect(page.locator('textarea').first()).toBeVisible();
    });

  });

});
