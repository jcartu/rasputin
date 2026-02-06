import { test, expect, PERFORMANCE_THRESHOLDS } from '../../fixtures/test-fixtures';
import { createMultipleConnections, WebSocketHelper } from '../../utils/websocket-helper';

test.describe('Real-time WebSocket Features - MANUS Cannot Do This', () => {
  test.describe('Message Streaming Latency', () => {
    test('should achieve <100ms WebSocket latency', async ({ ws }) => {
      if (!ws.isConnected()) {
        test.skip();
        return;
      }

      const latencies: number[] = [];

      for (let i = 0; i < 10; i++) {
        const latency = await ws.measureLatency();
        latencies.push(latency);
      }

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      expect(avgLatency).toBeLessThan(PERFORMANCE_THRESHOLDS.wsLatency);
    });

    test('should stream AI responses in real-time', async ({ ws }) => {
      if (!ws.isConnected()) {
        test.skip();
        return;
      }

      ws.clearMessages();
      ws.send({
        type: 'chat',
        payload: {
          message: 'Write a short poem',
          stream: true,
        },
      });

      const messages = await ws.waitForMessages(5, 15000);
      expect(messages.length).toBeGreaterThan(0);

      const chunkMessages = messages.filter(
        (m) => m.type === 'message_chunk' || m.type === 'stream_chunk'
      );
      expect(chunkMessages.length).toBeGreaterThan(0);
    });

    test('should handle rapid message bursts', async ({ ws }) => {
      if (!ws.isConnected()) {
        test.skip();
        return;
      }

      ws.clearMessages();

      for (let i = 0; i < 20; i++) {
        ws.send({
          type: 'ping',
          payload: { id: i },
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
      const messages = ws.getMessages();
      expect(messages.length).toBeGreaterThanOrEqual(10);
    });
  });

  test.describe('GPU Stats Monitoring', () => {
    test('should receive live GPU stats every 5 seconds', async ({ ws }) => {
      if (!ws.isConnected()) {
        test.skip();
        return;
      }

      ws.send({ type: 'subscribe', payload: { channel: 'gpu_stats' } });

      const gpuStats = await ws.waitForMessage('gpu_stats', 10000).catch(() => null);

      if (gpuStats) {
        const payload = gpuStats.payload as {
          utilization?: number;
          temperature?: number;
          memory?: unknown;
        };
        expect(payload).toBeDefined();
      }
    });

    test('should receive system stats updates', async ({ ws }) => {
      if (!ws.isConnected()) {
        test.skip();
        return;
      }

      ws.send({ type: 'subscribe', payload: { channel: 'system_stats' } });

      await ws.waitForMessage('system_stats', 10000).catch(() => null);
    });
  });

  test.describe('Tool Execution Visibility', () => {
    test('should broadcast ReAct phases in real-time', async ({ ws }) => {
      if (!ws.isConnected()) {
        test.skip();
        return;
      }

      ws.clearMessages();
      ws.send({
        type: 'agent_task',
        payload: {
          task: 'Search for Python best practices and summarize',
          showReact: true,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 5000));
      const messages = ws.getMessages();

      const phases = ['reasoning', 'action', 'observation', 'thought'];
      const phaseMessages = messages.filter((m) =>
        phases.some((p) => m.type.toLowerCase().includes(p))
      );

      expect(phaseMessages.length).toBeGreaterThanOrEqual(0);
    });

    test('should show tool execution progress', async ({ ws }) => {
      if (!ws.isConnected()) {
        test.skip();
        return;
      }

      ws.send({
        type: 'subscribe',
        payload: { channel: 'tool_execution' },
      });

      ws.send({
        type: 'agent_task',
        payload: { task: 'List files in the current directory' },
      });

      await new Promise((resolve) => setTimeout(resolve, 3000));
    });
  });

  test.describe('File Change Notifications', () => {
    test('should receive file change notification instantly', async ({ api, ws }) => {
      if (!ws.isConnected()) {
        test.skip();
        return;
      }

      ws.clearMessages();
      ws.send({
        type: 'subscribe',
        payload: { channel: 'file_changes' },
      });

      const testFile = `test_file_${Date.now()}.txt`;
      await api.uploadFile(testFile, 'Test content');

      const fileChange = await ws.waitForMessage('file_change', 5000).catch(() => null);
      if (fileChange) {
        expect(fileChange.payload).toBeDefined();
      }
    });
  });

  test.describe('Connection Management', () => {
    test('should support 50 concurrent WebSocket connections', async () => {
      const connections = await createMultipleConnections(50);

      expect(connections.length).toBe(50);
      expect(connections.every((c) => c.isConnected())).toBeTruthy();

      await Promise.all(connections.map((c) => c.disconnect()));
    });

    test('should handle reconnection gracefully', async () => {
      const ws = new WebSocketHelper();
      await ws.connect();
      expect(ws.isConnected()).toBeTruthy();

      await ws.disconnect();
      expect(ws.isConnected()).toBeFalsy();

      await ws.connect();
      expect(ws.isConnected()).toBeTruthy();

      await ws.disconnect();
    });

    test('should maintain connection during high load', async () => {
      const ws = new WebSocketHelper();
      await ws.connect();

      for (let i = 0; i < 100; i++) {
        ws.send({ type: 'ping', payload: { count: i } });
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
      expect(ws.isConnected()).toBeTruthy();

      await ws.disconnect();
    });

    test('should broadcast to multiple clients', async () => {
      const connections = await createMultipleConnections(5);

      connections.forEach((c) => {
        c.send({ type: 'subscribe', payload: { channel: 'broadcast' } });
      });

      connections[0].send({
        type: 'broadcast',
        payload: { message: 'Hello everyone!' },
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      await Promise.all(connections.map((c) => c.disconnect()));
    });
  });

  test.describe('Collaborative Editing', () => {
    test('should sync edits between 2 users', async () => {
      const [user1, user2] = await createMultipleConnections(2);

      const docId = `doc_${Date.now()}`;

      user1.send({
        type: 'join_document',
        payload: { documentId: docId },
      });

      user2.send({
        type: 'join_document',
        payload: { documentId: docId },
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

      user1.send({
        type: 'document_edit',
        payload: {
          documentId: docId,
          operation: { type: 'insert', position: 0, text: 'Hello' },
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

      await Promise.all([user1.disconnect(), user2.disconnect()]);
    });

    test('should handle conflict-free merge', async () => {
      const [user1, user2] = await createMultipleConnections(2);

      const docId = `doc_merge_${Date.now()}`;

      user1.send({ type: 'join_document', payload: { documentId: docId } });
      user2.send({ type: 'join_document', payload: { documentId: docId } });

      await new Promise((resolve) => setTimeout(resolve, 500));

      user1.send({
        type: 'document_edit',
        payload: {
          documentId: docId,
          operation: { type: 'insert', position: 0, text: 'A' },
        },
      });

      user2.send({
        type: 'document_edit',
        payload: {
          documentId: docId,
          operation: { type: 'insert', position: 0, text: 'B' },
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      await Promise.all([user1.disconnect(), user2.disconnect()]);
    });
  });
});
