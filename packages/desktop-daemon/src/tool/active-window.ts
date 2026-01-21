import { z } from "zod";
import { Tool } from "./tool";
import { $ } from "bun";

interface WindowInfo {
  title: string;
  app: string;
  pid?: number;
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

async function getActiveWindow(): Promise<WindowInfo> {
  const platform = process.platform;

  if (platform === "darwin") {
    const script = `
      tell application "System Events"
        set frontApp to first application process whose frontmost is true
        set appName to name of frontApp
        tell frontApp
          set winTitle to name of front window
        end tell
        set appPID to unix id of frontApp
      end tell
      return appName & "|" & winTitle & "|" & appPID
    `;
    const result = await $`osascript -e ${script}`.text();
    const [app, title, pid] = result.trim().split("|");

    const boundsScript = `
      tell application "System Events"
        tell (first application process whose frontmost is true)
          set {x, y} to position of front window
          set {w, h} to size of front window
        end tell
      end tell
      return (x as string) & "," & (y as string) & "," & (w as string) & "," & (h as string)
    `;
    const boundsResult = await $`osascript -e ${boundsScript}`.text();
    const [x, y, width, height] = boundsResult.trim().split(",").map(Number);

    return {
      title: title || "Unknown",
      app: app || "Unknown",
      pid: pid ? parseInt(pid) : undefined,
      bounds: { x, y, width, height },
    };
  } else if (platform === "win32") {
    const ps = `
      Add-Type @"
        using System;
        using System.Runtime.InteropServices;
        using System.Text;
        public class Win32 {
          [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
          [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
          [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
        }
"@
      $hwnd = [Win32]::GetForegroundWindow()
      $sb = New-Object System.Text.StringBuilder 256
      [Win32]::GetWindowText($hwnd, $sb, 256)
      $pid = 0
      [Win32]::GetWindowThreadProcessId($hwnd, [ref]$pid)
      $proc = Get-Process -Id $pid
      "$($proc.ProcessName)|$($sb.ToString())|$pid"
    `;
    const result = await $`powershell -command ${ps}`.text();
    const [app, title, pid] = result.trim().split("|");
    return {
      title: title || "Unknown",
      app: app || "Unknown",
      pid: pid ? parseInt(pid) : undefined,
    };
  } else {
    try {
      const windowId = await $`xdotool getactivewindow`.text();
      const title = await $`xdotool getwindowname ${windowId.trim()}`.text();
      const pid = await $`xdotool getwindowpid ${windowId.trim()}`.text();
      return {
        title: title.trim() || "Unknown",
        app: "Unknown",
        pid: pid ? parseInt(pid.trim()) : undefined,
      };
    } catch {
      return {
        title: "Unknown",
        app: "Unknown",
      };
    }
  }
}

export const ActiveWindowTool = Tool.define("desktop_active_window", {
  description: `Get information about the currently focused window.
Returns the window title, application name, process ID, and window bounds (position and size).
Useful for understanding what the user is currently working on.`,

  parameters: z.object({}),

  async execute(_args, _ctx) {
    const info = await getActiveWindow();

    const output = [
      `App: ${info.app}`,
      `Title: ${info.title}`,
      info.pid ? `PID: ${info.pid}` : null,
      info.bounds
        ? `Bounds: ${info.bounds.x},${info.bounds.y} ${info.bounds.width}x${info.bounds.height}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    return {
      output,
      metadata: info,
    };
  },
});
