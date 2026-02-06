export class IntegrationConfig {
  constructor({
    id,
    name,
    description = '',
    icon = '',
    category = 'custom',
    authType = 'none',
    scopes = [],
    endpoints = {}
  }) {
    if (!id || !name) {
      throw new Error('IntegrationConfig requires id and name');
    }
    this.id = id;
    this.name = name;
    this.description = description;
    this.icon = icon;
    this.category = category;
    this.authType = authType;
    this.scopes = Array.isArray(scopes) ? scopes : [];
    this.endpoints = endpoints || {};
  }
}

export class IntegrationInstance {
  constructor({
    userId,
    integrationId,
    credentials,
    settings = {},
    status = 'disconnected',
    connectedAt = null
  }) {
    if (!userId || !integrationId) {
      throw new Error('IntegrationInstance requires userId and integrationId');
    }
    this.userId = userId;
    this.integrationId = integrationId;
    this.credentials = credentials || null;
    this.settings = settings || {};
    this.status = status;
    this.connectedAt = connectedAt;
  }
}

export class WebhookConfig {
  constructor({
    endpoint,
    secret,
    events = [],
    verified = false
  }) {
    if (!endpoint) {
      throw new Error('WebhookConfig requires endpoint');
    }
    this.endpoint = endpoint;
    this.secret = secret || '';
    this.events = Array.isArray(events) ? events : [];
    this.verified = verified;
  }
}
