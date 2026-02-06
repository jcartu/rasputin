import crypto from 'crypto';
import EventEmitter from 'events';
import IntegrationRegistry from './IntegrationRegistry.js';

const DEFAULT_DEDUPE_TTL_MS = 5 * 60 * 1000;

function normalizeHeaderValue(value) {
  if (!value) {
    return '';
  }
  if (Array.isArray(value)) {
    return value[0] || '';
  }
  return String(value);
}

function getNestedValue(payload, path) {
  if (!payload || !path) {
    return null;
  }
  return path.split('.').reduce((acc, key) => (acc ? acc[key] : null), payload);
}

function parseSignatureHeader(header, { format = 'raw', version = 'v1', prefix } = {}) {
  if (!header) {
    return null;
  }

  const value = normalizeHeaderValue(header);

  if (format === 'stripe') {
    const segments = value.split(',').map(part => part.trim());
    const match = segments.find(segment => segment.startsWith(`${version}=`));
    return match ? match.split('=')[1] : null;
  }

  if (prefix && value.startsWith(prefix)) {
    return value.slice(prefix.length);
  }

  return value;
}

function timingSafeEqual(a, b) {
  if (!a || !b) {
    return false;
  }
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufferA, bufferB);
}

export default class WebhookHandler extends EventEmitter {
  constructor({
    registry = IntegrationRegistry,
    dedupeTtlMs = DEFAULT_DEDUPE_TTL_MS,
    retryIntervalMs = 2000,
    maxRetries = 5
  } = {}) {
    super();
    this.registry = registry;
    this.providers = new Map();
    this.processedEvents = new Map();
    this.dedupeTtlMs = dedupeTtlMs;
    this.retryQueue = [];
    this.maxRetries = maxRetries;

    this._retryTimer = setInterval(() => {
      this._processQueue().catch(error => this.emit('error', error));
    }, retryIntervalMs);
  }

  registerProvider(name, config) {
    this.providers.set(name, config);
  }

  verifySignature({ provider, headers, rawBody }) {
    const config = this.providers.get(provider);
    if (!config?.secret) {
      return true;
    }
    const headerName = config.signatureHeader || 'x-signature';
    const signatureHeader = headers?.[headerName] || headers?.[headerName.toLowerCase()];
    const signature = parseSignatureHeader(signatureHeader, config);
    if (!signature) {
      return false;
    }

    const algorithm = (config.algorithm || 'sha256').toLowerCase();
    const hmac = crypto.createHmac(algorithm, config.secret);
    hmac.update(rawBody);
    const digest = config.digest === 'base64' ? hmac.digest('base64') : hmac.digest('hex');

    return timingSafeEqual(digest, signature);
  }

  getEventId({ provider, headers, payload }) {
    const config = this.providers.get(provider);
    if (config?.eventIdHeader) {
      const headerValue = headers?.[config.eventIdHeader] || headers?.[config.eventIdHeader.toLowerCase()];
      return normalizeHeaderValue(headerValue);
    }
    if (config?.eventIdPath) {
      return getNestedValue(payload, config.eventIdPath);
    }
    return payload?.id || payload?.eventId || null;
  }

  isDuplicate(eventId) {
    if (!eventId) {
      return false;
    }
    const timestamp = this.processedEvents.get(eventId);
    if (!timestamp) {
      return false;
    }
    return Date.now() - timestamp < this.dedupeTtlMs;
  }

  markProcessed(eventId) {
    if (!eventId) {
      return;
    }
    this.processedEvents.set(eventId, Date.now());
    setTimeout(() => this.processedEvents.delete(eventId), this.dedupeTtlMs);
  }

  async handleWebhook({ integrationId, provider, headers = {}, payload, rawBody }) {
    const integration = this.registry.getIntegration(integrationId);
    if (!integration) {
      throw new Error(`Unknown integration: ${integrationId}`);
    }

    const isValid = this.verifySignature({ provider, headers, rawBody });
    if (!isValid) {
      throw new Error('Invalid webhook signature');
    }

    const eventId = this.getEventId({ provider, headers, payload });
    if (this.isDuplicate(eventId)) {
      return { status: 'duplicate', eventId };
    }

    try {
      const result = await integration.handleWebhook({ headers, payload, rawBody, provider });
      this.markProcessed(eventId);
      integration.emit?.('webhook_received', { provider, payload, headers, eventId });
      this.emit('webhook_received', { integrationId, provider, eventId });
      return { status: 'processed', result, eventId };
    } catch (error) {
      this._enqueueRetry({ integrationId, provider, headers, payload, rawBody, eventId, error });
      this.emit('webhook_failed', { integrationId, provider, eventId, error });
      return { status: 'queued', error: error.message, eventId };
    }
  }

  _enqueueRetry(item) {
    this.retryQueue.push({
      ...item,
      attempts: item.attempts || 0,
      nextAttemptAt: Date.now() + 1000
    });
  }

  async _processQueue() {
    if (!this.retryQueue.length) {
      return;
    }

    const now = Date.now();
    const queue = [...this.retryQueue];
    this.retryQueue = [];

    for (const item of queue) {
      if (item.nextAttemptAt > now) {
        this.retryQueue.push(item);
        continue;
      }

      try {
        const integration = this.registry.getIntegration(item.integrationId);
        if (!integration) {
          throw new Error(`Unknown integration: ${item.integrationId}`);
        }
        await integration.handleWebhook({
          headers: item.headers,
          payload: item.payload,
          rawBody: item.rawBody,
          provider: item.provider,
          retry: true
        });
        this.markProcessed(item.eventId);
        this.emit('webhook_retried', { integrationId: item.integrationId, eventId: item.eventId });
      } catch (error) {
        const attempts = item.attempts + 1;
        if (attempts >= this.maxRetries) {
          this.emit('webhook_failed', { integrationId: item.integrationId, eventId: item.eventId, error });
          continue;
        }
        const backoff = Math.min(30_000, 1000 * Math.pow(2, attempts));
        this.retryQueue.push({
          ...item,
          attempts,
          nextAttemptAt: Date.now() + backoff
        });
      }
    }
  }
}
