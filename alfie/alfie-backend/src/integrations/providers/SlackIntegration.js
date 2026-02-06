import crypto from 'crypto';
import config from '../../config.js';
import { BaseIntegration } from '../BaseIntegration.js';

const SLACK_AUTH_URL = 'https://slack.com/oauth/v2/authorize';
const SLACK_TOKEN_URL = 'https://slack.com/api/oauth.v2.access';
const SLACK_API_BASE = 'https://slack.com/api/';
const DEFAULT_SCOPES = [
  'channels:read',
  'channels:history',
  'chat:write',
  'users:read',
  'incoming-webhook'
];
const DEFAULT_TIER_LIMITS = {
  tier1: { limit: 50, windowMs: 60000 },
  tier2: { limit: 20, windowMs: 60000 },
  tier3: { limit: 5, windowMs: 60000 }
};
const DEFAULT_METHOD_TIERS = {
  'conversations.list': 'tier2',
  'conversations.history': 'tier2',
  'chat.postMessage': 'tier3',
  'auth.test': 'tier1'
};
const MAX_SIGNATURE_AGE_MS = 5 * 60 * 1000;

/**
 * Slack OAuth2 + Webhook integration.
 * Handles OAuth, channel listing, message posting, and event webhooks.
 */
export class SlackIntegration extends BaseIntegration {
  /**
   * @param {Object} options
   * @param {Object} options.config - Slack integration config overrides.
   * @param {string} options.clientId - OAuth client ID.
   * @param {string} options.clientSecret - OAuth client secret.
   * @param {string} options.signingSecret - Slack signing secret.
   * @param {string} options.botToken - Bot token for API access.
   * @param {string} options.redirectUri - OAuth redirect URI.
   */
  constructor(options = {}) {
    const baseConfig = config.integrations?.slack || {};
    const integrationConfig = { ...baseConfig, ...(options.config || {}) };
    const tokenEncryptionSecret =
      integrationConfig.tokenEncryptionSecret ||
      config.integrations?.tokenEncryptionSecret ||
      config.jwt?.refreshSecret;

    super({
      clientId: integrationConfig.clientId || options.clientId,
      clientSecret: integrationConfig.clientSecret || options.clientSecret,
      accessToken: integrationConfig.botToken || integrationConfig.accessToken || options.botToken,
      refreshToken: integrationConfig.refreshToken || options.refreshToken,
      tokenType: 'Bearer',
      redirectUri: integrationConfig.redirectUri || options.redirectUri,
      webhookSecret: integrationConfig.signingSecret || options.signingSecret,
      metadata: { provider: 'slack' },
      tokenEncryptionSecret
    });

    this.authUrl = SLACK_AUTH_URL;
    this.tokenUrl = SLACK_TOKEN_URL;
    this.apiBase = SLACK_API_BASE;
    this.scopes = integrationConfig.scopes?.length ? integrationConfig.scopes : DEFAULT_SCOPES;
    this.botToken = integrationConfig.botToken || options.botToken || this.accessToken;
    this.userToken = integrationConfig.userToken || options.userToken || null;
    this.methodTiers = { ...DEFAULT_METHOD_TIERS, ...(integrationConfig.methodTiers || {}) };
    this.tierLimits = { ...DEFAULT_TIER_LIMITS, ...(integrationConfig.rateLimits || {}) };
    this._tierState = new Map();
  }

  /**
   * Build an OAuth authorization URL.
   * @param {string} redirectUri - Callback URL to return to.
   * @param {string[]} [scopes] - OAuth scopes for the bot token.
   * @returns {{url: string, state: string}}
   */
  getAuthUrl(redirectUri, scopes = this.scopes) {
    const state = this.createState({ redirectUri });
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      state
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
      redirect_uri: redirectUri
    });

    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Slack OAuth token exchange failed');
    }

    this.accessToken = data.access_token || this.accessToken;
    this.botToken = data.access_token || this.botToken;
    this.userToken = data.authed_user?.access_token || this.userToken;

    if (data.refresh_token) {
      this.storeRefreshToken('slack', data.refresh_token);
    }

    return data;
  }

  /**
   * Slack tokens generally do not expire; verify access instead.
   * @returns {Promise<string>} valid token
   */
  async refreshToken() {
    const token = this.botToken || this.accessToken;
    if (!token) {
      throw new Error('Slack access token not configured');
    }

    await this._request('auth.test', {
      method: 'POST',
      tier: 'tier1',
      token
    });

    return token;
  }

  /**
   * List Slack channels the bot has access to.
   * @returns {Promise<Object[]>}
   */
  async listChannels() {
    const data = await this._request('conversations.list', {
      params: {
        types: 'public_channel,private_channel',
        exclude_archived: 'true'
      },
      tier: this.methodTiers['conversations.list']
    });
    return data.channels || [];
  }

  /**
   * Send a message to a channel.
   * @param {string} channel - Channel ID.
   * @param {string} text - Message text.
   * @param {Object} [options] - Additional Slack message options.
   * @returns {Promise<Object>}
   */
  async sendMessage(channel, text, options = {}) {
    if (!channel || !text) {
      throw new Error('Channel and text are required to send Slack message');
    }
    const payload = { channel, text, ...options };
    const data = await this._request('chat.postMessage', {
      method: 'POST',
      body: payload,
      tier: this.methodTiers['chat.postMessage']
    });
    return data;
  }

  /**
   * Retrieve channel history.
   * @param {string} channel - Channel ID.
   * @param {number} [limit=50] - Number of messages to retrieve.
   * @returns {Promise<Object[]>}
   */
  async getChannelHistory(channel, limit = 50) {
    const data = await this._request('conversations.history', {
      params: {
        channel,
        limit: String(limit)
      },
      tier: this.methodTiers['conversations.history']
    });
    return data.messages || [];
  }

  /**
   * Verify and process Slack webhook payloads.
   * Emits: message, channel_update, user_joined.
   * @param {string|Object} payload - Raw webhook body or parsed object.
   * @param {string} signature - X-Slack-Signature header.
   * @param {string|number} timestamp - X-Slack-Request-Timestamp header.
   * @returns {Object}
   */
  handleWebhook(payload, signature, timestamp) {
    if (!this.webhookSecret) {
      throw new Error('Slack signing secret not configured');
    }

    const rawBody = this.normalizeWebhookPayload(payload);
    const ts = Number(timestamp);
    if (!ts) {
      throw new Error('Slack webhook timestamp missing');
    }
    if (Math.abs(Date.now() - ts * 1000) > MAX_SIGNATURE_AGE_MS) {
      throw new Error('Slack webhook timestamp outside allowed window');
    }

    const signatureBase = `v0:${ts}:${rawBody}`;
    const digest = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(signatureBase, 'utf8')
      .digest('hex');
    const expected = `v0=${digest}`;

    const expectedBuffer = Buffer.from(expected, 'utf8');
    const providedBuffer = Buffer.from(signature || '', 'utf8');
    if (expectedBuffer.length !== providedBuffer.length) {
      throw new Error('Slack webhook signature length mismatch');
    }
    if (!crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
      throw new Error('Slack webhook signature mismatch');
    }

    const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
    if (parsed?.type === 'url_verification') {
      return { ok: true, challenge: parsed.challenge };
    }

    if (parsed?.type === 'event_callback' && parsed.event) {
      const event = parsed.event;
      if (event.type === 'message' && !event.subtype) {
        this.emit('message', event);
      }
      if (
        event.type === 'channel_created' ||
        event.type === 'channel_rename' ||
        event.type === 'channel_archive' ||
        event.type === 'channel_unarchive' ||
        event.type === 'channel_deleted'
      ) {
        this.emit('channel_update', event);
      }
      if (event.type === 'member_joined_channel' || event.type === 'team_join') {
        this.emit('user_joined', event);
      }
    }

    return { ok: true };
  }

  async _applyRateLimit(tier = 'tier2') {
    const limits = this.tierLimits[tier] || this.tierLimits.tier2;
    if (!limits) return;
    const now = Date.now();
    const state = this._tierState.get(tier) || {
      count: 0,
      resetAt: now + limits.windowMs
    };

    if (now >= state.resetAt) {
      state.count = 0;
      state.resetAt = now + limits.windowMs;
    }

    if (state.count >= limits.limit) {
      const delay = Math.max(0, state.resetAt - now);
      await this._sleep(delay);
      state.count = 0;
      state.resetAt = Date.now() + limits.windowMs;
    }

    state.count += 1;
    this._tierState.set(tier, state);
  }

  async _request(endpoint, {
    method = 'GET',
    params = null,
    body = null,
    tier = 'tier2',
    token = null
  } = {}) {
    const authToken = token || this.botToken || this.accessToken;
    if (!authToken) {
      throw new Error('Slack access token not configured');
    }

    await this._applyRateLimit(tier);

    const url = new URL(endpoint, this.apiBase);
    if (params) {
      url.search = new URLSearchParams(params).toString();
    }

    const response = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : null
    });

    if (response.status === 429) {
      const retryAfter = Number(response.headers.get('retry-after') || '1');
      await this._sleep(retryAfter * 1000);
      return this._request(endpoint, { method, params, body, tier, token: authToken });
    }

    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Slack API request failed');
    }

    return data;
  }

  async _sleep(ms) {
    if (ms <= 0) return;
    await new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Factory to create a configured SlackIntegration instance.
 * @param {Object} options - Configuration overrides.
 * @returns {SlackIntegration}
 */
export function createSlackIntegration(options = {}) {
  return new SlackIntegration(options);
}

export default SlackIntegration;
