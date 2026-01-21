import { z } from "zod";
import { Tool } from "./tool";
import {
  hostname,
  platform,
  arch,
  release,
  cpus,
  totalmem,
  freemem,
  uptime,
  userInfo,
  homedir,
  tmpdir,
  networkInterfaces,
} from "os";

function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(2)} ${units[unitIndex]}`;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
}

export const SystemInfoTool = Tool.define("desktop_system_info", {
  description: `Get information about the user's system.
Returns details about the OS, CPU, memory, network, and user environment.
Useful for understanding the user's computing context.`,

  parameters: z.object({
    category: z
      .enum(["all", "os", "cpu", "memory", "network", "user"])
      .default("all")
      .describe("What category of information to return"),
  }),

  async execute(args, _ctx) {
    const category = args.category;
    const info: Record<string, unknown> = {};

    if (category === "all" || category === "os") {
      info.os = {
        hostname: hostname(),
        platform: platform(),
        arch: arch(),
        release: release(),
        uptime: formatUptime(uptime()),
      };
    }

    if (category === "all" || category === "cpu") {
      const cpuInfo = cpus();
      info.cpu = {
        model: cpuInfo[0]?.model || "Unknown",
        cores: cpuInfo.length,
        speed: `${cpuInfo[0]?.speed || 0} MHz`,
      };
    }

    if (category === "all" || category === "memory") {
      const total = totalmem();
      const free = freemem();
      const used = total - free;
      info.memory = {
        total: formatBytes(total),
        free: formatBytes(free),
        used: formatBytes(used),
        usagePercent: ((used / total) * 100).toFixed(1) + "%",
      };
    }

    if (category === "all" || category === "network") {
      const interfaces = networkInterfaces();
      const networks: Record<string, string[]> = {};
      for (const [name, addrs] of Object.entries(interfaces)) {
        if (addrs) {
          networks[name] = addrs
            .filter(a => !a.internal)
            .map(a => `${a.family}: ${a.address}`);
        }
      }
      info.network = networks;
    }

    if (category === "all" || category === "user") {
      const user = userInfo();
      info.user = {
        username: user.username,
        homedir: homedir(),
        tmpdir: tmpdir(),
        shell: user.shell,
      };
    }

    const output = Object.entries(info)
      .map(([key, value]) => `${key}:\n${JSON.stringify(value, null, 2)}`)
      .join("\n\n");

    return {
      output,
      metadata: info,
    };
  },
});
