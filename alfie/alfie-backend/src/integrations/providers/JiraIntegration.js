import BaseIntegration from '../BaseIntegration.js';

const AUTH_URL = 'https://auth.atlassian.com/authorize';
const TOKEN_URL = 'https://auth.atlassian.com/oauth/token';
const ACCESSIBLE_RESOURCES_URL = 'https://api.atlassian.com/oauth/token/accessible-resources';

const DEFAULT_SCOPES = [
  'read:jira-work',
  'write:jira-work',
  'read:jira-user',
  'manage:jira-webhook'
];

const DEFAULT_API_VERSION = '3';

const JiraWebhookEvents = {
  issueCreated: 'jira:issue_created',
  issueUpdated: 'jira:issue_updated',
  commentCreated: 'comment_created',
  commentUpdated: 'comment_updated'
};

function toAdf(text) {
  if (!text) {
    return {
      type: 'doc',
      version: 1,
      content: []
    };
  }

  return {
    type: 'doc',
    version: 1,
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: String(text)
          }
        ]
      }
    ]
  };
}

function ipToInt(ip) {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function isIpInCidr(ip, cidr) {
  const [range, bits = '32'] = cidr.split('/');
  const maskBits = Number(bits);
  if (!Number.isInteger(maskBits) || maskBits < 0 || maskBits > 32) return false;
  const mask = maskBits === 0 ? 0 : (~0 << (32 - maskBits)) >>> 0;
  return (ipToInt(ip) & mask) === (ipToInt(range) & mask);
}

export class JiraIntegration extends BaseIntegration {
  constructor(options = {}) {
    super(options);
    this.authUrl = AUTH_URL;
    this.tokenUrl = TOKEN_URL;
    this.scopes = DEFAULT_SCOPES;
    this.cloudId = options.cloudId || options.cloud_id || null;
    this.apiVersion = options.apiVersion || DEFAULT_API_VERSION;
    this.allowedWebhookIps = options.allowedWebhookIps || [];
    this.apiBaseUrl = options.apiBaseUrl || null;
  }

  get baseUrl() {
    if (this.apiBaseUrl) {
      return this.apiBaseUrl.replace(/\/$/, '');
    }
    if (!this.cloudId) {
      throw new Error('cloudId is required to build Jira API URL');
    }
    return `https://api.atlassian.com/ex/jira/${this.cloudId}/rest/api/${this.apiVersion}`;
  }

  getAuthUrl(redirectUri = this.redirectUri, scopes = this.scopes) {
    if (!this.clientId) {
      throw new Error('Jira clientId is required');
    }

    const state = this.createState({ redirectUri, scopes });
    const params = new URLSearchParams({
      audience: 'api.atlassian.com',
      client_id: this.clientId,
      scope: scopes.join(' '),
      redirect_uri: redirectUri,
      response_type: 'code',
      prompt: 'consent',
      state
    });

    return { url: `${this.authUrl}?${params.toString()}`, state };
  }

  async handleCallback(code, redirectUri = this.redirectUri) {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Jira client credentials are required');
    }

    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: redirectUri
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Jira token exchange failed: ${error}`);
    }

    const tokens = await response.json();
    this.setTokens(tokens);
    return tokens;
  }

  async refreshToken() {
    if (!this.refreshToken) {
      throw new Error('Jira refresh token not available');
    }

    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Jira token refresh failed: ${error}`);
    }

    const tokens = await response.json();
    this.setTokens(tokens);
    return tokens;
  }

  async getAccessibleResources() {
    const response = await fetch(ACCESSIBLE_RESOURCES_URL, {
      headers: {
        Authorization: this.getAuthorizationHeader(),
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Jira accessible resources failed: ${error}`);
    }

    const resources = await response.json();
    if (!this.cloudId && Array.isArray(resources) && resources.length > 0) {
      this.cloudId = resources[0].id;
    }
    return resources;
  }

  async request(path, { method = 'GET', query, body } = {}) {
    const url = new URL(path, this.baseUrl);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const response = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: this.getAuthorizationHeader(),
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });

    if (response.status === 204) {
      return null;
    }

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
      throw new Error(`Jira API error: ${response.status} ${response.statusText} - ${text}`);
    }

    return data;
  }

  async listProjects(options = {}) {
    return this.request('/project/search', {
      query: {
        startAt: options.startAt || 0,
        maxResults: options.maxResults || 50
      }
    });
  }

  async getProject(projectKey) {
    if (!projectKey) {
      throw new Error('projectKey is required');
    }
    return this.request(`/project/${encodeURIComponent(projectKey)}`);
  }

  async listIssues(jql, options = {}) {
    if (!jql) {
      throw new Error('jql is required');
    }

    const query = {
      jql,
      startAt: options.startAt || 0,
      maxResults: options.maxResults || 50
    };

    if (options.fields?.length) {
      query.fields = options.fields.join(',');
    }
    if (options.expand?.length) {
      query.expand = options.expand.join(',');
    }

    return this.request('/search', { query });
  }

  async createIssue(projectKey, issueType, summary, description = '', fields = {}) {
    if (!projectKey || !issueType || !summary) {
      throw new Error('projectKey, issueType, and summary are required');
    }

    const issueTypePayload = typeof issueType === 'string'
      ? { name: issueType }
      : issueType;

    const body = {
      fields: {
        project: { key: projectKey },
        issuetype: issueTypePayload,
        summary,
        description: typeof description === 'string' ? toAdf(description) : description,
        ...fields
      }
    };

    const result = await this.request('/issue', { method: 'POST', body });
    if (result) {
      this.emit('issue_created', result);
    }
    return result;
  }

  async updateIssue(issueKey, fields = {}) {
    if (!issueKey) {
      throw new Error('issueKey is required');
    }

    const body = { fields };
    const result = await this.request(`/issue/${encodeURIComponent(issueKey)}`, {
      method: 'PUT',
      body
    });

    this.emit('issue_updated', { issueKey, fields });
    return result;
  }

  async addComment(issueKey, body) {
    if (!issueKey || !body) {
      throw new Error('issueKey and body are required');
    }

    const commentBody = typeof body === 'string' ? toAdf(body) : body;
    const result = await this.request(`/issue/${encodeURIComponent(issueKey)}/comment`, {
      method: 'POST',
      body: { body: commentBody }
    });

    if (result) {
      this.emit('comment_added', result);
    }
    return result;
  }

  async transitionIssue(issueKey, transitionId) {
    if (!issueKey || !transitionId) {
      throw new Error('issueKey and transitionId are required');
    }

    return this.request(`/issue/${encodeURIComponent(issueKey)}/transitions`, {
      method: 'POST',
      body: { transition: { id: String(transitionId) } }
    });
  }

  async createWebhook(url, events = [], jqlFilter = '') {
    if (!url || events.length === 0) {
      throw new Error('url and events are required to create webhook');
    }

    const body = {
      name: `alfie-webhook-${Date.now()}`,
      url,
      events,
      jqlFilter: jqlFilter || undefined
    };

    return this.request('/webhook', { method: 'POST', body });
  }

  handleWebhook(payload) {
    const body = payload?.body ?? payload;
    const headers = payload?.headers || {};
    const ip = payload?.ip;

    if (this.allowedWebhookIps.length > 0) {
      if (!ip) {
        throw new Error('Webhook IP missing');
      }
      const allowed = this.allowedWebhookIps.some((allowedIp) => {
        if (allowedIp.includes('/')) {
          return isIpInCidr(ip, allowedIp);
        }
        return allowedIp === ip;
      });
      if (!allowed) {
        throw new Error(`Webhook IP ${ip} not allowed`);
      }
    }

    if (this.webhookSecret) {
      const signature = headers['x-hub-signature-256'] || headers['x-hub-signature'] || headers['X-Hub-Signature-256'] || headers['X-Hub-Signature'];
      const verification = this.verifyWebhookSignature(body, signature, { prefix: 'sha256=' });
      if (!verification.valid) {
        throw new Error(`Invalid Jira webhook signature: ${verification.reason}`);
      }
    }

    const data = typeof body === 'string' ? JSON.parse(body) : body;
    const eventKey = data?.webhookEvent;
    let event = null;

    if (eventKey === JiraWebhookEvents.issueCreated) event = 'issue_created';
    if (eventKey === JiraWebhookEvents.issueUpdated) event = 'issue_updated';
    if (eventKey === JiraWebhookEvents.commentCreated || eventKey === JiraWebhookEvents.commentUpdated) {
      event = 'comment_added';
    }

    if (event) {
      this.emit(event, data);
    }

    return { event, payload: data };
  }
}

export default JiraIntegration;
