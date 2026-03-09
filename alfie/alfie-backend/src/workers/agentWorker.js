import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { AgentStateMachine } from '../services/agentStateMachine.js';
import * as agentDb from '../services/agentDbService.js';
import { ReActExecutor } from '../agent/ReActExecutor.js';
import { ToolRegistry } from '../agent/ToolRegistry.js';
import { WebSearchTool } from '../agent/tools/WebSearchTool.js';
import { FileOperationsTool } from '../agent/tools/FileOperationsTool.js';
import { CodeSandboxTool } from '../agent/tools/CodeSandboxTool.js';
import { BrowserTool } from '../agent/tools/BrowserTool.js';
import { ImageGenerationTool } from '../agent/tools/ImageGenerationTool.js';

function buildToolRegistry() {
  const registry = new ToolRegistry();
  registry.register(new WebSearchTool());
  registry.register(new FileOperationsTool());
  registry.register(new CodeSandboxTool());
  registry.register(new BrowserTool());
  registry.register(new ImageGenerationTool());
  return registry;
}

const QUEUE_NAME = 'agent-tasks';

function getConnection() {
  return new IORedis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    maxRetriesPerRequest: null,
  });
}

async function processAgentTask(job) {
  const { userId, input, model, maxSteps, dbTaskId } = job.data;

  let task;
  if (dbTaskId) {
    task = await agentDb.getTask(dbTaskId);
    if (!task) {
      throw new Error(`Task ${dbTaskId} not found in DB`);
    }
  } else {
    task = await agentDb.createTask(userId, input, {
      model,
      maxSteps: maxSteps || 30,
      taskType: job.data.taskType || 'general',
      jobId: job.id,
    });
  }

  const sm = new AgentStateMachine(task.id, { maxSteps: task.max_steps });

  sm.transition('running');
  await agentDb.updateTaskStatus(task.id, 'running', { started_at: new Date() });
  await job.updateProgress({ status: 'running', taskId: task.id, iteration: 0 });

  try {
    const registry = buildToolRegistry();
    const executor = new ReActExecutor({
      model: model || 'claude-opus-4-6',
      maxIterations: sm.maxIterations,
      toolRegistry: registry,
      onThinking: async (data) => {
        if (sm.canTransition('thinking')) sm.transition('thinking');
        const progress = Math.round((data.iteration / sm.maxIterations) * 100);
        await agentDb.updateTaskStatus(task.id, 'thinking', {
          current_step: data.iteration,
          progress,
        });
        await job.updateProgress({ status: 'thinking', taskId: task.id, userId, iteration: data.iteration, progress, content: data.content });
        if (data.content) {
          await agentDb.addStep(task.id, { type: 'thinking', thinking: data.content });
        }
      },
      onToolCall: async (data) => {
        if (sm.canTransition('acting')) sm.transition('acting');
        await agentDb.updateTaskStatus(task.id, 'acting');
        await job.updateProgress({ status: 'acting', taskId: task.id, userId, iteration: data.iteration, tool: data.tool, input: data.input });
      },
      onToolResult: async (data) => {
        if (sm.canTransition('observing')) sm.transition('observing');
        await agentDb.addStep(task.id, {
          type: 'tool_call',
          tool_name: data.tool,
          tool_input: data.input,
          tool_output: { output: data.result, success: data.success },
          status: data.success ? 'completed' : 'failed',
        });
        await job.updateProgress({ status: 'observing', taskId: task.id, userId, iteration: data.iteration, tool: data.tool, result: data.result, success: data.success });
      },
      onComplete: async (data) => {
        sm.transition('completed');
        await agentDb.updateTaskStatus(task.id, 'completed', {
          output: data.output,
          progress: 100,
          completed_at: new Date(),
        });
      },
      onError: async (data) => {
        await job.updateProgress({ status: 'error', taskId: task.id, userId, iteration: data.iteration, error: data.error });
      },
    });

    const result = await executor.execute(input, { userId, taskId: task.id });
    
    await job.updateProgress({ status: 'completed', taskId: task.id, userId, progress: 100 });
    return { taskId: task.id, status: 'completed', output: result.output, userId, iterations: result.iterations };
  } catch (error) {
    try {
      if (sm.canTransition('failed')) {
        sm.transition('failed');
      }
      await agentDb.updateTaskStatus(task.id, 'failed', {
        error: error.message,
        completed_at: new Date(),
      });
    } catch (dbError) {
      console.error('Failed to update task status on error:', dbError);
    }
    await job.updateProgress({ status: 'failed', taskId: task.id, error: error.message });
    throw error;
  }
}

export function startWorker() {
  const worker = new Worker(QUEUE_NAME, processAgentTask, {
    connection: getConnection(),
    concurrency: 3,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  });

  worker.on('completed', (job, result) => {
    console.log(`Agent task ${job.id} completed:`, result?.status);
  });

  worker.on('failed', (job, error) => {
    console.error(`Agent task ${job?.id} failed:`, error.message);
  });

  return worker;
}

if (process.argv[1]?.includes('agentWorker')) {
  import('dotenv').then((d) => d.config());
  console.log('Starting agent worker...');
  startWorker();
}
