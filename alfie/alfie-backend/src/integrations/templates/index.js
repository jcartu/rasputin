import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import IntegrationStore from '../IntegrationStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CUSTOM_TEMPLATES_DIR = path.resolve(__dirname, '../../../data/integration-templates');

let builtInTemplates = new Map();
let customTemplates = new Map();
let isLoaded = false;

function safeId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '-');
}

async function readJson(filePath) {
  const data = await fs.readFile(filePath, 'utf8');
  return JSON.parse(data);
}

async function loadBuiltInTemplates() {
  const entries = await fs.readdir(__dirname);
  const jsonFiles = entries.filter(file => file.endsWith('.json'));
  const results = await Promise.all(jsonFiles.map(file => readJson(path.join(__dirname, file))));
  builtInTemplates = new Map(results.map(template => [template.id, template]));
}

async function loadCustomTemplates() {
  customTemplates = new Map();
  try {
    const entries = await fs.readdir(CUSTOM_TEMPLATES_DIR);
    const jsonFiles = entries.filter(file => file.endsWith('.json'));
    const results = await Promise.all(jsonFiles.map(file => readJson(path.join(CUSTOM_TEMPLATES_DIR, file))));
    results.forEach(template => {
      if (template?.id) {
        customTemplates.set(template.id, template);
      }
    });
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

async function ensureLoaded() {
  if (isLoaded) return;
  await loadBuiltInTemplates();
  await loadCustomTemplates();
  isLoaded = true;
}

function deepMerge(base, overrides) {
  if (!overrides || typeof overrides !== 'object') {
    return { ...base };
  }
  const output = { ...base };
  Object.entries(overrides).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      output[key] = [...value];
      return;
    }
    if (value && typeof value === 'object' && typeof output[key] === 'object') {
      output[key] = deepMerge(output[key] || {}, value);
      return;
    }
    output[key] = value;
  });
  return output;
}

async function persistCustomTemplate(template) {
  await fs.mkdir(CUSTOM_TEMPLATES_DIR, { recursive: true });
  const filePath = path.join(CUSTOM_TEMPLATES_DIR, `${template.id}.json`);
  await fs.writeFile(filePath, JSON.stringify(template, null, 2), 'utf8');
}

export async function listTemplates() {
  await ensureLoaded();
  return [...builtInTemplates.values(), ...customTemplates.values()];
}

export async function getTemplate(templateId) {
  await ensureLoaded();
  return builtInTemplates.get(templateId) || customTemplates.get(templateId) || null;
}

export async function applyTemplate(userId, templateId, customizations = {}) {
  if (!userId) {
    throw new Error('applyTemplate requires userId');
  }
  const template = await getTemplate(templateId);
  if (!template) {
    throw new Error('Template not found');
  }
  const mergedConfig = deepMerge(template.config || {}, customizations || {});
  const connection = await IntegrationStore.saveInstance(userId, template.integrationId, {
    settings: mergedConfig,
    status: 'configured',
    templateId: template.id,
    templateName: template.name
  });
  return { template, connection };
}

export async function createTemplate(name, integrationId, config = {}) {
  if (!name || !integrationId) {
    throw new Error('createTemplate requires name and integrationId');
  }
  await ensureLoaded();
  let id = safeId(name);
  if (!id) {
    id = `${safeId(integrationId)}-${Date.now()}`;
  }
  let counter = 1;
  while (builtInTemplates.has(id) || customTemplates.has(id)) {
    id = `${safeId(name)}-${counter}`;
    counter += 1;
  }
  const now = new Date().toISOString();
  const template = {
    id,
    name,
    integrationId,
    description: '',
    category: 'custom',
    config,
    createdAt: now,
    updatedAt: now,
    isCustom: true
  };
  customTemplates.set(id, template);
  await persistCustomTemplate(template);
  return template;
}

function parseConnectionId(connectionId) {
  if (typeof connectionId === 'object' && connectionId) {
    return { userId: connectionId.userId, integrationId: connectionId.integrationId };
  }
  if (typeof connectionId === 'string') {
    const [userId, integrationId] = connectionId.split(':');
    return { userId, integrationId };
  }
  return { userId: null, integrationId: null };
}

export async function exportTemplate(connectionId) {
  const { userId, integrationId } = parseConnectionId(connectionId);
  if (!userId || !integrationId) {
    throw new Error('exportTemplate requires connectionId in userId:integrationId format');
  }
  const connection = await IntegrationStore.getInstance(userId, integrationId);
  if (!connection) {
    throw new Error('Connection not found');
  }
  const name = `${integrationId}-export-${new Date().toISOString().slice(0, 10)}`;
  return createTemplate(name, integrationId, connection.settings || {});
}

export default {
  listTemplates,
  getTemplate,
  applyTemplate,
  createTemplate,
  exportTemplate
};
