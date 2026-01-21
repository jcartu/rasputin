import { $ } from "bun";
import { getPairingStatus, generatePairingCode } from "./auth";
import { ToolRegistry } from "./tool/registry";
import {
  enableAutostart,
  disableAutostart,
  isAutostartEnabled,
} from "./autostart";

const TRAY_PORT = 21338;

interface TrayState {
  visible: boolean;
  menuOpen: boolean;
}

const _state: TrayState = {
  visible: true,
  menuOpen: false,
};

async function showNotification(title: string, message: string): Promise<void> {
  const platform = process.platform;

  if (platform === "darwin") {
    await $`osascript -e 'display notification "${message}" with title "${title}"'`.quiet();
  } else if (platform === "win32") {
    await $`powershell -command "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null; $template = [Windows.UI.Notifications.ToastTemplateType]::ToastText02; $xml = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent($template); $xml.GetElementsByTagName('text')[0].AppendChild($xml.CreateTextNode('${title}')); $xml.GetElementsByTagName('text')[1].AppendChild($xml.CreateTextNode('${message}')); $toast = [Windows.UI.Notifications.ToastNotification]::new($xml); [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Rasputin').Show($toast)"`.quiet();
  } else {
    await $`notify-send "${title}" "${message}"`.quiet();
  }
}

async function getStatusHtml(): Promise<string> {
  const status = getPairingStatus();
  const tools = ToolRegistry.ids();
  const autostart = await isAutostartEnabled();

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Rasputin Desktop Daemon</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a2e; 
      color: #eee;
      min-height: 100vh;
      padding: 20px;
    }
    .container { max-width: 400px; margin: 0 auto; }
    h1 { font-size: 24px; margin-bottom: 20px; color: #8b5cf6; }
    .status { 
      background: #16213e; 
      padding: 16px; 
      border-radius: 8px; 
      margin-bottom: 16px;
    }
    .status-row { 
      display: flex; 
      justify-content: space-between; 
      padding: 8px 0;
      border-bottom: 1px solid #2a2a4a;
    }
    .status-row:last-child { border-bottom: none; }
    .label { color: #888; }
    .value { font-weight: 600; }
    .connected { color: #22c55e; }
    .disconnected { color: #ef4444; }
    .tools { 
      background: #16213e; 
      padding: 16px; 
      border-radius: 8px;
      margin-bottom: 16px;
    }
    .tools h2 { font-size: 16px; margin-bottom: 12px; color: #8b5cf6; }
    .tool-list { display: flex; flex-wrap: wrap; gap: 8px; }
    .tool { 
      background: #2a2a4a; 
      padding: 4px 10px; 
      border-radius: 4px; 
      font-size: 12px;
      font-family: monospace;
    }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    button {
      background: #8b5cf6;
      color: white;
      border: none;
      padding: 10px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      flex: 1;
      min-width: 120px;
    }
    button:hover { background: #7c3aed; }
    button.secondary { background: #374151; }
    button.secondary:hover { background: #4b5563; }
    button.danger { background: #ef4444; }
    button.danger:hover { background: #dc2626; }
    .pairing-code {
      background: #2a2a4a;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      margin: 16px 0;
    }
    .pairing-code .code {
      font-size: 32px;
      font-family: monospace;
      letter-spacing: 4px;
      color: #8b5cf6;
    }
    .pairing-code .hint {
      font-size: 12px;
      color: #888;
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Rasputin Desktop</h1>
    
    <div class="status">
      <div class="status-row">
        <span class="label">Status</span>
        <span class="value ${status.paired ? "connected" : "disconnected"}">
          ${status.paired ? "Connected" : status.awaitingPairing ? "Awaiting Pairing" : "Not Paired"}
        </span>
      </div>
      ${
        status.paired
          ? `
      <div class="status-row">
        <span class="label">User</span>
        <span class="value">${status.user}</span>
      </div>
      <div class="status-row">
        <span class="label">Server</span>
        <span class="value">${status.server}</span>
      </div>
      `
          : ""
      }
    </div>

    ${
      status.awaitingPairing
        ? `
    <div class="pairing-code">
      <div class="code" id="pairing-code">Loading...</div>
      <div class="hint">Enter this code in RASPUTIN to complete pairing</div>
    </div>
    `
        : ""
    }

    <div class="tools">
      <h2>Available Tools (${tools.length})</h2>
      <div class="tool-list">
        ${tools.map(t => `<span class="tool">${t}</span>`).join("")}
      </div>
    </div>

    <div class="status" style="margin-top: 16px;">
      <div class="status-row">
        <span class="label">Start on Login</span>
        <label class="toggle">
          <input type="checkbox" id="autostart" ${autostart ? "checked" : ""} onchange="toggleAutostart()">
          <span class="slider"></span>
        </label>
      </div>
    </div>

    <div class="actions">
      ${
        !status.paired && !status.awaitingPairing
          ? `
        <button onclick="startPairing()">Start Pairing</button>
      `
          : ""
      }
      ${
        status.paired
          ? `
        <button class="danger" onclick="disconnect()">Disconnect</button>
      `
          : ""
      }
      <button class="secondary" onclick="location.reload()">Refresh</button>
    </div>
  </div>

  <style>
    .toggle { position: relative; display: inline-block; width: 48px; height: 24px; }
    .toggle input { opacity: 0; width: 0; height: 0; }
    .slider { 
      position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
      background: #374151; border-radius: 24px; transition: 0.3s;
    }
    .slider:before {
      position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px;
      background: white; border-radius: 50%; transition: 0.3s;
    }
    input:checked + .slider { background: #8b5cf6; }
    input:checked + .slider:before { transform: translateX(24px); }
  </style>

  <script>
    async function startPairing() {
      const res = await fetch('/api/pair/init', { method: 'POST' });
      const data = await res.json();
      location.reload();
    }
    
    async function disconnect() {
      await fetch('/api/unpair', { method: 'POST' });
      location.reload();
    }

    async function toggleAutostart() {
      const checkbox = document.getElementById('autostart');
      const enable = checkbox.checked;
      await fetch('/api/autostart', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enable })
      });
    }

    ${
      status.awaitingPairing
        ? `
    (async () => {
      const res = await fetch('/api/pair/code');
      const data = await res.json();
      document.getElementById('pairing-code').textContent = data.code || 'ERROR';
    })();
    `
        : ""
    }
  </script>
</body>
</html>
  `;
}

let pairingCodeCache: string | null = null;

export function startTrayServer() {
  const server = Bun.serve({
    port: TRAY_PORT,

    async fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === "/") {
        const html = await getStatusHtml();
        return new Response(html, {
          headers: { "Content-Type": "text/html" },
        });
      }

      if (url.pathname === "/api/pair/init" && req.method === "POST") {
        pairingCodeCache = generatePairingCode();
        return Response.json({ success: true });
      }

      if (url.pathname === "/api/pair/code") {
        return Response.json({ code: pairingCodeCache });
      }

      if (url.pathname === "/api/unpair" && req.method === "POST") {
        const { unpair } = require("./auth");
        unpair();
        return Response.json({ success: true });
      }

      if (url.pathname === "/api/autostart" && req.method === "POST") {
        const body = (await req.json()) as { enable: boolean };
        if (body.enable) {
          const result = await enableAutostart();
          return Response.json(result);
        } else {
          const result = await disableAutostart();
          return Response.json(result);
        }
      }

      if (url.pathname === "/api/status") {
        return Response.json({
          ...getPairingStatus(),
          tools: ToolRegistry.ids(),
          autostart: await isAutostartEnabled(),
        });
      }

      return new Response("Not Found", { status: 404 });
    },
  });

  console.log(`Tray UI available at http://localhost:${TRAY_PORT}`);

  openTrayUI();

  return server;
}

async function openTrayUI() {
  const platform = process.platform;
  const url = `http://localhost:${TRAY_PORT}`;

  try {
    if (platform === "darwin") {
      await $`open ${url}`.quiet();
    } else if (platform === "win32") {
      await $`start ${url}`.quiet();
    } else {
      await $`xdg-open ${url}`.quiet();
    }
  } catch {
    console.log(`Open ${url} in your browser to access the tray UI`);
  }
}

export async function notifyPaired(username: string) {
  await showNotification("Rasputin Connected", `Paired with ${username}`);
}

export async function notifyDisconnected() {
  await showNotification(
    "Rasputin Disconnected",
    "Desktop daemon disconnected from server"
  );
}
