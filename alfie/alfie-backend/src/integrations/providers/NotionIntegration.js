import crypto from 'crypto';
import BaseIntegration from '../BaseIntegration.js';

const NOTION_VERSION = '2022-06-28';
const AUTH_URL = 'https://api.notion.com/v1/oauth/authorize';
const TOKEN_URL = 'https://api.notion.com/v1/oauth/token';
const API_BASE_URL = 'https://api.notion.com/v1/';

class NotionIntegration extends BaseIntegration {
  constructor({ clientId, clientSecret, accessToken = null, refreshToken = null } = {}) {
    super({
      name: 'notion',
      clientId,
      clientSecret,
      accessToken,
      refreshToken,
      apiBaseUrl: API_BASE_URL,
      authUrl: AUTH_URL,
      tokenUrl: TOKEN_URL,
      defaultHeaders: {
        'Notion-Version': NOTION_VERSION,
        Accept: 'application/json',
      },
    });

    this.pendingStates = new Map();
    this.pollingTimer = null;
    this.pollingState = {
      lastSeen: new Map(),
      lastPolledAt: null,
    };
  }

  getAuthUrl(redirectUri) {
    const state = crypto.randomBytes(16).toString('hex');
    this.pendingStates.set(state, { redirectUri, createdAt: Date.now() });
    setTimeout(() => this.pendingStates.delete(state), 10 * 60 * 1000);

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      owner: 'user',
      state,
    });

    return `${this.authUrl}?${params.toString()}`;
  }

  async handleCallback(code, redirectUri) {
    const authHeader = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    });

    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Notion token exchange failed: ${error}`);
    }

    const data = await response.json();
    this.setTokens({
      accessToken: data.access_token,
      refreshToken: data.refresh_token || this.refreshToken,
    });

    return data;
  }

  async notionRequest(path, { method = 'GET', query, body } = {}) {
    if (!this.accessToken) {
      throw new Error('Notion access token not set');
    }

    const headers = {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };

    return this.request(path, {
      method,
      query,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async listDatabases() {
    const body = {
      filter: { property: 'object', value: 'database' },
      sort: { direction: 'descending', timestamp: 'last_edited_time' },
    };

    return this.notionRequest('search', { method: 'POST', body });
  }

  async getDatabase(databaseId) {
    return this.notionRequest(`databases/${databaseId}`);
  }

  async queryDatabase(databaseId, filter = undefined, sorts = undefined) {
    const body = {};
    if (filter) body.filter = filter;
    if (sorts) body.sorts = sorts;
    return this.notionRequest(`databases/${databaseId}/query`, { method: 'POST', body });
  }

  async createPage(parentId, properties = {}, children = []) {
    const parent = typeof parentId === 'object'
      ? parentId
      : { database_id: parentId };

    const body = {
      parent,
      properties,
    };

    if (children?.length) {
      body.children = children;
    }

    const result = await this.notionRequest('pages', { method: 'POST', body });
    this.emitFileEvent('file_created', { resource: 'page', data: result });
    return result;
  }

  async getPage(pageId) {
    return this.notionRequest(`pages/${pageId}`);
  }

  async updatePage(pageId, properties = {}) {
    const body = { properties };
    const result = await this.notionRequest(`pages/${pageId}`, { method: 'PATCH', body });
    this.emitFileEvent('file_updated', { resource: 'page', data: result });
    return result;
  }

  async appendBlocks(pageId, blocks = []) {
    const chunks = [];
    for (let i = 0; i < blocks.length; i += 100) {
      chunks.push(blocks.slice(i, i + 100));
    }

    const results = [];
    for (const chunk of chunks) {
      const result = await this.notionRequest(`blocks/${pageId}/children`, {
        method: 'PATCH',
        body: { children: chunk },
      });
      results.push(result);
    }

    if (blocks.length > 0) {
      this.emitFileEvent('file_updated', { resource: 'page', id: pageId, blocksAppended: blocks.length });
    }

    return results.length === 1 ? results[0] : results;
  }

  async search(query = '', filter = undefined) {
    const body = { query };
    if (filter) body.filter = filter;
    body.sort = { direction: 'descending', timestamp: 'last_edited_time' };
    return this.notionRequest('search', { method: 'POST', body });
  }

  async pollOnce() {
    const result = await this.search('', undefined);
    const now = new Date().toISOString();
    const updates = [];

    for (const item of result.results || []) {
      const lastEdited = item.last_edited_time;
      const previous = this.pollingState.lastSeen.get(item.id);
      if (!previous) {
        this.pollingState.lastSeen.set(item.id, lastEdited);
        const event = { resource: item.object, data: item };
        this.emitFileEvent('file_created', event);
        updates.push({ type: 'file_created', ...event });
      } else if (previous !== lastEdited) {
        this.pollingState.lastSeen.set(item.id, lastEdited);
        const event = { resource: item.object, data: item };
        this.emitFileEvent('file_updated', event);
        updates.push({ type: 'file_updated', ...event });
      }
    }

    this.pollingState.lastPolledAt = now;
    return updates;
  }

  startPolling({ intervalMs = 30000, onEvent } = {}) {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
    }

    this.pollingTimer = setInterval(async () => {
      try {
        const updates = await this.pollOnce();
        if (onEvent && updates.length) {
          for (const update of updates) {
            onEvent(update);
          }
        }
      } catch (error) {
        this.emitEvent('polling_error', { error: error.message });
      }
    }, intervalMs);

    return this.pollingTimer;
  }

  stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }
}

export default NotionIntegration;
