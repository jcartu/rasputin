/**
 * FineTuneManager - Model Fine-Tuning Interface
 * Handles dataset preparation, training jobs, hyperparameter tuning,
 * evaluation metrics, and model versioning for OpenAI fine-tuning.
 */
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import config from '../config.js';
import * as sessionManager from './sessionManager.js';

// OpenAI API client
const openaiClient = axios.create({
  baseURL: 'https://api.openai.com/v1',
  timeout: 120000,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY || ''}`,
  },
});

// In-memory storage for local tracking
const datasets = new Map();
const jobs = new Map();
const modelVersions = new Map();
const evaluations = new Map();

// Event emitter for progress updates
export const fineTuneEvents = new EventEmitter();

// ============================================================================
// DATASET MANAGEMENT
// ============================================================================

/**
 * Supported base models for fine-tuning
 */
export const SUPPORTED_MODELS = [
  'gpt-4o-2024-08-06',
  'gpt-4o-mini-2024-07-18',
  'gpt-4-0613',
  'gpt-3.5-turbo-0125',
  'gpt-3.5-turbo-1106',
  'gpt-3.5-turbo-0613',
  'babbage-002',
  'davinci-002',
];

/**
 * Create a new dataset for fine-tuning
 */
export function createDataset(name, description = '') {
  const id = `ds_${uuidv4().slice(0, 12)}`;
  const dataset = {
    id,
    name,
    description,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'draft',
    examples: [],
    stats: {
      totalExamples: 0,
      totalTokens: 0,
      avgTokensPerExample: 0,
    },
    validation: null,
  };
  datasets.set(id, dataset);
  return dataset;
}

/**
 * Add training example to dataset
 */
export function addExample(datasetId, example) {
  const dataset = datasets.get(datasetId);
  if (!dataset) throw new Error(`Dataset ${datasetId} not found`);

  const { messages, systemPrompt } = example;
  if (!messages || !Array.isArray(messages)) {
    throw new Error('Example must have messages array');
  }

  // Validate message format
  for (const msg of messages) {
    if (!['system', 'user', 'assistant'].includes(msg.role)) {
      throw new Error(`Invalid role: ${msg.role}`);
    }
    if (!msg.content || typeof msg.content !== 'string') {
      throw new Error('Each message must have content string');
    }
  }

  // Estimate tokens (rough: 4 chars = 1 token)
  const estimatedTokens = messages.reduce(
    (sum, m) => sum + Math.ceil(m.content.length / 4),
    0
  );

  const exampleRecord = {
    id: `ex_${uuidv4().slice(0, 8)}`,
    messages: systemPrompt 
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages,
    estimatedTokens,
    addedAt: new Date().toISOString(),
  };

  dataset.examples.push(exampleRecord);
  dataset.updatedAt = new Date().toISOString();
  
  // Update stats
  dataset.stats.totalExamples = dataset.examples.length;
  dataset.stats.totalTokens = dataset.examples.reduce(
    (sum, e) => sum + e.estimatedTokens,
    0
  );
  dataset.stats.avgTokensPerExample = Math.round(
    dataset.stats.totalTokens / dataset.stats.totalExamples
  );

  return exampleRecord;
}

/**
 * Add multiple examples in batch
 */
export function addExamples(datasetId, examples) {
  return examples.map(ex => addExample(datasetId, ex));
}

/**
 * Remove example from dataset
 */
export function removeExample(datasetId, exampleId) {
  const dataset = datasets.get(datasetId);
  if (!dataset) throw new Error(`Dataset ${datasetId} not found`);

  const idx = dataset.examples.findIndex(e => e.id === exampleId);
  if (idx === -1) throw new Error(`Example ${exampleId} not found`);

  dataset.examples.splice(idx, 1);
  dataset.updatedAt = new Date().toISOString();

  // Update stats
  dataset.stats.totalExamples = dataset.examples.length;
  dataset.stats.totalTokens = dataset.examples.reduce(
    (sum, e) => sum + e.estimatedTokens,
    0
  );
  dataset.stats.avgTokensPerExample = dataset.stats.totalExamples > 0
    ? Math.round(dataset.stats.totalTokens / dataset.stats.totalExamples)
    : 0;

  return { success: true, removed: exampleId };
}

/**
 * Validate dataset for fine-tuning
 */
export function validateDataset(datasetId) {
  const dataset = datasets.get(datasetId);
  if (!dataset) throw new Error(`Dataset ${datasetId} not found`);

  const errors = [];
  const warnings = [];

  // Minimum examples check
  if (dataset.examples.length < 10) {
    errors.push(`Minimum 10 examples required (have ${dataset.examples.length})`);
  }

  // Check for recommended minimum
  if (dataset.examples.length < 50) {
    warnings.push(`Recommended: at least 50 examples for good results (have ${dataset.examples.length})`);
  }

  // Validate each example
  for (const example of dataset.examples) {
    // Must have at least user + assistant message
    const roles = example.messages.map(m => m.role);
    if (!roles.includes('user') || !roles.includes('assistant')) {
      errors.push(`Example ${example.id}: Must have both user and assistant messages`);
    }

    // Check for very short or very long examples
    if (example.estimatedTokens < 10) {
      warnings.push(`Example ${example.id}: Very short (${example.estimatedTokens} tokens)`);
    }
    if (example.estimatedTokens > 4000) {
      warnings.push(`Example ${example.id}: Very long (${example.estimatedTokens} tokens), may be truncated`);
    }

    // Check assistant message isn't empty
    const assistantMsgs = example.messages.filter(m => m.role === 'assistant');
    for (const msg of assistantMsgs) {
      if (msg.content.trim().length < 5) {
        errors.push(`Example ${example.id}: Assistant message is too short`);
      }
    }
  }

  // Check for duplicate examples
  const contentSet = new Set();
  for (const example of dataset.examples) {
    const key = JSON.stringify(example.messages);
    if (contentSet.has(key)) {
      warnings.push(`Example ${example.id}: Duplicate detected`);
    }
    contentSet.add(key);
  }

  // Token budget check
  if (dataset.stats.totalTokens > 1000000) {
    warnings.push(`Large dataset: ${dataset.stats.totalTokens} tokens may be expensive`);
  }

  const validation = {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      totalExamples: dataset.examples.length,
      totalTokens: dataset.stats.totalTokens,
      avgTokensPerExample: dataset.stats.avgTokensPerExample,
      minTokens: Math.min(...dataset.examples.map(e => e.estimatedTokens)),
      maxTokens: Math.max(...dataset.examples.map(e => e.estimatedTokens)),
    },
    validatedAt: new Date().toISOString(),
  };

  dataset.validation = validation;
  dataset.status = validation.valid ? 'validated' : 'invalid';

  return validation;
}

/**
 * Export dataset to JSONL format for OpenAI
 */
export async function exportDatasetToJsonl(datasetId, outputPath = null) {
  const dataset = datasets.get(datasetId);
  if (!dataset) throw new Error(`Dataset ${datasetId} not found`);

  const lines = dataset.examples.map(ex => 
    JSON.stringify({ messages: ex.messages })
  );
  const content = lines.join('\n');

  if (outputPath) {
    await fs.writeFile(outputPath, content, 'utf-8');
    return { path: outputPath, lines: lines.length };
  }

  return { content, lines: lines.length };
}

/**
 * Import dataset from JSONL file
 */
export async function importDatasetFromJsonl(name, filePath) {
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.trim().split('\n').filter(Boolean);

  const dataset = createDataset(name, `Imported from ${path.basename(filePath)}`);

  for (const line of lines) {
    try {
      const data = JSON.parse(line);
      if (data.messages) {
        addExample(dataset.id, { messages: data.messages });
      }
    } catch (err) {
      console.warn(`Failed to parse line: ${line.slice(0, 50)}...`);
    }
  }

  return dataset;
}

/**
 * Get dataset by ID
 */
export function getDataset(datasetId) {
  return datasets.get(datasetId) || null;
}

/**
 * List all datasets
 */
export function listDatasets() {
  return Array.from(datasets.values());
}

/**
 * Delete dataset
 */
export function deleteDataset(datasetId) {
  return datasets.delete(datasetId);
}

// ============================================================================
// DATASET BUILDER FROM SESSIONS
// ============================================================================

/**
 * Build training dataset from chat sessions
 */
export function buildDatasetFromSessions(name, sessionIds = [], options = {}) {
  const {
    includeSystemPrompt = true,
    systemPrompt = 'You are a helpful AI assistant.',
    minMessageLength = 10,
    maxExamples = 1000,
    filterFn = null,
  } = options;

  const dataset = createDataset(
    name,
    `Built from ${sessionIds.length || 'all'} sessions`
  );

  const sessions = sessionIds.length > 0
    ? sessionIds.map(id => sessionManager.getLocalSession(id)).filter(Boolean)
    : sessionManager.listLocalSessions();

  let exampleCount = 0;

  for (const session of sessions) {
    if (!session.messages || session.messages.length < 2) continue;

    // Group messages into conversation turns
    const turns = [];
    let currentTurn = [];

    for (const msg of session.messages) {
      currentTurn.push({
        role: msg.role,
        content: msg.content,
      });

      // Complete turn when we have user + assistant
      if (msg.role === 'assistant' && currentTurn.some(m => m.role === 'user')) {
        turns.push([...currentTurn]);
        currentTurn = [];
      }
    }

    // Create examples from turns
    for (const turn of turns) {
      if (exampleCount >= maxExamples) break;

      // Filter short messages
      const hasSubstance = turn.every(
        m => m.content.length >= minMessageLength
      );
      if (!hasSubstance) continue;

      // Apply custom filter
      if (filterFn && !filterFn(turn)) continue;

      try {
        const messages = includeSystemPrompt
          ? [{ role: 'system', content: systemPrompt }, ...turn]
          : turn;

        addExample(dataset.id, { messages });
        exampleCount++;
      } catch (err) {
        // Skip invalid examples
      }
    }

    if (exampleCount >= maxExamples) break;
  }

  return dataset;
}

/**
 * Build dataset from specific conversations with quality filtering
 */
export function buildCuratedDataset(name, conversations, options = {}) {
  const {
    systemPrompt = null,
    requireAssistantResponse = true,
  } = options;

  const dataset = createDataset(name, 'Curated training dataset');

  for (const convo of conversations) {
    if (!Array.isArray(convo.messages)) continue;

    if (requireAssistantResponse) {
      const hasAssistant = convo.messages.some(m => m.role === 'assistant');
      if (!hasAssistant) continue;
    }

    const messages = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...convo.messages]
      : convo.messages;

    try {
      addExample(dataset.id, { messages });
    } catch (err) {
      // Skip invalid
    }
  }

  return dataset;
}

// ============================================================================
// TRAINING JOB MANAGEMENT
// ============================================================================

/**
 * Default hyperparameters
 */
export const DEFAULT_HYPERPARAMS = {
  n_epochs: 'auto',
  batch_size: 'auto',
  learning_rate_multiplier: 'auto',
};

/**
 * Upload training file to OpenAI
 */
export async function uploadTrainingFile(datasetId) {
  const dataset = datasets.get(datasetId);
  if (!dataset) throw new Error(`Dataset ${datasetId} not found`);

  // Validate first
  const validation = validateDataset(datasetId);
  if (!validation.valid) {
    throw new Error(`Dataset validation failed: ${validation.errors.join(', ')}`);
  }

  // Export to temp file
  const tempPath = `/tmp/finetune_${datasetId}_${Date.now()}.jsonl`;
  await exportDatasetToJsonl(datasetId, tempPath);

  try {
    // Read file content
    const fileContent = await fs.readFile(tempPath);
    
    // Create form data
    const FormData = (await import('form-data')).default;
    const form = new FormData();
    form.append('file', fileContent, {
      filename: `${dataset.name}.jsonl`,
      contentType: 'application/jsonl',
    });
    form.append('purpose', 'fine-tune');

    // Upload to OpenAI
    const response = await axios.post(
      'https://api.openai.com/v1/files',
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        timeout: 300000, // 5 min for large files
      }
    );

    // Cleanup temp file
    await fs.unlink(tempPath).catch(() => {});

    dataset.openaiFileId = response.data.id;
    dataset.uploadedAt = new Date().toISOString();
    dataset.status = 'uploaded';

    return {
      fileId: response.data.id,
      bytes: response.data.bytes,
      filename: response.data.filename,
      purpose: response.data.purpose,
    };
  } catch (error) {
    await fs.unlink(tempPath).catch(() => {});
    throw new Error(`Upload failed: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Create fine-tuning job
 */
export async function createFineTuneJob(options) {
  const {
    datasetId,
    trainingFileId, // Can provide directly or use datasetId
    baseModel = 'gpt-4o-mini-2024-07-18',
    suffix = null,
    hyperparameters = {},
    validationFileId = null,
  } = options;

  // Get training file ID
  let fileId = trainingFileId;
  if (!fileId && datasetId) {
    const dataset = datasets.get(datasetId);
    if (!dataset?.openaiFileId) {
      throw new Error('Dataset not uploaded. Call uploadTrainingFile first.');
    }
    fileId = dataset.openaiFileId;
  }

  if (!fileId) {
    throw new Error('Either datasetId or trainingFileId required');
  }

  // Validate base model
  if (!SUPPORTED_MODELS.includes(baseModel)) {
    throw new Error(`Unsupported model: ${baseModel}. Supported: ${SUPPORTED_MODELS.join(', ')}`);
  }

  // Merge hyperparameters
  const params = { ...DEFAULT_HYPERPARAMS, ...hyperparameters };

  // Create job via OpenAI API
  const requestBody = {
    training_file: fileId,
    model: baseModel,
    hyperparameters: {
      n_epochs: params.n_epochs,
      batch_size: params.batch_size,
      learning_rate_multiplier: params.learning_rate_multiplier,
    },
  };

  if (suffix) {
    requestBody.suffix = suffix;
  }

  if (validationFileId) {
    requestBody.validation_file = validationFileId;
  }

  try {
    const response = await openaiClient.post('/fine_tuning/jobs', requestBody);
    const job = response.data;

    // Track locally
    const localJob = {
      id: job.id,
      datasetId,
      baseModel,
      suffix,
      hyperparameters: params,
      status: job.status,
      createdAt: job.created_at,
      fineTunedModel: job.fine_tuned_model,
      trainedTokens: job.trained_tokens,
      error: job.error,
      openaiJob: job,
      events: [],
      metrics: null,
    };

    jobs.set(job.id, localJob);

    // Start polling for updates
    pollJobStatus(job.id);

    return localJob;
  } catch (error) {
    throw new Error(`Job creation failed: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Get fine-tuning job status
 */
export async function getJobStatus(jobId) {
  try {
    const response = await openaiClient.get(`/fine_tuning/jobs/${jobId}`);
    const job = response.data;

    // Update local tracking
    const localJob = jobs.get(jobId);
    if (localJob) {
      localJob.status = job.status;
      localJob.fineTunedModel = job.fine_tuned_model;
      localJob.trainedTokens = job.trained_tokens;
      localJob.error = job.error;
      localJob.openaiJob = job;
    }

    return {
      id: job.id,
      status: job.status,
      fineTunedModel: job.fine_tuned_model,
      trainedTokens: job.trained_tokens,
      error: job.error,
      createdAt: job.created_at,
      finishedAt: job.finished_at,
      estimatedFinish: job.estimated_finish,
    };
  } catch (error) {
    throw new Error(`Status check failed: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * List job events (training progress)
 */
export async function getJobEvents(jobId, options = {}) {
  const { after = null, limit = 100 } = options;

  try {
    const params = { limit };
    if (after) params.after = after;

    const response = await openaiClient.get(
      `/fine_tuning/jobs/${jobId}/events`,
      { params }
    );

    const events = response.data.data;

    // Update local tracking
    const localJob = jobs.get(jobId);
    if (localJob) {
      localJob.events = events;
      
      // Extract metrics from events
      const metricsEvents = events.filter(e => 
        e.type === 'metrics' || e.message?.includes('loss')
      );
      
      if (metricsEvents.length > 0) {
        localJob.metrics = extractMetrics(metricsEvents);
      }
    }

    return {
      events,
      hasMore: response.data.has_more,
    };
  } catch (error) {
    throw new Error(`Events fetch failed: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Extract training metrics from events
 */
function extractMetrics(events) {
  const metrics = {
    steps: [],
    trainingLoss: [],
    validationLoss: [],
    trainingTokenAccuracy: [],
  };

  for (const event of events) {
    if (event.data) {
      const { step, train_loss, valid_loss, train_mean_token_accuracy } = event.data;
      
      if (step !== undefined) {
        metrics.steps.push(step);
      }
      if (train_loss !== undefined) {
        metrics.trainingLoss.push({ step, value: train_loss });
      }
      if (valid_loss !== undefined) {
        metrics.validationLoss.push({ step, value: valid_loss });
      }
      if (train_mean_token_accuracy !== undefined) {
        metrics.trainingTokenAccuracy.push({ step, value: train_mean_token_accuracy });
      }
    }
  }

  // Calculate summary stats
  if (metrics.trainingLoss.length > 0) {
    const losses = metrics.trainingLoss.map(m => m.value);
    metrics.summary = {
      finalTrainingLoss: losses[losses.length - 1],
      minTrainingLoss: Math.min(...losses),
      avgTrainingLoss: losses.reduce((a, b) => a + b, 0) / losses.length,
      totalSteps: metrics.steps.length > 0 ? Math.max(...metrics.steps) : 0,
    };

    if (metrics.validationLoss.length > 0) {
      const valLosses = metrics.validationLoss.map(m => m.value);
      metrics.summary.finalValidationLoss = valLosses[valLosses.length - 1];
    }
  }

  return metrics;
}

/**
 * Cancel fine-tuning job
 */
export async function cancelJob(jobId) {
  try {
    const response = await openaiClient.post(`/fine_tuning/jobs/${jobId}/cancel`);
    
    const localJob = jobs.get(jobId);
    if (localJob) {
      localJob.status = 'cancelled';
    }

    return {
      id: response.data.id,
      status: response.data.status,
    };
  } catch (error) {
    throw new Error(`Cancel failed: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * List all fine-tuning jobs
 */
export async function listJobs(options = {}) {
  const { limit = 20, after = null } = options;

  try {
    const params = { limit };
    if (after) params.after = after;

    const response = await openaiClient.get('/fine_tuning/jobs', { params });
    
    // Update local tracking
    for (const job of response.data.data) {
      if (!jobs.has(job.id)) {
        jobs.set(job.id, {
          id: job.id,
          baseModel: job.model,
          status: job.status,
          createdAt: job.created_at,
          fineTunedModel: job.fine_tuned_model,
          openaiJob: job,
        });
      }
    }

    return {
      jobs: response.data.data,
      hasMore: response.data.has_more,
    };
  } catch (error) {
    throw new Error(`List jobs failed: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Get local job tracking data
 */
export function getLocalJob(jobId) {
  return jobs.get(jobId) || null;
}

/**
 * List locally tracked jobs
 */
export function listLocalJobs() {
  return Array.from(jobs.values());
}

/**
 * Poll job status for updates
 */
function pollJobStatus(jobId, interval = 30000) {
  const poll = async () => {
    try {
      const status = await getJobStatus(jobId);
      const events = await getJobEvents(jobId);

      // Emit progress event
      fineTuneEvents.emit('progress', {
        jobId,
        status: status.status,
        events: events.events.slice(-5),
        metrics: jobs.get(jobId)?.metrics,
      });

      // Continue polling if not complete
      if (!['succeeded', 'failed', 'cancelled'].includes(status.status)) {
        setTimeout(poll, interval);
      } else {
        fineTuneEvents.emit('complete', {
          jobId,
          status: status.status,
          fineTunedModel: status.fineTunedModel,
          error: status.error,
        });
      }
    } catch (error) {
      console.error(`Poll error for job ${jobId}:`, error.message);
      // Retry on error
      setTimeout(poll, interval * 2);
    }
  };

  // Start polling after initial delay
  setTimeout(poll, 10000);
}

// ============================================================================
// MODEL VERSIONING
// ============================================================================

/**
 * Register a fine-tuned model version
 */
export function registerModelVersion(options) {
  const {
    modelId, // OpenAI model ID (ft:gpt-4o-mini:...)
    name,
    description = '',
    jobId = null,
    datasetId = null,
    baseModel = null,
    metrics = null,
    tags = [],
  } = options;

  const version = {
    id: `mv_${uuidv4().slice(0, 8)}`,
    modelId,
    name,
    description,
    jobId,
    datasetId,
    baseModel,
    metrics,
    tags,
    createdAt: new Date().toISOString(),
    isActive: false,
    deployments: [],
  };

  modelVersions.set(version.id, version);

  // Also index by OpenAI model ID
  modelVersions.set(modelId, version);

  return version;
}

/**
 * Get model version
 */
export function getModelVersion(versionIdOrModelId) {
  return modelVersions.get(versionIdOrModelId) || null;
}

/**
 * List all model versions
 */
export function listModelVersions(options = {}) {
  const { tags = [], baseModel = null, activeOnly = false } = options;

  let versions = Array.from(modelVersions.values())
    .filter(v => v.id.startsWith('mv_')); // Filter out model ID duplicates

  if (tags.length > 0) {
    versions = versions.filter(v => 
      tags.some(t => v.tags.includes(t))
    );
  }

  if (baseModel) {
    versions = versions.filter(v => v.baseModel === baseModel);
  }

  if (activeOnly) {
    versions = versions.filter(v => v.isActive);
  }

  return versions.sort((a, b) => 
    new Date(b.createdAt) - new Date(a.createdAt)
  );
}

/**
 * Set model version as active
 */
export function setActiveVersion(versionId) {
  const version = modelVersions.get(versionId);
  if (!version) throw new Error(`Version ${versionId} not found`);

  // Deactivate all versions with same base model
  for (const v of modelVersions.values()) {
    if (v.baseModel === version.baseModel) {
      v.isActive = false;
    }
  }

  version.isActive = true;
  return version;
}

/**
 * Compare two model versions
 */
export function compareVersions(versionId1, versionId2) {
  const v1 = modelVersions.get(versionId1);
  const v2 = modelVersions.get(versionId2);

  if (!v1 || !v2) {
    throw new Error('One or both versions not found');
  }

  return {
    version1: {
      id: v1.id,
      name: v1.name,
      baseModel: v1.baseModel,
      metrics: v1.metrics,
      createdAt: v1.createdAt,
    },
    version2: {
      id: v2.id,
      name: v2.name,
      baseModel: v2.baseModel,
      metrics: v2.metrics,
      createdAt: v2.createdAt,
    },
    comparison: {
      sameBaseModel: v1.baseModel === v2.baseModel,
      trainingLossDiff: v1.metrics?.summary?.finalTrainingLoss && v2.metrics?.summary?.finalTrainingLoss
        ? v2.metrics.summary.finalTrainingLoss - v1.metrics.summary.finalTrainingLoss
        : null,
      newer: new Date(v2.createdAt) > new Date(v1.createdAt) ? 'version2' : 'version1',
    },
  };
}

/**
 * List fine-tuned models from OpenAI
 */
export async function listFineTunedModels() {
  try {
    const response = await openaiClient.get('/models');
    
    // Filter to fine-tuned models only
    const fineTuned = response.data.data.filter(m => 
      m.id.startsWith('ft:') || m.owned_by === 'user'
    );

    return fineTuned.map(m => ({
      id: m.id,
      ownedBy: m.owned_by,
      createdAt: m.created,
      permission: m.permission,
    }));
  } catch (error) {
    throw new Error(`List models failed: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Delete fine-tuned model from OpenAI
 */
export async function deleteFineTunedModel(modelId) {
  try {
    const response = await openaiClient.delete(`/models/${modelId}`);
    
    // Remove from local tracking
    const version = modelVersions.get(modelId);
    if (version) {
      modelVersions.delete(version.id);
      modelVersions.delete(modelId);
    }

    return {
      id: response.data.id,
      deleted: response.data.deleted,
    };
  } catch (error) {
    throw new Error(`Delete model failed: ${error.response?.data?.error?.message || error.message}`);
  }
}

// ============================================================================
// EVALUATION & TESTING
// ============================================================================

/**
 * Create evaluation for a model version
 */
export async function createEvaluation(options) {
  const {
    modelId,
    testDatasetId,
    name = 'Evaluation',
    systemPrompt = null,
  } = options;

  const testDataset = datasets.get(testDatasetId);
  if (!testDataset) throw new Error(`Test dataset ${testDatasetId} not found`);

  const evalId = `eval_${uuidv4().slice(0, 8)}`;
  const evaluation = {
    id: evalId,
    modelId,
    testDatasetId,
    name,
    systemPrompt,
    status: 'running',
    startedAt: new Date().toISOString(),
    completedAt: null,
    results: [],
    metrics: null,
  };

  evaluations.set(evalId, evaluation);

  // Run evaluation asynchronously
  runEvaluation(evaluation).catch(err => {
    evaluation.status = 'failed';
    evaluation.error = err.message;
  });

  return evaluation;
}

/**
 * Run evaluation against test dataset
 */
async function runEvaluation(evaluation) {
  const testDataset = datasets.get(evaluation.testDatasetId);
  
  for (const example of testDataset.examples) {
    try {
      // Get input messages (exclude expected assistant response)
      const inputMessages = example.messages.filter(m => m.role !== 'assistant');
      const expectedResponse = example.messages.find(m => m.role === 'assistant')?.content;

      if (evaluation.systemPrompt) {
        inputMessages.unshift({ role: 'system', content: evaluation.systemPrompt });
      }

      // Call model
      const response = await openaiClient.post('/chat/completions', {
        model: evaluation.modelId,
        messages: inputMessages,
        max_tokens: 1000,
      });

      const actualResponse = response.data.choices[0]?.message?.content || '';

      // Calculate similarity score (simple character-level)
      const similarity = calculateSimilarity(expectedResponse, actualResponse);

      evaluation.results.push({
        exampleId: example.id,
        expectedResponse,
        actualResponse,
        similarity,
        tokens: response.data.usage,
        passed: similarity > 0.7,
      });

    } catch (err) {
      evaluation.results.push({
        exampleId: example.id,
        error: err.message,
        passed: false,
      });
    }

    // Emit progress
    fineTuneEvents.emit('evaluation_progress', {
      evalId: evaluation.id,
      completed: evaluation.results.length,
      total: testDataset.examples.length,
    });
  }

  // Calculate metrics
  const passed = evaluation.results.filter(r => r.passed).length;
  const total = evaluation.results.length;
  const similarities = evaluation.results
    .filter(r => r.similarity !== undefined)
    .map(r => r.similarity);

  evaluation.metrics = {
    accuracy: passed / total,
    passRate: `${passed}/${total}`,
    avgSimilarity: similarities.length > 0
      ? similarities.reduce((a, b) => a + b, 0) / similarities.length
      : 0,
    minSimilarity: similarities.length > 0 ? Math.min(...similarities) : 0,
    maxSimilarity: similarities.length > 0 ? Math.max(...similarities) : 0,
  };

  evaluation.status = 'completed';
  evaluation.completedAt = new Date().toISOString();

  fineTuneEvents.emit('evaluation_complete', {
    evalId: evaluation.id,
    metrics: evaluation.metrics,
  });
}

/**
 * Calculate text similarity (Jaccard similarity on words)
 */
function calculateSimilarity(expected, actual) {
  if (!expected || !actual) return 0;

  const words1 = new Set(expected.toLowerCase().split(/\s+/));
  const words2 = new Set(actual.toLowerCase().split(/\s+/));

  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Get evaluation by ID
 */
export function getEvaluation(evalId) {
  return evaluations.get(evalId) || null;
}

/**
 * List evaluations
 */
export function listEvaluations(options = {}) {
  const { modelId = null } = options;

  let evals = Array.from(evaluations.values());

  if (modelId) {
    evals = evals.filter(e => e.modelId === modelId);
  }

  return evals.sort((a, b) => 
    new Date(b.startedAt) - new Date(a.startedAt)
  );
}

// ============================================================================
// HYPERPARAMETER TUNING
// ============================================================================

/**
 * Recommended hyperparameter presets
 */
export const HYPERPARAMETER_PRESETS = {
  conservative: {
    name: 'Conservative',
    description: 'Lower learning rate, more epochs - safer for small datasets',
    params: {
      n_epochs: 4,
      learning_rate_multiplier: 0.5,
      batch_size: 'auto',
    },
  },
  balanced: {
    name: 'Balanced',
    description: 'OpenAI defaults - good starting point',
    params: {
      n_epochs: 'auto',
      learning_rate_multiplier: 'auto',
      batch_size: 'auto',
    },
  },
  aggressive: {
    name: 'Aggressive',
    description: 'Higher learning rate, fewer epochs - faster training',
    params: {
      n_epochs: 2,
      learning_rate_multiplier: 2.0,
      batch_size: 'auto',
    },
  },
  largDataset: {
    name: 'Large Dataset',
    description: 'Optimized for 1000+ examples',
    params: {
      n_epochs: 2,
      learning_rate_multiplier: 1.0,
      batch_size: 8,
    },
  },
  smallDataset: {
    name: 'Small Dataset',
    description: 'Optimized for 50-200 examples',
    params: {
      n_epochs: 6,
      learning_rate_multiplier: 0.3,
      batch_size: 1,
    },
  },
};

/**
 * Get recommended hyperparameters based on dataset size
 */
export function getRecommendedHyperparams(datasetId) {
  const dataset = datasets.get(datasetId);
  if (!dataset) throw new Error(`Dataset ${datasetId} not found`);

  const exampleCount = dataset.examples.length;
  const avgTokens = dataset.stats.avgTokensPerExample;

  let recommendation;

  if (exampleCount < 50) {
    recommendation = HYPERPARAMETER_PRESETS.smallDataset;
  } else if (exampleCount < 200) {
    recommendation = HYPERPARAMETER_PRESETS.conservative;
  } else if (exampleCount < 1000) {
    recommendation = HYPERPARAMETER_PRESETS.balanced;
  } else {
    recommendation = HYPERPARAMETER_PRESETS.largDataset;
  }

  return {
    preset: recommendation,
    reasoning: {
      exampleCount,
      avgTokens,
      estimatedTrainingTokens: dataset.stats.totalTokens * (recommendation.params.n_epochs === 'auto' ? 3 : recommendation.params.n_epochs),
    },
    allPresets: HYPERPARAMETER_PRESETS,
  };
}

// ============================================================================
// PROGRESS VISUALIZATION DATA
// ============================================================================

/**
 * Get training progress data for visualization
 */
export function getTrainingProgressData(jobId) {
  const job = jobs.get(jobId);
  if (!job) throw new Error(`Job ${jobId} not found`);

  const metrics = job.metrics || { trainingLoss: [], validationLoss: [], steps: [] };

  return {
    jobId,
    status: job.status,
    chartData: {
      labels: metrics.trainingLoss.map(m => `Step ${m.step}`),
      datasets: [
        {
          label: 'Training Loss',
          data: metrics.trainingLoss.map(m => m.value),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.3,
        },
        {
          label: 'Validation Loss',
          data: metrics.validationLoss.map(m => m.value),
          borderColor: 'rgb(234, 88, 12)',
          backgroundColor: 'rgba(234, 88, 12, 0.1)',
          tension: 0.3,
        },
      ],
    },
    summary: metrics.summary || null,
    recentEvents: job.events.slice(-10),
    estimatedCompletion: job.openaiJob?.estimated_finish,
  };
}

/**
 * Get dashboard summary data
 */
export function getDashboardSummary() {
  const allJobs = listLocalJobs();
  const allDatasets = listDatasets();
  const allVersions = listModelVersions();

  return {
    datasets: {
      total: allDatasets.length,
      validated: allDatasets.filter(d => d.status === 'validated').length,
      totalExamples: allDatasets.reduce((sum, d) => sum + d.stats.totalExamples, 0),
    },
    jobs: {
      total: allJobs.length,
      running: allJobs.filter(j => j.status === 'running' || j.status === 'validating_files').length,
      succeeded: allJobs.filter(j => j.status === 'succeeded').length,
      failed: allJobs.filter(j => j.status === 'failed').length,
    },
    models: {
      total: allVersions.length,
      active: allVersions.filter(v => v.isActive).length,
    },
    recentJobs: allJobs.slice(0, 5).map(j => ({
      id: j.id,
      status: j.status,
      baseModel: j.baseModel,
      createdAt: j.createdAt,
    })),
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Constants
  SUPPORTED_MODELS,
  DEFAULT_HYPERPARAMS,
  HYPERPARAMETER_PRESETS,

  // Events
  fineTuneEvents,

  // Datasets
  createDataset,
  addExample,
  addExamples,
  removeExample,
  validateDataset,
  exportDatasetToJsonl,
  importDatasetFromJsonl,
  getDataset,
  listDatasets,
  deleteDataset,

  // Dataset builders
  buildDatasetFromSessions,
  buildCuratedDataset,

  // Jobs
  uploadTrainingFile,
  createFineTuneJob,
  getJobStatus,
  getJobEvents,
  cancelJob,
  listJobs,
  getLocalJob,
  listLocalJobs,

  // Model versioning
  registerModelVersion,
  getModelVersion,
  listModelVersions,
  setActiveVersion,
  compareVersions,
  listFineTunedModels,
  deleteFineTunedModel,

  // Evaluation
  createEvaluation,
  getEvaluation,
  listEvaluations,

  // Hyperparameters
  getRecommendedHyperparams,

  // Visualization
  getTrainingProgressData,
  getDashboardSummary,
};
