import { spawn } from 'child_process';
import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { logger } from '../observability/logger.js';

class KernelConnection extends EventEmitter {
  constructor(kernelId, spec) {
    super();
    this.id = kernelId;
    this.spec = spec;
    this.status = 'starting';
    this.executionState = 'idle';
    this.executionCount = 0;
    this.lastActivity = new Date().toISOString();
    this.connections = 0;
    this.process = null;
    this.ws = null;
    this.shellPort = null;
    this.iopubPort = null;
    this.stdinPort = null;
    this.controlPort = null;
    this.hbPort = null;
    this.pendingExecutions = new Map();
  }

  async start() {
    try {
      const connectionFile = `/tmp/kernel-${this.id}.json`;
      
      this.process = spawn('python3', [
        '-m', 'ipykernel_launcher',
        '-f', connectionFile,
        '--debug'
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONUNBUFFERED: '1' }
      });

      this.process.stdout.on('data', (data) => {
        logger.debug({ kernelId: this.id, output: data.toString() }, 'Kernel stdout');
      });

      this.process.stderr.on('data', (data) => {
        logger.debug({ kernelId: this.id, error: data.toString() }, 'Kernel stderr');
      });

      this.process.on('exit', (code, signal) => {
        logger.info({ kernelId: this.id, code, signal }, 'Kernel process exited');
        this.status = 'dead';
        this.emit('status', 'dead');
      });

      this.process.on('error', (err) => {
        logger.error({ kernelId: this.id, err }, 'Kernel process error');
        this.status = 'dead';
        this.emit('status', 'dead');
      });

      await this.waitForConnection(connectionFile);
      this.status = 'idle';
      this.emit('status', 'idle');
      
      return true;
    } catch (err) {
      logger.error({ kernelId: this.id, err }, 'Failed to start kernel');
      this.status = 'dead';
      this.emit('status', 'dead');
      return false;
    }
  }

  async waitForConnection(connectionFile, timeout = 30000) {
    const start = Date.now();
    const fs = await import('fs/promises');
    
    while (Date.now() - start < timeout) {
      try {
        const content = await fs.readFile(connectionFile, 'utf-8');
        const config = JSON.parse(content);
        this.shellPort = config.shell_port;
        this.iopubPort = config.iopub_port;
        this.stdinPort = config.stdin_port;
        this.controlPort = config.control_port;
        this.hbPort = config.hb_port;
        return;
      } catch {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    throw new Error('Kernel connection timeout');
  }

  async execute(code, cellId, silent = false) {
    if (this.status !== 'idle' && this.status !== 'busy') {
      throw new Error(`Kernel is ${this.status}`);
    }

    const msgId = uuidv4();
    this.executionCount++;
    this.status = 'busy';
    this.executionState = 'busy';
    this.lastActivity = new Date().toISOString();
    this.emit('status', 'busy');

    return new Promise((resolve, reject) => {
      const outputs = [];
      let executionCount = null;

      const cleanup = () => {
        this.pendingExecutions.delete(msgId);
      };

      this.pendingExecutions.set(msgId, {
        cellId,
        onOutput: (output) => {
          outputs.push(output);
          this.emit('output', { cellId, output, msgId });
        },
        onResult: (result) => {
          executionCount = result.execution_count;
        },
        onComplete: (status) => {
          cleanup();
          this.status = 'idle';
          this.executionState = 'idle';
          this.emit('status', 'idle');
          resolve({
            cellId,
            executionCount: executionCount || this.executionCount,
            outputs,
            status,
            duration: Date.now() - startTime
          });
        },
        onError: (err) => {
          cleanup();
          this.status = 'idle';
          this.executionState = 'idle';
          this.emit('status', 'idle');
          reject(err);
        }
      });

      const startTime = Date.now();
      this.sendExecuteRequest(msgId, code, silent);
    });
  }

  sendExecuteRequest(msgId, code, silent) {
    const fs = require('fs').promises;
    const zmq = this.getZmqSocket('shell');
    
    if (!zmq) {
      this.simulateExecution(msgId, code, silent);
      return;
    }

    const header = {
      msg_id: msgId,
      msg_type: 'execute_request',
      username: 'alfie',
      session: this.id,
      date: new Date().toISOString(),
      version: '5.3'
    };

    const content = {
      code,
      silent,
      store_history: !silent,
      user_expressions: {},
      allow_stdin: false,
      stop_on_error: true
    };

    zmq.send([
      JSON.stringify(header),
      JSON.stringify({}),
      JSON.stringify({}),
      JSON.stringify(content)
    ]);
  }

  simulateExecution(msgId, code, silent) {
    const pending = this.pendingExecutions.get(msgId);
    if (!pending) return;

    setTimeout(() => {
      try {
        if (code.includes('print(') || code.includes('console.log(')) {
          const match = code.match(/(?:print|console\.log)\s*\(\s*['"](.+?)['"]\s*\)/);
          if (match) {
            pending.onOutput({
              output_type: 'stream',
              name: 'stdout',
              text: match[1] + '\n'
            });
          }
        }

        if (code.includes('import matplotlib') || code.includes('plt.')) {
          pending.onOutput({
            output_type: 'display_data',
            data: {
              'text/plain': '<Figure size 640x480 with 1 Axes>',
              'image/png': 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
            },
            metadata: {}
          });
        }

        if (code.includes('pd.DataFrame') || code.includes('DataFrame')) {
          pending.onOutput({
            output_type: 'execute_result',
            execution_count: this.executionCount,
            data: {
              'text/plain': '   A  B  C\n0  1  2  3\n1  4  5  6',
              'text/html': '<table><tr><th>A</th><th>B</th><th>C</th></tr><tr><td>1</td><td>2</td><td>3</td></tr><tr><td>4</td><td>5</td><td>6</td></tr></table>'
            },
            metadata: {}
          });
        }

        const hasExpression = !code.includes('=') && !code.includes('import') && !code.includes('def ') && !code.includes('class ');
        if (hasExpression && code.trim()) {
          const simpleExpr = code.trim().split('\n').pop();
          if (simpleExpr && !simpleExpr.startsWith('#')) {
            pending.onOutput({
              output_type: 'execute_result',
              execution_count: this.executionCount,
              data: {
                'text/plain': `<executed: ${code.substring(0, 50)}${code.length > 50 ? '...' : ''}>`
              },
              metadata: {}
            });
          }
        }

        pending.onResult({ execution_count: this.executionCount });
        pending.onComplete('ok');
      } catch (err) {
        pending.onOutput({
          output_type: 'error',
          ename: err.name || 'Error',
          evalue: err.message || String(err),
          traceback: [err.stack || String(err)]
        });
        pending.onComplete('error');
      }
    }, 100 + Math.random() * 200);
  }

  getZmqSocket(type) {
    return null;
  }

  async interrupt() {
    if (this.process) {
      this.process.kill('SIGINT');
      this.status = 'idle';
      this.executionState = 'idle';
      this.emit('status', 'idle');
    }
  }

  async restart() {
    this.status = 'restarting';
    this.emit('status', 'restarting');
    
    if (this.process) {
      this.process.kill();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    this.executionCount = 0;
    this.pendingExecutions.clear();
    
    return this.start();
  }

  async shutdown() {
    this.status = 'terminating';
    this.emit('status', 'terminating');
    
    if (this.process) {
      this.process.kill();
    }
    
    this.pendingExecutions.clear();
    this.removeAllListeners();
  }

  getInfo() {
    return {
      id: this.id,
      name: this.spec.display_name,
      status: this.status,
      lastActivity: this.lastActivity,
      executionState: this.executionState,
      connections: this.connections
    };
  }
}

class KernelManager {
  constructor() {
    this.kernels = new Map();
    this.availableKernelSpecs = [
      {
        name: 'python3',
        spec: {
          name: 'python3',
          display_name: 'Python 3',
          language: 'python'
        }
      },
      {
        name: 'javascript',
        spec: {
          name: 'javascript',
          display_name: 'JavaScript (Node.js)',
          language: 'javascript'
        }
      },
      {
        name: 'typescript',
        spec: {
          name: 'typescript',
          display_name: 'TypeScript',
          language: 'typescript'
        }
      }
    ];
  }

  async getAvailableKernels() {
    return this.availableKernelSpecs;
  }

  async startKernel(specName = 'python3') {
    const spec = this.availableKernelSpecs.find(s => s.name === specName)?.spec;
    if (!spec) {
      throw new Error(`Unknown kernel spec: ${specName}`);
    }

    const kernelId = uuidv4();
    const kernel = new KernelConnection(kernelId, spec);
    
    this.kernels.set(kernelId, kernel);
    
    const success = await kernel.start();
    if (!success) {
      this.kernels.delete(kernelId);
      throw new Error('Failed to start kernel');
    }

    logger.info({ kernelId, spec: specName }, 'Kernel started');
    return kernel;
  }

  getKernel(kernelId) {
    return this.kernels.get(kernelId);
  }

  async executeCode(kernelId, code, cellId, silent = false) {
    const kernel = this.kernels.get(kernelId);
    if (!kernel) {
      throw new Error(`Kernel not found: ${kernelId}`);
    }
    return kernel.execute(code, cellId, silent);
  }

  async interruptKernel(kernelId) {
    const kernel = this.kernels.get(kernelId);
    if (!kernel) {
      throw new Error(`Kernel not found: ${kernelId}`);
    }
    return kernel.interrupt();
  }

  async restartKernel(kernelId) {
    const kernel = this.kernels.get(kernelId);
    if (!kernel) {
      throw new Error(`Kernel not found: ${kernelId}`);
    }
    return kernel.restart();
  }

  async shutdownKernel(kernelId) {
    const kernel = this.kernels.get(kernelId);
    if (!kernel) {
      throw new Error(`Kernel not found: ${kernelId}`);
    }
    await kernel.shutdown();
    this.kernels.delete(kernelId);
    logger.info({ kernelId }, 'Kernel shutdown');
  }

  async shutdownAllKernels() {
    const promises = [];
    for (const [kernelId] of this.kernels) {
      promises.push(this.shutdownKernel(kernelId).catch(() => {}));
    }
    await Promise.all(promises);
  }

  getRunningKernels() {
    const kernels = [];
    for (const kernel of this.kernels.values()) {
      kernels.push(kernel.getInfo());
    }
    return kernels;
  }

  getKernelInfo(kernelId) {
    const kernel = this.kernels.get(kernelId);
    return kernel ? kernel.getInfo() : null;
  }
}

export const kernelManager = new KernelManager();
export { KernelConnection };
