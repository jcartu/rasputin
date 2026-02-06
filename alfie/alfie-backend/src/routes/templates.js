import { Router } from 'express';
import * as templateManager from '../services/templateManager.js';

const router = Router();

router.get('/', (req, res) => {
  try {
    const { category, search, featured } = req.query;
    
    let templates;
    
    if (featured === 'true') {
      templates = templateManager.getFeaturedTemplates(parseInt(req.query.limit) || 6);
    } else if (search) {
      templates = templateManager.searchTemplates(search);
    } else if (category) {
      templates = templateManager.getTemplatesByCategory(category);
    } else {
      templates = templateManager.getAllTemplates();
    }
    
    res.json({ templates, count: templates.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch templates', details: error.message });
  }
});

router.get('/categories', (req, res) => {
  try {
    const categories = templateManager.getCategories();
    res.json({ categories });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories', details: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const template = templateManager.getTemplate(req.params.id);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.json(template);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch template', details: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, description, category, icon, variables, systemPrompt, initialMessage, tags, author } = req.body;
    
    if (!name || !systemPrompt) {
      return res.status(400).json({ error: 'Name and systemPrompt are required' });
    }
    
    const template = await templateManager.createTemplate({
      name,
      description: description || '',
      category: category || 'custom',
      icon: icon || 'file-text',
      variables: variables || [],
      systemPrompt,
      initialMessage: initialMessage || '',
      tags: tags || [],
      author: author || 'User'
    });
    
    res.status(201).json(template);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create template', details: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const template = await templateManager.updateTemplate(req.params.id, req.body);
    res.json(template);
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to update template', details: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await templateManager.deleteTemplate(req.params.id);
    res.json(result);
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to delete template', details: error.message });
  }
});

router.post('/:id/use', async (req, res) => {
  try {
    const { variables } = req.body;
    const template = templateManager.getTemplate(req.params.id);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    await templateManager.incrementUsage(req.params.id);
    
    const applied = variables 
      ? templateManager.applyVariables(template, variables)
      : template;
    
    res.json({
      template: applied,
      sessionConfig: {
        systemPrompt: applied.systemPrompt,
        initialMessage: applied.initialMessage
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to use template', details: error.message });
  }
});

router.post('/:id/duplicate', async (req, res) => {
  try {
    const originalTemplate = templateManager.getTemplate(req.params.id);
    
    if (!originalTemplate) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    const { name } = req.body;
    const newTemplate = await templateManager.createTemplate({
      ...originalTemplate,
      name: name || `${originalTemplate.name} (Copy)`,
      author: req.body.author || 'User'
    });
    
    res.status(201).json(newTemplate);
  } catch (error) {
    res.status(500).json({ error: 'Failed to duplicate template', details: error.message });
  }
});

export default router;
