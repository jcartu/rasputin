#!/usr/bin/env tsx
/**
 * Visual Comparison Script - Uses local RTX 6000 Pro with llama3.2-vision:90b
 * Compares JARVIS-built portal vs reference Silk Road Portal
 */

import { chromium, type Page } from "playwright";
import * as fs from "fs";
import * as path from "path";

const OLLAMA_BASE_URL = "http://localhost:11434";
const VISION_MODEL = "llama3.2-vision:90b";

const JARVIS_PORTAL = "https://ru-cn-portal-v2.vercel.app";
const REFERENCE_PORTAL = "https://silk-road-portal.vercel.app";

const OUTPUT_DIR = "/tmp/visual-comparison";

interface PageToCompare {
  name: string;
  jarvisPath: string;
  referencePath: string;
  interactions?: string[];
}

const PAGES_TO_COMPARE: PageToCompare[] = [
  {
    name: "Homepage-Map",
    jarvisPath: "/",
    referencePath: "/en",
    interactions: ["map hover", "region click"],
  },
  {
    name: "Investment-Opportunities",
    jarvisPath: "/",
    referencePath: "/en/invest",
    interactions: ["browse investments", "view details"],
  },
  {
    name: "Laws-Regulations",
    jarvisPath: "/",
    referencePath: "/en/laws",
    interactions: ["browse laws"],
  },
  {
    name: "News",
    jarvisPath: "/",
    referencePath: "/en/news",
    interactions: ["read articles"],
  },
  {
    name: "Contact-Form",
    jarvisPath: "/",
    referencePath: "/en/contact",
    interactions: ["form submission"],
  },
  {
    name: "Organizations",
    jarvisPath: "/",
    referencePath: "/en/organizations",
    interactions: ["browse orgs"],
  },
  {
    name: "Calendar-Events",
    jarvisPath: "/",
    referencePath: "/en/calendar",
    interactions: ["view events"],
  },
];

async function analyzeWithVision(
  imageBase64: string,
  prompt: string
): Promise<string> {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: VISION_MODEL,
      prompt,
      images: [imageBase64],
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Vision API error: ${response.status}`);
  }

  const data = (await response.json()) as { response: string };
  return data.response;
}

async function takeScreenshot(
  page: Page,
  url: string,
  name: string
): Promise<string> {
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2000);

  const screenshotPath = path.join(OUTPUT_DIR, `${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const buffer = fs.readFileSync(screenshotPath);
  return buffer.toString("base64");
}

async function comparePages(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  pageConfig: PageToCompare
): Promise<{
  name: string;
  jarvisAnalysis: string;
  referenceAnalysis: string;
  comparison: string;
}> {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();

  console.log(`\n📸 Capturing: ${pageConfig.name}`);

  const jarvisUrl = JARVIS_PORTAL + pageConfig.jarvisPath;
  const referenceUrl = REFERENCE_PORTAL + pageConfig.referencePath;

  console.log(`  JARVIS: ${jarvisUrl}`);
  const jarvisBase64 = await takeScreenshot(
    page,
    jarvisUrl,
    `jarvis-${pageConfig.name.toLowerCase().replace(/\s+/g, "-")}`
  );

  console.log(`  Reference: ${referenceUrl}`);
  const referenceBase64 = await takeScreenshot(
    page,
    referenceUrl,
    `reference-${pageConfig.name.toLowerCase().replace(/\s+/g, "-")}`
  );

  await context.close();

  console.log(`  🔍 Analyzing with ${VISION_MODEL}...`);

  const analysisPrompt = `Analyze this web page screenshot in detail. Identify:
1. Overall layout and structure
2. Navigation elements (menus, links, buttons)
3. Interactive components (maps, forms, filters)
4. Visual design (colors, typography, spacing)
5. Content sections and their purpose
6. Call-to-action elements
7. Any issues or missing elements

Be specific and detailed.`;

  const jarvisAnalysis = await analyzeWithVision(jarvisBase64, analysisPrompt);
  const referenceAnalysis = await analyzeWithVision(
    referenceBase64,
    analysisPrompt
  );

  const comparisonPrompt = `You are comparing two web portal implementations.

JARVIS-BUILT PORTAL ANALYSIS:
${jarvisAnalysis}

REFERENCE PORTAL ANALYSIS:
${referenceAnalysis}

Compare these two implementations and provide:
1. MATCHING FEATURES: What functionality is present in both?
2. MISSING FROM JARVIS: What does the reference have that JARVIS is missing?
3. EXTRA IN JARVIS: What does JARVIS have that's not in reference?
4. VISUAL DIFFERENCES: Layout, colors, typography differences
5. UX QUALITY SCORE: Rate JARVIS implementation 1-10 vs reference
6. RECOMMENDATIONS: Specific improvements needed

Be critical and specific.`;

  const comparison = await analyzeWithVision(jarvisBase64, comparisonPrompt);

  return {
    name: pageConfig.name,
    jarvisAnalysis,
    referenceAnalysis,
    comparison,
  };
}

async function testInteraction(
  page: Page,
  action: string,
  selector: string
): Promise<{ success: boolean; result: string }> {
  try {
    if (action === "click") {
      await page.click(selector, { timeout: 5000 });
      await page.waitForTimeout(1000);
      return { success: true, result: "Click successful" };
    } else if (action === "hover") {
      await page.hover(selector, { timeout: 5000 });
      await page.waitForTimeout(500);
      return { success: true, result: "Hover successful" };
    }
    return { success: false, result: "Unknown action" };
  } catch (error) {
    return {
      success: false,
      result: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  console.log("🚀 Visual Comparison Script");
  console.log(`   Using: ${VISION_MODEL} on RTX 6000 Pro`);
  console.log(`   JARVIS Portal: ${JARVIS_PORTAL}`);
  console.log(`   Reference Portal: ${REFERENCE_PORTAL}`);
  console.log("");

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const modelCheck = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
  if (!modelCheck.ok) {
    console.error("❌ Ollama not available at", OLLAMA_BASE_URL);
    process.exit(1);
  }
  const models = (await modelCheck.json()) as {
    models: Array<{ name: string }>;
  };
  const hasVision = models.models.some(m => m.name === VISION_MODEL);
  if (!hasVision) {
    console.error(`❌ Vision model ${VISION_MODEL} not available`);
    console.log("   Available:", models.models.map(m => m.name).join(", "));
    process.exit(1);
  }
  console.log(`✅ Vision model ready: ${VISION_MODEL}\n`);

  const browser = await chromium.launch({ headless: true });

  const results: Array<{
    name: string;
    jarvisAnalysis: string;
    referenceAnalysis: string;
    comparison: string;
  }> = [];

  for (const pageConfig of PAGES_TO_COMPARE) {
    try {
      const result = await comparePages(browser, pageConfig);
      results.push(result);
      console.log(`  ✅ ${pageConfig.name} analyzed`);
    } catch (error) {
      console.error(
        `  ❌ ${pageConfig.name} failed:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  await browser.close();

  const report = `# Visual Comparison Report
Generated: ${new Date().toISOString()}
Vision Model: ${VISION_MODEL}

## Summary
- JARVIS Portal: ${JARVIS_PORTAL}
- Reference Portal: ${REFERENCE_PORTAL}
- Pages Compared: ${results.length}

${results
  .map(
    r => `
## ${r.name}

### JARVIS Portal Analysis
${r.jarvisAnalysis}

### Reference Portal Analysis
${r.referenceAnalysis}

### Comparison
${r.comparison}

---
`
  )
  .join("\n")}
`;

  const reportPath = path.join(OUTPUT_DIR, "comparison-report.md");
  fs.writeFileSync(reportPath, report);
  console.log(`\n📄 Report saved: ${reportPath}`);

  console.log("\n" + "=".repeat(60));
  console.log("QUICK SUMMARY");
  console.log("=".repeat(60));

  for (const r of results) {
    console.log(`\n### ${r.name}`);
    const lines = r.comparison.split("\n").slice(0, 15);
    console.log(lines.join("\n"));
  }
}

main().catch(console.error);
