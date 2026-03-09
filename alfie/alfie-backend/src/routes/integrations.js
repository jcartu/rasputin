import { Router } from 'express';
import IntegrationRegistry, { INTEGRATION_CATEGORIES } from '../integrations/IntegrationRegistry.js';
import IntegrationStore from '../integrations/IntegrationStore.js';
import CustomIntegrationStore from '../integrations/CustomIntegrationStore.js';
import CustomIntegration from '../integrations/CustomIntegration.js';

const router = Router();
const DEFAULT_USER_ID = 'default';

const DISALLOWED_ACTIONS = new Set([
  'constructor',
  'getAuthUrl',
  'handleCallback',
  'refreshToken',
  'refreshAccessToken',
  'createState',
  'consumeState',
  'encryptToken',
  'decryptToken',
  'storeRefreshToken',
  'getStoredRefreshToken',
  'clearRefreshToken',
  'handleWebhook',
  'executeEndpoint',
  'testConnection'
]);

function getUserId(req) {
  return req.auth?.user?.id || req.headers['x-user-id'] || req.query.userId || req.body?.userId || DEFAULT_USER_ID;
}

function normalizeTokens(payload = {}) {
  const accessToken = payload.access_token || payload.accessToken || payload.token || payload.botToken;
  const refreshToken = payload.refresh_token || payload.refreshToken;
  const tokenType = payload.token_type || payload.tokenType || payload.type;
  const expiresIn = payload.expires_in || payload.expiresIn;
  const expiresAt = payload.expiresAt || payload.expires_at || (expiresIn ? Date.now() + Number(expiresIn) * 1000 : null);

  return {
    accessToken,
    refreshToken,
    tokenType,
    expiresAt,
    scope: payload.scope,
    raw: payload
  };
}

function applyCredentials(instance, credentials = {}) {
  if (!instance || !credentials) return;
  if (typeof instance.setTokens === 'function') {
    instance.setTokens(credentials);
  }
  if (credentials.accessToken) {
    instance.accessToken = credentials.accessToken;
  }
  if (credentials.refreshToken) {
    instance.refreshToken = credentials.refreshToken;
  }
  if (credentials.tokenType) {
    instance.tokenType = credentials.tokenType;
  }
  if (credentials.expiresAt) {
    instance.expiresAt = credentials.expiresAt;
  }
  if (typeof instance.setCredentials === 'function') {
    instance.setCredentials(credentials);
  }
}

async function resolveIntegration(integrationId, userId) {
  const definition = IntegrationRegistry.getIntegration(integrationId);
  if (definition) {
    return { type: 'builtin', definition };
  }
  const customConfig = await CustomIntegrationStore.getIntegration(userId, integrationId);
  if (customConfig) {
    return { type: 'custom', config: customConfig };
  }
  return null;
}

function createClient(entry, credentials = {}) {
  if (entry.type === 'builtin') {
    const definition = entry.definition;
    const instance = definition.factory ? definition.factory() : definition.instance;
    if (!instance) {
      throw new Error('Integration is not configured with a factory');
    }
    applyCredentials(instance, credentials);
    return instance;
  }
  const custom = CustomIntegration.fromConfig(entry.config, credentials);
  return custom;
}

function summarizeIntegration(definition) {
  const config = definition.config || {};
  return {
    ...config,
    supportsWebhooks: Boolean(definition.webhookHandler || definition.supportsWebhooks),
    actions: definition.actions || []
  };
}

router.get('/api/integrations', async (req, res) => {
  try {
    const userId = getUserId(req);
    const includeCustom = req.query.includeCustom !== 'false';
    const includeConnected = req.query.includeConnected === 'true';
    const integrations = IntegrationRegistry.listIntegrations().map(summarizeIntegration);

    if (includeCustom) {
      const customIntegrations = await CustomIntegrationStore.listIntegrations(userId);
      customIntegrations.forEach(custom => {
        integrations.push({
          id: custom.id,
          name: custom.name,
          description: custom.description || 'Custom integration',
          icon: custom.icon || 'custom',
          category: 'custom',
          authType: custom.authType || 'api_key',
          endpoints: custom.endpoints || {},
          baseUrl: custom.baseUrl || '',
          isCustom: true
        });
      });
    }

    if (includeConnected) {
      const connections = await IntegrationStore.listUserIntegrations(userId);
      const statusMap = new Map(connections.map(connection => [connection.integrationId, connection.status || 'connected']));
      integrations.forEach(integration => {
        integration.status = statusMap.get(integration.id) || 'disconnected';
      });
    }

    res.json({ integrations, count: integrations.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list integrations', details: error.message });
  }
});

router.get('/api/integrations/categories', async (req, res) => {
  try {
    const userId = getUserId(req);
    const counts = new Map(INTEGRATION_CATEGORIES.map(category => [category, 0]));
    IntegrationRegistry.listIntegrations().forEach(definition => {
      const category = definition.config?.category || 'custom';
      counts.set(category, (counts.get(category) || 0) + 1);
    });

    const customIntegrations = await CustomIntegrationStore.listIntegrations(userId);
    if (customIntegrations.length) {
      counts.set('custom', (counts.get('custom') || 0) + customIntegrations.length);
    }

    const categories = Array.from(counts.entries()).map(([id, count]) => ({
      id,
      name: id.replace(/-/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()),
      count
    }));

    res.json({ categories });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list categories', details: error.message });
  }
});

router.get('/api/integrations/:id/auth', async (req, res) => {
  try {
    const userId = getUserId(req);
    const entry = await resolveIntegration(req.params.id, userId);
    if (!entry) {
      return res.status(404).json({ error: 'Integration not found' });
    }
    const config = entry.type === 'builtin' ? entry.definition.config : entry.config;
    if (config?.authType !== 'oauth2') {
      return res.status(400).json({ error: 'Integration does not support OAuth2' });
    }

    const redirectUri = req.query.redirectUri || req.query.redirect_uri || config.redirectUri;
    const scopes = req.query.scopes ? String(req.query.scopes).split(',').map(scope => scope.trim()) : undefined;
    const client = createClient(entry);

    if (typeof client.getAuthUrl !== 'function') {
      return res.status(400).json({ error: 'Integration does not support auth URL generation' });
    }

    const auth = client.getAuthUrl(redirectUri, scopes);
    res.json({ authUrl: auth.url, state: auth.state, codeVerifier: auth.codeVerifier });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start OAuth flow', details: error.message });
  }
});

router.get('/api/integrations/:id/callback', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { code, state, redirectUri, redirect_uri } = req.query;
    if (!code) {
      return res.status(400).json({ error: 'Missing code parameter' });
    }

    const entry = await resolveIntegration(req.params.id, userId);
    if (!entry) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const client = createClient(entry);
    if (typeof client.handleCallback !== 'function') {
      return res.status(400).json({ error: 'Integration does not support OAuth callback' });
    }

    const redirect = redirectUri || redirect_uri;
    let tokens;
    if (client.handleCallback.length >= 3) {
      tokens = await client.handleCallback(code, redirect, state);
    } else if (client.handleCallback.length === 2) {
      tokens = await client.handleCallback(code, redirect);
    } else {
      tokens = await client.handleCallback(code);
    }

    const credentials = normalizeTokens(tokens || {});
    const saved = await IntegrationStore.saveInstance(userId, req.params.id, {
      credentials,
      status: 'connected',
      connectedAt: new Date().toISOString()
    });

    res.json({ status: 'connected', credentials: saved.credentials, integrationId: req.params.id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to complete OAuth callback', details: error.message });
  }
});

router.post('/api/integrations/:id/disconnect', async (req, res) => {
  try {
    const userId = getUserId(req);
    await IntegrationStore.deleteInstance(userId, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to disconnect integration', details: error.message });
  }
});

router.get('/api/integrations/connected', async (req, res) => {
  try {
    const userId = getUserId(req);
    const integrations = await IntegrationStore.listUserIntegrations(userId);
    res.json({ integrations, count: integrations.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list connected integrations', details: error.message });
  }
});

router.get('/api/integrations/connected/:id', async (req, res) => {
  try {
    const userId = getUserId(req);
    const instance = await IntegrationStore.getInstance(userId, req.params.id);
    if (!instance) {
      return res.status(404).json({ error: 'Integration connection not found' });
    }
    res.json(instance);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch integration connection', details: error.message });
  }
});

router.get('/api/integrations/:id', async (req, res) => {
  try {
    const userId = getUserId(req);
    const entry = await resolveIntegration(req.params.id, userId);
    if (!entry) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    if (entry.type === 'builtin') {
      return res.json(summarizeIntegration(entry.definition));
    }

    res.json({
      id: entry.config.id,
      name: entry.config.name,
      description: entry.config.description || '',
      icon: entry.config.icon || 'custom',
      category: 'custom',
      authType: entry.config.authType || 'api_key',
      endpoints: entry.config.endpoints || {},
      baseUrl: entry.config.baseUrl || '',
      isCustom: true
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch integration', details: error.message });
  }
});

router.get('/api/integrations/connected/:id/status', async (req, res) => {
  try {
    const userId = getUserId(req);
    const instance = await IntegrationStore.getInstance(userId, req.params.id);
    if (!instance) {
      return res.status(404).json({ error: 'Integration connection not found' });
    }

    let status = instance.status || 'connected';
    if (!instance.credentials?.accessToken && !instance.credentials?.token) {
      status = 'disconnected';
    }

    if (status === 'connected') {
      const entry = await resolveIntegration(req.params.id, userId);
      if (entry) {
        const client = createClient(entry, instance.credentials || {});
        if (typeof client.isTokenExpired === 'function' && client.isTokenExpired()) {
          status = 'expired';
        }
      }
    }

    res.json({
      status,
      integrationId: req.params.id,
      connectedAt: instance.connectedAt,
      expiresAt: instance.credentials?.expiresAt || null
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check integration status', details: error.message });
  }
});

router.post('/api/integrations/connected/:id/refresh', async (req, res) => {
  try {
    const userId = getUserId(req);
    const instance = await IntegrationStore.getInstance(userId, req.params.id);
    if (!instance) {
      return res.status(404).json({ error: 'Integration connection not found' });
    }

    const entry = await resolveIntegration(req.params.id, userId);
    if (!entry) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const client = createClient(entry, instance.credentials || {});
    const refreshFn = typeof client.refreshToken === 'function'
      ? client.refreshToken.bind(client)
      : typeof client.refreshAccessToken === 'function'
        ? client.refreshAccessToken.bind(client)
        : null;

    if (!refreshFn) {
      return res.status(400).json({ error: 'Integration does not support token refresh' });
    }

    const tokens = await refreshFn();
    const credentials = normalizeTokens(tokens || instance.credentials || {});
    const saved = await IntegrationStore.saveInstance(userId, req.params.id, {
      credentials,
      status: 'connected'
    });

    res.json({ status: 'connected', credentials: saved.credentials });
  } catch (error) {
    res.status(500).json({ error: 'Failed to refresh integration', details: error.message });
  }
});

router.post('/api/webhooks/:integrationId', async (req, res) => {
  try {
    const definition = IntegrationRegistry.getIntegration(req.params.integrationId);
    if (!definition?.webhookHandler) {
      return res.status(404).json({ error: 'Webhook integration not found' });
    }
    const rawBody = typeof req.body === 'string'
      ? req.body
      : JSON.stringify(req.body || {});
    const result = await definition.webhookHandler({
      headers: req.headers,
      payload: req.body,
      rawBody
    });
    res.json(result || { ok: true });
  } catch (error) {
    res.status(400).json({ error: 'Webhook handling failed', details: error.message });
  }
});

router.get('/api/integrations/:id/webhooks', async (req, res) => {
  try {
    const userId = getUserId(req);
    const instance = await IntegrationStore.getInstance(userId, req.params.id);
    if (!instance) {
      return res.status(404).json({ error: 'Integration connection not found' });
    }
    res.json({ webhooks: instance.settings?.webhooks || [] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list webhooks', details: error.message });
  }
});

router.post('/api/integrations/:id/webhooks', async (req, res) => {
  try {
    const userId = getUserId(req);
    const instance = await IntegrationStore.getInstance(userId, req.params.id);
    if (!instance) {
      return res.status(404).json({ error: 'Integration connection not found' });
    }

    const entry = await resolveIntegration(req.params.id, userId);
    if (!entry) {
      return res.status(404).json({ error: 'Integration not found' });
    }
    const client = createClient(entry, instance.credentials || {});

    if (typeof client.createWebhook !== 'function') {
      return res.status(400).json({ error: 'Integration does not support webhook creation' });
    }

    const { params } = req.body;
    if (!params) {
      return res.status(400).json({ error: 'params are required to create webhook' });
    }
    const result = Array.isArray(params)
      ? await client.createWebhook(...params)
      : await client.createWebhook(params);

    const webhooks = [...(instance.settings?.webhooks || []), result];
    await IntegrationStore.saveInstance(userId, req.params.id, {
      settings: { ...instance.settings, webhooks },
      status: instance.status || 'connected'
    });

    res.status(201).json({ webhook: result });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create webhook', details: error.message });
  }
});

router.post('/api/integrations/:id/action', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { action, params } = req.body;
    if (!action) {
      return res.status(400).json({ error: 'action is required' });
    }

    const entry = await resolveIntegration(req.params.id, userId);
    if (!entry) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const connection = await IntegrationStore.getInstance(userId, req.params.id);
    const credentials = connection?.credentials || {};
    const client = createClient(entry, credentials);

    if (entry.type === 'custom') {
      const result = await client.executeEndpoint(action, params || {});
      return res.json({ result });
    }

    if (DISALLOWED_ACTIONS.has(action) || action.startsWith('_')) {
      return res.status(400).json({ error: 'Action not allowed' });
    }

    if (typeof client[action] !== 'function') {
      return res.status(404).json({ error: 'Action not supported for integration' });
    }

    const result = Array.isArray(params)
      ? await client[action](...params)
      : params !== undefined
        ? await client[action](params)
        : await client[action]();

    res.json({ result });
  } catch (error) {
    res.status(500).json({ error: 'Failed to execute integration action', details: error.message });
  }
});

export default router;
