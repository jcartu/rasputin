import crypto from 'crypto';
import config from '../config.js';
import IntegrationStore from './IntegrationStore.js';

const DEFAULT_STATE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_RETRY = { retries: 2, backoffMs: 750 };

function base64Url(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(value) {
  const normalized = value
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padding = normalized.length % 4 ? '='.repeat(4 - (normalized.length % 4)) : '';
  return Buffer.from(`${normalized}${padding}`, 'base64');
}

function sha256Base64Url(input) {
  return base64Url(crypto.createHash('sha256').update(input).digest());
}

function deriveKey(secret) {
  return crypto.createHash('sha256').update(secret).digest();
}

function timingSafeEqual(a, b) {
  if (!a || !b) {
    return false;
  }
  const bufferA = Buffer.isBuffer(a) ? a : Buffer.from(a);
  const bufferB = Buffer.isBuffer(b) ? b : Buffer.from(b);
  if (bufferA.length !== bufferB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufferA, bufferB);
}

class StateStore {
  constructor(ttlMs = DEFAULT_STATE_TTL_MS) {
    this.ttlMs = ttlMs;
    this.states = new Map();
  }

  create(payload) {
    const state = base64Url(crypto.randomBytes(32));
    const expiresAt = Date.now() + this.ttlMs;
    this.states.set(state, { payload, expiresAt });
    setTimeout(() => this.states.delete(state), this.ttlMs);
    return state;
  }

  consume(state) {
    const entry = this.states.get(state);
    if (!entry) {
      return null;
    }
    this.states.delete(state);
    if (entry.expiresAt < Date.now()) {
      return null;
    }
    return entry.payload;
  }
}

export class SecureCredentialStore {
  constructor({ store = IntegrationStore, encryptionKey } = {}) {
    const key = encryptionKey || process.env.INTEGRATIONS_ENCRYPTION_KEY || config.backupEncryptionKey;
    if (!key) {
      throw new Error('Missing encryption key for credential store');
    }
    this.store = store;
    this.key = deriveKey(String(key));
  }

  encrypt(data) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const payload = Buffer.from(JSON.stringify(data));
    const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      alg: 'aes-256-gcm',
      iv: base64Url(iv),
      tag: base64Url(tag),
      data: base64Url(encrypted)
    };
  }

  decrypt(payload) {
    if (!payload) {
      return null;
    }
    if (payload.alg !== 'aes-256-gcm') {
      throw new Error('Unsupported credential encryption');
    }
    const iv = base64UrlDecode(payload.iv);
    const tag = base64UrlDecode(payload.tag);
    const encrypted = base64UrlDecode(payload.data);
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8'));
  }

  async saveCredentials(userId, integrationId, credentials) {
    const encrypted = this.encrypt(credentials);
    await this.store.saveInstance(userId, integrationId, {
      credentials: encrypted,
      status: 'connected',
      connectedAt: new Date().toISOString()
    });
    return encrypted;
  }

  async loadCredentials(userId, integrationId) {
    const instance = await this.store.getInstance(userId, integrationId);
    if (!instance?.credentials) {
      return null;
    }
    return this.decrypt(instance.credentials);
  }

  async deleteCredentials(userId, integrationId) {
    return this.store.deleteInstance(userId, integrationId);
  }
}

export class OAuth2Handler {
  constructor({
    clientId,
    clientSecret,
    authUrl,
    tokenUrl,
    redirectUri,
    scopes = [],
    credentialStore,
    stateTtlMs = DEFAULT_STATE_TTL_MS,
    retry = DEFAULT_RETRY
  }) {
    if (!clientId || !authUrl || !tokenUrl) {
      throw new Error('OAuth2Handler requires clientId, authUrl, and tokenUrl');
    }
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.authUrl = authUrl;
    this.tokenUrl = tokenUrl;
    this.redirectUri = redirectUri;
    this.scopes = scopes;
    this.stateStore = new StateStore(stateTtlMs);
    this.credentialStore = credentialStore || new SecureCredentialStore();
    this.retry = retry;
  }

  generateCodeVerifier() {
    return base64Url(crypto.randomBytes(64));
  }

  createAuthorizationUrl({
    redirectUri = this.redirectUri,
    scopes = this.scopes,
    stateData = {},
    usePkce = true,
    extraParams = {}
  } = {}) {
    const codeVerifier = usePkce ? this.generateCodeVerifier() : null;
    const codeChallenge = usePkce ? sha256Base64Url(codeVerifier) : null;

    const state = this.stateStore.create({
      ...stateData,
      redirectUri,
      codeVerifier
    });

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: Array.isArray(scopes) ? scopes.join(' ') : String(scopes),
      state,
      ...extraParams
    });

    if (usePkce) {
      params.set('code_challenge_method', 'S256');
      params.set('code_challenge', codeChallenge);
    }

    return {
      url: `${this.authUrl}?${params.toString()}`,
      state,
      codeVerifier
    };
  }

  validateState(state) {
    const data = this.stateStore.consume(state);
    if (!data) {
      return { valid: false, error: 'Invalid or expired state' };
    }
    return { valid: true, data };
  }

  async exchangeCodeForTokens({ code, codeVerifier, redirectUri = this.redirectUri }) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret || '',
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    });

    if (codeVerifier) {
      params.set('code_verifier', codeVerifier);
    }

    const response = await this._fetchToken(params);
    return this._normalizeTokenResponse(response);
  }

  async refreshAccessToken({ refreshToken }) {
    if (!refreshToken) {
      throw new Error('refreshAccessToken requires refreshToken');
    }
    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret || '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    });

    const response = await this._retry(() => this._fetchToken(params));
    return this._normalizeTokenResponse(response, refreshToken);
  }

  async handleCallback({ code, state, redirectUri }) {
    const validation = this.validateState(state);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    const { codeVerifier } = validation.data;
    const tokens = await this.exchangeCodeForTokens({
      code,
      codeVerifier,
      redirectUri: redirectUri || validation.data.redirectUri || this.redirectUri
    });
    return { tokens, stateData: validation.data };
  }

  async storeCredentials({ userId, integrationId, credentials }) {
    return this.credentialStore.saveCredentials(userId, integrationId, credentials);
  }

  async loadCredentials({ userId, integrationId }) {
    return this.credentialStore.loadCredentials(userId, integrationId);
  }

  async deleteCredentials({ userId, integrationId }) {
    return this.credentialStore.deleteCredentials(userId, integrationId);
  }

  async _fetchToken(params) {
    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: params.toString()
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OAuth token request failed: ${error}`);
    }
    return response.json();
  }

  async _retry(operation) {
    const { retries, backoffMs } = this.retry;
    let attempt = 0;
    while (true) {
      try {
        return await operation();
      } catch (error) {
        if (attempt >= retries) {
          throw error;
        }
        const delay = backoffMs * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        attempt += 1;
      }
    }
  }

  _normalizeTokenResponse(response, fallbackRefreshToken = null) {
    const now = Date.now();
    const expiresIn = response.expires_in || response.expiresIn;
    const expiresAt = expiresIn ? now + Number(expiresIn) * 1000 : null;

    return {
      accessToken: response.access_token,
      refreshToken: response.refresh_token || fallbackRefreshToken,
      tokenType: response.token_type || response.tokenType,
      scope: response.scope,
      expiresIn,
      expiresAt,
      raw: response
    };
  }
}

export { timingSafeEqual };
