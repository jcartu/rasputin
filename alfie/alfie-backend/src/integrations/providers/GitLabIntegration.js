import BaseIntegration from '../BaseIntegration.js';

const DEFAULT_SCOPES = ['api', 'read_user', 'read_repository', 'write_repository'];
const DEFAULT_BASE_URL = 'https://gitlab.com';

function normalizeBaseUrl(baseUrl) {
  return baseUrl.replace(/\/+$/, '');
}

export default class GitLabIntegration extends BaseIntegration {
  constructor(options = {}) {
    const baseUrl = normalizeBaseUrl(options.baseUrl || DEFAULT_BASE_URL);
    super({
      ...options,
      apiBaseUrl: options.apiBaseUrl || `${baseUrl}/api/v4`,
      authUrl: options.authUrl || `${baseUrl}/oauth/authorize`,
      tokenUrl: options.tokenUrl || `${baseUrl}/oauth/token`,
      userAgent: options.userAgent || 'AlfieGitLabIntegration/1.0',
    });
    this.baseUrl = baseUrl;
    this.tokenExpiresAt = options.tokenExpiresAt || null;
  }

  getAuthUrl(redirectUri, scopes = DEFAULT_SCOPES) {
    if (!this.clientId) {
      throw new Error('GitLab clientId is required');
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
      throw new Error('GitLab OAuth credentials are required');
    }

    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
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
      throw new Error(`GitLab token exchange failed: ${errorText}`);
    }

    const tokens = await response.json();
    this.setAccessToken(tokens.access_token);
    if (tokens.refresh_token) {
      this.setRefreshToken(tokens.refresh_token);
    }
    if (tokens.expires_in) {
      this.tokenExpiresAt = Date.now() + tokens.expires_in * 1000;
    }
    return tokens;
  }

  async refreshToken() {
    if (!this.refreshToken) {
      throw new Error('GitLab refresh token is not available');
    }

    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: this.refreshToken,
      grant_type: 'refresh_token',
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
      throw new Error(`GitLab token refresh failed: ${errorText}`);
    }

    const tokens = await response.json();
    this.setAccessToken(tokens.access_token);
    if (tokens.refresh_token) {
      this.setRefreshToken(tokens.refresh_token);
    }
    if (tokens.expires_in) {
      this.tokenExpiresAt = Date.now() + tokens.expires_in * 1000;
    }
    return tokens;
  }

  async getCurrentUser() {
    return this.request('/user', {
      cacheKey: 'gitlab:user',
      cacheTtl: 60000,
    });
  }

  listProjects(options = {}) {
    return this.paginate(async (page, perPage) => {
      const { data, response } = await this.request('/projects', {
        includeResponse: true,
        query: {
          per_page: perPage,
          page,
          membership: options.membership,
          owned: options.owned,
          starred: options.starred,
          visibility: options.visibility,
          search: options.search,
          simple: options.simple,
          order_by: options.orderBy,
          sort: options.sort,
        },
      });

      const nextPage = response?.headers?.get('x-next-page');
      return {
        items: data,
        nextPage: nextPage ? Number.parseInt(nextPage, 10) : null,
        hasNext: Boolean(nextPage),
      };
    }, {
      startPage: options.page || 1,
      perPage: options.perPage || 50,
      maxPages: options.maxPages || 0,
    });
  }

  async getProject(projectId) {
    if (!projectId) {
      throw new Error('projectId is required');
    }
    return this.request(`/projects/${encodeURIComponent(projectId)}`, {
      cacheKey: `gitlab:project:${projectId}`,
      cacheTtl: 60000,
    });
  }

  listMergeRequests(projectId, options = {}) {
    if (!projectId) {
      throw new Error('projectId is required');
    }
    return this.paginate(async (page, perPage) => {
      const { data, response } = await this.request(`/projects/${encodeURIComponent(projectId)}/merge_requests`, {
        includeResponse: true,
        query: {
          per_page: perPage,
          page,
          state: options.state,
          source_branch: options.sourceBranch,
          target_branch: options.targetBranch,
          order_by: options.orderBy,
          sort: options.sort,
        },
      });

      const nextPage = response?.headers?.get('x-next-page');
      return {
        items: data,
        nextPage: nextPage ? Number.parseInt(nextPage, 10) : null,
        hasNext: Boolean(nextPage),
      };
    }, {
      startPage: options.page || 1,
      perPage: options.perPage || 50,
      maxPages: options.maxPages || 0,
    });
  }

  async createMergeRequest(projectId, sourceBranch, targetBranch, title) {
    if (!projectId || !sourceBranch || !targetBranch || !title) {
      throw new Error('projectId, sourceBranch, targetBranch, and title are required');
    }

    return this.request(`/projects/${encodeURIComponent(projectId)}/merge_requests`, {
      method: 'POST',
      body: {
        source_branch: sourceBranch,
        target_branch: targetBranch,
        title,
      },
    });
  }

  listIssues(projectId, options = {}) {
    if (!projectId) {
      throw new Error('projectId is required');
    }
    return this.paginate(async (page, perPage) => {
      const { data, response } = await this.request(`/projects/${encodeURIComponent(projectId)}/issues`, {
        includeResponse: true,
        query: {
          per_page: perPage,
          page,
          state: options.state,
          labels: Array.isArray(options.labels) ? options.labels.join(',') : options.labels,
          search: options.search,
          order_by: options.orderBy,
          sort: options.sort,
        },
      });

      const nextPage = response?.headers?.get('x-next-page');
      return {
        items: data,
        nextPage: nextPage ? Number.parseInt(nextPage, 10) : null,
        hasNext: Boolean(nextPage),
      };
    }, {
      startPage: options.page || 1,
      perPage: options.perPage || 50,
      maxPages: options.maxPages || 0,
    });
  }

  async createIssue(projectId, title, description) {
    if (!projectId || !title) {
      throw new Error('projectId and title are required');
    }

    return this.request(`/projects/${encodeURIComponent(projectId)}/issues`, {
      method: 'POST',
      body: {
        title,
        description,
      },
    });
  }

  async createWebhook(projectId, url, events = [], token) {
    if (!projectId || !url) {
      throw new Error('projectId and url are required');
    }

    if (token) {
      this.setWebhookToken(token);
    }

    const hookEvents = Array.isArray(events) && events.length > 0
      ? events
      : ['push', 'merge_request', 'issue'];
    const enabledEvents = new Set(hookEvents);
    return this.request(`/projects/${encodeURIComponent(projectId)}/hooks`, {
      method: 'POST',
      body: {
        url,
        token: token || this.webhookToken || undefined,
        push_events: enabledEvents.has('push'),
        merge_requests_events: enabledEvents.has('merge_request') || enabledEvents.has('merge_requests'),
        issues_events: enabledEvents.has('issue') || enabledEvents.has('issues'),
        enable_ssl_verification: true,
      },
    });
  }

  handleWebhook(payload, token) {
    const expectedToken = this.webhookToken || null;
    if (!token) {
      throw new Error('Missing GitLab webhook token');
    }
    if (expectedToken && token !== expectedToken) {
      throw new Error('Invalid GitLab webhook token');
    }

    if (payload?.object_kind === 'push' || payload?.object_kind === 'tag_push') {
      this.emit('push', payload);
    }

    if (payload?.object_kind === 'merge_request') {
      this.emit('merge_request', payload);
    }

    if (payload?.object_kind === 'issue') {
      this.emit('issue', payload);
    }

    return payload;
  }
}
