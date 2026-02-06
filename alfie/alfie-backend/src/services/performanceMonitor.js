import os from 'os';
import { EventEmitter } from 'events';

class PerformanceMonitor extends EventEmitter {
  constructor() {
    super();
    this.metrics = {
      requests: {
        total: 0,
        byMethod: {},
        byRoute: {},
        byStatusCode: {},
      },
      responseTimes: {
        histogram: new Map(),
        sum: 0,
        count: 0,
        min: Infinity,
        max: 0,
        recent: [],
      },
      websocket: {
        connections: 0,
        messagesReceived: 0,
        messagesSent: 0,
        latency: {
          sum: 0,
          count: 0,
          recent: [],
        },
      },
      system: {
        startTime: Date.now(),
        lastCpuUsage: null,
      },
      alerts: [],
    };

    this.histogramBuckets = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
    this.histogramBuckets.forEach(bucket => {
      this.metrics.responseTimes.histogram.set(bucket, 0);
    });
    this.metrics.responseTimes.histogram.set(Infinity, 0);

    this.slowResponseThreshold = 5000;

    this.metrics.system.lastCpuUsage = os.cpus();
  }

  recordRequest(method, route, statusCode, duration) {
    const { requests, responseTimes } = this.metrics;

    requests.total++;
    requests.byMethod[method] = (requests.byMethod[method] || 0) + 1;
    requests.byRoute[route] = (requests.byRoute[route] || 0) + 1;
    requests.byStatusCode[statusCode] = (requests.byStatusCode[statusCode] || 0) + 1;

    responseTimes.sum += duration;
    responseTimes.count++;
    responseTimes.min = Math.min(responseTimes.min, duration);
    responseTimes.max = Math.max(responseTimes.max, duration);

    responseTimes.recent.push({ duration, timestamp: Date.now(), route, method });
    if (responseTimes.recent.length > 100) {
      responseTimes.recent.shift();
    }

    for (const bucket of this.histogramBuckets) {
      if (duration <= bucket) {
        responseTimes.histogram.set(bucket, responseTimes.histogram.get(bucket) + 1);
        break;
      }
    }
    if (duration > this.histogramBuckets[this.histogramBuckets.length - 1]) {
      responseTimes.histogram.set(Infinity, responseTimes.histogram.get(Infinity) + 1);
    }

    if (duration > this.slowResponseThreshold) {
      this._triggerSlowResponseAlert(method, route, duration);
    }
  }

  recordWsConnection(delta) {
    this.metrics.websocket.connections += delta;
  }

  recordWsMessage(direction) {
    if (direction === 'in') {
      this.metrics.websocket.messagesReceived++;
    } else {
      this.metrics.websocket.messagesSent++;
    }
  }

  recordWsLatency(latency) {
    const { websocket } = this.metrics;
    websocket.latency.sum += latency;
    websocket.latency.count++;
    websocket.latency.recent.push({ latency, timestamp: Date.now() });
    if (websocket.latency.recent.length > 100) {
      websocket.latency.recent.shift();
    }
  }

  getMemoryUsage() {
    const processMemory = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();

    return {
      process: {
        heapTotal: processMemory.heapTotal,
        heapUsed: processMemory.heapUsed,
        external: processMemory.external,
        rss: processMemory.rss,
        arrayBuffers: processMemory.arrayBuffers,
      },
      system: {
        total: totalMem,
        free: freeMem,
        used: totalMem - freeMem,
        usagePercent: ((totalMem - freeMem) / totalMem) * 100,
      },
    };
  }

  getCpuUsage() {
    const cpus = os.cpus();
    const loadAvg = os.loadavg();

    const coreUsage = cpus.map((cpu, index) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
      const idle = cpu.times.idle;
      const usage = ((total - idle) / total) * 100;
      return {
        core: index,
        model: cpu.model,
        speed: cpu.speed,
        usage: Math.round(usage * 100) / 100,
        times: cpu.times,
      };
    });

    const avgUsage = coreUsage.reduce((sum, core) => sum + core.usage, 0) / coreUsage.length;

    return {
      cores: cpus.length,
      avgUsage: Math.round(avgUsage * 100) / 100,
      loadAverage: {
        '1min': loadAvg[0],
        '5min': loadAvg[1],
        '15min': loadAvg[2],
      },
      perCore: coreUsage,
    };
  }

  getResponseTimeStats() {
    const { responseTimes } = this.metrics;
    const avg = responseTimes.count > 0 ? responseTimes.sum / responseTimes.count : 0;

    const sorted = [...responseTimes.recent].sort((a, b) => a.duration - b.duration);
    const p50 = this._percentile(sorted.map(r => r.duration), 50);
    const p90 = this._percentile(sorted.map(r => r.duration), 90);
    const p95 = this._percentile(sorted.map(r => r.duration), 95);
    const p99 = this._percentile(sorted.map(r => r.duration), 99);

    return {
      count: responseTimes.count,
      sum: responseTimes.sum,
      avg: Math.round(avg * 100) / 100,
      min: responseTimes.min === Infinity ? 0 : responseTimes.min,
      max: responseTimes.max,
      p50,
      p90,
      p95,
      p99,
    };
  }

  getWebSocketStats() {
    const { websocket } = this.metrics;
    const avgLatency = websocket.latency.count > 0 
      ? websocket.latency.sum / websocket.latency.count 
      : 0;

    return {
      connections: websocket.connections,
      messagesReceived: websocket.messagesReceived,
      messagesSent: websocket.messagesSent,
      latency: {
        avg: Math.round(avgLatency * 100) / 100,
        count: websocket.latency.count,
        recent: websocket.latency.recent.slice(-10),
      },
    };
  }

  getMetrics() {
    return {
      timestamp: new Date().toISOString(),
      uptime: (Date.now() - this.metrics.system.startTime) / 1000,
      requests: {
        ...this.metrics.requests,
        responseTime: this.getResponseTimeStats(),
      },
      websocket: this.getWebSocketStats(),
      memory: this.getMemoryUsage(),
      cpu: this.getCpuUsage(),
      alerts: this.metrics.alerts.slice(-50),
    };
  }

  getPrometheusMetrics() {
    const metrics = [];
    const { requests, responseTimes, websocket } = this.metrics;
    const memory = this.getMemoryUsage();
    const cpu = this.getCpuUsage();
    const uptime = (Date.now() - this.metrics.system.startTime) / 1000;

    metrics.push('# HELP alfie_http_requests_total Total number of HTTP requests');
    metrics.push('# TYPE alfie_http_requests_total counter');
    metrics.push(`alfie_http_requests_total ${requests.total}`);

    metrics.push('# HELP alfie_http_requests_by_method HTTP requests by method');
    metrics.push('# TYPE alfie_http_requests_by_method counter');
    for (const [method, count] of Object.entries(requests.byMethod)) {
      metrics.push(`alfie_http_requests_by_method{method="${method}"} ${count}`);
    }

    metrics.push('# HELP alfie_http_requests_by_status HTTP requests by status code');
    metrics.push('# TYPE alfie_http_requests_by_status counter');
    for (const [status, count] of Object.entries(requests.byStatusCode)) {
      metrics.push(`alfie_http_requests_by_status{status="${status}"} ${count}`);
    }

    metrics.push('# HELP alfie_http_request_duration_ms HTTP request duration in milliseconds');
    metrics.push('# TYPE alfie_http_request_duration_ms histogram');
    let cumulativeCount = 0;
    for (const bucket of this.histogramBuckets) {
      cumulativeCount += responseTimes.histogram.get(bucket);
      metrics.push(`alfie_http_request_duration_ms_bucket{le="${bucket}"} ${cumulativeCount}`);
    }
    cumulativeCount += responseTimes.histogram.get(Infinity);
    metrics.push(`alfie_http_request_duration_ms_bucket{le="+Inf"} ${cumulativeCount}`);
    metrics.push(`alfie_http_request_duration_ms_sum ${responseTimes.sum}`);
    metrics.push(`alfie_http_request_duration_ms_count ${responseTimes.count}`);

    const rtStats = this.getResponseTimeStats();
    metrics.push('# HELP alfie_http_response_time_ms HTTP response time statistics');
    metrics.push('# TYPE alfie_http_response_time_ms gauge');
    metrics.push(`alfie_http_response_time_ms{quantile="0.5"} ${rtStats.p50}`);
    metrics.push(`alfie_http_response_time_ms{quantile="0.9"} ${rtStats.p90}`);
    metrics.push(`alfie_http_response_time_ms{quantile="0.95"} ${rtStats.p95}`);
    metrics.push(`alfie_http_response_time_ms{quantile="0.99"} ${rtStats.p99}`);
    metrics.push(`alfie_http_response_time_avg_ms ${rtStats.avg}`);
    metrics.push(`alfie_http_response_time_max_ms ${rtStats.max}`);

    metrics.push('# HELP alfie_websocket_connections Current WebSocket connections');
    metrics.push('# TYPE alfie_websocket_connections gauge');
    metrics.push(`alfie_websocket_connections ${websocket.connections}`);

    metrics.push('# HELP alfie_websocket_messages_total Total WebSocket messages');
    metrics.push('# TYPE alfie_websocket_messages_total counter');
    metrics.push(`alfie_websocket_messages_total{direction="received"} ${websocket.messagesReceived}`);
    metrics.push(`alfie_websocket_messages_total{direction="sent"} ${websocket.messagesSent}`);

    const avgLatency = websocket.latency.count > 0 ? websocket.latency.sum / websocket.latency.count : 0;
    metrics.push('# HELP alfie_websocket_latency_ms WebSocket latency in milliseconds');
    metrics.push('# TYPE alfie_websocket_latency_ms gauge');
    metrics.push(`alfie_websocket_latency_avg_ms ${Math.round(avgLatency * 100) / 100}`);

    metrics.push('# HELP alfie_memory_bytes Memory usage in bytes');
    metrics.push('# TYPE alfie_memory_bytes gauge');
    metrics.push(`alfie_memory_bytes{type="heap_total"} ${memory.process.heapTotal}`);
    metrics.push(`alfie_memory_bytes{type="heap_used"} ${memory.process.heapUsed}`);
    metrics.push(`alfie_memory_bytes{type="external"} ${memory.process.external}`);
    metrics.push(`alfie_memory_bytes{type="rss"} ${memory.process.rss}`);
    metrics.push(`alfie_memory_bytes{type="system_total"} ${memory.system.total}`);
    metrics.push(`alfie_memory_bytes{type="system_used"} ${memory.system.used}`);
    metrics.push(`alfie_memory_bytes{type="system_free"} ${memory.system.free}`);

    metrics.push('# HELP alfie_cpu_usage_percent CPU usage percentage');
    metrics.push('# TYPE alfie_cpu_usage_percent gauge');
    metrics.push(`alfie_cpu_usage_percent{type="average"} ${cpu.avgUsage}`);
    cpu.perCore.forEach((core) => {
      metrics.push(`alfie_cpu_usage_percent{type="core",core="${core.core}"} ${core.usage}`);
    });

    metrics.push('# HELP alfie_cpu_load_average CPU load average');
    metrics.push('# TYPE alfie_cpu_load_average gauge');
    metrics.push(`alfie_cpu_load_average{period="1m"} ${cpu.loadAverage['1min']}`);
    metrics.push(`alfie_cpu_load_average{period="5m"} ${cpu.loadAverage['5min']}`);
    metrics.push(`alfie_cpu_load_average{period="15m"} ${cpu.loadAverage['15min']}`);

    metrics.push('# HELP alfie_process_uptime_seconds Process uptime in seconds');
    metrics.push('# TYPE alfie_process_uptime_seconds gauge');
    metrics.push(`alfie_process_uptime_seconds ${uptime}`);

    metrics.push('# HELP alfie_alerts_total Total number of alerts triggered');
    metrics.push('# TYPE alfie_alerts_total counter');
    metrics.push(`alfie_alerts_total ${this.metrics.alerts.length}`);

    return metrics.join('\n');
  }

  _triggerSlowResponseAlert(method, route, duration) {
    const alert = {
      type: 'slow_response',
      severity: duration > 10000 ? 'critical' : 'warning',
      message: `Slow response detected: ${method} ${route} took ${duration}ms (threshold: ${this.slowResponseThreshold}ms)`,
      timestamp: new Date().toISOString(),
      details: { method, route, duration, threshold: this.slowResponseThreshold },
    };

    this.metrics.alerts.push(alert);
    if (this.metrics.alerts.length > 1000) {
      this.metrics.alerts = this.metrics.alerts.slice(-500);
    }

    this.emit('alert', alert);
    console.warn(`[ALERT] ${alert.message}`);
  }

  _percentile(arr, p) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  reset() {
    this.metrics.requests = {
      total: 0,
      byMethod: {},
      byRoute: {},
      byStatusCode: {},
    };
    this.metrics.responseTimes = {
      histogram: new Map(),
      sum: 0,
      count: 0,
      min: Infinity,
      max: 0,
      recent: [],
    };
    this.histogramBuckets.forEach(bucket => {
      this.metrics.responseTimes.histogram.set(bucket, 0);
    });
    this.metrics.responseTimes.histogram.set(Infinity, 0);
  }
}

const performanceMonitor = new PerformanceMonitor();

export function recordRequest(method, route, statusCode, duration) {
  performanceMonitor.recordRequest(method, route, statusCode, duration);
}

export function recordWsConnection(delta) {
  performanceMonitor.recordWsConnection(delta);
}

export function recordWsMessage(direction) {
  performanceMonitor.recordWsMessage(direction);
}

export function recordWsLatency(latency) {
  performanceMonitor.recordWsLatency(latency);
}

export function getMetrics() {
  return performanceMonitor.getMetrics();
}

export function getPrometheusMetrics() {
  return performanceMonitor.getPrometheusMetrics();
}

export function getMemoryUsage() {
  return performanceMonitor.getMemoryUsage();
}

export function getCpuUsage() {
  return performanceMonitor.getCpuUsage();
}

export function getResponseTimeStats() {
  return performanceMonitor.getResponseTimeStats();
}

export function getWebSocketStats() {
  return performanceMonitor.getWebSocketStats();
}

export function onAlert(callback) {
  performanceMonitor.on('alert', callback);
}

export function reset() {
  performanceMonitor.reset();
}

export default {
  recordRequest,
  recordWsConnection,
  recordWsMessage,
  recordWsLatency,
  getMetrics,
  getPrometheusMetrics,
  getMemoryUsage,
  getCpuUsage,
  getResponseTimeStats,
  getWebSocketStats,
  onAlert,
  reset,
};
