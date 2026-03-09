import { BaseTool } from '../BaseTool.js';
import { chromium } from 'playwright';

let browserInstance = null;

async function getBrowser() {
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  }
  return browserInstance;
}

export class BrowserTool extends BaseTool {
  constructor() {
    super({
      name: 'browser',
      description: 'Browse websites to extract content, take screenshots, or interact with web pages. Operations: navigate (go to URL and get page text), screenshot (capture page as image), click (click an element), type (type text into an input), extract (extract structured data using CSS selectors).',
      parameters: {
        properties: {
          operation: { type: 'string', enum: ['navigate', 'screenshot', 'click', 'type', 'extract'], description: 'Browser operation' },
          url: { type: 'string', description: 'URL to navigate to (for navigate/screenshot)' },
          selector: { type: 'string', description: 'CSS selector for click/type/extract operations' },
          text: { type: 'string', description: 'Text to type (for type operation)' },
          extractFields: { type: 'object', description: 'Map of field names to CSS selectors (for extract operation)' },
        },
        required: ['operation'],
      },
    });
    this.timeout = 30000;
    this.page = null;
  }

  async execute(input, context) {
    const browser = await getBrowser();
    if (!this.page || this.page.isClosed()) {
      this.page = await browser.newPage();
    }
    
    switch (input.operation) {
      case 'navigate': {
        if (!input.url) throw new Error('url required for navigate');
        await this.page.goto(input.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        const title = await this.page.title();
        const text = await this.page.evaluate(() => {
          const body = document.body;
          const clone = body.cloneNode(true);
          clone.querySelectorAll('script, style, nav, footer, header').forEach(el => {
            el.remove();
          });
          return clone.innerText?.slice(0, 15000) || '';
        });
        return { title, url: this.page.url(), text };
      }
      case 'screenshot': {
        if (input.url) {
          await this.page.goto(input.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        }
        const buffer = await this.page.screenshot({ type: 'png', fullPage: false });
        return { screenshot: `data:image/png;base64,${buffer.toString('base64')}`, url: this.page.url() };
      }
      case 'click': {
        if (!input.selector) throw new Error('selector required for click');
        await this.page.click(input.selector, { timeout: 5000 });
        await this.page.waitForTimeout(1000);
        return { clicked: input.selector, url: this.page.url() };
      }
      case 'type': {
        if (!input.selector || !input.text) throw new Error('selector and text required for type');
        await this.page.fill(input.selector, input.text);
        return { typed: input.text, selector: input.selector };
      }
      case 'extract': {
        if (!input.selector && !input.extractFields) throw new Error('selector or extractFields required');
        if (input.extractFields) {
          const results = {};
          for (const [key, sel] of Object.entries(input.extractFields)) {
            results[key] = await this.page.$$eval(sel, els => els.map(el => el.textContent?.trim()).filter(Boolean));
          }
          return results;
        }
        const elements = await this.page.$$eval(input.selector, els => els.map(el => el.textContent?.trim()).filter(Boolean));
        return { elements: elements.slice(0, 100) };
      }
      default:
        throw new Error(`Unknown browser operation: ${input.operation}`);
    }
  }
}
