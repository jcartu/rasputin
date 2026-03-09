import { Queue, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';

const QUEUE_NAME = 'agent-tasks';
let connection;
let queue;
let queueEvents;

function getRedisHost() {
  return process.env.REDIS_HOST || 'localhost';
}

function getRedisPort() {
  return parseInt(process.env.REDIS_PORT || '6379', 10);
}

function getConnection() {
  if (!connection) {
    connection = new IORedis({
      host: getRedisHost(),
      port: getRedisPort(),
      maxRetriesPerRequest: null,
    });
  }
  return connection;
}

export function getQueue() {
  if (!queue) {
    queue = new Queue(QUEUE_NAME, { connection: getConnection() });
  }
  return queue;
}

export function getQueueEvents() {
  if (!queueEvents) {
    queueEvents = new QueueEvents(QUEUE_NAME, { connection: getConnection() });
  }
  return queueEvents;
}

export async function addAgentTask(userId, taskInput, options = {}) {
  const q = getQueue();
  const job = await q.add(
    'execute-agent',
    {
      userId,
      input: taskInput,
      model: options.model || null,
      taskType: options.taskType || 'general',
      maxSteps: options.maxSteps || 30,
      dbTaskId: options.dbTaskId || null,
    },
    {
      attempts: 1,
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    }
  );
  return job;
}

export async function cancelAgentTask(jobId) {
  const q = getQueue();
  const job = await q.getJob(jobId);
  if (job) {
    await job.updateData({ ...job.data, cancelled: true });
    const state = await job.getState();
    if (state === 'waiting' || state === 'delayed') {
      await job.remove();
      return { cancelled: true, state: 'removed' };
    }
    return { cancelled: true, state: 'signalled' };
  }
  return { cancelled: false, error: 'Job not found' };
}

export async function healthCheck() {
  try {
    const conn = getConnection();
    const pong = await conn.ping();
    return { status: pong === 'PONG' ? 'connected' : 'error' };
  } catch (error) {
    return { status: 'error', error: error.message };
  }
}

export default { getQueue, getQueueEvents, addAgentTask, cancelAgentTask, healthCheck };
