import { getDb } from "../../db";
import { agentTasks } from "../../../drizzle/schema";
import { eq, and, isNull, gte, sql } from "drizzle-orm";
import {
  predictNextTasks,
  analyzeTaskPatterns,
  type PredictedTask,
  type TaskPattern,
} from "./predictiveTask";
import { taskQueue } from "./taskQueue";
import { getMemoryService } from "../memory";

export interface MonitorConfig {
  enabled: boolean;
  checkIntervalMs: number;
  autoTriggerThreshold: number;
  alertThreshold: number;
  maxAutoTriggersPerDay: number;
  quietHoursStart?: number;
  quietHoursEnd?: number;
}

export interface MonitoredUser {
  userId: number;
  lastCheck: Date;
  autoTriggersToday: number;
  alertsSent: number;
}

export interface ProactiveAlert {
  userId: number;
  taskDescription: string;
  confidence: number;
  reason: string;
  suggestedAction: "auto_trigger" | "notify" | "suggest";
  createdAt: Date;
}

interface NotificationCallback {
  (userId: number, alert: ProactiveAlert): Promise<void>;
}

const DEFAULT_CONFIG: MonitorConfig = {
  enabled: false,
  checkIntervalMs: 5 * 60 * 1000,
  autoTriggerThreshold: 0.85,
  alertThreshold: 0.6,
  maxAutoTriggersPerDay: 5,
  quietHoursStart: 22,
  quietHoursEnd: 7,
};

class ProactiveMonitorService {
  private config: MonitorConfig = DEFAULT_CONFIG;
  private monitorInterval: ReturnType<typeof setInterval> | null = null;
  private monitoredUsers: Map<number, MonitoredUser> = new Map();
  private alerts: ProactiveAlert[] = [];
  private notificationCallback: NotificationCallback | null = null;

  async start(config?: Partial<MonitorConfig>): Promise<void> {
    if (this.monitorInterval) {
      this.stop();
    }

    this.config = { ...DEFAULT_CONFIG, ...config };

    if (!this.config.enabled) {
      console.info("[ProactiveMonitor] Monitor disabled in config");
      return;
    }

    console.info(
      `[ProactiveMonitor] Starting with ${this.config.checkIntervalMs}ms interval`
    );

    await this.loadActiveUsers();

    await this.runCheck();

    this.monitorInterval = setInterval(
      () => this.runCheck(),
      this.config.checkIntervalMs
    );
  }

  stop(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
      console.info("[ProactiveMonitor] Stopped");
    }
  }

  setNotificationCallback(callback: NotificationCallback): void {
    this.notificationCallback = callback;
  }

  async loadActiveUsers(): Promise<void> {
    const db = await getDb();
    if (!db) return;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const activeUsers = await db
      .select({
        userId: agentTasks.userId,
        taskCount: sql<number>`count(*)`.as("taskCount"),
      })
      .from(agentTasks)
      .where(gte(agentTasks.createdAt, sevenDaysAgo))
      .groupBy(agentTasks.userId)
      .having(sql`count(*) >= 3`);

    for (const user of activeUsers) {
      this.monitoredUsers.set(user.userId, {
        userId: user.userId,
        lastCheck: new Date(0),
        autoTriggersToday: 0,
        alertsSent: 0,
      });
    }

    console.info(
      `[ProactiveMonitor] Loaded ${this.monitoredUsers.size} active users`
    );
  }

  private isQuietHours(): boolean {
    if (!this.config.quietHoursStart || !this.config.quietHoursEnd) {
      return false;
    }

    const hour = new Date().getHours();
    const start = this.config.quietHoursStart;
    const end = this.config.quietHoursEnd;

    if (start < end) {
      return hour >= start && hour < end;
    }
    return hour >= start || hour < end;
  }

  private async runCheck(): Promise<void> {
    if (this.isQuietHours()) {
      console.info("[ProactiveMonitor] Skipping check during quiet hours");
      return;
    }

    const today = new Date().toDateString();

    for (const [userId, userData] of Array.from(
      this.monitoredUsers.entries()
    )) {
      const lastCheckDate = userData.lastCheck.toDateString();
      if (lastCheckDate !== today) {
        userData.autoTriggersToday = 0;
        userData.alertsSent = 0;
      }

      try {
        await this.checkUserPredictions(userId);
        userData.lastCheck = new Date();
      } catch (error) {
        console.error(
          `[ProactiveMonitor] Error checking user ${userId}:`,
          error
        );
      }
    }
  }

  private async checkUserPredictions(userId: number): Promise<void> {
    const predictions = await predictNextTasks(userId);

    for (const prediction of predictions) {
      if (prediction.confidence >= this.config.autoTriggerThreshold) {
        await this.handleHighConfidencePrediction(userId, prediction);
      } else if (prediction.confidence >= this.config.alertThreshold) {
        await this.handleMediumConfidencePrediction(userId, prediction);
      }
    }
  }

  private async handleHighConfidencePrediction(
    userId: number,
    prediction: PredictedTask
  ): Promise<void> {
    const userData = this.monitoredUsers.get(userId);
    if (!userData) return;

    if (userData.autoTriggersToday >= this.config.maxAutoTriggersPerDay) {
      await this.createAlert(userId, prediction, "notify");
      return;
    }

    const shouldAutoTrigger = await this.shouldAutoTrigger(userId, prediction);

    if (shouldAutoTrigger) {
      await this.autoTriggerTask(userId, prediction);
      userData.autoTriggersToday++;
    } else {
      await this.createAlert(userId, prediction, "notify");
    }
  }

  private async handleMediumConfidencePrediction(
    userId: number,
    prediction: PredictedTask
  ): Promise<void> {
    await this.createAlert(userId, prediction, "suggest");
  }

  private async shouldAutoTrigger(
    userId: number,
    prediction: PredictedTask
  ): Promise<boolean> {
    const db = await getDb();
    if (!db) return false;

    const runningTasks = await db
      .select({ id: agentTasks.id })
      .from(agentTasks)
      .where(
        and(
          eq(agentTasks.userId, userId),
          eq(agentTasks.status, "running"),
          isNull(agentTasks.completedAt)
        )
      )
      .limit(1);

    if (runningTasks.length > 0) return false;

    const memoryService = getMemoryService();
    const recentFailures = await memoryService.search({
      query: prediction.taskDescription,
      userId,
      limit: 5,
      memoryTypes: ["episodic"],
    });

    const failureCount = recentFailures.filter(
      m =>
        m.memory &&
        "memoryType" in m.memory &&
        m.memory.memoryType === "task_failure"
    ).length;

    if (failureCount >= 2) return false;

    if (prediction.suggestedTime) {
      const now = new Date();
      const timeDiff = Math.abs(
        now.getTime() - prediction.suggestedTime.getTime()
      );
      const oneHour = 60 * 60 * 1000;
      if (timeDiff > oneHour) return false;
    }

    return prediction.confidence >= 0.9;
  }

  private async autoTriggerTask(
    userId: number,
    prediction: PredictedTask
  ): Promise<void> {
    console.info(
      `[ProactiveMonitor] Auto-triggering task for user ${userId}: ${prediction.taskDescription}`
    );

    try {
      const taskId = await taskQueue.submitTask({
        userId,
        taskType: "jarvis_task",
        prompt: prediction.taskDescription,
        priority: 5,
        metadata: { source: "proactive_monitor" },
      });

      await this.createAlert(
        userId,
        prediction,
        "auto_trigger",
        `Task ${taskId} queued automatically`
      );
    } catch (error) {
      console.error("[ProactiveMonitor] Failed to auto-trigger task:", error);
    }
  }

  private async createAlert(
    userId: number,
    prediction: PredictedTask,
    action: ProactiveAlert["suggestedAction"],
    additionalInfo?: string
  ): Promise<void> {
    const alert: ProactiveAlert = {
      userId,
      taskDescription: prediction.taskDescription,
      confidence: prediction.confidence,
      reason: additionalInfo
        ? `${prediction.triggerReason}. ${additionalInfo}`
        : prediction.triggerReason,
      suggestedAction: action,
      createdAt: new Date(),
    };

    this.alerts.push(alert);

    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-500);
    }

    if (this.notificationCallback && action !== "suggest") {
      try {
        await this.notificationCallback(userId, alert);
        const userData = this.monitoredUsers.get(userId);
        if (userData) userData.alertsSent++;
      } catch (error) {
        console.error(
          "[ProactiveMonitor] Notification callback failed:",
          error
        );
      }
    }
  }

  getAlerts(userId?: number, limit: number = 50): ProactiveAlert[] {
    let filtered = this.alerts;
    if (userId) {
      filtered = this.alerts.filter(a => a.userId === userId);
    }
    return filtered.slice(-limit);
  }

  getConfig(): MonitorConfig {
    return { ...this.config };
  }

  async updateConfig(config: Partial<MonitorConfig>): Promise<void> {
    const wasEnabled = this.config.enabled;
    this.config = { ...this.config, ...config };

    if (!wasEnabled && this.config.enabled) {
      await this.start(this.config);
    } else if (wasEnabled && !this.config.enabled) {
      this.stop();
    }
  }

  async getStatus(): Promise<{
    running: boolean;
    config: MonitorConfig;
    monitoredUsersCount: number;
    alertsCount: number;
    lastCheckTime: Date | null;
  }> {
    let lastCheck: Date | null = null;
    for (const userData of Array.from(this.monitoredUsers.values())) {
      if (!lastCheck || userData.lastCheck > lastCheck) {
        lastCheck = userData.lastCheck;
      }
    }

    return {
      running: this.monitorInterval !== null,
      config: this.config,
      monitoredUsersCount: this.monitoredUsers.size,
      alertsCount: this.alerts.length,
      lastCheckTime: lastCheck,
    };
  }

  async getUserInsights(userId: number): Promise<{
    patterns: TaskPattern[];
    predictions: PredictedTask[];
    recentAlerts: ProactiveAlert[];
    userData: MonitoredUser | null;
  }> {
    const patterns = await analyzeTaskPatterns(userId);
    const predictions = await predictNextTasks(userId);
    const recentAlerts = this.getAlerts(userId, 10);
    const userData = this.monitoredUsers.get(userId) || null;

    return {
      patterns,
      predictions,
      recentAlerts,
      userData,
    };
  }
}

export const proactiveMonitor = new ProactiveMonitorService();

export async function startProactiveMonitor(
  config?: Partial<MonitorConfig>
): Promise<void> {
  await proactiveMonitor.start(config);
}

export function stopProactiveMonitor(): void {
  proactiveMonitor.stop();
}
