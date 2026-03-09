import axios from 'axios';

const PERPLEXITY_BASE_URL = 'https://api.perplexity.ai';

function getApiKey() {
  return process.env.PERPLEXITY_API_KEY || '';
}

function getModel() {
  return process.env.PERPLEXITY_MODEL || 'sonar-pro';
}

function getClient() {
  return axios.create({
    baseURL: PERPLEXITY_BASE_URL,
    timeout: 60000,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getApiKey()}`,
    },
  });
}

export async function search(query, options = {}) {
  const { maxTokens = 2048, temperature = 0.2 } = options;

  if (!getApiKey()) {
    throw new Error('Perplexity API key not configured');
  }

  const response = await getClient().post('/chat/completions', {
    model: getModel(),
    messages: [
      {
        role: 'system',
        content: 'You are a precise research assistant. Provide comprehensive, factual answers with sources. Use markdown formatting. Be thorough but concise.',
      },
      { role: 'user', content: query },
    ],
    max_tokens: maxTokens,
    temperature,
    return_citations: true,
    search_recency_filter: 'month',
  });

  const result = response.data.choices[0]?.message?.content || '';
  const rawCitations = response.data.citations || [];

  const citations = rawCitations.map((c) => {
    if (typeof c === 'string') {
      let title = '';
      try {
        const u = new URL(c);
        const host = u.hostname.replace(/^www\./, '');
        const pathParts = u.pathname.split('/').filter(Boolean).slice(0, 2);
        title = host + (pathParts.length > 0 ? ' › ' + pathParts.join(' › ') : '');
      } catch {
        title = c;
      }
      return { url: c, title };
    }
    return { url: c.url || '', title: c.title || '', snippet: c.snippet || '' };
  });

  return {
    content: result,
    citations,
    model: getModel(),
    usage: response.data.usage,
  };
}

export async function searchStream(query, onChunk, options = {}) {
  const { maxTokens = 2048, temperature = 0.2 } = options;

  if (!getApiKey()) {
    throw new Error('Perplexity API key not configured');
  }

  const response = await getClient().post('/chat/completions', {
    model: getModel(),
    messages: [
      {
        role: 'system',
        content: 'You are a precise research assistant. Provide comprehensive, factual answers with sources. Use markdown formatting. Be thorough but concise.',
      },
      { role: 'user', content: query },
    ],
    max_tokens: maxTokens,
    temperature,
    stream: true,
    return_citations: true,
    search_recency_filter: 'month',
  }, { responseType: 'stream' });

  let fullResponse = '';

  return new Promise((resolve, reject) => {
    let buffer = '';

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

export async function healthCheck() {
  if (!getApiKey()) {
    return { connected: false, error: 'No API key' };
  }

  try {
    await getClient().post('/chat/completions', {
      model: getModel(),
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 5,
    });
    return { connected: true, model: getModel() };
  } catch (error) {
    return { connected: false, error: error.message };
  }
}

export default { search, searchStream, healthCheck };
