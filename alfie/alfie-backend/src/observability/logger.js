/**
 * Structured Logging with Pino
 * Production-grade logging with correlation, formatting, and levels
 */

import pino from 'pino';
import { trace, context } from '@opentelemetry/api';

// Configuration from environment
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_FORMAT = process.env.LOG_FORMAT || (process.env.NODE_ENV === 'production' ? 'json' : 'pretty');
const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'alfie-backend';

// Custom serializers for consistent formatting
const serializers = {
  req: (req) => ({
    id: req.id,
    method: req.method,
    url: req.url,
    path: req.path || req.url?.split('?')[0],
    query: req.query,
    headers: {
      host: req.headers?.host,
      'user-agent': req.headers?.['user-agent'],
      'content-type': req.headers?.['content-type'],
      'content-length': req.headers?.['content-length'],
      'x-request-id': req.headers?.['x-request-id'],
      'x-forwarded-for': req.headers?.['x-forwarded-for'],
    },
    remoteAddress: req.socket?.remoteAddress || req.ip,
    remotePort: req.socket?.remotePort,
  }),
  res: (res) => ({
    statusCode: res.statusCode,
    headers: {
      'content-type': res.getHeader?.('content-type'),
      'content-length': res.getHeader?.('content-length'),
    },
  }),
  err: pino.stdSerializers.err,
};

// Determine transport based on format
const transport = LOG_FORMAT === 'pretty'
  ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
        messageFormat: '{msg}',
        singleLine: false,
      },
    }
  : undefined;

// Create base logger
const baseLogger = pino({
  name: SERVICE_NAME,
  level: LOG_LEVEL,
  serializers,
  transport,
  base: {
    service: SERVICE_NAME,
    version: process.env.OTEL_SERVICE_VERSION || '1.0.0',
    env: process.env.NODE_ENV || 'development',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
    bindings: (bindings) => ({
      pid: bindings.pid,
      hostname: bindings.hostname,
    }),
  },
  // Custom log methods
  customLevels: {
    audit: 35, // Between info and warn
  },
  hooks: {
    // Add OpenTelemetry trace context to logs
    logMethod(inputArgs, method, level) {
      const span = trace.getSpan(context.active());
      if (span) {
        const spanContext = span.spanContext();
        if (inputArgs[0] && typeof inputArgs[0] === 'object') {
          inputArgs[0].traceId = spanContext.traceId;
          inputArgs[0].spanId = spanContext.spanId;
          inputArgs[0].traceFlags = spanContext.traceFlags;
        } else {
          inputArgs.unshift({
            traceId: spanContext.traceId,
            spanId: spanContext.spanId,
            traceFlags: spanContext.traceFlags,
          });
        }
      }
      return method.apply(this, inputArgs);
    },
  },
});

/**
 * Create a child logger with additional context
 * @param {Object} bindings - Additional context bindings
 * @returns {pino.Logger} Child logger instance
 */
export function createLogger(bindings = {}) {
  return baseLogger.child(bindings);
}

/**
 * Create a request-scoped logger with correlation ID
 * @param {string} requestId - Request correlation ID
 * @param {Object} additionalBindings - Additional context
 * @returns {pino.Logger} Request-scoped logger
 */
export function createRequestLogger(requestId, additionalBindings = {}) {
  return baseLogger.child({
    requestId,
    ...additionalBindings,
  });
}

/**
 * Log levels enum for consistency
 */
export const LogLevel = {
  FATAL: 'fatal',
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
  TRACE: 'trace',
  AUDIT: 'audit',
};

/**
 * Structured event types for consistent logging
 */
export const EventType = {
  // HTTP events
  HTTP_REQUEST_START: 'http.request.start',
  HTTP_REQUEST_END: 'http.request.end',
  HTTP_ERROR: 'http.error',
  
  // WebSocket events
  WS_CONNECTION_OPEN: 'ws.connection.open',
  WS_CONNECTION_CLOSE: 'ws.connection.close',
  WS_MESSAGE_RECEIVED: 'ws.message.received',
  WS_MESSAGE_SENT: 'ws.message.sent',
  WS_ERROR: 'ws.error',
  
  // Gateway events
  GATEWAY_REQUEST: 'gateway.request',
  GATEWAY_RESPONSE: 'gateway.response',
  GATEWAY_ERROR: 'gateway.error',
  GATEWAY_CONNECTED: 'gateway.connected',
  GATEWAY_DISCONNECTED: 'gateway.disconnected',
  
  // Session events
  SESSION_CREATED: 'session.created',
  SESSION_DELETED: 'session.deleted',
  SESSION_ERROR: 'session.error',
  
  // File events
  FILE_READ: 'file.read',
  FILE_WRITE: 'file.write',
  FILE_DELETE: 'file.delete',
  FILE_ERROR: 'file.error',
  
  // Search events
  SEARCH_QUERY: 'search.query',
  SEARCH_RESULT: 'search.result',
  SEARCH_ERROR: 'search.error',
  
  // System events
  SYSTEM_STARTUP: 'system.startup',
  SYSTEM_SHUTDOWN: 'system.shutdown',
  SYSTEM_ERROR: 'system.error',
  HEALTH_CHECK: 'health.check',
  
  // Security events
  AUTH_SUCCESS: 'auth.success',
  AUTH_FAILURE: 'auth.failure',
  RATE_LIMIT_HIT: 'rate_limit.hit',
};

/**
 * Log a structured event
 * @param {string} eventType - Event type from EventType enum
 * @param {Object} data - Event data
 * @param {string} level - Log level (default: 'info')
 */
export function logEvent(eventType, data = {}, level = 'info') {
  const logData = {
    event: eventType,
    timestamp: new Date().toISOString(),
    ...data,
  };
  
  baseLogger[level](logData, `[${eventType}]`);
}

/**
 * Log an error with stack trace and context
 * @param {Error} error - Error object
 * @param {Object} context - Additional context
 * @param {string} eventType - Optional event type
 */
export function logError(error, context = {}, eventType = EventType.SYSTEM_ERROR) {
  baseLogger.error(
    {
      event: eventType,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code,
        ...error,
      },
      ...context,
    },
    `[${eventType}] ${error.message}`
  );
}

/**
 * Create audit log entry (for compliance/security tracking)
 * @param {string} action - Action performed
 * @param {Object} details - Action details
 */
export function audit(action, details = {}) {
  baseLogger.info(
    {
      event: 'audit',
      action,
      timestamp: new Date().toISOString(),
      ...details,
    },
    `[AUDIT] ${action}`
  );
}

/**
 * Log performance metric
 * @param {string} operation - Operation name
 * @param {number} durationMs - Duration in milliseconds
 * @param {Object} metadata - Additional metadata
 */
export function logPerformance(operation, durationMs, metadata = {}) {
  const level = durationMs > 5000 ? 'warn' : 'info';
  baseLogger[level](
    {
      event: 'performance',
      operation,
      durationMs,
      ...metadata,
    },
    `[PERF] ${operation}: ${durationMs}ms`
  );
}

// Export the base logger as default
export const logger = baseLogger;
export default logger;
