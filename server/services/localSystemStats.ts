import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface LocalSystemStats {
  cpu: {
    loadPercent: number;
    load1m: number;
    load5m: number;
    load15m: number;
    cores: number;
  };
  memory: {
    totalMb: number;
    usedMb: number;
    percentUsed: number;
  };
  gpu: {
    available: boolean;
    count: number;
    utilizationPercent: number;
    memoryUsedMb: number;
    memoryTotalMb: number;
    temperatureC: number;
    powerWatts: number;
  } | null;
  disk: {
    totalGb: number;
    usedGb: number;
    percentUsed: number;
  };
  network: {
    rxBytes: number;
    txBytes: number;
    connections: number;
  };
  uptime: number;
  timestamp: number;
}

async function runCommand(command: string): Promise<string> {
  try {
    const { stdout } = await execAsync(command, { timeout: 5000 });
    return stdout.trim();
  } catch {
    return "";
  }
}

export async function getLocalSystemStats(): Promise<LocalSystemStats> {
  const [
    loadAvg,
    cpuCores,
    memInfo,
    diskInfo,
    gpuInfo,
    networkRx,
    networkTx,
    networkConns,
    uptime,
  ] = await Promise.all([
    runCommand("cat /proc/loadavg"),
    runCommand("nproc"),
    runCommand("free -m | grep Mem"),
    runCommand("df -BG / | tail -1"),
    runCommand(
      "nvidia-smi --query-gpu=count,utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw --format=csv,noheader,nounits 2>/dev/null || echo 'no-gpu'"
    ),
    runCommand(
      "cat /sys/class/net/$(ip route | grep default | awk '{print $5}')/statistics/rx_bytes 2>/dev/null || echo '0'"
    ),
    runCommand(
      "cat /sys/class/net/$(ip route | grep default | awk '{print $5}')/statistics/tx_bytes 2>/dev/null || echo '0'"
    ),
    runCommand(
      "ss -s 2>/dev/null | grep 'estab' | awk '{print $4}' | tr -d ',' || echo '0'"
    ),
    runCommand("cat /proc/uptime | awk '{print $1}'"),
  ]);

  const loadParts = loadAvg.split(" ");
  const cores = parseInt(cpuCores) || 1;
  const load1m = parseFloat(loadParts[0]) || 0;
  const load5m = parseFloat(loadParts[1]) || 0;
  const load15m = parseFloat(loadParts[2]) || 0;

  const memParts = memInfo.split(/\s+/);
  const memTotal = parseInt(memParts[1]) || 0;
  const memUsed = parseInt(memParts[2]) || 0;

  const diskParts = diskInfo.split(/\s+/);
  const diskTotal = parseInt(diskParts[1]?.replace("G", "")) || 0;
  const diskUsed = parseInt(diskParts[2]?.replace("G", "")) || 0;
  const diskPercent = parseFloat(diskParts[4]?.replace("%", "")) || 0;

  let gpu: LocalSystemStats["gpu"] = null;
  if (!gpuInfo.includes("no-gpu") && gpuInfo.trim()) {
    const gpuParts = gpuInfo.split(",").map(s => s.trim());
    if (gpuParts.length >= 6) {
      gpu = {
        available: true,
        count: parseInt(gpuParts[0]) || 1,
        utilizationPercent: parseFloat(gpuParts[1]) || 0,
        memoryUsedMb: parseInt(gpuParts[2]) || 0,
        memoryTotalMb: parseInt(gpuParts[3]) || 0,
        temperatureC: parseInt(gpuParts[4]) || 0,
        powerWatts: parseInt(gpuParts[5]) || 0,
      };
    }
  }

  return {
    cpu: {
      loadPercent: Math.min(100, (load1m / cores) * 100),
      load1m,
      load5m,
      load15m,
      cores,
    },
    memory: {
      totalMb: memTotal,
      usedMb: memUsed,
      percentUsed: memTotal > 0 ? (memUsed / memTotal) * 100 : 0,
    },
    gpu,
    disk: {
      totalGb: diskTotal,
      usedGb: diskUsed,
      percentUsed: diskPercent,
    },
    network: {
      rxBytes: parseInt(networkRx) || 0,
      txBytes: parseInt(networkTx) || 0,
      connections: parseInt(networkConns) || 0,
    },
    uptime: parseFloat(uptime) || 0,
    timestamp: Date.now(),
  };
}
