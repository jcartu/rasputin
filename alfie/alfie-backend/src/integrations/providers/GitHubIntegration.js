import crypto from 'crypto';
import BaseIntegration from '../BaseIntegration.js';

const DEFAULT_SCOPES = ['repo', 'read:user', 'user:email', 'read:org', 'write:repo_hook'];
const API_BASE = 'https://api.github.com/';
const AUTH_URL = 'https://github.com/login/oauth/authorize';
const TOKEN_URL = 'https://github.com/login/oauth/access_token';

function parseLinkHeader(header) {
  if (!header) return {};
  return header.split(',').reduce((acc, part) => {
    const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (match) {
      acc[match[2]] = match[1];
    }
    return acc;
  }, {});
}

function extractPage(linkUrl) {
  try {
    const url = new URL(linkUrl);
    const page = url.searchParams.get('page');
    return page ? Number.parseInt(page, 10) : null;
  } catch (error) {
    return null;
  }
}

export default class GitHubIntegration extends BaseIntegration {
  constructor(options = {}) {
    super({
      ...options,
      apiBaseUrl: options.apiBaseUrl || API_BASE,
      authUrl: options.authUrl || AUTH_URL,
      tokenUrl: options.tokenUrl || TOKEN_URL,
      userAgent: options.userAgent || 'AlfieGitHubIntegration/1.0',
    });
  }

  getAuthUrl(redirectUri, scopes = DEFAULT_SCOPES) {
    if (!this.clientId) {
      throw new Error('GitHub clientId is required');
    }

    const state = crypto.randomBytes(16).toString('hex');
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      state,
    });

    return {
      url: `${this.authUrl}?${params.toString()}`,
      state,
    };
  }

  async handleCallback(code, redirectUri) {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('GitHub OAuth credentials are required');
    }

    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      redirect_uri: redirectUri,
    });

    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub token exchange failed: ${errorText}`);
    }

    const tokens = await response.json();
    this.setAccessToken(tokens.access_token);
    if (tokens.refresh_token) {
      this.setRefreshToken(tokens.refresh_token);
    }
    return tokens;
  }

  async getCurrentUser() {
    const cacheKey = 'github:user';
    const user = await this.request('/user', { cacheKey, cacheTtl: 60000 });

    if (user && !user.email) {
      const emails = await this.request('/user/emails', {
        cacheKey: 'github:user:emails',
        cacheTtl: 60000,
      });
      const primary = Array.isArray(emails)
        ? emails.find(entry => entry.primary && entry.verified)
        : null;
      user.email = primary?.email || emails?.[0]?.email || user.email;
    }

    return user;
  }

  listRepositories(options = {}) {
    return this.paginate(async (page, perPage) => {
      const { data, response } = await this.request('/user/repos', {
        includeResponse: true,
        query: {
          per_page: perPage,
          page,
          visibility: options.visibility,
          affiliation: options.affiliation,
          sort: options.sort,
          direction: options.direction,
        },
      });

      const links = parseLinkHeader(response?.headers?.get('link'));
      const nextPage = links.next ? extractPage(links.next) : null;
      return { items: data, nextPage, hasNext: Boolean(nextPage) };
    }, {
      startPage: options.page || 1,
      perPage: options.perPage || 50,
      maxPages: options.maxPages || 0,
    });
  }

  async getRepository(owner, repo) {
    if (!owner || !repo) {
      throw new Error('owner and repo are required');
    }
    return this.request(`/repos/${owner}/${repo}`, {
      cacheKey: `github:repo:${owner}/${repo}`,
      cacheTtl: 60000,
    });
  }

  listIssues(owner, repo, options = {}) {
    if (!owner || !repo) {
      throw new Error('owner and repo are required');
    }
    return this.paginate(async (page, perPage) => {
      const { data, response } = await this.request(`/repos/${owner}/${repo}/issues`, {
        includeResponse: true,
        query: {
          per_page: perPage,
          page,
          state: options.state,
          labels: Array.isArray(options.labels) ? options.labels.join(',') : options.labels,
          since: options.since,
          assignee: options.assignee,
          creator: options.creator,
          mentioned: options.mentioned,
          milestone: options.milestone,
        },
      });

      const links = parseLinkHeader(response?.headers?.get('link'));
      const nextPage = links.next ? extractPage(links.next) : null;
      return { items: data, nextPage, hasNext: Boolean(nextPage) };
    }, {
      startPage: options.page || 1,
      perPage: options.perPage || 50,
      maxPages: options.maxPages || 0,
    });
  }

  async createIssue(owner, repo, title, body, options = {}) {
    if (!owner || !repo || !title) {
      throw new Error('owner, repo, and title are required');
    }
    return this.request(`/repos/${owner}/${repo}/issues`, {
      method: 'POST',
      body: {
        title,
        body,
        ...options,
      },
    });
  }

  listPullRequests(owner, repo, options = {}) {
    if (!owner || !repo) {
      throw new Error('owner and repo are required');
    }
    return this.paginate(async (page, perPage) => {
      const { data, response } = await this.request(`/repos/${owner}/${repo}/pulls`, {
        includeResponse: true,
        query: {
          per_page: perPage,
          page,
          state: options.state,
          head: options.head,
          base: options.base,
          sort: options.sort,
          direction: options.direction,
        },
      });

      const links = parseLinkHeader(response?.headers?.get('link'));
      const nextPage = links.next ? extractPage(links.next) : null;
      return { items: data, nextPage, hasNext: Boolean(nextPage) };
    }, {
      startPage: options.page || 1,
      perPage: options.perPage || 50,
      maxPages: options.maxPages || 0,
    });
  }

  async createPullRequest(owner, repo, title, head, base, body) {
    if (!owner || !repo || !title || !head || !base) {
      throw new Error('owner, repo, title, head, and base are required');
    }

    return this.request(`/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      body: {
        title,
        head,
        base,
        body,
      },
    });
  }

  async createWebhook(owner, repo, events, url, secret) {
    if (!owner || !repo || !url) {
      throw new Error('owner, repo, and url are required');
    }

    if (secret) {
      this.setWebhookSecret(secret);
    }

    const hookEvents = Array.isArray(events) && events.length > 0
      ? events
      : ['push', 'pull_request', 'issues', 'issue_comment', 'pull_request_review'];

    return this.request(`/repos/${owner}/${repo}/hooks`, {
      method: 'POST',
      body: {
        name: 'web',
        active: true,
        events: hookEvents,
        config: {
          url,
          content_type: 'json',
          secret: secret || this.webhookSecret || undefined,
        },
      },
    });
  }

  async deleteWebhook(owner, repo, hookId) {
    if (!owner || !repo || !hookId) {
      throw new Error('owner, repo, and hookId are required');
    }
    return this.request(`/repos/${owner}/${repo}/hooks/${hookId}`, {
      method: 'DELETE',
    });
  }

  handleWebhook(payload, signature) {
    if (!this.webhookSecret) {
      throw new Error('Webhook secret is not configured');
    }

    if (!signature) {
      throw new Error('Missing GitHub signature');
    }

    const rawBody = Buffer.isBuffer(payload)
      ? payload
      : Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload));

    const expected = `sha256=${crypto
      .createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex')}`;

    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (signatureBuffer.length !== expectedBuffer.length ||
        !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
      throw new Error('Invalid GitHub webhook signature');
    }

    let parsedPayload = payload;
    if (typeof payload === 'string' || Buffer.isBuffer(payload)) {
      try {
        parsedPayload = JSON.parse(rawBody.toString('utf8'));
      } catch (error) {
        throw new Error('Invalid GitHub webhook payload');
      }
    }

    if (parsedPayload?.pull_request) {
      this.emit('pull_request', parsedPayload);
    }
    if (parsedPayload?.issue) {
      this.emit('issue', parsedPayload);
    }
    if (parsedPayload?.commits || parsedPayload?.ref) {
      this.emit('push', parsedPayload);
    }

    return parsedPayload;
  }
}
