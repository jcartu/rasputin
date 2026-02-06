import express from 'express';
import workflowEngine from '../services/workflowEngine.js';

const router = express.Router();

router.get('/api/workflows/templates', (req, res) => {
  try {
    const templates = workflowEngine.getTemplates();
    res.json({ templates, count: templates.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch templates', details: error.message });
  }
});

router.post('/api/workflows/from-template/:templateId', (req, res) => {
  try {
    const workflow = workflowEngine.createFromTemplate(req.params.templateId, req.body || {});
    res.status(201).json({
      workflow,
      webhookUrl: workflow.webhookId ? `/api/workflows/webhook/${workflow.webhookId}` : null
    });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

router.post('/api/workflows/webhook/:webhookId', (req, res) => {
  try {
    const execution = workflowEngine.triggerWebhook(req.params.webhookId, req.body || {});
    res.json({ execution });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

router.get('/api/workflows', (req, res) => {
  try {
    const workflows = workflowEngine.listWorkflows();
    res.json({ workflows, count: workflows.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch workflows', details: error.message });
  }
});

router.post('/api/workflows', (req, res) => {
  try {
    const workflow = workflowEngine.createWorkflow(req.body || {});
    res.status(201).json({
      workflow,
      webhookUrl: workflow.webhookId ? `/api/workflows/webhook/${workflow.webhookId}` : null
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/api/workflows/:id', (req, res) => {
  try {
    const workflow = workflowEngine.getWorkflow(req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    res.json({
      workflow,
      webhookUrl: workflow.webhookId ? `/api/workflows/webhook/${workflow.webhookId}` : null
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch workflow', details: error.message });
  }
});

router.put('/api/workflows/:id', (req, res) => {
  try {
    const workflow = workflowEngine.updateWorkflow(req.params.id, req.body || {});
    res.json({
      workflow,
      webhookUrl: workflow.webhookId ? `/api/workflows/webhook/${workflow.webhookId}` : null
    });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

router.delete('/api/workflows/:id', (req, res) => {
  try {
    const result = workflowEngine.deleteWorkflow(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

router.post('/api/workflows/:id/execute', (req, res) => {
  try {
    const execution = workflowEngine.enqueueExecution(req.params.id, req.body || {}, 'manual');
    res.json({ execution });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/api/workflows/:id/executions', (req, res) => {
  try {
    const executions = workflowEngine.getExecutions(req.params.id);
    res.json({ executions, count: executions.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch executions', details: error.message });
  }
});

export default router;
