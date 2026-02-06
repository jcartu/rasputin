import { Router } from 'express';
import * as backupService from '../services/backupService.js';
import * as scheduler from '../services/scheduler.js';

const router = Router();

router.post('/create', async (req, res) => {
  try {
    const { types, strategy, encrypt, password, name, description } = req.body;
    
    const backup = await backupService.createBackup({
      types,
      strategy,
      encrypt,
      password,
      name,
      description,
    });
    
    res.json({ success: true, backup });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/list', async (req, res) => {
  try {
    const { type, status, limit, offset } = req.query;
    
    const result = await backupService.listBackups({
      type,
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/statistics', async (req, res) => {
  try {
    const stats = await backupService.getStatistics();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/point-in-time', async (req, res) => {
  try {
    const { type } = req.query;
    const options = await backupService.getPointInTimeOptions(type);
    res.json({ options });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const backup = await backupService.getBackup(req.params.id);
    res.json(backup);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

router.get('/:id/chain', async (req, res) => {
  try {
    const chain = await backupService.getBackupChain(req.params.id);
    res.json({ chain, count: chain.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/verify', async (req, res) => {
  try {
    const result = await backupService.verifyBackup(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/restore', async (req, res) => {
  try {
    const { password, targetDir, dryRun, components } = req.body;
    
    const result = await backupService.restoreBackup(req.params.id, {
      password,
      targetDir,
      dryRun,
      components,
    });
    
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await backupService.deleteBackup(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/schedules/list', (req, res) => {
  try {
    const schedules = scheduler.listSchedules();
    res.json({ schedules, count: schedules.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/schedules/status', (req, res) => {
  try {
    const status = scheduler.getSchedulerStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/schedules/create', (req, res) => {
  try {
    const schedule = scheduler.createSchedule(req.body);
    res.json({ success: true, schedule });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/schedules/:id', (req, res) => {
  try {
    const schedule = scheduler.getSchedule(req.params.id);
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    res.json(schedule);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/schedules/:id', (req, res) => {
  try {
    const schedule = scheduler.updateSchedule(req.params.id, req.body);
    res.json({ success: true, schedule });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/schedules/:id/stop', (req, res) => {
  try {
    const stopped = scheduler.stopSchedule(req.params.id);
    res.json({ success: stopped });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/schedules/:id/resume', (req, res) => {
  try {
    const resumed = scheduler.resumeSchedule(req.params.id);
    res.json({ success: resumed });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/schedules/:id/trigger', async (req, res) => {
  try {
    const backup = await scheduler.triggerBackupNow(req.params.id);
    res.json({ success: true, backup });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/schedules/:id', (req, res) => {
  try {
    const deleted = scheduler.deleteSchedule(req.params.id);
    res.json({ success: deleted });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/retention/list', (req, res) => {
  try {
    const policies = scheduler.listRetentionPolicies();
    res.json({ policies, count: policies.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/retention/create', (req, res) => {
  try {
    const policy = scheduler.createRetentionPolicy(req.body);
    res.json({ success: true, policy });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/retention/:id', (req, res) => {
  try {
    const policy = scheduler.getRetentionPolicy(req.params.id);
    if (!policy) {
      return res.status(404).json({ error: 'Retention policy not found' });
    }
    res.json(policy);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/retention/:id', (req, res) => {
  try {
    const policy = scheduler.updateRetentionPolicy(req.params.id, req.body);
    res.json({ success: true, policy });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/retention/:id/apply', async (req, res) => {
  try {
    const result = await scheduler.applyRetentionPolicy(req.params.id);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/retention/:id', (req, res) => {
  try {
    const deleted = scheduler.deleteRetentionPolicy(req.params.id);
    res.json({ success: deleted });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/types', (req, res) => {
  res.json({
    types: Object.values(backupService.BackupType),
    strategies: Object.values(backupService.BackupStrategy),
    statuses: Object.values(backupService.BackupStatus),
  });
});

export default router;
