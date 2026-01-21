import { $ } from "bun";
import { homedir } from "os";
import { join } from "path";
import { writeFile, mkdir, unlink, readFile } from "fs/promises";

const APP_NAME = "RasputinDaemon";

async function getExecutablePath(): Promise<string> {
  return process.execPath;
}

async function enableAutostartMacOS(execPath: string): Promise<void> {
  const plistPath = join(
    homedir(),
    "Library",
    "LaunchAgents",
    "com.rasputin.daemon.plist"
  );

  const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.rasputin.daemon</string>
    <key>ProgramArguments</key>
    <array>
        <string>${execPath}</string>
        <string>--headless</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${homedir()}/Library/Logs/rasputin-daemon.log</string>
    <key>StandardErrorPath</key>
    <string>${homedir()}/Library/Logs/rasputin-daemon.error.log</string>
</dict>
</plist>`;

  await mkdir(join(homedir(), "Library", "LaunchAgents"), { recursive: true });
  await writeFile(plistPath, plistContent);
  await $`launchctl load ${plistPath}`.quiet();
}

async function disableAutostartMacOS(): Promise<void> {
  const plistPath = join(
    homedir(),
    "Library",
    "LaunchAgents",
    "com.rasputin.daemon.plist"
  );

  try {
    await $`launchctl unload ${plistPath}`.quiet();
    await unlink(plistPath);
  } catch {
    // Ignore unload errors - file may not exist
  }
}

async function enableAutostartWindows(execPath: string): Promise<void> {
  const ps = `
    $WshShell = New-Object -comObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut("$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\${APP_NAME}.lnk")
    $Shortcut.TargetPath = "${execPath}"
    $Shortcut.Arguments = "--headless"
    $Shortcut.Save()
  `;
  await $`powershell -command ${ps}`.quiet();
}

async function disableAutostartWindows(): Promise<void> {
  const ps = `Remove-Item "$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\${APP_NAME}.lnk" -Force -ErrorAction SilentlyContinue`;
  await $`powershell -command ${ps}`.quiet();
}

async function enableAutostartLinux(execPath: string): Promise<void> {
  const autostartDir = join(homedir(), ".config", "autostart");
  const desktopFile = join(autostartDir, "rasputin-daemon.desktop");

  const desktopContent = `[Desktop Entry]
Type=Application
Name=Rasputin Desktop Daemon
Exec=${execPath} --headless
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
`;

  await mkdir(autostartDir, { recursive: true });
  await writeFile(desktopFile, desktopContent);
}

async function disableAutostartLinux(): Promise<void> {
  const desktopFile = join(
    homedir(),
    ".config",
    "autostart",
    "rasputin-daemon.desktop"
  );
  try {
    await unlink(desktopFile);
  } catch {
    // Ignore unlink errors - file may not exist
  }
}

export async function enableAutostart(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const execPath = await getExecutablePath();
    const platform = process.platform;

    if (platform === "darwin") {
      await enableAutostartMacOS(execPath);
    } else if (platform === "win32") {
      await enableAutostartWindows(execPath);
    } else {
      await enableAutostartLinux(execPath);
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function disableAutostart(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const platform = process.platform;

    if (platform === "darwin") {
      await disableAutostartMacOS();
    } else if (platform === "win32") {
      await disableAutostartWindows();
    } else {
      await disableAutostartLinux();
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function isAutostartEnabled(): Promise<boolean> {
  const platform = process.platform;

  try {
    if (platform === "darwin") {
      const plistPath = join(
        homedir(),
        "Library",
        "LaunchAgents",
        "com.rasputin.daemon.plist"
      );
      await readFile(plistPath);
      return true;
    } else if (platform === "win32") {
      const ps = `Test-Path "$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\${APP_NAME}.lnk"`;
      const result = await $`powershell -command ${ps}`.text();
      return result.trim() === "True";
    } else {
      const desktopFile = join(
        homedir(),
        ".config",
        "autostart",
        "rasputin-daemon.desktop"
      );
      await readFile(desktopFile);
      return true;
    }
  } catch {
    return false;
  }
}
