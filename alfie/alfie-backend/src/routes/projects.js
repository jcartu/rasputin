import { Router } from 'express';
import * as projectService from '../services/projectService.js';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const userId = req.auth.user.id;
    const { name, description, instructions, knowledgeBase, settings } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'name required' });
    }
    const project = await projectService.createProject(userId, {
      name,
      description,
      instructions,
      knowledgeBase,
      settings,
    });
    if (project?.error) {
      return res.status(500).json({ error: project.error });
    }
    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const userId = req.auth.user.id;
    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = parseInt(req.query.offset, 10) || 0;
    const projects = await projectService.listProjects(userId, limit, offset);
    if (projects?.error) {
      return res.status(500).json({ error: projects.error });
    }
    res.json({ projects });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const userId = req.auth.user.id;
    const project = await projectService.getProject(userId, req.params.id);
    if (project?.error) {
      return res.status(500).json({ error: project.error });
    }
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const conversations = await projectService.getProjectConversations(userId, req.params.id);
    res.json({ ...project, conversations: conversations || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const userId = req.auth.user.id;
    const { name, description, instructions, settings } = req.body;
    if (name === undefined && description === undefined && instructions === undefined && settings === undefined) {
      return res.status(400).json({ error: 'name, description, instructions, or settings required' });
    }
    const project = await projectService.updateProject(userId, req.params.id, {
      name,
      description,
      instructions,
      settings,
    });
    if (project?.error) {
      return res.status(500).json({ error: project.error });
    }
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const userId = req.auth.user.id;
    const result = await projectService.deleteProject(userId, req.params.id);
    if (result?.error) {
      return res.status(500).json({ error: result.error });
    }
    if (!result?.deleted) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ deleted: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/conversations', async (req, res) => {
  try {
    const userId = req.auth.user.id;
    const { threadId } = req.body;
    if (!threadId) {
      return res.status(400).json({ error: 'threadId required' });
    }
    const result = await projectService.addConversation(userId, req.params.id, threadId);
    if (result?.error) {
      return res.status(500).json({ error: result.error });
    }
    if (!result) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id/conversations/:threadId', async (req, res) => {
  try {
    const userId = req.auth.user.id;
    const result = await projectService.removeConversation(userId, req.params.id, req.params.threadId);
    if (result?.error) {
      return res.status(500).json({ error: result.error });
    }
    if (!result) {
      return res.status(404).json({ error: 'Project not found' });
    }
    if (!result.removed) {
      return res.status(404).json({ error: 'Conversation not in project' });
    }
    res.json({ removed: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
