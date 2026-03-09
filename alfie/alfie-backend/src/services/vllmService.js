import axios from 'axios';

const VLLM_PRIMARY_URL = process.env.VLLM_PRIMARY_URL || 'http://localhost:8001';
const VLLM_SECONDARY_URL = process.env.VLLM_SECONDARY_URL || 'http://localhost:8002';
const VLLM_MODEL_PRIMARY = process.env.VLLM_MODEL_PRIMARY || 'gpt-oss-120b';
const VLLM_MODEL_SECONDARY = process.env.VLLM_MODEL_SECONDARY || 'gpt-oss-20b';

const SYSTEM_PROMPT = `You are ALFIE (Advanced Learning Framework for Intelligent Execution), a highly capable AI assistant. You are helpful, precise, and knowledgeable. You can assist with coding, analysis, writing, research, and general questions. Be concise but thorough. Use markdown formatting when appropriate.`;

const primaryClient = axios.create({
  baseURL: VLLM_PRIMARY_URL,
  timeout: 120000,
  headers: { 'Content-Type': 'application/json' },
});

const secondaryClient = axios.create({
  baseURL: VLLM_SECONDARY_URL,
  timeout: 120000,
  headers: { 'Content-Type': 'application/json' },
});

export async function chatCompletion(messages, options = {}) {
  const {
    model = VLLM_MODEL_PRIMARY,
    temperature = 0.7,
    maxTokens = 4096,
    usePrimary = true,
  } = options;

  const client = usePrimary ? primaryClient : secondaryClient;
  const modelId = usePrimary ? VLLM_MODEL_PRIMARY : VLLM_MODEL_SECONDARY;

  const payload = {
    model: model || modelId,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages,
    ],
    temperature,
    max_tokens: maxTokens,
    stream: false,
  };

  try {
    const response = await client.post('/v1/chat/completions', payload);
    return {
      content: response.data.choices[0]?.message?.content || '',
      usage: response.data.usage,
      model: response.data.model,
    };
  } catch (error) {
    if (usePrimary) {
      console.warn('Primary vLLM failed, trying secondary:', error.message);
      return chatCompletion(messages, { ...options, usePrimary: false });
    }
    throw error;
  }
}

export async function chatCompletionStream(messages, onChunk, options = {}) {
  const {
    model,
    temperature = 0.7,
    maxTokens = 4096,
    usePrimary = true,
  } = options;

  const client = usePrimary ? primaryClient : secondaryClient;
  const modelId = usePrimary ? VLLM_MODEL_PRIMARY : VLLM_MODEL_SECONDARY;

  const payload = {
    model: model || modelId,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages,
    ],
    temperature,
    max_tokens: maxTokens,
    stream: true,
  };

  try {
    const response = await client.post('/v1/chat/completions', payload, {
      responseType: 'stream',
    });

    let fullResponse = '';

    return new Promise((resolve, reject) => {
      let buffer = '';

      response.data.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const data = trimmed.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullResponse += delta;
              onChunk(delta);
            }
          } catch {
          }
        }
      });

      response.data.on('end', () => {
        if (buffer.trim()) {
          const trimmed = buffer.trim();
          if (trimmed.startsWith('data: ') && trimmed.slice(6) !== '[DONE]') {
            try {
              const parsed = JSON.parse(trimmed.slice(6));
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                fullResponse += delta;
                onChunk(delta);
              }
            } catch {
            }
          }
        }
        resolve(fullResponse);
      });

      response.data.on('error', (err) => {
        if (usePrimary) {
          console.warn('Primary vLLM stream failed, trying secondary:', err.message);
          chatCompletionStream(messages, onChunk, { ...options, usePrimary: false })
            .then(resolve)
            .catch(reject);
        } else {
          reject(err);
        }
      });
    });
  } catch (error) {
    if (usePrimary) {
      console.warn('Primary vLLM stream failed, trying secondary:', error.message);
      return chatCompletionStream(messages, onChunk, { ...options, usePrimary: false });
    }
    throw error;
  }
}

export async function healthCheck() {
  const results = {};
  
  try {
    const r = await primaryClient.get('/v1/models', { timeout: 5000 });
    results.primary = { connected: true, model: r.data?.data?.[0]?.id };
  } catch {
    results.primary = { connected: false };
  }

  try {
    const r = await secondaryClient.get('/v1/models', { timeout: 5000 });
    results.secondary = { connected: true, model: r.data?.data?.[0]?.id };
  } catch {
    results.secondary = { connected: false };
  }

  return results;
}

export default {
  chatCompletion,
  chatCompletionStream,
  healthCheck,
  SYSTEM_PROMPT,
};
