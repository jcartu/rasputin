import { v4 as uuidv4 } from 'uuid';
import onFinished from 'on-finished';
import { logger, createRequestLogger, logEvent, EventType } from '../observability/logger.js';
import { 
  httpRequestsTotal, 
  httpRequestDuration, 
  httpActiveRequests,
  httpRequestSize,
  httpResponseSize,
  recordHttpRequest,
  recordError 
} from '../observability/metrics.js';
import { 
  addBreadcrumb, 
  captureException 
} from '../observability/sentry.js';
import { 
  startSpan, 
  addSpanAttribute, 
  addSpanEvent, 
  setSpanError,
  SpanAttributes,
  EventNames 
} from '../observability/spans.js';
import { SpanKind, trace, context } from '@opentelemetry/api';

const SLOW_REQUEST_THRESHOLD_MS = parseInt(process.env.SLOW_REQUEST_THRESHOLD_MS || '5000', 10);
const EXCLUDE_PATHS = ['/health', '/ready', '/live', '/metrics', '/favicon.ico'];

function getRoutePattern(req) {
  if (req.route?.path) {
    return req.baseUrl + req.route.path;
  }
  return req.path || req.url?.split('?')[0] || 'unknown';
}

function getRequestSize(req) {
  const contentLength = req.headers['content-length'];
  if (contentLength) {
    return parseInt(contentLength, 10);
  }
  if (req.body) {
    return JSON.stringify(req.body).length;
  }
  return 0;
}

function shouldExclude(path) {
  return EXCLUDE_PATHS.some(excludePath => path.startsWith(excludePath));
}

export function requestIdMiddleware() {
  return (req, res, next) => {
    req.id = req.headers['x-request-id'] || uuidv4();
    res.setHeader('x-request-id', req.id);
    next();
  };
}

export function requestLoggingMiddleware() {
  return (req, res, next) => {
    if (shouldExclude(req.path)) {
      return next();
    }
    
    const startTime = process.hrtime.bigint();
    const requestLogger = createRequestLogger(req.id, {
      method: req.method,
      path: req.path,
      query: req.query,
    });
    
    req.log = requestLogger;
    
    requestLogger.info({ 
      event: EventType.HTTP_REQUEST_START,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.socket?.remoteAddress,
    });
    
    onFinished(res, () => {
      const duration = Number(process.hrtime.bigint() - startTime) / 1e6;
      const route = getRoutePattern(req);
      
      const logData = {
        event: EventType.HTTP_REQUEST_END,
        statusCode: res.statusCode,
        duration: Math.round(duration * 100) / 100,
        route,
      };
      
      if (duration > SLOW_REQUEST_THRESHOLD_MS) {
        requestLogger.warn(logData, 'Slow request detected');
      } else if (res.statusCode >= 500) {
        requestLogger.error(logData);
      } else if (res.statusCode >= 400) {
        requestLogger.warn(logData);
      } else {
        requestLogger.info(logData);
      }
    });
    
    next();
  };
}

export function metricsMiddleware() {
  return (req, res, next) => {
    if (shouldExclude(req.path)) {
      return next();
    }
    
    const startTime = process.hrtime.bigint();
    const method = req.method;
    
    httpActiveRequests.inc({ method });
    
    onFinished(res, () => {
      const duration = Number(process.hrtime.bigint() - startTime) / 1e6;
      const route = getRoutePattern(req);
      const statusCode = res.statusCode;
      const requestSize = getRequestSize(req);
      const responseSize = parseInt(res.getHeader('content-length') || '0', 10);
      
      httpActiveRequests.dec({ method });
      
      recordHttpRequest({
        method,
        route,
        statusCode,
        duration,
        requestSize,
        responseSize,
      });
      
      if (statusCode >= 500) {
        recordError({
          type: 'http_error',
          code: statusCode,
          source: route,
        });
      }
    });
    
    next();
  };
}

export function tracingMiddleware() {
  return (req, res, next) => {
    if (shouldExclude(req.path)) {
      return next();
    }
    
    const span = startSpan(`HTTP ${req.method} ${req.path}`, {
      kind: SpanKind.SERVER,
      attributes: {
        [SpanAttributes.HTTP_METHOD]: req.method,
        [SpanAttributes.HTTP_URL]: req.url,
        [SpanAttributes.HTTP_REQUEST_ID]: req.id,
        [SpanAttributes.HTTP_USER_AGENT]: req.headers['user-agent'],
      },
    });
    
    req.span = span;
    
    addSpanEvent(EventNames.REQUEST_STARTED, {
      method: req.method,
      path: req.path,
    });
    
    onFinished(res, () => {
      addSpanAttribute(SpanAttributes.HTTP_STATUS_CODE, res.statusCode);
      
      if (res.statusCode >= 400) {
        addSpanEvent(EventNames.REQUEST_FAILED, {
          statusCode: res.statusCode,
        });
      } else {
        addSpanEvent(EventNames.REQUEST_COMPLETED, {
          statusCode: res.statusCode,
        });
      }
      
      span.end();
    });
    
    const ctx = trace.setSpan(context.active(), span);
    context.with(ctx, () => next());
  };
}

export function sentryBreadcrumbMiddleware() {
  return (req, res, next) => {
    if (shouldExclude(req.path)) {
      return next();
    }
    
    addBreadcrumb({
      category: 'http',
      message: `${req.method} ${req.path}`,
      level: 'info',
      data: {
        method: req.method,
        url: req.url,
        query: req.query,
        requestId: req.id,
      },
    });
    
    next();
  };
}

export function errorTrackingMiddleware() {
  return (err, req, res, next) => {
    const requestLogger = req.log || logger;
    
    requestLogger.error({
      event: EventType.HTTP_ERROR,
      error: {
        name: err.name,
        message: err.message,
        stack: err.stack,
        code: err.code,
      },
      statusCode: err.statusCode || 500,
    });
    
    if (req.span) {
      setSpanError(err);
    }
    
    recordError({
      type: err.name || 'Error',
      code: err.statusCode || err.code || 500,
      source: getRoutePattern(req),
    });
    
    captureException(err, {
      requestId: req.id,
      method: req.method,
      path: req.path,
      query: req.query,
      body: req.body,
    });
    
    next(err);
  };
}

export function observabilityMiddleware() {
  return [
    requestIdMiddleware(),
    requestLoggingMiddleware(),
    metricsMiddleware(),
    tracingMiddleware(),
    sentryBreadcrumbMiddleware(),
  ];
}

export default {
  requestIdMiddleware,
  requestLoggingMiddleware,
  metricsMiddleware,
  tracingMiddleware,
  sentryBreadcrumbMiddleware,
  errorTrackingMiddleware,
  observabilityMiddleware,
};
