import BaseIntegration from './BaseIntegration.js';
import { OAuth2Handler } from './OAuth2Handler.js';

const SUPPORTED_AUTH_TYPES = new Set(['oauth2', 'api_key', 'basic', 'bearer']);
const SAFE_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']);

function safeId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '-');
}

function normalizeBaseUrl(baseUrl) {
  if (!baseUrl) return '';
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

function interpolatePath(pathTemplate, params) {
  if (!pathTemplate) return '';
  let path = pathTemplate;
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value == null) return;
    const safeValue = encodeURIComponent(String(value));
    path = path.replace(new RegExp(`:${key}(?=/|$)`, 'g'), safeValue);
    path = path.replace(new RegExp(`\{${key}\}`, 'g'), safeValue);
  });
  return path;
}

function applyTemplateVariables(value, params) {
  if (typeof value === 'string') {
    return value.replace(/\{\{(.*?)\}\}/g, (_, key) => {
      const trimmed = key.trim();
      return params?.[trimmed] != null ? String(params[trimmed]) : '';
    });
  }
  if (Array.isArray(value)) {
    return value.map(item => applyTemplateVariables(item, params));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((acc, [key, val]) => {
      acc[key] = applyTemplateVariables(val, params);
      return acc;
    }, {});
  }
  return value;
}

export class CustomIntegration extends BaseIntegration {
  constructor({ config, credentials = {} } = {}) {
    super({ tokenEncryptionSecret: config?.tokenEncryptionSecret || '' });
    this.config = {
      ...config,
      id: config?.id || safeId(config?.name || 'custom')
    };
    this.authType = config?.authType || 'api_key';
    this.oauth2Config = config?.oauth2Config || null;
    this.apiKeyConfig = config?.apiKeyConfig || null;
    this.baseUrl = normalizeBaseUrl(config?.baseUrl || '');
    this.endpoints = config?.endpoints || {};
    this.webhookConfig = config?.webhookConfig || null;
    this.credentials = { ...credentials };
    this._oauthHandler = null;

    if (credentials?.accessToken || credentials?.refreshToken) {
      this.setTokens(credentials);
    }
  }

  static validateConfig(config) {
    const errors = [];
    if (!config) {
      errors.push('Config is required');
    }
    if (!config?.name) {
      errors.push('Config name is required');
    }
    if (!config?.baseUrl) {
      errors.push('Config baseUrl is required');
    }
    if (!config?.authType || !SUPPORTED_AUTH_TYPES.has(config.authType)) {
      errors.push('Config authType must be one of oauth2, api_key, basic, bearer');
    }
    if (config?.authType === 'oauth2') {
      if (!config?.oauth2Config?.authUrl || !config?.oauth2Config?.tokenUrl) {
        errors.push('oauth2Config.authUrl and oauth2Config.tokenUrl are required for oauth2');
      }
    }
    if (config?.authType === 'api_key') {
      if (!config?.apiKeyConfig?.headerName) {
        errors.push('apiKeyConfig.headerName is required for api_key authType');
      }
    }
    if (!config?.endpoints || typeof config.endpoints !== 'object') {
      errors.push('Config endpoints must be an object');
    } else {
      Object.entries(config.endpoints).forEach(([name, endpoint]) => {
        if (!endpoint?.method || !endpoint?.path) {
          errors.push(`Endpoint ${name} requires method and path`);
          return;
        }
        const method = String(endpoint.method || '').toUpperCase();
        if (!SAFE_METHODS.has(method)) {
          errors.push(`Endpoint ${name} has unsupported method ${endpoint.method}`);
        }
      });
    }
    return { valid: errors.length === 0, errors };
  }

  static fromConfig(config, credentials = {}) {
    const validation = CustomIntegration.validateConfig(config);
    if (!validation.valid) {
      throw new Error(`Invalid custom integration config: ${validation.errors.join('; ')}`);
    }
    return new CustomIntegration({ config, credentials });
  }

  setCredentials(credentials = {}) {
    this.credentials = { ...this.credentials, ...credentials };
    if (credentials.accessToken || credentials.refreshToken) {
      this.setTokens(credentials);
    }
  }

  _getOAuthHandler() {
    if (this.authType !== 'oauth2') {
      return null;
    }
    if (!this._oauthHandler) {
      const oauthConfig = this.oauth2Config || {};
      this._oauthHandler = new OAuth2Handler({
        clientId: oauthConfig.clientId,
        clientSecret: oauthConfig.clientSecret,
        authUrl: oauthConfig.authUrl,
        tokenUrl: oauthConfig.tokenUrl,
        redirectUri: oauthConfig.redirectUri,
        scopes: oauthConfig.scopes || []
      });
    }
    return this._oauthHandler;
  }

  getAuthUrl(redirectUri, scopes) {
    const handler = this._getOAuthHandler();
    if (!handler) {
      throw new Error('OAuth2 config not available for custom integration');
    }
    const { url, state, codeVerifier } = handler.createAuthorizationUrl({
      redirectUri: redirectUri || this.oauth2Config?.redirectUri,
      scopes: scopes || this.oauth2Config?.scopes || []
    });
    return { url, state, codeVerifier };
  }

  async handleCallback(code, state, redirectUri) {
    const handler = this._getOAuthHandler();
    if (!handler) {
      throw new Error('OAuth2 config not available for custom integration');
    }
    const { tokens } = await handler.handleCallback({ code, state, redirectUri });
    this.setTokens(tokens);
    return tokens;
  }

  async refreshAccessToken(refreshToken) {
    const handler = this._getOAuthHandler();
    if (!handler) {
      throw new Error('OAuth2 config not available for custom integration');
    }
    const refreshed = await handler.refreshAccessToken({
      refreshToken: refreshToken || this.credentials.refreshToken || this.refreshToken
    });
    this.setTokens(refreshed);
    return refreshed;
  }

  _buildAuthHeaders() {
    const headers = {};
    if (this.authType === 'api_key') {
      const headerName = this.apiKeyConfig?.headerName || 'x-api-key';
      const prefix = this.apiKeyConfig?.prefix || '';
      const apiKey = this.credentials.apiKey || this.credentials.token || this.accessToken;
      if (apiKey) {
        headers[headerName] = `${prefix}${apiKey}`;
      }
    } else if (this.authType === 'basic') {
      const username = this.credentials.username || '';
      const password = this.credentials.password || '';
      const token = Buffer.from(`${username}:${password}`).toString('base64');
      headers.Authorization = `Basic ${token}`;
    } else if (this.authType === 'bearer') {
      const token = this.credentials.token || this.accessToken;
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    } else if (this.authType === 'oauth2') {
      if (this.accessToken) {
        headers.Authorization = this.getAuthorizationHeader();
      }
    }
    return headers;
  }

  async executeEndpoint(endpointName, params = {}) {
    const endpoint = this.endpoints?.[endpointName];
    if (!endpoint) {
      throw new Error(`Unknown endpoint: ${endpointName}`);
    }

    const method = String(endpoint.method || 'GET').toUpperCase();
    const path = interpolatePath(endpoint.path, params);
    const baseUrl = this.baseUrl || endpoint.baseUrl || '';
    const url = new URL(path, baseUrl);

    const paramList = Array.isArray(endpoint.params) ? endpoint.params : [];
    paramList.forEach(param => {
      const key = typeof param === 'string' ? param : param?.name;
      if (!key) return;
      if (params[key] != null) {
        url.searchParams.set(key, String(params[key]));
      }
    });

    if (params.query && typeof params.query === 'object') {
      Object.entries(params.query).forEach(([key, value]) => {
        if (value == null) return;
        url.searchParams.set(key, String(value));
      });
    }

    const headers = {
      ...this._buildAuthHeaders(),
      ...(endpoint.headers || {})
    };

    let body = null;
    if (!['GET', 'HEAD'].includes(method)) {
      const rawBody = params.body ?? endpoint.body ?? null;
      if (rawBody !== null && rawBody !== undefined) {
        const resolved = applyTemplateVariables(rawBody, params);
        body = JSON.stringify(resolved);
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      }
    }

    const response = await fetch(url.toString(), {
      method,
      headers,
      body
    });

    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
      throw new Error(`Custom integration request failed: ${response.status} ${message}`);
    }

    return payload;
  }

  async testConnection() {
    const candidates = ['testConnection', 'health', 'ping', 'listItems'];
    for (const name of candidates) {
      if (this.endpoints?.[name]) {
        return this.executeEndpoint(name);
      }
    }

    const headers = this._buildAuthHeaders();
    const url = this.baseUrl ? new URL(this.baseUrl) : null;
    if (!url) {
      throw new Error('Custom integration baseUrl not configured');
    }

    const response = await fetch(url.toString(), { method: 'GET', headers });
    if (!response.ok) {
      throw new Error(`Custom integration test failed: ${response.status}`);
    }
    return { ok: true, status: response.status };
  }
}

export default CustomIntegration;
