import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";

interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
}

interface MCPServer {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  tools: MCPTool[];
  process?: ChildProcess;
  ready: boolean;
}

interface MCPMessage {
  jsonrpc: "2.0";
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string };
}

class MCPClient extends EventEmitter {
  private servers: Map<string, MCPServer> = new Map();
  private messageId = 0;
  private pendingRequests: Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  > = new Map();

  async connectServer(
    name: string,
    command: string,
    args?: string[],
    env?: Record<string, string>
  ): Promise<MCPTool[]> {
    if (this.servers.has(name)) {
      const existing = this.servers.get(name)!;
      if (existing.ready) return existing.tools;
    }

    const server: MCPServer = {
      name,
      command,
      args,
      env,
      tools: [],
      ready: false,
    };

    const proc = spawn(command, args || [], {
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    server.process = proc;

    let buffer = "";
    proc.stdout?.on("data", (data: Buffer) => {
      buffer += data.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line) as MCPMessage;
          this.handleMessage(name, msg);
        } catch {
          console.warn(`[MCP] Failed to parse message from ${name}:`, line);
        }
      }
    });

    proc.stderr?.on("data", (data: Buffer) => {
      console.error(`[MCP] ${name} stderr:`, data.toString());
    });

    proc.on("exit", code => {
      console.info(`[MCP] ${name} exited with code ${code}`);
      server.ready = false;
    });

    this.servers.set(name, server);

    await this.sendRequest(name, "initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "JARVIS", version: "1.0.0" },
    });

    const toolsResponse = (await this.sendRequest(name, "tools/list", {})) as {
      tools: MCPTool[];
    };
    server.tools = toolsResponse.tools || [];
    server.ready = true;

    console.info(
      `[MCP] Connected to ${name}: ${server.tools.length} tools available`
    );
    return server.tools;
  }

  private handleMessage(serverName: string, msg: MCPMessage): void {
    if (msg.id !== undefined && this.pendingRequests.has(msg.id)) {
      const { resolve, reject } = this.pendingRequests.get(msg.id)!;
      this.pendingRequests.delete(msg.id);

      if (msg.error) {
        reject(new Error(`${msg.error.code}: ${msg.error.message}`));
      } else {
        resolve(msg.result);
      }
    }
  }

  private async sendRequest(
    serverName: string,
    method: string,
    params: unknown
  ): Promise<unknown> {
    const server = this.servers.get(serverName);
    if (!server?.process?.stdin) {
      throw new Error(`Server ${serverName} not connected`);
    }

    const id = ++this.messageId;
    const msg: MCPMessage = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request to ${serverName} timed out`));
      }, 30000);

      this.pendingRequests.set(id, {
        resolve: value => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: err => {
          clearTimeout(timeout);
          reject(err);
        },
      });

      server.process!.stdin!.write(JSON.stringify(msg) + "\n");
    });
  }

  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<string> {
    const server = this.servers.get(serverName);
    if (!server?.ready) {
      throw new Error(`Server ${serverName} not ready`);
    }

    const result = (await this.sendRequest(serverName, "tools/call", {
      name: toolName,
      arguments: args,
    })) as { content: Array<{ type: string; text?: string }> };

    const textContent = result.content
      .filter(c => c.type === "text")
      .map(c => c.text)
      .join("\n");

    return textContent || JSON.stringify(result);
  }

  getAvailableTools(): Array<{
    server: string;
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }> {
    const tools: Array<{
      server: string;
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    }> = [];

    for (const [serverName, server] of Array.from(this.servers.entries())) {
      if (!server.ready) continue;

      for (const tool of server.tools) {
        tools.push({
          server: serverName,
          name: tool.name,
          description: tool.description,
          parameters: Object.fromEntries(
            Object.entries(tool.inputSchema.properties || {}).map(
              ([key, val]) => [
                key,
                {
                  type: (val as { type: string }).type,
                  description: (val as { description?: string }).description,
                  required: tool.inputSchema.required?.includes(key),
                },
              ]
            )
          ),
        });
      }
    }

    return tools;
  }

  async disconnectServer(name: string): Promise<void> {
    const server = this.servers.get(name);
    if (server?.process) {
      server.process.kill();
      this.servers.delete(name);
    }
  }

  async disconnectAll(): Promise<void> {
    for (const name of Array.from(this.servers.keys())) {
      await this.disconnectServer(name);
    }
  }

  listServers(): Array<{ name: string; ready: boolean; toolCount: number }> {
    return Array.from(this.servers.entries()).map(([name, server]) => ({
      name,
      ready: server.ready,
      toolCount: server.tools.length,
    }));
  }
}

let mcpClientInstance: MCPClient | null = null;

export function getMCPClient(): MCPClient {
  if (!mcpClientInstance) {
    mcpClientInstance = new MCPClient();
  }
  return mcpClientInstance;
}

export async function connectMCPServer(
  name: string,
  command: string,
  args?: string[],
  env?: Record<string, string>
): Promise<string> {
  try {
    const client = getMCPClient();
    const tools = await client.connectServer(name, command, args, env);
    return `Connected to MCP server "${name}" with ${tools.length} tools:\n${tools.map(t => `  - ${t.name}: ${t.description}`).join("\n")}`;
  } catch (error) {
    return `Failed to connect to MCP server: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function callMCPTool(
  serverName: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<string> {
  try {
    const client = getMCPClient();
    return await client.callTool(serverName, toolName, args);
  } catch (error) {
    return `MCP tool call failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export function listMCPTools(): string {
  const client = getMCPClient();
  const tools = client.getAvailableTools();

  if (tools.length === 0) {
    return "No MCP tools available. Use connect_mcp_server to add servers.";
  }

  const byServer = tools.reduce(
    (acc, tool) => {
      if (!acc[tool.server]) acc[tool.server] = [];
      acc[tool.server].push(tool);
      return acc;
    },
    {} as Record<string, typeof tools>
  );

  return Object.entries(byServer)
    .map(
      ([server, serverTools]) =>
        `${server} (${serverTools.length} tools):\n${serverTools.map(t => `  - ${t.name}: ${t.description}`).join("\n")}`
    )
    .join("\n\n");
}

export function listMCPServers(): string {
  const client = getMCPClient();
  const servers = client.listServers();

  if (servers.length === 0) {
    return "No MCP servers connected.";
  }

  return servers
    .map(
      s =>
        `- ${s.name}: ${s.ready ? "ready" : "not ready"} (${s.toolCount} tools)`
    )
    .join("\n");
}
