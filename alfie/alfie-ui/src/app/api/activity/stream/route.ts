import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ActivityEventType =
  | 'tool'
  | 'api'
  | 'file'
  | 'search'
  | 'model'
  | 'memory'
  | 'websocket'
  | 'thinking'
  | 'background';

type ActivityStatus = 'running' | 'success' | 'error';

interface ActivityStreamEvent {
  id: string;
  type: ActivityEventType;
  timestamp: string;
  status: ActivityStatus;
  title: string;
  description?: string;
  duration?: number;
  details?: Record<string, unknown>;
}

type StreamClient = {
  controller: ReadableStreamDefaultController<Uint8Array>;
  id: string;
};

const clients = new Map<string, StreamClient>();

function sendToAllClients(event: ActivityStreamEvent) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  const encoder = new TextEncoder();
  const encoded = encoder.encode(data);
  
  clients.forEach((client) => {
    try {
      client.controller.enqueue(encoded);
    } catch {
      clients.delete(client.id);
    }
  });
}

export function emitActivity(event: Omit<ActivityStreamEvent, 'id' | 'timestamp'>) {
  const fullEvent: ActivityStreamEvent = {
    ...event,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
  sendToAllClients(fullEvent);
  return fullEvent.id;
}

export async function GET(_request: NextRequest) {
  const clientId = crypto.randomUUID();
  
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      clients.set(clientId, { controller, id: clientId });
      
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected', id: clientId })}\n\n`));
    },
    cancel() {
      clients.delete(clientId);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const eventId = emitActivity(body);
    return Response.json({ success: true, id: eventId });
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }
}
