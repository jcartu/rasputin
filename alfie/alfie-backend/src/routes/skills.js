import { Router } from 'express';
import * as skillsService from '../services/skillsService.js';
import * as queueService from '../services/queueService.js';
import * as agentDb from '../services/agentDbService.js';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const userId = req.auth.user.id;
    const { name, description, category, taskTemplate, variables, model, isPublic } = req.body;

    if (!name || !taskTemplate) {
      return res.status(400).json({ error: 'name and taskTemplate required' });
    }

    const skill = await skillsService.createSkill(userId, {
      name,
      description,
      category,
      taskTemplate,
      variables,
      model,
      isPublic,
    });

    return res.status(201).json(skill);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const userId = req.auth.user.id;
    const { category, includePublic } = req.query;

    const skills = await skillsService.listSkills(userId, {
      category,
      includePublic: includePublic !== 'false',
    });

    return res.json({ skills });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const skill = await skillsService.getSkill(req.params.id);
    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' });
    }
    return res.json(skill);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const userId = req.auth.user.id;
    const updates = req.body;

    const skill = await skillsService.updateSkill(userId, req.params.id, updates);
    if (!skill) {
      return res.status(404).json({ error: 'Skill not found or access denied' });
    }
    return res.json(skill);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const userId = req.auth.user.id;
    const deleted = await skillsService.deleteSkill(userId, req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Skill not found or access denied' });
    }
    return res.json({ deleted: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/:id/run', async (req, res) => {
  try {
    const userId = req.auth.user.id;
    const { variables } = req.body;

    const { taskInput, model } = await skillsService.useSkill(req.params.id, variables || {});

    const dbTask = await agentDb.createTask(userId, taskInput, { model });
    const job = await queueService.addAgentTask(userId, taskInput, { model });

    await agentDb.updateTaskStatus(dbTask.id, 'pending', {
      metadata: { ...dbTask.metadata, jobId: job.id, skillId: req.params.id },
    });

    return res.status(201).json({
      taskId: dbTask.id,
      jobId: job.id,
      status: 'pending',
      taskInput,
    });
  } catch (error) {
    if (error.message === 'Skill not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message });
  }
});

export default router;
