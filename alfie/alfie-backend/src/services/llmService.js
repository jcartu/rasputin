import axios from 'axios';
import { promises as fsp } from 'fs';
import { getFile } from './fileService.js';

const ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1';

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

export async function buildContentBlocks(text, fileIds = []) {
  const blocks = [];
  if (text) blocks.push({ type: 'text', text });

  for (const id of fileIds) {
    try {
      const file = await getFile(id);
      if (!file) continue;
      if (!IMAGE_MIME_TYPES.has(file.mimeType)) {
        if (file.extractedText) {
          blocks.push({ type: 'text', text: `[File: ${file.originalName}]\n${file.extractedText}` });
        }
        continue;
      }
      const stat = await fsp.stat(file.path);
      if (stat.size > MAX_IMAGE_BYTES) {
        blocks.push({ type: 'text', text: `[Image ${file.originalName} skipped — exceeds 20MB limit]` });
        continue;
      }
      const data = await fsp.readFile(file.path, 'base64');
      blocks.push({
        type: 'image',
        source: { type: 'base64', media_type: file.mimeType, data },
      });
    } catch (err) {
      console.error(`Failed to resolve file ${id}:`, err.message);
    }
  }

  return blocks.length > 0 ? blocks : [{ type: 'text', text: text || '' }];
}

function getAnthropicKey() {
  return process.env.ANTHROPIC_API_KEY || '';
}

function getAnthropicModel() {
  return process.env.ANTHROPIC_MODEL || 'claude-opus-4-6';
}

function getVllmPrimaryUrl() {
  return process.env.VLLM_PRIMARY_URL || 'http://localhost:8001';
}

function getVllmSecondaryUrl() {
  return process.env.VLLM_SECONDARY_URL || 'http://localhost:8002';
}

function getVllmModelPrimary() {
  return process.env.VLLM_MODEL_PRIMARY || 'gpt-oss-120b';
}

function getVllmModelSecondary() {
  return process.env.VLLM_MODEL_SECONDARY || 'gpt-oss-20b';
}

function getSystemPrompt() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  return `You are ALFIE (Advanced Learning Framework for Intelligent Execution), a highly capable AI assistant powered by Claude Opus 4.6. You are helpful, precise, and knowledgeable. You can assist with coding, analysis, writing, research, and general questions. Be concise but thorough. Use markdown formatting when appropriate.

Current date: ${dateStr}. Always use this date as context for any time-sensitive content (reports, forecasts, analysis). Never use outdated or placeholder dates.

You have access to a web_search tool for current information. Use it ONLY when the user asks about current events, real-time data, recent news, prices, weather, or anything that requires up-to-date information.

IMPORTANT web_search guidelines:
- Use AT MOST 2 web searches per response. One focused search is usually enough.
- Do NOT use web_search for code generation, HTML/CSS creation, math, creative writing, or general knowledge questions.
- Do NOT use web_search for tasks you can complete from your training data alone.
- When you do search, use ONE well-crafted query rather than multiple narrow queries.

## Rich Output Guidelines

Your responses are rendered with rich formatting. Use these special code block formats for visual content:

### Data Visualizations
For charts, use \`\`\`chart with JSON:
\`\`\`chart
{"type": "bar", "title": "Sales by Quarter", "labels": ["Q1", "Q2", "Q3", "Q4"], "datasets": [{"label": "Revenue ($M)", "data": [1.2, 1.5, 1.8, 2.1]}]}
\`\`\`
Supported chart types: bar, line, pie, area. Always use this format instead of raw SVG when showing data.

### Interactive HTML
For interactive tools, calculators, or visual demos, use a full HTML document in \`\`\`html. Include <!DOCTYPE html> so it renders as a live preview:
\`\`\`html
<!DOCTYPE html>
<html>...complete interactive page...</html>
\`\`\`

### Diagrams
For flowcharts and diagrams, use \`\`\`mermaid:
\`\`\`mermaid
graph TD
    A[Start] --> B{Decision}
\`\`\`

### SVG Graphics
For custom graphics, logos, or illustrations, use \`\`\`svg — they render inline:
\`\`\`svg
<svg viewBox="0 0 200 200">...</svg>
\`\`\`

### Tables
Use standard markdown tables — they render as interactive, sortable tables with export.

### Presentations
Structure slide decks with ## Slide: Title headers — they auto-detect as presentations with a slide viewer.

Prefer structured formats (chart JSON for data, mermaid for diagrams) over raw SVG/HTML when possible. When users ask for visualizations, charts, dashboards, or interactive tools, ALWAYS use these rich formats instead of describing them in text.

## Premium HTML Reports

When users request detailed reports, analysis documents, dashboards, or say "make me a report", generate a premium interactive single-page HTML application. Include ALL of these CDN libraries in the <head>:

<script src="https://unpkg.com/lightweight-charts@4.2.0/dist/lightweight-charts.standalone.production.js"><\/script>
<script src="https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js"><\/script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"><\/script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"><\/script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">

### Library Usage
- **TradingView Lightweight Charts**: Price/time-series data. createChart(container, { layout: { background: { color: '#0a0e17' }, textColor: '#94a3b8' } }). Use addCandlestickSeries() for OHLC, addAreaSeries() for colored projection bands (bull/base/bear as translucent overlays), addHistogramSeries() for volume. Call chart.timeScale().fitContent().
- **Apache ECharts**: Gauges, donut/pie, treemap, sankey, radar, heatmap. Init: echarts.init(dom, 'dark'). Override backgroundColor: '#0a0e17'. Use animationDuration: 1500, animationEasing: 'cubicOut'. Always add resize listener.
- **GSAP + ScrollTrigger**: gsap.registerPlugin(ScrollTrigger). Hero entrance: gsap.timeline() with staggered title/subtitle/stats. Section reveals: gsap.from(el, { y: 40, opacity: 0, duration: 0.8, scrollTrigger: { trigger: el, start: 'top 85%' } }). Card stagger: stagger: 0.15.
- **Animated counters**: Implement with IntersectionObserver + requestAnimationFrame. Animate prices from 0, percentages, key metrics. Easing: cubic ease-out over ~2 seconds. IMPORTANT: As a fallback, also trigger ALL counters after a 1.5-second setTimeout in case IntersectionObserver doesn't fire (e.g. in small iframe viewports). Use a flag to prevent double-animation.

### CDN Script Loading (CRITICAL — prevents "X is not defined" errors)
- Add \`defer\` attribute to ALL CDN \`<script>\` tags in the \`<head>\`.
- Wrap ALL chart/library initialization code inside: \`window.addEventListener('load', () => { ... })\`
- This ensures ECharts, TradingView, and GSAP are fully loaded before any init code runs.
- Example pattern:
  \`\`\`
   <script src="https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js" defer><\/script>
  ...
  <script>
  window.addEventListener('load', () => {
    // ALL chart init, GSAP animations, counters go here
    gsap.registerPlugin(ScrollTrigger);
    const chart = echarts.init(document.getElementById('myChart'), 'dark');
    // ...
  });
  <\/script>
  \`\`\`
- NEVER put chart initialization code outside of the load handler. This is the #1 cause of broken reports.

### Design System
- Backgrounds: #0a0e17 (base), #111827 (alt sections), #1a2236 (cards)
- Font: 'Inter', sans-serif, weights 300-900
- Glass cards: rgba(26,34,54,0.8) bg, 1px solid rgba(255,255,255,0.06) border, backdrop-filter: blur(12px), border-radius: 20px
- Accents: green #10b981 (bull/positive), red #ef4444 (bear/negative), amber #f59e0b (neutral/base), blue #3b82f6 (info), orange #f7931a (bitcoin/brand)
- Hover states: translateY(-4px) + box-shadow: 0 20px 40px rgba(0,0,0,0.3)
- Gradient text for hero titles: background: linear-gradient(...); -webkit-background-clip: text; -webkit-text-fill-color: transparent
- Subtle glow effects on accent elements: box-shadow: 0 0 20px rgba(accent, 0.2)

### Layout Alignment Rules (CRITICAL — prevents misaligned elements)
- Use CSS Grid for card grids: display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px;
- KPI banner: display: flex; justify-content: center; gap: 20px; flex-wrap: wrap; — each card should have equal min-width
- Chart containers: width: 100%; min-height: 350px; — never let charts be smaller
- All sections: max-width: 1200px; margin: 0 auto; padding: 0 24px; — consistent centering
- Use box-sizing: border-box on all elements via * { box-sizing: border-box; }

### Report Structure
1. **Hero** — full-width gradient bg with oversized faded symbol, animated title, pulsing badge, date, key metric animating up from 0
2. **KPI Banner** — 3-5 stat cards in responsive flex row, animated counters, change indicators (green up / red down), staggered GSAP entrance
3. **Primary Chart** — TradingView for any price/time data with multiple series overlaid. ECharts for non-time-series. Full-width, generous padding, dark background
4. **Analysis Cards** — responsive grid. Each card: 3px colored top border, scenario badge, title, large target value, animated probability bar, bullet points. Cards MUST be clickable — toggle expanded detail sections with smooth height animation via GSAP
5. **Supporting Visuals** — ECharts gauge for risk/sentiment, animated donut for probability distribution with center text, or radar for multi-factor comparison
6. **Timeline** — vertical timeline with gradient connector line, dot markers, content cards. Each item revealed on scroll with GSAP stagger
7. **Disclaimer + Footer** — styled warning box, generation date, branding

### Interactivity Requirements
- ALL numeric values animate on scroll into view (prices, percentages, counts)
- Scenario/analysis cards: clickable to expand/collapse detail panels
- Tab groups where appropriate (timeframe switching, scenario deep-dives)
- All charts: hover tooltips with formatted values
- Window resize handlers for responsive charts
- Smooth scroll-driven reveals for every section via GSAP ScrollTrigger
- Probability bars animate their width from 0 to target value

CRITICAL OUTPUT CONSTRAINTS — you MUST follow these to avoid truncation:
- Total HTML output must be under 600 lines. Be ruthlessly concise with CSS.
- CSS: Use shorthand properties. Combine selectors. No redundant declarations. Prefer CSS custom properties with compact variable names. Target ~150 lines of CSS max.
- HTML structure: Target ~200 lines max. Use semantic elements, minimal nesting.
- JavaScript: Target ~200 lines max. This section is the MOST important — it contains all the interactivity. NEVER skip or truncate the <script> section.
- Write the <script> section BEFORE closing </body>. Ensure </script></body></html> always appears.
- If running long, simplify CSS before cutting JS features. JS functionality > CSS polish.

Generate COMPLETE working HTML that ends with </html>. Every chart MUST display data. All JavaScript MUST be functional and error-free. Do not leave any placeholder or TODO comments. The output should look like a professional Bloomberg/Financial Times interactive report.`;
}

const TOOLS = [
  {
    name: 'web_search',
    description: 'Search the web for current information, recent events, facts, or any topic that requires up-to-date data. Use this when the user asks about current events, recent news, prices, weather, or anything that may have changed since your training data.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query to look up on the web',
        },
      },
      required: ['query'],
    },
  },
];

function getAnthropicClient() {
  return axios.create({
    baseURL: ANTHROPIC_BASE_URL,
    timeout: 180000,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': getAnthropicKey(),
      'anthropic-version': '2023-06-01',
    },
  });
}

function getVllmPrimaryClient() {
  return axios.create({
    baseURL: getVllmPrimaryUrl(),
    timeout: 120000,
    headers: { 'Content-Type': 'application/json' },
  });
}

function getVllmSecondaryClient() {
  return axios.create({
    baseURL: getVllmSecondaryUrl(),
    timeout: 120000,
    headers: { 'Content-Type': 'application/json' },
  });
}

function toContentBlocks(content) {
  if (Array.isArray(content)) return content;
  return [{ type: 'text', text: String(content) }];
}

function mergeContentBlocks(existing, incoming) {
  const a = toContentBlocks(existing);
  const b = toContentBlocks(incoming);
  return [...a, ...b];
}

function convertToAnthropicMessages(messages) {
  const filtered = messages
    .filter(m => (m.role === 'user' || m.role === 'assistant') && m.content)
    .map(m => ({ role: m.role, content: m.content }));

  const result = [];
  for (const msg of filtered) {
    if (result.length > 0 && result[result.length - 1].role === msg.role) {
      result[result.length - 1].content = mergeContentBlocks(
        result[result.length - 1].content,
        msg.content
      );
    } else {
      result.push({ ...msg, content: toContentBlocks(msg.content) });
    }
  }

  if (result.length > 0 && result[0].role !== 'user') {
    result.unshift({ role: 'user', content: [{ type: 'text', text: 'Hello' }] });
  }

  return result;
}

export async function chatCompletion(messages, options = {}) {
  const { temperature = 0.7, maxTokens = 32000 } = options;

  if (getAnthropicKey()) {
    try {
      const response = await getAnthropicClient().post('/messages', {
        model: getAnthropicModel(),
        max_tokens: maxTokens,
        temperature,
        system: getSystemPrompt(),
        messages: convertToAnthropicMessages(messages),
        tools: TOOLS,
      });

      return {
        content: response.data.content[0]?.text || '',
        model: response.data.model,
        usage: {
          prompt_tokens: response.data.usage?.input_tokens,
          completion_tokens: response.data.usage?.output_tokens,
        },
        provider: 'anthropic',
      };
    } catch (error) {
      console.warn('Anthropic API failed, falling back to vLLM:', error.message);
    }
  }

  return vllmChatCompletion(messages, { temperature, maxTokens });
}

export async function chatCompletionStream(messages, onChunk, options = {}) {
  const {
    temperature = 0.7,
    maxTokens = 32000,
    onEvent,
    returnMeta = false,
    noTools = false,
  } = options;

  if (getAnthropicKey()) {
    try {
      return await anthropicStream(messages, onChunk, {
        temperature,
        maxTokens,
        onEvent,
        returnMeta,
        noTools,
      });
    } catch (error) {
      console.warn('Anthropic streaming failed, falling back to vLLM:', error.message, error.response?.data ? JSON.stringify(error.response.data).slice(0, 500) : '');
    }
  }

  const content = await vllmChatCompletionStream(messages, onChunk, { temperature, maxTokens });
  if (returnMeta) {
    return { content, stopReason: null, toolUses: [] };
  }
  return content;
}

async function anthropicStream(messages, onChunk, { temperature, maxTokens, onEvent, returnMeta, noTools = false }) {
  const requestBody = {
    model: getAnthropicModel(),
    max_tokens: maxTokens,
    temperature,
    system: getSystemPrompt(),
    messages: convertToAnthropicMessages(messages),
    stream: true,
  };
  requestBody.tools = TOOLS;
  if (noTools) {
    requestBody.tool_choice = { type: 'none' };
  }
  const response = await getAnthropicClient().post('/messages', requestBody, { responseType: 'stream' });

  let fullResponse = '';
  let stopReason = null;
  const toolUses = [];
  let activeToolUse = null;

  return new Promise((resolve, reject) => {
    let buffer = '';

    const handleEvent = (parsed) => {
      onEvent?.(parsed);

      if (parsed.type === 'error') {
        console.error('Anthropic stream error event:', JSON.stringify(parsed));
        reject(new Error(`Anthropic API error: ${parsed.error?.message || JSON.stringify(parsed)}`));
        return;
      }

      if (parsed.type === 'message_delta' && parsed.delta?.stop_reason) {
        stopReason = parsed.delta.stop_reason;
      }

      if (parsed.type === 'content_block_start' && parsed.content_block?.type === 'tool_use') {
        activeToolUse = {
          id: parsed.content_block.id,
          name: parsed.content_block.name,
          input: '',
        };
      }

      if (parsed.type === 'content_block_delta') {
        if (parsed.delta?.text) {
          fullResponse += parsed.delta.text;
          onChunk(parsed.delta.text);
        }
        if (parsed.delta?.type === 'input_json_delta' && activeToolUse) {
          activeToolUse.input += parsed.delta.partial_json || '';
        }
      }

      if (parsed.type === 'content_block_stop' && activeToolUse) {
        let input = {};
        if (activeToolUse.input) {
          try {
            input = JSON.parse(activeToolUse.input);
          } catch {}
        }
        toolUses.push({
          id: activeToolUse.id,
          name: activeToolUse.name,
          input,
        });
        activeToolUse = null;
      }
    };

    response.data.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;

        const data = trimmed.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          handleEvent(parsed);
        } catch (parseErr) {
          console.warn('Anthropic stream parse error:', parseErr.message, 'data:', data.slice(0, 200));
        }
      }
    });

    response.data.on('end', () => {
      if (buffer.trim()) {
        const trimmed = buffer.trim();
        if (trimmed.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(trimmed.slice(6));
            handleEvent(parsed);
          } catch (parseErr) {
            console.warn('Anthropic stream final parse error:', parseErr.message);
          }
        }
      }
      if (returnMeta) {
        resolve({ content: fullResponse, stopReason, toolUses });
        return;
      }
      resolve(fullResponse);
    });

    response.data.on('error', reject);
  });
}

async function vllmChatCompletion(messages, { temperature, maxTokens }) {
  const payload = {
    model: getVllmModelPrimary(),
    messages: [{ role: 'system', content: getSystemPrompt() }, ...messages],
    temperature,
    max_tokens: maxTokens,
    stream: false,
  };

  try {
    const response = await getVllmPrimaryClient().post('/v1/chat/completions', payload);
    return {
      content: response.data.choices[0]?.message?.content || '',
      usage: response.data.usage,
      model: response.data.model,
      provider: 'vllm-primary',
    };
  } catch (error) {
    console.warn('Primary vLLM failed, trying secondary:', error.message);
    payload.model = getVllmModelSecondary();
    const response = await getVllmSecondaryClient().post('/v1/chat/completions', payload);
    return {
      content: response.data.choices[0]?.message?.content || '',
      usage: response.data.usage,
      model: response.data.model,
      provider: 'vllm-secondary',
    };
  }
}

async function vllmChatCompletionStream(messages, onChunk, { temperature, maxTokens }) {
  const payload = {
    model: getVllmModelPrimary(),
    messages: [{ role: 'system', content: getSystemPrompt() }, ...messages],
    temperature,
    max_tokens: maxTokens,
    stream: true,
  };

  async function streamFromClient(client, modelId) {
    payload.model = modelId;
    const response = await client.post('/v1/chat/completions', payload, {
      responseType: 'stream',
    });

    let fullResponse = '';

    return new Promise((resolve, reject) => {
      let buf = '';

      response.data.on('data', (chunk) => {
        buf += chunk.toString();
        const lines = buf.split('\n');
        buf = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullResponse += delta;
              onChunk(delta);
            }
          } catch {}
        }
      });

      response.data.on('end', () => resolve(fullResponse));
      response.data.on('error', reject);
    });
  }

  try {
    return await streamFromClient(getVllmPrimaryClient(), getVllmModelPrimary());
  } catch (error) {
    console.warn('Primary vLLM stream failed, trying secondary:', error.message);
    return await streamFromClient(getVllmSecondaryClient(), getVllmModelSecondary());
  }
}

export async function healthCheck() {
  const results = {};

  if (getAnthropicKey()) {
    try {
      await getAnthropicClient().post('/messages', {
        model: getAnthropicModel(),
        max_tokens: 10,
        messages: [{ role: 'user', content: 'hi' }],
      });
      results.primary = { connected: true, model: getAnthropicModel(), provider: 'anthropic' };
    } catch (error) {
      results.primary = { connected: false, provider: 'anthropic', error: error.message };
    }
  } else {
    results.primary = { connected: false, provider: 'anthropic', error: 'No API key' };
  }

  try {
    const r = await getVllmPrimaryClient().get('/v1/models', { timeout: 5000 });
    results.fallback_primary = { connected: true, model: r.data?.data?.[0]?.id, provider: 'vllm' };
  } catch {
    results.fallback_primary = { connected: false, provider: 'vllm' };
  }

  try {
    const r = await getVllmSecondaryClient().get('/v1/models', { timeout: 5000 });
    results.fallback_secondary = { connected: true, model: r.data?.data?.[0]?.id, provider: 'vllm' };
  } catch {
    results.fallback_secondary = { connected: false, provider: 'vllm' };
  }

  return results;
}

export { getSystemPrompt };

export default {
  chatCompletion,
  chatCompletionStream,
  healthCheck,
  getSystemPrompt,
};
