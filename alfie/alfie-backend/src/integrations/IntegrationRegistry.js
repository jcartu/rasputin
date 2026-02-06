export const INTEGRATION_CATEGORIES = [
  'communication',
  'project-management',
  'version-control',
  'storage',
  'custom'
];

export class IntegrationRegistry {
  constructor() {
    this.integrations = new Map();
  }

  registerIntegration(integration) {
    if (!integration?.config?.id) {
      throw new Error('Integration must provide config.id');
    }
    if (!INTEGRATION_CATEGORIES.includes(integration.config.category)) {
      throw new Error(`Unsupported integration category: ${integration.config.category}`);
    }
    this.integrations.set(integration.config.id, integration);
    return integration;
  }

  getIntegration(id) {
    return this.integrations.get(id) || null;
  }

  listIntegrations() {
    return Array.from(this.integrations.values());
  }

  listByCategory(category) {
    return this.listIntegrations().filter(integration => integration.config.category === category);
  }
}

export default new IntegrationRegistry();
