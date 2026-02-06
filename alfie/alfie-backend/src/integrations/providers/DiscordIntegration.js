import crypto from 'crypto';
import config from '../../config.js';
import { BaseIntegration } from '../BaseIntegration.js';

const DISCORD_AUTH_URL = 'https://discord.com/api/oauth2/authorize';
const DISCORD_TOKEN_URL = 'https://discord.com/api/oauth2/token';
const DISCORD_API_BASE = 'https://discord.com/api/v10/';
const DEFAULT_SCOPES = ['identify', 'guilds', 'bot', 'webhook.incoming'];

function buildEd25519PublicKeyPem(hexKey) {
  const prefix = '302a300506032b6570032100';
  const der = Buffer.concat([Buffer.from(prefix, 'hex'), Buffer.from(hexKey, 'hex')]);
  const base64 = der.toString('base64');
  const lines = base64.match(/.{1,64}/g)?.join('\n') || base64;
  return `-----BEGIN PUBLIC KEY-----\n${lines}\n-----END PUBLIC KEY-----`;
}

/**
 * Discord OAuth2 + Webhook integration.
 * Supports bot token or user OAuth tokens for API access.
 */
export class DiscordIntegration extends BaseIntegration {
  /**
   * @param {Object} options
   * @param {Object} options.config - Discord integration config overrides.
   * @param {string} options.clientId - OAuth client ID.
   * @param {string} options.clientSecret - OAuth client secret.
   * @param {string} options.redirectUri - OAuth redirect URI.
   * @param {string} options.botToken - Bot token for API access.
   * @param {string} options.publicKey - Application public key for webhook verification.
   */
  constructor(options = {}) {
    const baseConfig = config.integrations?.discord || {};
    const integrationConfig = { ...baseConfig, ...(options.config || {}) };
    const tokenEncryptionSecret =
      integrationConfig.tokenEncryptionSecret ||
      config.integrations?.tokenEncryptionSecret ||
      config.jwt?.refreshSecret;

    super({
      clientId: integrationConfig.clientId || options.clientId,
      clientSecret: integrationConfig.clientSecret || options.clientSecret,
      accessToken: integrationConfig.accessToken || options.accessToken,
      refreshToken: integrationConfig.refreshToken || options.refreshToken,
      tokenType: 'Bearer',
      redirectUri: integrationConfig.redirectUri || options.redirectUri,
      webhookSecret: integrationConfig.publicKey || options.publicKey,
      metadata: { provider: 'discord' },
      tokenEncryptionSecret
    });

    this.authUrl = DISCORD_AUTH_URL;
    this.tokenUrl = DISCORD_TOKEN_URL;
    this.apiBase = DISCORD_API_BASE;
    this.scopes = integrationConfig.scopes?.length ? integrationConfig.scopes : DEFAULT_SCOPES;
    this.botToken = integrationConfig.botToken || options.botToken || null;
    this.publicKey = integrationConfig.publicKey || options.publicKey || null;
    this._bucketStore = new Map();
    this._routeToBucket = new Map();
    this._globalResetAt = 0;
  }

  /**
   * Build an OAuth authorization URL.
   * @param {string} redirectUri - Callback URL to return to.
   * @param {string[]} [scopes] - OAuth scopes.
   * @returns {{url: string, state: string}}
   */
  getAuthUrl(redirectUri, scopes = this.scopes) {
    const state = this.createState({ redirectUri });
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      state,
      prompt: 'consent'
    });

    return {
      url: `${this.authUrl}?${params.toString()}`,
      state
    };
  }

  /**
   * Exchange OAuth code for tokens.
   * @param {string} code - OAuth authorization code.
   * @param {string} redirectUri - OAuth redirect URI.
   * @param {string} [state] - Optional state to validate.
   * @returns {Promise<Object>}
   */
  async handleCallback(code, redirectUri, state = null) {
    if (state) {
      this.consumeState(state);
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    });

    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error_description || data.error || 'Discord OAuth token exchange failed');
    }

    this.setTokens({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      token_type: data.token_type || 'Bearer'
    });

    if (data.refresh_token) {
      this.storeRefreshToken('discord', data.refresh_token);
    }

    return data;
  }

  /**
   * Refresh Discord tokens using stored refresh token.
   * @returns {Promise<Object>} refreshed token payload.
   */
  async refreshToken() {
    if (this.botToken) {
      return { access_token: this.botToken, token_type: 'Bot' };
    }

    const refreshToken = this.getStoredRefreshToken('discord') || this.refreshToken;
    if (!refreshToken) {
      throw new Error('Discord refresh token not available');
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    });

    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error_description || data.error || 'Discord token refresh failed');
    }

    this.setTokens({
      access_token: data.access_token,
      refresh_token: data.refresh_token || refreshToken,
      expires_in: data.expires_in,
      token_type: data.token_type || 'Bearer'
    });

    if (data.refresh_token) {
      this.storeRefreshToken('discord', data.refresh_token);
    }

    return data;
  }

  /**
   * List guilds for the authorized user or bot.
   * @returns {Promise<Object[]>}
   */
  async listGuilds() {
    return this._request('users/@me/guilds');
  }

  /**
   * List channels in a guild.
   * @param {string} guildId - Discord guild ID.
   * @returns {Promise<Object[]>}
   */
  async listChannels(guildId) {
    if (!guildId) {
      throw new Error('guildId is required');
    }
    return this._request(`guilds/${guildId}/channels`);
  }

  /**
   * Send a message to a Discord channel.
   * @param {string} channelId - Channel ID.
   * @param {string} content - Message content.
   * @param {Object} [options] - Additional message options (embeds, components, etc.).
   * @returns {Promise<Object>}
   */
  async sendMessage(channelId, content, options = {}) {
    if (!channelId || !content) {
      throw new Error('channelId and content are required');
    }
    return this._request(`channels/${channelId}/messages`, {
      method: 'POST',
      body: { content, ...options }
    });
  }

  /**
   * Create a webhook for a Discord channel.
   * @param {string} channelId - Channel ID.
   * @param {string} name - Webhook name.
   * @returns {Promise<Object>}
   */
  async createWebhook(channelId, name) {
    if (!channelId || !name) {
      throw new Error('channelId and name are required');
    }
    return this._request(`channels/${channelId}/webhooks`, {
      method: 'POST',
      body: { name }
    });
  }

  /**
   * Verify and process Discord webhook payloads.
   * Emits: message, channel_update, user_joined.
   * @param {string|Object} payload - Raw webhook body or parsed object.
   * @param {string|Object} signature - Signature header or object with signature/timestamp.
   * @param {string} [timestamp] - Signature timestamp header.
   * @returns {Object}
   */
  handleWebhook(payload, signature, timestamp = null) {
    const rawBody = this.normalizeWebhookPayload(payload);
    const signatureData = typeof signature === 'object'
      ? signature
      : { signature, timestamp };
    const sig = signatureData.signature;
    const ts = signatureData.timestamp;

    if (!this.publicKey && this.webhookSecret) {
      this.publicKey = this.webhookSecret;
    }
    if (!this.publicKey) {
      throw new Error('Discord public key not configured');
    }
    if (!sig || !ts) {
      throw new Error('Discord signature or timestamp missing');
    }

    const pem = buildEd25519PublicKeyPem(this.publicKey);
    const verified = crypto.verify(
      null,
      Buffer.from(`${ts}${rawBody}`),
      pem,
      Buffer.from(sig, 'hex')
    );

    if (!verified) {
      throw new Error('Discord webhook signature mismatch');
    }

    const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
    if (parsed?.type === 1) {
      return { ok: true, response: { type: 1 } };
    }

    const eventType = parsed?.t || parsed?.type;
    if (eventType === 'MESSAGE_CREATE') {
      this.emit('message', parsed);
    }
    if (eventType === 'CHANNEL_UPDATE' || eventType === 'GUILD_UPDATE') {
      this.emit('channel_update', parsed);
    }
    if (eventType === 'GUILD_MEMBER_ADD') {
      this.emit('user_joined', parsed);
    }

    return { ok: true };
  }

  async _waitForBucket(bucketId) {
    if (!bucketId) return;
    const bucket = this._bucketStore.get(bucketId);
    if (!bucket) return;
    if (bucket.remaining > 0) return;
    const waitFor = bucket.resetAt - Date.now();
    if (waitFor > 0) {
      await this._sleep(waitFor);
    }
  }

  async _request(route, {
    method = 'GET',
    body = null,
    headers = {}
  } = {}) {
    const routeKey = `${method}:${route}`;
    const bucketId = this._routeToBucket.get(routeKey);

    if (this._globalResetAt > Date.now()) {
      await this._sleep(this._globalResetAt - Date.now());
    }
    if (bucketId) {
      await this._waitForBucket(bucketId);
    }

    const url = new URL(route, this.apiBase).toString();
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: this._getAuthorizationHeader(),
        'Content-Type': 'application/json',
        ...headers
      },
      body: body ? JSON.stringify(body) : null
    });

    const bucket = response.headers.get('x-ratelimit-bucket');
    const remaining = Number(response.headers.get('x-ratelimit-remaining') || '0');
    const resetAfter = Number(response.headers.get('x-ratelimit-reset-after') || '0');
    const reset = Number(response.headers.get('x-ratelimit-reset') || '0');

    if (bucket) {
      const resetAt = resetAfter
        ? Date.now() + resetAfter * 1000
        : reset
          ? reset * 1000
          : Date.now();
      this._bucketStore.set(bucket, { remaining, resetAt });
      this._routeToBucket.set(routeKey, bucket);
    }

    if (response.status === 429) {
      const data = await response.json();
      const retryAfter = Number(data.retry_after || response.headers.get('retry-after') || '1');
      if (data.global || response.headers.get('x-ratelimit-global') === 'true') {
        this._globalResetAt = Date.now() + retryAfter * 1000;
      }
      await this._sleep(retryAfter * 1000);
      return this._request(route, { method, body, headers });
    }

    if (response.status === 204) {
      return null;
    }

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.message || 'Discord API request failed');
    }

    return payload;
  }

  _getAuthorizationHeader() {
    if (this.botToken) {
      return `Bot ${this.botToken}`;
    }
    if (!this.accessToken) {
      throw new Error('Discord access token not configured');
    }
    return `${this.tokenType} ${this.accessToken}`;
  }

  async _sleep(ms) {
    if (ms <= 0) return;
    await new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Factory to create a configured DiscordIntegration instance.
 * @param {Object} options - Configuration overrides.
 * @returns {DiscordIntegration}
 */
export function createDiscordIntegration(options = {}) {
  return new DiscordIntegration(options);
}

export default DiscordIntegration;
