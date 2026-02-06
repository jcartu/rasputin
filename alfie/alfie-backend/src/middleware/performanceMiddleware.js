import { recordRequest } from '../services/performanceMonitor.js';
import { log } from '../services/logger.js';

export function performanceMiddleware(req, res, next) {
  const startTime = process.hrtime.bigint();
  const startTimestamp = Date.now();

  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const durationNs = Number(endTime - startTime);
    const durationMs = durationNs / 1_000_000;

    const route = req.route?.path || req.path || 'unknown';
    const method = req.method;
    const statusCode = res.statusCode;

    recordRequest(method, route, statusCode, durationMs);

    const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    const logData = {
      method,
      path: req.path,
      route,
      statusCode,
      duration: `${durationMs.toFixed(2)}ms`,
      contentLength: res.get('content-length') || 0,
      userAgent: req.get('user-agent')?.substring(0, 100),
      ip: req.ip || req.connection?.remoteAddress,
      timestamp: new Date(startTimestamp).toISOString(),
    };

    if (durationMs > 5000) {
      log.warn('Slow request detected', { ...logData, alert: 'slow_response' });
    } else {
      log[logLevel]('Request completed', logData);
    }
  });

  next();
}

export default { performanceMiddleware };
