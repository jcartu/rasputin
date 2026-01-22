/**
 * Health Metrics Collector
 * Collects system metrics from remote hosts via SSH
 */

import { getDb } from "../../db";
import {
  infrastructureHosts,
  healthMetrics,
  sshHosts,
} from "../../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { sshManager } from "../../ssh";
import {
  HealthMetrics,
  METRIC_COMMANDS,
  parseLoadAvg,
  parseMemory,
  parseDisk,
  parseGpuInfo,
  HostStatus,
} from "./types";

export class HealthCollector {
  private pollingIntervalMs: number;
  private pollingTimers: Map<number, NodeJS.Timeout> = new Map();

  constructor(pollingIntervalMs: number = 60000) {
    this.pollingIntervalMs = pollingIntervalMs;
  }

  /**
   * Collect all metrics from a host via SSH
   */
  async collectMetrics(
    hostId: number,
    userId: number
  ): Promise<HealthMetrics | null> {
    const db = await getDb();
    if (!db) {
      console.error("[HealthCollector] Database not available");
      return null;
    }

    // Get the infrastructure host
    const [host] = await db
      .select()
      .from(infrastructureHosts)
      .where(eq(infrastructureHosts.id, hostId))
      .limit(1);

    if (!host) {
      console.error(`[HealthCollector] Host ${hostId} not found`);
      return null;
    }

    // Get the linked SSH host for connection
    if (!host.sshHostId) {
      console.error(`[HealthCollector] Host ${hostId} has no SSH host linked`);
      return null;
    }

    const [sshHost] = await db
      .select()
      .from(sshHosts)
      .where(eq(sshHosts.id, host.sshHostId))
      .limit(1);

    if (!sshHost) {
      console.error(`[HealthCollector] SSH host ${host.sshHostId} not found`);
      return null;
    }

    try {
      // Collect all metrics in parallel
      const [
        cpuResult,
        loadResult,
        memResult,
        swapResult,
        diskResult,
        gpuResult,
        processResult,
        zombieResult,
        uptimeResult,
        netConnResult,
      ] = await Promise.all([
        this.executeCommand(host.sshHostId, userId, METRIC_COMMANDS.cpuUsage),
        this.executeCommand(host.sshHostId, userId, METRIC_COMMANDS.loadAvg),
        this.executeCommand(host.sshHostId, userId, METRIC_COMMANDS.memory),
        this.executeCommand(host.sshHostId, userId, METRIC_COMMANDS.swap),
        this.executeCommand(host.sshHostId, userId, METRIC_COMMANDS.disk),
        this.executeCommand(host.sshHostId, userId, METRIC_COMMANDS.gpuInfo),
        this.executeCommand(
          host.sshHostId,
          userId,
          METRIC_COMMANDS.processCount
        ),
        this.executeCommand(
          host.sshHostId,
          userId,
          METRIC_COMMANDS.zombieProcesses
        ),
        this.executeCommand(host.sshHostId, userId, METRIC_COMMANDS.uptime),
        this.executeCommand(
          host.sshHostId,
          userId,
          METRIC_COMMANDS.networkConnections
        ),
      ]);

      // Parse results
      const loadAvg = parseLoadAvg(loadResult || "0 0 0");
      const memory = parseMemory(memResult || "Mem: 0 0 0");
      const swap = parseMemory(swapResult || "Swap: 0 0 0");
      const disk = parseDisk(diskResult || "/ 0G 0G 0%");
      const gpu = parseGpuInfo(gpuResult || "no-gpu");

      const metrics: HealthMetrics = {
        cpuUsagePercent: parseFloat(cpuResult || "0"),
        cpuLoadAvg1m: loadAvg.load1m,
        cpuLoadAvg5m: loadAvg.load5m,
        cpuLoadAvg15m: loadAvg.load15m,
        memoryTotalMb: memory.total,
        memoryUsedMb: memory.used,
        memoryUsagePercent: memory.percent,
        swapTotalMb: swap.total,
        swapUsedMb: swap.used,
        diskTotalGb: disk.total,
        diskUsedGb: disk.used,
        diskUsagePercent: disk.percent,
        diskIoReadMbps: 0, // Would need iostat parsing
        diskIoWriteMbps: 0,
        networkRxMbps: 0, // Would need delta calculation
        networkTxMbps: 0,
        networkConnections: parseInt(netConnResult || "0"),
        processCount: parseInt(processResult || "0"),
        zombieProcesses: parseInt(zombieResult || "0"),
        uptimeSeconds: parseFloat(uptimeResult || "0"),
        ...(gpu && {
          gpuCount: gpu.count,
          gpuUtilizationPercent: gpu.utilization,
          gpuMemoryUsedMb: gpu.memoryUsed,
          gpuMemoryTotalMb: gpu.memoryTotal,
          gpuTemperatureC: gpu.temperature,
          gpuPowerWatts: gpu.power,
        }),
      };

      // Store metrics in database
      await this.storeMetrics(hostId, metrics);

      // Update host status
      await db
        .update(infrastructureHosts)
        .set({
          status: "online",
          lastSeen: new Date(),
        })
        .where(eq(infrastructureHosts.id, hostId));

      return metrics;
    } catch (error) {
      console.error(
        `[HealthCollector] Failed to collect metrics for host ${hostId}:`,
        error
      );

      // Update host status to degraded/offline
      await db
        .update(infrastructureHosts)
        .set({
          status: "degraded",
        })
        .where(eq(infrastructureHosts.id, hostId));

      return null;
    }
  }

  /**
   * Execute a command on the remote host via SSH
   */
  private async executeCommand(
    sshHostId: number,
    userId: number,
    command: string
  ): Promise<string | null> {
    try {
      const result = await sshManager.executeCommand(
        sshHostId,
        userId,
        command
      );
      if (result.success) {
        return result.stdout?.trim() || null;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Store collected metrics in the database
   */
  private async storeMetrics(
    hostId: number,
    metrics: HealthMetrics
  ): Promise<void> {
    const db = await getDb();
    if (!db) return;

    await db.insert(healthMetrics).values({
      hostId,
      cpuUsagePercent: String(metrics.cpuUsagePercent),
      cpuLoadAvg1m: String(metrics.cpuLoadAvg1m),
      cpuLoadAvg5m: String(metrics.cpuLoadAvg5m),
      cpuLoadAvg15m: String(metrics.cpuLoadAvg15m),
      memoryTotalMb: metrics.memoryTotalMb,
      memoryUsedMb: metrics.memoryUsedMb,
      memoryUsagePercent: String(metrics.memoryUsagePercent),
      swapTotalMb: metrics.swapTotalMb,
      swapUsedMb: metrics.swapUsedMb,
      diskTotalGb: metrics.diskTotalGb,
      diskUsedGb: metrics.diskUsedGb,
      diskUsagePercent: String(metrics.diskUsagePercent),
      diskIoReadMbps: String(metrics.diskIoReadMbps),
      diskIoWriteMbps: String(metrics.diskIoWriteMbps),
      networkRxMbps: String(metrics.networkRxMbps),
      networkTxMbps: String(metrics.networkTxMbps),
      networkConnections: metrics.networkConnections,
      gpuCount: metrics.gpuCount,
      gpuUtilizationPercent: metrics.gpuUtilizationPercent
        ? String(metrics.gpuUtilizationPercent)
        : null,
      gpuMemoryUsedMb: metrics.gpuMemoryUsedMb,
      gpuMemoryTotalMb: metrics.gpuMemoryTotalMb,
      gpuTemperatureC: metrics.gpuTemperatureC,
      gpuPowerWatts: metrics.gpuPowerWatts,
      processCount: metrics.processCount,
      zombieProcesses: metrics.zombieProcesses,
      uptimeSeconds: metrics.uptimeSeconds,
    });
  }

  /**
   * Get latest metrics for a host
   */
  async getLatestMetrics(hostId: number): Promise<HealthMetrics | null> {
    const db = await getDb();
    if (!db) return null;

    const [latest] = await db
      .select()
      .from(healthMetrics)
      .where(eq(healthMetrics.hostId, hostId))
      .orderBy(desc(healthMetrics.collectedAt))
      .limit(1);

    if (!latest) return null;

    return {
      cpuUsagePercent: parseFloat(String(latest.cpuUsagePercent)) || 0,
      cpuLoadAvg1m: parseFloat(String(latest.cpuLoadAvg1m)) || 0,
      cpuLoadAvg5m: parseFloat(String(latest.cpuLoadAvg5m)) || 0,
      cpuLoadAvg15m: parseFloat(String(latest.cpuLoadAvg15m)) || 0,
      memoryTotalMb: latest.memoryTotalMb || 0,
      memoryUsedMb: latest.memoryUsedMb || 0,
      memoryUsagePercent: parseFloat(String(latest.memoryUsagePercent)) || 0,
      swapTotalMb: latest.swapTotalMb || 0,
      swapUsedMb: latest.swapUsedMb || 0,
      diskTotalGb: latest.diskTotalGb || 0,
      diskUsedGb: latest.diskUsedGb || 0,
      diskUsagePercent: parseFloat(String(latest.diskUsagePercent)) || 0,
      diskIoReadMbps: parseFloat(String(latest.diskIoReadMbps)) || 0,
      diskIoWriteMbps: parseFloat(String(latest.diskIoWriteMbps)) || 0,
      networkRxMbps: parseFloat(String(latest.networkRxMbps)) || 0,
      networkTxMbps: parseFloat(String(latest.networkTxMbps)) || 0,
      networkConnections: latest.networkConnections || 0,
      processCount: latest.processCount || 0,
      zombieProcesses: latest.zombieProcesses || 0,
      uptimeSeconds: Number(latest.uptimeSeconds) || 0,
      gpuCount: latest.gpuCount || undefined,
      gpuUtilizationPercent: latest.gpuUtilizationPercent
        ? parseFloat(String(latest.gpuUtilizationPercent))
        : undefined,
      gpuMemoryUsedMb: latest.gpuMemoryUsedMb || undefined,
      gpuMemoryTotalMb: latest.gpuMemoryTotalMb || undefined,
      gpuTemperatureC: latest.gpuTemperatureC || undefined,
      gpuPowerWatts: latest.gpuPowerWatts || undefined,
    };
  }

  /**
   * Get status of all hosts for a user
   */
  async getAllHostStatuses(userId: number): Promise<HostStatus[]> {
    const db = await getDb();
    if (!db) return [];

    const hosts = await db
      .select()
      .from(infrastructureHosts)
      .where(eq(infrastructureHosts.userId, userId));

    const statuses: HostStatus[] = [];

    for (const host of hosts) {
      const latestMetrics = await this.getLatestMetrics(host.id);

      statuses.push({
        hostId: host.id,
        hostname: host.hostname,
        status: host.status as "online" | "offline" | "degraded" | "unknown",
        lastSeen: host.lastSeen || undefined,
        latestMetrics: latestMetrics || undefined,
        activeIncidents: 0, // Will be populated by alert engine
      });
    }

    return statuses;
  }

  /**
   * Start polling for a host
   */
  startPolling(hostId: number, userId: number): void {
    if (this.pollingTimers.has(hostId)) {
      return; // Already polling
    }

    const timer = setInterval(async () => {
      await this.collectMetrics(hostId, userId);
    }, this.pollingIntervalMs);

    this.pollingTimers.set(hostId, timer);

    // Collect immediately
    this.collectMetrics(hostId, userId);
  }

  /**
   * Stop polling for a host
   */
  stopPolling(hostId: number): void {
    const timer = this.pollingTimers.get(hostId);
    if (timer) {
      clearInterval(timer);
      this.pollingTimers.delete(hostId);
    }
  }

  /**
   * Stop all polling
   */
  stopAllPolling(): void {
    this.pollingTimers.forEach(timer => {
      clearInterval(timer);
    });
    this.pollingTimers.clear();
  }

  /**
   * Get all monitored hosts for a user
   */
  async getMonitoredHosts(
    userId: number
  ): Promise<Array<typeof infrastructureHosts.$inferSelect>> {
    const db = await getDb();
    if (!db) return [];

    return db
      .select()
      .from(infrastructureHosts)
      .where(eq(infrastructureHosts.userId, userId));
  }

  /**
   * Add a host to monitoring
   */
  async addHostToMonitoring(
    userId: number,
    sshHostId: number,
    _checkIntervalMinutes?: number
  ): Promise<typeof infrastructureHosts.$inferSelect> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Get the SSH host details
    const [sshHost] = await db
      .select()
      .from(sshHosts)
      .where(eq(sshHosts.id, sshHostId))
      .limit(1);

    if (!sshHost || sshHost.userId !== userId) {
      throw new Error("SSH host not found");
    }

    // Create infrastructure host record
    const [inserted] = await db
      .insert(infrastructureHosts)
      .values({
        userId,
        sshHostId,
        name: sshHost.name,
        hostname: sshHost.hostname,
        status: "unknown",
      })
      .$returningId();

    const [result] = await db
      .select()
      .from(infrastructureHosts)
      .where(eq(infrastructureHosts.id, inserted.id))
      .limit(1);

    // Start polling
    this.startPolling(result.id, userId);

    return result;
  }

  /**
   * Remove a host from monitoring
   */
  async removeHostFromMonitoring(
    hostId: number,
    _userId: number
  ): Promise<void> {
    const db = await getDb();
    if (!db) return;

    // Stop polling
    this.stopPolling(hostId);

    // Delete the host
    await db
      .delete(infrastructureHosts)
      .where(eq(infrastructureHosts.id, hostId));
  }

  /**
   * Get metrics history for a host
   */
  async getHostMetrics(
    hostId: number,
    userId: number,
    hours: number = 24
  ): Promise<Array<typeof healthMetrics.$inferSelect>> {
    const db = await getDb();
    if (!db) return [];

    // Verify ownership
    const [host] = await db
      .select()
      .from(infrastructureHosts)
      .where(eq(infrastructureHosts.id, hostId))
      .limit(1);

    if (!host || host.userId !== userId) {
      throw new Error("Host not found");
    }

    const _cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

    return db
      .select()
      .from(healthMetrics)
      .where(eq(healthMetrics.hostId, hostId))
      .orderBy(desc(healthMetrics.collectedAt));
  }
}

// Singleton instance
export const healthCollector = new HealthCollector();
