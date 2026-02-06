import WebSocket from 'ws';

export interface WebSocketMessage {
  type: string;
  payload?: unknown;
  timestamp?: string;
}

export class WebSocketHelper {
  private ws: WebSocket | null = null;
  private messages: WebSocketMessage[] = [];
  private connected = false;

  constructor(private url: string = 'ws://localhost:3001/ws') {}

  async connect(timeout = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, timeout);

      this.ws = new WebSocket(this.url);

      this.ws.on('open', () => {
        clearTimeout(timer);
        this.connected = true;
        resolve();
      });

      this.ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString()) as WebSocketMessage;
          message.timestamp = new Date().toISOString();
          this.messages.push(message);
        } catch {
          this.messages.push({ type: 'raw', payload: data.toString() });
        }
      });

      this.ws.on('error', (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      });

      this.ws.on('close', () => {
        this.connected = false;
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.ws && this.connected) {
      return new Promise((resolve) => {
        this.ws!.on('close', () => resolve());
        this.ws!.close();
      });
    }
  }

  send(message: WebSocketMessage): void {
    if (!this.ws || !this.connected) {
      throw new Error('WebSocket not connected');
    }
    this.ws.send(JSON.stringify(message));
  }

  async waitForMessage(type: string, timeout = 10000): Promise<WebSocketMessage> {
    const existing = this.messages.find((m) => m.type === type);
    if (existing) {
      return existing;
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for message type: ${type}`));
      }, timeout);

      const checkInterval = setInterval(() => {
        const msg = this.messages.find((m) => m.type === type);
        if (msg) {
          clearTimeout(timer);
          clearInterval(checkInterval);
          resolve(msg);
        }
      }, 100);
    });
  }

  async waitForMessages(count: number, timeout = 10000): Promise<WebSocketMessage[]> {
    if (this.messages.length >= count) {
      return this.messages.slice(0, count);
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for ${count} messages`));
      }, timeout);

      const checkInterval = setInterval(() => {
        if (this.messages.length >= count) {
          clearTimeout(timer);
          clearInterval(checkInterval);
          resolve(this.messages.slice(0, count));
        }
      }, 100);
    });
  }

  getMessages(): WebSocketMessage[] {
    return [...this.messages];
  }

  getMessagesByType(type: string): WebSocketMessage[] {
    return this.messages.filter((m) => m.type === type);
  }

  clearMessages(): void {
    this.messages = [];
  }

  isConnected(): boolean {
    return this.connected;
  }

  async measureLatency(): Promise<number> {
    const start = Date.now();
    this.send({ type: 'ping' });
    await this.waitForMessage('pong', 5000);
    return Date.now() - start;
  }
}

export async function createMultipleConnections(
  count: number,
  url = 'ws://localhost:3001/ws'
): Promise<WebSocketHelper[]> {
  const connections: WebSocketHelper[] = [];
  const connectPromises: Promise<void>[] = [];

  for (let i = 0; i < count; i++) {
    const helper = new WebSocketHelper(url);
    connections.push(helper);
    connectPromises.push(helper.connect());
  }

  await Promise.all(connectPromises);
  return connections;
}
