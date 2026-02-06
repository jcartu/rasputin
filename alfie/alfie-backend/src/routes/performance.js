import { Router } from 'express';
import * as performanceMonitor from '../services/performanceMonitor.js';

const router = Router();

router.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(performanceMonitor.getPrometheusMetrics());
});

router.get('/json', (req, res) => {
  res.json(performanceMonitor.getMetrics());
});

router.get('/alerts', (req, res) => {
  const metrics = performanceMonitor.getMetrics();
  res.json({
    alerts: metrics.alerts,
    count: metrics.alerts.length,
  });
});

router.get('/dashboard', (req, res) => {
  res.set('Content-Type', 'text/html');
  res.send(getDashboardHtml());
});

function getDashboardHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ALFIE Performance Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      min-height: 100vh;
      padding: 20px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid #334155;
    }
    .header h1 { font-size: 24px; font-weight: 600; }
    .status { display: flex; align-items: center; gap: 8px; }
    .status-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #22c55e;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
    }
    .card {
      background: #1e293b;
      border-radius: 12px;
      padding: 20px;
      border: 1px solid #334155;
    }
    .card-title {
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #94a3b8;
      margin-bottom: 16px;
    }
    .metric {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding: 8px 0;
      border-bottom: 1px solid #334155;
    }
    .metric:last-child { border-bottom: none; }
    .metric-label { color: #94a3b8; font-size: 14px; }
    .metric-value { font-size: 20px; font-weight: 600; font-family: monospace; }
    .metric-value.good { color: #22c55e; }
    .metric-value.warning { color: #f59e0b; }
    .metric-value.critical { color: #ef4444; }
    .progress-bar {
      height: 8px;
      background: #334155;
      border-radius: 4px;
      overflow: hidden;
      margin-top: 8px;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #22c55e, #3b82f6);
      transition: width 0.3s ease;
    }
    .progress-fill.warning { background: linear-gradient(90deg, #f59e0b, #ef4444); }
    .alert-list {
      max-height: 200px;
      overflow-y: auto;
    }
    .alert-item {
      padding: 10px;
      margin-bottom: 8px;
      border-radius: 6px;
      font-size: 13px;
    }
    .alert-item.warning { background: rgba(245, 158, 11, 0.2); border-left: 3px solid #f59e0b; }
    .alert-item.critical { background: rgba(239, 68, 68, 0.2); border-left: 3px solid #ef4444; }
    .alert-time { color: #64748b; font-size: 11px; margin-top: 4px; }
    .chart-container { height: 150px; position: relative; margin-top: 16px; }
    .chart-bars {
      display: flex;
      align-items: flex-end;
      height: 100%;
      gap: 2px;
    }
    .chart-bar {
      flex: 1;
      background: linear-gradient(180deg, #3b82f6, #1d4ed8);
      border-radius: 2px 2px 0 0;
      min-height: 2px;
      transition: height 0.3s ease;
    }
    .uptime { font-size: 32px; font-weight: 700; color: #22c55e; }
    .refresh-info { color: #64748b; font-size: 12px; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>ALFIE Performance Dashboard</h1>
    <div class="status">
      <div class="status-dot"></div>
      <span>Live</span>
    </div>
  </div>
  
  <div class="grid">
    <div class="card">
      <div class="card-title">System Overview</div>
      <div class="uptime" id="uptime">--:--:--</div>
      <div class="refresh-info">Uptime</div>
      <div class="metric" style="margin-top: 16px">
        <span class="metric-label">Total Requests</span>
        <span class="metric-value" id="totalRequests">0</span>
      </div>
      <div class="metric">
        <span class="metric-label">WebSocket Connections</span>
        <span class="metric-value" id="wsConnections">0</span>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Response Times</div>
      <div class="metric">
        <span class="metric-label">Average</span>
        <span class="metric-value" id="avgResponseTime">0ms</span>
      </div>
      <div class="metric">
        <span class="metric-label">P95</span>
        <span class="metric-value" id="p95ResponseTime">0ms</span>
      </div>
      <div class="metric">
        <span class="metric-label">P99</span>
        <span class="metric-value" id="p99ResponseTime">0ms</span>
      </div>
      <div class="metric">
        <span class="metric-label">Max</span>
        <span class="metric-value" id="maxResponseTime">0ms</span>
      </div>
    </div>

    <div class="card">
      <div class="card-title">CPU Usage</div>
      <div class="metric">
        <span class="metric-label">Average</span>
        <span class="metric-value" id="cpuUsage">0%</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" id="cpuBar" style="width: 0%"></div>
      </div>
      <div class="metric" style="margin-top: 16px">
        <span class="metric-label">Load (1m)</span>
        <span class="metric-value" id="loadAvg">0.00</span>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Memory Usage</div>
      <div class="metric">
        <span class="metric-label">Heap Used</span>
        <span class="metric-value" id="heapUsed">0 MB</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" id="memBar" style="width: 0%"></div>
      </div>
      <div class="metric" style="margin-top: 16px">
        <span class="metric-label">System</span>
        <span class="metric-value" id="systemMem">0%</span>
      </div>
    </div>

    <div class="card">
      <div class="card-title">WebSocket Stats</div>
      <div class="metric">
        <span class="metric-label">Messages Received</span>
        <span class="metric-value" id="wsReceived">0</span>
      </div>
      <div class="metric">
        <span class="metric-label">Messages Sent</span>
        <span class="metric-value" id="wsSent">0</span>
      </div>
      <div class="metric">
        <span class="metric-label">Avg Latency</span>
        <span class="metric-value" id="wsLatency">0ms</span>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Response Time History</div>
      <div class="chart-container">
        <div class="chart-bars" id="responseChart"></div>
      </div>
    </div>

    <div class="card" style="grid-column: span 2">
      <div class="card-title">Recent Alerts</div>
      <div class="alert-list" id="alertList">
        <div style="color: #64748b; text-align: center; padding: 20px;">No alerts</div>
      </div>
    </div>
  </div>

  <script>
    const chartData = [];
    const maxChartPoints = 60;

    function formatUptime(seconds) {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
    }

    function formatBytes(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
      if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
      return (bytes / 1073741824).toFixed(2) + ' GB';
    }

    function getValueClass(value, warningThreshold, criticalThreshold) {
      if (value >= criticalThreshold) return 'critical';
      if (value >= warningThreshold) return 'warning';
      return 'good';
    }

    function updateChart() {
      const container = document.getElementById('responseChart');
      const maxVal = Math.max(...chartData, 100);
      container.innerHTML = chartData.map(val => {
        const height = (val / maxVal) * 100;
        return '<div class="chart-bar" style="height: ' + height + '%"></div>';
      }).join('');
    }

    function updateAlerts(alerts) {
      const container = document.getElementById('alertList');
      if (!alerts || alerts.length === 0) {
        container.innerHTML = '<div style="color: #64748b; text-align: center; padding: 20px;">No alerts</div>';
        return;
      }
      container.innerHTML = alerts.slice(-10).reverse().map(alert => {
        const time = new Date(alert.timestamp).toLocaleTimeString();
        return '<div class="alert-item ' + alert.severity + '">' +
          '<div>' + alert.message + '</div>' +
          '<div class="alert-time">' + time + '</div>' +
        '</div>';
      }).join('');
    }

    async function fetchMetrics() {
      try {
        const res = await fetch('/api/performance/json');
        const data = await res.json();
        
        document.getElementById('uptime').textContent = formatUptime(data.uptime);
        document.getElementById('totalRequests').textContent = data.requests.total.toLocaleString();
        document.getElementById('wsConnections').textContent = data.websocket.connections;
        
        const rt = data.requests.responseTime;
        document.getElementById('avgResponseTime').textContent = rt.avg.toFixed(1) + 'ms';
        document.getElementById('avgResponseTime').className = 'metric-value ' + getValueClass(rt.avg, 1000, 5000);
        document.getElementById('p95ResponseTime').textContent = rt.p95.toFixed(1) + 'ms';
        document.getElementById('p95ResponseTime').className = 'metric-value ' + getValueClass(rt.p95, 2000, 5000);
        document.getElementById('p99ResponseTime').textContent = rt.p99.toFixed(1) + 'ms';
        document.getElementById('maxResponseTime').textContent = rt.max.toFixed(1) + 'ms';
        
        document.getElementById('cpuUsage').textContent = data.cpu.avgUsage.toFixed(1) + '%';
        document.getElementById('cpuUsage').className = 'metric-value ' + getValueClass(data.cpu.avgUsage, 70, 90);
        document.getElementById('cpuBar').style.width = Math.min(data.cpu.avgUsage, 100) + '%';
        document.getElementById('cpuBar').className = 'progress-fill' + (data.cpu.avgUsage > 70 ? ' warning' : '');
        document.getElementById('loadAvg').textContent = data.cpu.loadAverage['1min'].toFixed(2);
        
        const heapPercent = (data.memory.process.heapUsed / data.memory.process.heapTotal) * 100;
        document.getElementById('heapUsed').textContent = formatBytes(data.memory.process.heapUsed);
        document.getElementById('memBar').style.width = heapPercent + '%';
        document.getElementById('memBar').className = 'progress-fill' + (heapPercent > 80 ? ' warning' : '');
        document.getElementById('systemMem').textContent = data.memory.system.usagePercent.toFixed(1) + '%';
        
        document.getElementById('wsReceived').textContent = data.websocket.messagesReceived.toLocaleString();
        document.getElementById('wsSent').textContent = data.websocket.messagesSent.toLocaleString();
        document.getElementById('wsLatency').textContent = data.websocket.latency.avg.toFixed(1) + 'ms';
        
        chartData.push(rt.avg);
        if (chartData.length > maxChartPoints) chartData.shift();
        updateChart();
        
        updateAlerts(data.alerts);
      } catch (err) {
        console.error('Failed to fetch metrics:', err);
      }
    }

    fetchMetrics();
    setInterval(fetchMetrics, 2000);
  </script>
</body>
</html>`;
}

export default router;
