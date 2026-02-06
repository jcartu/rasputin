import express from 'express';
import * as fineTuneManager from '../services/fineTuneManager.js';

const router = express.Router();

router.get('/supported-models', (req, res) => {
  res.json({ models: fineTuneManager.SUPPORTED_MODELS });
});

router.get('/dashboard', (req, res) => {
  try {
    const summary = fineTuneManager.getDashboardSummary();
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/datasets', (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'name required' });
    }
    const dataset = fineTuneManager.createDataset(name, description);
    res.json(dataset);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/datasets', (req, res) => {
  const datasets = fineTuneManager.listDatasets();
  res.json({ datasets, count: datasets.length });
});

router.get('/datasets/:id', (req, res) => {
  const dataset = fineTuneManager.getDataset(req.params.id);
  if (!dataset) {
    return res.status(404).json({ error: 'Dataset not found' });
  }
  res.json(dataset);
});

router.delete('/datasets/:id', (req, res) => {
  const success = fineTuneManager.deleteDataset(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Dataset not found' });
  }
  res.json({ success: true, deleted: req.params.id });
});

router.post('/datasets/:id/examples', (req, res) => {
  try {
    const { messages, systemPrompt } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array required' });
    }
    const example = fineTuneManager.addExample(req.params.id, { messages, systemPrompt });
    res.json(example);
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(400).json({ error: error.message });
  }
});

router.post('/datasets/:id/examples/batch', (req, res) => {
  try {
    const { examples } = req.body;
    if (!examples || !Array.isArray(examples)) {
      return res.status(400).json({ error: 'examples array required' });
    }
    const added = fineTuneManager.addExamples(req.params.id, examples);
    res.json({ added: added.length, examples: added });
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(400).json({ error: error.message });
  }
});

router.delete('/datasets/:id/examples/:exampleId', (req, res) => {
  try {
    const result = fineTuneManager.removeExample(req.params.id, req.params.exampleId);
    res.json(result);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

router.post('/datasets/:id/validate', (req, res) => {
  try {
    const validation = fineTuneManager.validateDataset(req.params.id);
    res.json(validation);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

router.post('/datasets/:id/export', async (req, res) => {
  try {
    const { outputPath } = req.body;
    const result = await fineTuneManager.exportDatasetToJsonl(req.params.id, outputPath);
    
    if (outputPath) {
      res.json(result);
    } else {
      res.setHeader('Content-Type', 'application/jsonl');
      res.setHeader('Content-Disposition', `attachment; filename="dataset_${req.params.id}.jsonl"`);
      res.send(result.content);
    }
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

router.post('/datasets/import', async (req, res) => {
  try {
    const { name, filePath } = req.body;
    if (!name || !filePath) {
      return res.status(400).json({ error: 'name and filePath required' });
    }
    const dataset = await fineTuneManager.importDatasetFromJsonl(name, filePath);
    res.json(dataset);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/datasets/from-sessions', (req, res) => {
  try {
    const { name, sessionIds, options } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'name required' });
    }
    const dataset = fineTuneManager.buildDatasetFromSessions(name, sessionIds || [], options || {});
    res.json(dataset);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/datasets/curated', (req, res) => {
  try {
    const { name, conversations, options } = req.body;
    if (!name || !conversations) {
      return res.status(400).json({ error: 'name and conversations required' });
    }
    const dataset = fineTuneManager.buildCuratedDataset(name, conversations, options || {});
    res.json(dataset);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/datasets/:id/upload', async (req, res) => {
  try {
    const result = await fineTuneManager.uploadTrainingFile(req.params.id);
    res.json(result);
  } catch (error) {
    if (error.message.includes('validation failed')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

router.post('/jobs', async (req, res) => {
  try {
    const { datasetId, trainingFileId, baseModel, suffix, hyperparameters, validationFileId } = req.body;
    
    if (!datasetId && !trainingFileId) {
      return res.status(400).json({ error: 'datasetId or trainingFileId required' });
    }
    
    const job = await fineTuneManager.createFineTuneJob({
      datasetId,
      trainingFileId,
      baseModel,
      suffix,
      hyperparameters,
      validationFileId,
    });
    res.json(job);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/jobs', async (req, res) => {
  try {
    const { limit, after, local } = req.query;
    
    if (local === 'true') {
      const jobs = fineTuneManager.listLocalJobs();
      return res.json({ jobs, count: jobs.length });
    }
    
    const result = await fineTuneManager.listJobs({
      limit: limit ? parseInt(limit) : 20,
      after,
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/jobs/:id', async (req, res) => {
  try {
    const { local } = req.query;
    
    if (local === 'true') {
      const job = fineTuneManager.getLocalJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      return res.json(job);
    }
    
    const status = await fineTuneManager.getJobStatus(req.params.id);
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/jobs/:id/events', async (req, res) => {
  try {
    const { after, limit } = req.query;
    const result = await fineTuneManager.getJobEvents(req.params.id, {
      after,
      limit: limit ? parseInt(limit) : 100,
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/jobs/:id/progress', (req, res) => {
  try {
    const progress = fineTuneManager.getTrainingProgressData(req.params.id);
    res.json(progress);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

router.post('/jobs/:id/cancel', async (req, res) => {
  try {
    const result = await fineTuneManager.cancelJob(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/models', async (req, res) => {
  try {
    const models = await fineTuneManager.listFineTunedModels();
    res.json({ models, count: models.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/models/:id', async (req, res) => {
  try {
    const result = await fineTuneManager.deleteFineTunedModel(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/versions', (req, res) => {
  try {
    const { modelId, name, description, jobId, datasetId, baseModel, metrics, tags } = req.body;
    
    if (!modelId || !name) {
      return res.status(400).json({ error: 'modelId and name required' });
    }
    
    const version = fineTuneManager.registerModelVersion({
      modelId,
      name,
      description,
      jobId,
      datasetId,
      baseModel,
      metrics,
      tags,
    });
    res.json(version);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/versions', (req, res) => {
  const { tags, baseModel, activeOnly } = req.query;
  const versions = fineTuneManager.listModelVersions({
    tags: tags ? tags.split(',') : [],
    baseModel,
    activeOnly: activeOnly === 'true',
  });
  res.json({ versions, count: versions.length });
});

router.get('/versions/:id', (req, res) => {
  const version = fineTuneManager.getModelVersion(req.params.id);
  if (!version) {
    return res.status(404).json({ error: 'Version not found' });
  }
  res.json(version);
});

router.post('/versions/:id/activate', (req, res) => {
  try {
    const version = fineTuneManager.setActiveVersion(req.params.id);
    res.json(version);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

router.post('/versions/compare', (req, res) => {
  try {
    const { versionId1, versionId2 } = req.body;
    if (!versionId1 || !versionId2) {
      return res.status(400).json({ error: 'versionId1 and versionId2 required' });
    }
    const comparison = fineTuneManager.compareVersions(versionId1, versionId2);
    res.json(comparison);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

router.post('/evaluations', async (req, res) => {
  try {
    const { modelId, testDatasetId, name, systemPrompt } = req.body;
    
    if (!modelId || !testDatasetId) {
      return res.status(400).json({ error: 'modelId and testDatasetId required' });
    }
    
    const evaluation = await fineTuneManager.createEvaluation({
      modelId,
      testDatasetId,
      name,
      systemPrompt,
    });
    res.json(evaluation);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/evaluations', (req, res) => {
  const { modelId } = req.query;
  const evaluations = fineTuneManager.listEvaluations({ modelId });
  res.json({ evaluations, count: evaluations.length });
});

router.get('/evaluations/:id', (req, res) => {
  const evaluation = fineTuneManager.getEvaluation(req.params.id);
  if (!evaluation) {
    return res.status(404).json({ error: 'Evaluation not found' });
  }
  res.json(evaluation);
});

router.get('/hyperparameters/presets', (req, res) => {
  res.json({ presets: fineTuneManager.HYPERPARAMETER_PRESETS });
});

router.get('/hyperparameters/recommend/:datasetId', (req, res) => {
  try {
    const recommendation = fineTuneManager.getRecommendedHyperparams(req.params.datasetId);
    res.json(recommendation);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

export default router;
