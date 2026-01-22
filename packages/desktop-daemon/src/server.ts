import { ToolRegistry } from "./tool/registry";
import {
  validateToken,
  validatePairingCode,
  completePairing,
  generatePairingCode,
  getPairingStatus,
  isPaired,
  unpair,
} from "./auth";
import { z } from "zod";
import { Tool } from "./tool/tool";

const PORT = parseInt(process.env.DAEMON_PORT || "21337");

interface WebSocketData {
  authenticated: boolean;
}

const MessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("tool_call"),
    id: z.string(),
    tool: z.string(),
    args: z.record(z.unknown()),
  }),
  z.object({
    type: z.literal("list_tools"),
    id: z.string(),
  }),
  z.object({
    type: z.literal("ping"),
    id: z.string(),
  }),
]);

type _Message = z.infer<typeof MessageSchema>;

export function startServer() {
  ToolRegistry.init();

  const server = Bun.serve<WebSocketData>({
    port: PORT,

    fetch(req, server) {
      const url = new URL(req.url);

      if (url.pathname === "/health") {
        return Response.json({
          status: "ok",
          version: "0.1.0",
          ...getPairingStatus(),
          tools: ToolRegistry.ids(),
        });
      }

      if (url.pathname === "/pair" && req.method === "POST") {
        return handlePairing(req);
      }

      if (url.pathname === "/pair/init" && req.method === "POST") {
        const code = generatePairingCode();
        return Response.json({ code, expiresIn: 300 });
      }

      if (url.pathname === "/unpair" && req.method === "POST") {
        unpair();
        return Response.json({ success: true });
      }

      if (req.headers.get("upgrade") === "websocket") {
        const token = url.searchParams.get("token");
        if (!isPaired() || !validateToken(token)) {
          return new Response("Unauthorized", { status: 401 });
        }
        server.upgrade(req, { data: { authenticated: true } });
        return;
      }

      return new Response("Rasputin Desktop Daemon", { status: 200 });
    },

    websocket: {
      open(_ws) {
        console.info("[WS] Client connected");
      },

      close(_ws) {
        console.info("[WS] Client disconnected");
      },

      async message(ws, message) {
        try {
          const raw =
            typeof message === "string" ? message : message.toString();
          const parsed = MessageSchema.safeParse(JSON.parse(raw));

          if (!parsed.success) {
            ws.send(
              JSON.stringify({
                id: "unknown",
                success: false,
                error: `Invalid message format: ${parsed.error.message}`,
              })
            );
            return;
          }

          const msg = parsed.data;

          if (msg.type === "ping") {
            ws.send(
              JSON.stringify({ id: msg.id, success: true, result: "pong" })
            );
            return;
          }

          if (msg.type === "list_tools") {
            ws.send(
              JSON.stringify({
                id: msg.id,
                success: true,
                result: ToolRegistry.all().map(t => ({
                  id: t.id,
                  description: t.description,
                })),
              })
            );
            return;
          }

          if (msg.type === "tool_call") {
            const ctx: Tool.Context = {
              abort: new AbortController().signal,
              sessionId: "daemon",
              callId: msg.id,
              metadata: data => {
                ws.send(
                  JSON.stringify({
                    id: msg.id,
                    type: "metadata",
                    data,
                  })
                );
              },
            };

            const result = await ToolRegistry.execute(msg.tool, msg.args, ctx);
            ws.send(
              JSON.stringify({
                id: msg.id,
                success: true,
                result,
              })
            );
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.error("[WS] Error:", errorMessage);
          ws.send(
            JSON.stringify({
              id: "unknown",
              success: false,
              error: errorMessage,
            })
          );
        }
      },
    },
  });

  console.info(`Desktop daemon running on http://localhost:${PORT}`);
  console.info(`Available tools: ${ToolRegistry.ids().join(", ")}`);

  return server;
}

async function handlePairing(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { code, userId, username, serverUrl, token } = body;

    if (!validatePairingCode(code)) {
      return Response.json(
        { success: false, error: "Invalid or expired pairing code" },
        { status: 400 }
      );
    }

    completePairing({ userId, username, serverUrl, token });
    return Response.json({ success: true });
  } catch (_error) {
    return Response.json(
      { success: false, error: "Invalid request" },
      { status: 400 }
    );
  }
}
