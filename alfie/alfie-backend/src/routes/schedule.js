import express from 'express';
import * as schedulerService from '../services/schedulerService.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const userId = req.auth.user.id;
    const { name, cronExpression, taskInput, maxRuns } = req.body;
    if (!name || !cronExpression || !taskInput) {
      return res.status(400).json({ error: 'name, cronExpression, and taskInput required' });
    }
    const schedule = await schedulerService.createSchedule(userId, { name, cronExpression, taskInput, maxRuns });
    res.status(201).json(schedule);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const userId = req.auth.user.id;
    const schedules = await schedulerService.listSchedules(userId);
    res.json({ schedules });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const userId = req.auth.user.id;
    const deleted = await schedulerService.deleteSchedule(userId, req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    res.json({ deleted: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const userId = req.auth.user.id;
    const { isActive } = req.body;
    if (isActive === undefined) {
      return res.status(400).json({ error: 'isActive required' });
    }
    await schedulerService.toggleSchedule(userId, req.params.id, isActive);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
