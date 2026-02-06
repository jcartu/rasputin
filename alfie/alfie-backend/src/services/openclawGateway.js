import axios from 'axios';
import config from '../config.js';

const gatewayClient = axios.create({
  baseURL: config.openclawGatewayUrl,
  timeout: 120000,
  headers: {
    'Content-Type': 'application/json',
    ...(config.openclawApiKey && { 'Authorization': `Bearer ${config.openclawApiKey}` }),
  },
});

export async function sendMessage(sessionId, message, options = {}) {
  const response = await gatewayClient.post('/api/sessions/message', {
    session_id: sessionId,
    message,
    ...options,
  });
  return response.data;
}

export async function createSession(projectPath, options = {}) {
  const response = await gatewayClient.post('/api/sessions', {
    project_path: projectPath,
    ...options,
  });
  return response.data;
}

export async function getSession(sessionId) {
  const response = await gatewayClient.get(`/api/sessions/${sessionId}`);
  return response.data;
}

export async function listSessions(options = {}) {
  const response = await gatewayClient.get('/api/sessions', { params: options });
  return response.data;
}

export async function deleteSession(sessionId) {
  const response = await gatewayClient.delete(`/api/sessions/${sessionId}`);
  return response.data;
}

export async function streamMessage(sessionId, message, onChunk) {
  const response = await gatewayClient.post(
    '/api/sessions/message/stream',
    {
      session_id: sessionId,
      message,
    },
    {
      responseType: 'stream',
    }
  );

  return new Promise((resolve, reject) => {
    let fullResponse = '';
    
    response.data.on('data', (chunk) => {
      const text = chunk.toString();
      fullResponse += text;
      if (onChunk) {
        onChunk(text);
      }
    });

    response.data.on('end', () => {
      resolve(fullResponse);
    });

    response.data.on('error', (err) => {
      reject(err);
    });
  });
}

export async function executeToolStream(sessionId, toolName, toolInput, onChunk) {
  const response = await gatewayClient.post(
    '/api/tools/execute/stream',
    {
      session_id: sessionId,
      tool_name: toolName,
      tool_input: toolInput,
    },
    {
      responseType: 'stream',
    }
  );

  return new Promise((resolve, reject) => {
    let fullResponse = '';
    
    response.data.on('data', (chunk) => {
      const text = chunk.toString();
      fullResponse += text;
      if (onChunk) {
        onChunk(text);
      }
    });

    response.data.on('end', () => {
      resolve(fullResponse);
    });

    response.data.on('error', (err) => {
      reject(err);
    });
  });
}

export async function getGatewayStatus() {
  try {
    const response = await gatewayClient.get('/api/health');
    return { connected: true, ...response.data };
  } catch (error) {
    return { connected: false, error: error.message };
  }
}

export default {
  sendMessage,
  createSession,
  getSession,
  listSessions,
  deleteSession,
  streamMessage,
  executeToolStream,
  getGatewayStatus,
};
