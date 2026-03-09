import axios from 'axios';
import { getSystemPrompt } from './llmService.js';

const PROVIDERS = {
  anthropic: {
    models: ['claude-opus-4-6', 'claude-sonnet-4-5'],
    stream: true,
  },
  openai: {
    models: ['gpt-4o', 'gpt-4o-mini', 'o1-preview'],
    stream: true,
  },
  gemini: {
    models: ['gemini-2.5-pro', 'gemini-2.5-flash'],
    stream: true,
  },
  openrouter: {
    models: ['meta-llama/llama-3.1-405b-instruct', 'deepseek/deepseek-chat'],
    stream: true,
  },
  vllm: {
    models: ['gpt-oss-120b', 'gpt-oss-20b'],
    stream: true,
  },
};

const PROVIDER_LABELS = {
  anthropic: 'Claude',
  openai: 'OpenAI',
  gemini: 'Gemini',
  openrouter: 'OpenRouter',
  vllm: 'vLLM',
};

const MODEL_LABELS = {
  'claude-opus-4-6': 'Claude Opus 4.6',
  'claude-sonnet-4-5': 'Claude Sonnet 4.5',
  'gpt-4o': 'GPT-4o',
  'gpt-4o-mini': 'GPT-4o Mini',
  'o1-preview': 'OpenAI o1 Preview',
  'gemini-2.5-pro': 'Gemini 2.5 Pro',
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'meta-llama/llama-3.1-405b-instruct': 'Llama 3.1 405B Instruct',
  'deepseek/deepseek-chat': 'DeepSeek Chat',
  'gpt-oss-120b': 'GPT OSS 120B',
  'gpt-oss-20b': 'GPT OSS 20B',
};

function getAnthropicKey() {
  return process.env.ANTHROPIC_API_KEY || '';
}

function getOpenAiKey() {
  return process.env.OPENAI_API_KEY || '';
}

function getGeminiKey() {
  return process.env.GEMINI_API_KEY || '';
}

function getOpenRouterKey() {
  return process.env.OPENROUTER_API_KEY || '';
}

function getVllmPrimaryUrl() {
  return process.env.VLLM_PRIMARY_URL || 'http://localhost:8001';
}

function getVllmSecondaryUrl() {
  return process.env.VLLM_SECONDARY_URL || 'http://localhost:8002';
}

function getVllmModelSecondary() {
  return process.env.VLLM_MODEL_SECONDARY || 'gpt-oss-20b';
}

function getAnthropicClient() {
  return axios.create({
    baseURL: 'https://api.anthropic.com/v1',
    timeout: 180000,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': getAnthropicKey(),
      'anthropic-version': '2023-06-01',
    },
  });
}

function getOpenAiClient() {
  return axios.create({
    baseURL: 'https://api.openai.com/v1',
    timeout: 180000,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getOpenAiKey()}`,
    },
  });
}

function getOpenRouterClient() {
  return axios.create({
    baseURL: 'https://openrouter.ai/api/v1',
    timeout: 180000,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getOpenRouterKey()}`,
    },
  });
}

function getVllmClient(model) {
  if (model === getVllmModelSecondary()) {
    return axios.create({
      baseURL: getVllmSecondaryUrl(),
      timeout: 120000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return axios.create({
    baseURL: getVllmPrimaryUrl(),
    timeout: 120000,
    headers: { 'Content-Type': 'application/json' },
  });
}

function normalizeMessages(messages) {
  return messages.filter((message) =>
    message.role === 'user' || message.role === 'assistant' || message.role === 'system'
  );
}

function withSystemPrompt(messages) {
  const filtered = normalizeMessages(messages).filter((message) => message.role !== 'system');
  return [{ role: 'system', content: getSystemPrompt() }, ...filtered];
}

function convertToAnthropicMessages(messages) {
  return normalizeMessages(messages)
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => ({ role: message.role, content: message.content }));
}

function convertToGeminiMessages(messages) {
  return withSystemPrompt(messages)
    .filter((message) => message.role === 'user' || message.role === 'assistant' || message.role === 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }],
    }));
}

function getProviderForModel(model) {
  return Object.entries(PROVIDERS).find(([, provider]) =>
    provider.models.includes(model)
  )?.[0];
}

function isProviderAvailable(providerId) {
  switch (providerId) {
    case 'anthropic':
      return !!getAnthropicKey();
    case 'openai':
      return !!getOpenAiKey();
    case 'gemini':
      return !!getGeminiKey();
    case 'openrouter':
      return !!getOpenRouterKey();
    case 'vllm':
      return true;
    default:
      return false;
  }
}

function getModelLabel(model) {
  if (MODEL_LABELS[model]) return MODEL_LABELS[model];
  const lastSegment = model.split('/').pop() || model;
  return lastSegment.replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function listModels() {
  return Object.entries(PROVIDERS).flatMap(([providerId, provider]) => {
    const available = isProviderAvailable(providerId);
    return provider.models.map((model) => ({
      id: model,
      name: getModelLabel(model),
      provider: providerId,
      providerName: PROVIDER_LABELS[providerId] || providerId,
      available,
      status: available ? 'available' : 'unavailable',
    }));
  });
}

export async function chatCompletion(model, messages, options = {}) {
  const providerId = getProviderForModel(model);
  if (!providerId) throw new Error(`Unknown model: ${model}`);

  const { temperature = 0.7, maxTokens = 4096 } = options;

  if (providerId === 'anthropic') {
    const response = await getAnthropicClient().post('/messages', {
      model,
      max_tokens: maxTokens,
      temperature,
      system: getSystemPrompt(),
      messages: convertToAnthropicMessages(messages),
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
  }

  if (providerId === 'openai') {
    const response = await getOpenAiClient().post('/chat/completions', {
      model,
      messages: withSystemPrompt(messages),
      temperature,
      max_tokens: maxTokens,
    });

    return {
      content: response.data.choices?.[0]?.message?.content || '',
      model: response.data.model,
      usage: response.data.usage,
      provider: 'openai',
    };
  }

  if (providerId === 'openrouter') {
    const response = await getOpenRouterClient().post('/chat/completions', {
      model,
      messages: withSystemPrompt(messages),
      temperature,
      max_tokens: maxTokens,
    });

    return {
      content: response.data.choices?.[0]?.message?.content || '',
      model: response.data.model,
      usage: response.data.usage,
      provider: 'openrouter',
    };
  }

  if (providerId === 'gemini') {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${getGeminiKey()}`,
      {
        contents: convertToGeminiMessages(messages),
      },
      {
        timeout: 180000,
      }
    );

    return {
      content: response.data.candidates?.[0]?.content?.parts?.[0]?.text || '',
      model,
      provider: 'gemini',
    };
  }

  if (providerId === 'vllm') {
    const response = await getVllmClient(model).post('/v1/chat/completions', {
      model,
      messages: withSystemPrompt(messages),
      temperature,
      max_tokens: maxTokens,
    });

    return {
      content: response.data.choices?.[0]?.message?.content || '',
      usage: response.data.usage,
      model: response.data.model,
      provider: 'vllm',
    };
  }

  throw new Error(`Unsupported provider for model: ${model}`);
}

async function streamOpenAiCompatible({ client, path, payload, onChunk }) {
  const response = await client.post(path, payload, { responseType: 'stream' });
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

    response.data.on('end', () => {
      if (buffer.trim()) {
        const trimmed = buffer.trim();
        if (trimmed.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(trimmed.slice(6));
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullResponse += delta;
              onChunk(delta);
            }
          } catch {}
        }
      }
      resolve(fullResponse);
    });

    response.data.on('error', reject);
  });
}

async function streamGemini(model, messages, onChunk) {
  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${getGeminiKey()}`,
    {
      contents: convertToGeminiMessages(messages),
    },
    {
      responseType: 'stream',
      timeout: 180000,
    }
  );

  let fullResponse = '';

  return new Promise((resolve, reject) => {
    let buffer = '';

    response.data.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const data = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed;
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            fullResponse += text;
            onChunk(text);
          }
        } catch {}
      }
    });

    response.data.on('end', () => {
      if (buffer.trim()) {
        const trimmed = buffer.trim();
        const data = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed;
        try {
          const parsed = JSON.parse(data);
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            fullResponse += text;
            onChunk(text);
          }
        } catch {}
      }
      resolve(fullResponse);
    });

    response.data.on('error', reject);
  });
}

export async function chatCompletionStream(model, messages, onChunk, options = {}) {
  const providerId = getProviderForModel(model);
  if (!providerId) throw new Error(`Unknown model: ${model}`);

  const { temperature = 0.7, maxTokens = 4096 } = options;

  if (providerId === 'anthropic') {
    const response = await getAnthropicClient().post('/messages', {
      model,
      max_tokens: maxTokens,
      temperature,
      system: getSystemPrompt(),
      messages: convertToAnthropicMessages(messages),
      stream: true,
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
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              fullResponse += parsed.delta.text;
              onChunk(parsed.delta.text);
            }
          } catch {}
        }
      });

      response.data.on('end', () => {
        if (buffer.trim()) {
          const trimmed = buffer.trim();
          if (trimmed.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(trimmed.slice(6));
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                fullResponse += parsed.delta.text;
                onChunk(parsed.delta.text);
              }
            } catch {}
          }
        }
        resolve(fullResponse);
      });

      response.data.on('error', reject);
    });
  }

  if (providerId === 'openai') {
    return streamOpenAiCompatible({
      client: getOpenAiClient(),
      path: '/chat/completions',
      payload: {
        model,
        messages: withSystemPrompt(messages),
        temperature,
        max_tokens: maxTokens,
        stream: true,
      },
      onChunk,
    });
  }

  if (providerId === 'openrouter') {
    return streamOpenAiCompatible({
      client: getOpenRouterClient(),
      path: '/chat/completions',
      payload: {
        model,
        messages: withSystemPrompt(messages),
        temperature,
        max_tokens: maxTokens,
        stream: true,
      },
      onChunk,
    });
  }

  if (providerId === 'gemini') {
    return streamGemini(model, messages, onChunk);
  }

  if (providerId === 'vllm') {
    return streamOpenAiCompatible({
      client: getVllmClient(model),
      path: '/v1/chat/completions',
      payload: {
        model,
        messages: withSystemPrompt(messages),
        temperature,
        max_tokens: maxTokens,
        stream: true,
      },
      onChunk,
    });
  }

  throw new Error(`Unsupported provider for model: ${model}`);
}

export async function healthCheck(model) {
  const providerId = getProviderForModel(model);
  if (!providerId) {
    return { ok: false, model, error: 'Unknown model', provider: null };
  }

  const startTime = Date.now();

  try {
    await chatCompletion(model, [{ role: 'user', content: 'ping' }], { maxTokens: 1, temperature: 0.1 });
    return {
      ok: true,
      model,
      provider: providerId,
      latency: Date.now() - startTime,
    };
  } catch (error) {
    return {
      ok: false,
      model,
      provider: providerId,
      latency: Date.now() - startTime,
      error: error.message,
    };
  }
}

export default {
  listModels,
  chatCompletion,
  chatCompletionStream,
  healthCheck,
};
