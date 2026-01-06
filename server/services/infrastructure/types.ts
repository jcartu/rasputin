/**
 * Infrastructure Monitoring & Self-Healing System Types
 */

export interface HealthMetrics {
  // CPU
  cpuUsagePercent: number;
  cpuLoadAvg1m: number;
  cpuLoadAvg5m: number;
  cpuLoadAvg15m: number;

  // Memory
  memoryTotalMb: number;
  memoryUsedMb: number;
  memoryUsagePercent: number;
  swapTotalMb: number;
  swapUsedMb: number;

  // Disk
  diskTotalGb: number;
  diskUsedGb: number;
  diskUsagePercent: number;
  diskIoReadMbps: number;
  diskIoWriteMbps: number;

  // Network
  networkRxMbps: number;
  networkTxMbps: number;
  networkConnections: number;

  // GPU (optional)
  gpuCount?: number;
  gpuUtilizationPercent?: number;
  gpuMemoryUsedMb?: number;
  gpuMemoryTotalMb?: number;
  gpuTemperatureC?: number;
  gpuPowerWatts?: number;

  // Process
  processCount: number;
  zombieProcesses: number;

  // System
  uptimeSeconds: number;
}

export interface AlertCondition {
  metric: keyof HealthMetrics;
  operator: "gt" | "gte" | "lt" | "lte" | "eq" | "neq";
  threshold: number;
  durationSeconds: number;
}

export interface AlertRule {
  id: number;
  name: string;
  description?: string;
  hostId?: number;
  condition: AlertCondition;
  severity: "info" | "warning" | "critical";
  autoRemediate: boolean;
  remediationId?: number;
  notifyOwner: boolean;
  isEnabled: boolean;
}

export interface Incident {
  id: number;
  hostId: number;
  alertRuleId?: number;
  title: string;
  description?: string;
  severity: "info" | "warning" | "critical";
  status: "open" | "acknowledged" | "investigating" | "resolved" | "closed";
  metricName?: string;
  metricValue?: number;
  thresholdValue?: number;
  detectedAt: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolutionNotes?: string;
}

export interface Remediation {
  id: number;
  name: string;
  description?: string;
  targetMetric?: string;
  targetCondition?: Record<string, unknown>;
  actionType:
    | "command"
    | "script"
    | "restart_service"
    | "clear_cache"
    | "kill_process"
    | "custom";
  actionPayload?: string;
  requiresApproval: boolean;
  maxExecutionsPerHour: number;
  rollbackCommand?: string;
  executionCount: number;
  successCount: number;
  failureCount: number;
  isEnabled: boolean;
}

export interface RemediationResult {
  success: boolean;
  output?: string;
  errorMessage?: string;
  executionTimeMs: number;
}

export interface MonitoringConfig {
  pollingIntervalMs: number;
  metricsRetentionDays: number;
  alertCooldownMs: number;
}

export interface HostStatus {
  hostId: number;
  hostname: string;
  status: "online" | "offline" | "degraded" | "unknown";
  lastSeen?: Date;
  latestMetrics?: HealthMetrics;
  activeIncidents: number;
}

// SSH command results for metric collection
export interface SSHCommandResult {
  success: boolean;
  output: string;
  error?: string;
  exitCode: number;
}

// Metric collection commands
export const METRIC_COMMANDS = {
  // CPU metrics
  cpuUsage: "top -bn1 | grep 'Cpu(s)' | awk '{print $2}'",
  loadAvg: "cat /proc/loadavg",

  // Memory metrics
  memory: "free -m | grep Mem",
  swap: "free -m | grep Swap",

  // Disk metrics
  disk: "df -BG / | tail -1",
  diskIo: "iostat -d 1 2 | tail -3 | head -1",

  // Network metrics
  networkRx:
    "cat /sys/class/net/$(ip route | grep default | awk '{print $5}')/statistics/rx_bytes",
  networkTx:
    "cat /sys/class/net/$(ip route | grep default | awk '{print $5}')/statistics/tx_bytes",
  networkConnections: "ss -s | grep 'estab' | awk '{print $4}' | tr -d ','",

  // GPU metrics (NVIDIA)
  gpuInfo:
    "nvidia-smi --query-gpu=count,utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw --format=csv,noheader,nounits 2>/dev/null || echo 'no-gpu'",

  // Process metrics
  processCount: "ps aux | wc -l",
  zombieProcesses: "ps aux | grep -c 'Z'",

  // System metrics
  uptime: "cat /proc/uptime | awk '{print $1}'",
} as const;

// Parse metric output helpers
export function parseLoadAvg(output: string): {
  load1m: number;
  load5m: number;
  load15m: number;
} {
  const parts = output.trim().split(" ");
  return {
    load1m: parseFloat(parts[0]) || 0,
    load5m: parseFloat(parts[1]) || 0,
    load15m: parseFloat(parts[2]) || 0,
  };
}

export function parseMemory(output: string): {
  total: number;
  used: number;
  percent: number;
} {
  const parts = output.trim().split(/\s+/);
  const total = parseInt(parts[1]) || 0;
  const used = parseInt(parts[2]) || 0;
  return {
    total,
    used,
    percent: total > 0 ? (used / total) * 100 : 0,
  };
}

export function parseDisk(output: string): {
  total: number;
  used: number;
  percent: number;
} {
  const parts = output.trim().split(/\s+/);
  const total = parseInt(parts[1]?.replace("G", "")) || 0;
  const used = parseInt(parts[2]?.replace("G", "")) || 0;
  const percentStr = parts[4]?.replace("%", "") || "0";
  return {
    total,
    used,
    percent: parseFloat(percentStr),
  };
}

export function parseGpuInfo(output: string): {
  count: number;
  utilization: number;
  memoryUsed: number;
  memoryTotal: number;
  temperature: number;
  power: number;
} | null {
  if (output.includes("no-gpu")) return null;
  const parts = output
    .trim()
    .split(",")
    .map(s => s.trim());
  if (parts.length < 6) return null;
  return {
    count: parseInt(parts[0]) || 0,
    utilization: parseFloat(parts[1]) || 0,
    memoryUsed: parseInt(parts[2]) || 0,
    memoryTotal: parseInt(parts[3]) || 0,
    temperature: parseInt(parts[4]) || 0,
    power: parseInt(parts[5]) || 0,
  };
}
