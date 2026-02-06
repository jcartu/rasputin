import { Router } from 'express';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as openclawGateway from '../services/openclawGateway.js';
import { getConnectedClients } from '../services/websocket.js';

const execAsync = promisify(exec);
const router = Router();

router.get('/stats', async (req, res) => {
  try {
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    
    const cpuUsage = cpus.reduce((acc, cpu) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
      const idle = cpu.times.idle;
      return acc + ((total - idle) / total);
    }, 0) / cpus.length;

    const stats = {
      cpu: {
        cores: cpus.length,
        model: cpus[0]?.model || 'Unknown',
        usage: Math.round(cpuUsage * 100),
      },
      memory: {
        total: totalMemory,
        used: usedMemory,
        free: freeMemory,
        usagePercent: Math.round((usedMemory / totalMemory) * 100),
      },
      os: {
        platform: os.platform(),
        release: os.release(),
        hostname: os.hostname(),
        uptime: os.uptime(),
      },
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
      },
    };
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get system stats', details: error.message });
  }
});

router.get('/gpu', async (req, res) => {
  try {
    const { stdout } = await execAsync(
      'nvidia-smi --query-gpu=index,name,memory.total,memory.used,memory.free,utilization.gpu,temperature.gpu --format=csv,noheader,nounits'
    );
    
    const gpus = stdout.trim().split('\n').map(line => {
      const [index, name, memTotal, memUsed, memFree, utilization, temperature] = line.split(', ').map(s => s.trim());
      return {
        index: parseInt(index, 10),
        name,
        memory: {
          total: parseInt(memTotal, 10) * 1024 * 1024,
          used: parseInt(memUsed, 10) * 1024 * 1024,
          free: parseInt(memFree, 10) * 1024 * 1024,
          usagePercent: Math.round((parseInt(memUsed, 10) / parseInt(memTotal, 10)) * 100),
        },
        utilization: parseInt(utilization, 10),
        temperature: parseInt(temperature, 10),
      };
    });
    
    res.json({ available: true, gpus });
  } catch {
    res.json({ available: false, gpus: [], message: 'nvidia-smi not available' });
  }
});

router.get('/health', async (req, res) => {
  try {
    const gatewayStatus = await openclawGateway.getGatewayStatus();
    const wsClients = getConnectedClients();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      gateway: gatewayStatus,
      websocket: {
        connectedClients: wsClients.length,
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

router.get('/load', async (req, res) => {
  try {
    const loadAvg = os.loadavg();
    const cpuCount = os.cpus().length;
    
    res.json({
      loadAverage: {
        '1min': loadAvg[0],
        '5min': loadAvg[1],
        '15min': loadAvg[2],
      },
      cpuCount,
      loadPercentage: {
        '1min': Math.round((loadAvg[0] / cpuCount) * 100),
        '5min': Math.round((loadAvg[1] / cpuCount) * 100),
        '15min': Math.round((loadAvg[2] / cpuCount) * 100),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get load stats', details: error.message });
  }
});

export default router;
