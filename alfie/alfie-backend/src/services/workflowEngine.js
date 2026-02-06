import cron from 'node-cron';
import chokidar from 'chokidar';
import { v4 as uuidv4 } from 'uuid';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

const WORKFLOW_STATES = ['draft', 'active', 'paused', 'completed', 'failed'];
const DEFAULT_CONCURRENCY = 3;
const DEFAULT_MAX_STEPS = 1000;

function createExecutionRecord({ workflowId, source, payload }) {
  return {
    id: uuidv4(),
    workflowId,
    status: 'running',
    source,
    payload,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    steps: [],
    error: null
  };
}

function getContextRoot(context) {
  return {
    payload: context.payload,
    variables: context.variables,
    results: context.results,
    lastResult: context.lastResult
  };
}

function resolvePath(root, path) {
  if (!path) {
    return undefined;
  }
  const normalized = path.replace(/^\$\./, '');
  const parts = normalized.split('.').filter(Boolean);
  return parts.reduce((acc, part) => {
    if (acc && Object.prototype.hasOwnProperty.call(acc, part)) {
      return acc[part];
    }
    return undefined;
  }, root);
}

function resolveValue(value, context) {
  if (typeof value === 'string') {
    const root = getContextRoot(context);
    if (
      value.startsWith('payload.') ||
      value.startsWith('variables.') ||
      value.startsWith('results.') ||
      value.startsWith('lastResult.') ||
      value.startsWith('$.')
    ) {
      return resolvePath(root, value);
    }
  }
  if (value && typeof value === 'object' && value.path) {
    return resolvePath(getContextRoot(context), value.path);
  }
  return value;
}

function evaluateExpression(expression, context) {
  const root = getContextRoot(context);
  const fn = new Function('payload', 'variables', 'results', 'lastResult', 'context', `return (${expression});`);
  return fn(root.payload, root.variables, root.results, root.lastResult, root);
}

async function delay(ms) {
  if (!ms || ms <= 0) {
    return;
  }
  await new Promise(resolve => setTimeout(resolve, ms));
}

export class WorkflowEngine {
  constructor({ maxConcurrent = DEFAULT_CONCURRENCY } = {}) {
    this.maxConcurrent = maxConcurrent;
    this.workflows = new Map();
    this.executions = new Map();
    this.queue = [];
    this.running = 0;
    this.scheduleTasks = new Map();
    this.fileWatchers = new Map();
    this.webhookIndex = new Map();
    this.templates = this.buildTemplates();
  }

  buildTemplates() {
    return [
      {
        id: 'daily-backup',
        name: 'Daily Backup',
        description: 'Run a nightly backup script on a schedule.',
        trigger: { type: 'schedule', cron: '0 2 * * *' },
        nodes: [
          {
            id: 'trigger',
            type: 'trigger',
            config: { triggerType: 'schedule' },
            next: 'backup-script'
          },
          {
            id: 'backup-script',
            type: 'action',
            config: {
              actionType: 'runScript',
              command: 'tar -czf backup-$(date +%F).tar.gz ./data'
            }
          }
        ],
        startNodeId: 'trigger'
      },
      {
        id: 'file-sync',
        name: 'File Sync',
        description: 'Sync files when changes are detected.',
        trigger: { type: 'fileWatcher', paths: ['./data'], events: ['add', 'change', 'unlink'] },
        nodes: [
          {
            id: 'trigger',
            type: 'trigger',
            config: { triggerType: 'fileWatcher' },
            next: 'sync-script'
          },
          {
            id: 'sync-script',
            type: 'action',
            config: {
              actionType: 'runScript',
              command: 'rsync -av ./data ./backup'
            }
          }
        ],
        startNodeId: 'trigger'
      },
      {
        id: 'api-monitor',
        name: 'API Monitor',
        description: 'Poll an API and alert on failures.',
        trigger: { type: 'schedule', cron: '*/5 * * * *' },
        nodes: [
          {
            id: 'trigger',
            type: 'trigger',
            config: { triggerType: 'schedule' },
            next: 'check-api'
          },
          {
            id: 'check-api',
            type: 'action',
            config: {
              actionType: 'httpRequest',
              method: 'GET',
              url: 'https://api.example.com/health'
            },
            next: 'evaluate-status'
          },
          {
            id: 'evaluate-status',
            type: 'condition',
            config: {
              conditionType: 'compare',
              left: 'lastResult.status',
              operator: '>=',
              right: 200
            },
            onTrue: 'success-notification',
            onFalse: 'failure-notification'
          },
          {
            id: 'success-notification',
            type: 'action',
            config: {
              actionType: 'sendNotification',
              message: 'API health check passed.'
            }
          },
          {
            id: 'failure-notification',
            type: 'action',
            config: {
              actionType: 'sendNotification',
              message: 'API health check failed.'
            }
          }
        ],
        startNodeId: 'trigger'
      },
      {
        id: 'data-pipeline',
        name: 'Data Pipeline',
        description: 'Fetch, transform, and forward data.',
        trigger: { type: 'manual' },
        nodes: [
          {
            id: 'trigger',
            type: 'trigger',
            config: { triggerType: 'manual' },
            next: 'fetch-data'
          },
          {
            id: 'fetch-data',
            type: 'action',
            config: {
              actionType: 'httpRequest',
              method: 'GET',
              url: 'https://api.example.com/data'
            },
            next: 'transform-data'
          },
          {
            id: 'transform-data',
            type: 'action',
            config: {
              actionType: 'transformData',
              expression: '({ ...lastResult.body, processedAt: new Date().toISOString() })'
            },
            next: 'notify-complete'
          },
          {
            id: 'notify-complete',
            type: 'action',
            config: {
              actionType: 'sendNotification',
              message: 'Data pipeline completed.'
            }
          }
        ],
        startNodeId: 'trigger'
      },
      {
        id: 'scheduled-notification',
        name: 'Scheduled Notification',
        description: 'Send a notification on a schedule.',
        trigger: { type: 'schedule', cron: '0 9 * * *' },
        nodes: [
          {
            id: 'trigger',
            type: 'trigger',
            config: { triggerType: 'schedule' },
            next: 'send-notification'
          },
          {
            id: 'send-notification',
            type: 'action',
            config: {
              actionType: 'sendNotification',
              message: 'Daily reminder: check your dashboard.'
            }
          }
        ],
        startNodeId: 'trigger'
      }
    ];
  }

  listWorkflows() {
    return Array.from(this.workflows.values());
  }

  getWorkflow(id) {
    return this.workflows.get(id) || null;
  }

  getExecutions(workflowId) {
    return this.executions.get(workflowId) || [];
  }

  getTemplates() {
    return this.templates;
  }

  createWorkflow(definition) {
    const id = uuidv4();
    const workflow = {
      id,
      name: definition.name || 'Untitled Workflow',
      description: definition.description || '',
      state: WORKFLOW_STATES.includes(definition.state) ? definition.state : 'draft',
      trigger: definition.trigger || { type: 'manual' },
      nodes: definition.nodes || [],
      startNodeId: definition.startNodeId || (definition.nodes?.[0]?.id || null),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      webhookId: definition.webhookId || null,
      settings: definition.settings || {}
    };

    this.ensureWebhook(workflow);
    this.workflows.set(id, workflow);
    if (workflow.state === 'active') {
      this.startTriggers(workflow);
    }
    return workflow;
  }

  updateWorkflow(id, updates) {
    const existing = this.workflows.get(id);
    if (!existing) {
      throw new Error('Workflow not found');
    }

    const prevState = existing.state;
    const updated = {
      ...existing,
      ...updates,
      id,
      updatedAt: new Date().toISOString()
    };

    if (!WORKFLOW_STATES.includes(updated.state)) {
      updated.state = existing.state;
    }

    this.ensureWebhook(updated);
    this.workflows.set(id, updated);

    if (prevState !== 'active' && updated.state === 'active') {
      this.startTriggers(updated);
    }
    if (prevState === 'active' && updated.state !== 'active') {
      this.stopTriggers(id);
    }

    return updated;
  }

  deleteWorkflow(id) {
    const workflow = this.workflows.get(id);
    if (!workflow) {
      throw new Error('Workflow not found');
    }
    this.stopTriggers(id);
    this.workflows.delete(id);
    this.executions.delete(id);
    if (workflow.webhookId) {
      this.webhookIndex.delete(workflow.webhookId);
    }
    return { success: true };
  }

  createFromTemplate(templateId, overrides = {}) {
    const template = this.templates.find(item => item.id === templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    return this.createWorkflow({
      name: template.name,
      description: template.description,
      trigger: template.trigger,
      nodes: template.nodes,
      startNodeId: template.startNodeId,
      state: 'draft',
      ...overrides
    });
  }

  ensureWebhook(workflow) {
    if (workflow.trigger?.type === 'webhook' && !workflow.webhookId) {
      workflow.webhookId = uuidv4();
    }
    if (workflow.webhookId) {
      this.webhookIndex.set(workflow.webhookId, workflow.id);
    }
  }

  startTriggers(workflow) {
    if (workflow.trigger?.type === 'schedule') {
      const task = cron.schedule(workflow.trigger.cron, () => {
        this.enqueueExecution(workflow.id, { trigger: 'schedule' }, 'schedule');
      });
      this.scheduleTasks.set(workflow.id, task);
    }

    if (workflow.trigger?.type === 'fileWatcher') {
      const watcher = chokidar.watch(workflow.trigger.paths || [], {
        ignoreInitial: true,
        persistent: true
      });

      const events = workflow.trigger.events || ['add', 'change', 'unlink'];
      events.forEach(eventName => {
        watcher.on(eventName, filePath => {
          this.enqueueExecution(
            workflow.id,
            { trigger: 'fileWatcher', event: eventName, path: filePath },
            'fileWatcher'
          );
        });
      });

      this.fileWatchers.set(workflow.id, watcher);
    }
  }

  stopTriggers(workflowId) {
    const task = this.scheduleTasks.get(workflowId);
    if (task) {
      task.stop();
      this.scheduleTasks.delete(workflowId);
    }

    const watcher = this.fileWatchers.get(workflowId);
    if (watcher) {
      watcher.close();
      this.fileWatchers.delete(workflowId);
    }
  }

  enqueueExecution(workflowId, payload = {}, source = 'manual') {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }
    if (workflow.state === 'paused' || workflow.state === 'draft') {
      throw new Error('Workflow is not active');
    }
    const execution = createExecutionRecord({ workflowId, source, payload });
    const history = this.executions.get(workflowId) || [];
    history.unshift(execution);
    this.executions.set(workflowId, history.slice(0, 100));
    this.queue.push({ workflow, execution });
    this.processQueue();
    return execution;
  }

  triggerWebhook(webhookId, payload = {}) {
    const workflowId = this.webhookIndex.get(webhookId);
    if (!workflowId) {
      throw new Error('Webhook not found');
    }
    return this.enqueueExecution(workflowId, payload, 'webhook');
  }

  async processQueue() {
    if (this.running >= this.maxConcurrent) {
      return;
    }
    const next = this.queue.shift();
    if (!next) {
      return;
    }
    this.running += 1;
    this.executeWorkflow(next.workflow, next.execution)
      .catch(() => {})
      .finally(() => {
        this.running -= 1;
        this.processQueue();
      });
  }

  async executeWorkflow(workflow, execution) {
    const context = {
      payload: execution.payload,
      variables: { workflowId: workflow.id },
      results: {},
      lastResult: null
    };

    try {
      const nodes = new Map(workflow.nodes.map(node => [node.id, node]));
      let currentNodeId = workflow.startNodeId;
      let steps = 0;

      while (currentNodeId) {
        if (steps > DEFAULT_MAX_STEPS) {
          throw new Error('Max execution steps exceeded');
        }
        steps += 1;
        const node = nodes.get(currentNodeId);
        if (!node) {
          throw new Error(`Node not found: ${currentNodeId}`);
        }
        const startedAt = new Date().toISOString();
        let result = null;
        try {
          result = await this.executeNode(node, context, nodes);
          context.results[node.id] = result;
          context.lastResult = result;
          execution.steps.push({
            nodeId: node.id,
            type: node.type,
            status: 'completed',
            startedAt,
            finishedAt: new Date().toISOString(),
            result
          });
          currentNodeId = result?.nextNodeId || null;
        } catch (error) {
          execution.steps.push({
            nodeId: node.id,
            type: node.type,
            status: 'failed',
            startedAt,
            finishedAt: new Date().toISOString(),
            error: error.message
          });
          throw error;
        }
      }

      execution.status = 'completed';
      execution.finishedAt = new Date().toISOString();
      this.onWorkflowSuccess(workflow, execution);
    } catch (error) {
      execution.status = 'failed';
      execution.error = error.message;
      execution.finishedAt = new Date().toISOString();
      this.onWorkflowFailure(workflow, execution);
    }
  }

  onWorkflowSuccess(workflow) {
    if (['schedule', 'webhook', 'fileWatcher'].includes(workflow.trigger?.type)) {
      if (workflow.state === 'active') {
        return;
      }
    }
    if (workflow.state !== 'failed') {
      workflow.state = 'completed';
      workflow.updatedAt = new Date().toISOString();
    }
  }

  onWorkflowFailure(workflow) {
    workflow.state = 'failed';
    workflow.updatedAt = new Date().toISOString();
  }

  async executeNode(node, context, nodes) {
    switch (node.type) {
      case 'trigger':
        return { nextNodeId: node.next || null, trigger: node.config?.triggerType };
      case 'action':
        return this.executeAction(node, context);
      case 'condition':
        return this.executeCondition(node, context);
      case 'loop':
        return this.executeLoop(node, context, nodes);
      default:
        throw new Error(`Unsupported node type: ${node.type}`);
    }
  }

  async executeAction(node, context) {
    const config = node.config || {};
    const actionType = config.actionType;

    if (actionType === 'httpRequest') {
      const method = config.method || 'GET';
      const headers = config.headers || {};
      const body = config.body;
      const controller = new AbortController();
      const timeout = config.timeout || 10000;
      const timer = setTimeout(() => controller.abort(), timeout);
      let fetchBody = body;
      if (body && typeof body === 'object') {
        fetchBody = JSON.stringify(body);
        headers['content-type'] = headers['content-type'] || 'application/json';
      }
      const response = await fetch(config.url, {
        method,
        headers,
        body: fetchBody,
        signal: controller.signal
      });
      clearTimeout(timer);
      const text = await response.text();
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
      return {
        nextNodeId: node.next || null,
        status: response.status,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
        body: parsed
      };
    }

    if (actionType === 'runScript') {
      const { stdout, stderr } = await execAsync(config.command, {
        cwd: config.cwd || process.cwd(),
        timeout: config.timeout || 20000
      });
      return { nextNodeId: node.next || null, stdout, stderr };
    }

    if (actionType === 'sendNotification') {
      return {
        nextNodeId: node.next || null,
        channel: config.channel || 'default',
        message: config.message || ''
      };
    }

    if (actionType === 'transformData') {
      const result = evaluateExpression(config.expression || 'payload', context);
      return { nextNodeId: node.next || null, transformed: result };
    }

    if (actionType === 'delay') {
      const ms = config.ms || (config.seconds ? config.seconds * 1000 : 0);
      await delay(ms);
      return { nextNodeId: node.next || null, delayed: ms };
    }

    throw new Error(`Unsupported action type: ${actionType}`);
  }

  async executeCondition(node, context) {
    const config = node.config || {};
    let conditionMet = false;
    if (config.conditionType === 'expression' || config.expression) {
      conditionMet = Boolean(evaluateExpression(config.expression || 'false', context));
    } else if (config.conditionType === 'compare' || config.operator) {
      const left = resolveValue(config.left, context);
      const right = resolveValue(config.right, context);
      switch (config.operator) {
        case '==':
          conditionMet = left === right;
          break;
        case '!=':
          conditionMet = left !== right;
          break;
        case '===':
          conditionMet = left === right;
          break;
        case '!==':
          conditionMet = left !== right;
          break;
        case '>':
          conditionMet = left > right;
          break;
        case '>=':
          conditionMet = left >= right;
          break;
        case '<':
          conditionMet = left < right;
          break;
        case '<=':
          conditionMet = left <= right;
          break;
        case 'includes':
          conditionMet = Array.isArray(left) ? left.includes(right) : false;
          break;
        default:
          conditionMet = false;
      }
    }

    return {
      nextNodeId: conditionMet ? node.onTrue || null : node.onFalse || null,
      conditionMet
    };
  }

  async executeLoop(node, context, nodes) {
    const config = node.config || {};
    const loopType = config.loopType;
    const maxIterations = config.maxIterations || 100;
    const body = config.body || node.body;

    const runBody = async iterationContext => {
      if (Array.isArray(body)) {
        for (const nodeId of body) {
          const bodyNode = nodes.get(nodeId);
          if (!bodyNode) {
            throw new Error(`Loop body node not found: ${nodeId}`);
          }
          const result = await this.executeNode(bodyNode, iterationContext, nodes);
          iterationContext.results[bodyNode.id] = result;
          iterationContext.lastResult = result;
        }
        return;
      }
      if (typeof body === 'string') {
        let currentNodeId = body;
        while (currentNodeId) {
          const bodyNode = nodes.get(currentNodeId);
          if (!bodyNode) {
            throw new Error(`Loop body node not found: ${currentNodeId}`);
          }
          const result = await this.executeNode(bodyNode, iterationContext, nodes);
          iterationContext.results[bodyNode.id] = result;
          iterationContext.lastResult = result;
          currentNodeId = result?.nextNodeId || null;
        }
      }
    };

    if (loopType === 'forEach') {
      const items = config.items || resolveValue(config.itemsPath, context) || [];
      const itemVar = config.itemVariable || 'item';
      if (!Array.isArray(items)) {
        throw new Error('forEach loop requires an array');
      }
      let iterations = 0;
      for (const item of items) {
        if (iterations >= maxIterations) {
          break;
        }
        context.variables[itemVar] = item;
        await runBody(context);
        iterations += 1;
      }
      return { nextNodeId: node.next || null, iterations };
    }

    if (loopType === 'while') {
      let iterations = 0;
      while (iterations < maxIterations) {
        const conditionMet = Boolean(evaluateExpression(config.conditionExpression || 'false', context));
        if (!conditionMet) {
          break;
        }
        await runBody(context);
        iterations += 1;
      }
      return { nextNodeId: node.next || null, iterations };
    }

    if (loopType === 'counter') {
      const from = config.from ?? 0;
      const to = config.to ?? 0;
      const step = config.step ?? 1;
      const counterVar = config.counterVariable || 'counter';
      let iterations = 0;
      for (let i = from; step > 0 ? i <= to : i >= to; i += step) {
        if (iterations >= maxIterations) {
          break;
        }
        context.variables[counterVar] = i;
        await runBody(context);
        iterations += 1;
      }
      return { nextNodeId: node.next || null, iterations };
    }

    throw new Error(`Unsupported loop type: ${loopType}`);
  }
}

const workflowEngine = new WorkflowEngine();

export default workflowEngine;
