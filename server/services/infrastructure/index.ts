/**
 * Infrastructure Monitoring & Self-Healing System
 *
 * Provides:
 * - Health metrics collection from remote hosts via SSH
 * - Alert rule evaluation and incident creation
 * - Auto-remediation of common issues
 * - Owner notifications for critical alerts
 */

export * from "./types";
export { healthCollector, HealthCollector } from "./collector";
export { alertEngine, AlertEngine } from "./alertEngine";
