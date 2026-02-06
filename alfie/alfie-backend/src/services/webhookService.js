import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { log } from './logger.js';

// In-memory storage for webhooks (replace with Prisma when DB is connected)
const webhooks = new Map();
const webhookLogs = new Map();

// Supported event types
export const WEBHOOK_EVENTS = {
  MESSAGE_CREATED: 'message.created',
  MESSAGE_UPDATED: 'message.updated',
  TOOL_CALL_STARTED: 'tool_call.started',
  TOOL_CALL_COMPLETED: 'tool_call.completed',
  TOOL_CALL_FAILED: 'tool_call.failed',
  SESSION_STARTED: 'session.started',
  SESSION_ENDED: 'session.ended',
  SESSION_ERROR: 'session.error',
  THINKING_STARTED: 'thinking.started',
  THINKING_COMPLETED: 'thinking.completed',
  FILE_CREATED: 'file.created',
  FILE_UPDATED: 'file.updated',
  FILE_DELETED: 'file.deleted',
};

/**
 * Generate a webhook secret for signature verification
 */
export function generateWebhookSecret() {
  return `whsec_${crypto.randomBytes(32).toString('hex')}`;
}

/**
 * Create HMAC signature for payload verification
 */
export function createSignature(payload, secret, timestamp) {
  const signaturePayload = `${timestamp}.${JSON.stringify(payload)}`;
  return crypto
    .createHmac('sha256', secret)
    .update(signaturePayload)
    .digest('hex');
}

/**
 * Verify webhook signature
 */
export function verifySignature(payload, signature, secret, timestamp) {
  const expectedSignature = createSignature(payload, secret, timestamp);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Create a new webhook
 */
export function createWebhook({
  name,
  url,
  events = [],
  description = '',
  headers = {},
  template = null,
  retryCount = 3,
  retryDelay = 1000,
  timeout = 30000,
  enabled = true,
}) {
  const id = uuidv4();
  const secret = generateWebhookSecret();
  
  const webhook = {
    id,
    name,
    url,
    secret,
    events: events.filter(e => Object.values(WEBHOOK_EVENTS).includes(e)),
    description,
    headers,
    template,
    retryCount,
    retryDelay,
    timeout,
    enabled,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastTriggered: null,
  };
  
  webhooks.set(id, webhook);
  log.info('Webhook created', { id, name, url, events: webhook.events });
  
  return webhook;
}

/**
 * Get webhook by ID
 */
export function getWebhook(id) {
  return webhooks.get(id) || null;
}

/**
 * Get webhook by ID (with secret masked)
 */
export function getWebhookSafe(id) {
  const webhook = webhooks.get(id);
  if (!webhook) return null;
  
  return {
    ...webhook,
    secret: maskSecret(webhook.secret),
  };
}

/**
 * List all webhooks (with secrets masked)
 */
export function listWebhooks() {
  return Array.from(webhooks.values()).map(webhook => ({
    ...webhook,
    secret: maskSecret(webhook.secret),
  }));
}

/**
 * Update a webhook
 */
export function updateWebhook(id, updates) {
  const webhook = webhooks.get(id);
  if (!webhook) return null;
  
  const allowedUpdates = ['name', 'url', 'events', 'description', 'headers', 'template', 'retryCount', 'retryDelay', 'timeout', 'enabled'];
  
  for (const key of allowedUpdates) {
    if (updates[key] !== undefined) {
      if (key === 'events') {
        webhook[key] = updates[key].filter(e => Object.values(WEBHOOK_EVENTS).includes(e));
      } else {
        webhook[key] = updates[key];
      }
    }
  }
  
  webhook.updatedAt = new Date().toISOString();
  webhooks.set(id, webhook);
  
  log.info('Webhook updated', { id, name: webhook.name });
  return getWebhookSafe(id);
}

/**
 * Delete a webhook
 */
export function deleteWebhook(id) {
  const webhook = webhooks.get(id);
  if (!webhook) return false;
  
  webhooks.delete(id);
  
  // Clean up logs for this webhook
  for (const [logId, logEntry] of webhookLogs.entries()) {
    if (logEntry.webhookId === id) {
      webhookLogs.delete(logId);
    }
  }
  
  log.info('Webhook deleted', { id, name: webhook.name });
  return true;
}

/**
 * Regenerate webhook secret
 */
export function regenerateSecret(id) {
  const webhook = webhooks.get(id);
  if (!webhook) return null;
  
  const newSecret = generateWebhookSecret();
  webhook.secret = newSecret;
  webhook.updatedAt = new Date().toISOString();
  webhooks.set(id, webhook);
  
  log.info('Webhook secret regenerated', { id, name: webhook.name });
  return newSecret;
}

/**
 * Apply payload template
 */
function applyTemplate(template, eventData) {
  if (!template) return eventData;
  
  const result = JSON.parse(JSON.stringify(template));
  
  function replaceVariables(obj) {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        obj[key] = obj[key].replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
          const value = path.split('.').reduce((o, k) => o?.[k], eventData);
          return value !== undefined ? value : match;
        });
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        replaceVariables(obj[key]);
      }
    }
  }
  
  replaceVariables(result);
  return result;
}

/**
 * Build webhook payload
 */
function buildPayload(webhook, eventType, eventData) {
  const timestamp = Date.now();
  const eventId = uuidv4();
  
  const basePayload = {
    id: eventId,
    type: eventType,
    timestamp: new Date(timestamp).toISOString(),
    data: webhook.template ? applyTemplate(webhook.template, eventData) : eventData,
  };
  
  return { payload: basePayload, timestamp, eventId };
}

/**
 * Create a webhook delivery log entry
 */
function createLogEntry(webhookId, eventType, eventId, payload, status = 'pending') {
  const id = uuidv4();
  const logEntry = {
    id,
    webhookId,
    eventType,
    eventId,
    payload,
    status,
    statusCode: null,
    response: null,
    error: null,
    attempts: 0,
    createdAt: new Date().toISOString(),
    deliveredAt: null,
    nextRetryAt: null,
  };
  
  webhookLogs.set(id, logEntry);
  return logEntry;
}

/**
 * Update webhook log entry
 */
function updateLogEntry(logId, updates) {
  const logEntry = webhookLogs.get(logId);
  if (!logEntry) return null;
  
  Object.assign(logEntry, updates);
  webhookLogs.set(logId, logEntry);
  return logEntry;
}

/**
 * Deliver webhook with retry logic
 */
async function deliverWebhook(webhook, logEntry, payload, timestamp) {
  const maxAttempts = webhook.retryCount + 1;
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      updateLogEntry(logEntry.id, { 
        attempts: attempt,
        status: attempt === 1 ? 'pending' : 'retrying',
      });
      
      const signature = createSignature(payload, webhook.secret, timestamp);
      
      const headers = {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': `sha256=${signature}`,
        'X-Webhook-Timestamp': timestamp.toString(),
        'X-Webhook-ID': logEntry.eventId,
        'X-Webhook-Event': logEntry.eventType,
        'User-Agent': 'Alfie-Webhook/1.0',
        ...webhook.headers,
      };
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), webhook.timeout);
      
      try {
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        const responseText = await response.text().catch(() => '');
        const truncatedResponse = responseText.substring(0, 1000);
        
        if (response.ok) {
          updateLogEntry(logEntry.id, {
            status: 'success',
            statusCode: response.status,
            response: truncatedResponse,
            deliveredAt: new Date().toISOString(),
          });
          
          // Update webhook last triggered
          webhook.lastTriggered = new Date().toISOString();
          webhooks.set(webhook.id, webhook);
          
          log.info('Webhook delivered successfully', {
            webhookId: webhook.id,
            eventType: logEntry.eventType,
            statusCode: response.status,
            attempt,
          });
          
          return { success: true, statusCode: response.status, response: truncatedResponse };
        } else {
          lastError = `HTTP ${response.status}: ${truncatedResponse}`;
          log.warn('Webhook delivery failed', {
            webhookId: webhook.id,
            eventType: logEntry.eventType,
            statusCode: response.status,
            attempt,
            maxAttempts,
          });
        }
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error) {
      lastError = error.name === 'AbortError' ? 'Request timeout' : error.message;
      log.warn('Webhook delivery error', {
        webhookId: webhook.id,
        eventType: logEntry.eventType,
        error: lastError,
        attempt,
        maxAttempts,
      });
    }
    
    // Wait before retrying
    if (attempt < maxAttempts) {
      const delay = webhook.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
      updateLogEntry(logEntry.id, {
        nextRetryAt: new Date(Date.now() + delay).toISOString(),
      });
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // All attempts failed
  updateLogEntry(logEntry.id, {
    status: 'failed',
    error: lastError,
  });
  
  log.error('Webhook delivery failed after all retries', {
    webhookId: webhook.id,
    eventType: logEntry.eventType,
    error: lastError,
  });
  
  return { success: false, error: lastError };
}

/**
 * Emit an event to all subscribed webhooks
 */
export async function emitEvent(eventType, eventData) {
  if (!Object.values(WEBHOOK_EVENTS).includes(eventType)) {
    log.warn('Unknown webhook event type', { eventType });
    return [];
  }
  
  const subscribedWebhooks = Array.from(webhooks.values()).filter(
    webhook => webhook.enabled && webhook.events.includes(eventType)
  );
  
  if (subscribedWebhooks.length === 0) {
    return [];
  }
  
  log.info('Emitting webhook event', {
    eventType,
    webhookCount: subscribedWebhooks.length,
  });
  
  const results = await Promise.allSettled(
    subscribedWebhooks.map(async webhook => {
      const { payload, timestamp, eventId } = buildPayload(webhook, eventType, eventData);
      const logEntry = createLogEntry(webhook.id, eventType, eventId, payload);
      
      const result = await deliverWebhook(webhook, logEntry, payload, timestamp);
      return { webhookId: webhook.id, webhookName: webhook.name, ...result };
    })
  );
  
  return results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason?.message });
}

/**
 * Get webhook logs
 */
export function getWebhookLogs(webhookId, options = {}) {
  const { limit = 50, offset = 0, status, eventType } = options;
  
  let logs = Array.from(webhookLogs.values())
    .filter(log => log.webhookId === webhookId);
  
  if (status) {
    logs = logs.filter(log => log.status === status);
  }
  
  if (eventType) {
    logs = logs.filter(log => log.eventType === eventType);
  }
  
  // Sort by creation date descending
  logs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  return {
    logs: logs.slice(offset, offset + limit),
    total: logs.length,
    limit,
    offset,
  };
}

/**
 * Get all logs (for admin view)
 */
export function getAllLogs(options = {}) {
  const { limit = 100, offset = 0, status, eventType, webhookId } = options;
  
  let logs = Array.from(webhookLogs.values());
  
  if (webhookId) {
    logs = logs.filter(log => log.webhookId === webhookId);
  }
  
  if (status) {
    logs = logs.filter(log => log.status === status);
  }
  
  if (eventType) {
    logs = logs.filter(log => log.eventType === eventType);
  }
  
  // Sort by creation date descending
  logs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  return {
    logs: logs.slice(offset, offset + limit),
    total: logs.length,
    limit,
    offset,
  };
}

/**
 * Get webhook delivery statistics
 */
export function getWebhookStats(webhookId) {
  const logs = Array.from(webhookLogs.values()).filter(log => log.webhookId === webhookId);
  
  const stats = {
    total: logs.length,
    success: logs.filter(l => l.status === 'success').length,
    failed: logs.filter(l => l.status === 'failed').length,
    pending: logs.filter(l => l.status === 'pending' || l.status === 'retrying').length,
  };
  
  stats.successRate = stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0;
  
  // Calculate average response time for successful deliveries
  const successfulLogs = logs.filter(l => l.status === 'success' && l.deliveredAt);
  if (successfulLogs.length > 0) {
    const totalTime = successfulLogs.reduce((sum, log) => {
      return sum + (new Date(log.deliveredAt) - new Date(log.createdAt));
    }, 0);
    stats.avgResponseTime = Math.round(totalTime / successfulLogs.length);
  } else {
    stats.avgResponseTime = null;
  }
  
  return stats;
}

/**
 * Test webhook by sending a test event
 */
export async function testWebhook(id) {
  const webhook = webhooks.get(id);
  if (!webhook) return { success: false, error: 'Webhook not found' };
  
  const testEvent = {
    test: true,
    message: 'This is a test webhook delivery from Alfie',
    webhookId: id,
    webhookName: webhook.name,
  };
  
  const { payload, timestamp, eventId } = buildPayload(webhook, 'test', testEvent);
  const logEntry = createLogEntry(webhook.id, 'test', eventId, payload);
  
  const result = await deliverWebhook(webhook, logEntry, payload, timestamp);
  
  return {
    ...result,
    logId: logEntry.id,
    eventId,
  };
}

/**
 * Retry a failed webhook delivery
 */
export async function retryDelivery(logId) {
  const logEntry = webhookLogs.get(logId);
  if (!logEntry) return { success: false, error: 'Log entry not found' };
  
  if (logEntry.status !== 'failed') {
    return { success: false, error: 'Can only retry failed deliveries' };
  }
  
  const webhook = webhooks.get(logEntry.webhookId);
  if (!webhook) return { success: false, error: 'Webhook not found' };
  
  // Reset log entry for retry
  updateLogEntry(logId, {
    status: 'pending',
    attempts: 0,
    error: null,
  });
  
  const result = await deliverWebhook(webhook, logEntry, logEntry.payload, Date.now());
  return result;
}

/**
 * Clear webhook logs
 */
export function clearWebhookLogs(webhookId, options = {}) {
  const { olderThan } = options;
  let deletedCount = 0;
  
  for (const [logId, logEntry] of webhookLogs.entries()) {
    if (logEntry.webhookId === webhookId) {
      if (olderThan) {
        if (new Date(logEntry.createdAt) < new Date(olderThan)) {
          webhookLogs.delete(logId);
          deletedCount++;
        }
      } else {
        webhookLogs.delete(logId);
        deletedCount++;
      }
    }
  }
  
  log.info('Webhook logs cleared', { webhookId, deletedCount });
  return { deletedCount };
}

/**
 * Mask webhook secret for display
 */
function maskSecret(secret) {
  if (!secret || secret.length < 12) return '••••••••';
  return `${secret.substring(0, 8)}••••••••${secret.substring(secret.length - 4)}`;
}

/**
 * Get all supported event types
 */
export function getEventTypes() {
  return Object.entries(WEBHOOK_EVENTS).map(([key, value]) => ({
    id: value,
    name: key.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
    category: value.split('.')[0],
  }));
}

export default {
  WEBHOOK_EVENTS,
  generateWebhookSecret,
  createSignature,
  verifySignature,
  createWebhook,
  getWebhook,
  getWebhookSafe,
  listWebhooks,
  updateWebhook,
  deleteWebhook,
  regenerateSecret,
  emitEvent,
  getWebhookLogs,
  getAllLogs,
  getWebhookStats,
  testWebhook,
  retryDelivery,
  clearWebhookLogs,
  getEventTypes,
};
