import { randomBytes } from "crypto";

interface RemoteDaemonConnection {
  userId: number;
  url: string;
  token: string;
  ws: WebSocket | null;
  status: "connecting" | "connected" | "disconnected" | "error";
  lastSeen: number;
  tools: string[];
}

const connections = new Map<number, RemoteDaemonConnection>();
const pendingCalls = new Map<
  string,
  {
    resolve: (result: unknown) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }
>();

export async function initiatePairing(userId: number): Promise<{
  pairingUrl: string;
  code: string;
  expiresIn: number;
}> {
  const token = randomBytes(32).toString("hex");
  const code = randomBytes(4).toString("hex").toUpperCase();

  const expiresIn = 300;
  const expiresAt = Date.now() + expiresIn * 1000;

  pairingRequests.set(code, { userId, token, expiresAt });

  setTimeout(() => pairingRequests.delete(code), expiresIn * 1000);

  const serverUrl = process.env.PUBLIC_URL || `http://localhost:3000`;

  return {
    pairingUrl: `rasputin://pair?code=${code}&server=${encodeURIComponent(serverUrl)}`,
    code,
    expiresIn,
  };
}

const pairingRequests = new Map<
  string,
  { userId: number; token: string; expiresAt: number }
>();

export async function completePairing(
  code: string,
  daemonUrl: string
): Promise<{ success: boolean; error?: string }> {
  const request = pairingRequests.get(code);
  if (!request) {
    return { success: false, error: "Invalid or expired pairing code" };
  }

  if (Date.now() > request.expiresAt) {
    pairingRequests.delete(code);
    return { success: false, error: "Pairing code expired" };
  }

  try {
    const response = await fetch(`${daemonUrl}/pair`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        userId: request.userId,
        username: "user",
        serverUrl: process.env.PUBLIC_URL || "http://localhost:3000",
        token: request.token,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || "Pairing failed" };
    }

    pairingRequests.delete(code);

    await connectToDaemon(request.userId, daemonUrl, request.token);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Connection failed",
    };
  }
}

export async function connectToDaemon(
  userId: number,
  url: string,
  token: string
): Promise<void> {
  const existing = connections.get(userId);
  if (existing?.ws) {
    existing.ws.close();
  }

  const conn: RemoteDaemonConnection = {
    userId,
    url,
    token,
    ws: null,
    status: "connecting",
    lastSeen: Date.now(),
    tools: [],
  };

  connections.set(userId, conn);

  try {
    const wsUrl = `${url.replace(/^http/, "ws")}/ws?token=${token}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      conn.status = "connected";
      conn.lastSeen = Date.now();
      console.info(`[RemoteDaemon] Connected to daemon for user ${userId}`);

      ws.send(JSON.stringify({ type: "list_tools", id: "init" }));
    };

    ws.onmessage = event => {
      try {
        const msg = JSON.parse(event.data.toString());
        conn.lastSeen = Date.now();

        if (msg.id === "init" && msg.success && Array.isArray(msg.result)) {
          conn.tools = msg.result.map((t: { id: string }) => t.id);
          console.info(
            `[RemoteDaemon] User ${userId} has tools: ${conn.tools.join(", ")}`
          );
          return;
        }

        const pending = pendingCalls.get(msg.id);
        if (pending) {
          clearTimeout(pending.timeout);
          pendingCalls.delete(msg.id);

          if (msg.success) {
            pending.resolve(msg.result);
          } else {
            pending.reject(new Error(msg.error || "Tool call failed"));
          }
        }
      } catch (error) {
        console.error("[RemoteDaemon] Message parse error:", error);
      }
    };

    ws.onclose = () => {
      conn.status = "disconnected";
      conn.ws = null;
      console.info(
        `[RemoteDaemon] Disconnected from daemon for user ${userId}`
      );
    };

    ws.onerror = error => {
      conn.status = "error";
      console.error(
        `[RemoteDaemon] WebSocket error for user ${userId}:`,
        error
      );
    };

    conn.ws = ws;
  } catch (error) {
    conn.status = "error";
    console.error(
      `[RemoteDaemon] Failed to connect for user ${userId}:`,
      error
    );
  }
}

export async function callDesktopTool(
  userId: number,
  toolId: string,
  args: Record<string, unknown>,
  timeoutMs = 30000
): Promise<unknown> {
  const conn = connections.get(userId);
  if (!conn || conn.status !== "connected" || !conn.ws) {
    throw new Error("Desktop daemon not connected");
  }

  if (!conn.tools.includes(toolId)) {
    throw new Error(`Tool ${toolId} not available on desktop daemon`);
  }

  const callId = randomBytes(8).toString("hex");

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingCalls.delete(callId);
      reject(new Error(`Tool call timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    pendingCalls.set(callId, { resolve, reject, timeout });

    conn.ws!.send(
      JSON.stringify({
        type: "tool_call",
        id: callId,
        tool: toolId,
        args,
      })
    );
  });
}

export function getDesktopDaemonStatus(userId: number): {
  connected: boolean;
  status: string;
  tools: string[];
  lastSeen?: number;
} {
  const conn = connections.get(userId);
  if (!conn) {
    return { connected: false, status: "not_paired", tools: [] };
  }

  return {
    connected: conn.status === "connected",
    status: conn.status,
    tools: conn.tools,
    lastSeen: conn.lastSeen,
  };
}

export function listDesktopTools(userId: number): string[] {
  const conn = connections.get(userId);
  return conn?.tools || [];
}

export function disconnectDaemon(userId: number): void {
  const conn = connections.get(userId);
  if (conn?.ws) {
    conn.ws.close();
  }
  connections.delete(userId);
}
