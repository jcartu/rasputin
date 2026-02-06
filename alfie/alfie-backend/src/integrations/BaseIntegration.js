import crypto from 'crypto';
import { EventEmitter } from 'events';

const STATE_TTL_MS = 10 * 60 * 1000;

export class BaseIntegration extends EventEmitter {
  constructor({
    clientId = '',
    clientSecret = '',
    accessToken = '',
    refreshToken = '',
    tokenType = 'Bearer',
    expiresAt = null,
    redirectUri = '',
    webhookSecret = '',
    metadata = {},
    tokenEncryptionSecret = ''
  } = {}) {
    super();
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.tokenType = tokenType;
    this.expiresAt = expiresAt;
    this.redirectUri = redirectUri;
    this.webhookSecret = webhookSecret;
    this.metadata = metadata;
    this.tokenEncryptionSecret = tokenEncryptionSecret;
    this._stateStore = new Map();
    this._encryptedRefreshTokens = new Map();
  }

  setTokens(tokens = {}) {
    const accessToken = tokens.access_token || tokens.accessToken || this.accessToken;
    const refreshToken = tokens.refresh_token || tokens.refreshToken || this.refreshToken;
    const tokenType = tokens.token_type || tokens.tokenType || this.tokenType;
    const expiresIn = tokens.expires_in || tokens.expiresIn || null;

    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.tokenType = tokenType;

    if (tokens.expiresAt) {
      this.expiresAt = tokens.expiresAt;
    } else if (expiresIn) {
      this.expiresAt = Date.now() + Number(expiresIn) * 1000;
    }

    return {
      accessToken: this.accessToken,
      refreshToken: this.refreshToken,
      tokenType: this.tokenType,
      expiresAt: this.expiresAt
    };
  }

  isTokenExpired() {
    if (!this.expiresAt) return false;
    return Date.now() >= this.expiresAt - 5000;
  }

  getAuthorizationHeader() {
    if (!this.accessToken) {
      throw new Error('Access token not set');
    }
    return `${this.tokenType} ${this.accessToken}`;
  }

  createState(payload = {}) {
    const state = crypto.randomBytes(32).toString('hex');
    this._stateStore.set(state, {
      payload,
      createdAt: Date.now()
    });
    setTimeout(() => this._stateStore.delete(state), STATE_TTL_MS);
    return state;
  }

  consumeState(state) {
    const data = this._stateStore.get(state);
    if (!data) {
      throw new Error('Invalid or expired OAuth state');
    }
    this._stateStore.delete(state);
    return data.payload;
  }

  normalizeWebhookPayload(payload) {
    if (payload == null) return '';
    if (typeof payload === 'string') return payload;
    if (Buffer.isBuffer(payload)) return payload.toString('utf8');
    return JSON.stringify(payload);
  }

  verifyWebhookSignature(payload, signature, {
    secret = this.webhookSecret,
    algorithm = 'sha256',
    prefix = ''
  } = {}) {
    if (!secret) {
      return { valid: false, reason: 'Webhook secret not configured' };
    }
    if (!signature) {
      return { valid: false, reason: 'Missing signature' };
    }

    const normalizedPayload = this.normalizeWebhookPayload(payload);
    const rawSignature = prefix && signature.startsWith(prefix)
      ? signature.slice(prefix.length)
      : signature;

    const expected = crypto
      .createHmac(algorithm, secret)
      .update(normalizedPayload, 'utf8')
      .digest('hex');

    const expectedBuffer = Buffer.from(expected, 'utf8');
    const providedBuffer = Buffer.from(rawSignature, 'utf8');

    if (expectedBuffer.length !== providedBuffer.length) {
      return { valid: false, reason: 'Signature length mismatch' };
    }

    const valid = crypto.timingSafeEqual(expectedBuffer, providedBuffer);
    return { valid, reason: valid ? null : 'Signature mismatch' };
  }

  encryptToken(token) {
    if (!token) return null;
    if (!this.tokenEncryptionSecret) {
      throw new Error('Token encryption secret not configured');
    }

    const key = crypto.createHash('sha256').update(this.tokenEncryptionSecret).digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return [iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join('.');
  }

  decryptToken(payload) {
    if (!payload) return null;
    if (!this.tokenEncryptionSecret) {
      throw new Error('Token encryption secret not configured');
    }

    const [ivB64, tagB64, encryptedB64] = payload.split('.');
    if (!ivB64 || !tagB64 || !encryptedB64) {
      throw new Error('Invalid encrypted token payload');
    }

    const key = crypto.createHash('sha256').update(this.tokenEncryptionSecret).digest();
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const encrypted = Buffer.from(encryptedB64, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  }

  storeRefreshToken(key, refreshToken) {
    if (!refreshToken) return;
    const encrypted = this.encryptToken(refreshToken);
    this._encryptedRefreshTokens.set(key, encrypted);
  }

  getStoredRefreshToken(key) {
    const encrypted = this._encryptedRefreshTokens.get(key);
    if (!encrypted) return null;
    return this.decryptToken(encrypted);
  }

  clearRefreshToken(key) {
    this._encryptedRefreshTokens.delete(key);
  }
}

export default BaseIntegration;
