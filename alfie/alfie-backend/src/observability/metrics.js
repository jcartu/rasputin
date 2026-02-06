/**
 * Prometheus Metrics Collection
 * Production-grade metrics with custom collectors and histograms
 */

import client from 'prom-client';
import os from 'os';
import { logger } from './logger.js';

// Configuration
const METRICS_PREFIX = process.env.METRICS_PREFIX || 'alfie_';
const METRICS_ENABLED = process.env.METRICS_ENABLED !== 'false';
const DEFAULT_LABELS = {
  service: process.env.OTEL_SERVICE_NAME || 'alfie-backend',
  version: process.env.OTEL_SERVICE_VERSION || '1.0.0',
  env: process.env.NODE_ENV || 'development',
};

// Create registry
const register = new client.Registry();

// Add default labels
register.setDefaultLabels(DEFAULT_LABELS);

// Collect default Node.js metrics
if (METRICS_ENABLED) {
  client.collectDefaultMetrics({
    register,
    prefix: METRICS_PREFIX,
    gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
  });
}

// ============================================================================
// HTTP Metrics
// ============================================================================

export const httpRequestsTotal = new client.Counter({
  name: `${METRICS_PREFIX}http_requests_total`,
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestDuration = new client.Histogram({
  name: `${METRICS_PREFIX}http_request_duration_seconds`,
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

export const httpRequestSize = new client.Histogram({
  name: `${METRICS_PREFIX}http_request_size_bytes`,
  help: 'HTTP request body size in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 1000, 10000, 100000, 1000000, 10000000],
  registers: [register],
});

export const httpResponseSize = new client.Histogram({
  name: `${METRICS_PREFIX}http_response_size_bytes`,
  help: 'HTTP response body size in bytes',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [100, 1000, 10000, 100000, 1000000, 10000000],
  registers: [register],
});

export const httpActiveRequests = new client.Gauge({
  name: `${METRICS_PREFIX}http_active_requests`,
  help: 'Number of active HTTP requests',
  labelNames: ['method'],
  registers: [register],
});

// ============================================================================
// WebSocket Metrics
// ============================================================================

export const wsConnectionsTotal = new client.Counter({
  name: `${METRICS_PREFIX}ws_connections_total`,
  help: 'Total number of WebSocket connections',
  labelNames: ['status'],
  registers: [register],
});

export const wsActiveConnections = new client.Gauge({
  name: `${METRICS_PREFIX}ws_active_connections`,
  help: 'Number of active WebSocket connections',
  registers: [register],
});

export const wsMessagesTotal = new client.Counter({
  name: `${METRICS_PREFIX}ws_messages_total`,
  help: 'Total number of WebSocket messages',
  labelNames: ['direction', 'type'],
  registers: [register],
});

export const wsMessageSize = new client.Histogram({
  name: `${METRICS_PREFIX}ws_message_size_bytes`,
  help: 'WebSocket message size in bytes',
  labelNames: ['direction', 'type'],
  buckets: [100, 1000, 10000, 100000, 1000000],
  registers: [register],
});

export const wsLatency = new client.Histogram({
  name: `${METRICS_PREFIX}ws_latency_seconds`,
  help: 'WebSocket round-trip latency in seconds',
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [register],
});

// ============================================================================
// Gateway Metrics
// ============================================================================

export const gatewayRequestsTotal = new client.Counter({
  name: `${METRICS_PREFIX}gateway_requests_total`,
  help: 'Total number of gateway requests',
  labelNames: ['method', 'endpoint', 'status'],
  registers: [register],
});

export const gatewayRequestDuration = new client.Histogram({
  name: `${METRICS_PREFIX}gateway_request_duration_seconds`,
  help: 'Gateway request duration in seconds',
  labelNames: ['method', 'endpoint'],
  buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60],
  registers: [register],
});

export const gatewayStatus = new client.Gauge({
  name: `${METRICS_PREFIX}gateway_status`,
  help: 'Gateway connection status (1=connected, 0=disconnected)',
  registers: [register],
});

// ============================================================================
// Session Metrics
// ============================================================================

export const sessionsTotal = new client.Counter({
  name: `${METRICS_PREFIX}sessions_total`,
  help: 'Total number of sessions created',
  labelNames: ['status'],
  registers: [register],
});

export const activeSessions = new client.Gauge({
  name: `${METRICS_PREFIX}active_sessions`,
  help: 'Number of active sessions',
  registers: [register],
});

export const sessionDuration = new client.Histogram({
  name: `${METRICS_PREFIX}session_duration_seconds`,
  help: 'Session duration in seconds',
  buckets: [60, 300, 600, 1800, 3600, 7200, 14400, 28800],
  registers: [register],
});

// ============================================================================
// Search Metrics
// ============================================================================

export const searchRequestsTotal = new client.Counter({
  name: `${METRICS_PREFIX}search_requests_total`,
  help: 'Total number of search requests',
  labelNames: ['type', 'status'],
  registers: [register],
});

export const searchDuration = new client.Histogram({
  name: `${METRICS_PREFIX}search_duration_seconds`,
  help: 'Search request duration in seconds',
  labelNames: ['type'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

export const searchResultsCount = new client.Histogram({
  name: `${METRICS_PREFIX}search_results_count`,
  help: 'Number of search results returned',
  labelNames: ['type'],
  buckets: [0, 1, 5, 10, 25, 50, 100, 250, 500],
  registers: [register],
});

// ============================================================================
// File Operations Metrics
// ============================================================================

export const fileOperationsTotal = new client.Counter({
  name: `${METRICS_PREFIX}file_operations_total`,
  help: 'Total number of file operations',
  labelNames: ['operation', 'status'],
  registers: [register],
});

export const fileOperationDuration = new client.Histogram({
  name: `${METRICS_PREFIX}file_operation_duration_seconds`,
  help: 'File operation duration in seconds',
  labelNames: ['operation'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [register],
});

export const fileSize = new client.Histogram({
  name: `${METRICS_PREFIX}file_size_bytes`,
  help: 'File size in bytes',
  labelNames: ['operation'],
  buckets: [1024, 10240, 102400, 1048576, 10485760, 104857600],
  registers: [register],
});

// ============================================================================
// Error Metrics
// ============================================================================

export const errorsTotal = new client.Counter({
  name: `${METRICS_PREFIX}errors_total`,
  help: 'Total number of errors',
  labelNames: ['type', 'code', 'source'],
  registers: [register],
});

// ============================================================================
// Business Metrics
// ============================================================================

export const chatMessagesTotal = new client.Counter({
  name: `${METRICS_PREFIX}chat_messages_total`,
  help: 'Total number of chat messages',
  labelNames: ['direction', 'status'],
  registers: [register],
});

export const chatMessageDuration = new client.Histogram({
  name: `${METRICS_PREFIX}chat_message_duration_seconds`,
  help: 'Chat message processing duration in seconds',
  buckets: [0.5, 1, 2.5, 5, 10, 30, 60, 120, 300],
  registers: [register],
});

export const memoryQueriesTotal = new client.Counter({
  name: `${METRICS_PREFIX}memory_queries_total`,
  help: 'Total number of memory/second brain queries',
  labelNames: ['status'],
  registers: [register],
});

// ============================================================================
// Custom Application Metrics
// ============================================================================

export const customGauge = new client.Gauge({
  name: `${METRICS_PREFIX}custom_gauge`,
  help: 'Custom gauge metric for application-specific measurements',
  labelNames: ['name', 'unit'],
  registers: [register],
});

export const customCounter = new client.Counter({
  name: `${METRICS_PREFIX}custom_counter`,
  help: 'Custom counter metric for application-specific counts',
  labelNames: ['name', 'type'],
  registers: [register],
});

export const customHistogram = new client.Histogram({
  name: `${METRICS_PREFIX}custom_histogram`,
  help: 'Custom histogram metric for application-specific distributions',
  labelNames: ['name', 'unit'],
  buckets: [0.1, 0.5, 1, 2.5, 5, 10, 25, 50, 100],
  registers: [register],
});

// ============================================================================
// System Metrics (Custom)
// ============================================================================

export const systemCpuUsage = new client.Gauge({
  name: `${METRICS_PREFIX}system_cpu_usage_percent`,
  help: 'System CPU usage percentage',
  labelNames: ['core'],
  registers: [register],
});

export const systemMemoryUsage = new client.Gauge({
  name: `${METRICS_PREFIX}system_memory_usage_bytes`,
  help: 'System memory usage in bytes',
  labelNames: ['type'],
  registers: [register],
});

export const systemLoadAverage = new client.Gauge({
  name: `${METRICS_PREFIX}system_load_average`,
  help: 'System load average',
  labelNames: ['period'],
  registers: [register],
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Record HTTP request metrics
 * @param {Object} params - Request parameters
 */
export function recordHttpRequest({ method, route, statusCode, duration, requestSize, responseSize }) {
  const labels = { method, route, status_code: String(statusCode) };
  
  httpRequestsTotal.inc(labels);
  httpRequestDuration.observe(labels, duration / 1000);
  
  if (requestSize) {
    httpRequestSize.observe({ method, route }, requestSize);
  }
  
  if (responseSize) {
    httpResponseSize.observe(labels, responseSize);
  }
}

/**
 * Record WebSocket metrics
 * @param {Object} params - WebSocket parameters
 */
export function recordWsMessage({ direction, type, size, latency }) {
  wsMessagesTotal.inc({ direction, type: type || 'unknown' });
  
  if (size) {
    wsMessageSize.observe({ direction, type: type || 'unknown' }, size);
  }
  
  if (latency !== undefined) {
    wsLatency.observe(latency / 1000);
  }
}

/**
 * Record gateway request metrics
 * @param {Object} params - Gateway request parameters
 */
export function recordGatewayRequest({ method, endpoint, status, duration }) {
  gatewayRequestsTotal.inc({ method, endpoint, status });
  
  if (duration !== undefined) {
    gatewayRequestDuration.observe({ method, endpoint }, duration / 1000);
  }
}

/**
 * Record search metrics
 * @param {Object} params - Search parameters
 */
export function recordSearch({ type, status, duration, resultsCount }) {
  searchRequestsTotal.inc({ type, status });
  
  if (duration !== undefined) {
    searchDuration.observe({ type }, duration / 1000);
  }
  
  if (resultsCount !== undefined) {
    searchResultsCount.observe({ type }, resultsCount);
  }
}

/**
 * Record file operation metrics
 * @param {Object} params - File operation parameters
 */
export function recordFileOperation({ operation, status, duration, size }) {
  fileOperationsTotal.inc({ operation, status });
  
  if (duration !== undefined) {
    fileOperationDuration.observe({ operation }, duration / 1000);
  }
  
  if (size !== undefined) {
    fileSize.observe({ operation }, size);
  }
}

/**
 * Record error
 * @param {Object} params - Error parameters
 */
export function recordError({ type, code, source }) {
  errorsTotal.inc({ type, code: String(code || 'unknown'), source });
}

/**
 * Update system metrics
 */
export function updateSystemMetrics() {
  // CPU usage per core
  const cpus = os.cpus();
  cpus.forEach((cpu, index) => {
    const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
    const idle = cpu.times.idle;
    const usage = ((total - idle) / total) * 100;
    systemCpuUsage.set({ core: String(index) }, usage);
  });
  
  // Memory
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  systemMemoryUsage.set({ type: 'total' }, totalMem);
  systemMemoryUsage.set({ type: 'free' }, freeMem);
  systemMemoryUsage.set({ type: 'used' }, totalMem - freeMem);
  
  // Load average
  const loadAvg = os.loadavg();
  systemLoadAverage.set({ period: '1m' }, loadAvg[0]);
  systemLoadAverage.set({ period: '5m' }, loadAvg[1]);
  systemLoadAverage.set({ period: '15m' }, loadAvg[2]);
}

/**
 * Set custom gauge metric
 * @param {string} name - Metric name
 * @param {number} value - Metric value
 * @param {string} unit - Unit of measurement
 */
export function setCustomGauge(name, value, unit = '') {
  customGauge.set({ name, unit }, value);
}

/**
 * Increment custom counter
 * @param {string} name - Metric name
 * @param {string} type - Counter type
 * @param {number} value - Increment value (default: 1)
 */
export function incCustomCounter(name, type = '', value = 1) {
  customCounter.inc({ name, type }, value);
}

/**
 * Observe custom histogram
 * @param {string} name - Metric name
 * @param {number} value - Observed value
 * @param {string} unit - Unit of measurement
 */
export function observeCustomHistogram(name, value, unit = '') {
  customHistogram.observe({ name, unit }, value);
}

/**
 * Get metrics in Prometheus format
 * @returns {Promise<string>} Prometheus-formatted metrics
 */
export async function getMetrics() {
  if (!METRICS_ENABLED) {
    return '# Metrics disabled\n';
  }
  
  // Update system metrics before returning
  updateSystemMetrics();
  
  return register.metrics();
}

/**
 * Get metrics as JSON
 * @returns {Promise<Object>} Metrics as JSON
 */
export async function getMetricsJson() {
  if (!METRICS_ENABLED) {
    return { disabled: true };
  }
  
  updateSystemMetrics();
  return register.getMetricsAsJSON();
}

/**
 * Get content type for Prometheus metrics
 * @returns {string} Content type
 */
export function getContentType() {
  return register.contentType;
}

/**
 * Clear all metrics (useful for testing)
 */
export function clearMetrics() {
  register.clear();
}

// Start system metrics update interval
if (METRICS_ENABLED) {
  const METRICS_UPDATE_INTERVAL = parseInt(process.env.METRICS_UPDATE_INTERVAL || '15000', 10);
  setInterval(updateSystemMetrics, METRICS_UPDATE_INTERVAL);
  
  logger.info(
    { event: 'metrics.initialized', prefix: METRICS_PREFIX, updateInterval: METRICS_UPDATE_INTERVAL },
    'Prometheus metrics initialized'
  );
}

export { register, client };
export default {
  register,
  client,
  getMetrics,
  getMetricsJson,
  getContentType,
  clearMetrics,
  // HTTP
  httpRequestsTotal,
  httpRequestDuration,
  httpRequestSize,
  httpResponseSize,
  httpActiveRequests,
  recordHttpRequest,
  // WebSocket
  wsConnectionsTotal,
  wsActiveConnections,
  wsMessagesTotal,
  wsMessageSize,
  wsLatency,
  recordWsMessage,
  // Gateway
  gatewayRequestsTotal,
  gatewayRequestDuration,
  gatewayStatus,
  recordGatewayRequest,
  // Sessions
  sessionsTotal,
  activeSessions,
  sessionDuration,
  // Search
  searchRequestsTotal,
  searchDuration,
  searchResultsCount,
  recordSearch,
  // Files
  fileOperationsTotal,
  fileOperationDuration,
  fileSize,
  recordFileOperation,
  // Errors
  errorsTotal,
  recordError,
  // Business
  chatMessagesTotal,
  chatMessageDuration,
  memoryQueriesTotal,
  // Custom
  customGauge,
  customCounter,
  customHistogram,
  setCustomGauge,
  incCustomCounter,
  observeCustomHistogram,
  // System
  systemCpuUsage,
  systemMemoryUsage,
  systemLoadAverage,
  updateSystemMetrics,
};
