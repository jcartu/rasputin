import express from 'express';
import * as modelService from '../services/modelService.js';

const router = express.Router();

router.get('/api/models', (req, res) => {
  try {
    const models = modelService.getModels();
    const providers = modelService.getProviders();
    res.json({ models, providers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/models/:id', (req, res) => {
  try {
    const model = modelService.getModelById(req.params.id);
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }
    res.json(model);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/api/models/:id', (req, res) => {
  try {
    const result = modelService.uninstallModel(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/api/models/active', (req, res) => {
  try {
    const { modelId } = req.body;
    if (!modelId) {
      return res.status(400).json({ error: 'modelId required' });
    }
    const result = modelService.setActiveModel(modelId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/api/models/test', async (req, res) => {
  try {
    const { modelId, prompt } = req.body;
    if (!modelId) {
      return res.status(400).json({ error: 'modelId required' });
    }
    const result = await modelService.testModel(modelId, prompt);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/models/compare', async (req, res) => {
  try {
    const { modelIds, prompt, temperature = 0.7, maxTokens = 1024 } = req.body;
    
    if (!modelIds || !Array.isArray(modelIds) || modelIds.length < 2) {
      return res.status(400).json({ error: 'At least 2 modelIds required' });
    }
    if (!prompt) {
      return res.status(400).json({ error: 'prompt required' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const promises = modelIds.map(async (modelId) => {
      res.write(`data: ${JSON.stringify({ modelId, status: 'streaming' })}\n\n`);
      
      try {
        const result = await modelService.testModel(modelId, prompt);
        
        const model = modelService.getModelById(modelId);
        const inputTokens = Math.ceil(prompt.length / 4);
        const outputTokens = Math.ceil((result.response || '').length / 4);
        const cost = model 
          ? (inputTokens * model.pricing.inputPerMillion / 1000000) + (outputTokens * model.pricing.outputPerMillion / 1000000)
          : 0;

        res.write(`data: ${JSON.stringify({
          modelId,
          status: 'complete',
          response: result.response || result.error,
          latency: result.latency,
          inputTokens,
          outputTokens,
          cost,
        })}\n\n`);
      } catch (error) {
        res.write(`data: ${JSON.stringify({
          modelId,
          status: 'error',
          error: error.message,
        })}\n\n`);
      }
    });

    await Promise.all(promises);
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

router.get('/api/models/providers', (req, res) => {
  try {
    const providers = modelService.getProviders();
    res.json({ providers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/models/providers/:id/test', async (req, res) => {
  try {
    const result = await modelService.testProvider(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/models/endpoints', (req, res) => {
  try {
    const endpoints = modelService.getCustomEndpoints();
    res.json({ endpoints });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/models/endpoints', (req, res) => {
  try {
    const { name, baseUrl, apiKey, provider, models } = req.body;
    if (!name || !baseUrl) {
      return res.status(400).json({ error: 'name and baseUrl required' });
    }
    const endpoint = modelService.addCustomEndpoint({
      name,
      baseUrl,
      apiKey,
      provider: provider || 'openai-compatible',
      models: models || [],
    });
    res.json(endpoint);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/api/models/endpoints/:id', (req, res) => {
  try {
    const endpoint = modelService.updateCustomEndpoint(req.params.id, req.body);
    res.json(endpoint);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/api/models/endpoints/:id', (req, res) => {
  try {
    const result = modelService.deleteCustomEndpoint(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/api/models/endpoints/:id/test', async (req, res) => {
  try {
    const result = await modelService.testCustomEndpoint(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/models/endpoints/:id/discover', async (req, res) => {
  try {
    const result = await modelService.discoverModels(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/models/marketplace', (req, res) => {
  try {
    const { category, search } = req.query;
    const models = modelService.getMarketplaceModels(category, search);
    res.json({ models });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/models/marketplace/install', (req, res) => {
  try {
    const { modelId } = req.body;
    if (!modelId) {
      return res.status(400).json({ error: 'modelId required' });
    }
    const model = modelService.installMarketplaceModel(modelId);
    res.json(model);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/api/models/usage', (req, res) => {
  try {
    const stats = modelService.getUsageStats(req.body);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
