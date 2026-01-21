/**
 * Alert Engine
 * Evaluates alert rules against collected metrics and creates incidents
 */

import { getDb } from "../../db";
import {
  alertRules,
  incidents,
  infrastructureHosts,
  remediations,
  incidentActions,
  sshHosts as _sshHosts,
} from "../../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import {
  HealthMetrics,
  AlertCondition,
  Incident,
  RemediationResult,
} from "./types";
import { sshManager } from "../../ssh";
import { notifyOwner } from "../../_core/notification";

export class AlertEngine {
  // Track how long conditions have been true (for duration-based alerts)
  private conditionStartTimes: Map<string, number> = new Map();

  // Track recent alerts to prevent spam
  private recentAlerts: Map<string, number> = new Map();
  private alertCooldownMs: number = 300000; // 5 minutes

  /**
   * Evaluate all alert rules for a host
   */
  async evaluateAlerts(
    hostId: number,
    userId: number,
    metrics: HealthMetrics
  ): Promise<Incident[]> {
    const db = await getDb();
    if (!db) return [];

    // Get all enabled alert rules for this host (or global rules)
    const rules = await db
      .select()
      .from(alertRules)
      .where(and(eq(alertRules.userId, userId), eq(alertRules.isEnabled, 1)));

    const newIncidents: Incident[] = [];

    for (const rule of rules) {
      // Skip if rule is for a different host
      if (rule.hostId && rule.hostId !== hostId) continue;

      const condition: AlertCondition = {
        metric: rule.metric as keyof HealthMetrics,
        operator: rule.operator as AlertCondition["operator"],
        threshold: parseFloat(String(rule.threshold)),
        durationSeconds: rule.durationSeconds || 0,
      };

      const isTriggered = this.evaluateCondition(metrics, condition);
      const conditionKey = `${hostId}-${rule.id}`;

      if (isTriggered) {
        // Track when condition started being true
        if (!this.conditionStartTimes.has(conditionKey)) {
          this.conditionStartTimes.set(conditionKey, Date.now());
        }

        const conditionDuration =
          (Date.now() - this.conditionStartTimes.get(conditionKey)!) / 1000;

        // Check if condition has been true long enough
        if (conditionDuration >= condition.durationSeconds) {
          // Check cooldown to prevent alert spam
          const lastAlert = this.recentAlerts.get(conditionKey);
          if (!lastAlert || Date.now() - lastAlert > this.alertCooldownMs) {
            // Create incident
            const incident = await this.createIncident(
              hostId,
              rule,
              metrics,
              condition
            );
            if (incident) {
              newIncidents.push(incident);
              this.recentAlerts.set(conditionKey, Date.now());

              // Auto-remediate if configured
              if (rule.autoRemediate && rule.remediationId) {
                await this.executeRemediation(
                  incident.id,
                  rule.remediationId,
                  hostId,
                  userId
                );
              }

              // Notify owner if configured
              if (rule.notifyOwner) {
                await this.notifyIncident(incident);
              }
            }
          }
        }
      } else {
        // Condition is no longer true, reset tracking
        this.conditionStartTimes.delete(conditionKey);
      }
    }

    return newIncidents;
  }

  /**
   * Evaluate a single condition against metrics
   */
  private evaluateCondition(
    metrics: HealthMetrics,
    condition: AlertCondition
  ): boolean {
    const value = metrics[condition.metric];
    if (value === undefined || value === null) return false;

    const numValue =
      typeof value === "number" ? value : parseFloat(String(value));

    switch (condition.operator) {
      case "gt":
        return numValue > condition.threshold;
      case "gte":
        return numValue >= condition.threshold;
      case "lt":
        return numValue < condition.threshold;
      case "lte":
        return numValue <= condition.threshold;
      case "eq":
        return numValue === condition.threshold;
      case "neq":
        return numValue !== condition.threshold;
      default:
        return false;
    }
  }

  /**
   * Create a new incident
   */
  private async createIncident(
    hostId: number,
    rule: typeof alertRules.$inferSelect,
    metrics: HealthMetrics,
    condition: AlertCondition
  ): Promise<Incident | null> {
    const db = await getDb();
    if (!db) return null;

    // Check if there's already an open incident for this rule
    const [existing] = await db
      .select()
      .from(incidents)
      .where(
        and(
          eq(incidents.hostId, hostId),
          eq(incidents.alertRuleId, rule.id),
          eq(incidents.status, "open")
        )
      )
      .limit(1);

    if (existing) return null; // Don't create duplicate incidents

    const metricValue = metrics[condition.metric];

    const [inserted] = await db
      .insert(incidents)
      .values({
        hostId,
        alertRuleId: rule.id,
        title: `${rule.name} - ${condition.metric} ${condition.operator} ${condition.threshold}`,
        description:
          rule.description ||
          `Alert triggered: ${condition.metric} is ${metricValue} (threshold: ${condition.threshold})`,
        severity: rule.severity || "warning",
        status: "open",
        metricName: condition.metric,
        metricValue:
          typeof metricValue === "number"
            ? String(metricValue)
            : String(metricValue),
        thresholdValue: String(condition.threshold),
      })
      .$returningId();

    return {
      id: inserted.id,
      hostId,
      alertRuleId: rule.id,
      title: `${rule.name} - ${condition.metric} ${condition.operator} ${condition.threshold}`,
      description: rule.description || undefined,
      severity: (rule.severity || "warning") as Incident["severity"],
      status: "open",
      metricName: condition.metric,
      metricValue:
        typeof metricValue === "number"
          ? metricValue
          : parseFloat(String(metricValue)),
      thresholdValue: condition.threshold,
      detectedAt: new Date(),
    };
  }

  /**
   * Execute a remediation action
   */
  async executeRemediation(
    incidentId: number,
    remediationId: number,
    hostId: number,
    userId: number
  ): Promise<RemediationResult> {
    const db = await getDb();
    const startTime = Date.now();

    if (!db) {
      return {
        success: false,
        errorMessage: "Database not available",
        executionTimeMs: Date.now() - startTime,
      };
    }

    // Get remediation details
    const [remediation] = await db
      .select()
      .from(remediations)
      .where(eq(remediations.id, remediationId))
      .limit(1);

    if (!remediation || !remediation.isEnabled) {
      return {
        success: false,
        errorMessage: "Remediation not found or disabled",
        executionTimeMs: Date.now() - startTime,
      };
    }

    // Get host SSH details
    const [host] = await db
      .select()
      .from(infrastructureHosts)
      .where(eq(infrastructureHosts.id, hostId))
      .limit(1);

    if (!host || !host.sshHostId) {
      return {
        success: false,
        errorMessage: "Host not found or no SSH access configured",
        executionTimeMs: Date.now() - startTime,
      };
    }

    let result: RemediationResult;

    try {
      // Execute the remediation command
      const command = remediation.actionPayload || "";
      const sshResult = await sshManager.executeCommand(
        host.sshHostId,
        userId,
        command
      );

      result = {
        success: sshResult.success,
        output: sshResult.stdout,
        errorMessage: sshResult.stderr || sshResult.error,
        executionTimeMs: Date.now() - startTime,
      };

      // Update remediation stats
      await db
        .update(remediations)
        .set({
          executionCount: (remediation.executionCount || 0) + 1,
          successCount: sshResult.success
            ? (remediation.successCount || 0) + 1
            : remediation.successCount,
          failureCount: !sshResult.success
            ? (remediation.failureCount || 0) + 1
            : remediation.failureCount,
        })
        .where(eq(remediations.id, remediationId));
    } catch (error) {
      result = {
        success: false,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        executionTimeMs: Date.now() - startTime,
      };
    }

    // Log the action
    await db.insert(incidentActions).values({
      incidentId,
      remediationId,
      actionType: "remediation",
      actionBy: "system",
      description: `Executed remediation: ${remediation.name}`,
      command: remediation.actionPayload,
      output: result.output,
      success: result.success ? 1 : 0,
      errorMessage: result.errorMessage,
    });

    // If successful, mark incident as resolved
    if (result.success) {
      await db
        .update(incidents)
        .set({
          status: "resolved",
          resolvedAt: new Date(),
          resolvedBy: "auto",
          resolutionNotes: `Auto-remediated by: ${remediation.name}`,
        })
        .where(eq(incidents.id, incidentId));
    }

    return result;
  }

  /**
   * Notify owner about an incident
   */
  private async notifyIncident(incident: Incident): Promise<void> {
    const db = await getDb();
    if (!db) return;

    // Get host details
    const [host] = await db
      .select()
      .from(infrastructureHosts)
      .where(eq(infrastructureHosts.id, incident.hostId))
      .limit(1);

    const hostName = host?.name || `Host ${incident.hostId}`;

    await notifyOwner({
      title: `🚨 ${incident.severity.toUpperCase()}: ${incident.title}`,
      content: `
**Host:** ${hostName}
**Severity:** ${incident.severity}
**Metric:** ${incident.metricName} = ${incident.metricValue}
**Threshold:** ${incident.thresholdValue}
**Time:** ${incident.detectedAt.toISOString()}

${incident.description || ""}
      `.trim(),
    });
  }

  /**
   * Acknowledge an incident
   */
  async acknowledgeIncident(incidentId: number, userId: number): Promise<void> {
    const db = await getDb();
    if (!db) return;

    await db
      .update(incidents)
      .set({
        status: "acknowledged",
        acknowledgedAt: new Date(),
      })
      .where(eq(incidents.id, incidentId));

    await db.insert(incidentActions).values({
      incidentId,
      actionType: "acknowledge",
      actionBy: `user:${userId}`,
      description: "Incident acknowledged",
    });
  }

  /**
   * Resolve an incident manually
   */
  async resolveIncident(
    incidentId: number,
    userId: number,
    notes?: string
  ): Promise<void> {
    const db = await getDb();
    if (!db) return;

    await db
      .update(incidents)
      .set({
        status: "resolved",
        resolvedAt: new Date(),
        resolvedBy: "manual",
        resolutionNotes: notes,
      })
      .where(eq(incidents.id, incidentId));

    await db.insert(incidentActions).values({
      incidentId,
      actionType: "resolve",
      actionBy: `user:${userId}`,
      description: notes || "Incident resolved manually",
    });
  }

  /**
   * Get incidents for a user with optional status filter
   */
  async getIncidents(
    userId: number,
    status?: "open" | "investigating" | "resolved"
  ): Promise<Incident[]> {
    const db = await getDb();
    if (!db) return [];

    // Get user's hosts
    const hosts = await db
      .select({ id: infrastructureHosts.id })
      .from(infrastructureHosts)
      .where(eq(infrastructureHosts.userId, userId));

    const hostIds = hosts.map(h => h.id);
    if (hostIds.length === 0) return [];

    let incidentRows;
    if (status) {
      incidentRows = await db
        .select()
        .from(incidents)
        .where(eq(incidents.status, status));
    } else {
      incidentRows = await db.select().from(incidents);
    }

    return incidentRows
      .filter(i => hostIds.includes(i.hostId))
      .map(i => ({
        id: i.id,
        hostId: i.hostId,
        alertRuleId: i.alertRuleId || undefined,
        title: i.title,
        description: i.description || undefined,
        severity: i.severity as Incident["severity"],
        status: i.status as Incident["status"],
        metricName: i.metricName || undefined,
        metricValue: i.metricValue
          ? parseFloat(String(i.metricValue))
          : undefined,
        thresholdValue: i.thresholdValue
          ? parseFloat(String(i.thresholdValue))
          : undefined,
        detectedAt: i.detectedAt,
        acknowledgedAt: i.acknowledgedAt || undefined,
        resolvedAt: i.resolvedAt || undefined,
        resolvedBy: i.resolvedBy || undefined,
        resolutionNotes: i.resolutionNotes || undefined,
      }));
  }

  /**
   * Get alert rules for a user
   */
  async getAlertRules(
    userId: number
  ): Promise<Array<typeof alertRules.$inferSelect>> {
    const db = await getDb();
    if (!db) return [];

    return db.select().from(alertRules).where(eq(alertRules.userId, userId));
  }

  /**
   * Create a new alert rule
   */
  async createAlertRule(
    userId: number,
    input: {
      hostId: number;
      name: string;
      metric: string;
      operator: "gt" | "lt" | "eq" | "gte" | "lte";
      threshold: number;
      severity: "info" | "warning" | "critical";
      autoRemediate?: boolean;
      remediationCommand?: string;
    }
  ): Promise<typeof alertRules.$inferSelect> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const [inserted] = await db
      .insert(alertRules)
      .values({
        userId,
        hostId: input.hostId,
        name: input.name,
        metric: input.metric,
        operator: input.operator,
        threshold: String(input.threshold),
        severity: input.severity,
        autoRemediate: input.autoRemediate ? 1 : 0,
        isEnabled: 1,
      })
      .$returningId();

    const [result] = await db
      .select()
      .from(alertRules)
      .where(eq(alertRules.id, inserted.id))
      .limit(1);

    return result;
  }

  /**
   * Get all open incidents for a user
   */
  async getOpenIncidents(userId: number): Promise<Incident[]> {
    const db = await getDb();
    if (!db) return [];

    // Get user's hosts
    const hosts = await db
      .select({ id: infrastructureHosts.id })
      .from(infrastructureHosts)
      .where(eq(infrastructureHosts.userId, userId));

    const hostIds = hosts.map(h => h.id);
    if (hostIds.length === 0) return [];

    const openIncidents = await db
      .select()
      .from(incidents)
      .where(eq(incidents.status, "open"));

    return openIncidents
      .filter(i => hostIds.includes(i.hostId))
      .map(i => ({
        id: i.id,
        hostId: i.hostId,
        alertRuleId: i.alertRuleId || undefined,
        title: i.title,
        description: i.description || undefined,
        severity: i.severity as Incident["severity"],
        status: i.status as Incident["status"],
        metricName: i.metricName || undefined,
        metricValue: i.metricValue
          ? parseFloat(String(i.metricValue))
          : undefined,
        thresholdValue: i.thresholdValue
          ? parseFloat(String(i.thresholdValue))
          : undefined,
        detectedAt: i.detectedAt,
        acknowledgedAt: i.acknowledgedAt || undefined,
        resolvedAt: i.resolvedAt || undefined,
        resolvedBy: i.resolvedBy || undefined,
        resolutionNotes: i.resolutionNotes || undefined,
      }));
  }
}

// Singleton instance
export const alertEngine = new AlertEngine();
