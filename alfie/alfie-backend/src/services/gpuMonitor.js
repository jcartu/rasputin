import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function getGPUStats() {
  try {
    const { stdout } = await execAsync('nvidia-smi --query-gpu=index,utilization.gpu,temperature.gpu,memory.used,memory.total --format=csv,noheader,nounits');
    const lines = stdout.trim().split('\n');
    const gpus = {};
    
    lines.forEach(line => {
      const [index, util, temp, memUsed, memTotal] = line.split(',').map(s => parseFloat(s.trim()));
      gpus[`gpu${index}`] = {
        utilization: util,
        temperature: temp,
        memoryUsed: memUsed,
        memoryTotal: memTotal,
        memoryPercent: Math.round((memUsed / memTotal) * 100)
      };
    });
    
    return gpus;
  } catch (error) {
    console.error('GPU stats error:', error.message);
    return {
      gpu0: { utilization: 0, temperature: 0, memoryUsed: 0, memoryTotal: 0, memoryPercent: 0 },
      gpu1: { utilization: 0, temperature: 0, memoryUsed: 0, memoryTotal: 0, memoryPercent: 0 }
    };
  }
}

export function startGPUMonitoring(wss, interval = 5000) {
  setInterval(async () => {
    const stats = await getGPUStats();
    wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(JSON.stringify({
          type: 'gpu_stats',
          payload: stats
        }));
      }
    });
  }, interval);
}

export default { getGPUStats, startGPUMonitoring };
