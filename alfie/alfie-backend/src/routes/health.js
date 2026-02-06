import { Router } from 'express';
import os from 'os';
import { getMetrics, getMetricsJson, getContentType, gatewayStatus } from '../observability/metrics.js';
import { logger } from '../observability/logger.js';

const router = Router();

const startTime = Date.now();
let isReady = false;
let isShuttingDown = false;

const healthChecks = {
  gateway: {
    check: async () => {
      try {
        const { getGatewayStatus } = await import('../services/openclawGateway.js');
        const status = await getGatewayStatus();
        gatewayStatus.set(status.connected ? 1 : 0);
        return {
          status: status.connected ? 'healthy' : 'degraded',
          latency: status.latency,
          error: status.error,
        };
      } catch (error) {
        gatewayStatus.set(0);
        return { status: 'unhealthy', error: error.message };
      }
    },
    critical: false,
  },
  memory: {
    check: async () => {
      const used = process.memoryUsage();
      const heapUsedPercent = (used.heapUsed / used.heapTotal) * 100;
      const threshold = parseFloat(process.env.MEMORY_THRESHOLD_PERCENT || '90');
      
      return {
        status: heapUsedPercent < threshold ? 'healthy' : 'degraded',
        heapUsed: used.heapUsed,
        heapTotal: used.heapTotal,
        heapUsedPercent: Math.round(heapUsedPercent * 100) / 100,
        rss: used.rss,
        external: used.external,
      };
    },
    critical: true,
  },
  eventLoop: {
    check: async () => {
      return new Promise((resolve) => {
        const start = process.hrtime.bigint();
        setImmediate(() => {
          const lag = Number(process.hrtime.bigint() - start) / 1e6;
          const threshold = parseFloat(process.env.EVENT_LOOP_LAG_THRESHOLD_MS || '100');
          resolve({
            status: lag < threshold ? 'healthy' : 'degraded',
            lag: Math.round(lag * 100) / 100,
            threshold,
          });
        });
      });
    },
    critical: true,
  },
};

async function runHealthChecks(includeNonCritical = true) {
  const results = {};
  let overallStatus = 'healthy';
  
  for (const [name, { check, critical }] of Object.entries(healthChecks)) {
    if (!includeNonCritical && !critical) continue;
    
    try {
      results[name] = await check();
      
      if (results[name].status === 'unhealthy' && critical) {
        overallStatus = 'unhealthy';
      } else if (results[name].status === 'degraded' && overallStatus === 'healthy') {
        overallStatus = 'degraded';
      }
    } catch (error) {
      results[name] = { status: 'unhealthy', error: error.message };
      if (critical) {
        overallStatus = 'unhealthy';
      }
    }
  }
  
  return { status: overallStatus, checks: results };
}

router.get('/health', async (req, res) => {
  try {
    const { status, checks } = await runHealthChecks(true);
    
    const response = {
      status,
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      version: process.env.OTEL_SERVICE_VERSION || '1.0.0',
      checks,
    };
    
    const statusCode = status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503;
    res.status(statusCode).json(response);
  } catch (error) {
    logger.error({ event: 'health.check.error', error: error.message });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

router.get('/health/detailed', async (req, res) => {
  try {
    const { status, checks } = await runHealthChecks(true);
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    const response = {
      status,
      timestamp: new Date().toISOString(),
      service: {
        name: process.env.OTEL_SERVICE_NAME || 'alfie-backend',
        version: process.env.OTEL_SERVICE_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
      },
      runtime: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
        uptime: Math.round(process.uptime()),
        startTime: new Date(startTime).toISOString(),
      },
      memory: {
        process: {
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
          rss: memoryUsage.rss,
          external: memoryUsage.external,
          arrayBuffers: memoryUsage.arrayBuffers,
        },
        system: {
          total: os.totalmem(),
          free: os.freemem(),
          used: os.totalmem() - os.freemem(),
        },
      },
      cpu: {
        usage: cpuUsage,
        loadAverage: os.loadavg(),
        cores: os.cpus().length,
      },
      checks,
    };
    
    const statusCode = status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503;
    res.status(statusCode).json(response);
  } catch (error) {
    logger.error({ event: 'health.detailed.error', error: error.message });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

router.get('/ready', async (req, res) => {
  if (isShuttingDown) {
    return res.status(503).json({
      ready: false,
      reason: 'shutting_down',
      timestamp: new Date().toISOString(),
    });
  }
  
  if (!isReady) {
    return res.status(503).json({
      ready: false,
      reason: 'not_initialized',
      timestamp: new Date().toISOString(),
    });
  }
  
  try {
    const { status, checks } = await runHealthChecks(false);
    
    if (status === 'unhealthy') {
      return res.status(503).json({
        ready: false,
        reason: 'critical_check_failed',
        timestamp: new Date().toISOString(),
        checks,
      });
    }
    
    res.status(200).json({
      ready: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ event: 'readiness.check.error', error: error.message });
    res.status(503).json({
      ready: false,
      reason: 'check_error',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

router.get('/live', (req, res) => {
  if (isShuttingDown) {
    return res.status(503).json({
      alive: false,
      reason: 'shutting_down',
      timestamp: new Date().toISOString(),
    });
  }
  
  res.status(200).json({
    alive: true,
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
  });
});

router.get('/metrics', async (req, res) => {
  try {
    const acceptHeader = req.headers.accept || '';
    
    if (acceptHeader.includes('application/json')) {
      const metrics = await getMetricsJson();
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify(metrics, null, 2));
    } else {
      const metrics = await getMetrics();
      res.setHeader('Content-Type', getContentType());
      res.send(metrics);
    }
  } catch (error) {
    logger.error({ event: 'metrics.error', error: error.message });
    res.status(500).json({ error: 'Failed to collect metrics' });
  }
});

router.get('/startup', (req, res) => {
  const startupDuration = Date.now() - startTime;
  const maxStartupTime = parseInt(process.env.MAX_STARTUP_TIME_MS || '30000', 10);
  
  if (isReady) {
    return res.status(200).json({
      started: true,
      duration: startupDuration,
      timestamp: new Date().toISOString(),
    });
  }
  
  if (startupDuration > maxStartupTime) {
    return res.status(503).json({
      started: false,
      reason: 'startup_timeout',
      duration: startupDuration,
      maxAllowed: maxStartupTime,
      timestamp: new Date().toISOString(),
    });
  }
  
  res.status(503).json({
    started: false,
    reason: 'still_starting',
    duration: startupDuration,
    timestamp: new Date().toISOString(),
  });
});

export function setReady(ready = true) {
  isReady = ready;
  logger.info({ event: 'readiness.changed', ready });
}

export function setShuttingDown(shuttingDown = true) {
  isShuttingDown = shuttingDown;
  logger.info({ event: 'shutdown.initiated', shuttingDown });
}

export function addHealthCheck(name, checkFn, critical = false) {
  healthChecks[name] = { check: checkFn, critical };
  logger.info({ event: 'healthcheck.added', name, critical });
}

export function removeHealthCheck(name) {
  delete healthChecks[name];
  logger.info({ event: 'healthcheck.removed', name });
}

export default router;
export { router as healthRouter };
