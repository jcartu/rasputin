import { Router } from 'express';
import * as queueService from '../services/queueService.js';
import * as agentDb from '../services/agentDbService.js';

const router = Router();

router.post('/run', async (req, res) => {
  try {
    const userId = req.auth.user.id;
    const { task, model, maxSteps } = req.body;

    if (!task) {
      return res.status(400).json({ error: 'task required' });
    }

    const dbTask = await agentDb.createTask(userId, task, { model, maxSteps });
    const job = await queueService.addAgentTask(userId, task, { model, maxSteps, dbTaskId: dbTask.id });

    return res.status(201).json({
      taskId: dbTask.id,
      jobId: job.id,
      status: 'pending',
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/tasks', async (req, res) => {
  try {
    const userId = req.auth.user.id;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = parseInt(req.query.offset, 10) || 0;

    const tasks = await agentDb.getTasksByUser(userId, limit, offset);
    return res.json({ tasks });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/:taskId', async (req, res) => {
  try {
    const userId = req.auth.user.id;
    const { taskId } = req.params;

    const task = await agentDb.getTask(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (task.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const steps = await agentDb.getSteps(taskId);
    return res.json({ task, steps });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/:taskId/cancel', async (req, res) => {
  try {
    const userId = req.auth.user.id;
    const { taskId } = req.params;

    const task = await agentDb.getTask(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (task.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const jobId = task.metadata?.jobId;
    if (jobId) {
      await queueService.cancelAgentTask(jobId);
    }

    const updated = await agentDb.updateTaskStatus(taskId, 'cancelled');
    return res.json({ task: updated, cancelled: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
