import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { logger } from './logger.js';

const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'alfie-backend';
const tracer = trace.getTracer(SERVICE_NAME);

export function startSpan(name, options = {}) {
  const spanOptions = {
    kind: options.kind || SpanKind.INTERNAL,
    attributes: options.attributes || {},
  };
  
  const span = tracer.startSpan(name, spanOptions);
  
  if (options.attributes) {
    Object.entries(options.attributes).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        span.setAttribute(key, value);
      }
    });
  }
  
  return span;
}

export function withSpan(name, fn, options = {}) {
  const span = startSpan(name, options);
  const ctx = trace.setSpan(context.active(), span);
  
  return context.with(ctx, async () => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  });
}

export function withSpanSync(name, fn, options = {}) {
  const span = startSpan(name, options);
  const ctx = trace.setSpan(context.active(), span);
  
  return context.with(ctx, () => {
    try {
      const result = fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  });
}

export function getCurrentSpan() {
  return trace.getSpan(context.active());
}

export function addSpanAttribute(key, value) {
  const span = getCurrentSpan();
  if (span && value !== undefined && value !== null) {
    span.setAttribute(key, value);
  }
}

export function addSpanAttributes(attributes) {
  const span = getCurrentSpan();
  if (span) {
    Object.entries(attributes).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        span.setAttribute(key, value);
      }
    });
  }
}

export function addSpanEvent(name, attributes = {}) {
  const span = getCurrentSpan();
  if (span) {
    span.addEvent(name, attributes);
    logger.debug({ event: 'span.event', spanEvent: name, ...attributes }, `Span event: ${name}`);
  }
}

export function setSpanError(error) {
  const span = getCurrentSpan();
  if (span) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
    span.recordException(error);
  }
}

export function setSpanOk() {
  const span = getCurrentSpan();
  if (span) {
    span.setStatus({ code: SpanStatusCode.OK });
  }
}

export const SpanAttributes = {
  HTTP_METHOD: 'http.method',
  HTTP_URL: 'http.url',
  HTTP_STATUS_CODE: 'http.status_code',
  HTTP_REQUEST_ID: 'http.request_id',
  HTTP_USER_AGENT: 'http.user_agent',
  
  DB_SYSTEM: 'db.system',
  DB_OPERATION: 'db.operation',
  DB_STATEMENT: 'db.statement',
  
  USER_ID: 'user.id',
  SESSION_ID: 'session.id',
  
  GATEWAY_ENDPOINT: 'gateway.endpoint',
  GATEWAY_METHOD: 'gateway.method',
  
  SEARCH_QUERY: 'search.query',
  SEARCH_TYPE: 'search.type',
  SEARCH_RESULTS_COUNT: 'search.results_count',
  
  FILE_PATH: 'file.path',
  FILE_OPERATION: 'file.operation',
  FILE_SIZE: 'file.size',
  
  WS_MESSAGE_TYPE: 'ws.message_type',
  WS_MESSAGE_SIZE: 'ws.message_size',
  
  ERROR_TYPE: 'error.type',
  ERROR_MESSAGE: 'error.message',
  ERROR_STACK: 'error.stack',
};

export const EventNames = {
  REQUEST_STARTED: 'request.started',
  REQUEST_COMPLETED: 'request.completed',
  REQUEST_FAILED: 'request.failed',
  
  GATEWAY_CALL_STARTED: 'gateway.call.started',
  GATEWAY_CALL_COMPLETED: 'gateway.call.completed',
  GATEWAY_CALL_FAILED: 'gateway.call.failed',
  
  SEARCH_STARTED: 'search.started',
  SEARCH_COMPLETED: 'search.completed',
  SEARCH_FAILED: 'search.failed',
  
  FILE_OPERATION_STARTED: 'file.operation.started',
  FILE_OPERATION_COMPLETED: 'file.operation.completed',
  FILE_OPERATION_FAILED: 'file.operation.failed',
  
  SESSION_CREATED: 'session.created',
  SESSION_DELETED: 'session.deleted',
  
  WS_MESSAGE_RECEIVED: 'ws.message.received',
  WS_MESSAGE_SENT: 'ws.message.sent',
  
  CACHE_HIT: 'cache.hit',
  CACHE_MISS: 'cache.miss',
  
  RATE_LIMIT_HIT: 'rate_limit.hit',
  AUTH_SUCCESS: 'auth.success',
  AUTH_FAILURE: 'auth.failure',
};

export function traceGatewayCall(endpoint, method = 'POST') {
  return (target, propertyKey, descriptor) => {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args) {
      return withSpan(`gateway.${endpoint}`, async (span) => {
        span.setAttribute(SpanAttributes.GATEWAY_ENDPOINT, endpoint);
        span.setAttribute(SpanAttributes.GATEWAY_METHOD, method);
        addSpanEvent(EventNames.GATEWAY_CALL_STARTED, { endpoint, method });
        
        try {
          const result = await originalMethod.apply(this, args);
          addSpanEvent(EventNames.GATEWAY_CALL_COMPLETED, { endpoint });
          return result;
        } catch (error) {
          addSpanEvent(EventNames.GATEWAY_CALL_FAILED, { 
            endpoint, 
            error: error.message 
          });
          throw error;
        }
      }, { kind: SpanKind.CLIENT });
    };
    
    return descriptor;
  };
}

export function traceSearch(searchType) {
  return (target, propertyKey, descriptor) => {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args) {
      const query = args[0];
      
      return withSpan(`search.${searchType}`, async (span) => {
        span.setAttribute(SpanAttributes.SEARCH_TYPE, searchType);
        if (typeof query === 'string') {
          span.setAttribute(SpanAttributes.SEARCH_QUERY, query.substring(0, 100));
        }
        addSpanEvent(EventNames.SEARCH_STARTED, { type: searchType });
        
        try {
          const result = await originalMethod.apply(this, args);
          const resultsCount = Array.isArray(result) ? result.length : 
            (result?.results?.length || result?.count || 0);
          span.setAttribute(SpanAttributes.SEARCH_RESULTS_COUNT, resultsCount);
          addSpanEvent(EventNames.SEARCH_COMPLETED, { 
            type: searchType, 
            resultsCount 
          });
          return result;
        } catch (error) {
          addSpanEvent(EventNames.SEARCH_FAILED, { 
            type: searchType, 
            error: error.message 
          });
          throw error;
        }
      });
    };
    
    return descriptor;
  };
}

export function traceFileOperation(operation) {
  return (target, propertyKey, descriptor) => {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args) {
      const filePath = args[0];
      
      return withSpan(`file.${operation}`, async (span) => {
        span.setAttribute(SpanAttributes.FILE_OPERATION, operation);
        if (typeof filePath === 'string') {
          span.setAttribute(SpanAttributes.FILE_PATH, filePath);
        }
        addSpanEvent(EventNames.FILE_OPERATION_STARTED, { operation, path: filePath });
        
        try {
          const result = await originalMethod.apply(this, args);
          addSpanEvent(EventNames.FILE_OPERATION_COMPLETED, { operation, path: filePath });
          return result;
        } catch (error) {
          addSpanEvent(EventNames.FILE_OPERATION_FAILED, { 
            operation, 
            path: filePath,
            error: error.message 
          });
          throw error;
        }
      });
    };
    
    return descriptor;
  };
}

export function createSpanContext() {
  const span = getCurrentSpan();
  if (!span) return null;
  
  const spanContext = span.spanContext();
  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
    traceFlags: spanContext.traceFlags,
  };
}

export function injectTraceHeaders(headers = {}) {
  const spanContext = createSpanContext();
  if (spanContext) {
    headers['x-trace-id'] = spanContext.traceId;
    headers['x-span-id'] = spanContext.spanId;
  }
  return headers;
}

export { trace, context, SpanStatusCode, SpanKind };
export default {
  startSpan,
  withSpan,
  withSpanSync,
  getCurrentSpan,
  addSpanAttribute,
  addSpanAttributes,
  addSpanEvent,
  setSpanError,
  setSpanOk,
  SpanAttributes,
  EventNames,
  traceGatewayCall,
  traceSearch,
  traceFileOperation,
  createSpanContext,
  injectTraceHeaders,
  trace,
  context,
  SpanStatusCode,
  SpanKind,
};
