import { Router } from 'express';
import * as webhookService from '../services/webhookService.js';

const router = Router();

router.get('/', (req, res) => {
  try {
    const webhooks = webhookService.listWebhooks();
    res.json({ webhooks });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list webhooks', details: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { name, url, events, description, headers, template, retryCount, retryDelay, timeout, enabled } = req.body;
    
    if (!name || !url) {
      return res.status(400).json({ error: 'Name and URL are required' });
    }
    
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }
    
    const webhook = webhookService.createWebhook({
      name,
      url,
      events: events || [],
      description,
      headers,
      template,
      retryCount,
      retryDelay,
      timeout,
      enabled,
    });
    
    res.status(201).json(webhook);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create webhook', details: error.message });
  }
});

router.get('/events', (req, res) => {
  try {
    const events = webhookService.getEventTypes();
    res.json({ events });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get event types', details: error.message });
  }
});

router.get('/logs', (req, res) => {
  try {
    const { limit, offset, status, eventType, webhookId } = req.query;
    const logs = webhookService.getAllLogs({
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
      status,
      eventType,
      webhookId,
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get logs', details: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const webhook = webhookService.getWebhookSafe(req.params.id);
    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }
    res.json(webhook);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get webhook', details: error.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { name, url, events, description, headers, template, retryCount, retryDelay, timeout, enabled } = req.body;
    
    if (url) {
      try {
        new URL(url);
      } catch {
        return res.status(400).json({ error: 'Invalid URL format' });
      }
    }
    
    const webhook = webhookService.updateWebhook(req.params.id, {
      name,
      url,
      events,
      description,
      headers,
      template,
      retryCount,
      retryDelay,
      timeout,
      enabled,
    });
    
    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }
    
    res.json(webhook);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update webhook', details: error.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const deleted = webhookService.deleteWebhook(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Webhook not found' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete webhook', details: error.message });
  }
});

router.post('/:id/regenerate-secret', (req, res) => {
  try {
    const secret = webhookService.regenerateSecret(req.params.id);
    if (!secret) {
      return res.status(404).json({ error: 'Webhook not found' });
    }
    res.json({ secret });
  } catch (error) {
    res.status(500).json({ error: 'Failed to regenerate secret', details: error.message });
  }
});

router.post('/:id/test', async (req, res) => {
  try {
    const result = await webhookService.testWebhook(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to test webhook', details: error.message });
  }
});

router.get('/:id/logs', (req, res) => {
  try {
    const { limit, offset, status, eventType } = req.query;
    const logs = webhookService.getWebhookLogs(req.params.id, {
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
      status,
      eventType,
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get webhook logs', details: error.message });
  }
});

router.get('/:id/stats', (req, res) => {
  try {
    const webhook = webhookService.getWebhookSafe(req.params.id);
    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }
    const stats = webhookService.getWebhookStats(req.params.id);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get webhook stats', details: error.message });
  }
});

router.delete('/:id/logs', (req, res) => {
  try {
    const { olderThan } = req.query;
    const result = webhookService.clearWebhookLogs(req.params.id, { olderThan });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear webhook logs', details: error.message });
  }
});

router.post('/logs/:logId/retry', async (req, res) => {
  try {
    const result = await webhookService.retryDelivery(req.params.logId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retry delivery', details: error.message });
  }
});

export default router;
