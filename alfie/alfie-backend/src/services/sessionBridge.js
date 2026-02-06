import net from 'net';
import { EventEmitter } from 'events';

export const OPENCLAW_HOST = process.env.OPENCLAW_SOCKET_HOST || 'localhost';
export const OPENCLAW_PORT = parseInt(process.env.OPENCLAW_SOCKET_PORT || '18789', 10);

export async function sendToOpenClaw(message) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    let response = '';
    let connected = false;

    const timeout = setTimeout(() => {
      client.destroy();
      reject(new Error('Connection timeout'));
    }, 30000);

    client.connect(OPENCLAW_PORT, OPENCLAW_HOST, () => {
      connected = true;
      const payload = JSON.stringify({ type: 'message', content: message }) + '\n';
      client.write(payload);
    });

    client.on('data', (data) => {
      response += data.toString();
    });

    client.on('end', () => {
      clearTimeout(timeout);
      try {
        const parsed = JSON.parse(response.trim());
        resolve({ success: true, response: parsed });
      } catch {
        resolve({ success: true, response: response.trim() });
      }
    });

    client.on('error', (err) => {
      clearTimeout(timeout);
      if (!connected) {
        reject(new Error(`Cannot connect to OpenClaw at ${OPENCLAW_HOST}:${OPENCLAW_PORT}`));
      } else {
        reject(err);
      }
    });

    client.on('close', () => {
      clearTimeout(timeout);
      if (!response) {
        resolve({ success: true, response: '' });
      }
    });
  });
}

export function streamToOpenClaw(message) {
  const emitter = new EventEmitter();
  const client = new net.Socket();
  let buffer = '';
  let connected = false;

  const timeout = setTimeout(() => {
    client.destroy();
    emitter.emit('error', new Error('Connection timeout'));
  }, 120000);

  client.connect(OPENCLAW_PORT, OPENCLAW_HOST, () => {
    connected = true;
    const payload = JSON.stringify({ 
      type: 'message', 
      content: message,
      stream: true 
    }) + '\n';
    client.write(payload);
    emitter.emit('connected');
  });

  client.on('data', (data) => {
    buffer += data.toString();
    
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      try {
        const chunk = JSON.parse(line);
        if (chunk.type === 'chunk' || chunk.type === 'delta') {
          emitter.emit('chunk', chunk.content || chunk.text || chunk.delta || '');
        } else if (chunk.type === 'end' || chunk.type === 'done') {
          emitter.emit('end', chunk.content || '');
        } else if (chunk.type === 'error') {
          emitter.emit('error', new Error(chunk.message || chunk.error || 'Unknown error'));
        } else if (chunk.content || chunk.text) {
          emitter.emit('chunk', chunk.content || chunk.text);
        }
      } catch {
        emitter.emit('chunk', line);
      }
    }
  });

  client.on('end', () => {
    clearTimeout(timeout);
    if (buffer.trim()) {
      try {
        const chunk = JSON.parse(buffer);
        if (chunk.content || chunk.text) {
          emitter.emit('chunk', chunk.content || chunk.text);
        }
      } catch {
        emitter.emit('chunk', buffer);
      }
    }
    emitter.emit('end', '');
  });

  client.on('error', (err) => {
    clearTimeout(timeout);
    if (!connected) {
      emitter.emit('error', new Error(`Cannot connect to OpenClaw at ${OPENCLAW_HOST}:${OPENCLAW_PORT}`));
    } else {
      emitter.emit('error', err);
    }
  });

  client.on('close', () => {
    clearTimeout(timeout);
  });

  emitter.close = () => {
    clearTimeout(timeout);
    client.destroy();
  };

  return emitter;
}

export async function checkConnection() {
  return new Promise((resolve) => {
    const client = new net.Socket();
    const timeout = setTimeout(() => {
      client.destroy();
      resolve({ connected: false, error: 'Connection timeout' });
    }, 5000);

    client.connect(OPENCLAW_PORT, OPENCLAW_HOST, () => {
      clearTimeout(timeout);
      client.destroy();
      resolve({ connected: true, host: OPENCLAW_HOST, port: OPENCLAW_PORT });
    });

    client.on('error', (err) => {
      clearTimeout(timeout);
      resolve({ connected: false, error: err.message });
    });
  });
}

export default { 
  sendToOpenClaw, 
  streamToOpenClaw,
  checkConnection,
  OPENCLAW_HOST,
  OPENCLAW_PORT
};
