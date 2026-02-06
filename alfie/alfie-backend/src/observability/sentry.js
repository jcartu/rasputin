/**
 * Sentry Error Tracking Integration
 * Production-grade error monitoring with profiling and performance
 */

import * as Sentry from '@sentry/node';
import { logger } from './logger.js';

// Try to load profiling integration, but don't fail if unavailable
let ProfilingIntegration = null;
try {
  const profilingModule = await import('@sentry/profiling-node');
  ProfilingIntegration = profilingModule.ProfilingIntegration;
} catch (e) {
  // Profiling not available (native binary compatibility issue)
}

// Configuration from environment
const SENTRY_DSN = process.env.SENTRY_DSN;
const SENTRY_ENABLED = SENTRY_DSN && process.env.SENTRY_ENABLED !== 'false';
const SENTRY_ENVIRONMENT = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development';
const SENTRY_RELEASE = process.env.SENTRY_RELEASE || process.env.npm_package_version || '1.0.0';
const SENTRY_SAMPLE_RATE = parseFloat(process.env.SENTRY_SAMPLE_RATE || '1.0');
const SENTRY_TRACES_SAMPLE_RATE = parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1');
const SENTRY_PROFILES_SAMPLE_RATE = parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1');
const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'alfie-backend';

/**
 * Initialize Sentry error tracking
 * @param {Object} options - Additional Sentry options
 */
export function initSentry(options = {}) {
  if (!SENTRY_ENABLED) {
    logger.info({ event: 'sentry.disabled' }, 'Sentry disabled (no DSN or SENTRY_ENABLED=false)');
    return;
  }

  try {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: SENTRY_ENVIRONMENT,
      release: `${SERVICE_NAME}@${SENTRY_RELEASE}`,
      serverName: process.env.HOSTNAME || SERVICE_NAME,
      
      // Performance monitoring
      tracesSampleRate: SENTRY_TRACES_SAMPLE_RATE,
      profilesSampleRate: SENTRY_PROFILES_SAMPLE_RATE,
      
      // Error sampling
      sampleRate: SENTRY_SAMPLE_RATE,
      
      integrations: [
        ...(ProfilingIntegration ? [new ProfilingIntegration()] : []),
        new Sentry.Integrations.Http({ tracing: true }),
        // Express integration
        new Sentry.Integrations.Express({ app: options.app }),
        // Additional integrations
        new Sentry.Integrations.OnUncaughtException(),
        new Sentry.Integrations.OnUnhandledRejection(),
        new Sentry.Integrations.ContextLines(),
        new Sentry.Integrations.LocalVariables({
          captureAllExceptions: true,
        }),
      ],
      
      // Before send hook for filtering/enriching errors
      beforeSend(event, hint) {
        // Filter out expected/handled errors
        const error = hint.originalException;
        
        // Don't report validation errors
        if (error?.statusCode === 400) {
          return null;
        }
        
        // Don't report auth errors
        if (error?.statusCode === 401 || error?.statusCode === 403) {
          return null;
        }
        
        // Don't report not found errors
        if (error?.statusCode === 404) {
          return null;
        }
        
        // Sanitize sensitive data
        if (event.request?.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
          delete event.request.headers['x-api-key'];
        }
        
        if (event.request?.data) {
          // Remove potentially sensitive fields
          const sanitizedData = { ...event.request.data };
          delete sanitizedData.password;
          delete sanitizedData.token;
          delete sanitizedData.apiKey;
          delete sanitizedData.secret;
          event.request.data = sanitizedData;
        }
        
        return event;
      },
      
      // Before breadcrumb hook for filtering
      beforeBreadcrumb(breadcrumb) {
        // Filter out noisy breadcrumbs
        if (breadcrumb.category === 'http' && breadcrumb.data?.url?.includes('/health')) {
          return null;
        }
        if (breadcrumb.category === 'http' && breadcrumb.data?.url?.includes('/metrics')) {
          return null;
        }
        return breadcrumb;
      },
      
      // Tags for filtering in Sentry UI
      initialScope: {
        tags: {
          service: SERVICE_NAME,
          nodeVersion: process.version,
        },
      },
      
      // Merge with custom options
      ...options,
    });

    logger.info(
      {
        event: 'sentry.initialized',
        environment: SENTRY_ENVIRONMENT,
        release: `${SERVICE_NAME}@${SENTRY_RELEASE}`,
        tracesSampleRate: SENTRY_TRACES_SAMPLE_RATE,
      },
      'Sentry initialized'
    );
  } catch (error) {
    logger.error({ event: 'sentry.init.error', error: error.message }, 'Failed to initialize Sentry');
  }
}

/**
 * Capture an exception with context
 * @param {Error} error - Error to capture
 * @param {Object} context - Additional context
 * @returns {string|null} Event ID if captured
 */
export function captureException(error, context = {}) {
  if (!SENTRY_ENABLED) {
    return null;
  }
  
  return Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Capture a message with level
 * @param {string} message - Message to capture
 * @param {string} level - Severity level
 * @param {Object} context - Additional context
 * @returns {string|null} Event ID if captured
 */
export function captureMessage(message, level = 'info', context = {}) {
  if (!SENTRY_ENABLED) {
    return null;
  }
  
  return Sentry.captureMessage(message, {
    level,
    extra: context,
  });
}

/**
 * Set user context for error tracking
 * @param {Object} user - User information
 */
export function setUser(user) {
  if (!SENTRY_ENABLED) {
    return;
  }
  
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.username,
    ip_address: user.ipAddress,
  });
}

/**
 * Clear user context
 */
export function clearUser() {
  if (!SENTRY_ENABLED) {
    return;
  }
  
  Sentry.setUser(null);
}

/**
 * Add breadcrumb for error context
 * @param {Object} breadcrumb - Breadcrumb data
 */
export function addBreadcrumb(breadcrumb) {
  if (!SENTRY_ENABLED) {
    return;
  }
  
  Sentry.addBreadcrumb({
    timestamp: Date.now() / 1000,
    ...breadcrumb,
  });
}

/**
 * Set custom tag
 * @param {string} key - Tag key
 * @param {string} value - Tag value
 */
export function setTag(key, value) {
  if (!SENTRY_ENABLED) {
    return;
  }
  
  Sentry.setTag(key, value);
}

/**
 * Set extra context data
 * @param {string} key - Context key
 * @param {*} value - Context value
 */
export function setExtra(key, value) {
  if (!SENTRY_ENABLED) {
    return;
  }
  
  Sentry.setExtra(key, value);
}

/**
 * Start a performance transaction
 * @param {string} name - Transaction name
 * @param {string} op - Operation type
 * @returns {Object|null} Transaction object
 */
export function startTransaction(name, op = 'task') {
  if (!SENTRY_ENABLED) {
    return null;
  }
  
  return Sentry.startTransaction({
    name,
    op,
  });
}

/**
 * Get Sentry request handler middleware
 * @returns {Function} Express middleware
 */
export function requestHandler() {
  if (!SENTRY_ENABLED) {
    return (req, res, next) => next();
  }
  
  return Sentry.Handlers.requestHandler({
    // Include request data in error reports
    request: ['headers', 'method', 'url', 'query_string'],
    // Include transaction for performance monitoring
    serverName: true,
    transaction: 'methodPath',
  });
}

/**
 * Get Sentry tracing handler middleware
 * @returns {Function} Express middleware
 */
export function tracingHandler() {
  if (!SENTRY_ENABLED) {
    return (req, res, next) => next();
  }
  
  return Sentry.Handlers.tracingHandler();
}

/**
 * Get Sentry error handler middleware
 * @returns {Function} Express error middleware
 */
export function errorHandler() {
  if (!SENTRY_ENABLED) {
    return (err, req, res, next) => next(err);
  }
  
  return Sentry.Handlers.errorHandler({
    shouldHandleError(error) {
      // Only report server errors
      return !error.statusCode || error.statusCode >= 500;
    },
  });
}

/**
 * Flush pending events before shutdown
 * @param {number} timeout - Timeout in milliseconds
 */
export async function flush(timeout = 2000) {
  if (!SENTRY_ENABLED) {
    return;
  }
  
  try {
    await Sentry.flush(timeout);
    logger.info({ event: 'sentry.flushed' }, 'Sentry events flushed');
  } catch (error) {
    logger.error({ event: 'sentry.flush.error', error: error.message }, 'Failed to flush Sentry');
  }
}

/**
 * Close Sentry client
 * @param {number} timeout - Timeout in milliseconds
 */
export async function close(timeout = 2000) {
  if (!SENTRY_ENABLED) {
    return;
  }
  
  try {
    await Sentry.close(timeout);
    logger.info({ event: 'sentry.closed' }, 'Sentry client closed');
  } catch (error) {
    logger.error({ event: 'sentry.close.error', error: error.message }, 'Failed to close Sentry');
  }
}

// Export Sentry for advanced usage
export { Sentry };
export default {
  initSentry,
  captureException,
  captureMessage,
  setUser,
  clearUser,
  addBreadcrumb,
  setTag,
  setExtra,
  startTransaction,
  requestHandler,
  tracingHandler,
  errorHandler,
  flush,
  close,
  Sentry,
};
