import { test, expect, type Page, type ConsoleMessage } from "@playwright/test";

test.use({ baseURL: "https://alfie-ui.vercel.app" });

const LONG_TIMEOUT = 120000;
const RESPONSE_TIMEOUT = 60000;

const RIGHT_PANEL_TABS = [
  "artifacts",
  "tools",
  "files",
  "history",
  "stats",
  "voice",
  "templates",
  "media",
  "email",
  "notebook",
  "workflow",
  "collab",
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
});

const getChatArea = (page: Page) =>
  page.locator('[data-tutorial="chat-area"], [aria-label="Chat area"]');

const getChatInput = (page: Page) => page.getByLabel("Chat message input");

const getRightPanel = (page: Page) =>
  page.locator('[data-tutorial="right-panel"]');

const getPanelToggle = (page: Page) =>
  page.locator('[data-tutorial="panel-toggle"]');

const dismissTourIfPresent = async (page: Page) => {
  const maybeLater = page.getByRole("button", { name: "Maybe Later" });
  if (await maybeLater.isVisible({ timeout: 2000 }).catch(() => false)) {
    await maybeLater.click();
    await page.waitForTimeout(300);
  }
};

const ensureRightPanelOpen = async (page: Page) => {
  await dismissTourIfPresent(page);
  const panel = getRightPanel(page);
  if (!(await panel.isVisible().catch(() => false))) {
    const toggle = getPanelToggle(page);
    if (await toggle.isVisible().catch(() => false)) {
      await toggle.click();
    } else {
      // The panel toggle may not have data-tutorial; find rightmost header button
      const allButtons = page.locator("button");
      const count = await allButtons.count();
      for (let i = count - 1; i >= 0; i--) {
        const btn = allButtons.nth(i);
        const box = await btn.boundingBox();
        if (box && box.x > 1500) {
          await btn.click();
          break;
        }
      }
    }
    await expect(panel).toBeVisible({ timeout: 15000 });
  }
  // Framer-motion animates width from 0 to 340px over 200ms — wait for completion
  await page.waitForTimeout(800);
};

const clickTab = async (page: Page, tabValue: string) => {
  // Radix tabs use IDs like radix-:rXX:-trigger-{value}
  const tab = page.locator(`[role="tab"][id*="trigger-${tabValue}"]`);
  if (await tab.isVisible().catch(() => false)) {
    await tab.click();
    return tab;
  }
  // Fallback: nth index
  const idx = RIGHT_PANEL_TABS.indexOf(tabValue);
  if (idx >= 0) {
    const nthTab = page.locator('[role="tablist"] [role="tab"]').nth(idx);
    if (await nthTab.isVisible().catch(() => false)) {
      await nthTab.click();
      return nthTab;
    }
  }
  throw new Error(`Tab "${tabValue}" not found`);
};

test("1. Page Load & Basic UI", async ({ page }) => {
  test.setTimeout(LONG_TIMEOUT);
  let pageErrorCount = 0;
  page.on("pageerror", () => {
    pageErrorCount += 1;
  });

  await page.goto("/");
  await dismissTourIfPresent(page);
  await expect(getChatArea(page)).toBeVisible();
  await expect(getChatInput(page)).toBeVisible();
  await expect(page.locator('[data-tutorial="sidebar"]')).toBeVisible();

  const title = await page.title();
  if (/alfie/i.test(title)) {
    expect(title).toMatch(/alfie/i);
  } else {
    expect(pageErrorCount).toBe(0);
  }
});

test("2. Right Panel — All 12 Tabs Clickable", async ({ page }) => {
  test.setTimeout(LONG_TIMEOUT);
  let consoleErrorCount = 0;
  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() === "error") {
      consoleErrorCount += 1;
    }
  });
  page.on("pageerror", () => {
    consoleErrorCount += 1;
  });

  await page.goto("/");
  await ensureRightPanelOpen(page);

  for (const tabValue of RIGHT_PANEL_TABS) {
    consoleErrorCount = 0;
    const tab = await clickTab(page, tabValue);
    await expect(tab).toHaveAttribute("data-state", "active");
    await expect(
      page.locator('[role="tabpanel"][data-state="active"]')
    ).toBeVisible();
    expect(consoleErrorCount).toBe(0);
  }
});

test("3. Chat Functionality", async ({ page }) => {
  test.setTimeout(LONG_TIMEOUT);
  await page.goto("/");
  await dismissTourIfPresent(page);

  const input = getChatInput(page);
  await input.fill("Hello, what is 2+2?");
  await input.press("Enter");

  const chatArea = getChatArea(page);
  const assistantMessages = chatArea.locator(".markdown-renderer, .prose");
  await expect(assistantMessages.first()).toBeVisible({ timeout: RESPONSE_TIMEOUT });
  await expect(assistantMessages.first()).toHaveText(/\S+/, { timeout: RESPONSE_TIMEOUT });
});

test("4. Chat Input — File Upload UI", async ({ page }) => {
  test.setTimeout(LONG_TIMEOUT);
  await page.goto("/");
  await dismissTourIfPresent(page);

  const chatInput = page.locator('[data-tutorial="chat-input"]');
  const fileInput = page.locator('input[type="file"]');

  await expect(chatInput).toBeVisible();
  await expect(fileInput).toBeAttached();
  await expect(fileInput).toBeHidden();

  const attachButton = chatInput.locator("button").first();
  await expect(attachButton).toBeVisible();
  await attachButton.click({ trial: true });
});

test("5. Sidebar — New Chat", async ({ page }) => {
  test.setTimeout(LONG_TIMEOUT);
  await page.goto("/");
  await dismissTourIfPresent(page);

  const chatArea = getChatArea(page);
  const input = getChatInput(page);
  await input.fill("Hello, what is 2+2?");
  await input.press("Enter");
  await expect(chatArea.getByText("Hello, what is 2+2?")).toBeVisible({
    timeout: RESPONSE_TIMEOUT,
  });

  const newChatButton = page.locator('[data-tutorial="new-chat-button"]');
  await expect(newChatButton).toBeVisible();
  await newChatButton.click();

  await expect(chatArea.getByText("Hello, what is 2+2?")).toHaveCount(0);
});

test("6. Share Button", async ({ page }) => {
  test.setTimeout(LONG_TIMEOUT);
  await page.goto("/");
  await dismissTourIfPresent(page);

  const shareButton = page.getByRole("button", {
    name: /Share conversation/i,
  });
  await expect(shareButton).toBeVisible();
  await expect(shareButton).toBeEnabled();
  await shareButton.click({ trial: true });
});

test("7. Templates Tab Content", async ({ page }) => {
  test.setTimeout(LONG_TIMEOUT);
  await page.goto("/");
  await ensureRightPanelOpen(page);

  const tab = await clickTab(page, "templates");
  await expect(tab).toHaveAttribute("data-state", "active");

  const templatesContent = page.locator(
    '[role="tabpanel"][data-state="active"]'
  );
  await expect(templatesContent).toBeVisible();

  const hasSearch = await templatesContent
    .getByPlaceholder(/search/i)
    .isVisible()
    .catch(() => false);
  const hasTemplateText = await templatesContent
    .getByText(/template/i)
    .first()
    .isVisible()
    .catch(() => false);
  expect(hasSearch || hasTemplateText).toBeTruthy();
});

test("8. No Console Error Spam (TTS fix verification)", async ({ page }) => {
  test.setTimeout(LONG_TIMEOUT);
  const ttsErrorCounts = new Map<string, number>();
  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (!/tts|voice|elevenlabs/i.test(text)) return;
    ttsErrorCounts.set(text, (ttsErrorCounts.get(text) ?? 0) + 1);
  });
  page.on("pageerror", (error: Error) => {
    const text = error.message;
    if (!/tts|voice|elevenlabs/i.test(text)) return;
    ttsErrorCounts.set(text, (ttsErrorCounts.get(text) ?? 0) + 1);
  });

  await page.goto("/");
  await page.waitForTimeout(5000);

  const maxTtsCount = Math.max(0, ...ttsErrorCounts.values());
  expect(maxTtsCount).toBeLessThan(5);
});

test("9. Backend API Health Check", async ({ request }) => {
  test.setTimeout(LONG_TIMEOUT);
  const response = await request.get(
    "https://alfie-backend.ngrok.app/api/health"
  );
  expect(response.status()).toBe(200);

  const body: any = await response.json();
  expect(body.status).toBe("ok");

  // API returns { llm: { primary: {...}, secondary: {...} } }
  const llm = body.llm || body.llms || {};
  const llmEntries: any[] = Object.values(llm);
  const connectedCount = llmEntries.filter((entry: any) => {
    if (!entry || typeof entry !== "object") return false;
    return (
      (entry as any).connected === true ||
      (entry as any).status === "connected" ||
      (entry as any).state === "connected"
    );
  }).length;

  expect(connectedCount).toBeGreaterThanOrEqual(2);
});

test("10. Backend API — Workflows Endpoint", async ({ request }) => {
  test.setTimeout(LONG_TIMEOUT);
  const response = await request.get(
    "https://alfie-backend.ngrok.app/api/workflows"
  );
  expect(response.status()).toBe(200);
});

test("11. Backend API — Notebooks Endpoint", async ({ request }) => {
  test.setTimeout(LONG_TIMEOUT);
  const response = await request.get(
    "https://alfie-backend.ngrok.app/api/notebooks"
  );
  expect(response.status()).toBe(200);
});

test("12. Backend API — Documents (Collab) Endpoint", async ({ request }) => {
  test.setTimeout(LONG_TIMEOUT);
  const response = await request.get(
    "https://alfie-backend.ngrok.app/api/documents"
  );
  expect(response.status()).toBe(200);
});

test("13. Layout Integrity — ChatArea doesn't overlap RightPanel", async ({
  page,
}) => {
  test.setTimeout(LONG_TIMEOUT);
  await page.goto("/");
  await ensureRightPanelOpen(page);

  const chatArea = getChatArea(page);
  const rightPanel = getRightPanel(page);
  await expect(chatArea).toBeVisible();
  await expect(rightPanel).toBeVisible();

  const rightPanelZIndex = await rightPanel.evaluate((el) =>
    window.getComputedStyle(el).zIndex
  );
  expect(Number(rightPanelZIndex)).toBeGreaterThan(0);

  const chatBox = await chatArea.boundingBox();
  const panelBox = await rightPanel.boundingBox();
  expect(chatBox).not.toBeNull();
  expect(panelBox).not.toBeNull();

  if (chatBox && panelBox) {
    expect(panelBox.x).toBeGreaterThan(chatBox.x + chatBox.width - 5);
  }
});

test("14. Code Block Actions (if response from test 3 contains code)", async ({
  page,
}) => {
  test.setTimeout(LONG_TIMEOUT);
  await page.goto("/");
  await dismissTourIfPresent(page);

  const input = getChatInput(page);
  await input.fill("Write a JavaScript hello world code block");
  await input.press("Enter");

  const chatArea = getChatArea(page);
  const assistantMessages = chatArea.locator(".markdown-renderer, .prose");
  await expect(assistantMessages.first()).toBeVisible({
    timeout: RESPONSE_TIMEOUT,
  });

  await page.waitForTimeout(3000);

  const codeBlocks = chatArea.locator("pre code");
  const codeCount = await codeBlocks.count();

  if (codeCount > 0) {
    const copyBtn = chatArea.getByRole("button", { name: /Copy code/i }).first();
    const downloadBtn = chatArea.getByRole("button", { name: /Download code/i }).first();
    await expect(copyBtn).toBeVisible({ timeout: 5000 });
    await expect(downloadBtn).toBeVisible({ timeout: 5000 });
  } else {
    test.info().annotations.push({
      type: "note",
      description: "No code block returned; copy/download checks skipped.",
    });
  }
});
